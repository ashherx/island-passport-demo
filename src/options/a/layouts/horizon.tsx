"use client";

/**
 * Layout "horizon" (Dan's sketch 1): everything centred and stacked. A three-line headline, a
 * wide search bar, a row of island chips, and under them a huge globe of which only the top arc
 * rises from the bottom of the screen, like a planet seen from orbit.
 *
 * How the arc is made. MapLibre keeps the centre of its view inside the canvas, so the canvas
 * (the globe's box) is taller than the screen: it starts at the top of the screen and runs past
 * the bottom edge, far enough for the planet's centre to sit 40px above the box's own bottom.
 * The landing frames the globe in an 80px strip at the bottom of that box (the engine never
 * frames in less) with a `globeSize` that makes its radius `r`. The part of the box below the
 * screen is never seen. With an island open the same box is simply padded at the bottom by the
 * hidden part plus the card, so the island is framed in what is visible.
 *
 * The flight is the engine's, started here with exact options (see `flyOptions`): from the
 * horizon the camera breathes out a touch while the planet rises into view and turns, then
 * dives. The landing's globe size is kept until the camera arrives, which is what stops the
 * engine pulling all the way back to a small ball first.
 *
 * The numbers below are mirrored in horizon.css for the first paint (viewport units); once the
 * screen is known the shell publishes them as --hz-* in px, so CSS and camera always agree.
 */
import type { GlobeIsland } from "@/lib/islands";
import { t } from "@/lib/strings";
import { islandZoom } from "../camera";
import { Hint, Intro, IslandChips } from "../parts";
import { Search } from "../Search";
import { aStrings } from "../strings";
import type { LayoutEnv, LayoutModule, TopProps } from "./types";

/** The docked search field and its top inset, phones (horizon.css). */
const SEARCH_TOP = 10;
const SEARCH_H = 52;
/** Wide screens: the docked search pill and the flight caption sit in this band. */
const WIDE_TOP = 84;
const DOCK_MARGIN = 20;
/** Where the globe faces on the landing: the Philippines well inside the arc, on a phone and a desktop. */
const HOME_CENTER: [number, number] = [121, -22];
const ISLAND_SIZE = 0.96;
/** The engine frames the globe in at least an 80px strip: the landing uses exactly that. */
const STRIP = 80;

/* The journey's shape (see `shape` below). Progress runs 0 to 1 over the whole flight. */
/** Out: the globe's frame has finished moving from the horizon to the island's by this point. */
const TILT_OUT_END = 0.62;
/** Home: the frame stays on the island until this point, then settles back to the horizon. */
const TILT_HOME_START = 0.14;
/** Peak camera pitch during the dive and during the climb home, degrees. */
const PITCH_OUT = 34;
const PITCH_HOME = 26;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOutSine = (v: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(v));
/** 0 until `start`, a smooth rise to 1 at `peak`, a smooth fall back to 0 at `end`. */
function bump(t: number, start: number, peak: number, end: number): number {
  if (t <= start || t >= end) return 0;
  return t < peak ? easeInOutSine((t - start) / (peak - start)) : easeInOutSine((end - t) / (end - peak));
}

export interface HorizonGeometry {
  /** Radius of the planet's silhouette on the landing, px. */
  r: number;
  /** Distance from the top of the screen to the top of the arc, px. */
  top: number;
  /** Height of the globe's box, px (at least the screen). */
  box: number;
  /** How far the box runs past the bottom of the screen, px. */
  over: number;
}

/** Mirrored in horizon.css (--hz-r, --hz-top, --hz-box). */
export function horizonGeometry(vw: number, vh: number, wide: boolean): HorizonGeometry {
  const r = wide ? Math.min(0.58 * vw, 1.45 * vh) : Math.min(0.95 * vw, 0.9 * vh);
  const top = (wide ? 0.6 : 0.55) * vh;
  const box = Math.max(vh, top + r + STRIP / 2);
  return { r, top, box, over: box - vh };
}

function HorizonTop({ island, flying, onOpen, onIntent, searchRef, introRef }: TopProps) {
  return (
    <div className="da-top">
      <Intro hidden={Boolean(island)} contentRef={introRef} />
      <Search ref={searchRef} onSelect={(target) => onOpen(target.id)} onIntent={onIntent} current={island?.name ?? null} />
      {/* In place of the card's name plate, which this layout holds back until the landing. */}
      <p className="da-flight" data-on={island && flying ? "" : undefined} aria-hidden="true">
        <span className="da-status-dot" />
        {island ? t(aStrings.flight.flying, { name: island.name }) : ""}
      </p>
      <div className="da-rail" inert={island ? true : undefined}>
        <IslandChips onOpen={onOpen} onIntent={onIntent} />
        <Hint />
      </div>
    </div>
  );
}

/** The atmosphere along the horizon: a haze inside the limb and a glow that falls away above it. */
function HorizonGlow() {
  return <div className="da-hz-glow" aria-hidden="true" />;
}

export const horizonLayout: LayoutModule = {
  id: "horizon",
  card: "dock",
  plateInFlight: false,
  spin: 4,
  flightSpeed: 1.25,
  homeSpeed: 1.05,
  ownsFlight: true,
  zoomAtHome: false,
  islandSize: () => ISLAND_SIZE,
  home({ wide, vw, vh }: LayoutEnv) {
    const { r, box } = horizonGeometry(vw, vh, wide);
    return { padding: { top: box - STRIP, right: 0, bottom: 0, left: 0 }, globeSize: (2 * r) / STRIP, center: HOME_CENTER };
  },
  islandPadding({ wide, vw, vh, sheetCover, dockHeight }: LayoutEnv) {
    const { over } = horizonGeometry(vw, vh, wide);
    if (wide) return { top: WIDE_TOP, right: 24, bottom: over + dockHeight + DOCK_MARGIN + 14, left: 24 };
    return { top: SEARCH_TOP + SEARCH_H + 12, right: 0, bottom: over + sheetCover, left: 0 };
  },
  /**
   * The engine would frame the island by itself, but it measures against a "whole globe" view
   * worked out from the globe size, and during this flight that is still the landing's (huge)
   * one. So the zoom is fitted here, with the size the globe has once an island is open.
   */
  flyOptions(island: GlobeIsland, map, env) {
    return { speed: this.flightSpeed, zoom: islandZoom(map, island, this.islandPadding(env), ISLAND_SIZE, HOME_CENTER[1]) };
  },
  shape: {
    // Out: the planet rises into view early, while it turns, so the island never drops out of
    // sight and the dive starts with the globe already centred. Home: the camera climbs first
    // and the horizon settles last.
    frame: (t, out) => (out ? easeInOutSine(t / TILT_OUT_END) : easeInOutSine((t - TILT_HOME_START) / (1 - TILT_HOME_START))),
    // A swoop: the camera leans into the dive and levels out over the island; on the way home it
    // looks up toward the horizon as it climbs.
    pitch: (t, out) => (out ? PITCH_OUT * bump(t, 0.3, 0.64, 1) : PITCH_HOME * bump(t, 0.06, 0.52, 0.96)),
  },
  vars({ wide, vw, vh }: LayoutEnv) {
    const { r, top, box, over } = horizonGeometry(vw, vh, wide);
    return { "--hz-r": `${r}px`, "--hz-top": `${top}px`, "--hz-box": `${box}px`, "--hz-over": `${over}px` };
  },
  Top: HorizonTop,
  GlobeExtras: HorizonGlow,
};
