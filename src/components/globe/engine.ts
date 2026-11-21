/**
 * The globe engine: everything that drives the MapLibre camera and the island states.
 * No React in here. <Globe> creates one per map and forwards its props through `get()`.
 *
 * One requestAnimationFrame loop does the spin and the flights, so the two can never fight, and
 * it only runs while one of them is active.
 */
import type { Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent, PointLike } from "maplibre-gl";
import type { GlobeIsland, LngLat } from "@/lib/islands";
import {
  cameraDistance,
  fitBounds,
  globeRadius,
  homeLimb,
  limbRadius,
  planFlight,
  viewCentre,
  zoomForLimb,
  type CameraState,
  type Flight,
  type Padding,
} from "./camera";
import { ISLANDS_SOURCE, ISLAND_GLOW_SOURCE, ISLAND_POINTS_SOURCE } from "./style";
import type { FlyOptions, GlobeAltitude, SnapshotOptions, TourOptions } from "./types";
import { rememberView } from "./view-memory";

/** What the engine reads from <Globe> on every use, so it always has the latest props. */
export interface EngineInput {
  islands: readonly GlobeIsland[];
  selectedId: string | null;
  autoRotate: number;
  rotateResumeMs: number;
  padding: Padding;
  globeSize: number;
  homeCenter: LngLat;
  selectable: "all" | "live";
  interactive: boolean;
  reducedMotion: boolean;
  onSelect?(id: string): void;
  onBackgroundClick?(): void;
  onFlightStart?(id: string | null): void;
  onFlightEnd?(id: string | null, completed: boolean): void;
  onArrive?(id: string): void;
  onUserInteraction?(): void;
}

interface ActiveFlight {
  plan: Flight;
  start: number;
  /** Island being flown to, or null for the home view. */
  id: string | null;
  /** A re-framing move (padding changed), not a journey: no onArrive at the end. */
  quiet: boolean;
  fromPadding: Padding;
  toPadding: Padding;
  resolve(completed: boolean): void;
}

/** Zoom above the home view at which the camera counts as being over a region, then an island. */
const REGION_ABOVE_HOME = 2.2;
const ISLAND_ZOOM = 8;

export class GlobeEngine {
  private raf = 0;
  private last = 0;
  private resumeTimer = 0;
  private flight: ActiveFlight | null = null;
  private tourToken = 0;
  private rotateRamp = 0;
  private lastInteraction = -Infinity;
  private gesture = false;
  private visible = true;
  private lost = false;
  private destroyed = false;
  /** True while the camera is where resetView left it (so a resize can re-frame the globe). */
  private atHome = true;
  /** Island the camera is at or heading for. */
  targetId: string | null = null;
  private stateIds = new Set<string>();
  private selected: string | null = null;
  private hovered: string | null = null;
  private hitLayers: string[] = [];
  private vars = { x: NaN, y: NaN, r: NaN, t: NaN, altitude: "" as GlobeAltitude | "", space: null as boolean | null };
  private observer: IntersectionObserver | null = null;
  private cleanups: (() => void)[] = [];
  /** Marker elements by island id; the engine toggles their data attributes on zoom. */
  markers = new Map<string, HTMLElement>();

  /**
   * @param root   gets the data attributes (data-altitude, data-flying, data-rotating, data-touring)
   * @param get    latest props
   * @param stage  gets the --globe-* variables (a child of root, so container units resolve)
   */
  constructor(
    private map: MapLibreMap,
    private root: HTMLElement,
    private get: () => EngineInput,
    private stage: HTMLElement = root,
  ) {
    const canvasHost = map.getCanvasContainer();
    const onUser = () => this.userInteracted();
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown"] as const) {
      canvasHost.addEventListener(type, onUser, { passive: true });
      this.cleanups.push(() => canvasHost.removeEventListener(type, onUser));
    }

    const onGestureStart = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) {
        this.gesture = true;
        // The visitor has taken the camera: it is no longer "at home" or "on" any island.
        this.atHome = false;
        this.targetId = null;
      }
    };
    const onGestureEnd = () => {
      if (this.gesture) {
        this.gesture = false;
        this.lastInteraction = performance.now();
        this.syncRotation();
      }
    };
    map.on("dragstart", onGestureStart);
    map.on("zoomstart", onGestureStart);
    map.on("moveend", onGestureEnd);
    map.on("click", this.onClick);
    map.on("render", this.publish);
    map.on("moveend", this.remember);
    map.on("styledata", this.refreshHitLayers);
    map.on("resize", this.onResize);
    if (typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches) {
      map.on("mousemove", this.onHover);
      map.on("mouseout", this.onHoverEnd);
    }

    const onVisibility = () => this.syncRotation();
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));

    if (typeof IntersectionObserver === "function") {
      this.observer = new IntersectionObserver((entries) => {
        this.visible = entries[entries.length - 1]?.isIntersecting ?? true;
        this.syncRotation();
      });
      this.observer.observe(root);
    }

    this.refreshHitLayers();
    this.publish();
  }

  destroy(): void {
    this.destroyed = true;
    this.finishFlight(false);
    this.tourToken++;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.resumeTimer);
    this.observer?.disconnect();
    for (const off of this.cleanups) off();
    this.cleanups = [];
    this.remember();
  }

  /* ------------------------------------------------------------ cameras */

  private size(): { width: number; height: number } {
    const canvas = this.map.getCanvas();
    return { width: canvas.clientWidth || this.root.clientWidth || 390, height: canvas.clientHeight || this.root.clientHeight || 844 };
  }

  current(): CameraState {
    const c = this.map.getCenter();
    return { center: [c.lng, c.lat], zoom: this.map.getZoom(), bearing: this.map.getBearing(), pitch: this.map.getPitch() };
  }

  private currentPadding(): Padding {
    const p = this.map.getPadding();
    return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };
  }

  /** The whole-globe view for the current box and padding. */
  homeCamera(padding = this.get().padding): CameraState {
    const { width, height } = this.size();
    const { globeSize, homeCenter } = this.get();
    const limb = homeLimb(width, height, padding, globeSize);
    return { center: homeCenter, zoom: zoomForLimb(limb, homeCenter[1], height), bearing: 0, pitch: 0 };
  }

  /** The view that frames an island clear of the padding. */
  islandCamera(island: GlobeIsland, options: FlyOptions = {}, padding = this.get().padding): CameraState {
    const { width, height } = this.size();
    const fit = fitBounds(island.bbox, width, height, padding, {
      fill: options.fill,
      minZoom: this.homeCamera(padding).zoom + 1.5,
      maxZoom: island.view?.maxZoom ?? 13.6,
    });
    return {
      center: fit.center,
      zoom: options.zoom ?? fit.zoom,
      bearing: options.bearing ?? island.view?.bearing ?? 0,
      pitch: options.pitch ?? island.view?.pitch ?? 0,
    };
  }

  /* ------------------------------------------------------------- flying */

  private apply(state: CameraState, padding: Padding): void {
    this.map.jumpTo({ center: state.center, zoom: state.zoom, bearing: state.bearing, pitch: state.pitch, padding });
  }

  /** True while a flight is in the air. */
  get flying(): boolean {
    return this.flight !== null;
  }

  private fly(to: CameraState, id: string | null, options: FlyOptions & { quiet?: boolean } = {}): Promise<boolean> {
    if (this.destroyed) return Promise.resolve(false);
    this.finishFlight(false);
    const input = this.get();
    this.targetId = id;
    this.atHome = false;
    const toPadding = input.padding;

    if (input.reducedMotion || options.animate === false || this.lost) {
      this.apply(to, toPadding);
      input.onFlightStart?.(id);
      input.onFlightEnd?.(id, true);
      if (id !== null && options.quiet !== true) input.onArrive?.(id);
      return Promise.resolve(true);
    }

    const plan = planFlight(this.current(), to, {
      globalZoom: this.homeCamera(toPadding).zoom,
      duration: options.duration,
      speed: options.speed,
      viaGlobe: options.viaGlobe,
    });
    this.map.stop();
    this.root.setAttribute("data-flying", id ?? "home");
    input.onFlightStart?.(id);
    return new Promise<boolean>((resolve) => {
      this.flight = { plan, start: performance.now(), id, quiet: options.quiet === true, fromPadding: this.currentPadding(), toPadding, resolve };
      this.kick();
    });
  }

  private finishFlight(completed: boolean): void {
    const flight = this.flight;
    if (!flight) return;
    this.flight = null;
    this.root.removeAttribute("data-flying");
    if (!completed && flight.id !== null && this.targetId === flight.id) this.targetId = null;
    // Idle time before the spin resumes counts from the end of the flight.
    this.lastInteraction = Math.max(this.lastInteraction, performance.now() - this.get().rotateResumeMs + 1200);
    flight.resolve(completed);
    this.get().onFlightEnd?.(flight.id, completed);
    if (completed && flight.id !== null && !flight.quiet) this.get().onArrive?.(flight.id);
    this.syncRotation();
  }

  flyToIsland(id: string, options: FlyOptions = {}): Promise<boolean> {
    const island = this.get().islands.find((i) => i.id === id);
    if (!island) return Promise.resolve(false);
    return this.fly(this.islandCamera(island, options), id, options);
  }

  resetView(options: FlyOptions = {}): Promise<boolean> {
    const done = this.fly(this.homeCamera(), null, options);
    void done.then((completed) => {
      if (completed) this.atHome = true;
    });
    return done;
  }

  /** Stop a flight or tour. */
  stop(): void {
    this.tourToken++;
    this.finishFlight(false);
  }

  async tour(ids: string[], options: TourOptions = {}): Promise<boolean> {
    const { dwellMs = 2600, loop = false, viaGlobe = false } = options;
    const token = ++this.tourToken;
    const known = ids.filter((id) => this.get().islands.some((i) => i.id === id));
    if (!known.length) return false;
    this.root.setAttribute("data-touring", "");
    try {
      do {
        for (let i = 0; i < known.length; i++) {
          if (token !== this.tourToken) return false;
          const id = known[i];
          options.onStep?.(id, i);
          this.setHighlight(id);
          const arrived = await this.flyToIsland(id, { viaGlobe });
          // flyToIsland ends an earlier flight; only a different tour or a user touch changes the token.
          if (!arrived || token !== this.tourToken) return false;
          options.onArrive?.(id, i);
          await new Promise<void>((resolve) => window.setTimeout(resolve, this.get().reducedMotion ? Math.max(dwellMs, 3500) : dwellMs));
        }
      } while (loop && token === this.tourToken);
      return token === this.tourToken;
    } finally {
      if (token === this.tourToken) {
        this.root.removeAttribute("data-touring");
        this.setHighlight(this.get().selectedId);
      }
    }
  }

  /* ----------------------------------------------------------- the loop */

  private kick(): void {
    if (!this.raf && !this.destroyed) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private wantsRotation(): boolean {
    const input = this.get();
    return (
      input.autoRotate !== 0 &&
      !input.reducedMotion &&
      !input.selectedId &&
      !this.lost &&
      this.visible &&
      document.visibilityState === "visible" &&
      !this.root.hasAttribute("data-touring")
    );
  }

  /** Start, stop or schedule the spin to match the current props and state. */
  syncRotation(): void {
    window.clearTimeout(this.resumeTimer);
    if (this.destroyed || this.flight || !this.wantsRotation()) {
      if (!this.flight) this.root.removeAttribute("data-rotating");
      return;
    }
    const wait = this.lastInteraction + this.get().rotateResumeMs - performance.now();
    if (wait > 0 || this.gesture) {
      this.root.removeAttribute("data-rotating");
      this.resumeTimer = window.setTimeout(() => this.syncRotation(), Math.max(60, wait));
      return;
    }
    this.kick();
  }

  private slowFrames = 0;
  private downgrades = 0;

  /**
   * Adaptive quality. If the device cannot keep up while the globe is moving (frames averaging
   * worse than about 38 fps for a second), render at a lower pixel ratio: 2 -> 1.5 -> 1. A
   * slightly softer globe that moves smoothly beats a sharp one that stutters. Never raised again
   * within the visit, so it cannot oscillate.
   */
  private watchFrameRate(dt: number): void {
    if (this.downgrades >= 2) return;
    if (dt > 26) this.slowFrames += dt > 40 ? 2 : 1;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames < 36) return;
    this.slowFrames = 0;
    const ratio = this.map.getPixelRatio();
    if (ratio <= 1) {
      this.downgrades = 2;
      return;
    }
    this.downgrades++;
    const next = Math.max(1, ratio - 0.5);
    this.map.setPixelRatio(next);
    this.root.setAttribute("data-quality", String(next));
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (this.destroyed) return;
    const elapsed = now - this.last;
    const dt = Math.min(64, elapsed);
    this.last = now;
    this.watchFrameRate(elapsed);

    if (this.flight) {
      const flight = this.flight;
      const t = Math.min(1, (now - flight.start) / flight.plan.duration);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const a = flight.fromPadding;
      const b = flight.toPadding;
      this.apply(flight.plan.at(t), {
        top: a.top + (b.top - a.top) * e,
        right: a.right + (b.right - a.right) * e,
        bottom: a.bottom + (b.bottom - a.bottom) * e,
        left: a.left + (b.left - a.left) * e,
      });
      if (t >= 1) this.finishFlight(true);
      else this.raf = requestAnimationFrame(this.tick);
      return;
    }

    const input = this.get();
    const idle = now - this.lastInteraction >= input.rotateResumeMs && !this.gesture;
    if (!this.wantsRotation() || !idle) {
      this.rotateRamp = 0;
      this.root.removeAttribute("data-rotating");
      return;
    }

    // Ease the spin in over about a second, and slow it as the camera gets closer so the ground
    // crosses the screen at the same pace. Past the regional view the globe holds still.
    this.rotateRamp = Math.min(1, this.rotateRamp + dt / 1100);
    const ramp = this.rotateRamp * this.rotateRamp * (3 - 2 * this.rotateRamp);
    const centre = this.map.getCenter();
    const home = this.homeCamera();
    const above = this.map.getZoom() - home.zoom;
    if (above > 3) {
      this.root.removeAttribute("data-rotating");
      return;
    }
    const pace = Math.min(1, 2 ** -above);
    const lng = centre.lng - (input.autoRotate * ramp * pace * dt) / 1000;
    // Drift back to the home latitude, so a globe left tilted toward a pole rights itself.
    const lat = centre.lat + (home.center[1] - centre.lat) * (1 - Math.exp(-dt / 5000));
    this.map.jumpTo({ center: [lng, lat] });
    if (!this.root.hasAttribute("data-rotating")) this.root.setAttribute("data-rotating", "");
    this.raf = requestAnimationFrame(this.tick);
  };

  private userInteracted(): void {
    this.lastInteraction = performance.now();
    this.tourToken++;
    this.root.removeAttribute("data-touring");
    this.finishFlight(false);
    this.rotateRamp = 0;
    this.get().onUserInteraction?.();
    this.syncRotation();
  }

  /* --------------------------------------------------- props that changed */

  /** The padding prop changed: re-frame what is on screen for the new free area. */
  paddingChanged(): void {
    if (this.destroyed || this.flight) return;
    const input = this.get();
    const island = input.selectedId ? input.islands.find((i) => i.id === input.selectedId) : null;
    const to = island && this.targetId === island.id ? this.islandCamera(island) : this.atHome ? this.homeCamera() : this.current();
    const wasHome = this.atHome;
    const id = island && this.targetId === island.id ? island.id : null;
    void this.fly(to, id, { duration: 520, quiet: true }).then(() => {
      this.atHome = wasHome;
    });
  }

  private onResize = (): void => {
    if (this.destroyed || this.flight) return;
    const input = this.get();
    const island = input.selectedId ? input.islands.find((i) => i.id === input.selectedId) : null;
    if (island && this.targetId === island.id) this.apply(this.islandCamera(island), input.padding);
    else if (this.atHome) {
      const home = this.homeCamera();
      // Keep the longitude the spin has reached; only the size and latitude are re-framed.
      this.apply({ ...home, center: [this.map.getCenter().lng, home.center[1]] }, input.padding);
    }
    this.publish();
  };

  /* -------------------------------------------------- selection and hover */

  /** Tell the engine which feature ids exist (after the island data is set on the sources). */
  setIslandIds(ids: Iterable<string>): void {
    this.stateIds = new Set(ids);
    this.applyStates();
  }

  setSelected(id: string | null): void {
    if (!this.root.hasAttribute("data-touring")) this.setHighlight(id);
    this.syncRotation();
  }

  private setHighlight(id: string | null): void {
    this.selected = id;
    this.applyStates();
  }

  /** (Re)apply feature states. Safe to call any time; MapLibre drops states when data changes. */
  applyStates(): void {
    if (this.destroyed || this.lost) return;
    for (const source of [ISLANDS_SOURCE, ISLAND_GLOW_SOURCE, ISLAND_POINTS_SOURCE]) {
      if (!this.map.getSource(source)) continue;
      for (const id of this.stateIds) {
        this.map.setFeatureState(
          { source, id },
          { selected: id === this.selected, hover: id === this.hovered, dimmed: this.selected !== null && id !== this.selected },
        );
      }
    }
    for (const [id, el] of this.markers) el.setAttribute("data-selected", String(id === this.selected));
  }

  private refreshHitLayers = (): void => {
    const style = this.map.getStyle();
    this.hitLayers = (style?.layers ?? [])
      .filter((l) => "source" in l && (l.source === ISLANDS_SOURCE || l.source === ISLAND_POINTS_SOURCE))
      .filter((l) => l.layout?.visibility !== "none")
      .map((l) => l.id);
  };

  /** Island under a screen point, with a finger-sized tolerance. */
  private hit(point: { x: number; y: number }, tolerance: number): string | null {
    if (!this.hitLayers.length) return null;
    const input = this.get();
    const zoom = this.map.getZoom();
    const usable = (f: MapGeoJSONFeature): boolean => {
      const p = f.properties ?? {};
      if (input.selectable === "live" && p.status !== "live") return false;
      // An island that is not marked at this zoom cannot be tapped (rank 2 islands at globe altitude).
      return typeof p.minZoom !== "number" || zoom >= p.minZoom - 0.25;
    };
    const query = (geometry: PointLike | [PointLike, PointLike]) =>
      this.map.queryRenderedFeatures(geometry, { layers: this.hitLayers }).filter(usable);

    const exact = query([point.x, point.y]);
    if (exact.length) return String(exact[0].properties.id);

    const near = query([
      [point.x - tolerance, point.y - tolerance],
      [point.x + tolerance, point.y + tolerance],
    ]);
    if (!near.length) return null;
    // Several islands within reach: take the one whose centre is closest to the finger.
    let best: string | null = null;
    let bestD = Infinity;
    const seen = new Set<string>();
    for (const f of near) {
      const id = String(f.properties.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const island = input.islands.find((i) => i.id === id);
      if (!island) continue;
      const p = this.map.project(island.coordinates);
      const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  private onClick = (e: MapMouseEvent): void => {
    const input = this.get();
    if (!input.interactive) return;
    const touch = (e.originalEvent as PointerEvent | undefined)?.pointerType !== "mouse";
    const id = this.hit(e.point, touch ? 16 : 6);
    if (id) input.onSelect?.(id);
    else input.onBackgroundClick?.();
  };

  private hoverFrame = 0;
  private onHover = (e: MapMouseEvent): void => {
    if (this.hoverFrame || this.flight || this.gesture) return;
    const point = e.point;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      if (this.destroyed || !this.get().interactive) return;
      this.setHover(this.hit(point, 4));
    });
  };

  private onHoverEnd = (): void => this.setHover(null);

  private setHover(id: string | null): void {
    if (id === this.hovered) return;
    this.hovered = id;
    this.map.getCanvas().style.cursor = id ? "pointer" : "";
    this.applyStates();
  }

  /* ---------------------------------------------------------- publishing */

  /**
   * Publish where the globe is on screen, for CSS: --globe-x, --globe-y (centre) and --globe-r
   * (silhouette radius) in px, --globe-t (0 at the home view to 1 once the planet no longer fits)
   * and data-altitude. Only written when a value has changed, so a steady spin costs nothing.
   */
  publish = (): void => {
    if (this.destroyed) return;
    const { width, height } = this.size();
    const padding = this.currentPadding();
    const c = viewCentre(width, height, padding);
    const zoom = this.map.getZoom();
    const lat = this.map.getCenter().lat;
    const r = limbRadius(globeRadius(zoom, lat), cameraDistance(height));
    const home = this.homeCamera(padding);
    const above = zoom - Math.log2(Math.cos((lat * Math.PI) / 180)) - (home.zoom - Math.log2(Math.cos((home.center[1] * Math.PI) / 180)));
    const t = Math.max(0, Math.min(1, above / 2.4));
    const altitude: GlobeAltitude = zoom >= ISLAND_ZOOM ? "island" : above >= REGION_ABOVE_HOME ? "region" : "globe";
    const v = this.vars;
    const style = this.stage.style;
    if (Math.abs(c.x - v.x) > 0.2 || Number.isNaN(v.x)) style.setProperty("--globe-x", `${(v.x = c.x).toFixed(1)}px`);
    if (Math.abs(c.y - v.y) > 0.2 || Number.isNaN(v.y)) style.setProperty("--globe-y", `${(v.y = c.y).toFixed(1)}px`);
    if (Math.abs(r - v.r) > 0.2 || Number.isNaN(v.r)) style.setProperty("--globe-r", `${(v.r = r).toFixed(1)}px`);
    if (Math.abs(t - v.t) > 0.004 || Number.isNaN(v.t)) style.setProperty("--globe-t", (v.t = t).toFixed(3));
    if (altitude !== v.altitude) {
      v.altitude = altitude;
      this.root.setAttribute("data-altitude", altitude);
    }
    // Is any of the page behind the globe showing? False once the planet fills the box.
    const reach = Math.hypot(Math.max(c.x, width - c.x), Math.max(c.y, height - c.y));
    const space = r < reach;
    if (space !== v.space) {
      v.space = space;
      this.root.setAttribute("data-space", String(space));
    }
    this.updateMarkers(zoom);
  };

  private markerZoom = NaN;
  /** Markers appear at their island's minimum zoom and hand over to the outline at dotZoom. */
  updateMarkers(zoom = this.map.getZoom(), force = false): void {
    if (!this.markers.size) return;
    if (!force && Math.abs(zoom - this.markerZoom) < 0.05) return;
    this.markerZoom = zoom;
    for (const [id, el] of this.markers) {
      const minZoom = Number(el.dataset.minZoom ?? 0);
      const dotZoom = Number(el.dataset.dotZoom ?? 99);
      const shown = zoom >= minZoom;
      if (el.hidden === shown) el.hidden = !shown;
      const near = String(zoom >= dotZoom);
      if (el.getAttribute("data-near") !== near) el.setAttribute("data-near", near);
      if (!el.hasAttribute("data-selected")) el.setAttribute("data-selected", String(id === this.selected));
    }
  }

  private remember = (): void => {
    if (this.flight || this.lost) return;
    rememberView({ ...this.current(), padding: this.currentPadding(), targetId: this.targetId, atHome: this.atHome });
  };

  /** Restore flags that travel with a remembered view. */
  adopt(targetId: string | null, atHome: boolean): void {
    this.targetId = targetId;
    this.atHome = atHome;
  }

  setLost(lost: boolean): void {
    this.lost = lost;
    if (lost) this.finishFlight(false);
    else this.applyStates();
    this.syncRotation();
  }

  /* ------------------------------------------------------------ snapshot */

  snapshot(options: SnapshotOptions = {}): Promise<string> {
    const { type = "image/jpeg", quality = 0.9, maxSize } = options;
    return new Promise<string>((resolve, reject) => {
      // The drawing buffer is only readable in the same task as a render, so read it there.
      this.map.once("render", () => {
        try {
          const source = this.map.getCanvas();
          const scale = maxSize ? Math.min(1, maxSize / Math.max(source.width, source.height)) : 1;
          const out = document.createElement("canvas");
          out.width = Math.max(1, Math.round(source.width * scale));
          out.height = Math.max(1, Math.round(source.height * scale));
          const ctx = out.getContext("2d");
          if (!ctx) throw new Error("2D canvas is not available");
          const background =
            options.background ?? (type === "image/png" ? null : getComputedStyle(this.root).getPropertyValue("--o-bg").trim() || "#ffffff");
          if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, out.width, out.height);
          }
          ctx.drawImage(source, 0, 0, out.width, out.height);
          resolve(out.toDataURL(type, quality));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
      this.map.triggerRepaint();
    });
  }
}
