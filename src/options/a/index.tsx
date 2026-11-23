"use client";

/**
 * Option A: "Daylight Atlas".
 *
 * A bright, airy travel atlas: pale sky sea, cream land, turquoise islands, a serif wordmark.
 * This file is the shell every layout of the landing shares. It owns the signature sequence:
 *
 *   spin  ->  search, tap or chip  ->  the globe turns and dives  ->  the island blooms as the
 *   camera lands  ->  the card opens and its content staggers in.  Escape, the close button and
 *   the browser's Back fly back out to the spin.
 *
 * Phases (data-phase on the root): "idle" (the landing), "flying" (an island is chosen, the
 * camera is on its way), "landed" (the card is open). The island itself lives in useOption(), so
 * it survives a switch of layout or option and is mirrored in the URL.
 *
 * Layouts (data-layout on the root) arrange the same pieces differently: where the words, the
 * search and the globe sit, where the card lives, how the flight feels. Each is a module in
 * ./layouts; the globe, the card and all the state stay mounted here across a switch.
 *
 * Handoff notes: docs/agents/v2-option-a.md (the look, the card) and docs/agents/v2-layouts.md
 * (the layout system, and each layout's geometry, choreography and timings).
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BASE_SOURCE, Globe, type FlyOptions, type GlobeHandle, type GlobeStatus, type Padding } from "@/components/globe";
import { ISLANDS, getIsland, isLive, islandStrings, type GlobeIsland } from "@/lib/islands";
import { THEMES_QUERY, useOption } from "@/lib/options";
import { t } from "@/lib/strings";
import { apparentZoom, diveTime, flightProgress, homeZoom, lerpPadding, rawZoom, silhouetteRadius } from "./camera";
import { CardActions, CardBody, CardHead, CardHero, SoonBody, type CardView } from "./Card";
import { fontClass } from "./fonts";
import { useHeight, useLinger, useReducedMotion, useViewportHeight, useViewportWidth, useWide } from "./hooks";
import { LAYOUTS, useLayout, type LayoutEnv, type LayoutModule } from "./layouts";
import { LayoutSwitcher } from "./LayoutSwitcher";
import { Brand } from "./parts";
import { PhotoStage } from "./PhotoStage";
import { leadReady, warmPhotos } from "./photos";
import { warmTiles } from "./prefetch";
import type { SearchHandle } from "./Search";
import { Sheet, type Snap } from "./Sheet";
import { aStrings } from "./strings";
import { BLOOM_CORE_LAYER, BLOOM_LAYER, WATER_LAYER, atlasStyle, outlineSourceId } from "./style";
import { installAura } from "./aura";
import { installBackdrop, keepTilesWhileZooming, setBackdrop, whenSharp } from "./tiles";
import "./atlas.css";
import "./layouts/horizon.css";
import "./layouts/orb.css";
import "./layouts/fullbleed.css";

/* Layout numbers shared with atlas.css (see the matching custom properties there). */
const HEAD_H = 118; // sheet: grab bar + name plate
const TABS_H = 54; // sheet: the row of section tabs under the photo
const CTA_H = 76; // sheet: the fixed action bar
const SEARCH_TOP = 10;
const SEARCH_H = 52;
const SOON_HALF = 388;

/** The card follows the island's glow by this much. */
const CARD_AFTER_GLOW_MS = 320;
/** On arrival, the longest the glow and the card wait for the last map tiles (see tiles.ts). */
const SHARP_WAIT_MS = 900;
/** Back on the landing, the longest the backdrop stays while the map's own tiles load (see tiles.ts). */
const BACKDROP_WAIT_MS = 4000;
/** A swaying landing (LayoutModule.drift): how often the turn is checked, and how fast the spin changes direction. */
/** The longest the map's tile prefetch waits for the card's lead photo (its narrow rendition) to arrive first. */
const PHOTO_HEAD_START_MS = 450;
/** After the landing, the longest the card's other pictures wait for its lead photo to be in. */
const PICTURES_WAIT_MS = 2500;
const SWAY_TICK_MS = 400;
const SWAY_STEP = 0.25;

/** A flight between the landing and an island, for a layout that shapes it (LayoutModule.shape). */
interface Journey {
  /** The frames the layout's `shape.frame` runs between (0 and 1). */
  from: Padding;
  to: Padding;
  /** The frames the engine itself moves between: its progress is read back from them. */
  clockFrom: Padding;
  clockTo: Padding;
  /** To an island (true) or back to the landing (false). */
  out: boolean;
  /** How the camera was turned and tilted when the flight set off (FlightView.start). */
  start: { pitch: number; bearing: number };
  /**
   * When the flight set off, and how long it lasts when the layout gave it an exact length: a
   * second clock, used only when the frame does not change (a second island chosen with one
   * open), so there is no padding to read the progress back from.
   */
  began: number;
  duration: number | null;
  /**
   * For a layout that re-times the camera's height (shape.height): the apparent zoom the flight
   * began at and the one it ends at (null: not known, the height stays the engine's), and the
   * lowest the engine has taken it so far (a flight out breathes out before it dives).
   */
  aStart: number;
  aEnd: number | null;
  aLow: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The zoom level a layout's backdrop for the way home is drawn from, or null when it has none (tiles.ts). */
const backdropLevel = (layout: LayoutModule): number | null => (layout.homeBackdrop === true ? 1 : typeof layout.homeBackdrop === "number" ? layout.homeBackdrop : null);

/** Safe-area insets in px (the notch, the home indicator), read from CSS. They change when a phone is turned. */
function useSafeInsets(key: string): { top: number; bottom: number } {
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const top = Math.round(parseFloat(style.paddingTop) || 0);
    const bottom = Math.round(parseFloat(style.paddingBottom) || 0);
    probe.remove();
    setInsets((was) => (was.top === top && was.bottom === bottom ? was : { top, bottom }));
  }, [key]);
  return insets;
}

export default function LandingA() {
  const { selectedIslandId, selectIsland } = useOption();
  const { layout, setLayout } = useLayout();
  const def = LAYOUTS[layout];
  const rootRef = useRef<HTMLElement>(null);
  const globe = useRef<GlobeHandle>(null);
  const searchRef = useRef<SearchHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const wide = useWide();
  const vh = useViewportHeight();
  const vw = useViewportWidth();
  const reduced = useReducedMotion();
  const { top: safeTop, bottom: safeBottom } = useSafeInsets(`${vw}x${vh}`);
  const introH = useHeight(introRef, 206, layout);

  const island = getIsland(selectedIslandId) ?? null;
  /** The card opens when the camera arrives, not when the island is chosen. */
  const [cardFor, setCardFor] = useState<string | null>(null);
  /** The camera is at rest on this island (set a moment before the card opens). */
  const [arrivedFor, setArrivedFor] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("peek");
  const [view, setView] = useState<CardView>("map");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  /** An island has been opened at least once: the landing then "returns" instead of entering. */
  const [returned, setReturned] = useState(false);
  /** The A · B · C design-option pill is on the page (?themes=1) and shares the phone's bottom-left corner. */
  const [hasSwitcher, setHasSwitcher] = useState(false);
  /** False in the server's HTML: until then CSS supplies the globe's position for the real screen. */
  const [hydrated, setHydrated] = useState(false);
  const [globeStatus, setGlobeStatus] = useState<GlobeStatus>("poster");
  /** The live map has replaced the static poster (the poster's fade-out is over). */
  const [mapSettled, setMapSettled] = useState(false);
  /** The spin is held back until the page has stopped stalling after the map's start-up (below). */
  const [spinReady, setSpinReady] = useState(false);
  /** The docked card (wide screens) pulled up to its tall size. */
  const [dockExpanded, setDockExpanded] = useState(false);
  /** An island tapped on the globe whose label is showing before the flight starts (LayoutModule.peekMs). */
  const [peekFor, setPeekFor] = useState<string | null>(null);
  /** The landing's sway (LayoutModule.drift): the spin's direction and strength, 1 to -1. */
  const [sway, setSway] = useState(1);
  /** The island whose other pictures (the Photos view, the card's body) have been let in: see below, "pictures". */
  const [picturesFor, setPicturesFor] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setHasSwitcher(params.get(THEMES_QUERY) === "1" || params.get("switcher") === "1");
    setHydrated(true);
  }, []);
  // Before the first paint after hydration: from here on the static poster is drawn for the
  // real screen, not for the phone the server assumed (the poster measures its box in the same
  // phase). A layout's stylesheet can make up the difference until then (fullbleed.css).
  useLayoutEffect(() => {
    rootRef.current?.setAttribute("data-measured", "");
  }, []);

  const landed = Boolean(island && cardFor === island.id);
  const glowing = Boolean(island && (arrivedFor === island.id || landed));
  const phase = !island ? "idle" : landed ? "landed" : "flying";
  const live = isLive(island);
  const dock = wide && def.card === "dock";

  /* -------------------------------------------------------------- sizes */

  const heights = useMemo<Record<Snap, number>>(() => {
    const photo = clamp(Math.round(vh * 0.25), 128, 224);
    const full = Math.max(320, vh - (SEARCH_TOP + SEARCH_H + 10));
    return {
      peek: HEAD_H + safeBottom,
      half: Math.min(full, live || !island ? HEAD_H + photo + TABS_H + CTA_H + safeBottom : SOON_HALF + safeBottom),
      full,
    };
  }, [vh, live, island, safeBottom]);
  const snaps = useMemo<readonly Snap[]>(() => (live ? ["peek", "half", "full"] : ["peek", "half"]), [live]);
  const shownSnap: Snap = !landed ? "peek" : snap === "full" && !live ? "half" : snap;
  /** How much of the screen the sheet covers as far as the map is concerned. */
  const sheetCover = landed && shownSnap === "peek" ? heights.peek : heights.half;
  /** Height of the docked card at rest. The map above it keeps the island in view. */
  const dockHeight = clamp(Math.round(vh * 0.46), 320, 440);

  const env = useMemo<LayoutEnv>(
    () => ({ wide, vw, vh, sheetCover, dockHeight, introHeight: introH, safeTop, safeBottom }),
    [wide, vw, vh, sheetCover, dockHeight, introH, safeTop, safeBottom],
  );
  const home = useMemo(() => def.home(env), [def, env]);
  // Where the globe faces at rest is the layout's choice, but when the window is resized or the
  // layout switched on the landing, the globe keeps the longitude its spin has reached instead of
  // whirling back: the engine re-frames toward `homeCenter`. An open island resets it, so a
  // flight home ends on the layout's own view.
  const frameKey = `${layout}:${vw}x${vh}`;
  const kept = useRef<{ key: string; lng: number | null }>({ key: frameKey, lng: null });
  if (kept.current.key !== frameKey) kept.current = { key: frameKey, lng: island ? null : (globe.current?.map()?.getCenter().lng ?? null) };
  if (island) kept.current.lng = null;
  const keptLng = kept.current.lng;
  const homeCenter = useMemo<[number, number]>(() => [keptLng ?? home.center[0], home.center[1]], [keptLng, home]);
  /**
   * A layout that looks at the open island at an angle: the islands carry that view, so the
   * engine lands on it, keeps it when it re-frames the island, and levels out on the way home.
   */
  const tilt = def.islandView;
  const globeIslands = useMemo(() => (tilt ? ISLANDS.map((item) => ({ ...item, view: { ...item.view, pitch: tilt.pitch, bearing: tilt.bearing } })) : undefined), [tilt]);
  /**
   * The globe is framed for the island as soon as one is chosen. A layout that starts its own
   * flights waits for the live map first, so a deep link sets off from the landing view; and it
   * waits until the static poster has faded out, because the poster is drawn from the same frame
   * and would show the change.
   */
  const framed = Boolean(island) && (!def.ownsFlight || mapSettled);
  const padding = useMemo(() => (framed ? def.islandPadding(env) : home.padding), [framed, def, env, home]);
  /** The landing's size is kept until the camera arrives: the engine measures its climb against it. */
  const globeSize = island && glowing ? def.islandSize(env) : home.globeSize;

  /* ------------------------------------------------------ open and close */

  const selectedRef = useRef(selectedIslandId);
  selectedRef.current = selectedIslandId;
  const cardRef = useRef(cardFor);
  cardRef.current = cardFor;
  const arrivedRef = useRef(arrivedFor);
  arrivedRef.current = arrivedFor;
  const defRef = useRef(def);
  defRef.current = def;
  const envRef = useRef(env);
  envRef.current = env;
  const paddingRef = useRef(padding);
  paddingRef.current = padding;
  /** Element to give focus back to when the card closes. */
  const opener = useRef<HTMLElement | null>(null);
  /** True while a history entry of ours sits under the open card, so Back closes it. */
  const pushed = useRef(false);
  /** Delays the card a beat behind the island's glow. */
  const arriveTimer = useRef(0);
  /** Cancels the wait for the last tiles on arrival. */
  const cancelSharp = useRef<() => void>(() => {});
  /** Cancels the wait for the map to be sharp again after a flight home (the backdrop goes then). */
  const cancelBackdrop = useRef<() => void>(() => {});
  /** Island a flight has been started for, whoever started it. */
  const flown = useRef<string | null>(null);
  /** The exact zoom the last flight to an island was given, when the layout gives one. */
  const aimed = useRef<{ id: string; zoom: number; duration: number | null } | null>(null);
  /** Shows a tapped island's label for a moment before its flight (LayoutModule.peekMs). */
  const peekTimer = useRef(0);
  /** Times a cut-short flight to this island has been started again (a layout that owns its flights). */
  const resumed = useRef<{ id: string | null; count: number }>({ id: null, count: 0 });
  useEffect(
    () => () => {
      window.clearTimeout(arriveTimer.current);
      window.clearTimeout(peekTimer.current);
      cancelSharp.current();
      cancelBackdrop.current();
    },
    [],
  );

  const setVeil = useCallback((on: boolean) => {
    rootRef.current?.toggleAttribute("data-veil", on);
  }, []);

  /**
   * Intent (a chip under the pointer or the finger, a search result highlighted): fetch the
   * island's lead photo and its map tiles ahead of the flight. The photo first: it is what the
   * card lands with.
   */
  const warm = useCallback((target: GlobeIsland, depth: "lead" | "all" = "lead") => {
    const tiles = () => warmTiles(globe.current?.map() ?? null, target, Boolean(defRef.current.islandView));
    // The tiles wait for the photo's narrow rendition, though never long: the dive does not
    // reach the levels they are for until a couple of seconds into the flight.
    void Promise.race([warmPhotos(target, depth), new Promise<void>((resolve) => window.setTimeout(resolve, PHOTO_HEAD_START_MS))]).then(tiles);
  }, []);

  /** Start the flight to an island, the way the current layout wants it flown. */
  const launch = useCallback((id: string, extra?: FlyOptions) => {
    const target = getIsland(id);
    const handle = globe.current;
    if (!target || !handle) return;
    const layoutDef = defRef.current;
    const map = handle.map();
    const options: FlyOptions = { ...(layoutDef.flyOptions && map ? layoutDef.flyOptions(target, map, envRef.current) : { speed: layoutDef.flightSpeed }), ...extra };
    flown.current = id;
    aimed.current = typeof options.zoom === "number" ? { id, zoom: options.zoom, duration: typeof options.duration === "number" && options.animate !== false ? options.duration : null } : null;
    void handle.flyToIsland(id, options);
  }, []);

  const open = useCallback(
    (id: string) => {
      const target = getIsland(id);
      if (!target) return;
      window.clearTimeout(peekTimer.current);
      setPeekFor(null);
      const wasSelected = selectedRef.current === id;
      const again = wasSelected && cardRef.current === id;
      if (!again) {
        const active = document.activeElement;
        if (!selectedRef.current) opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
        window.clearTimeout(arriveTimer.current);
        cancelSharp.current();
        setCardFor(null);
        setArrivedFor(null);
        setView("map");
        setPhotoIndex(0);
        setDockExpanded(false);
        resumed.current = { id: null, count: 0 };
        // Back should return to the globe rather than leave the page: give the globe its own
        // history entry the first time an island is opened. (The provider then rewrites the
        // current entry's URL to carry ?island=.)
        if (!selectedRef.current && !pushed.current) {
          try {
            window.history.pushState(window.history.state, "", window.location.href);
            pushed.current = true;
          } catch {
            /* A sandboxed frame can refuse history writes. Close still works. */
          }
        }
      }
      // A phone's keyboard should not stay up over the flight.
      if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
      setReturned(true);
      // The card's photos, then the dive's tiles: both are asked for as the flight starts.
      warm(target, "all");
      selectIsland(id);
      // Ask for the flight directly as well: only this re-centres an island that is already
      // selected. A layout that owns its flights starts a new one from the effect below instead,
      // once the globe has been framed for the island.
      if (!defRef.current.ownsFlight || wasSelected) launch(id);
    },
    [selectIsland, launch, warm],
  );

  // A layout that owns its flights: set off once the globe is framed for the island, however the
  // island came to be selected (a tap, the search, Back and Forward, a shared link).
  useEffect(() => {
    if (!selectedIslandId) {
      flown.current = null;
      return;
    }
    if (!def.ownsFlight || !framed || flown.current === selectedIslandId) return;
    launch(selectedIslandId);
  }, [def, selectedIslandId, framed, launch]);

  const close = useCallback(() => {
    if (!selectedRef.current) return;
    if (pushed.current) {
      // Our entry is on top: going back hands the selection (now none) to the provider.
      pushed.current = false;
      window.history.back();
    } else selectIsland(null);
  }, [selectIsland]);

  /**
   * An island tapped on the globe. In a layout with `peekMs` its label shows first, for that
   * long, and then the flight starts; with an island already open, or reduced motion, at once.
   */
  const pick = useCallback(
    (id: string) => {
      const ms = defRef.current.peekMs ?? 0;
      const target = getIsland(id);
      if (!ms || !target || selectedRef.current || reduced) {
        open(id);
        return;
      }
      window.clearTimeout(peekTimer.current);
      setPeekFor(id);
      // The wait is not idle: the card's photo and the dive's tiles are on their way.
      warm(target, "all");
      peekTimer.current = window.setTimeout(() => open(id), ms);
    },
    [open, reduced, warm],
  );

  // The selection can also change without us: Back and Forward, a shared link, an option switch.
  const previous = useRef(selectedIslandId);
  const cuts = useRef(0);
  useEffect(() => {
    const before = previous.current;
    previous.current = selectedIslandId;
    if (before === selectedIslandId) return;
    // Reduced motion: each change of island restarts the globe's cross-fade (atlas.css).
    rootRef.current?.setAttribute("data-cut", String(++cuts.current % 2));
    if (!selectedIslandId) {
      pushed.current = false;
      window.clearTimeout(arriveTimer.current);
      cancelSharp.current();
      setVeil(false);
      setCardFor(null);
      setArrivedFor(null);
      setView("map");
      setDockExpanded(false);
      goingHome.current = true;
      void globe.current?.resetView({ speed: defRef.current.homeSpeed });
      const back = opener.current;
      opener.current = null;
      // Give focus back to what opened the card (not to a text field on a phone: that would
      // bring the keyboard up).
      if (!back?.isConnected) return;
      if (searchRef.current?.owns(back)) {
        if (window.matchMedia?.("(hover: hover)").matches) searchRef.current.focusQuietly();
      } else back.focus({ preventScroll: true });
    } else {
      setView("map");
      setPhotoIndex(0);
    }
  }, [selectedIslandId, setVeil]);

  // However the island came to be chosen (a shared link and Back or Forward do not pass through
  // `open`), its card's photos are asked for at once.
  useEffect(() => {
    void warmPhotos(getIsland(selectedIslandId), "all");
  }, [selectedIslandId]);

  // Landing, in two beats: the island's glow blooms once the camera is at rest and the last map
  // tiles are in (a short wait at most), and the card rises a breath later.
  const onArrive = useCallback(
    (id: string) => {
      if (cardRef.current === id) return;
      window.clearTimeout(arriveTimer.current);
      cancelSharp.current();
      const reveal = () => {
        if (selectedRef.current !== id) return;
        setVeil(false);
        setArrivedFor(id);
        const show = () => {
          if (selectedRef.current !== id) return;
          setCardFor(id);
          setSnap("half");
        };
        if (reduced) show();
        else arriveTimer.current = window.setTimeout(show, CARD_AFTER_GLOW_MS);
      };
      const map = globe.current?.map();
      if (!map || reduced || arrivedRef.current === id || map.areTilesLoaded()) reveal();
      else {
        // The camera beat the last tiles: a veil of haze holds the island until they are in.
        setVeil(true);
        cancelSharp.current = whenSharp(map, SHARP_WAIT_MS, reveal);
      }
    },
    [reduced, setVeil],
  );

  // A flight the visitor interrupted never "arrives". Open the card anyway (small, on a phone),
  // so an island is never left selected with nothing to show for it.
  const inFlight = useRef(false);
  /** The flight in the air, when the layout shapes it. */
  const journey = useRef<Journey | null>(null);
  /** The next flight home is ours (a card was closed), not one of the engine's re-framing moves. */
  const goingHome = useRef(false);
  /**
   * The window changed size while the camera was flying home. The engine keeps a flight's target
   * as it was when it set off, so a landing with a fixed composition is put right as it lands.
   */
  const reframeHome = useRef(false);
  /** The same, with an island open: the window changed size while one of the engine's moves was in the air. */
  const reframeIsland = useRef(false);
  const onFlightStart = useCallback(
    (id: string | null) => {
      inFlight.current = true;
      journey.current = null;
      const home = id === null && goingHome.current;
      goingHome.current = false;
      if (id) flown.current = id;
      // A journey, not the small re-framing moves the engine makes once the camera is there.
      const out = id !== null && id === selectedRef.current && arrivedRef.current !== id && cardRef.current !== id;
      const map = globe.current?.map();
      const shape = defRef.current.shape;
      if (!map || reduced || (!out && !home)) return;
      // A coarse sea under the map while the camera pulls out over tiles that are not in yet.
      cancelBackdrop.current();
      const backdrop = backdropLevel(defRef.current);
      setBackdrop(map, home && backdrop !== null, backdrop ?? 1);
      if (!shape) return;
      const mapPadding = map.getPadding();
      const from: Padding = { top: mapPadding.top ?? 0, right: mapPadding.right ?? 0, bottom: mapPadding.bottom ?? 0, left: mapPadding.left ?? 0 };
      const to = paddingRef.current;
      const homeFrame = defRef.current.home(envRef.current);
      // Where the camera's height starts and ends, for a layout that re-times it.
      const aStart = apparentZoom(map.getZoom(), map.getCenter().lat);
      let aEnd: number | null = null;
      if (shape.height) {
        const target = out ? getIsland(id) : null;
        if (target && aimed.current?.id === id) aEnd = apparentZoom(aimed.current.zoom, (target.bbox[1] + target.bbox[3]) / 2);
        else if (!out) aEnd = apparentZoom(homeZoom(map, homeFrame.padding, homeFrame.globeSize, homeFrame.center[1]), homeFrame.center[1]);
      }
      // An anchored shape runs between the landing's frame and the island's, whichever way the
      // camera is going and wherever it set off from.
      journey.current = {
        ...(shape.anchored ? { from: homeFrame.padding, to: defRef.current.islandPadding(envRef.current) } : { from, to }),
        clockFrom: from,
        clockTo: to,
        out,
        start: { pitch: map.getPitch(), bearing: map.getBearing() },
        began: performance.now(),
        duration: out && aimed.current?.id === id ? aimed.current.duration : null,
        aStart,
        aEnd,
        aLow: aStart,
      };
    },
    [reduced],
  );
  const onFlightEnd = useCallback(
    (id: string | null, completed: boolean) => {
      inFlight.current = false;
      journey.current = null;
      if (!id) {
        // Home (or re-framed): the backdrop goes once the map's own tiles are in.
        const map = globe.current?.map();
        cancelBackdrop.current();
        if (map) cancelBackdrop.current = whenSharp(map, BACKDROP_WAIT_MS, () => setBackdrop(map, false));
        if (reframeHome.current) {
          reframeHome.current = false;
          // Not from inside the engine's own callback.
          window.setTimeout(() => {
            if (!selectedRef.current && !inFlight.current) void globe.current?.resetView({ animate: false });
          }, 0);
        }
      }
      if (id && reframeIsland.current) {
        reframeIsland.current = false;
        // The engine re-frames an open island for a new size by itself, except when the size
        // changed during one of its own moves. A moment later, if the map is still framed for
        // the old size, it is put right.
        window.setTimeout(() => {
          const live = globe.current?.map();
          if (!live || inFlight.current || selectedRef.current !== id || (arrivedRef.current !== id && cardRef.current !== id)) return;
          const now = live.getPadding();
          const want = paddingRef.current;
          const off = Math.abs((now.top ?? 0) - want.top) + Math.abs((now.right ?? 0) - want.right) + Math.abs((now.bottom ?? 0) - want.bottom) + Math.abs((now.left ?? 0) - want.left);
          if (off > 2) launch(id, { animate: false });
        }, 700);
      }
      if (completed || !id) return;
      setVeil(false);
      window.setTimeout(() => {
        if (inFlight.current || selectedRef.current !== id || cardRef.current === id) return;
        // A layout that flies the whole journey as one shaped move has no half-way state to rest
        // in (its globe is still framed for the landing): carry on to the island. Bounded, so a
        // flight that cannot start never loops.
        if (defRef.current.ownsFlight && arrivedRef.current !== id) {
          if (resumed.current.id !== id) resumed.current = { id, count: 0 };
          if (resumed.current.count++ < 12) {
            launch(id);
            return;
          }
        }
        setCardFor(id);
        setSnap("peek");
      }, 120);
    },
    [setVeil, launch],
  );

  /* --------------------------------------------------- the island's bloom */

  const bloomTimer = useRef(0);
  const syncBloom = useCallback((landedNow: boolean) => {
    const map = globe.current?.map();
    if (!map) return;
    window.clearTimeout(bloomTimer.current);
    const id = selectedRef.current ?? "";
    const set = (layer: string, opacity: number, filter: boolean) => {
      try {
        if (!map.getLayer(layer)) return;
        if (filter) map.setFilter(layer, ["==", ["get", "id"], id]);
        map.setPaintProperty(layer, "line-opacity", opacity);
      } catch {
        /* The style is not ready or was replaced; the next sync catches up. */
      }
    };
    // Swell as the camera lands, then settle to a steady glow.
    set(BLOOM_LAYER, landedNow ? 1 : 0, true);
    set(BLOOM_CORE_LAYER, landedNow ? 0.95 : 0, true);
    if (landedNow) {
      bloomTimer.current = window.setTimeout(() => {
        set(BLOOM_LAYER, 0.46, false);
        set(BLOOM_CORE_LAYER, 0.6, false);
      }, 1300);
    }
  }, []);
  const landedRef = useRef(glowing);
  landedRef.current = glowing;
  useEffect(() => {
    syncBloom(glowing);
    return () => window.clearTimeout(bloomTimer.current);
  }, [selectedIslandId, glowing, syncBloom]);
  const onReady = useCallback(
    (map: MapLibreMap) => {
      keepTilesWhileZooming(map);
      let shaping = false;
      map.on("move", () => {
        // A layout's shaping of the journey. The engine has just set its own camera for this
        // frame (this event comes from inside its jumpTo); the frame and the pitch are restated
        // on top of it before the map draws. Where the camera looks and how high it is stay the
        // engine's. The flight's progress is read back from the padding the engine applied.
        const flight = journey.current;
        const shape = defRef.current.shape;
        if (!flight || !shape || shaping) return;
        const applied = map.getPadding();
        const progress =
          flightProgress({ top: applied.top ?? 0, right: applied.right ?? 0, bottom: applied.bottom ?? 0, left: applied.left ?? 0 }, flight.clockFrom, flight.clockTo) ??
          // The frame does not change (a second island with one open): the flight's own clock,
          // when the layout gave the flight an exact length.
          (flight.duration ? clamp((performance.now() - flight.began) / flight.duration, 0, 1) : null);
        if (progress === null) return;
        const env = envRef.current;
        // The camera's height, re-timed: the same climb or dive, on the layout's own curve.
        const latitude = map.getCenter().lat;
        let zoom: number | undefined;
        if (shape.height && flight.aEnd !== null) {
          const engine = apparentZoom(map.getZoom(), latitude);
          if (flight.out) {
            flight.aLow = Math.min(flight.aLow, engine);
            const levels = flight.aEnd - flight.aLow;
            if (levels > 0.5) zoom = rawZoom(flight.aLow + levels * clamp(shape.height(diveTime((engine - flight.aLow) / levels), true, levels, env), 0, 1), latitude);
          } else {
            // A flight home from an island is one climb: its progress is the flight's own.
            const levels = flight.aStart - flight.aEnd;
            if (levels > 0.5) zoom = rawZoom(flight.aStart - levels * clamp(shape.height(progress, false, levels, env), 0, 1), latitude);
          }
        }
        // A breath back before a dive, a little past the landing on the way home: added to
        // whatever height the camera has at this instant.
        if (shape.lift) zoom = (zoom ?? map.getZoom()) + shape.lift(progress, flight.out, env);
        const view = { radius: silhouetteRadius(map, zoom, latitude), env, start: flight.start };
        shaping = true;
        try {
          map.jumpTo({
            ...(zoom === undefined ? null : { zoom }),
            ...(shape.bearing ? { bearing: shape.bearing(progress, flight.out, view) } : null),
            padding: lerpPadding(flight.from, flight.to, clamp(shape.frame(progress, flight.out, view), 0, 1)),
            pitch: Math.max(0, shape.pitch(progress, flight.out, view)),
          });
        } finally {
          shaping = false;
        }
      });
      syncBloom(landedRef.current);
      void installAura(map, outlineSourceId()).then((added) => {
        if (added) syncBloom(landedRef.current);
      });
      if (process.env.NODE_ENV !== "production") (window as unknown as { __daMap?: MapLibreMap }).__daMap = map;
    },
    [syncBloom],
  );

  // A layout that draws a backdrop on the way home: add it once the map has its own tiles (the
  // backdrop uses whole-world tiles the landing has fetched by then, so nothing is fetched twice).
  useEffect(() => {
    const map = globe.current?.map();
    const level = backdropLevel(def);
    if (!map || globeStatus !== "ready" || level === null) return;
    const install = () => {
      installBackdrop(map, BASE_SOURCE, WATER_LAYER, level);
    };
    if (map.areTilesLoaded()) install();
    else map.once("idle", install);
    return () => {
      map.off("idle", install);
    };
  }, [def, globeStatus]);

  // A layout can keep the landing's globe from being zoomed (the horizon's arc is a fixed
  // composition); dragging to spin always works. With an island open the map is free again.
  useEffect(() => {
    const map = globe.current?.map();
    if (!map || globeStatus !== "ready") return;
    const locked = def.zoomAtHome === false && !selectedIslandId;
    for (const handler of [map.scrollZoom, map.doubleClickZoom, map.touchZoomRotate, map.boxZoom]) {
      if (locked) handler.disable();
      else handler.enable();
    }
    if (!locked) map.touchZoomRotate.disableRotation();
  }, [def, selectedIslandId, globeStatus]);

  // A layout that flies the whole journey itself (one shaped move): while the camera is in the
  // air, keys pressed with the map in focus (it takes focus when an island is tapped on it) stay
  // away from the map and from the engine, which would take any key as the visitor grabbing the
  // camera and cut the flight short mid-tilt. Escape still closes, Tab still moves on. Pointer
  // input is already held off in the layout's stylesheet.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !def.ownsFlight || phase !== "flying") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") return;
      if (e.target instanceof Element && e.target.closest(".da-globe")) e.stopPropagation();
    };
    root.addEventListener("keydown", onKey, true);
    return () => root.removeEventListener("keydown", onKey, true);
  }, [def, phase]);

  // The poster fades out over 0.7s once the map is live (globe.css). Without WebGL there is no
  // live map and nothing to wait for.
  useEffect(() => {
    if (mapSettled) return;
    if (globeStatus === "fallback") setMapSettled(true);
    if (globeStatus !== "ready") return;
    const timer = window.setTimeout(() => setMapSettled(true), 750);
    return () => window.clearTimeout(timer);
  }, [mapSettled, globeStatus]);

  // The engine eases its spin in from the time since its previous frame. If the spin is switched
  // on while the page is stalled (the map has just started, tiles are being parsed), that time
  // comes out wrong and the globe whirls for a moment. So the spin starts only once the map is
  // live and a few frames in a row have arrived on time (or after four seconds, whatever happens).
  useEffect(() => {
    if (spinReady || globeStatus !== "ready") return;
    const started = performance.now();
    let frame = 0;
    let last = 0;
    let calm = 0;
    const step = (now: number) => {
      calm = last && now - last < 90 ? calm + 1 : 0;
      last = now;
      if (calm >= 3 || performance.now() - started > 4000) setSpinReady(true);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [spinReady, globeStatus]);

  // A landing that sways instead of turning all the way round (LayoutModule.drift): the spin is
  // the engine's, and what changes here is its direction. When the globe has turned `drift`
  // degrees from where the layout faces it, the spin eases down, through nothing, and up again
  // the other way (the engine eases a spin in from rest by itself). A globe the visitor dragged
  // far away comes back the same way, slowly.
  const swayRange = def.drift ?? 0;
  const homeLng = home.center[0];
  useEffect(() => {
    if (!swayRange) return;
    let target = 1;
    const timer = window.setInterval(() => {
      const map = globe.current?.map();
      if (!map || selectedRef.current || inFlight.current || document.visibilityState !== "visible") return;
      // Degrees east of where the layout faces the globe. A positive spin carries it west.
      const east = ((((map.getCenter().lng - homeLng) % 360) + 540) % 360) - 180;
      if (east < -swayRange) target = -1;
      else if (east > swayRange) target = 1;
      setSway((value) => value + clamp(target - value, -SWAY_STEP, SWAY_STEP));
    }, SWAY_TICK_MS);
    return () => window.clearInterval(timer);
  }, [swayRange, homeLng]);

  /* ------------------------------------------------------ layout switch */

  // The globe stays mounted across a switch. Its box can change size, so the canvas takes the
  // new size first; then the camera cuts to the new layout's frame behind a short cross-fade.
  const shownLayout = useRef(layout);
  useLayoutEffect(() => {
    if (shownLayout.current !== layout) rootRef.current?.setAttribute("data-switching", "");
    // Also on every resize of the window. The engine re-frames when its padding changes, and it
    // measures the canvas to do so; the canvas must already have its new size by then (MapLibre
    // would only resize it a moment later, from its own observer).
    globe.current?.map()?.resize();
  }, [layout, vw, vh]);
  // A landing whose composition is fixed (no zooming) is put back exactly after a resize, even
  // if the globe had been dragged: the engine alone only re-frames a globe it still counts as home.
  const shownSize = useRef(frameKey);
  useEffect(() => {
    if (shownSize.current === frameKey) return;
    const layoutChanged = shownLayout.current !== layout;
    shownSize.current = frameKey;
    if (layoutChanged) return;
    if (selectedRef.current) {
      if (inFlight.current) reframeIsland.current = true;
      return;
    }
    if (defRef.current.zoomAtHome !== false) return;
    if (inFlight.current) {
      // On its way home: the engine ignores the new size until it lands (see onFlightEnd).
      reframeHome.current = true;
      return;
    }
    void globe.current?.resetView({ animate: false });
  }, [frameKey, layout]);
  useEffect(() => {
    if (shownLayout.current === layout) return;
    shownLayout.current = layout;
    setDockExpanded(false);
    const id = selectedRef.current;
    if (id) launch(id, { animate: false });
    else {
      // The new layout's landing enters afresh; it is not "coming back" from an island (the
      // return animations wait for a camera that is not flying).
      setReturned(false);
      void globe.current?.resetView({ animate: false });
    }
    const root = rootRef.current;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => root?.removeAttribute("data-switching"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      root?.removeAttribute("data-switching");
    };
  }, [layout, launch]);

  // Pictures. The card and its Photos view are mounted during the flight, out of sight, and all
  // their pictures would download then, racing the card's lead photo and the map's tiles on a
  // phone connection. So everything but the lead photo waits: for the camera to land, and then
  // for the lead photo to be in (never long). None of it can be seen before the landing anyway.
  const landedId = landed ? (island?.id ?? null) : null;
  useEffect(() => {
    if (!landedId) return;
    let current = true;
    void Promise.race([leadReady(getIsland(landedId)), new Promise<void>((resolve) => window.setTimeout(resolve, PICTURES_WAIT_MS))]).then(() => {
      if (current) setPicturesFor(landedId);
    });
    return () => {
      current = false;
    };
  }, [landedId]);

  /* ------------------------------------------------------ focus and keys */

  // When the card opens, move focus to the dialog itself. It is labelled by the island's name, so
  // a screen reader starts there, and the next Tab goes to the card's first control.
  useEffect(() => {
    if (!landed) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    headingRef.current?.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true });
  }, [landed, island?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !selectedRef.current) return;
      if (view === "photos") setView("map");
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, view]);

  /* ------------------------------------------------------------ actions */

  const copiedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  const share = useCallback(async () => {
    const target = getIsland(selectedRef.current);
    if (!target) return;
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function" && window.matchMedia?.("(hover: none)").matches) {
        await navigator.share({ title: t(aStrings.share.title, { name: target.name }), url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* The visitor closed the share sheet, or the clipboard is blocked. Nothing to do. */
    }
  }, []);

  const changeView = useCallback((next: CardView) => {
    setView(next);
    // The photos show over the map: make room if the card is fully open.
    if (next === "photos") {
      setSnap((s) => (s === "full" ? "half" : s));
      setDockExpanded(false);
    }
  }, []);

  const openPhoto = useCallback(
    (index: number) => {
      setPhotoIndex(index);
      changeView("photos");
    },
    [changeView],
  );

  // With ?themes=1 the A · B · C pill sits bottom-left on a phone: keep it clear of the sheet
  // (with the action bar showing it tucks into the bar's left end). On a wide screen it drops
  // below the layout switcher, which has the top right corner.
  const ctaShown = !wide && landed && live && shownSnap !== "peek";
  useEffect(() => {
    const el = document.documentElement;
    if (hasSwitcher) el.style.setProperty("--opt-switch-top", "60px");
    if (wide || !island) el.style.removeProperty("--opt-switch-lift");
    else if (ctaShown) el.style.setProperty("--opt-switch-lift", "8px");
    else el.style.setProperty("--opt-switch-lift", `${(shownSnap === "peek" ? heights.peek : heights.half) - safeBottom + 8}px`);
    return () => {
      el.style.removeProperty("--opt-switch-lift");
      el.style.removeProperty("--opt-switch-top");
    };
  }, [hasSwitcher, wide, island, ctaShown, shownSnap, heights, safeBottom]);

  /* -------------------------------------------------------------- render */

  // The card lingers for its exit animation after the selection is cleared.
  const { shown: cardIsland, leaving } = useLinger<GlobeIsland>(island, 520);
  const cardLive = isLive(cardIsland) ? cardIsland : null;
  const photosOn = view === "photos" && landed && Boolean(cardLive);
  // The card's long body is rendered at low priority, a moment after the island is chosen:
  // mounting it in the same frame as the tap would stall the first frames of the flight.
  const bodyFor = useDeferredValue(cardLive?.id ?? null);
  const bodyReady = Boolean(cardLive) && bodyFor === cardLive?.id;
  const expand = useCallback(() => setSnap("full"), []);
  const toggleDock = useCallback(() => setDockExpanded((value) => !value), []);
  /** Without a name plate in flight, the card stays below the screen until the camera lands. */
  const cardHeld = !def.plateInFlight && !landed;

  const rootStyle = {
    "--da-sheet-cover": `${sheetCover}px`,
    "--da-photo-h": `${clamp(Math.round(vh * 0.25), 128, 224)}px`,
    "--da-intro-h": `${introH}px`,
    "--da-dock-h": `${dockHeight}px`,
    // Only once the real screen is known: the server would publish a phone's numbers.
    ...(hydrated ? def.vars?.(env) : null),
  } as CSSProperties;

  const cardHead = cardIsland ? (
    <CardHead
      island={cardIsland}
      headingId={headingId}
      headingRef={headingRef}
      view={view}
      onView={changeView}
      onClose={close}
      flying={!landed && !leaving}
      expanded={dock && cardLive ? dockExpanded : undefined}
      onToggleExpanded={dock && cardLive ? toggleDock : undefined}
    />
  ) : null;

  const cardHero = cardLive ? <CardHero island={cardLive} /> : null;
  const cardBody = cardLive ? (
    bodyReady ? (
      <CardBody island={cardLive} scrollerRef={scrollerRef} onOpenPhoto={openPhoto} expanded={wide || shownSnap === "full"} onExpand={expand} pictures={picturesFor === cardLive.id} />
    ) : null
  ) : cardIsland?.status === "coming-soon" ? (
    <SoonBody island={cardIsland} onOpenIsland={open} />
  ) : null;

  const cardScroll = cardIsland ? (
    <div className="da-scroll" data-scroller="" ref={scrollerRef} tabIndex={-1}>
      {cardHero}
      {cardBody}
    </div>
  ) : null;

  const Top = def.Top;
  const GlobeExtras = def.GlobeExtras;

  return (
    <main
      ref={rootRef}
      className={`da ${fontClass}`}
      data-layout={layout}
      data-card={def.card}
      data-dock={dock && dockExpanded && landed && live ? "tall" : undefined}
      data-phase={phase}
      data-wide={wide ? "" : undefined}
      data-view={photosOn ? "photos" : "map"}
      data-live={live ? "" : undefined}
      data-switcher={hasSwitcher ? "" : undefined}
      data-returned={returned ? "" : undefined}
      data-hydrated={hydrated ? "" : undefined}
      style={rootStyle}
    >
      <div className="da-sky" aria-hidden="true" />

      {/* Words and search come first in the document, so they come first for a keyboard. */}
      <Brand className="da-brand da-brand-bar" />

      <Top key={layout} island={island} flying={phase === "flying"} onOpen={open} onIntent={warm} searchRef={searchRef} introRef={introRef} />

      <LayoutSwitcher layout={layout} onChange={setLayout} hidden={!wide && Boolean(island)} />

      <Globe
        ref={globe}
        className="da-globe"
        style={atlasStyle}
        islands={globeIslands}
        selectedId={selectedIslandId}
        onSelect={pick}
        onArrive={onArrive}
        onFlightStart={onFlightStart}
        onFlightEnd={onFlightEnd}
        onReady={onReady}
        onStatusChange={setGlobeStatus}
        autoRotate={spinReady ? def.spin * (def.drift ? sway : 1) : 0}
        rotateResumeMs={4200}
        padding={padding}
        globeSize={globeSize}
        homeCenter={homeCenter}
        flyOnSelect={!def.ownsFlight}
        renderMarker={(target, state) => (
          <span className="da-beacon" data-live={state.live} data-peek={peekFor === target.id ? "" : undefined}>
            {/* A layout with `peekMs` draws its own dot over the map's, and the island's label:
                on hover, and for a moment after a tap before the flight starts. */}
            {def.peekMs ? (
              <>
                <span className="da-beacon-core" />
                <span className="da-peek" data-status={target.status}>
                  <span className="da-peek-name">{target.name}</span>
                  <span className="da-peek-meta">
                    <span className="da-status-dot" />
                    {islandStrings.status[target.status]}
                  </span>
                </span>
              </>
            ) : null}
          </span>
        )}
      >
        <div className="da-depth" aria-hidden="true" />
        <div className="da-air" aria-hidden="true" />
        {GlobeExtras ? <GlobeExtras /> : null}
        <div className="da-veil" aria-hidden="true" />
      </Globe>

      {/* Mounted once the pictures are let in (above), or at once if the visitor asks for it. */}
      {cardLive && bodyReady && (picturesFor === cardLive.id || view === "photos") ? <PhotoStage island={cardLive} active={photosOn} index={photoIndex} onIndex={setPhotoIndex} /> : null}

      {cardIsland && !wide ? (
        <>
          <Sheet
            key="sheet"
            heights={heights}
            snaps={snaps}
            snap={shownSnap}
            onSnap={(next) => {
              setSnap(next);
              // Dragging the sheet open means the visitor wants the card, wherever the camera is.
              if (!landed && next !== "peek") setCardFor(cardIsland.id);
            }}
            onDismiss={close}
            leaving={leaving || cardHeld}
            inert={cardHeld && !leaving}
            reducedMotion={reduced}
            labelledBy={headingId}
          >
            {cardHead}
            {cardScroll}
          </Sheet>
          {cardLive ? (
            <div className="da-bar" data-on={ctaShown && !leaving ? "" : undefined} inert={ctaShown && !leaving ? undefined : true}>
              <CardActions onShare={share} copied={copied} />
            </div>
          ) : null}
        </>
      ) : null}

      {cardIsland && wide && !dock ? (
        <aside
          className="da-panel"
          role="dialog"
          tabIndex={-1}
          aria-modal="false"
          aria-labelledby={headingId}
          data-leaving={leaving ? "" : undefined}
          data-open={landed ? "" : undefined}
          data-live={cardLive ? "" : undefined}
          inert={cardHeld && !leaving ? true : undefined}
        >
          <div className="da-panel-inner">
            {cardHead}
            {cardScroll}
            {cardLive ? (
              <div className="da-panel-foot">
                <CardActions onShare={share} copied={copied} />
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      {/* The docked card: identity, photo and actions on the left, the sections beside them. */}
      {cardIsland && dock ? (
        <aside
          className="da-panel da-dock"
          role="dialog"
          tabIndex={-1}
          aria-modal="false"
          aria-labelledby={headingId}
          data-leaving={leaving ? "" : undefined}
          data-open={landed ? "" : undefined}
          data-live={cardLive ? "" : undefined}
          data-expanded={dockExpanded && cardLive ? "" : undefined}
          inert={cardHeld && !leaving ? true : undefined}
        >
          <div className="da-panel-inner">
            <div className="da-dock-side">
              {cardHead}
              {cardHero}
              {cardLive ? (
                <div className="da-panel-foot">
                  <CardActions onShare={share} copied={copied} />
                </div>
              ) : null}
            </div>
            <div className="da-scroll da-dock-main" data-scroller="" ref={scrollerRef} tabIndex={-1}>
              {cardBody}
            </div>
          </div>
        </aside>
      ) : null}

      <p className="da-sr" role="status">
        {island ? t(landed ? aStrings.flight.arrived : aStrings.flight.flying, { name: island.name }) : ""}
      </p>
    </main>
  );
}
