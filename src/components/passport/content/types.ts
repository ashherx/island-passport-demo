import type { ReactNode } from "react";
import type { ProgressSource } from "@/components/stamp";
import type { Stamp, StampSlot, StampStatus } from "@/lib/types";

/**
 * Per-slot control for the motion layer. Keyed by slot id (or the Provincial Stamp id) in
 * `BuildPassportOptions.slotOverrides`.
 */
export interface SlotOverride {
  /** Draw the slot as if it were still empty, e.g. while a stamp flies in on an overlay. */
  hidden?: boolean;
  /** Draw the stamp at this status instead of the one in the data. */
  status?: StampStatus;
  /** Passed to <Stamp inkProgress>. A MotionValue animates the in-page stamp with no re-render. */
  inkProgress?: number | ProgressSource;
  /** Passed to <Stamp showSeal>. False while a standalone seal flies in for the upgrade. */
  showSeal?: boolean;
  /** Pulse a soft ring around the slot (a stamp that was just earned). */
  highlight?: boolean;
  /**
   * Added by the integrator. Draw this in the stamp box instead of the page's own <Stamp />, for a
   * moment that animates in place (the status upgrade). `px` is the size the page would draw the
   * stamp at and `detail` the level of detail it would pass to <Stamp />: "compact" below 120 CSS
   * px, "full" from there up ("auto" is no longer passed; it stays in the type for older callers).
   * Pass both on, so the stamp does not change at hand-over. Keep the function identity stable: a
   * new function re-renders the page.
   */
  render?(px: number, detail: "compact" | "full" | "auto"): ReactNode;
  /** Added by the integrator. Drawn in the stamp box after the stamp (ink flecks, for example). */
  after?(px: number): ReactNode;
}

export interface BuildPassportOptions {
  /** A collected stamp was tapped (PAS-4). Without it stamps are not interactive. */
  onStampSelect?(slot: StampSlot, stamp: Stamp): void;
  /** An empty slot was tapped. Without it empty slots are not interactive. */
  onEmptySlotSelect?(slot: StampSlot): void;
  /**
   * An island was tapped on the province page (a row of the island index or a marker on the
   * chart). Without it the index and the chart are static, exactly as before.
   */
  onIslandSelect?(islandId: string): void;
  /** The awarded Provincial Stamp was tapped. */
  onProvincialSelect?(stamp: Stamp): void;
  slotOverrides?: Record<string, SlotOverride>;
  /**
   * "single" (default): one page at a time, binding on the left of every page.
   * "spread": two pages side by side, pages[0] on the left, so gutters and page numbers alternate.
   */
  layout?: "single" | "spread";
  /** Expected page width in px before the first measurement. Default 360. */
  pageWidth?: number;
  /** Foil follows pointer, tilt and an idle glint. Default true. */
  coverInteractive?: boolean;
  /** Draw the page block along the cover's fore edge (for covers shown outside the book). */
  coverPageEdge?: boolean;
  /**
   * The live globe for the front cover (a <CoverGlobeFace />, see passport/cover-globe). Keep the
   * node stable (useMemo). Without it the cover carries the printed emblem, as before.
   */
  coverGlobe?: ReactNode;
}

/** Where things are in `pages`. All indexes are zero-based, as PassportBookHandle.flipTo expects. */
export interface PassportPageMap {
  count: number;
  holder: number;
  province: number;
  /** Island id to page index. */
  islands: Record<string, number>;
  provincial: number;
  /** Page index for a slot id, or -1. The Provincial Stamp id resolves to `provincial`. */
  forSlot(slotId: string): number;
}

export interface PassportContent {
  cover: ReactNode;
  pages: ReactNode[];
  backCover: ReactNode;
  pageMap: PassportPageMap;
}
