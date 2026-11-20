/**
 * Sizing and page bookkeeping for the custom passport engine.
 *
 * Everything inside the book is laid out in "design pixels" (a page is PAGE_W x PAGE_H) and the
 * whole book is scaled once to fit its container, so page content can be designed at one size.
 *
 * Leaves: index 0 is the front cover, 1..sheets are paper leaves, sheets + 1 is the back cover.
 * `k` (0..leaves) counts the leaves lying on the left: 0 = closed, 1 = opened on the first page.
 */

export const PAGE_W = 320;
export const PAGE_H = 454;
/** How far the cover board sticks out beyond the page block (top, bottom and fore edge). */
export const BOARD_OVERHANG = 5;
/** Cover board thickness. */
export const BOARD_THICK = 3;
/** Vertical breathing room in the stage, so a leaf looming towards the viewer is not cut off. */
export const STAGE_PAD = 46;
/** CSS perspective distance. */
export const PERSPECTIVE = 2100;
/** Strips a turning page is cut into. */
export const STRIPS = 6;
/** Depth between two neighbouring leaves in a stack. */
export const LEAF_GAP = 1;
/**
 * Pooled turning leaves. Each holds a ready snapshot of one page, taken while the book is idle,
 * so a turn starts without any DOM work. Also the most leaves that can be in the air at once.
 */
export const POOL_SIZE = 8;

export type BookMode = "single" | "spread";

export interface BookLayout {
  mode: BookMode;
  /** CSS scale applied to the design-pixel book. */
  scale: number;
  /** Stage size in design px. */
  stageW: number;
  stageH: number;
  /** Rendered height of the root in CSS px. */
  cssHeight: number;
  /** Spine x in the stage when closed on the front, open, and closed on the back. */
  xClosed: number;
  xOpen: number;
  xBack: number;
  /** Vanishing point x in the stage. */
  originX: number;
  originY: number;
}

export interface LayoutOptions {
  mode?: BookMode | "auto";
  /** Largest page width in CSS px. */
  maxPageWidth?: number;
  /** Largest page height in CSS px (defaults to 62% of the viewport height). */
  maxPageHeight?: number;
  /** Container width from which the two-page spread is used. */
  spreadFrom?: number;
}

export function computeLayout(containerW: number, viewportH: number, opts: LayoutOptions = {}): BookLayout {
  const spreadFrom = opts.spreadFrom ?? 640;
  const mode: BookMode = opts.mode && opts.mode !== "auto" ? opts.mode : containerW >= spreadFrom ? "spread" : "single";
  const maxW = opts.maxPageWidth ?? 400;
  const maxH = opts.maxPageHeight ?? Math.max(260, viewportH * 0.62);
  const coverW = PAGE_W + BOARD_OVERHANG;
  const byWidth = mode === "single" ? containerW * 0.84 : ((containerW - 48) / 2) * (PAGE_W / coverW);
  const pageW = Math.max(120, Math.min(byWidth, maxW, (maxH * PAGE_W) / PAGE_H));
  const scale = pageW / PAGE_W;
  const stageW = containerW / scale;
  const stageH = PAGE_H + STAGE_PAD * 2;
  const xClosed = (stageW - coverW) / 2;
  const single = mode === "single";
  // Single view: when open, the book slides a touch to the right so a sliver of the left-hand
  // stack shows beside the spine. It reads as an open book whose left half is off screen.
  const xOpen = single ? xClosed + Math.min(18, Math.max(6, xClosed * 0.32)) : stageW / 2;
  const xBack = single ? xClosed + coverW : (stageW + coverW) / 2;
  return {
    mode,
    scale,
    stageW,
    stageH,
    cssHeight: stageH * scale,
    xClosed,
    xOpen,
    xBack,
    originX: stageW / 2,
    originY: STAGE_PAD + PAGE_H * 0.44,
  };
}

/* ------------------------------------------------------------------ */
/* Pages <-> leaves                                                    */
/* ------------------------------------------------------------------ */

export interface BookShape {
  mode: BookMode;
  /** Number of content pages. */
  pages: number;
  /** Paper leaves. */
  sheets: number;
  /** All leaves including both covers. */
  leaves: number;
  /** Largest reachable k. */
  kMax: number;
  hasBack: boolean;
}

export function makeShape(mode: BookMode, pages: number, hasBack: boolean): BookShape {
  const sheets = mode === "single" ? pages : Math.ceil(pages / 2);
  const leaves = sheets + 2;
  // Without a back cover the book stops on its last page. In a spread the last leaf may still
  // turn when its reverse carries a page.
  const lastHasVerso = mode === "spread" && pages % 2 === 0 && pages > 0;
  const kMax = hasBack ? leaves : lastHasVerso ? sheets + 1 : Math.max(1, sheets);
  return { mode, pages, sheets, leaves, kMax, hasBack };
}

/** Page index printed on the front of paper leaf `leaf` (1-based leaf index), or -1. */
export function rectoPage(shape: BookShape, leaf: number): number {
  if (leaf < 1 || leaf > shape.sheets) return -1;
  const p = shape.mode === "single" ? leaf - 1 : (leaf - 1) * 2;
  return p < shape.pages ? p : -1;
}

/** Page index printed on the reverse of paper leaf `leaf`, or -1 (always -1 in single view). */
export function versoPage(shape: BookShape, leaf: number): number {
  if (shape.mode === "single" || leaf < 1 || leaf > shape.sheets) return -1;
  const p = (leaf - 1) * 2 + 1;
  return p < shape.pages ? p : -1;
}

/** The page reported to onFlip for a given k: the first page in view. */
export function pageForK(shape: BookShape, k: number): number {
  if (shape.pages === 0) return 0;
  if (shape.mode === "single") return clampInt(k - 1, 0, shape.pages - 1);
  return k <= 1 ? 0 : clampInt(2 * k - 3, 0, shape.pages - 1);
}

/** The k at which page `p` is in view. */
export function kForPage(shape: BookShape, p: number): number {
  const page = clampInt(p, 0, Math.max(0, shape.pages - 1));
  const k = shape.mode === "single" ? page + 1 : page === 0 ? 1 : Math.floor((page + 1) / 2) + 1;
  return clampInt(k, 1, Math.min(shape.kMax, shape.sheets + 1));
}

/** Depth of leaf `leaf` in the stack: the same offset stacks correctly on both sides. */
export const leafDepth = (shape: BookShape, leaf: number) => (shape.leaves - leaf) * LEAF_GAP;

function clampInt(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}
