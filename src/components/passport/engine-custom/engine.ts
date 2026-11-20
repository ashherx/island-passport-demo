/**
 * The custom passport engine: an imperative controller that owns the turn physics, pointer
 * handling and every per-frame DOM write. React (PassportBook.tsx) renders the skeleton once and
 * hands the root element over; nothing here triggers a React render while a page is moving.
 *
 * Only `transform`, `opacity` and `visibility` are ever written during motion.
 *
 * How a page turn works
 * - At rest every page is a single real DOM node (so the host can animate stamps on it).
 * - When a turn starts, the page's DOM is snapshotted with cloneNode into STRIPS hinged strips
 *   (a pooled "leaf"). The strips form a chain posed by physics.ts, which is what bends the paper.
 * - When the leaf lands, the real node on the other stack is shown and the leaf is released.
 */
import { animate, cancelFrame, frame } from "motion/react";
import {
  BOARD_OVERHANG,
  PAGE_W,
  PERSPECTIVE,
  STRIPS,
  type BookLayout,
  type BookShape,
  leafDepth,
  pageForK,
  kForPage,
  rectoPage,
  versoPage,
} from "./layout";
import {
  RAD,
  type LeafGeometry,
  type LeafPose,
  type Tone,
  clamp,
  easeInOutSine,
  makeLeafGeometry,
  makePose,
  pointOnLeaf,
  poseLeaf,
  projectX,
  smoothstep,
  solveLeaf,
  solveRigid,
  toneBack,
  toneFront,
} from "./physics";

/* ------------------------------------------------------------------ */
/* Tuning                                                              */
/* ------------------------------------------------------------------ */

const COVER_W = PAGE_W + BOARD_OVERHANG;

// Paper leaf: a spring pulls the leaf to its stack, the curl is a second spring.
const PAGE_K = 38;
const PAGE_ZETA = 0.86;
const BEND_MAX = 46;
const BEND_DRAG = 34;
const BEND_LAG = 0.046; // seconds: curl per unit of angular speed (the free edge trails)
const BEND_K = 430;
const BEND_ZETA = 0.5;
const PAGE_PAD_EXTRA = 6;

// Cover: heavier, eased in, lands with a small overshoot.
const COVER_FOLLOW_K = 420;
const COVER_FOLLOW_ZETA = 0.62;
const COVER_FREE_K = 95;
const COVER_FREE_ZETA = 0.78;
const COVER_DURATION = 0.6;

const SHADE_PAPER = 0.5;
const GLOSS_PAPER = 0.2;
const SHADE_COVER = 0.46;

const DRAG_SLOP = 8;
const TAP_SLOP = 8;
const FLICK_SPEED = 380; // design px per second

const NO_FLIP_SELECTOR = "a,button,input,select,textarea,[role='button'],[data-pb-no-flip]";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EngineCallbacks {
  /** A turn was decided (the page is on its way). */
  onFlipStart?(page: number): void;
  /** Everything has landed. */
  onFlip?(page: number): void;
  onOpenChange?(open: boolean): void;
  /** Ask React to mount the sheets for these leaves. Called before they are needed. */
  ensureMounted?(leafLo: number, leafHi: number): void;
}

type LeafKind = "front" | "page" | "back";

interface StripRefs {
  el: HTMLElement;
  frontHolder: HTMLElement;
  backClone: HTMLElement;
  /** front: shade-left, shade-right, gloss-left, gloss-right; then the same four for the back. */
  layers: HTMLElement[];
}

interface PoolSlot {
  el: HTMLElement;
  strips: StripRefs[];
  busy: boolean;
  /** The leaf whose snapshot the strips hold, or -1. */
  leaf: number;
  /** The real page changed since the snapshot was taken. */
  stale: boolean;
  observer: MutationObserver | null;
  cache: Float32Array;
  pose: LeafPose;
}

interface Flight {
  leaf: number;
  kind: LeafKind;
  slot: PoolSlot | null;
  q: number;
  w: number;
  bend: number;
  bendV: number;
  /** Extra "finger flick" curl for programmatic turns; decays. */
  lead: number;
  target: 0 | 180;
  mode: "drag" | "free";
  /** Rubber band: the leaf may lift but not turn (the last page). */
  band: boolean;
  bounced: boolean;
  speed: number;
  age: number;
  // cover easing
  ramp: boolean;
  rampFrom: number;
  rampT: number;
  // drag
  grabS: number;
  anchor: number;
  gain: number;
  side: 1 | -1;
}

interface Refs {
  scaler: HTMLElement;
  book: HTMLElement;
  groundR: HTMLElement;
  groundL: HTMLElement;
  front: HTMLElement;
  frontEdge: HTMLElement;
  backEdge: HTMLElement;
  frontShadeOut: HTMLElement;
  frontShadeIn: HTMLElement;
  frontGlare: HTMLElement;
  passenger: HTMLElement;
  back: HTMLElement;
  backShadeIn: HTMLElement;
  backShadeOut: HTMLElement;
  blockR: HTMLElement;
  blockL: HTMLElement;
  blankL: HTMLElement;
  castR: HTMLElement;
  castL: HTMLElement;
  fadeR: HTMLElement;
  fadeL: HTMLElement;
}

const REF_NAMES: (keyof Refs)[] = [
  "scaler",
  "book",
  "groundR",
  "groundL",
  "front",
  "frontEdge",
  "backEdge",
  "frontShadeOut",
  "frontShadeIn",
  "frontGlare",
  "passenger",
  "back",
  "backShadeIn",
  "backShadeOut",
  "blockR",
  "blockL",
  "blankL",
  "castR",
  "castL",
  "fadeR",
  "fadeL",
];

const toneA: Tone = { dark: 0, gloss: 0 };
const toneB: Tone = { dark: 0, gloss: 0 };
const pt: [number, number] = [0, 0];

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class BookEngine {
  private root: HTMLElement;
  private refs!: Refs;
  private pool: PoolSlot[] = [];
  private geo: LeafGeometry = makeLeafGeometry(PAGE_W, STRIPS);
  private pad = BEND_MAX * this.geo.phiSpan + PAGE_PAD_EXTRA;

  private layout: BookLayout;
  private shape: BookShape;
  private cb: EngineCallbacks;
  private reduced = false;

  /** Leaves lying on the left once everything in the air has landed. */
  private k = 0;
  private qFront = 0;
  private qBack = 0;
  private shift = 0;
  private flights: Flight[] = [];
  private goal: number | null = null;
  private goalSpeed = 1;
  private lastStarted: Flight | null = null;
  /** While the whole block closes with the cover, the right stack keeps showing this leaf. */
  private rightTopOverride: number | null = null;

  private running = false;
  private destroyed = false;
  private shown = new Set<HTMLElement>();
  private sheetCache = new Map<string, HTMLElement | null>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Leaves React has been asked to mount; grows while the book is idle. */
  private mountLo = 0;
  private mountHi = 2;
  private fadeStop: (() => void) | null = null;

  private lastDir: 1 | -1 = 1;
  private lastK = 0;
  private lastOpen = false;
  private lastStartPage = -1;
  private lastLandPage = -1;

  // pointer
  private ptr: {
    id: number;
    x0: number;
    y0: number;
    t0: number;
    x: number;
    vx: number;
    lastX: number;
    lastT: number;
    startX: number;
    state: "pending" | "drag" | "swipe";
    flight: Flight | null;
    rectLeft: number;
    target: EventTarget | null;
  } | null = null;
  private suppressClick = false;

  constructor(root: HTMLElement, layout: BookLayout, shape: BookShape, cb: EngineCallbacks) {
    this.root = root;
    this.layout = layout;
    this.shape = shape;
    this.cb = cb;
    this.collectRefs();
    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("pointermove", this.onPointerMove);
    root.addEventListener("pointerup", this.onPointerUp);
    root.addEventListener("pointercancel", this.onPointerCancel);
    root.addEventListener("click", this.onClickCapture, true);
    this.renderStatic();
    this.scheduleIdle(500);
  }

  /* ---------------------------- public ---------------------------- */

  destroy() {
    this.destroyed = true;
    this.stopLoop();
    this.fadeStop?.();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    for (const slot of this.pool) slot.observer?.disconnect();
    const r = this.root;
    r.removeEventListener("pointerdown", this.onPointerDown);
    r.removeEventListener("pointermove", this.onPointerMove);
    r.removeEventListener("pointerup", this.onPointerUp);
    r.removeEventListener("pointercancel", this.onPointerCancel);
    r.removeEventListener("click", this.onClickCapture, true);
  }

  setCallbacks(cb: EngineCallbacks) {
    this.cb = cb;
  }

  setReducedMotion(reduced: boolean) {
    if (reduced && !this.reduced) {
      this.landAll();
      for (const slot of this.pool) this.clearSlot(slot);
    }
    this.reduced = reduced;
    if (!reduced) this.scheduleIdle();
  }

  /** New size, same book structure. */
  setLayout(layout: BookLayout) {
    this.layout = layout;
    this.renderStatic();
  }

  /** The book structure changed (page count, single/spread). Keeps the current page in view. */
  setShape(shape: BookShape, layout: BookLayout) {
    const wasOpen = this.isOpen();
    const page = pageForK(this.shape, this.k);
    const wasBack = this.k === this.shape.leaves;
    this.landAll();
    this.goal = null;
    this.shape = shape;
    this.layout = layout;
    this.sheetCache.clear();
    for (const slot of this.pool) slot.observer?.disconnect();
    this.collectRefs();
    this.k = wasBack && shape.hasBack ? shape.leaves : wasOpen ? kForPage(shape, page) : 0;
    this.qFront = this.k > 0 ? 180 : 0;
    this.qBack = this.k === shape.leaves ? 180 : 0;
    this.renderStatic();
    this.notifyStart();
  }

  /** Sheets were mounted or unmounted by React. */
  invalidateSheets() {
    this.sheetCache.clear();
    this.syncStatics();
    if (!this.running) this.scheduleIdle();
  }

  isOpen() {
    return this.k > 0 && this.k < this.shape.leaves;
  }

  getPage() {
    return pageForK(this.shape, this.k);
  }

  isBusy() {
    return this.flights.length > 0 || this.goal !== null;
  }

  open() {
    if (this.k === 0) this.setGoal(1);
    else if (this.k === this.shape.leaves) this.setGoal(this.shape.leaves - 1);
  }

  close() {
    if (this.k === 0 || this.k === this.shape.leaves) return;
    if (this.reduced) return this.jumpTo(0);
    if (this.k === 1 && this.flights.length === 0) return this.setGoal(0);
    this.closeBlock();
  }

  next() {
    const base = this.goal ?? this.k;
    if (base < this.shape.kMax) this.setGoal(this.skipEndpaper(base + 1, 1));
    else if (!this.reduced && this.goal === null && this.flights.length === 0) this.nudge();
  }

  prev() {
    const base = this.goal ?? this.k;
    if (base > 0) this.setGoal(this.skipEndpaper(base - 1, -1));
  }

  /**
   * In single view the state "every page turned, back cover still open" shows nothing but the
   * endpaper, so stepping through the book passes straight over it.
   */
  private skipEndpaper(k: number, dir: 1 | -1): number {
    const { shape } = this;
    return shape.mode === "single" && shape.hasBack && k === shape.sheets + 1 ? k + dir : k;
  }

  flipTo(page: number) {
    this.setGoal(kForPage(this.shape, page));
  }

  /** Lift the corner of the current page and let it drop: a hint that pages turn. */
  peek() {
    if (this.reduced || this.flights.length || this.goal !== null || !this.isOpen()) return;
    const leaf = this.k;
    if (this.kindOf(leaf) !== "page") return;
    const f = this.makeFlight(leaf, 1);
    if (!f) return;
    f.band = true;
    f.target = 0;
    f.lead = 84;
    f.bend = 10;
    f.w = 580;
    f.q = -this.pad + 12;
    this.flights.push(f);
    this.syncStatics();
    this.startLoop();
  }

  /* ---------------------------- setup ----------------------------- */

  private collectRefs() {
    const q = (name: string) => this.root.querySelector<HTMLElement>(`[data-pb="${name}"]`);
    const refs = {} as Refs;
    for (const name of REF_NAMES) {
      const el = q(name);
      if (!el) throw new Error(`PassportBook: missing element "${name}"`);
      refs[name] = el;
    }
    this.refs = refs;
    this.pool = Array.from(this.root.querySelectorAll<HTMLElement>("[data-pb-leaf]")).map((el) => {
      const strips = Array.from(el.querySelectorAll<HTMLElement>("[data-pb-strip]")).map((s) => ({
        el: s,
        frontHolder: s.querySelector<HTMLElement>("[data-pb-hold='f']")!,
        backClone: s.querySelector<HTMLElement>("[data-pb-hold='b']")!,
        layers: Array.from(s.querySelectorAll<HTMLElement>("[data-pb-tone]")),
      }));
      return {
        el,
        strips,
        busy: false,
        leaf: -1,
        stale: false,
        observer: null,
        cache: new Float32Array(STRIPS * 8).fill(-1),
        pose: makePose(STRIPS),
      };
    });
  }

  private kindOf(leaf: number): LeafKind {
    return leaf === 0 ? "front" : leaf === this.shape.sheets + 1 ? "back" : "page";
  }

  private sheet(kind: "recto" | "verso", leaf: number): HTMLElement | null {
    const key = kind + leaf;
    let el = this.sheetCache.get(key);
    if (el === undefined) {
      el = this.root.querySelector<HTMLElement>(`[data-pb-${kind}="${leaf}"]`);
      if (el) this.sheetCache.set(key, el);
    }
    return el ?? null;
  }

  /* --------------------------- statics ---------------------------- */

  private tops(): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    for (const f of this.flights) {
      if (f.leaf < lo) lo = f.leaf;
      if (f.leaf > hi) hi = f.leaf;
    }
    const leftTop = this.flights.length ? lo - 1 : this.k - 1;
    const rightTop = this.rightTopOverride ?? (this.flights.length ? hi + 1 : this.k);
    return [leftTop, rightTop];
  }

  /** Show exactly the real nodes that can be seen: the top of each stack and the one below it. */
  private syncStatics() {
    const { shape, refs } = this;
    const [leftTop, rightTop] = this.tops();
    const next = new Set<HTMLElement>();
    for (const leaf of [rightTop, rightTop + 1]) {
      const el = rectoPage(shape, leaf) >= 0 ? this.sheet("recto", leaf) : null;
      if (el) next.add(el);
    }
    let blank = false;
    for (const leaf of [leftTop, leftTop - 1]) {
      if (leaf < 1 || leaf > shape.sheets) continue;
      const el = versoPage(shape, leaf) >= 0 ? this.sheet("verso", leaf) : null;
      if (el) next.add(el);
      else if (leaf === leftTop) blank = true;
      if (!el && leaf === leftTop) break;
    }
    if (blank) {
      next.add(refs.blankL);
      refs.blankL.style.transform = `translateZ(${-leafDepth(shape, leftTop)}px)`;
    }
    if (rightTop <= shape.sheets) next.add(refs.blockR);
    if (leftTop >= 1 && this.rightTopOverride === null) next.add(refs.blockL);
    for (const el of this.shown) if (!next.has(el)) el.style.visibility = "hidden";
    for (const el of next) if (!this.shown.has(el)) el.style.visibility = "visible";
    this.shown = next;

    const zR = leafDepth(shape, Math.min(rightTop, shape.leaves - 1)) + 0.5;
    const zL = -leafDepth(shape, Math.max(leftTop, 0)) + 0.5;
    refs.castR.dataset.z = String(zR);
    refs.castL.dataset.z = String(zL);
    this.requestMount(leftTop - 1, rightTop + 1);
  }

  /** Write everything that does not depend on a leaf in the air. */
  private renderStatic() {
    this.syncStatics();
    this.writeCovers();
    this.writeCast();
  }

  private writeCovers() {
    const { refs, shape, layout } = this;
    const qf = this.qFront;
    const qb = this.qBack;
    refs.front.style.transform = `rotateY(${(-qf).toFixed(3)}deg) translateZ(${leafDepth(shape, 0)}px)`;
    refs.back.style.transform = `rotateY(${(-qb).toFixed(3)}deg) translateZ(${leafDepth(shape, shape.leaves - 1)}px)`;

    const fa = clamp(qf, 0, 180);
    refs.frontShadeOut.style.opacity = (toneFront(fa, toneA).dark * SHADE_COVER).toFixed(3);
    refs.frontShadeIn.style.opacity = (toneBack(fa, toneB).dark * SHADE_COVER).toFixed(3);
    // A band of light crosses the cover as it lifts.
    const g = clamp(fa / 78, 0, 1);
    refs.frontGlare.style.transform = `translate3d(${(-150 + g * 330).toFixed(1)}%,0,0)`;
    refs.frontGlare.style.opacity = (Math.sin(g * Math.PI) * 0.85).toFixed(3);

    // The board's thickness only reads while it stands up; lying flat it would be a stray hairline.
    refs.frontEdge.style.opacity = (smoothstep(3, 22, fa) * (1 - smoothstep(158, 177, fa))).toFixed(3);

    const ba = clamp(qb, 0, 180);
    refs.backEdge.style.opacity = (smoothstep(3, 22, ba) * (1 - smoothstep(158, 177, ba))).toFixed(3);
    refs.backShadeIn.style.opacity = (toneFront(ba, toneA).dark * SHADE_COVER).toFixed(3);
    refs.backShadeOut.style.opacity = (toneBack(ba, toneB).dark * SHADE_COVER).toFixed(3);

    const e1 = smoothstep(0, 180, fa);
    const e2 = smoothstep(0, 180, ba);
    this.shift = layout.xClosed + (layout.xOpen - layout.xClosed) * e1 + (layout.xBack - layout.xOpen) * e2;
    refs.book.style.transform = `translate3d(${this.shift.toFixed(2)}px,0,0)`;

    // The shadow under the book follows the boards.
    refs.groundL.style.opacity = smoothstep(78, 172, fa).toFixed(3);
    refs.groundR.style.opacity = (1 - smoothstep(8, 102, ba)).toFixed(3);
  }

  /* ------------------------- cast shadows ------------------------- */

  private writeCast() {
    const { refs } = this;
    let extR = 0;
    let opR = 0;
    let extL = 0;
    let opL = 0;
    const [leftTop, rightTop] = this.tops();
    // A shadow needs something to fall on.
    const hasRight = rightTop <= this.shape.leaves - 1;
    const hasLeft = leftTop >= 0;
    for (const f of this.flights) {
      let ex: number;
      let ez: number;
      let hi: number;
      let lo: number;
      let len: number;
      if (f.kind === "page" && f.slot) {
        const p = f.slot.pose;
        ex = p.X[STRIPS];
        ez = p.Z[STRIPS];
        hi = 0;
        lo = 180;
        for (let i = 0; i < STRIPS; i++) {
          if (p.angles[i] > hi) hi = p.angles[i];
          if (p.angles[i] < lo) lo = p.angles[i];
        }
        len = PAGE_W;
      } else {
        const q = clamp(f.kind === "front" ? this.qFront : this.qBack, 0, 180);
        ex = COVER_W * Math.cos(q * RAD);
        ez = COVER_W * Math.sin(q * RAD);
        hi = lo = q;
        len = COVER_W;
      }
      const height = clamp(ez / len, 0, 1);
      // Right page: the key light is on the left, so the leaf throws a true shadow to its right.
      const r = ex + 0.55 * ez + 18;
      if (r > 0 && hasRight) {
        // Fainter and softer once the leaf is high above the page or has swung past upright.
        const o =
          smoothstep(0, 9, hi) * (1 - 0.42 * height) * smoothstep(0, 150, r) * (1 - 0.45 * smoothstep(75, 125, hi));
        if (r > extR) extR = r;
        if (o > opR) opR = o;
      }
      // Left page: only a soft halo of occlusion just beyond the leaf's edge.
      const l = -ex + 0.2 * ez + 16;
      if (l > 0 && lo > 60 && hasLeft) {
        const o = smoothstep(0, 26, 180 - lo) * smoothstep(60, 100, lo) * (0.8 - 0.3 * height);
        if (l > extL) extL = l;
        if (o > opL) opL = o;
      }
    }
    const zR = refs.castR.dataset.z ?? "1";
    const zL = refs.castL.dataset.z ?? "1";
    refs.castR.style.opacity = opR.toFixed(3);
    refs.castL.style.opacity = opL.toFixed(3);
    if (opR > 0) {
      refs.castR.style.transform = `translateZ(${zR}px) scaleX(${clamp(extR / PAGE_W, 0.02, 1.04).toFixed(4)})`;
    }
    if (opL > 0) {
      refs.castL.style.transform = `translateZ(${zL}px) scaleX(${clamp(extL / PAGE_W, 0.02, 1.04).toFixed(4)})`;
    }
  }

  /* ---------------------------- leaves ---------------------------- */

  /**
   * A pooled leaf for `leaf`: the one already holding a fresh snapshot of it if there is one
   * (the common case, prepared while idle), otherwise a free one filled now.
   */
  private acquireSlot(leaf: number, keep?: number[]): PoolSlot | null {
    let same: PoolSlot | null = null;
    let empty: PoolSlot | null = null;
    let far: PoolSlot | null = null;
    for (const slot of this.pool) {
      if (slot.busy) continue;
      if (slot.leaf === leaf) same = slot;
      else if (slot.leaf < 0) empty ??= slot;
      else if (keep && keep.includes(slot.leaf)) continue;
      else if (!far || Math.abs(slot.leaf - leaf) > Math.abs(far.leaf - leaf)) far = slot;
    }
    if (same) {
      if (same.observer && same.observer.takeRecords().length) same.stale = true;
      if (!same.stale) return same;
    }
    const pick = same ?? empty ?? far;
    return pick && this.fillSlot(pick, leaf) ? pick : null;
  }

  /** Snapshot the real page(s) of `leaf` into the strips of a pooled leaf. */
  private fillSlot(slot: PoolSlot, leaf: number): boolean {
    const recto = this.sheet("recto", leaf)?.querySelector<HTMLElement>(":scope > .pb-inner");
    if (!recto) return false;
    const hasVerso = versoPage(this.shape, leaf) >= 0;
    const verso = hasVerso ? this.sheet("verso", leaf)?.querySelector<HTMLElement>(":scope > .pb-inner") : null;
    if (hasVerso && !verso) return false;
    const n = this.pool.indexOf(slot);
    const { xs } = this.geo;
    const fill = (src: HTMLElement, suffix: string, back: boolean) => {
      const master = snapshot(src, suffix);
      const spans = measureHeavy(src, this.layout.scale);
      // Copy first, prune after: every strip starts from the complete page.
      const copies = slot.strips.map((_, i) => (i === 0 ? master : (master.cloneNode(true) as HTMLElement)));
      slot.strips.forEach((s, i) => {
        const w = xs[i + 1] - xs[i] + 1;
        const from = back ? PAGE_W - xs[i] - w : xs[i];
        pruneHeavy(copies[i], spans, from, from + w);
        (back ? s.backClone : s.frontHolder).replaceChildren(copies[i]);
      });
    };
    fill(recto, `-pb${n}f`, false);
    if (verso) fill(verso, `-pb${n}b`, true);
    else for (const s of slot.strips) if (s.backClone.firstChild) s.backClone.replaceChildren();
    slot.leaf = leaf;
    slot.stale = false;
    slot.cache.fill(-1);
    // Watch the real page: if the host changes it (a stamp is pressed), the snapshot is retaken.
    if (typeof MutationObserver !== "undefined") {
      slot.observer?.disconnect();
      const observer = (slot.observer ??= new MutationObserver(() => {
        slot.stale = true;
        // Retake it once the page has been quiet for a moment, not on every frame of an animation.
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = null;
        this.scheduleIdle(500);
      }));
      const watch = { subtree: true, childList: true, attributes: true, characterData: true } as const;
      observer.observe(recto, watch);
      if (verso) observer.observe(verso, watch);
    } else slot.stale = true;
    return true;
  }

  private releaseSlot(slot: PoolSlot) {
    slot.busy = false;
    slot.el.style.visibility = "hidden";
  }

  private clearSlot(slot: PoolSlot) {
    slot.observer?.disconnect();
    slot.leaf = -1;
    for (const strip of slot.strips) {
      strip.frontHolder.replaceChildren();
      strip.backClone.replaceChildren();
    }
  }

  /* -------------------------- idle work --------------------------- */

  private requestMount(lo: number, hi: number) {
    const a = Math.max(0, Math.min(lo, this.mountLo));
    const b = Math.min(this.shape.sheets + 1, Math.max(hi, this.mountHi));
    if (a === this.mountLo && b === this.mountHi) return;
    this.mountLo = a;
    this.mountHi = b;
    this.cb.ensureMounted?.(a, b);
  }

  private scheduleIdle(delay = 160) {
    if (this.destroyed || this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.running || this.ptr || this.destroyed) return;
      if (this.idleStep()) this.scheduleIdle(140);
    }, delay);
  }

  /**
   * One small piece of preparation while nothing moves, so that starting a turn costs nothing:
   * mount one more page (UX-7: pages arrive gradually, never during a turn), or snapshot one of
   * the leaves most likely to be turned next. Returns true while there is more to do.
   */
  private idleStep(): boolean {
    const { shape } = this;
    if (this.mountHi < shape.sheets || this.mountLo > 1) {
      const [leftTop, rightTop] = this.tops();
      // Grow towards whichever side is nearer to what is on show.
      if (this.mountHi < shape.sheets && (this.mountLo <= 1 || this.mountHi - rightTop <= leftTop - this.mountLo)) {
        this.requestMount(this.mountLo, this.mountHi + 1);
      } else this.requestMount(this.mountLo - 1, this.mountHi);
      return true;
    }
    if (this.reduced) return false;
    // Nearest leaves first, forwards before backwards, as many as the pool holds.
    const want: number[] = [];
    for (let d = 0; want.length < this.pool.length && d <= shape.sheets; d++) {
      for (const leaf of [this.k + d, this.k - 1 - d]) {
        if (leaf >= 1 && leaf <= shape.sheets && want.length < this.pool.length) want.push(leaf);
      }
    }
    for (const leaf of want) {
      const have = this.pool.find((slot) => slot.leaf === leaf);
      if (have) {
        if (have.observer && have.observer.takeRecords().length) have.stale = true;
        if (!have.stale) continue;
      }
      return this.acquireSlot(leaf, want) !== null;
    }
    return false;
  }

  private makeFlight(leaf: number, dir: 1 | -1): Flight | null {
    const kind = this.kindOf(leaf);
    let slot: PoolSlot | null = null;
    if (kind === "page") {
      slot = this.acquireSlot(leaf);
      if (!slot) {
        this.requestMount(leaf - 1, leaf + 1);
        return null;
      }
      slot.busy = true;
    }
    const from = dir > 0 ? 0 : 180;
    const f: Flight = {
      leaf,
      kind,
      slot,
      q: kind === "page" ? (dir > 0 ? -this.pad : 180 + this.pad) : kind === "front" ? this.qFront : this.qBack,
      w: 0,
      bend: 0,
      bendV: 0,
      lead: 0,
      target: dir > 0 ? 180 : 0,
      mode: "free",
      band: false,
      bounced: false,
      speed: 1,
      age: 0,
      ramp: false,
      rampFrom: from,
      rampT: 0,
      grabS: PAGE_W * 0.7,
      anchor: 0,
      gain: 1,
      side: dir,
    };
    if (slot) {
      this.poseAndWrite(f);
      slot.el.style.visibility = "visible";
    }
    return f;
  }

  /** Start a programmatic turn of `leaf`. Returns false when it cannot start this frame. */
  private startTurn(leaf: number, dir: 1 | -1, speed: number): boolean {
    const f = this.makeFlight(leaf, dir);
    if (!f) return false;
    f.speed = speed;
    if (f.kind === "page") {
      // An invisible finger flicks the fore edge: the edge leads, then trails once it is moving.
      f.lead = dir * 52;
      f.bend = dir * 18;
      f.w = dir * 170 * speed;
      // Start where the fore edge is just about to leave the stack, so there is no dead time.
      f.q = dir > 0 ? -f.bend * this.geo.phiSpan : 180 - f.bend * this.geo.phiSpan;
    } else {
      f.ramp = true;
      f.rampFrom = f.q;
    }
    this.flights.push(f);
    this.lastStarted = f;
    this.decide();
    this.syncStatics();
    return true;
  }

  /** Recompute k from what is on its way where, and tell the host. */
  private decide() {
    if (this.flights.length) {
      let lo = Infinity;
      let toLeft = 0;
      for (const f of this.flights) {
        if (f.leaf < lo) lo = f.leaf;
        if (f.target === 180 && !f.band && f.mode === "free") toLeft++;
        else if (f.mode === "drag" && f.side < 0) toLeft++; // still held: counts as where it came from
      }
      this.k = lo + toLeft;
    }
    this.notifyStart();
  }

  private notifyStart() {
    if (this.k !== this.lastK) {
      this.lastDir = this.k > this.lastK ? 1 : -1;
      this.lastK = this.k;
      this.root.dataset.pbState = this.k === 0 ? "front" : this.k === this.shape.leaves ? "back" : "open";
    }
    const open = this.isOpen();
    if (open !== this.lastOpen) {
      this.lastOpen = open;
      this.cb.onOpenChange?.(open);
    }
    // While several leaves are on their way (flipTo), report the destination once rather than
    // every page passed, so the host re-renders once and not in the middle of the riffle.
    const goalOpen = this.goal !== null && this.goal > 0 && this.goal < this.shape.leaves;
    const page = goalOpen ? pageForK(this.shape, this.goal!) : this.getPage();
    if (open && page !== this.lastStartPage) {
      this.lastStartPage = page;
      this.cb.onFlipStart?.(page);
    }
  }

  private notifyLanded() {
    const page = this.getPage();
    if (this.isOpen() && page !== this.lastLandPage) {
      this.lastLandPage = page;
      this.cb.onFlip?.(page);
    }
    if (!this.isOpen()) {
      this.lastLandPage = -1;
      this.lastStartPage = -1;
    }
  }

  private land(f: Flight) {
    const i = this.flights.indexOf(f);
    if (i >= 0) this.flights.splice(i, 1);
    if (f.kind === "front") this.qFront = f.target;
    else if (f.kind === "back") this.qBack = f.target;
    if (f.slot) this.releaseSlot(f.slot);
    if (this.lastStarted === f) this.lastStarted = null;
    if (f.kind === "front" && this.rightTopOverride !== null) {
      this.rightTopOverride = null;
      this.refs.passenger.replaceChildren();
      this.refs.passenger.style.visibility = "hidden";
    }
  }

  /** Put every leaf in the air straight onto its stack. */
  private landAll() {
    for (const f of [...this.flights]) {
      if (f.mode === "drag") f.target = f.side > 0 ? 0 : 180;
      this.land(f);
    }
    this.ptr = null;
    this.writeCovers();
    this.syncStatics();
    this.writeCast();
  }

  /* --------------------------- commands --------------------------- */

  private setGoal(k: number) {
    const goal = clamp(Math.round(k), 0, this.shape.kMax);
    if (this.reduced) return this.jumpTo(goal);
    // A leaf still held by a finger, or heading the other way, is put down first.
    if (
      this.flights.some(
        (f) => f.mode === "drag" || (goal > this.k ? f.target === 0 : goal < this.k && f.target === 180),
      )
    ) {
      this.landAll();
    }
    if (goal === this.k) return;
    this.goalSpeed = Math.abs(goal - this.k) > 1 ? 1.4 : 1;
    this.goal = goal;
    this.startLoop();
  }

  private advanceGoal() {
    if (this.goal === null) return;
    if (this.goal === this.k) {
      this.goal = null;
      return;
    }
    const dir: 1 | -1 = this.goal > this.k ? 1 : -1;
    const leaf = dir > 0 ? this.k : this.k - 1;
    const last = this.lastStarted;
    if (last && this.flights.includes(last)) {
      const progress = last.target === 180 ? last.q : 180 - last.q;
      const need = last.kind === "page" ? (this.kindOf(leaf) === "page" ? 62 : 120) : 104;
      if (progress < need) return;
    }
    this.startTurn(leaf, dir, this.goalSpeed);
    if (this.goal === this.k) this.goal = null;
  }

  /** Close from the middle of the book: the turned pages ride on the cover as one block. */
  private closeBlock() {
    this.landAll();
    this.goal = null;
    const { refs, shape } = this;
    const [leftTop] = this.tops();
    if (leftTop >= 1) {
      const src =
        (versoPage(shape, leftTop) >= 0 ? this.sheet("verso", leftTop) : refs.blankL)?.querySelector<HTMLElement>(
          ":scope > .pb-inner",
        ) ?? null;
      if (src) {
        refs.passenger.replaceChildren(snapshot(src, "-pbp"));
        refs.passenger.style.visibility = "visible";
      }
    }
    this.rightTopOverride = this.k;
    const f = this.makeFlight(0, -1);
    if (!f) return;
    f.ramp = true;
    f.rampFrom = f.q;
    this.flights.push(f);
    this.lastStarted = f;
    this.k = 0;
    this.notifyStart();
    this.syncStatics();
    this.startLoop();
  }

  /** The last page cannot turn: lift it a little and let it fall back. */
  private nudge() {
    const leaf = this.k;
    if (this.kindOf(leaf) !== "page") return;
    const f = this.makeFlight(leaf, 1);
    if (!f) return;
    f.band = true;
    f.target = 0;
    f.lead = 60;
    f.bend = 8;
    f.w = 300;
    f.q = -this.pad + 10;
    this.flights.push(f);
    this.syncStatics();
    this.startLoop();
  }

  /* ------------------------ reduced motion ------------------------ */

  /** No turning: cross-fade to the new state. */
  private jumpTo(goal: number) {
    if (goal === this.k) return;
    const { refs, shape } = this;
    this.fadeStop?.();
    const coverMoves = (goal === 0) !== (this.k === 0) || (goal === shape.leaves) !== (this.k === shape.leaves);
    const apply = () => {
      this.k = goal;
      this.qFront = goal > 0 ? 180 : 0;
      this.qBack = goal === shape.leaves ? 180 : 0;
      this.renderStatic();
      this.notifyStart();
    };
    if (coverMoves) {
      // The book changes shape, so fade the whole object out and back in.
      const out = animate(refs.scaler, { opacity: 0 }, { duration: 0.14, ease: "easeIn" });
      let back: ReturnType<typeof animate> | null = null;
      this.fadeStop = () => {
        out.stop();
        back?.stop();
        refs.scaler.style.opacity = "1";
        this.fadeStop = null;
      };
      out.then(() => {
        if (this.destroyed) return;
        apply();
        back = animate(refs.scaler, { opacity: 1 }, { duration: 0.22, ease: "easeOut" });
        back.then(() => {
          this.fadeStop = null;
          this.notifyLanded();
        });
      });
      return;
    }
    // Page change: lay a snapshot of the old pages on top and fade it away.
    const [leftTop, rightTop] = this.tops();
    const snap = (kind: "recto" | "verso", leaf: number, into: HTMLElement) => {
      const src = (
        kind === "verso" && versoPage(shape, leaf) < 0 && leaf >= 1 ? refs.blankL : this.sheet(kind, leaf)
      )?.querySelector<HTMLElement>(":scope > .pb-inner");
      into.replaceChildren();
      if (!src || (kind === "recto" && rectoPage(shape, leaf) < 0)) return false;
      into.appendChild(snapshot(src, kind === "recto" ? "-pbxr" : "-pbxl"));
      return true;
    };
    const hasR = snap("recto", rightTop, refs.fadeR);
    const hasL = leftTop >= 1 && snap("verso", leftTop, refs.fadeL);
    const z = shape.leaves + 2;
    refs.fadeR.style.transform = `translateZ(${z}px)`;
    refs.fadeL.style.transform = `translateZ(${z}px)`;
    refs.fadeR.style.opacity = hasR ? "1" : "0";
    refs.fadeL.style.opacity = hasL ? "1" : "0";
    refs.fadeR.style.visibility = hasR ? "visible" : "hidden";
    refs.fadeL.style.visibility = hasL ? "visible" : "hidden";
    apply();
    const anim = animate([refs.fadeR, refs.fadeL], { opacity: 0 }, { duration: 0.26, ease: "easeOut" });
    const finish = () => {
      refs.fadeR.style.visibility = "hidden";
      refs.fadeL.style.visibility = "hidden";
      refs.fadeR.replaceChildren();
      refs.fadeL.replaceChildren();
      this.fadeStop = null;
    };
    this.fadeStop = () => {
      anim.stop();
      finish();
    };
    anim.then(() => {
      if (this.destroyed) return;
      finish();
      this.notifyLanded();
    });
  }

  /* ----------------------------- loop ----------------------------- */

  private startLoop() {
    if (this.running || this.destroyed) return;
    this.running = true;
    frame.update(this.tick, true);
  }

  private stopLoop() {
    if (!this.running) return;
    this.running = false;
    cancelFrame(this.tick);
    this.scheduleIdle();
  }

  private tick = (data: { delta: number }) => {
    const dt = clamp(data.delta / 1000, 1 / 240, 1 / 24);
    if (this.goal !== null && !this.ptr?.flight) this.advanceGoal();

    let landed = false;
    let coverMoved = false;
    for (const f of [...this.flights]) {
      // Two sub-steps keep the stiff curl spring stable when a frame is long.
      const steps = f.mode === "free" && dt > 1 / 50 ? 2 : 1;
      for (let s = 0; s < steps; s++) this.step(f, dt / steps);
      f.age += dt;
      if (f.kind === "page") this.poseAndWrite(f);
      else {
        if (f.kind === "front") this.qFront = f.q;
        else this.qBack = f.q;
        coverMoved = true;
      }
      if (f.mode === "free" && this.hasLanded(f)) {
        this.land(f);
        landed = true;
        if (f.kind !== "page") coverMoved = true;
      }
    }
    if (coverMoved) this.writeCovers();
    if (landed) this.syncStatics();
    this.writeCast();

    if (!this.flights.length && this.goal === null) {
      // A drag can leave the book on the bare endpaper: carry on the way it was going.
      const through = this.skipEndpaper(this.k, this.lastDir);
      if (through !== this.k) {
        this.setGoal(through);
        return;
      }
      this.stopLoop();
      this.notifyLanded();
    }
  };

  private step(f: Flight, dt: number) {
    if (f.mode === "drag") return this.stepDrag(f, dt);
    const sp = f.speed;
    if (f.kind === "page") {
      const target = f.target === 180 ? 180 + this.pad : -this.pad;
      const k = PAGE_K * sp * sp;
      const c = 2 * Math.sqrt(k) * PAGE_ZETA;
      f.w += (k * (target - f.q) - c * f.w) * dt;
      f.q += f.w * dt;
      if (f.q > 180 + this.pad) {
        f.q = 180 + this.pad;
        f.w = 0;
      } else if (f.q < -this.pad) {
        f.q = -this.pad;
        f.w = 0;
      }
      f.lead *= Math.exp(-dt * 5.2 * sp);
      const bt = clamp(-BEND_LAG * f.w + f.lead, -BEND_MAX, BEND_MAX);
      const bc = 2 * Math.sqrt(BEND_K) * BEND_ZETA;
      f.bendV += (BEND_K * (bt - f.bend) - bc * f.bendV) * dt;
      f.bend = clamp(f.bend + f.bendV * dt, -BEND_MAX, BEND_MAX);
      return;
    }
    // Covers.
    let target: number = f.target;
    let k = COVER_FREE_K;
    let zeta = COVER_FREE_ZETA;
    if (f.ramp) {
      f.rampT += dt;
      const span = Math.abs(f.target - f.rampFrom) / 180;
      const u = clamp(f.rampT / (COVER_DURATION * (0.45 + 0.55 * span)), 0, 1);
      // Where nothing lies under the board it swings a touch past flat; where it lands on the
      // page block it arrives with speed left over and bounces.
      const lands = (f.kind === "front" && f.target === 0) || (f.kind === "back" && f.target === 180);
      const ease = lands
        ? 0.55 * easeInOutSine(u) + 0.45 * u * u
        : easeInOutSine(u) + (u > 0.7 ? Math.sin(((u - 0.7) / 0.3) * Math.PI) * 0.03 : 0);
      target = f.rampFrom + (f.target - f.rampFrom) * ease;
      k = COVER_FOLLOW_K;
      zeta = COVER_FOLLOW_ZETA;
    }
    const c = 2 * Math.sqrt(k) * zeta;
    f.w += (k * (target - f.q) - c * f.w) * dt;
    f.q += f.w * dt;
    // A board can swing a little past flat where nothing lies under it, and bounces where
    // it lands on the page block.
    const overLo = f.kind === "back";
    const overHi = f.kind === "front";
    if ((f.q < 0 && !overLo) || (f.q > 180 && !overHi)) {
      f.q = f.q < 0 ? 0 : 180;
      // One soft bounce off the page block, then rest.
      if (!f.bounced && Math.abs(f.w) > 30) {
        f.bounced = true;
        f.w = -Math.sign(f.w) * Math.max(Math.abs(f.w) * 0.3, f.ramp ? 150 : 0);
      } else f.w = 0;
    }
    f.q = clamp(f.q, -7, 187);
  }

  private stepDrag(f: Flight, dt: number) {
    const p = this.ptr;
    if (!p) return;
    const ox = this.layout.originX - this.shift;
    const fx = f.anchor + ((p.x - p.startX) / this.layout.scale) * f.gain;
    const prev = f.q;
    if (f.kind === "page") {
      const bt = clamp(f.side * BEND_DRAG + 0.02 * f.w, -BEND_MAX, BEND_MAX);
      const bc = 2 * Math.sqrt(BEND_K) * 0.8;
      f.bendV += (BEND_K * (bt - f.bend) - bc * f.bendV) * dt;
      f.bend = clamp(f.bend + f.bendV * dt, -BEND_MAX, BEND_MAX);
      let q = solveLeaf(this.geo, f.grabS, f.bend, fx, ox, PERSPECTIVE, -this.pad, 180 + this.pad);
      if (f.band) {
        // Resistance: the last page lifts, but less and less.
        const lift = q + this.pad;
        q = -this.pad + (this.pad + 34) * (1 - Math.exp(-lift / 150));
      }
      f.q = q;
    } else {
      f.q = solveRigid(f.grabS, fx, ox, PERSPECTIVE);
    }
    const w = (f.q - prev) / dt;
    f.w += (w - f.w) * Math.min(1, dt * 22);
  }

  private hasLanded(f: Flight): boolean {
    if (f.age > 3) return true;
    if (f.kind === "page" && f.slot) {
      // Still on its way up (a hint or a nudge starts flat): not landed yet.
      if (f.target === 0 ? f.w > 4 : f.w < -4) return false;
      const a = f.slot.pose.angles;
      if (f.target === 180) {
        for (let i = 0; i < STRIPS; i++) if (a[i] < 179.92) return false;
      } else {
        for (let i = 0; i < STRIPS; i++) if (a[i] > 0.08) return false;
      }
      return true;
    }
    if (f.ramp && f.rampT < COVER_DURATION * 0.4) return false;
    return Math.abs(f.q - f.target) < 0.12 && Math.abs(f.w) < 3;
  }

  /* ------------------------ per-frame writes ---------------------- */

  private poseAndWrite(f: Flight) {
    const slot = f.slot!;
    const pose = poseLeaf(this.geo, f.q, f.bend, slot.pose);
    const depth = leafDepth(this.shape, f.leaf);
    const a = pose.angles;
    const cache = slot.cache;
    for (let i = 0; i < STRIPS; i++) {
      const s = slot.strips[i];
      const ai = a[i];
      s.el.style.transform = `translate3d(${pose.X[i].toFixed(2)}px,0,${pose.Z[i].toFixed(2)}px) rotateY(${(-ai).toFixed(3)}deg) translateZ(${depth}px)`;
      // Shade each strip from the angle at its two edges, so light runs smoothly over the bend.
      const eL = i === 0 ? ai : (a[i - 1] + ai) / 2;
      const eR = i === STRIPS - 1 ? ai : (ai + a[i + 1]) / 2;
      const o = i * 8;
      if (ai < 104) {
        toneFront(eL, toneA);
        toneFront(eR, toneB);
        setOpacity(s.layers[0], cache, o, toneA.dark * SHADE_PAPER);
        setOpacity(s.layers[1], cache, o + 1, toneB.dark * SHADE_PAPER);
        setOpacity(s.layers[2], cache, o + 2, toneA.gloss * GLOSS_PAPER);
        setOpacity(s.layers[3], cache, o + 3, toneB.gloss * GLOSS_PAPER);
      }
      if (ai > 76) {
        // The back face is mirrored: its left edge is the strip's outer edge.
        toneBack(eR, toneA);
        toneBack(eL, toneB);
        setOpacity(s.layers[4], cache, o + 4, toneA.dark * SHADE_PAPER);
        setOpacity(s.layers[5], cache, o + 5, toneB.dark * SHADE_PAPER);
        setOpacity(s.layers[6], cache, o + 6, toneA.gloss * GLOSS_PAPER);
        setOpacity(s.layers[7], cache, o + 7, toneB.gloss * GLOSS_PAPER);
      }
    }
  }

  /* ---------------------------- pointer --------------------------- */

  private onPointerDown = (e: PointerEvent) => {
    if (this.ptr || (e.pointerType === "mouse" && e.button !== 0)) return;
    this.suppressClick = false;
    const rect = this.root.getBoundingClientRect();
    this.ptr = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      x: e.clientX,
      vx: 0,
      lastX: e.clientX,
      lastT: performance.now(),
      startX: e.clientX,
      state: "pending",
      flight: null,
      rectLeft: rect.left,
      target: e.target,
    };
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.ptr;
    if (!p || e.pointerId !== p.id) return;
    const now = performance.now();
    const dtMs = now - p.lastT;
    if (dtMs > 0) {
      const v = ((e.clientX - p.lastX) / dtMs) * 1000;
      p.vx += (v - p.vx) * Math.min(1, dtMs / 50);
      p.lastX = e.clientX;
      p.lastT = now;
    }
    p.x = e.clientX;
    if (p.state !== "pending") return;
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
      this.ptr = null; // a vertical scroll, not ours
      return;
    }
    if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    try {
      this.root.setPointerCapture(p.id);
    } catch {
      /* the pointer is already gone */
    }
    this.suppressClick = true;
    p.startX = e.clientX;
    if (this.reduced) {
      p.state = "swipe";
      return;
    }
    p.state = "drag";
    this.beginDrag(dx < 0 ? 1 : -1);
  };

  private onPointerUp = (e: PointerEvent) => {
    const p = this.ptr;
    if (!p || e.pointerId !== p.id) return;
    this.ptr = null;
    if (p.state === "pending") {
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      if (moved < TAP_SLOP && performance.now() - p.t0 < 600) this.tap(e.clientX, p);
      return;
    }
    if (p.state === "swipe") {
      const dx = e.clientX - p.x0;
      if (Math.abs(dx) > 36) (dx < 0 ? this.next : this.prev).call(this);
      return;
    }
    // A finger that stopped before lifting has no fling left in it.
    if (performance.now() - p.lastT > 90) p.vx = 0;
    this.endDrag(p.flight, p.vx / this.layout.scale);
  };

  private onPointerCancel = (e: PointerEvent) => {
    const p = this.ptr;
    if (!p || e.pointerId !== p.id) return;
    this.ptr = null;
    if (p.state === "drag") this.endDrag(p.flight, 0);
  };

  private onClickCapture = (e: MouseEvent) => {
    if (!this.suppressClick) return;
    this.suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  };

  private tap(clientX: number, p: NonNullable<BookEngine["ptr"]>) {
    if (this.k === 0 || this.k === this.shape.leaves) return this.open();
    const target = p.target as Element | null;
    if (target?.closest?.(NO_FLIP_SELECTOR)) return;
    const x = (clientX - p.rectLeft) / this.layout.scale - this.shift;
    const single = this.layout.mode === "single";
    if (x > PAGE_W * 0.86) this.next();
    else if (single ? x < PAGE_W * 0.1 : x < -PAGE_W * 0.86) this.prev();
  }

  /** `dir` 1 = the finger moves left (towards the left stack), -1 = right. */
  private beginDrag(dir: 1 | -1) {
    const p = this.ptr!;
    this.goal = null;
    const ox = this.layout.originX - this.shift;
    const xDown = (p.x0 - p.rectLeft) / this.layout.scale - this.shift;
    const single = this.layout.mode === "single";

    // Catch a leaf that is still in the air and bring it back.
    if (this.flights.length === 1 && this.flights[0].mode === "free") {
      const f = this.flights[0];
      const heading = f.target === 180 ? 1 : -1;
      // Only a leaf going the other way is caught. One going the same way is left to land, and
      // this drag takes the next page, so quick flicks turn a page each.
      if (heading !== dir || f.band) {
        f.mode = "drag";
        f.ramp = false;
        f.side = dir;
        f.gain = 1;
        if (f.kind === "page" && f.slot) {
          f.grabS = PAGE_W * 0.72;
          pointOnLeaf(this.geo, f.slot.pose, f.grabS, pt);
          f.anchor = projectX(pt[0], pt[1], ox, PERSPECTIVE);
        } else {
          f.grabS = COVER_W * 0.72;
          f.anchor = projectX(f.grabS * Math.cos(f.q * RAD), f.grabS * Math.sin(f.q * RAD), ox, PERSPECTIVE);
        }
        p.flight = f;
        this.startLoop();
        return;
      }
    }
    if (this.flights.some((f) => f.mode === "drag" || (f.target === 180 ? 1 : -1) !== dir)) return;

    const [leftTop, rightTop] = this.tops();
    const leaf = dir > 0 ? rightTop : leftTop;
    if (leaf < 0 || leaf > this.shape.leaves - 1) return;
    const kind = this.kindOf(leaf);
    const canTurn = dir > 0 ? leaf < this.shape.kMax : true;
    if (!canTurn && kind !== "page") return;
    let f = this.makeFlight(leaf, dir);
    if (!f && kind === "page" && this.flights.length) {
      // No free leaf: put the oldest one down and take its place.
      this.land(this.flights[0]);
      this.syncStatics();
      f = this.makeFlight(leaf, dir);
    }
    if (!f) return;
    f.mode = "drag";
    f.band = !canTurn;
    f.side = dir;
    const len = kind === "page" ? PAGE_W : COVER_W;
    if (dir > 0) {
      f.grabS = clamp(xDown, len * 0.32, len);
      f.anchor = projectX(f.grabS, 0, ox, PERSPECTIVE);
    } else if (single) {
      // The leaf comes back from off screen: the finger is on the page, not on the leaf.
      f.grabS = len * 0.56;
      f.anchor = projectX(-f.grabS, 0, ox, PERSPECTIVE);
      f.gain = 1.3;
    } else {
      f.grabS = clamp(-xDown, len * 0.32, len);
      f.anchor = projectX(-f.grabS, 0, ox, PERSPECTIVE);
    }
    p.flight = f;
    this.flights.push(f);
    this.syncStatics();
    this.startLoop();
  }

  private endDrag(f: Flight | null, vx: number) {
    if (!f || !this.flights.includes(f)) return;
    f.mode = "free";
    // The turn completes once the leaf is about a third of the way over, in the direction of
    // the drag: on a phone a finger runs out of screen before the page is upright.
    const predicted = f.q + f.w * 0.17;
    let toLeft = f.side > 0 ? predicted > 60 : predicted > 120;
    if (Math.abs(vx) > FLICK_SPEED) toLeft = vx < 0;
    if (f.band) toLeft = false;
    f.target = toLeft ? 180 : 0;
    f.w = clamp(f.w, -1500, 1500);
    f.speed = 1;
    f.age = 0;
    this.lastStarted = f;
    this.decide();
    this.startLoop();
  }
}

/**
 * Deep-copy a page for display elsewhere. Ids are given a suffix and every reference to them is
 * rewritten: an SVG mask or text path that still pointed at the original would stop rendering the
 * moment the original is hidden.
 */
function snapshot(src: HTMLElement, suffix: string): HTMLElement {
  const clone = src.cloneNode(true) as HTMLElement;
  const owners = clone.querySelectorAll("[id]");
  if (!owners.length) return clone;
  const ids: string[] = [];
  owners.forEach((el) => {
    ids.push(el.id);
    el.id += suffix;
  });
  const pattern = new RegExp(
    `#(${ids
      .sort((a, b) => b.length - a.length)
      .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})(?![\\w-])`,
    "g",
  );
  const all = clone.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const attrs = all[i].attributes;
    for (let j = 0; j < attrs.length; j++) {
      const value = attrs[j].value;
      if (value.indexOf("#") < 0) continue;
      const next = value.replace(pattern, `#$1${suffix}`);
      if (next !== value) attrs[j].value = next;
    }
  }
  return clone;
}

/**
 * Fixed-size, self-contained widgets that are expensive to style and paint: the stamps, plus
 * anything the host marks with data-pb-prune. A strip shows a sixth of the page, so each strip's
 * copy keeps only the ones that reach into it. Emptying one leaves its box, and the layout, intact.
 */
const HEAVY_SELECTOR = ".ip-stamp,[data-pb-prune]";
const HEAVY_MARGIN = 14;

function measureHeavy(src: HTMLElement, scale: number): Float32Array | null {
  const items = src.querySelectorAll(HEAVY_SELECTOR);
  if (!items.length) return null;
  const origin = src.getBoundingClientRect().left;
  const spans = new Float32Array(items.length * 2);
  items.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    spans[i * 2] = (r.left - origin) / scale - HEAVY_MARGIN;
    spans[i * 2 + 1] = (r.right - origin) / scale + HEAVY_MARGIN;
  });
  return spans;
}

function pruneHeavy(copy: HTMLElement, spans: Float32Array | null, from: number, to: number) {
  if (!spans) return;
  const items = copy.querySelectorAll(HEAVY_SELECTOR);
  if (items.length * 2 !== spans.length) return;
  for (let i = 0; i < items.length; i++) {
    if (spans[i * 2] > to || spans[i * 2 + 1] < from) items[i].replaceChildren();
  }
}

function setOpacity(el: HTMLElement, cache: Float32Array, i: number, value: number) {
  const v = value < 0.004 ? 0 : value;
  if (Math.abs(cache[i] - v) < 0.004 && !(v === 0 && cache[i] !== 0)) return;
  cache[i] = v;
  el.style.opacity = v.toFixed(3);
}
