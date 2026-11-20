/**
 * FlipEngine: a thin, React-free driver around StPageFlip ("page-flip", HTML mode).
 *
 * StPageFlip supplies the hard part: the fold geometry, the clip polygons, the page stacking and
 * the spread bookkeeping. This file replaces the parts that hold it back on a phone:
 *
 *  1. Render loop. The library runs requestAnimationFrame forever, rewriting every page's style
 *     60 times a second even when nothing moves, and never stops after destroy(). Here its loop is
 *     never started; the engine ticks it only while something is moving (zero idle cost).
 *  2. Motion. Library flips move the page corner at constant speed along a straight line. Here
 *     every flip is eased and travels along a shallow arc, so pages lift, turn and settle.
 *  3. Input. Library touch input waits 250 ms before a page follows the finger. Here Pointer
 *     Events drive the fold directly: it starts from the page edge the moment a horizontal drag
 *     is recognised, follows the finger, and completes or falls back by position and velocity.
 *     Vertical scrolling stays with the browser (touch-action: pan-y).
 *  4. Shading. The library's fold shadows repaint two large clipped divs every frame. Here they
 *     are fixed strips that only change transform and opacity, tinted per art direction, with a
 *     highlight along the curl and a soft drop shadow under the sheet in the air. In single-page
 *     mode the back of a turning page is drawn as paper instead of a deep clone of the page
 *     (cheaper, and what the back of a sheet looks like).
 *
 * The library is used unmodified from npm. Points 1 to 4 reach into private members, which the
 * minified bundle keeps by name. page-flip has been at 2.0.7 since 2021; keep the version pinned.
 */
import type { FlipSetting, PageFlip, PageRect, Point } from "page-flip";

export type FlipMode = "single" | "double";
export type EngineState = "read" | "user_fold" | "fold_corner" | "flipping";
export type PageFlipCtor = new (element: HTMLElement, setting: Partial<FlipSetting>) => PageFlip;

export interface FlipEngineOptions {
  PageFlip: PageFlipCtor;
  /** Element the book is built in. The engine appends one child and removes it on destroy. */
  mount: HTMLElement;
  /** One element per page. They are moved into the book and handed back on destroy. */
  hosts: HTMLElement[];
  mode: FlipMode;
  /** In "double" mode: which side pages[0] sits on when the book opens. */
  firstPageSide: "left" | "right";
  pageWidth: number;
  pageHeight: number;
  startPage: number;
  reducedMotion: boolean;
  /** Draw the spine shading over the pages. */
  gutter: boolean;
  onFlip(page: number): void;
  /** A turn has been decided (button, key, tap or a released drag) and the page is on its way. */
  onFlipStart?(page: number): void;
  onState?(state: EngineState): void;
  /** The user tried to turn past the first ("prev") or the last ("next") page. */
  onEdge?(direction: "prev" | "next"): void;
}

/* ------------------------------------------------------------------ */
/* Private StPageFlip surface this file depends on                     */
/* ------------------------------------------------------------------ */

const FORWARD = 0;
const BACK = 1;
/** PageOrientation.RIGHT in the library. */
const RIGHT = 1;
type Direction = typeof FORWARD | typeof BACK;
type Corner = "top" | "bottom";

interface LibCalc {
  calc(pos: Point): boolean;
  getPosition(): Point;
  getDirection(): Direction;
  getCorner(): Corner;
}

interface LibPage {
  element: HTMLElement;
  state: { angle: number; area: (Point | null)[]; position: Point };
  copiedElement: HTMLElement | null;
  temporaryCopy: LibPage | null;
  nowDrawingDensity: "soft" | "hard";
  render: LibRender;
  newTemporaryCopy(): LibPage;
  hideTemporaryCopy(): void;
  simpleDraw(orient: number): void;
}

type LibPageCtor = new (render: LibRender, element: HTMLElement, density: "soft" | "hard") => LibPage;

interface LibShadow {
  pos: Point | null;
  angle: number;
  width: number;
  opacity: number;
  progress: number;
}

interface LibAnimation {
  startedAt: number;
}

interface LibRender {
  /** Per-frame step: advances the running animation and draws. */
  render(timer: number): void;
  drawFrame(): void;
  flippingPage: LibPage | null;
  timer: number;
  animation: LibAnimation | null;
  shadow: LibShadow | null;
  /** Corners of the turning sheet, in page coordinates. */
  pageRect: { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point } | null;
  outerShadow: HTMLElement;
  innerShadow: HTMLElement;
  drawOuterShadow(): void;
  drawInnerShadow(): void;
  startAnimation(frames: (() => void)[], duration: number, onEnd: () => void): void;
  finishAnimation(): void;
  setBottomPage(page: LibPage | null): void;
  setFlippingPage(page: LibPage | null): void;
  clearShadow(): void;
  getRect(): PageRect;
  getDirection(): Direction | null;
  convertToGlobal(pos: Point, direction?: Direction): Point;
}

interface LibFlip {
  calc: LibCalc | null;
  start(globalPos: Point): boolean;
  do(pagePos: Point): void;
  flip(globalPos: Point): void;
  showCorner(globalPos: Point): void;
  setState(state: EngineState): void;
  getState(): EngineState;
  reset(): void;
  animateFlippingTo(start: Point, dest: Point, isTurned: boolean, needReset?: boolean): void;
}

interface LibCollection {
  getPages(): LibPage[];
}

interface LibUI {
  removeHandlers(): void;
}

/* ------------------------------------------------------------------ */
/* Tuning                                                              */
/* ------------------------------------------------------------------ */

/** Duration of a full programmatic flip, in ms. */
const FLIP_MS = { single: 780, double: 920 } as const;
/** How far the page corner travels per pixel of finger travel. */
const DRAG_GAIN = 1.75;
/** Movement (px) before a press becomes a drag. */
const SLOP = { touch: 9, mouse: 4 } as const;
/** Flick speed (px/ms) that completes or cancels a flip regardless of position. */
const FLICK = 0.2;
/** Finger travel, as a share of the page width, that completes a flip when the finger is let go at rest. */
const COMMIT_TRAVEL = 0.3;
/** Velocity is taken from the last stretch of the gesture only (ms). */
const VELOCITY_WINDOW = 100;
/** A finger that has rested this long before lifting has no velocity (ms). */
const REST_MS = 90;
/** Longest a riffle through several pages may take (ms). */
const RIFFLE_MS = 1000;
/** Outer share of a page where a tap or click turns it. */
const EDGE_ZONE = 0.2;
/** Things inside a page that must keep their own taps and drags. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"], [data-no-flip]';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - x;
      const d = slopeX(t);
      if (Math.abs(dx) < 1e-4 || Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(clamp(t, 0, 1));
  };
}

/** A page lifted from rest: slow to leave, quick through the middle, soft landing. */
const EASE_TURN = cubicBezier(0.5, 0.02, 0.2, 1);
/** A page let go mid-air: already moving, so it only needs to land. */
const EASE_RELEASE = cubicBezier(0.22, 0.72, 0.2, 1);
const EASE_OUT = cubicBezier(0.2, 0.7, 0.2, 1);
/** Pages thumbed through one after another: no pause at either end. */
const EASE_RIFFLE = cubicBezier(0.36, 0.04, 0.36, 1);

function el(className: string, html = ""): HTMLDivElement {
  const node = document.createElement("div");
  node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

/** How far inside its own edge a warm page is clipped, in px. */
const WARM_INSET = 14;

/**
 * Inline style of a page lying flat at (x, y). Deliberately the same set of properties the library
 * writes for a turning page (transform plus clip-path), so that a page going from rest to flight
 * and back only changes values and the browser keeps its painted layer.
 */
function restingStyle(x: number, y: number, w: number, h: number, zIndex: number, inset = 0): string {
  const clip = `polygon(${inset}px ${inset}px, ${w - inset}px ${inset}px, ${w - inset}px ${h - inset}px, ${inset}px ${h - inset}px)`;
  return (
    `display:block;z-index:${zIndex};left:0;top:0;width:${w}px;height:${h}px;` +
    `transform-origin:0 0;transform:translate3d(${x}px,${y}px,0) rotate(0rad);` +
    `clip-path:${clip};-webkit-clip-path:${clip};`
  );
}

/** Size of a fold-shadow strip before it is scaled into place (see .ipb__fold). */
const STRIP = 100;

/**
 * Lay a strip along the segment a-b, growing sideways from it by `width` px.
 * `ref` is a point on one side of the segment; the strip grows towards it or away from it.
 * Only transform and opacity are written.
 */
function placeStrip(
  node: HTMLElement,
  a: Point,
  b: Point,
  ref: Point,
  towards: boolean,
  width: number,
  opacity: number,
): void {
  let ux = b.x - a.x;
  let uy = b.y - a.y;
  const length = Math.hypot(ux, uy);
  if (length < 0.5 || opacity < 0.004) {
    node.style.opacity = "0";
    return;
  }
  ux /= length;
  uy /= length;
  // rotate(theta) carries the strip's y axis onto the fold and its x axis onto this normal:
  const nx = uy;
  const ny = -ux;
  const refSide = (ref.x - a.x) * nx + (ref.y - a.y) * ny >= 0 ? 1 : -1;
  const side = towards ? refSide : -refSide;
  const pad = 80; // run past both ends; whatever holds the strip trims it
  const theta = Math.atan2(-ux, uy);
  node.style.transform =
    `translate3d(${(a.x - ux * pad).toFixed(2)}px,${(a.y - uy * pad).toFixed(2)}px,0) ` +
    `rotate(${theta.toFixed(5)}rad) scale(${((side * width) / STRIP).toFixed(4)},${((length + 2 * pad) / STRIP).toFixed(4)})`;
  node.style.opacity = opacity.toFixed(3);
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

interface DragState {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  /** Client rect origin of the book at press time. */
  originLeft: number;
  originTop: number;
  active: boolean;
  /** Set once the press can no longer become a flip (vertical scroll, interactive target). */
  dead: boolean;
  /** Set when the drag asks for a page beyond the first or the last one. */
  edge: "prev" | "next" | null;
  direction: Direction;
  corner: Corner;
  /** Corner position (page coordinates) when the drag took over. */
  from: Point;
  target: Point;
  current: Point;
  samples: { x: number; t: number }[];
  interactive: boolean;
}

/**
 * Speed of the finger along x in px/ms when it lifts at time `now`: the segment speeds of the last
 * VELOCITY_WINDOW ms, averaged with more weight on the most recent ones. Zero when the finger
 * rested before lifting. (Taking it from two raw samples made the release decision noisy.)
 */
export function releaseVelocity(samples: { x: number; t: number }[], now: number): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (now - last.t > REST_MS) return 0;
  let sum = 0;
  let weight = 0;
  for (let i = samples.length - 1; i > 0; i--) {
    const a = samples[i - 1];
    const b = samples[i];
    if (last.t - b.t > VELOCITY_WINDOW) break;
    const dt = b.t - a.t;
    if (dt <= 0) continue;
    const w = dt * Math.exp(-(last.t - b.t) / 48);
    sum += ((b.x - a.x) / dt) * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : 0;
}

export class FlipEngine {
  readonly mode: FlipMode;
  readonly pageCount: number;

  private readonly opts: FlipEngineOptions;
  private readonly block: HTMLDivElement;
  private readonly pf: PageFlip;
  private readonly render: LibRender;
  private readonly flip: LibFlip;
  private readonly ui: LibUI;
  private readonly libPages: LibPage[];
  /** Offset between a `pages` index and the library's item index. */
  private readonly lead: number;
  private readonly extras: HTMLElement[] = [];
  /** The library's page container (.stf__block). */
  private readonly sheetBox: HTMLElement;
  /**
   * Drop shadow of the sheet in the air. The library clips the turning sheet with clip-path, which
   * would also clip a shadow set on the sheet itself. So a plain "twin" copies the sheet's outline
   * every frame, sits just under it, and is blurred by its holder ("lift").
   */
  private readonly lift: HTMLDivElement;
  private readonly twin: HTMLDivElement;
  private lifted: HTMLElement | null = null;
  /** Fold shadows: on the turning sheet ("curl") and on the page beneath it ("cast"). */
  private readonly curl: HTMLDivElement;
  private readonly cast: HTMLDivElement;
  private readonly castBox: HTMLDivElement;
  private castKey = "";
  /** Neighbouring pages kept painted, so a flip never waits for a first paint. */
  private warm: HTMLElement[] = [];
  private warmTimer = 0;
  /** Single-page mode: the sheet of paper shown as the back of a page turning forward. */
  private backLeaf: HTMLElement | null = null;

  private pageWidth: number;
  private pageHeight: number;
  private reduced: boolean;
  private dead = false;
  private raf = 0;
  private dirty = 0;
  private lastTick = 0;
  private drag: DragState | null = null;
  private swallowClick = false;
  private releaseEase = false;
  private hovering = false;
  private page: number;
  /** Duration multiplier for programmatic flips; below 1 while riffling. */
  private tempo = 1;
  /** Flips still to start in the riffle under way, and their direction. */
  private riffle: { left: number; dir: 1 | -1 } | null = null;
  private riffleDue = false;
  private prewarmed = false;
  private resisting = false;
  /** Last page handed to onFlip. */
  private reported: number;

  constructor(opts: FlipEngineOptions) {
    this.opts = opts;
    this.mode = opts.mode;
    this.pageCount = opts.hosts.length;
    this.pageWidth = Math.floor(opts.pageWidth);
    this.pageHeight = Math.floor(opts.pageHeight);
    this.reduced = opts.reducedMotion;
    this.page = clamp(opts.startPage, 0, Math.max(0, this.pageCount - 1));
    this.reported = this.page;

    const double = this.mode === "double";
    this.lead = double && opts.firstPageSide === "right" ? 1 : 0;

    /* Items handed to the library. In a spread the list is padded so no page is left alone:
       a lone item would be treated as a rigid board. Void items are transparent and let the
       inside of the cover show through. */
    const items: HTMLElement[] = [];
    if (this.lead) items.push(this.extra("ipb-leaf ipb-leaf--void"));
    for (const host of opts.hosts) items.push(host);
    if (double && items.length % 2 === 1) items.push(this.extra("ipb-leaf ipb-leaf--void"));

    this.block = el("ipb__flip");
    this.block.dataset.mode = this.mode;
    this.sizeBlock();
    opts.mount.appendChild(this.block);

    this.pf = new opts.PageFlip(this.block, {
      width: this.pageWidth,
      height: this.pageHeight,
      size: "fixed",
      usePortrait: !double,
      autoSize: false,
      startPage: this.page + this.lead,
      startZIndex: 0,
      drawShadow: true,
      maxShadowOpacity: 1,
      showCover: false,
      flippingTime: FLIP_MS[this.mode],
      useMouseEvents: false,
      mobileScrollSupport: true,
      showPageCorners: true,
      disableFlipByClick: false,
    });

    /* The library starts an endless requestAnimationFrame loop inside loadFromHTML(). Swallow
       that one request so the engine can drive rendering itself (see tick()). */
    const nativeRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
    try {
      this.pf.loadFromHTML(items);
    } finally {
      window.requestAnimationFrame = nativeRaf;
    }
    this.sizeBlock();

    this.render = this.pf.getRender() as LibRender;
    this.flip = this.pf.getFlipController() as LibFlip;
    this.ui = this.pf.getUI() as LibUI;
    this.libPages = (this.pf.getPageCollection() as LibCollection).getPages();

    // Resizing is driven by the owner (ResizeObserver); drop the library's window listener.
    this.ui.removeHandlers();

    this.sheetBox = this.block.querySelector<HTMLElement>(".stf__block") ?? this.block;
    this.lift = this.extra("ipb__lift");
    this.twin = this.extra("ipb__lift-twin");
    this.lift.appendChild(this.twin);
    this.lift.style.cssText = "display: none";
    this.sheetBox.appendChild(this.lift);
    if (opts.gutter) this.sheetBox.appendChild(this.extra("ipb__gutter"));

    this.castBox = this.extra("ipb__cast-box");
    this.cast = this.extra("ipb__fold ipb__fold--cast");
    this.curl = this.extra("ipb__fold ipb__fold--curl");
    this.castBox.appendChild(this.cast);
    this.sheetBox.appendChild(this.castBox);

    this.patchAnimation();
    this.patchFrame();
    this.patchRestingPages();
    if (!double) this.patchPaperBack();

    this.pf.on("flip", (e) => {
      if (this.dead) return;
      const page = this.fromLib(Number(e.data));
      this.wake();
      this.page = page;
      // A riffle reports only the page it ends on.
      if (!this.riffle || this.riffle.left === 0) this.report();
    });
    this.pf.on("changeState", (e) => {
      if (this.dead) return;
      this.block.dataset.state = String(e.data);
      this.wake();
      this.opts.onState?.(e.data as EngineState);
    });
    this.pf.on("init", () => this.wake());

    const m = opts.mount;
    m.addEventListener("pointerdown", this.onPointerDown);
    m.addEventListener("pointermove", this.onPointerMove);
    m.addEventListener("pointerup", this.onPointerUp);
    m.addEventListener("pointercancel", this.onPointerCancel);
    m.addEventListener("pointerleave", this.onPointerLeave);
    m.addEventListener("click", this.onClickCapture, true);

    this.block.dataset.state = "read";
    this.wake(3);
  }

  /* ---------------------------- public ---------------------------- */

  get currentPage(): number {
    return this.page;
  }

  get state(): EngineState {
    return this.flip.getState();
  }

  /** True while a page is in the air (drag, flip animation or corner peel). */
  get busy(): boolean {
    return this.render.animation !== null || this.flip.getState() !== "read" || !!this.drag?.active;
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
  }

  /** Finish whatever is in the air right now (a held page falls where it was heading). */
  settle(): void {
    if (this.dead) return;
    this.drag = null;
    this.render.finishAnimation();
    if (this.flip.getState() !== "read") {
      // A page held by the finger or a lifted corner, with no animation to finish: put it back.
      this.render.setBottomPage(null);
      this.render.setFlippingPage(null);
      this.render.clearShadow();
      this.flip.setState("read");
      this.flip.reset();
    }
    this.render.render(performance.now());
  }

  /** In a spread: the host currently shown left of the spine, if there is one. */
  leftHost(): HTMLElement | null {
    if (this.dead || this.mode !== "double") return null;
    const element = this.libPages[this.libIndex()]?.element ?? null;
    return element && this.opts.hosts.includes(element) ? element : null;
  }

  next(): void {
    if (this.dead) return;
    if (this.atEnd()) {
      this.opts.onEdge?.("next");
      return;
    }
    if (this.reduced) {
      this.jump(1);
      return;
    }
    this.cancelDrag();
    this.endRiffle();
    this.pf.flipNext("bottom");
    this.wake();
  }

  prev(): void {
    if (this.dead) return;
    if (this.atStart()) {
      this.opts.onEdge?.("prev");
      return;
    }
    if (this.reduced) {
      this.jump(-1);
      return;
    }
    this.cancelDrag();
    this.endRiffle();
    this.pf.flipPrev("bottom");
    this.wake();
  }

  /** Turn to a page with one flip. */
  flipTo(page: number): void {
    if (this.dead) return;
    const target = clamp(Math.round(page), 0, this.pageCount - 1);
    if (this.reduced) {
      this.turnTo(target, true);
      return;
    }
    this.cancelDrag();
    this.endRiffle();
    this.render.finishAnimation();
    this.pf.flip(target + this.lead, "bottom");
    this.wake();
  }

  /**
   * Turn to a page the way a hand does: up to four pages are thumbed through one after another,
   * quicker the more there are (RIFFLE_MS at most in total). Further than that it is one flip.
   * onFlip fires once, when the last page lands.
   */
  flipThrough(page: number): void {
    if (this.dead) return;
    const target = clamp(Math.round(page), 0, this.pageCount - 1);
    const step = this.mode === "double" ? 2 : 1;
    const from = Math.floor(this.libIndex() / step);
    const to = Math.floor((target + this.lead) / step);
    const count = Math.abs(to - from);
    if (this.reduced || count < 2 || count > 4) {
      this.flipTo(target);
      return;
    }
    this.cancelDrag();
    this.render.finishAnimation();
    this.riffle = { left: count, dir: to > from ? 1 : -1 };
    this.tempo = clamp(RIFFLE_MS / (count * FLIP_MS[this.mode]), 0.3, 1);
    this.stepRiffle();
  }

  /** The last page has nothing behind it: lift its fore edge a little and let it fall back. */
  nudge(): void {
    if (this.dead || this.reduced || this.busy || typeof this.block.animate !== "function") return;
    const lifted = this.resistPose(0.7);
    this.block.animate(
      [{ transform: this.resistPose(0) }, { transform: lifted, offset: 0.4 }, { transform: this.resistPose(0) }],
      { duration: 420, easing: "cubic-bezier(.3,.6,.3,1)" },
    );
  }

  /** Show a page without a flip. */
  turnTo(page: number, fade = false): void {
    if (this.dead) return;
    const target = clamp(Math.round(page), 0, this.pageCount - 1);
    this.cancelDrag();
    this.endRiffle();
    this.render.finishAnimation();
    this.pf.turnToPage(target + this.lead);
    this.wake(3);
    if (fade) this.fade();
  }

  /**
   * Lift the lower outer corner and let it fall back: a hint that the pages turn.
   * Does nothing while a page is moving, on the last page, or with reduced motion.
   */
  peek(): void {
    if (this.dead || this.reduced || this.busy || this.atEnd()) return;
    const rect = this.render.getRect();
    const w = rect.pageWidth;
    const h = rect.height;
    if (!this.flip.start({ x: rect.left + rect.width - 4, y: rect.top + h - 4 })) return;
    this.flip.setState("flipping");

    const rest = { x: w - 1, y: h - 1 };
    const lifted = { x: w - w * 0.3, y: h - w * 0.2 };
    const up = 300;
    const hold = 160;
    const down = 420;
    const total = up + hold + down;
    const n = Math.ceil(total / 8);
    const frames: (() => void)[] = [];
    for (let i = 0; i < n; i++) {
      const ms = (i / (n - 1)) * total;
      let k: number;
      if (ms < up) k = EASE_OUT(ms / up);
      else if (ms < up + hold) k = 1;
      else k = 1 - EASE_TURN((ms - up - hold) / down);
      const p = { x: rest.x + (lifted.x - rest.x) * k, y: rest.y + (lifted.y - rest.y) * k };
      frames.push(() => this.flip.do(p));
    }
    this.startAnimation(frames, total, () => this.endFlip(false, true));
  }

  resize(pageWidth: number, pageHeight: number): void {
    if (this.dead) return;
    const w = Math.floor(pageWidth);
    const h = Math.floor(pageHeight);
    if (w === this.pageWidth && h === this.pageHeight) return;
    this.cancelDrag();
    this.render.finishAnimation();
    this.pageWidth = w;
    this.pageHeight = h;
    const s = this.pf.getSettings();
    s.width = s.minWidth = s.maxWidth = w;
    s.height = s.minHeight = s.maxHeight = h;
    this.sizeBlock();
    this.pf.update();
    this.wake(3);
  }

  destroy(): void {
    if (this.dead) return;
    const m = this.opts.mount;
    m.removeEventListener("pointerdown", this.onPointerDown);
    m.removeEventListener("pointermove", this.onPointerMove);
    m.removeEventListener("pointerup", this.onPointerUp);
    m.removeEventListener("pointercancel", this.onPointerCancel);
    m.removeEventListener("pointerleave", this.onPointerLeave);
    m.removeEventListener("click", this.onClickCapture, true);

    this.drag = null;
    try {
      this.render.finishAnimation();
    } catch {
      /* A half-set-up flip has nothing to finish. */
    }
    this.dead = true;
    this.riffle = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.coolDown();

    for (const page of this.libPages) {
      try {
        page.hideTemporaryCopy();
      } catch {
        /* nothing to remove */
      }
    }
    this.lifted = null;
    // Hand the page hosts back before the library removes its own DOM.
    for (const host of this.opts.hosts) {
      host.style.cssText = "";
      host.classList.remove("stf__item", "--soft", "--hard", "--left", "--right", "--simple");
      m.appendChild(host);
    }
    for (const extra of this.extras) extra.remove();
    try {
      this.pf.destroy();
    } catch {
      this.block.remove();
    }
  }

  /* --------------------------- internals --------------------------- */

  private extra(className: string, html = ""): HTMLDivElement {
    const node = el(className, html);
    node.setAttribute("aria-hidden", "true");
    this.extras.push(node);
    return node;
  }

  private sizeBlock(): void {
    const w = this.pageWidth * (this.mode === "double" ? 2 : 1);
    const s = this.block.style;
    s.width = s.minWidth = `${w}px`;
    s.height = s.minHeight = `${this.pageHeight}px`;
  }

  private fromLib(index: number): number {
    return clamp(index - this.lead, 0, Math.max(0, this.pageCount - 1));
  }

  private libIndex(): number {
    return this.pf.getCurrentPageIndex();
  }

  private atStart(): boolean {
    return this.libIndex() < 1;
  }

  private atEnd(): boolean {
    const step = this.mode === "double" ? 2 : 1;
    return this.libIndex() + step >= this.pf.getPageCount();
  }

  private jump(delta: number): void {
    const step = this.mode === "double" ? 2 : 1;
    const index = clamp(this.libIndex() + delta * step, 0, this.pf.getPageCount() - 1);
    this.render.finishAnimation();
    this.pf.turnToPage(index);
    this.wake(3);
    this.fade();
  }

  private fade(): void {
    if (typeof this.block.animate !== "function") return;
    this.block.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
  }

  /* ---- warm pages ---- */

  /*
   * A page that has never been shown has to be styled, laid out and painted before it can appear
   * (stamps and their ink filters included). On a phone that is long enough to hold up the first
   * frames of a flip. So once the book is at rest, the pages a flip in either direction would
   * bring in are laid out directly underneath a resting page, where they get painted but cannot
   * be seen or touched.
   *
   * Two things keep that paint valid when the flip starts. The warm page is styled with the same
   * properties the library uses for a turning page (see restingStyle), and nothing that changes
   * its style is toggled at that moment. That is why `inert` is not switched when a page starts
   * to turn: every page except the ones lying open in front is inert all the time, and the set is
   * updated here, at rest.
   */
  private warmUp = (): void => {
    this.warmTimer = 0;
    if (this.dead || this.busy || this.raf) return;
    if (!this.prewarmed) {
      // Comes back here when the dry run has finished.
      this.prewarmed = true;
      if (this.prewarm()) return;
    }
    const double = this.mode === "double";
    const index = this.libIndex();
    const isHost = (element: HTMLElement | undefined): element is HTMLElement =>
      !!element && this.opts.hosts.includes(element);

    // Live pages: the one or two lying open.
    const front = double ? [index, index + 1] : [index];
    const live = front.map((i) => this.libPages[i]?.element).filter(isHost);
    for (const host of this.opts.hosts) {
      const on = live.includes(host);
      if (host.inert === on) host.inert = !on;
      if (on) host.removeAttribute("aria-hidden");
      else host.setAttribute("aria-hidden", "true");
    }

    // Warm pages: under the right-hand page when there is one, otherwise under the left.
    const rect = this.render.getRect();
    const rightIsPage = isHost(this.libPages[double ? index + 1 : index]?.element);
    const x = rightIsPage || !double ? rect.left + rect.pageWidth : rect.left;
    const around = double ? [index + 2, index + 3, index - 2, index - 1] : [index + 1, index - 1];
    const next: HTMLElement[] = [];
    for (const i of around) {
      const element = this.libPages[i]?.element;
      if (!isHost(element)) continue;
      if (double) {
        // The side it will land on, so its corners are already rounded the right way.
        element.classList.toggle("--left", i % 2 === 0);
        element.classList.toggle("--right", i % 2 === 1);
      }
      // Drawn slightly smaller than the page above it, so nothing shows at the rounded corners.
      element.style.cssText = restingStyle(x, rect.top, rect.pageWidth, rect.height, 0, WARM_INSET);
      next.push(element);
    }
    if (this.backLeaf && !this.atEnd()) {
      this.backLeaf.style.cssText = restingStyle(x, rect.top, rect.pageWidth, rect.height, 0, WARM_INSET);
      next.push(this.backLeaf);
    }
    for (const element of this.warm) if (!next.includes(element)) element.style.cssText = "display: none";
    this.warm = next;
  };

  /**
   * The first flip after loading used to pay for everything at once: the library's flip code
   * running cold, the reusable back sheet and the fold shadows being laid out and rasterised for
   * the first time. Run one flip that goes nowhere (the corner is held a pixel off the page for a
   * few frames) while the book is idle, so the first real one finds all of that in place.
   */
  private prewarm(): boolean {
    if (this.reduced || this.atEnd()) return false;
    const rect = this.render.getRect();
    const w = rect.pageWidth;
    const h = rect.height;
    if (!this.flip.start({ x: rect.left + rect.width - 4, y: rect.top + h - 4 })) return false;
    this.flip.setState("flipping");
    const p = { x: w - 1.5, y: h - 1.5 };
    const frames: (() => void)[] = [];
    for (let i = 0; i < 8; i++) frames.push(() => this.flip.do(p));
    this.startAnimation(frames, 64, () => this.endFlip(false, true));
    return true;
  }

  /** Hand the warm pages back to the library, which restyles every page on its next frame. */
  private coolDown(): void {
    if (this.warmTimer) window.clearTimeout(this.warmTimer);
    this.warmTimer = 0;
    this.warm = [];
  }

  /* ---- render loop ---- */

  /** Draw for at least `frames` frames, and for as long as something is moving. */
  private wake(frames = 2): void {
    this.dirty = Math.max(this.dirty, frames);
    if (this.raf || this.dead) return;
    // The library is about to restyle pages; hand the warm ones back to it first.
    this.coolDown();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (time: number): void => {
    this.raf = 0;
    if (this.dead) return;

    const drag = this.drag;
    if (drag?.active) {
      // Ease towards the finger: hides touch jitter and the first jump, costs under a frame of lag.
      const dt = this.lastTick ? Math.min(64, time - this.lastTick) : 16;
      const k = 1 - Math.exp(-dt / 38);
      drag.current.x += (drag.target.x - drag.current.x) * k;
      drag.current.y += (drag.target.y - drag.current.y) * k;
      this.flip.do({ x: drag.current.x, y: drag.current.y });
    }
    this.lastTick = time;

    // An animation started from an input handler may carry a start time just after this frame's.
    const anim = this.render.animation;
    this.render.render(anim ? Math.max(time, anim.startedAt) : time);

    // The next page of a riffle starts here, not in the library's end-of-animation callback
    // (the library clears its animation slot right after that callback returns).
    if (this.riffleDue) {
      this.riffleDue = false;
      this.stepRiffle();
    }

    if (this.dirty > 0) this.dirty--;
    // wake() may already have asked for the next frame from inside render().
    if (this.raf) return;
    if (this.busy || this.dirty > 0) this.raf = requestAnimationFrame(this.tick);
    else {
      this.lastTick = 0;
      this.warmTimer = window.setTimeout(this.warmUp, 90);
    }
  };

  private stepRiffle(): void {
    const r = this.riffle;
    if (!r || this.dead) return;
    if (r.left <= 0 || (r.dir === 1 ? this.atEnd() : this.atStart())) {
      this.endRiffle();
      return;
    }
    r.left--;
    if (r.dir === 1) this.pf.flipNext("bottom");
    else this.pf.flipPrev("bottom");
    this.wake();
  }

  private endRiffle(): void {
    if (!this.riffle) return;
    this.riffle = null;
    this.riffleDue = false;
    this.tempo = 1;
    this.report();
  }

  private report(): void {
    if (this.page === this.reported || this.dead) return;
    this.reported = this.page;
    this.opts.onFlip(this.page);
  }

  private startAnimation(frames: (() => void)[], duration: number, onEnd: () => void): void {
    // The library stamps animations with the time of its last frame. After an idle spell that
    // time is stale and the animation would start half-way through.
    this.render.finishAnimation();
    this.render.timer = performance.now();
    this.render.startAnimation(frames, duration, onEnd);
    this.wake();
  }

  private endFlip(isTurned: boolean, needReset: boolean): void {
    const calc = this.flip.calc;
    if (!calc) return;
    if (isTurned) {
      if (calc.getDirection() === BACK) this.pf.turnToPrevPage();
      else this.pf.turnToNextPage();
    }
    if (needReset) {
      this.render.setBottomPage(null);
      this.render.setFlippingPage(null);
      this.render.clearShadow();
      this.flip.setState("read");
      this.flip.reset();
    }
    if (this.riffle) {
      if (isTurned && this.riffle.left > 0) this.riffleDue = true;
      else this.endRiffle();
    }
    this.wake(3);
  }

  /* ---- patches ---- */

  /** Replace the library's constant-speed, straight-line flip with an eased arc. */
  private patchAnimation(): void {
    const flip = this.flip;
    flip.animateFlippingTo = (start, dest, isTurned, needReset = true) => {
      const release = this.releaseEase;
      this.releaseEase = false;

      const w = this.render.getRect().pageWidth;
      const h = this.render.getRect().height;
      const bottom = flip.calc?.getCorner() === "bottom";
      const back = flip.calc?.getDirection() === BACK;
      /* One page at a time, turning back: the returning page is drawn as a flat sheet coming in
         over the spine, and any tilt makes it look loose. The library starts whole flips a tenth
         of the page height in from the corner (about 15 degrees of tilt); start nearer the corner. */
      const flatBack = this.mode === "single" && back && needReset && !release;
      if (flatBack) start = { x: start.x, y: bottom ? h - h * 0.014 : h * 0.014 };
      const dx = dest.x - start.x;
      const dy = dest.y - start.y;
      const share = clamp(Math.hypot(dx, dy) / (2 * w), 0, 1);
      const full = FLIP_MS[this.mode];

      let duration: number;
      let ease: (t: number) => number;
      let lift = 0;
      if (!needReset) {
        // Corner peel under a hovering mouse.
        duration = 240;
        ease = EASE_OUT;
      } else if (release) {
        duration = clamp(full * (0.3 + 0.62 * share), 220, full);
        ease = EASE_RELEASE;
      } else {
        duration = clamp(full * (0.42 + 0.58 * share), 260, full) * this.tempo;
        ease = this.riffle ? EASE_RIFFLE : share > 0.6 ? EASE_TURN : EASE_OUT;
        // Whole flips bow towards the middle of the page, so the fold line swings as it travels.
        if (share > 0.6) lift = h * (flatBack ? 0.02 : this.riffle ? 0.07 : 0.1);
      }

      if (isTurned) {
        const step = this.mode === "double" ? 2 : 1;
        this.opts.onFlipStart?.(this.fromLib(this.libIndex() + (back ? -step : step)));
      }

      const n = Math.max(2, Math.ceil(duration / 8));
      const frames: (() => void)[] = [];
      for (let i = 0; i < n; i++) {
        const e = ease(i / (n - 1));
        const bow = lift * Math.sin(Math.PI * e) * (bottom ? -1 : 1);
        const p = { x: start.x + dx * e, y: start.y + dy * e + bow };
        frames.push(() => flip.do(p));
      }
      this.startAnimation(frames, duration, () => this.endFlip(isTurned, needReset));
    };
  }

  /**
   * Everything the engine adds to a frame the library has just drawn: the drop shadow under the
   * sheet in the air and the two fold shadows.
   *
   * The library draws its fold shadows as two large divs whose size, gradient and clip-path all
   * change every frame, so each frame repaints them and builds two extra masks. Here they are two
   * fixed strips that only ever change transform and opacity (compositor work, no repaint):
   *  - "curl" lives inside the turning sheet, so the sheet's own clip trims it;
   *  - "cast" lives in a box the size of the page it falls on, so a plain rectangle trims it.
   */
  private patchFrame(): void {
    const render = this.render;
    render.drawOuterShadow = () => {};
    render.drawInnerShadow = () => {};
    render.outerShadow.style.cssText = "display: none";
    render.innerShadow.style.cssText = "display: none";

    const draw = render.drawFrame.bind(render);
    render.drawFrame = () => {
      draw();

      const flap = render.flippingPage?.element ?? null;
      if (flap !== this.lifted) {
        this.curl.remove();
        this.lifted = flap;
        if (flap) flap.appendChild(this.curl);
        else {
          this.lift.style.cssText = "display: none";
          this.cast.style.opacity = "0";
        }
      }
      if (!flap) return;

      const shadow = render.shadow;
      const progress = shadow ? clamp(shadow.progress / 200, 0, 1) : 0;
      // Strongest at mid-turn, nothing on the page it lifts from or lands on.
      const height = Math.sin(Math.PI * progress);
      if (height < 0.02) this.lift.style.cssText = "display: none";
      else {
        // The twin takes the sheet's outline (same box, transform and clip) one level below it.
        const fs = flap.style;
        const clip = fs.clipPath || fs.getPropertyValue("-webkit-clip-path");
        this.twin.style.cssText =
          `width:${fs.width};height:${fs.height};transform:${fs.transform};` +
          `clip-path:${clip};-webkit-clip-path:${clip};`;
        // A sheet coming back flat over the page (single view) has only this shadow to lift it.
        const depth = this.mode === "single" && render.getDirection() === BACK ? 0.62 : 0.42;
        this.lift.style.cssText =
          `opacity:${(depth * height).toFixed(3)};` +
          `filter:blur(${(2.5 + 7 * height).toFixed(1)}px);` +
          `transform:translate3d(0,${(4 * height).toFixed(1)}px,0);`;
      }

      this.shadeFold(shadow);
    };
  }

  private shadeFold(shadow: LibShadow | null): void {
    const render = this.render;
    const page = render.flippingPage;
    const pr = render.pageRect;
    const state = page?.state;
    if (!shadow || !pr || !state) {
      this.cast.style.opacity = "0";
      this.curl.style.opacity = "0";
      return;
    }
    // The clip area of the sheet is its two outer corners plus the points where its edges cross
    // the page edges. Those crossing points lie on the fold.
    const area = state.area.filter((p): p is Point => !!p);
    const onFold = area.filter((p) => p !== pr.topLeft && p !== pr.bottomLeft);
    if (area.length < 3 || onFold.length < 2) {
      this.cast.style.opacity = "0";
      this.curl.style.opacity = "0";
      return;
    }
    const a = onFold[0];
    const b = onFold[onFold.length - 1];
    const back = render.getDirection() === BACK;
    const rect = render.getRect();
    if (back && this.mode === "single") {
      /* One page at a time, turning back: the fold is off the left of the screen, so the usual
         shading would not be seen. The returning sheet is given a bow instead: the curl shading
         runs in from its leading (fore) edge, strongest while it is highest in the air. */
      const w = rect.pageWidth;
      const h = rect.height;
      const air = Math.sin(Math.PI * clamp(shadow.progress / 200, 0, 1));
      placeStrip(this.curl, { x: w, y: 0 }, { x: w, y: h }, { x: w / 2, y: h / 2 }, true, w * 0.5, clamp(air * 1.25, 0, 1));
      this.cast.style.opacity = "0";
      return;
    }
    // The library fades shadows linearly over the whole flip. Hold them through the middle.
    const strength = clamp(shadow.opacity * 1.7, 0, 1);

    // Curl: in the sheet's own coordinates (the same mapping the library uses for its clip-path).
    const cos = Math.cos(state.angle);
    const sin = Math.sin(state.angle);
    const local = (p: Point): Point => {
      const x = back ? -p.x + state.position.x : p.x - state.position.x;
      const y = p.y - state.position.y;
      return { x: x * cos + y * sin, y: y * cos - x * sin };
    };
    const inside = area.reduce(
      (acc, p) => {
        const q = local(p);
        return { x: acc.x + q.x / area.length, y: acc.y + q.y / area.length };
      },
      { x: 0, y: 0 },
    );
    placeStrip(this.curl, local(a), local(b), inside, true, (shadow.width * 3) / 4 + 4, strength);

    // Cast: on the page under the fold, in the coordinates of a box that covers that page.
    const boxLeft = back ? rect.left : rect.left + rect.pageWidth;
    if (this.castKey !== `${back}:${boxLeft}:${rect.pageWidth}:${rect.height}`) {
      this.castKey = `${back}:${boxLeft}:${rect.pageWidth}:${rect.height}`;
      this.castBox.style.cssText = `left:${boxLeft}px;top:${rect.top}px;width:${rect.pageWidth}px;height:${rect.height}px`;
      this.castBox.dataset.side = back ? "left" : "right";
    }
    const global = (p: Point): Point => {
      const g = render.convertToGlobal(p);
      return { x: g.x - boxLeft, y: g.y - rect.top };
    };
    const flapSide = area.reduce(
      (acc, p) => {
        const q = global(p);
        return { x: acc.x + q.x / area.length, y: acc.y + q.y / area.length };
      },
      { x: 0, y: 0 },
    );
    placeStrip(this.cast, global(a), global(b), flapSide, false, shadow.width * 1.15 + 6, strength);
  }

  /**
   * The library positions a resting page with left/top and a turning one with transform and
   * clip-path. Switching between the two changes how the browser composites the page, and it
   * repaints the whole page at the first and the last frame of every flip. Resting pages are
   * therefore styled the same way as turning ones (a transform and a clip that covers the whole
   * page), so a flip only ever changes values.
   */
  private patchRestingPages(): void {
    for (const page of this.libPages) {
      page.simpleDraw = (orient: number): void => {
        const rect = this.render.getRect();
        const x = orient === RIGHT ? rect.left + rect.pageWidth : rect.left;
        page.element.classList.add("--simple");
        page.element.style.cssText = restingStyle(x, rect.top, rect.pageWidth, rect.height, 1);
      };
    }
  }

  /**
   * Single-page mode only. The library shows the back of a turning page as a deep clone of the
   * page itself, made at the start of every flip. Draw a sheet of paper instead.
   */
  private patchPaperBack(): void {
    const render = this.render;
    const PageClass = this.libPages[0]?.constructor as LibPageCtor | undefined;
    if (!PageClass) return;
    // One sheet, reused for every flip and kept painted in between (see warmUp).
    const back = this.extra("ipb-leaf ipb-leaf--back", '<div class="ipb-page ipb-page--back mat-paper"></div>');
    back.style.cssText = "display: none";
    this.sheetBox.appendChild(back);
    const backPage = new PageClass(render, back, "soft");
    this.backLeaf = back;

    for (const page of this.libPages) {
      page.newTemporaryCopy = function (this: LibPage): LibPage {
        if (this.nowDrawingDensity === "hard") return this;
        this.temporaryCopy = backPage;
        this.copiedElement = back;
        return backPage;
      };
      page.hideTemporaryCopy = function (this: LibPage): void {
        if (this.temporaryCopy === null) return;
        this.temporaryCopy = null;
        this.copiedElement = null;
        if (render.flippingPage !== backPage) back.style.cssText = "display: none";
      };
    }
  }

  /* ---- pointer input ---- */

  /** Pointer position in the library's coordinates (relative to the book block). */
  private local(e: PointerEvent, drag?: DragState): Point {
    if (drag) return { x: e.clientX - drag.originLeft, y: e.clientY - drag.originTop };
    const r = this.block.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.dead || this.drag) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!e.isPrimary) return;
    const target = e.target as Element | null;
    if (target?.closest?.("[data-no-flip]")) return;

    const r = this.block.getBoundingClientRect();
    this.swallowClick = false;
    this.drag = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: r.left,
      originTop: r.top,
      active: false,
      dead: false,
      edge: null,
      direction: FORWARD,
      corner: "bottom",
      from: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      current: { x: 0, y: 0 },
      samples: [{ x: e.clientX, t: e.timeStamp }],
      interactive: !!target?.closest?.(INTERACTIVE),
    };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dead) return;
    const drag = this.drag;

    if (!drag) {
      // Desktop nicety: the corner lifts under the mouse.
      if (e.pointerType === "mouse" && e.buttons === 0 && !this.reduced) {
        const state = this.flip.getState();
        if (state === "read" || state === "fold_corner") {
          this.hovering = true;
          this.flip.showCorner(this.local(e));
          if (this.flip.getState() !== "read" || this.render.animation) this.wake();
        }
      }
      return;
    }
    if (e.pointerId !== drag.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (drag.edge === "next" && !this.reduced) {
      // Nothing behind the last page: its fore edge lifts against the pull and goes no further.
      this.resist(clamp(-dx / (this.pageWidth * 0.55), 0, 1));
      return;
    }
    if (drag.dead) return;
    drag.samples.push({ x: e.clientX, t: e.timeStamp });
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > VELOCITY_WINDOW + 60) drag.samples.shift();

    if (!drag.active) {
      const slop = drag.pointerType === "mouse" ? SLOP.mouse : SLOP.touch;
      if (Math.hypot(dx, dy) < slop) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.15) {
        drag.dead = true; // a vertical gesture: leave it to the page scroll
        return;
      }
      if (this.reduced) return; // decided on release, as a swipe
      const direction: Direction = dx < 0 ? FORWARD : BACK;
      if (direction === FORWARD ? this.atEnd() : this.atStart()) {
        drag.edge = direction === FORWARD ? "next" : "prev"; // nothing to turn; decided on release
        drag.dead = true;
        if (drag.edge === "next") {
          try {
            this.opts.mount.setPointerCapture(e.pointerId);
          } catch {
            /* optional */
          }
        }
        return;
      }
      if (!this.beginDrag(drag, direction)) {
        drag.dead = true;
        return;
      }
      try {
        this.opts.mount.setPointerCapture(e.pointerId);
      } catch {
        /* Capture is a nicety; the drag works without it while the pointer stays over the book. */
      }
    }

    const w = this.pageWidth;
    const h = this.pageHeight;
    const travel = drag.direction === FORWARD ? dx : -dx;
    const x = clamp(drag.from.x + travel * DRAG_GAIN, -w, w - 1);
    // A sideways drag still peels a little on the diagonal; pulling towards the page adds more.
    // A page coming back in single-page view is a flat sheet, so it gets much less of both.
    const flat = this.mode === "single" && drag.direction === BACK;
    const peel = Math.abs(travel) * (flat ? 0.02 : 0.07);
    const follow = flat ? 0.25 : 0.85;
    const y =
      drag.corner === "top"
        ? clamp(drag.from.y + Math.max(0, dy) * follow + peel, 1, h * 0.72)
        : clamp(drag.from.y + Math.min(0, dy) * follow - peel, h * 0.28, h - 1);
    drag.target.x = x;
    drag.target.y = y;
    this.wake();
  };

  /** Pose of the page block while the last page is pulled: `k` runs from 0 (flat) to 1. */
  private resistPose(k: number): string {
    const eased = 1 - (1 - k) * (1 - k);
    return `perspective(${Math.round(this.pageWidth * 4.6)}px) rotateY(${(-9 * eased).toFixed(2)}deg)`;
  }

  private resist(k: number): void {
    const style = this.block.style;
    if (!this.resisting) {
      this.resisting = true;
      style.transformOrigin = "0 50%";
      style.willChange = "transform";
    }
    style.transform = this.resistPose(k);
  }

  private relax(): void {
    if (!this.resisting) return;
    this.resisting = false;
    const style = this.block.style;
    const from = style.transform;
    style.transform = "";
    style.willChange = "";
    if (from && typeof this.block.animate === "function") {
      const done = () => (style.transformOrigin = "");
      const fall = this.block.animate([{ transform: from }, { transform: this.resistPose(0) }], {
        duration: 340,
        easing: "cubic-bezier(.3,1.5,.5,1)",
      });
      fall.onfinish = done;
      fall.oncancel = done;
    } else style.transformOrigin = "";
  }

  private beginDrag(drag: DragState, direction: Direction): boolean {
    this.endRiffle();
    const flip = this.flip;
    const rect = this.render.getRect();
    const w = rect.pageWidth;
    const h = rect.height;
    const localY = drag.startY - drag.originTop;

    // Keep a corner the mouse has already lifted, if it turns the same way.
    let from: Point | null = null;
    if (flip.calc && flip.getState() === "fold_corner" && flip.calc.getDirection() === direction) {
      this.render.finishAnimation();
      if (flip.calc) from = { ...flip.calc.getPosition() };
    }
    if (!from) {
      this.render.finishAnimation();
      const started = flip.start({
        x: direction === FORWARD ? rect.left + rect.width - 2 : rect.left + 2,
        y: rect.top + clamp(localY, 2, h - 2),
      });
      if (!started || !flip.calc) return false;
      const corner = flip.calc.getCorner();
      from = { x: w - 1, y: corner === "top" ? 1 : h - 1 };
    }
    if (!flip.calc) return false;

    drag.active = true;
    drag.direction = direction;
    drag.corner = flip.calc.getCorner();
    drag.from = from;
    drag.target = { ...from };
    drag.current = { ...from };
    this.hovering = false;
    flip.setState("user_fold");
    this.wake();
    return true;
  }

  private onPointerUp = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this.drag = null;
    if (this.dead) return;
    this.relax();
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.active) {
      this.swallowClick = true;
      window.setTimeout(() => (this.swallowClick = false), 400);
      const calc = this.flip.calc;
      if (!calc) return;
      const w = this.pageWidth;
      const h = this.pageHeight;
      // Speed and travel along the turn: positive means the page is being carried over.
      const sign = drag.direction === FORWARD ? -1 : 1;
      const v = releaseVelocity(drag.samples, e.timeStamp) * sign;
      const travel = (dx * sign) / w;
      const pos = calc.getPosition();
      // A flick decides it either way. Without one, a third of the page is far enough.
      const complete = v > FLICK || (v > -FLICK && travel >= COMMIT_TRAVEL);
      const y = drag.corner === "bottom" ? h : 0;
      this.releaseEase = true;
      this.flip.setState("flipping");
      this.flip.animateFlippingTo({ x: pos.x, y: pos.y }, { x: complete ? -w : w, y }, complete);
      return;
    }

    if (drag.edge) {
      const outwards = drag.edge === "next" ? dx < -36 : dx > 36;
      if (outwards && Math.abs(dx) > Math.abs(dy) * 1.15) {
        this.swallowClick = true;
        window.setTimeout(() => (this.swallowClick = false), 400);
        this.opts.onEdge?.(drag.edge);
      }
      return;
    }
    if (drag.dead || drag.interactive) return;
    const moved = Math.hypot(dx, dy);

    if (this.reduced) {
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        this.swallowClick = true;
        window.setTimeout(() => (this.swallowClick = false), 400);
        if (dx < 0) this.next();
        else this.prev();
        return;
      }
    }
    if (moved > (drag.pointerType === "mouse" ? SLOP.mouse : SLOP.touch)) return;

    // A tap or click in the outer part of a page turns it.
    const p = this.local(e);
    const total = this.pageWidth * (this.mode === "double" ? 2 : 1);
    const zone = this.pageWidth * EDGE_ZONE;
    const forward = p.x > total - zone;
    const backward = p.x < zone;
    if (!forward && !backward) return;
    if (p.y < 0 || p.y > this.pageHeight) return;
    if (forward ? this.atEnd() : this.atStart()) {
      this.opts.onEdge?.(forward ? "next" : "prev");
      return;
    }
    if (this.reduced) {
      this.jump(forward ? 1 : -1);
      return;
    }
    this.endRiffle();
    this.flip.flip(p);
    this.wake();
  };

  private onPointerCancel = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this.relax();
    this.cancelDrag();
  };

  private onPointerLeave = (e: PointerEvent): void => {
    if (this.dead || e.pointerType !== "mouse" || !this.hovering || this.drag) return;
    this.hovering = false;
    if (this.flip.getState() === "fold_corner") {
      this.flip.showCorner({ x: -9999, y: -9999 });
      this.wake();
    }
  };

  /** Let a held page fall back to where it came from. */
  private cancelDrag(): void {
    const drag = this.drag;
    this.drag = null;
    this.relax();
    if (!drag?.active || this.dead) return;
    const calc = this.flip.calc;
    if (!calc) return;
    const pos = calc.getPosition();
    this.releaseEase = true;
    this.flip.setState("flipping");
    this.flip.animateFlippingTo(
      { x: pos.x, y: pos.y },
      { x: this.pageWidth, y: drag.corner === "bottom" ? this.pageHeight : 0 },
      false,
    );
  }

  /** A drag must not also count as a click on whatever is under the finger when it ends. */
  private onClickCapture = (e: MouseEvent): void => {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };
}
