"use client";

/**
 * Layout "split": words, search and island chips in a column on the left, the globe on the
 * right (phones: stacked, the globe under the search). The card is a panel down the left side
 * (phones: a bottom sheet), and its name plate rides along during the flight.
 *
 * Its styling is the base of ../atlas.css: the other layouts restate what they change.
 */
import { HOME_VIEW } from "@/lib/islands";
import { Hint, Intro, IslandChips } from "../parts";
import { Search } from "../Search";
import type { LayoutEnv, LayoutModule, TopProps } from "./types";

/* Numbers shared with atlas.css (see the matching rules there). */
const SEARCH_TOP = 10;
const SEARCH_H = 52;
/** Phone landing: hint + island chips + the row the credits sit in. */
const RAIL_H = 136;
const PANEL_X = 24;
const PANEL_W = 448;
/** Left edge and width of the words column on a wide screen (.da-top). */
const COLUMN_X = 56;
const columnWidth = (vw: number) => Math.min(500, vw * 0.39);
/** The globe is never drawn smaller than this on a wide screen; a narrow window crops it at the right. */
const MIN_GLOBE = 520;

/** Left padding of the landing on a wide screen: the globe starts where the words end. */
function homeLeft(vw: number): number {
  return Math.min(720, Math.max(vw * 0.46, Math.min(560, COLUMN_X + columnWidth(vw) + 28)));
}

function SplitTop({ island, onOpen, onIntent, searchRef, introRef }: TopProps) {
  return (
    <div className="da-top">
      <Intro hidden={Boolean(island)} contentRef={introRef} />
      <Search ref={searchRef} onSelect={(target) => onOpen(target.id)} onIntent={onIntent} current={island?.name ?? null} />

      {/* Phone: pinned to the bottom of the screen. Desktop: under the search, in the column. */}
      <div className="da-rail" inert={island ? true : undefined}>
        <Hint />
        <IslandChips onOpen={onOpen} onIntent={onIntent} />
      </div>
    </div>
  );
}

export const splitLayout: LayoutModule = {
  id: "split",
  card: "side",
  plateInFlight: true,
  spin: 5,
  /** Slower than the engine's default: a long, calm dive. */
  flightSpeed: 1.22,
  homeSpeed: 0.92,
  ownsFlight: false,
  islandSize: ({ wide }) => (wide ? 1 : 0.96),
  home({ wide, vw, vh, introHeight }: LayoutEnv) {
    if (wide) {
      const left = homeLeft(vw);
      const free = Math.min(vw - left, vh - 48);
      // Between 900 and about 1000px the free width is under MIN_GLOBE: keep the globe that big
      // and let the right edge of the window crop it, rather than shrink it to a button.
      const size = Math.max(1, Math.min(MIN_GLOBE, vh - 48) / Math.max(80, free));
      return { padding: { left, top: 24, right: 0, bottom: 24 }, globeSize: size, center: HOME_VIEW.center };
    }
    return { padding: { top: SEARCH_TOP + introHeight + 12 + SEARCH_H + 10, right: 0, bottom: RAIL_H, left: 0 }, globeSize: 0.96, center: HOME_VIEW.center };
  },
  islandPadding({ wide, sheetCover }: LayoutEnv) {
    if (wide) return { left: PANEL_X + PANEL_W + 24, top: 28, right: 24, bottom: 28 };
    return { top: SEARCH_TOP + SEARCH_H + 12, right: 0, bottom: sheetCover, left: 0 };
  },
  Top: SplitTop,
};
