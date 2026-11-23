/**
 * What a layout module provides. The shell (../index.tsx) owns everything that is the same in
 * every layout: the selection, the phases, the card's state, history, focus, the globe itself.
 * A layout decides where things go and how the camera travels:
 *
 *   - `Top`: the landing's words, search and island chips, arranged its own way
 *   - `home` / `islandPadding`: where the globe sits at rest, and the area an open island is framed in
 *   - `card`: where the island card lives on a wide screen
 *   - the flight: its speed, and optionally exact options per island (`flyOptions`)
 *   - `GlobeExtras`: anything it draws over the globe (an atmosphere, say)
 *   - `vars`: custom properties for its stylesheet, from the same numbers the camera uses
 *
 * Its stylesheet scopes every rule under `.da[data-layout="<id>"]`.
 * How to add one: docs/agents/v2-layouts.md
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ComponentType, RefObject } from "react";
import type { FlyOptions, Padding } from "@/components/globe";
import type { GlobeIsland, LngLat } from "@/lib/islands";
import type { LayoutId } from "@/lib/options";
import type { SearchHandle } from "../Search";

/** The screen, and how much of it the card covers. */
export interface LayoutEnv {
  /** Wide screen (900px and up): the card is a panel, not a bottom sheet. */
  wide: boolean;
  vw: number;
  vh: number;
  /** Phone: height of the sheet as far as the map is concerned (peek or half), in px. */
  sheetCover: number;
  /** Wide screens: height of the docked card, in px. */
  dockHeight: number;
  /** Measured height of the landing's intro block (layouts that stack the globe under it). */
  introHeight: number;
  /** Safe-area insets at the top and bottom of the screen (a notch, the home indicator), in px. */
  safeTop: number;
  safeBottom: number;
}

/** What a layout's `shape` is told about the flight at this instant, besides its progress. */
export interface FlightView {
  /** Radius of the planet's silhouette on screen, px. */
  radius: number;
  env: LayoutEnv;
  /**
   * How the camera was turned and tilted when this flight set off. A flight does not always start
   * level and facing north: a second island chosen with one open, or a flight cut short and
   * turned round, starts from wherever the camera was.
   */
  start: { pitch: number; bearing: number };
}

/** The globe at rest on the landing. */
export interface HomeFrame {
  padding: Padding;
  /** Diameter as a share of the free area's shorter side (the engine's `globeSize`). */
  globeSize: number;
  /** Where the globe faces. */
  center: LngLat;
}

export interface TopProps {
  /** The open island, or null on the landing. */
  island: GlobeIsland | null;
  /** The camera is still on its way to the island. */
  flying: boolean;
  onOpen(id: string): void;
  onIntent(island: GlobeIsland): void;
  searchRef: RefObject<SearchHandle | null>;
  introRef: RefObject<HTMLDivElement | null>;
}

export interface LayoutModule {
  id: LayoutId;
  /**
   * Wide screens: a panel down the left side ("side"), a wide card along the bottom ("dock"), or a
   * floating card on the right, over the map ("float": the side panel's markup, placed and held
   * back by the layout's own stylesheet).
   */
  card: "side" | "dock" | "float";
  /**
   * The card's name plate rises as soon as an island is chosen and rides along during the flight
   * (true), or nothing shows until the camera has landed and the whole card rises (false).
   */
  plateInFlight: boolean;
  /** Spin of the globe on the landing, degrees per second. */
  spin: number;
  /** Multiplier on the engine's derived flight time, out to an island and back home. */
  flightSpeed: number;
  homeSpeed: number;
  /**
   * True: the layout starts every flight to an island itself, with `flyOptions`, once the globe
   * is framed for the island. The engine's own fly-on-select is switched off, and the globe keeps
   * the landing's frame until the map is live (so a deep link starts from the landing view).
   */
  ownsFlight: boolean;
  /** Globe size while an island is open. Until the camera arrives the landing's size is kept. */
  islandSize(env: LayoutEnv): number;
  home(env: LayoutEnv): HomeFrame;
  islandPadding(env: LayoutEnv): Padding;
  /** Exact options for the flight to an island (the engine frames the island itself otherwise). */
  flyOptions?(island: GlobeIsland, map: MapLibreMap, env: LayoutEnv): FlyOptions;
  /**
   * Shapes a journey between the landing and an island, on top of the engine's flight (which
   * decides where the camera looks and how high it is). `t` is the flight's progress, 0 to 1;
   * `out` is true on the way to an island and false on the way home.
   *   frame: how far the globe's frame has moved from where the flight began to where it ends
   *          (0 to 1). The engine eases it evenly over the whole flight.
   *   pitch: camera pitch in degrees. At t = 1 it must be the pitch the flight ends on: 0, unless
   *          the layout tilts the open island (`islandView`), and 0 back on the landing.
   *   bearing: which way the camera faces, degrees clockwise from north. Optional (the engine
   *          eases it over the whole flight otherwise). The same rule at t = 1.
   *   lift: zoom levels added to the camera's height at this instant (negative pulls back).
   *          Optional. Must be 0 at t = 0 and t = 1.
   *   height: re-times how high the camera is. The engine dives to an island with an ease-in-out
   *          cubic and climbs home with an ease-in-out sine; `s` is how far through that dive
   *          (out) or climb (home) it is in time, 0 to 1, and `levels` how many doublings of the
   *          planet's size the dive or climb covers. Return the share of them done by then (0 at
   *          0, 1 at 1, never falling). The turn toward the island and the breath before the dive
   *          stay the engine's. Needs `flyOptions` to give the flight an exact zoom.
   *   anchored: the frame always runs between the landing's frame and the open island's, wherever
   *          the camera was when the flight began. `frame` is then the share of the way from the
   *          landing (0) to the island (1) in both directions, so a layout can make it a pure
   *          function of what is on screen (`view`) and a flight that is cut short and started
   *          again, or turned round half-way, carries on without a jump.
   */
  shape?: {
    frame(t: number, out: boolean, view: FlightView): number;
    pitch(t: number, out: boolean, view: FlightView): number;
    bearing?(t: number, out: boolean, view: FlightView): number;
    lift?(t: number, out: boolean, env: LayoutEnv): number;
    height?(s: number, out: boolean, levels: number, env: LayoutEnv): number;
    anchored?: boolean;
  };
  /**
   * True: on the way home, a coarse sea drawn from the whole-world tiles shows wherever the map's
   * own tiles are still loading (tiles.ts, `installBackdrop`), instead of bare land in hard-edged
   * squares. For a landing that shows the whole planet from far off (under zoom 2), which is
   * drawn from those same tiles. A landing that is closer in gives the zoom level its own view is
   * drawn from instead of `true` (see `installBackdrop`).
   */
  homeBackdrop?: boolean | number;
  /** Zoom gestures on the landing (dragging to spin always works). Default true. */
  zoomAtHome?: boolean;
  /**
   * The open island is seen at an angle: the camera's pitch and bearing once it has landed, in
   * degrees. The engine keeps them when it re-frames the island (a resize, the sheet changing
   * height), and levels out again on the way home. Default: straight down, north up.
   */
  islandView?: { pitch: number; bearing: number };
  /**
   * The landing's globe does not go round and round: it sways this many degrees either side of
   * where the layout faces it, turning back gently at each end. For a landing so close in that a
   * full turn would carry the islands out of sight for minutes.
   */
  drift?: number;
  /**
   * An island tapped on the globe shows its label for this long (ms) before the flight starts.
   * The label itself is the shell's (.da-peek); the layout's stylesheet shows it.
   */
  peekMs?: number;
  /** Custom properties for the layout's stylesheet, set on the root once the screen is known. */
  vars?(env: LayoutEnv): Record<string, string>;
  Top: ComponentType<TopProps>;
  GlobeExtras?: ComponentType;
}
