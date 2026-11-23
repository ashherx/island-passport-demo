"use client";

/**
 * Layout "fullbleed": the map is the page. The globe fills the whole screen, edge to edge, close
 * enough that on a phone the planet overflows it and on a wide screen only its limb and a little
 * atmosphere show in the corners. It faces the Coral Triangle, with Bohol a little right of the
 * middle, and sways slowly instead of turning all the way round. Everything else floats over it
 * as frosted glass: a compact wordmark, a search pill near the top, a short headline bottom left
 * (phones: along the bottom, above the chips), a row of island chips.
 *
 * The journey is one flight, the engine's, started here with exact options (`flyOptions`) and
 * shaped on top (`shape`): the camera pulls back a touch and banks (the planet rolls a few
 * degrees as its frame slides to where the island will land), then sweeps down in a dive that
 * tilts as it goes, and lands looking across the island at an angle (`islandView`), which is how
 * the island stays while its card is open. The card arrives after the landing: a floating glass
 * card on the right on a wide screen (`card: "float"`), the bottom sheet on a phone. Closing
 * plays it back: the card leaves, the camera rises and levels, overshoots a little and settles
 * on the landing, and the floating pieces glide back in.
 *
 * `fullbleedGeometry` is mirrored in fullbleed.css for the first paint (the poster's size, in
 * container units); once the screen is known the shell publishes --fb-card-w in px.
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import { planFlight, type Padding } from "@/components/globe";
import { cameraDistance, radiusForLimb } from "@/components/globe/camera";
import type { GlobeIsland } from "@/lib/islands";
import { t } from "@/lib/strings";
import { homeZoom, islandZoom } from "../camera";
import { Hint, Intro, IslandChips } from "../parts";
import { Search } from "../Search";
import { aStrings } from "../strings";
import type { FlightView, HomeFrame, LayoutEnv, LayoutModule, TopProps } from "./types";

/** The docked search field and its top inset, phones (fullbleed.css). */
const SEARCH_TOP = 10;
const SEARCH_H = 52;
/** Wide screens: the docked search pill and the flight caption sit in this band. */
const WIDE_TOP = 84;
/** Wide screens: the floating card's inset from the right edge, and the air kept between it and the island. */
const CARD_X = 24;
const CARD_AIR = 44;
const ISLAND_SIZE = 0.96;

/**
 * The planet's radius as a share of the screen's half diagonal. Over 1 it overflows every corner
 * (phones). Under 1 the limb shows in the corners (wide screens).
 */
const COVER_PHONE = 1.04;
const COVER_WIDE = 0.9;
/**
 * Where the globe faces on the landing: the Coral Triangle. Bohol sits a little right of the
 * middle and above it, clear of the headline; Borneo, Sulawesi and the Philippines fill a phone.
 * The same on every screen: the server draws the poster without knowing which one it is.
 */
const HOME_CENTER: [number, number] = [120, 4.5];

/* The open island, seen at an angle (degrees). */
const PITCH = 52;
const BEARING = -17;

/* The journey's shape (see `shape` below). Progress runs 0 to 1 over the whole flight. */
/** Out: the camera pulls back by this many zoom levels before it dives (peak at LIFT_AT, over by LIFT_END). */
const LIFT = 0.42;
const LIFT_AT = 0.2;
const LIFT_END = 0.5;
/** Out: the globe's frame has slid from the landing's to the island's by this point. */
const FRAME_OUT_END = 0.56;
/** Out: the bank. The planet starts to roll at once and has turned to the island's bearing by this point. */
const BANK_OUT_END = 0.72;
/** Out: the tilt begins here (the dive is under way) and is complete a moment before the landing. */
const TILT_OUT_START = 0.36;
const TILT_OUT_END = 0.97;
/** The tilt is also held to the camera's height: none at the landing's height, all of it this many doublings further in. */
const TILT_LEVELS = 3.6;
/** Home: the camera is level again by this point, and faces north by the next. */
const TILT_HOME_END = 0.6;
const BANK_HOME_END = 0.72;
/** Home: the frame stays on the island until this point, then slides back. */
const FRAME_HOME_START = 0.16;
/** Home: the camera rises a little past the landing view and settles back onto it (zoom levels). */
const OVERSHOOT = 0.14;
/** Multipliers on the engine's flight time: from the landing, and between two open islands. */
const SPEED_OUT = 1.7;
const SPEED_HOP = 1.3;
/** No flight to an island is longer than this, however far (ms). */
const MAX_FLIGHT = 6400;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeInOutSine = (v: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(v, 0, 1));
const smooth = (v: number) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};
/** 0 until `start`, a smooth rise to 1 at `peak`, a smooth fall back to 0 at `end`. */
function bump(t: number, start: number, peak: number, end: number): number {
  if (t <= start || t >= end) return 0;
  return t < peak ? easeInOutSine((t - start) / (peak - start)) : easeInOutSine((end - t) / (end - peak));
}
/** Signed degrees from `from` to `to` the short way round. */
const turn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

export interface FullbleedGeometry {
  /** Radius of the planet's silhouette on the landing, px. */
  r: number;
  /** Width of the floating card on a wide screen, px. */
  cardW: number;
}

/** Mirrored in fullbleed.css (the poster's --ipg-d, --fb-card-w). */
export function fullbleedGeometry({ wide, vw, vh }: Pick<LayoutEnv, "wide" | "vw" | "vh">): FullbleedGeometry {
  return { r: (Math.hypot(vw, vh) / 2) * (wide ? COVER_WIDE : COVER_PHONE), cardW: clamp(0.33 * vw, 380, 440) };
}

function homeFrame(env: LayoutEnv): HomeFrame {
  const { r } = fullbleedGeometry(env);
  // The frame is the whole screen: the planet's centre is the screen's.
  return { padding: { top: 0, right: 0, bottom: 0, left: 0 }, globeSize: (2 * r) / Math.max(80, Math.min(env.vw, env.vh)), center: HOME_CENTER };
}

function islandFrame(env: LayoutEnv): Padding {
  const { wide, sheetCover } = env;
  // Wide: everything left of the floating card. The tilt and the turn make the island's outline
  // wider and taller on screen than the flat outline the engine fits, hence the generous margins.
  if (wide) return { top: WIDE_TOP + 20, right: CARD_X + fullbleedGeometry(env).cardW + CARD_AIR, bottom: 56, left: 56 };
  return { top: SEARCH_TOP + SEARCH_H + 12, right: 0, bottom: sheetCover, left: 0 };
}

/**
 * How long the flight to an island takes. The engine derives a time from how far the camera
 * turns and dives; it is stretched here so the pull-back, the bank and the tilt can be read, and
 * capped so the far side of the planet is not a ten-second wait.
 */
function flightMs(map: MapLibreMap, island: GlobeIsland, zoom: number, padding: Padding, home: HomeFrame): number {
  const centre = map.getCenter();
  const [west, south, east, north] = island.bbox;
  const landing = homeZoom(map, padding, home.globeSize, home.center[1]);
  const derived = planFlight(
    { center: [centre.lng, centre.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() },
    { center: [(west + east) / 2, (south + north) / 2], zoom, bearing: BEARING, pitch: PITCH },
    { globalZoom: landing },
  ).duration;
  // From up high it is the whole journey; from an open island it is a hop.
  const fromLanding = map.getZoom() < landing + 2.5;
  return clamp(derived * (fromLanding ? SPEED_OUT : SPEED_HOP), derived, MAX_FLIGHT);
}

/**
 * How much of the tilt the camera's height allows: none while the planet's limb can be on
 * screen, all of it TILT_LEVELS doublings further in. The atmosphere drawn round the limb in CSS
 * is a circle, and a tilted planet is not one; and a camera that leans over as it comes down,
 * and levels as it climbs, is what a dive looks like. It is what shapes a flight between two
 * open islands: tilted on both, level over the top if the trip is long enough to climb that far.
 */
function tiltAllowed({ radius, env }: FlightView): number {
  // In zoom levels, so from the planet's own radius: close in, its silhouette on screen grows
  // only half as fast as the map does.
  const distance = cameraDistance(env.vh);
  const reach = (Math.hypot(env.vw, env.vh) / 2) * 1.12;
  const levels = Math.log2(radiusForLimb(Math.max(radius, 1), distance) / radiusForLimb(reach, distance));
  return smooth(levels / TILT_LEVELS);
}

function FullbleedTop({ island, flying, onOpen, onIntent, searchRef, introRef }: TopProps) {
  return (
    <div className="da-top">
      <Search ref={searchRef} onSelect={(target) => onOpen(target.id)} onIntent={onIntent} current={island?.name ?? null} />
      {/* In place of the card's name plate, which this layout holds back until the landing. */}
      <p className="da-flight" data-on={island && flying ? "" : undefined} aria-hidden="true">
        <span className="da-status-dot" />
        {island ? t(aStrings.flight.flying, { name: island.name }) : ""}
      </p>
      <div className="da-fb-hint" aria-hidden={island ? true : undefined}>
        <Hint />
      </div>
      <Intro hidden={Boolean(island)} contentRef={introRef} />
      <div className="da-rail" inert={island ? true : undefined}>
        <IslandChips onOpen={onOpen} onIntent={onIntent} />
      </div>
    </div>
  );
}

/**
 * Light behind the floating pieces: the map is lifted toward white under the wordmark and the
 * search, and under the headline and the chips, so dark type reads on it. Nothing is darkened.
 * Drawn inside the globe's box, over the map and under its credits.
 */
function FullbleedWash() {
  return (
    <>
      <div className="da-fb-wash" data-at="top" aria-hidden="true" />
      <div className="da-fb-wash" data-at="foot" aria-hidden="true" />
    </>
  );
}

export const fullbleedLayout: LayoutModule = {
  id: "fullbleed",
  card: "float",
  plateInFlight: false,
  /** Slow: at this range a degree is a dozen pixels. It sways (`drift`) instead of going round. */
  spin: 0.75,
  drift: 6,
  flightSpeed: SPEED_OUT,
  homeSpeed: 1.85,
  ownsFlight: true,
  /** The landing is drawn from level 3 tiles on a phone and a laptop: the backdrop for the way home uses the same. */
  homeBackdrop: 3,
  peekMs: 420,
  islandView: { pitch: PITCH, bearing: BEARING },
  islandSize: () => ISLAND_SIZE,
  home: homeFrame,
  islandPadding: islandFrame,
  /** An exact zoom, fitted with the globe size an open island has (as the horizon does), and the flight's length. */
  flyOptions(island: GlobeIsland, map, env) {
    const padding = islandFrame(env);
    const home = homeFrame(env);
    const zoom = islandZoom(map, island, padding, ISLAND_SIZE, home.center[1]);
    return { zoom, duration: flightMs(map, island, zoom, padding, home) };
  },
  shape: {
    // Out: the frame slides to the island's place while the camera is still high, so the dive
    // comes straight down on it. Home: the camera climbs first, then the planet slides back.
    frame: (t, out) => (out ? easeInOutSine(t / FRAME_OUT_END) : easeInOutSine((t - FRAME_HOME_START) / (1 - FRAME_HOME_START))),
    // Out: level through the pull-back, then tilting all the way down, to land looking across
    // the island. Home: level again early in the climb. Never tilted while the limb is in view,
    // and never more than the camera's height allows.
    pitch(t, out, view) {
      const from = view.start.pitch;
      const timed = out ? from + (PITCH - from) * smooth((t - TILT_OUT_START) / (TILT_OUT_END - TILT_OUT_START)) : from * (1 - smooth(t / TILT_HOME_END));
      // On the last stretch the tilt is the landing's own, whatever the island's size.
      return out && t >= TILT_OUT_END ? timed : Math.min(timed, PITCH * tiltAllowed(view));
    },
    // The bank: the planet rolls toward the island's bearing from the first frame, and rolls
    // back to north on the way home.
    bearing(t, out, view) {
      const from = view.start.bearing;
      return out ? from + turn(from, BEARING) * easeInOutSine(t / BANK_OUT_END) : from + turn(from, 0) * easeInOutSine(t / BANK_HOME_END);
    },
    // Out: a breath back before the dive. Home: a little past the landing view, then down onto it.
    lift: (t, out) => (out ? -LIFT * bump(t, 0, LIFT_AT, LIFT_END) : -OVERSHOOT * bump(t, 0.5, 0.82, 1)),
  },
  vars(env: LayoutEnv) {
    return { "--fb-card-w": `${fullbleedGeometry(env).cardW}px` };
  },
  Top: FullbleedTop,
  GlobeExtras: FullbleedWash,
};
