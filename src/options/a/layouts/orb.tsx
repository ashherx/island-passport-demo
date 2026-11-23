"use client";

/**
 * Layout "orb" (Dan's sketch 2): everything centred and stacked, like the horizon, but the globe
 * is a small, complete planet floating under the words: a three-line headline, a wide search bar,
 * a row of island chips, and below them the whole sphere with an atmosphere around it and a faint
 * shadow beneath. On a phone it is about three quarters of the screen's width; on a desktop it
 * takes what height is left under the words (about 420 to 520px).
 *
 * The journey is the planet itself: it turns in place until the island faces the visitor, then
 * swells outward from its centre until it is the world, its halo dissolving, and the camera
 * lands on the island. Straight on, no tilt. Closing plays it backwards: the world shrinks back
 * into the small orb. The flight is the engine's, one move; what this layout adds is where the
 * globe's frame is at each instant (see `shape`): a function of how big the planet is on screen,
 * so the orb stays where it floats while it turns and only glides up to the island's place above
 * the card as it outgrows the screen.
 *
 * The numbers in `orbGeometry` are mirrored in orb.css in viewport units for the first paint;
 * once the screen is known the shell publishes them as --orb-* in px.
 */
import type { GlobeIsland } from "@/lib/islands";
import { t } from "@/lib/strings";
import { islandZoom } from "../camera";
import { Hint, Intro, IslandChips } from "../parts";
import { Search } from "../Search";
import { aStrings } from "../strings";
import type { FlightView, LayoutEnv, LayoutModule, TopProps } from "./types";

/** The docked search field and its top inset, phones (orb.css). */
const SEARCH_TOP = 10;
const SEARCH_H = 52;
/** Wide screens: the docked search pill and the flight caption sit in this band. */
const WIDE_TOP = 84;
const DOCK_MARGIN = 20;
/** Where the planet faces on the landing: the Philippines a little right of centre, the equator just below the middle. */
const HOME_CENTER: [number, number] = [116, 10];
const ISLAND_SIZE = 0.96;

/* The journey's shape (see `shape` below). */
/** The planet grows this many doublings, purely from its centre, before its frame starts to move. */
const SWELL_HOLD = 0.2;
/** By this many doublings the frame has finished moving from the orb's place to the island's. */
const SWELL_SPAN = 3.4;
/** Out: whatever the size, the frame is the island's by the end of the flight (it eases there from here). */
const FRAME_BY = 0.86;
/** Share of the dive's time (and, mirrored, of the climb home) in which the planet grows from the orb to filling the screen. */
const SWELL_TIME = 0.42;

/** Under this height the headline is dropped so that the planet still fits whole (orb.css: the same number). */
const FLAT_BELOW = 520;
/**
 * The smallest planet the map draws (the engine's lowest zoom): about 181px across on a screen
 * 320px tall, 200px at 800. Asking for less would only put the poster and the map out of step.
 */
const ORB_MIN = 184;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smooth = (v: number) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};

export interface OrbGeometry {
  /** Diameter of the orb, px. */
  d: number;
  /** Its centre, px from the left and the top of the screen. */
  cx: number;
  cy: number;
  /** Bottom of the band the headline, the search and the chips stand in, px from the top. */
  band: number;
  /** Strip kept clear at the bottom of the screen (the hint, the map credits), px. */
  foot: number;
}

/**
 * Where the orb floats. Mirrored in orb.css (--orb-font, --orb-inset, --orb-stack, --orb-foot,
 * --orb-band, --orb-d, --orb-cy): change both together.
 *
 * The band is the stack's own height: top inset, three lines of headline, the search, the chips.
 * The orb is centred in what is left between the band and the foot, with 18 to 20px of air on
 * each side for its atmosphere.
 */
export function orbGeometry({ wide, vw, vh, safeTop, safeBottom }: Pick<LayoutEnv, "wide" | "vw" | "vh" | "safeTop" | "safeBottom">): OrbGeometry {
  let band: number;
  let foot: number;
  let d: number;
  // A phone on its side, or a very low window: the headline goes (orb.css) and the search and the
  // chips stand alone under the wordmark, so that a complete planet still fits below them.
  const flat = vh < FLAT_BELOW;
  if (wide) {
    const short = vh < 620;
    const font = clamp(Math.min(0.036 * vw, 0.058 * vh), 36, 60);
    // inset + headline (line-height 1) + gap 18 + search 56 + gap 14 + chips 38 + 6
    // flat: inset 66 (under the wordmark and the layout pill) + search 56 + gap 14 + chips 38 + 6
    band = flat ? 66 + 108 + 6 : (short ? 24 : 32) + 3 * font + 126 + 6;
    foot = short ? 30 : 40;
    d = clamp(Math.min(0.5 * vw, vh - band - foot - (flat ? 20 : 36)), ORB_MIN, 540);
  } else {
    const short = vh < 700;
    const font = short ? clamp(0.08 * vw, 27, 34) : clamp(0.094 * vw, 30, 42);
    // inset + headline (line-height 1.03) + gaps, search 52 and chips 46 + 6
    // flat: inset 50 (under the wordmark) + search 52 + gap 10 + chips 46 + 6
    band = flat ? 50 + safeTop + 108 + 6 : (short && vw >= 780 ? 18 : 50) + safeTop + 3.09 * font + (short ? 120 : 130) + 6;
    foot = (short ? 30 : 64) + safeBottom;
    d = clamp(Math.min(0.78 * vw, vh - band - foot - (flat ? 16 : 40)), ORB_MIN, 540);
  }
  return { d, cx: vw / 2, cy: band + (vh - band - foot) / 2, band, foot };
}

function OrbTop({ island, flying, onOpen, onIntent, searchRef, introRef }: TopProps) {
  return (
    <>
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
        </div>
      </div>
      {/* Under the orb, a caption for it. */}
      <div className="da-orb-foot" aria-hidden={island ? true : undefined}>
        <Hint />
      </div>
    </>
  );
}

/** The orb's atmosphere (a wide soft glow around the limb) and the faint shadow it floats above. */
function OrbAir() {
  return (
    <>
      <div className="da-orb-shadow" aria-hidden="true" />
      <div className="da-orb-glow" aria-hidden="true" />
    </>
  );
}

/**
 * How far the globe's frame is from the orb's place (0) to the open island's (1), from the size
 * of the planet on screen alone. While the orb turns (and breathes in a little) it stays put;
 * as it swells, its centre, which is where the island is by then, glides to the island's place.
 * Most of that glide happens once the limb has left the screen, so what is seen is a planet
 * growing from its centre.
 */
function swell(radius: number, env: LayoutEnv): number {
  const home = orbGeometry(env).d / 2;
  const doublings = Math.log2(Math.max(radius, 1) / home);
  return smooth((doublings - SWELL_HOLD) / (SWELL_SPAN - SWELL_HOLD));
}

/** Doublings of the orb's size until it covers the screen. */
function fillLevels(env: LayoutEnv): number {
  return Math.log2(Math.hypot(env.vw, env.vh) / orbGeometry(env).d);
}

/**
 * The dive, re-timed. The engine's own curve creeps at first and then rushes through the moment
 * the planet fills the screen, which is the moment this layout is about. Here the planet swells
 * at a steady, readable pace until it is the world (the first SWELL_TIME of the dive), then the
 * camera speeds up over the map and eases down onto the island.
 * `s`: time through the dive, 0 to 1. Returns the share of its `levels` covered.
 */
function dive(s: number, levels: number, env: LayoutEnv): number {
  const x = clamp(s, 0, 1);
  // The share of the dive that is the orb growing to fill the screen.
  const swellShare = clamp(fillLevels(env) / levels, 0.05, 0.45);
  if (x <= SWELL_TIME) return swellShare * (x / SWELL_TIME) ** 1.5;
  // Then a smooth curve on to the island: it leaves the swell at the swell's own pace and arrives at rest.
  const pace = (1.5 * swellShare) / SWELL_TIME;
  const rest = 1 - SWELL_TIME;
  const u = (x - SWELL_TIME) / rest;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * swellShare + (u3 - 2 * u2 + u) * rest * pace + (-2 * u3 + 3 * u2);
}

export const orbLayout: LayoutModule = {
  id: "orb",
  card: "dock",
  plateInFlight: false,
  spin: 5,
  flightSpeed: 1.12,
  homeSpeed: 1.12,
  ownsFlight: true,
  zoomAtHome: false,
  homeBackdrop: true,
  islandSize: () => ISLAND_SIZE,
  home(env: LayoutEnv) {
    const { d, cy } = orbGeometry(env);
    // The free area is exactly the orb's square: the engine draws the globe to fill it. Never
    // negative (a screen too low for the smallest planet): the map refuses such a frame outright.
    return { padding: { top: Math.max(0, cy - d / 2), right: 0, bottom: Math.max(0, env.vh - cy - d / 2), left: 0 }, globeSize: 1, center: HOME_CENTER };
  },
  islandPadding({ wide, sheetCover, dockHeight }: LayoutEnv) {
    if (wide) return { top: WIDE_TOP, right: 24, bottom: dockHeight + DOCK_MARGIN + 14, left: 24 };
    return { top: SEARCH_TOP + SEARCH_H + 12, right: 0, bottom: sheetCover, left: 0 };
  },
  /** The zoom is fitted here, with the size the globe has once an island is open (as the horizon does). */
  flyOptions(island: GlobeIsland, map, env) {
    return { speed: this.flightSpeed, zoom: islandZoom(map, island, this.islandPadding(env), ISLAND_SIZE, HOME_CENTER[1]) };
  },
  shape: {
    anchored: true,
    frame: (t: number, out: boolean, { radius, env }: FlightView) => {
      const grown = swell(radius, env);
      const closing = smooth((t - FRAME_BY) / (1 - FRAME_BY));
      return out ? Math.max(grown, closing) : Math.min(grown, 1 - closing);
    },
    // Home is the dive played backwards: a quick climb, then the world shrinks steadily into the orb.
    height: (s: number, out: boolean, levels: number, env: LayoutEnv) => (out ? dive(s, levels, env) : 1 - dive(1 - s, levels, env)),
    // Straight on: the planet swells toward the visitor, it does not tilt.
    pitch: () => 0,
  },
  vars(env: LayoutEnv) {
    const { d, cy, band } = orbGeometry(env);
    return { "--orb-d": `${d}px`, "--orb-cy": `${cy}px`, "--orb-band": `${band}px` };
  },
  Top: OrbTop,
  GlobeExtras: OrbAir,
};
