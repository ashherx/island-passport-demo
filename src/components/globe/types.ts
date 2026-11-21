import type { Map as MapLibreMap } from "maplibre-gl";
import type { ReactNode } from "react";
import type { GlobeIsland, LngLat } from "@/lib/islands";
import type { Padding } from "./camera";
import type { StyleInput } from "./style";

/**
 * poster    static first paint; MapLibre is loading
 * ready     the live map is on screen
 * lost      the browser took the WebGL context away (memory pressure); the poster is back
 * fallback  WebGL is not available at all; the poster stays and its island dots are buttons
 */
export type GlobeStatus = "poster" | "ready" | "lost" | "fallback";

/** How high the camera is. Mirrored on the root element as data-altitude for CSS. */
export type GlobeAltitude = "globe" | "region" | "island";

export interface FlyOptions {
  /** Milliseconds. Default: derived from how far the camera turns and zooms (0.9 to 5.2 s). */
  duration?: number;
  /** Multiplier on the derived duration: 0.5 is twice as fast. */
  speed?: number;
  /** Rise to the whole-globe view first, even for a short hop. */
  viaGlobe?: boolean;
  /** Zoom to end at. Default: frames the island's outline in the free area. */
  zoom?: number;
  /** Share of the free area the island may fill. Default 0.72. */
  fill?: number;
  bearing?: number;
  pitch?: number;
  /** False: cut straight to the view. Reduced motion always cuts. */
  animate?: boolean;
}

export interface TourOptions {
  /** How long to rest on each island, in milliseconds. Default 2600. */
  dwellMs?: number;
  /** Start again after the last island until stopped. Default false. */
  loop?: boolean;
  /** Pull back to the whole globe between islands. Default false: only as far as the trip needs. */
  viaGlobe?: boolean;
  /** Called as the camera sets off for each island. */
  onStep?(id: string, index: number): void;
  /** Called when the camera has arrived and the dwell begins. */
  onArrive?(id: string, index: number): void;
}

export interface SnapshotOptions {
  /** "image/png" keeps the transparency around the globe. Default "image/jpeg". */
  type?: "image/jpeg" | "image/png" | "image/webp";
  quality?: number;
  /** Colour painted behind the globe (JPEG has no transparency). Default: the --o-bg colour. */
  background?: string;
  /** Longest side in pixels. Default: the canvas size. */
  maxSize?: number;
}

export interface GlobeHandle {
  /**
   * Fly to an island: rise if it is far, rotate toward it, dive to its outline. Resolves true on
   * arrival and false if the flight was interrupted (the visitor touched the map, or another
   * flight started). Safe to call before the map has loaded.
   */
  flyToIsland(id: string, options?: FlyOptions): Promise<boolean>;
  /** Back to the whole-globe view. */
  resetView(options?: FlyOptions): Promise<boolean>;
  /**
   * Visit islands in turn (for the passport cover). Resolves true when the tour ends, false when
   * it was interrupted. Any touch on the map stops it.
   */
  tour(ids: string[], options?: TourOptions): Promise<boolean>;
  /** Stop a flight or tour in progress. */
  stop(): void;
  /** The current frame as a data URL. */
  snapshot(options?: SnapshotOptions): Promise<string>;
  /** The MapLibre map, or null before it has loaded (and in fallback mode). */
  map(): MapLibreMap | null;
  /**
   * Resolves when the live map is on screen, or as soon as it is clear there will be none
   * (no WebGL). In that case `map()` stays null, flyToIsland and resetView resolve true at once
   * so the caller's UI carries on, tour resolves false and snapshot rejects.
   */
  whenReady(): Promise<void>;
}

/** What `renderMarker` is told about an island. */
export interface MarkerState {
  selected: boolean;
  live: boolean;
}

export interface GlobeProps {
  /**
   * The map style: a MapLibre style object, or a function that builds one from the shared base
   * (`(base) => base.build(palette, options)`). Keep the reference stable (useMemo or module
   * scope): a new reference restyles the map.
   */
  style: StyleInput;
  /** Islands to show. Default: every sample island. */
  islands?: readonly GlobeIsland[];
  /** The open island: outlined with a glow, and flown to when it changes (see `flyOnSelect`). */
  selectedId?: string | null;
  /** A tap or click on an island, its dot, its label or its marker. */
  onSelect?(id: string): void;
  /** A tap on the map that hit no island. */
  onBackgroundClick?(): void;
  /**
   * Spin, in degrees per second (6 is calm, 12 lively). Pauses on any interaction and resumes
   * after `rotateResumeMs`. Off while an island is selected, during flights and with reduced
   * motion. Default 0.
   */
  autoRotate?: number;
  /** Idle time before the spin resumes. Default 6000. */
  rotateResumeMs?: number;
  /** Screen area covered by UI (a bottom sheet, a side panel), so islands are framed clear of it. */
  padding?: Partial<Padding>;
  /** False: no dragging, zooming or tapping (a decorative globe). Default true. */
  interactive?: boolean;
  className?: string;
  /** Diameter of the globe in the home view, as a share of the free area's shorter side. Default 0.86. */
  globeSize?: number;
  /** Where the globe faces in the home view. Default: HOME_VIEW.center from the island data. */
  homeCenter?: LngLat;
  /** Fly to `selectedId` whenever it changes. Default true. */
  flyOnSelect?: boolean;
  /** Which islands respond to taps. Default "all" (a "coming soon" tap can show a teaser). */
  selectable?: "all" | "live";
  /**
   * Draw a DOM marker per island on top of the map (return null to skip one). Markers are real
   * buttons, so they can use web fonts and CSS animation and are reachable by keyboard. The
   * element gets data-live, data-selected, data-near (the outline is large enough to see) and is
   * hidden below the island's minimum zoom and on the far side of the globe.
   */
  renderMarker?(island: GlobeIsland, state: MarkerState): ReactNode;
  /**
   * Image shown instead of the built-in poster before the map loads and when WebGL is missing.
   * Default: the built-in SVG globe, drawn in the option's colours.
   */
  staticImage?: string;
  /** Pick up the camera where the last globe left it (so switching option keeps the view). Default true. */
  restoreView?: boolean;
  /** Cap on the canvas pixel ratio. Default 2. */
  maxPixelRatio?: number;
  /** Corner for the map credits. Default "bottom-right". */
  attribution?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Accessible name of the map. */
  label?: string;
  /** Rendered inside the globe's box, above the map (the --globe-* variables are in scope). */
  children?: ReactNode;
  onReady?(map: MapLibreMap): void;
  onStatusChange?(status: GlobeStatus): void;
  /**
   * The camera has come to rest on the selected island: open the card here. Fires after a
   * completed flight to it, and at once when no flight was needed (the globe mounted already
   * there after an option switch, the island was re-selected in place, reduced motion, or there
   * is no map at all). Not fired for an interrupted flight.
   */
  onArrive?(id: string): void;
  onFlightStart?(id: string | null): void;
  /** `completed` is false when the flight was interrupted. `id` is null for resetView. */
  onFlightEnd?(id: string | null, completed: boolean): void;
  /** The visitor touched, dragged, scrolled or used the keyboard on the map. */
  onUserInteraction?(): void;
}
