"use client";

/**
 * <Globe>: a real 3D globe that zooms without a seam into street-level detail (MapLibre GL JS,
 * globe projection, OpenFreeMap vector tiles).
 *
 * Loading (UX-7): this file is small. MapLibre itself (about 275 KB gzipped) is imported after the
 * first paint, and until its first frame is ready the visitor sees <GlobePoster>, an SVG globe in
 * the option's colours drawn with the same camera maths, so the live map fades in on top of a
 * picture of itself. Without WebGL the poster stays and its island dots become buttons.
 *
 * What each option brings: a map style (`style`), optionally DOM markers (`renderMarker`) and
 * anything it wants to draw over the globe (`children`). Everything else (camera choreography,
 * spin, selection, hit testing, resize, reduced motion, context loss) is handled here and in
 * engine.ts. API reference: docs/agents/v2-foundation.md.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { GeoJSONSource, Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import { HOME_VIEW, ISLANDS, islandStrings, type GlobeIsland } from "@/lib/islands";
import { t } from "@/lib/strings";
import { fullPadding, homeLimb, zoomForLimb } from "./camera";
import { GlobeEngine, type EngineInput } from "./engine";
import { GlobePoster } from "./GlobePoster";
import { buildIslandData, EMPTY_COLLECTION, loadIslandGeometry, type IslandCollections } from "./island-data";
import { ISLANDS_SOURCE, ISLAND_GLOW_SOURCE, ISLAND_POINTS_SOURCE, resolveStyle } from "./style";
import type { FlyOptions, GlobeHandle, GlobeProps, GlobeStatus, SnapshotOptions, TourOptions } from "./types";
import { recallView } from "./view-memory";
import "./globe.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** MapLibre needs WebGL. Checked on a throwaway canvas before the library is downloaded. */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    // Release the probe context straight away: mobile browsers allow only a few at a time.
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** The option's style plus the two island sources the engine owns, on a globe. */
function prepareStyle(style: StyleSpecification, data: IslandCollections): StyleSpecification {
  return {
    ...style,
    projection: style.projection ?? { type: "globe" },
    sources: {
      ...style.sources,
      [ISLANDS_SOURCE]: { type: "geojson", data: data.outlines, promoteId: "id", maxzoom: 14 },
      [ISLAND_GLOW_SOURCE]: { type: "geojson", data: data.glow, promoteId: "id", maxzoom: 12 },
      [ISLAND_POINTS_SOURCE]: { type: "geojson", data: data.points, promoteId: "id" },
    },
  };
}

export const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe(props, ref) {
  const {
    style,
    islands = ISLANDS,
    selectedId = null,
    autoRotate = 0,
    rotateResumeMs = 6000,
    interactive = true,
    className,
    globeSize = 0.86,
    homeCenter = HOME_VIEW.center,
    flyOnSelect = true,
    selectable = "all",
    renderMarker,
    staticImage,
    restoreView = true,
    maxPixelRatio = 2,
    attribution = "bottom-right",
    label = islandStrings.globe.label,
    children,
  } = props;

  const padding = useMemo(
    () => fullPadding(props.padding),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compared by value: callers pass a fresh object each render
    [props.padding?.top, props.padding?.right, props.padding?.bottom, props.padding?.left],
  );
  const reducedMotion = usePrefersReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const dataRef = useRef<IslandCollections>(EMPTY_COLLECTION);
  const geometryRef = useRef<Awaited<ReturnType<typeof loadIslandGeometry>> | null>(null);

  const [status, setStatus] = useState<GlobeStatus>("poster");
  /** Bumped to rebuild the map after a context loss that the browser did not recover from. */
  const [generation, setGeneration] = useState(0);
  const [stuck, setStuck] = useState(false);
  /** A globe that picks up a remembered view has no poster: the poster shows the home view. */
  const [resumed] = useState(() => restoreView && recallView() !== null);
  const [markerEls, setMarkerEls] = useState<Map<string, HTMLElement>>(() => new Map());

  /** Latest props for the engine and for map event handlers, without re-creating the map. */
  const input = useRef<EngineInput>(null as unknown as EngineInput);
  input.current = {
    islands,
    selectedId,
    autoRotate,
    rotateResumeMs,
    padding,
    globeSize,
    homeCenter,
    selectable,
    interactive,
    reducedMotion,
    onSelect: props.onSelect,
    onBackgroundClick: props.onBackgroundClick,
    onFlightStart: props.onFlightStart,
    onFlightEnd: props.onFlightEnd,
    onArrive: props.onArrive,
    onUserInteraction: props.onUserInteraction,
  };
  const latest = useRef({ style, onReady: props.onReady, onStatusChange: props.onStatusChange, flyOnSelect, restoreView, maxPixelRatio, label });
  latest.current = { style, onReady: props.onReady, onStatusChange: props.onStatusChange, flyOnSelect, restoreView, maxPixelRatio, label };

  /** Island a caller has just asked to fly to through the handle, so the selection effect does not start a second flight. */
  const requested = useRef<string | null>(null);

  /** Resolves when the live map is on screen; flights requested earlier wait for it. */
  const ready = useRef<{ promise: Promise<void>; resolve(): void } | null>(null);
  if (!ready.current) {
    let resolve = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    ready.current = { promise, resolve };
  }

  const statusRef = useRef<GlobeStatus>("poster");
  const changeStatus = useCallback((next: GlobeStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
    // Nothing more to wait for: calls queued on the handle can go ahead (and find no map).
    if (next === "fallback") ready.current?.resolve();
    latest.current.onStatusChange?.(next);
  }, []);

  /* ------------------------------------------------------------ the map */

  useEffect(() => {
    const host = mapHostRef.current;
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!host || !root || !stage) return;

    if (!hasWebGL()) {
      changeStatus("fallback");
      return;
    }

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let engine: GlobeEngine | null = null;
    let revealTimer = 0;
    let stuckTimer = 0;
    const markers: Marker[] = [];

    (async () => {
      const [{ default: maplibregl }, geometry] = await Promise.all([import("maplibre-gl"), loadIslandGeometry()]);
      if (cancelled) return;
      geometryRef.current = geometry;
      dataRef.current = buildIslandData(input.current.islands, geometry);

      const remembered = latest.current.restoreView ? recallView() : null;
      const width = host.clientWidth || 390;
      const height = host.clientHeight || 844;
      // The engine does not exist yet, so work out the home view the same way it will.
      const home = input.current.homeCenter;
      const opening = remembered ?? {
        center: home,
        zoom: zoomForLimb(homeLimb(width, height, input.current.padding, input.current.globeSize), home[1], height),
        bearing: 0,
        pitch: 0,
      };

      try {
        map = new maplibregl.Map({
          container: host,
          style: prepareStyle(resolveStyle(latest.current.style), dataRef.current),
          center: opening.center,
          zoom: opening.zoom,
          bearing: opening.bearing,
          pitch: opening.pitch,
          minZoom: 0.4,
          maxZoom: 17,
          maxPitch: 60,
          attributionControl: false,
          interactive: input.current.interactive,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          fadeDuration: 180,
          pixelRatio: Math.min(window.devicePixelRatio || 1, latest.current.maxPixelRatio),
          canvasContextAttributes: { antialias: true, powerPreference: "high-performance" },
          refreshExpiredTiles: false,
          validateStyle: process.env.NODE_ENV !== "production",
          locale: { "Map.Title": latest.current.label },
        });
      } catch {
        changeStatus("fallback");
        return;
      }
      const m = map;
      m.setPadding(remembered?.padding ?? input.current.padding);
      m.touchZoomRotate.disableRotation();
      m.keyboard.disableRotation();
      // Tile and font requests that fail (offline, a flaky in-app browser) must not spam the
      // console; the map simply keeps what it has.
      m.on("error", (event) => {
        const error = (event as { error?: { name?: string; message?: string; status?: number } }).error;
        const network = !error || error.name === "AJAXError" || error.name === "AbortError" || typeof error.status === "number" || /fetch|network|load/i.test(error.message ?? "");
        // A mistake in an option's style, on the other hand, should be loud while developing.
        if (!network && process.env.NODE_ENV !== "production") console.error("[Globe] map style error:", error.message);
      });

      engine = new GlobeEngine(m, root, () => input.current, stage);
      engine.setIslandIds(input.current.islands.map((i) => i.id));
      if (remembered) engine.adopt(remembered.targetId, remembered.atHome);
      engine.setSelected(input.current.selectedId);
      mapRef.current = m;
      engineRef.current = engine;

      // DOM markers: one real button per island, filled by React through a portal.
      const els = new Map<string, HTMLElement>();
      for (const feature of dataRef.current.points.features) {
        const p = feature.properties;
        const el = document.createElement("button");
        el.type = "button";
        el.className = "ipg-marker";
        el.setAttribute("aria-label", t(islandStrings.globe.islandLabel, { name: p.name, country: p.country }));
        el.dataset.id = p.id;
        el.dataset.live = String(p.status === "live");
        el.dataset.minZoom = String(p.minZoom);
        el.dataset.dotZoom = String(p.dotZoom);
        el.hidden = true;
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          const current = input.current;
          if (!current.interactive) return;
          if (current.selectable === "live" && p.status !== "live") return;
          current.onSelect?.(p.id);
        });
        const [lng, lat] = feature.geometry.coordinates;
        markers.push(new maplibregl.Marker({ element: el, opacityWhenCovered: "0" }).setLngLat([lng, lat]).addTo(m));
        els.set(p.id, el);
      }
      engine.markers = els;
      engine.updateMarkers(m.getZoom(), true);
      setMarkerEls(els);

      const reveal = () => {
        if (cancelled || !engine) return;
        window.clearTimeout(revealTimer);
        changeStatus("ready");
        setStuck(false);
        engine.applyStates();
        engine.syncRotation();
        ready.current?.resolve();
        latest.current.onReady?.(m);
        // A deep link (?island=) or a selection made while loading: fly there now that we can.
        const current = input.current;
        if (current.selectedId) {
          if (engine.targetId === current.selectedId) current.onArrive?.(current.selectedId);
          else if (latest.current.flyOnSelect && requested.current !== current.selectedId) void engine.flyToIsland(current.selectedId);
        }
      };
      m.once("load", reveal);
      // On a slow connection, show the live map after a while even if tiles are still arriving.
      revealTimer = window.setTimeout(() => {
        if (m.isStyleLoaded()) reveal();
        else m.once("styledata", reveal);
      }, 7000);

      m.on("webglcontextlost", () => {
        if (cancelled) return;
        engine?.setLost(true);
        changeStatus("lost");
        // Browsers usually hand the context back by themselves. If not, offer a reload.
        stuckTimer = window.setTimeout(() => setStuck(true), 2500);
      });
      m.on("webglcontextrestored", () => {
        if (cancelled) return;
        window.clearTimeout(stuckTimer);
        setStuck(false);
        engine?.setLost(false);
        changeStatus("ready");
      });
    })().catch(() => {
      if (!cancelled) changeStatus("fallback");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(revealTimer);
      window.clearTimeout(stuckTimer);
      engine?.destroy();
      for (const marker of markers) marker.remove();
      map?.remove();
      mapRef.current = null;
      engineRef.current = null;
      setMarkerEls(new Map());
    };
  }, [generation, changeStatus]);

  /* ----------------------------------------------- props that can change */

  // Restyle when the option hands over a new style.
  const firstStyle = useRef(true);
  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(prepareStyle(resolveStyle(style), dataRef.current));
    map.once("styledata", () => engineRef.current?.applyStates());
  }, [style]);

  // A different set of islands: rebuild the two sources.
  const firstIslands = useRef(true);
  useEffect(() => {
    if (firstIslands.current) {
      firstIslands.current = false;
      return;
    }
    const map = mapRef.current;
    const geometry = geometryRef.current;
    if (!map || !geometry) return;
    dataRef.current = buildIslandData(islands, geometry);
    (map.getSource(ISLANDS_SOURCE) as GeoJSONSource | undefined)?.setData(dataRef.current.outlines);
    (map.getSource(ISLAND_GLOW_SOURCE) as GeoJSONSource | undefined)?.setData(dataRef.current.glow);
    (map.getSource(ISLAND_POINTS_SOURCE) as GeoJSONSource | undefined)?.setData(dataRef.current.points);
    engineRef.current?.setIslandIds(islands.map((i) => i.id));
  }, [islands]);

  // Selection: glow, and fly there unless the camera is already there or on its way.
  const firstSelection = useRef(true);
  useEffect(() => {
    if (firstSelection.current) {
      // The first value is handled when the map reveals itself (or the fallback is chosen).
      firstSelection.current = false;
      return;
    }
    if (status === "fallback") {
      if (selectedId) input.current.onArrive?.(selectedId);
      return;
    }
    const engine = engineRef.current;
    if (!engine || status !== "ready") return;
    engine.setSelected(selectedId);
    if (!selectedId) return;
    if (engine.targetId === selectedId) {
      if (!engine.flying) input.current.onArrive?.(selectedId);
    } else if (flyOnSelect && requested.current !== selectedId) void engine.flyToIsland(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a change of selection should fly
  }, [selectedId]);

  // No map at all: a selection that was there from the start has "arrived" as soon as we know.
  useEffect(() => {
    if (status === "fallback" && input.current.selectedId) input.current.onArrive?.(input.current.selectedId);
  }, [status]);

  useEffect(() => {
    engineRef.current?.syncRotation();
  }, [autoRotate, rotateResumeMs, reducedMotion]);

  const firstPadding = useRef(true);
  useEffect(() => {
    if (firstPadding.current) {
      firstPadding.current = false;
      return;
    }
    engineRef.current?.paddingChanged();
  }, [padding, globeSize]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const handler of [map.dragPan, map.scrollZoom, map.touchZoomRotate, map.doubleClickZoom, map.keyboard, map.boxZoom]) {
      if (interactive) handler.enable();
      else handler.disable();
    }
    if (interactive) map.touchZoomRotate.disableRotation();
  }, [interactive, status]);

  /* -------------------------------------------------------------- handle */

  useImperativeHandle(ref, (): GlobeHandle => {
    const whenReady = () => ready.current!.promise;
    const withEngine = async <T,>(run: (engine: GlobeEngine) => Promise<T>, otherwise: T): Promise<T> => {
      await whenReady();
      const engine = engineRef.current;
      return engine ? run(engine) : otherwise;
    };
    return {
      // Without a map there is nothing to wait for: report arrival so the caller's UI carries on.
      flyToIsland: (id: string, options?: FlyOptions) => {
        requested.current = id;
        return withEngine(
          (e) => {
            const flight = e.flyToIsland(id, options);
            requested.current = null;
            return flight;
          },
          input.current.islands.some((i) => i.id === id),
        ).finally(() => {
          if (requested.current === id) requested.current = null;
        });
      },
      resetView: (options?: FlyOptions) => withEngine((e) => e.resetView(options), true),
      tour: (ids: string[], options?: TourOptions) => withEngine((e) => e.tour(ids, options), false),
      stop: () => engineRef.current?.stop(),
      snapshot: async (options?: SnapshotOptions) => {
        await whenReady();
        const engine = engineRef.current;
        if (!engine) throw new Error("The map is not available");
        return engine.snapshot(options);
      },
      map: () => mapRef.current,
      whenReady,
    };
  }, []);

  /* -------------------------------------------------------------- render */

  const posterVisible = status !== "ready";
  const vars = {
    "--ipg-pad-t": `${padding.top}px`,
    "--ipg-pad-r": `${padding.right}px`,
    "--ipg-pad-b": `${padding.bottom}px`,
    "--ipg-pad-l": `${padding.left}px`,
    "--ipg-size": globeSize,
  } as CSSProperties;

  const selectFromPoster = useCallback((island: GlobeIsland) => {
    const current = input.current;
    if (!current.interactive) return;
    if (current.selectable === "live" && island.status !== "live") return;
    current.onSelect?.(island.id);
  }, []);

  return (
    <div
      ref={rootRef}
      className={className ? `ipg ${className}` : "ipg"}
      data-status={status}
      data-resumed={resumed ? "" : undefined}
      data-interactive={interactive ? "" : undefined}
      data-altitude="globe"
    >
      <div ref={stageRef} className="ipg-stage" style={vars}>
        <div className="ipg-halo" aria-hidden="true" />
        {!resumed || status !== "poster" ? (
          <GlobePoster
            hidden={!posterVisible}
            islands={islands}
            padding={padding}
            globeSize={globeSize}
            homeCenter={homeCenter}
            staticImage={staticImage}
            // Without WebGL the poster is the interface: its dots are buttons.
            interactive={status === "fallback" && interactive}
            selectedId={selectedId}
            onSelect={selectFromPoster}
            label={label}
          />
        ) : null}
        <div ref={mapHostRef} className="ipg-map" key={generation} aria-hidden={status === "ready" ? undefined : true} />
        <div className="ipg-shade" aria-hidden="true" />
        {children}
        {status === "fallback" ? <p className="ipg-note ipg-sr">{islandStrings.globe.fallback}</p> : null}
        {status === "lost" && stuck ? (
          <button
            type="button"
            className="ipg-retry"
            onClick={() => {
              setStuck(false);
              changeStatus("poster");
              setGeneration((g) => g + 1);
            }}
          >
            {islandStrings.globe.contextLost}
          </button>
        ) : null}
        <p className="ipg-credit" data-corner={attribution} aria-label={islandStrings.globe.attributionLabel}>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
            {islandStrings.globe.attribution}
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer noopener">
            {islandStrings.globe.attributionTiles}
          </a>
        </p>
      </div>
      {renderMarker
        ? islands.map((island) => {
            const el = markerEls.get(island.id);
            if (!el) return null;
            const node = renderMarker(island, { selected: island.id === selectedId, live: island.status === "live" });
            return node == null ? null : createPortal(node, el, island.id);
          })
        : null}
    </div>
  );
});
