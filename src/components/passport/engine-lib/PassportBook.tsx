"use client";

/**
 * PassportBook, StPageFlip engine (UX-2, PAS-3).
 *
 * What is drawn by whom:
 *  - This component: the physical book. Cover boards and their hinge, the page block, shadows,
 *    the cover-opening animation, and the mounting of the flip engine.
 *  - flip-engine.ts + StPageFlip: page turning (geometry, input, shading).
 *  - The caller: what is printed on the cover and the pages (`cover`, `pages`, `backCover`).
 *
 * Loading (UX-7): the closed cover is plain markup and renders on the server. The pages mount
 * after hydration into detached host elements (React portals). StPageFlip (about 44 KB) is
 * imported when the browser is idle; until it arrives the current page is shown statically and
 * page changes are instant, so nothing waits on it. No part of this touches `window` during render.
 *
 * The cover swing is the only 3D in the component and lives in its own stacking context that
 * holds the cover alone. At rest (closed or open) every element is flat; the rest poses are in
 * passport-book.css and the swing writes transform and opacity only.
 */
import { animate, useMotionValue, type AnimationPlaybackControls } from "motion/react";
import {
  createContext,
  forwardRef,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { strings, t } from "@/lib/strings";
import type { PassportBookHandle, PassportBookProps } from "@/lib/types";
import { FlipEngine, cubicBezier, type FlipMode, type PageFlipCtor } from "./flip-engine";
import "./passport-book.css";

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type BookState = "closed" | "opening" | "open" | "closing";
export type BookSide = "front" | "back";

export interface PassportBookLibProps extends PassportBookProps {
  /** Printed on the inside of the front cover (the left side of the first spread, behind the pages). */
  insideCover?: ReactNode;
  /** Printed on the inside of the back cover. */
  insideBackCover?: ReactNode;
  defaultOpen?: boolean;
  /** Page shown when the book first opens. Zero-based index into `pages`. */
  startPage?: number;
  /** "auto": one page on narrow containers, a two-page spread from 780px. */
  spread?: "auto" | "single" | "double";
  /** In a spread, the side pages[0] opens on. "left" pairs pages as [0,1] [2,3]; "right" as [-,0] [1,2]. */
  firstPageSide?: "left" | "right";
  /**
   * "full": the engine draws cover material, paper, spine shading and the dark-mode page tint.
   * "bare": the content brings its own surfaces; the engine adds only the book around it.
   */
  chrome?: "full" | "bare";
  /** Lift a page corner once after the first opening, to show the pages turn. Default true. */
  hint?: boolean;
  /**
   * Force the reduced-motion fallback on or off. Default: the device setting (UX-5).
   * Useful for showing the fallback without changing OS settings.
   */
  reducedMotion?: boolean;
  /**
   * What stepping past the last page does when there is a `backCover`:
   * "close" (default) shuts the book and turns it over onto its back; "resist" only lifts the page.
   */
  pastEnd?: "close" | "resist";
  /** A page turn has been decided and is on its way to `pageIndex`. onFlip follows when it lands. */
  onFlipStart?(pageIndex: number): void;
  onStateChange?(state: BookState): void;
  style?: CSSProperties;
}

export interface PassportBookLibHandle extends PassportBookHandle {
  /**
   * Like flipTo, but up to four pages away the pages are thumbed through one after another
   * (about a second at most). onFlip fires once, on the destination page.
   */
  flipThrough(page: number): void;
  /** Show a page with no animation, whether the book is open or closed. Does not open it. */
  goTo(page: number): void;
  /** Lift the lower page corner and let it fall back. */
  peek(): void;
  /** Closed book only: turn it over to show `backCover`, or back again. */
  turnOver(side?: BookSide): void;
  getState(): BookState;
  getPage(): number;
}

export interface PassportPageInfo {
  index: number;
  count: number;
  /** Page size in px. 0 until the book has measured itself. */
  width: number;
  height: number;
  mode: FlipMode;
  /** Which side of the spine the page sits on. Always "right" in single-page mode. */
  side: "left" | "right";
}

const PageContext = createContext<PassportPageInfo | null>(null);

/** Inside a page: where it is and how big. Null outside a PassportBook. */
export function usePassportPage(): PassportPageInfo | null {
  return useContext(PageContext);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  // addListener: Safari 13 and the in-app browsers built on it.
  if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
  else mq.addListener(onChange);
  return () => {
    if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
    else mq.removeListener(onChange);
  };
}

/** UX-5. Live value of the reduced-motion setting; false on the server. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Thumb finds the edge and lifts it. */
const EASE_UNLATCH = cubicBezier(0.3, 0, 0.5, 1);
/** A board with weight: slow to start, fast through upright, laid down rather than dropped. */
const EASE_SWING = cubicBezier(0.62, 0, 0.16, 1);
const EASE_FOLLOW = cubicBezier(0.25, 0.6, 0.2, 1);
const EASE_CLOSE = cubicBezier(0.55, 0, 0.22, 1);
const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);
const easeInQuad = (x: number) => x * x;

let libPromise: Promise<PageFlipCtor> | null = null;

function loadPageFlip(): Promise<PageFlipCtor> {
  if (!libPromise) {
    libPromise = import("page-flip")
      .then((mod) => {
        const m = mod as unknown as { PageFlip?: PageFlipCtor; default?: { PageFlip?: PageFlipCtor } };
        const ctor = m.PageFlip ?? m.default?.PageFlip;
        if (!ctor) throw new Error("page-flip: PageFlip export not found");
        return ctor;
      })
      .catch((error) => {
        libPromise = null;
        throw error;
      });
  }
  return libPromise;
}

function whenIdle(run: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(run, { timeout: 1200 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 160);
  return () => window.clearTimeout(id);
}

/** Indexes of the pages on the left and right of the spread that shows `page`. */
function spreadOf(page: number, count: number, mode: FlipMode, first: "left" | "right"): { left: number; right: number } {
  if (mode === "single") return { left: -1, right: page };
  let left: number;
  if (first === "left") left = page - (page % 2);
  else left = page === 0 ? -1 : page % 2 === 1 ? page : page - 1;
  const right = left + 1 < count ? left + 1 : -1;
  return { left, right };
}

interface Metrics {
  mode: FlipMode;
  w: number;
  h: number;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const PassportBook = forwardRef<PassportBookLibHandle, PassportBookLibProps>(function PassportBook(
  {
    cover,
    pages,
    backCover,
    insideCover,
    insideBackCover,
    onFlip,
    onOpenChange,
    onStateChange,
    className,
    style,
    defaultOpen = false,
    startPage = 0,
    spread = "auto",
    firstPageSide = "left",
    chrome = "full",
    hint = true,
    reducedMotion,
    pastEnd = "close",
    onFlipStart,
  },
  ref,
) {
  const count = pages.length;
  const systemReduced = usePrefersReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const full = chrome === "full";
  const hasBack = backCover != null;

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const hingeRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const frontShadeRef = useRef<HTMLSpanElement>(null);
  const insideShadeRef = useRef<HTMLSpanElement>(null);
  const glintRef = useRef<HTMLSpanElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const castRef = useRef<HTMLDivElement>(null);
  const riderRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<BookState>(defaultOpen ? "open" : "closed");
  const [side, setSide] = useState<BookSide>("front");
  const [page, setPage] = useState(() => clamp(Math.round(startPage), 0, Math.max(0, count - 1)));
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [hosts, setHosts] = useState<HTMLDivElement[]>([]);
  const [engineReady, setEngineReady] = useState(false);

  const mode: FlipMode = metrics?.mode ?? (spread === "double" ? "double" : "single");

  // Latest values for the imperative code below.
  const stateRef = useRef(state);
  const sideRef = useRef(side);
  const pageRef = useRef(page);
  const modeRef = useRef(mode);
  const metricsRef = useRef(metrics);
  const reducedRef = useRef(reduced);
  const countRef = useRef(count);
  const hostsRef = useRef(hosts);
  const engineRef = useRef<FlipEngine | null>(null);
  const firstPageSideRef = useRef(firstPageSide);
  const hintRef = useRef(hint);
  const hasBackRef = useRef(hasBack);
  const cb = useRef({ onFlip, onFlipStart, onOpenChange, onStateChange });
  const pastEndRef = useRef(pastEnd);
  useIsoLayoutEffect(() => {
    pastEndRef.current = pastEnd;
    firstPageSideRef.current = firstPageSide;
    hintRef.current = hint;
    hasBackRef.current = hasBack;
    modeRef.current = mode;
    metricsRef.current = metrics;
    reducedRef.current = reduced;
    countRef.current = count;
    hostsRef.current = hosts;
    cb.current = { onFlip, onFlipStart, onOpenChange, onStateChange };
  });

  const angle = useMotionValue(defaultOpen ? -180 : 0);
  const swingCtl = useRef<AnimationPlaybackControls | null>(null);
  const swingToken = useRef(0);
  const turning = useRef(false);
  const hinted = useRef(false);
  const refocus = useRef<"pages" | "cover" | null>(null);
  /** A swipe made while the cover was still swinging open: played when it lands. */
  const queuedTurn = useRef<1 | -1 | 0>(0);
  const early = useRef<{ id: number; x: number; y: number } | null>(null);
  /** Close, then turn the book over (stepping past the last page). */
  const overAfterClose = useRef(false);

  /* ---------------------------- page hosts ---------------------------- */

  useIsoLayoutEffect(() => {
    setHosts((prev) => {
      if (prev.length === count) return prev;
      const next = prev.slice(0, count);
      while (next.length < count) {
        const host = document.createElement("div");
        host.className = "ipb-leaf";
        next.push(host);
      }
      return next;
    });
  }, [count]);

  // Hosts live in the mount whenever the flip engine does not hold them.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    for (const stray of Array.from(mount.querySelectorAll<HTMLDivElement>(":scope > .ipb-leaf"))) {
      if (!hosts.includes(stray)) stray.remove();
    }
    for (const host of hosts) if (!host.parentElement) mount.appendChild(host);
  }, [hosts]);

  /* ---------------------------- measuring ---------------------------- */

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const mount = mountRef.current;
    if (!root || !stage || !mount) return;

    const measure = () => {
      const n = getComputedStyle(stage).getPropertyValue("--ipb-n").trim() === "2" ? 2 : 1;
      const w = Math.floor(mount.clientWidth / n);
      const h = Math.floor(mount.clientHeight);
      if (w < 40 || h < 40) return; // hidden or not laid out yet
      root.style.setProperty("--ipb-page-w", `${w}px`);
      root.style.setProperty("--ipb-page-h", `${h}px`);
      root.style.setProperty("--ipb-u", `${(w / 100).toFixed(3)}px`);
      const next: Metrics = { mode: n === 2 ? "double" : "single", w, h };
      setMetrics((prev) => (prev && prev.mode === next.mode && prev.w === w && prev.h === h ? prev : next));
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(mount);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------ pages ------------------------------ */

  const commitPage = useCallback((next: number) => {
    if (next === pageRef.current) return;
    pageRef.current = next;
    setPage(next);
    cb.current.onFlip?.(next);
  }, []);

  /* ------------------------------ cover ------------------------------ */

  const applyPose = useCallback((deg: number) => {
    const hinge = hingeRef.current;
    const book = bookRef.current;
    if (!hinge || !book) return;
    const n = modeRef.current === "double" ? 2 : 1;
    const a = clamp(deg, -180, 0);
    const rad = (-a * Math.PI) / 180;
    const open = -a / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);

    hinge.style.transform = `rotateY(${a.toFixed(2)}deg)`;

    // The outside darkens a little as it turns edge-on; the inside comes out of its own shadow.
    if (frontShadeRef.current) frontShadeRef.current.style.opacity = (0.3 * sin * sin).toFixed(3);
    if (insideShadeRef.current) insideShadeRef.current.style.opacity = (0.44 * sin).toFixed(3);

    // Light runs across the cover while it lifts through the first 70 degrees.
    const g = clamp(rad / 1.22, 0, 1);
    const glint = glintRef.current;
    if (glint) {
      glint.style.opacity = Math.sin(Math.PI * g).toFixed(3);
      glint.style.transform = `translate3d(${(-40 + 80 * g).toFixed(2)}%,0,0)`;
    }

    // Shadow of the cover on the first page: full at first, then drawn back towards the spine.
    const sweep = sweepRef.current;
    if (sweep) {
      sweep.style.transform = `scaleX(${clamp(cos + 0.34 * sin, 0, 1).toFixed(4)})`;
      sweep.style.opacity = clamp(1.15 - open * 1.9, 0, 1).toFixed(3);
    }

    // Shadow under the cover where it comes down on the left.
    if (castRef.current) castRef.current.style.opacity = smooth(clamp((open - 0.5) / 0.5, 0, 1)).toFixed(3);

    // The book rises a touch at mid-swing, and in a spread slides over to stay centred.
    const shift = -25 * (n - 1) * (1 - smooth(open));
    book.style.transform = `translate3d(${shift.toFixed(3)}%,${(-5 * sin).toFixed(2)}px,0) scale(${(1 + 0.02 * sin).toFixed(4)})`;
  }, []);

  const clearPose = useCallback(() => {
    for (const node of [
      hingeRef.current,
      bookRef.current,
      frontShadeRef.current,
      insideShadeRef.current,
      glintRef.current,
      sweepRef.current,
      castRef.current,
    ]) {
      if (!node) continue;
      node.style.transform = "";
      node.style.opacity = "";
      node.style.transformOrigin = "";
    }
  }, []);

  useEffect(
    () =>
      angle.on("change", (value) => {
        const s = stateRef.current;
        if (s === "opening" || s === "closing") applyPose(value);
      }),
    [angle, applyPose],
  );

  const setBookState = useCallback((next: BookState) => {
    if (stateRef.current === next) return;
    stateRef.current = next;
    // The attribute is what the styles key off, so it is written at once. React catches up
    // without blocking the first frame of the swing.
    if (rootRef.current) rootRef.current.dataset.state = next;
    startTransition(() => setState(next));
    cb.current.onStateChange?.(next);
  }, []);

  /* In a spread, the page left of the spine travels with the cover: a static copy rides on the
     inside of the cover while it is in the air. */
  const clearRider = useCallback(() => {
    riderRef.current?.replaceChildren();
  }, []);

  const mountRider = useCallback(() => {
    clearRider();
    if (modeRef.current !== "double" || !riderRef.current) return;
    const engine = engineRef.current;
    let source: HTMLElement | null = null;
    if (engine) source = engine.leftHost();
    else {
      const { left } = spreadOf(pageRef.current, countRef.current, "double", firstPageSideRef.current);
      source = left >= 0 ? (hostsRef.current[left] ?? null) : null;
    }
    if (!source) return;
    const copy = source.cloneNode(true) as HTMLElement;
    copy.removeAttribute("style");
    copy.removeAttribute("data-fallback");
    copy.className = "ipb-leaf ipb-leaf--rider";
    copy.setAttribute("aria-hidden", "true");
    riderRef.current.appendChild(copy);
  }, [clearRider]);

  const thud = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || reducedRef.current || typeof stage.animate !== "function") return;
    stage.animate(
      [{ transform: "scale(1)" }, { transform: "scale(0.991)", offset: 0.35 }, { transform: "scale(1)" }],
      { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
  }, []);

  const nextRef = useRef<() => void>(() => {});
  const prevRef = useRef<() => void>(() => {});
  const turnOverRef = useRef<(to?: BookSide) => void>(() => {});

  const land = useCallback(
    (target: "open" | "closed") => {
      swingCtl.current = null;
      angle.jump(target === "open" ? -180 : 0);
      setBookState(target);
      clearPose();
      clearRider();
      const queued = queuedTurn.current;
      queuedTurn.current = 0;
      if (target === "open" && queued) {
        // The reader swiped before the cover had landed: turn that page now.
        hinted.current = true;
        requestAnimationFrame(() => {
          if (stateRef.current !== "open") return;
          if (queued > 0) nextRef.current();
          else prevRef.current();
        });
      } else if (target === "open" && hintRef.current && !hinted.current && !reducedRef.current) {
        hinted.current = true;
        window.setTimeout(() => {
          if (stateRef.current === "open") engineRef.current?.peek();
        }, 620);
      }
      if (target === "closed" && overAfterClose.current) {
        overAfterClose.current = false;
        window.setTimeout(() => {
          if (stateRef.current === "closed") turnOverRef.current("back");
        }, 90);
      }
    },
    [angle, clearPose, clearRider, setBookState],
  );

  const swing = useCallback(
    (target: "open" | "closed") => {
      swingCtl.current?.stop();
      const token = ++swingToken.current;
      const from = angle.get();
      const to = target === "open" ? -180 : 0;
      const share = Math.abs(to - from) / 180;
      const finish = () => {
        if (token !== swingToken.current) return;
        land(target);
        thud();
      };
      if (share < 0.004) {
        finish();
        return;
      }
      if (target === "open") {
        const settle = () => {
          if (token !== swingToken.current) return;
          // The board meets the table and gives once.
          swingCtl.current = animate(angle, [-180, -177.3, -180], {
            duration: 0.22,
            times: [0, 0.42, 1],
            ease: [easeOutQuad, easeInQuad],
            onComplete: finish,
          });
        };
        if (from > -1) {
          swingCtl.current = animate(angle, [0, -9, -180], {
            duration: 0.96,
            times: [0, 0.18, 1],
            ease: [EASE_UNLATCH, EASE_SWING],
            onComplete: settle,
          });
        } else {
          swingCtl.current = animate(angle, -180, {
            duration: 0.3 + 0.6 * share,
            ease: EASE_FOLLOW,
            onComplete: settle,
          });
        }
      } else {
        const whole = from < -179;
        swingCtl.current = animate(angle, 0, {
          duration: 0.3 + 0.58 * share,
          ease: whole ? EASE_CLOSE : EASE_FOLLOW,
          onComplete: () => {
            if (token !== swingToken.current) return;
            if (share < 0.5) {
              finish();
              return;
            }
            // The board lands on the page block, springs up a hair and settles.
            swingCtl.current = animate(angle, [0, -2.6, 0], {
              duration: 0.24,
              times: [0, 0.4, 1],
              ease: [easeOutQuad, easeInQuad],
              onComplete: finish,
            });
          },
        });
      }
    },
    [angle, land, thud],
  );

  /** Enter a moving state from rest and put the cover in the matching pose before the next paint. */
  const beginSwing = useCallback(
    (next: "opening" | "closing") => {
      const from = stateRef.current;
      if (from === "closed" || from === "open") {
        engineRef.current?.settle();
        mountRider();
        angle.jump(from === "open" ? -180 : 0);
      }
      setBookState(next);
      applyPose(angle.get());
    },
    [angle, applyPose, mountRider, setBookState],
  );

  const crossfade = useCallback(
    (target: "open" | "closed") => {
      const token = ++swingToken.current;
      const hinge = hingeRef.current;
      if (modeRef.current === "single" && hinge && typeof hinge.animate === "function") {
        /* Reduced motion, one page wide: the closed cover lies exactly over the page, so the two
           are cross-faded in place. Nothing moves and there is no empty frame in between. */
        angle.jump(0);
        applyPose(0);
        if (sweepRef.current) sweepRef.current.style.opacity = "0";
        const opening = target === "open";
        const fade = hinge.animate([{ opacity: opening ? 1 : 0 }, { opacity: opening ? 0 : 1 }], {
          duration: 260,
          easing: "ease-in-out",
          fill: "both",
        });
        const end = () => {
          fade.onfinish = fade.oncancel = null;
          if (token === swingToken.current) land(target);
          fade.cancel();
        };
        fade.onfinish = end;
        fade.oncancel = end;
        return;
      }
      // A spread changes width as it opens: the cover fades out and the destination fades in.
      const book = bookRef.current;
      const done = () => {
        if (token !== swingToken.current) return;
        land(target);
        if (book && typeof book.animate === "function") {
          book.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
        }
      };
      if (!book || typeof book.animate !== "function") {
        done();
        return;
      }
      const out = book.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-in" });
      out.onfinish = done;
      out.oncancel = done;
    },
    [angle, applyPose, land],
  );

  /* --------------------- turning the closed book over --------------------- */

  const setBookSide = useCallback((next: BookSide) => {
    sideRef.current = next;
    if (rootRef.current) rootRef.current.dataset.side = next;
    setSide(next);
  }, []);

  const turnOver = useCallback(
    (to?: BookSide, then?: () => void) => {
      const target = to ?? (sideRef.current === "front" ? "back" : "front");
      if (stateRef.current !== "closed" || turning.current || target === sideRef.current) {
        if (target === sideRef.current) then?.();
        return;
      }
      if (target === "back" && !hasBackRef.current) return;
      const book = bookRef.current;
      if (reducedRef.current || !book) {
        setBookSide(target);
        then?.();
        return;
      }
      turning.current = true;
      const n = modeRef.current === "double" ? 2 : 1;
      const base = `translateX(${-25 * (n - 1)}%)`;
      const depth = (metricsRef.current?.w ?? 340) * 5.2;
      const dir = target === "back" ? 1 : -1;
      book.style.transformOrigin = `${100 - 50 / n}% 50%`;
      let swapped = false;
      animate(0, 180, {
        duration: 0.82,
        ease: cubicBezier(0.5, 0, 0.2, 1),
        onUpdate: (v) => {
          if (!swapped && v >= 90) {
            swapped = true;
            setBookSide(target);
          }
          const a = (v < 90 ? v : v - 180) * dir;
          const lift = Math.sin((v * Math.PI) / 180);
          book.style.transform = `${base} perspective(${depth.toFixed(0)}px) rotateY(${a.toFixed(2)}deg) scale(${(1 + 0.035 * lift).toFixed(4)})`;
        },
        onComplete: () => {
          turning.current = false;
          book.style.transform = "";
          book.style.transformOrigin = "";
          thud();
          then?.();
        },
      });
    },
    [setBookSide, thud],
  );

  useIsoLayoutEffect(() => {
    turnOverRef.current = (to?: BookSide) => turnOver(to);
  });

  /* ------------------------------ handle ------------------------------ */

  const open = useCallback(() => {
    const s = stateRef.current;
    if (s === "open" || s === "opening" || turning.current) return;
    if (sideRef.current === "back") {
      turnOver("front", () => openRef.current());
      return;
    }
    if (document.activeElement === frontRef.current) refocus.current = "pages";
    cb.current.onOpenChange?.(true);
    beginSwing("opening");
    if (reducedRef.current) crossfade("open");
    else swing("open");
  }, [beginSwing, crossfade, swing, turnOver]);

  const openRef = useRef(open);
  useIsoLayoutEffect(() => {
    openRef.current = open;
  });

  const close = useCallback(() => {
    const s = stateRef.current;
    if (s === "closed" || s === "closing") return;
    if (mountRef.current?.contains(document.activeElement)) refocus.current = "cover";
    queuedTurn.current = 0;
    cb.current.onOpenChange?.(false);
    beginSwing("closing");
    if (reducedRef.current) crossfade("closed");
    else swing("closed");
  }, [beginSwing, crossfade, swing]);

  const closeRef = useRef(close);
  useIsoLayoutEffect(() => {
    closeRef.current = close;
  });

  const pastLastPageRef = useRef<() => void>(() => {});

  /** Page change while the flip library is not loaded: no animation, same result. */
  const stepWithoutEngine = useCallback(
    (delta: 1 | -1) => {
      const m = modeRef.current;
      const n = countRef.current;
      const { left, right } = spreadOf(pageRef.current, n, m, firstPageSideRef.current);
      if (delta === 1) {
        const next = m === "single" ? pageRef.current + 1 : Math.max(left, right) + 1;
        if (next <= n - 1) commitPage(next);
        else pastLastPageRef.current();
      } else {
        const first = m === "single" ? pageRef.current : left >= 0 ? left : right;
        if (first <= 0) closeRef.current();
        else commitPage(Math.max(0, first - (m === "single" ? 1 : 2)));
      }
    },
    [commitPage],
  );

  const next = useCallback(() => {
    if (stateRef.current === "closed" || stateRef.current === "closing") {
      openRef.current();
      return;
    }
    if (stateRef.current !== "open") return;
    if (engineRef.current) engineRef.current.next();
    else stepWithoutEngine(1);
  }, [stepWithoutEngine]);

  const prev = useCallback(() => {
    if (stateRef.current !== "open") return;
    if (engineRef.current) engineRef.current.prev();
    else stepWithoutEngine(-1);
  }, [stepWithoutEngine]);

  useIsoLayoutEffect(() => {
    nextRef.current = next;
    prevRef.current = prev;
  });

  /** Stepping past the last page: shut the book onto its back cover, or just lift the page. */
  const pastLastPage = useCallback(() => {
    if (stateRef.current !== "open") return;
    if (hasBackRef.current && pastEndRef.current === "close") {
      overAfterClose.current = true;
      closeRef.current();
    } else engineRef.current?.nudge();
  }, []);

  const flipTo = useCallback(
    (target: number) => {
      const index = clamp(Math.round(target), 0, Math.max(0, countRef.current - 1));
      const engine = engineRef.current;
      if (stateRef.current === "open") {
        if (engine) engine.flipTo(index);
        else commitPage(index);
        return;
      }
      // Closed: go to the page under the cover, then open on it.
      if (engine) engine.turnTo(index);
      else commitPage(index);
      openRef.current();
    },
    [commitPage],
  );

  const flipThrough = useCallback(
    (target: number) => {
      const engine = engineRef.current;
      if (stateRef.current === "open" && engine) engine.flipThrough(target);
      else flipTo(target);
    },
    [flipTo],
  );

  const goTo = useCallback(
    (target: number) => {
      const index = clamp(Math.round(target), 0, Math.max(0, countRef.current - 1));
      const engine = engineRef.current;
      if (engine) engine.turnTo(index, stateRef.current === "open");
      else commitPage(index);
    },
    [commitPage],
  );

  useIsoLayoutEffect(() => {
    pastLastPageRef.current = pastLastPage;
  });

  useImperativeHandle(
    ref,
    () => ({
      open,
      close,
      next,
      prev,
      flipTo,
      flipThrough,
      goTo,
      peek: () => {
        if (stateRef.current === "open") engineRef.current?.peek();
      },
      turnOver: (to?: BookSide) => turnOver(to),
      getState: () => stateRef.current,
      getPage: () => pageRef.current,
    }),
    [open, close, next, prev, flipTo, flipThrough, goTo, turnOver],
  );

  /* ---------------------------- flip engine ---------------------------- */

  const metricsMode = metrics?.mode;
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !metricsMode || hosts.length === 0 || hosts.length !== count) return;
    let cancelled = false;
    let engine: FlipEngine | null = null;

    const start = () => {
      loadPageFlip()
        .then((PageFlip) => {
          const m = metricsRef.current;
          if (cancelled || !m) return;
          engine = new FlipEngine({
            PageFlip,
            mount,
            hosts,
            mode: metricsMode,
            firstPageSide,
            pageWidth: m.w,
            pageHeight: m.h,
            startPage: pageRef.current,
            reducedMotion: reducedRef.current,
            gutter: full,
            onFlip: commitPage,
            onFlipStart: (index) => cb.current.onFlipStart?.(index),
            onEdge: (direction) => {
              if (direction === "prev") closeRef.current();
              else pastLastPage();
            },
          });
          engineRef.current = engine;
          setEngineReady(true);
        })
        .catch(() => {
          /* Offline or blocked: the book keeps working without the flip animation. */
        });
    };
    // First load waits for an idle moment; later rebuilds (resize across the breakpoint) do not.
    let cancelIdle = () => {};
    if (libPromise) start();
    else cancelIdle = whenIdle(start);

    return () => {
      cancelled = true;
      cancelIdle();
      if (engine) {
        engine.destroy();
        if (engineRef.current === engine) engineRef.current = null;
        setEngineReady(false);
      }
    };
  }, [hosts, count, metricsMode, firstPageSide, full, commitPage, pastLastPage]);

  const pageW = metrics?.w ?? 0;
  const pageH = metrics?.h ?? 0;
  useEffect(() => {
    if (pageW && pageH) engineRef.current?.resize(pageW, pageH);
  }, [pageW, pageH, engineReady]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reduced);
  }, [reduced, engineReady]);

  // Static display of the current page or spread while the engine is not there.
  useIsoLayoutEffect(() => {
    if (engineReady) return;
    const { left, right } = spreadOf(page, count, mode, firstPageSide);
    hosts.forEach((host, i) => {
      if (i === right) host.dataset.fallback = "right";
      else if (i === left) host.dataset.fallback = "left";
      else delete host.dataset.fallback;
    });
  }, [engineReady, hosts, page, count, mode, firstPageSide]);

  // Focus follows the book: onto the pages when it opens from the keyboard, back to the cover after.
  useEffect(() => {
    const want = refocus.current;
    if (state === "open" && want === "pages") {
      refocus.current = null;
      mountRef.current?.focus({ preventScroll: true });
    } else if (state === "closed" && want === "cover") {
      refocus.current = null;
      frontRef.current?.focus({ preventScroll: true });
    }
  }, [state]);

  useEffect(
    () => () => {
      swingToken.current++;
      swingCtl.current?.stop();
    },
    [],
  );

  /* ------------------------------ input ------------------------------ */

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    if (el.closest("input, textarea, select, [contenteditable='true']")) return;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        next();
        break;
      case "ArrowLeft":
      case "PageUp":
        if (stateRef.current !== "open") return;
        prev();
        break;
      case "Home":
        if (stateRef.current !== "open") return;
        flipTo(0);
        break;
      case "End":
        if (stateRef.current !== "open") return;
        flipTo(countRef.current - 1);
        break;
      case "Escape":
        if (stateRef.current !== "open") return;
        close();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  // The cover can be tapped, or taken by its edge and pulled open.
  const pull = useRef<{
    id: number;
    x: number;
    y: number;
    active: boolean;
    dead: boolean;
    samples: { x: number; t: number }[];
  } | null>(null);
  const skipClick = useRef(false);

  const onCoverPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (stateRef.current !== "closed" || turning.current) return;
    skipClick.current = false;
    pull.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false, dead: false, samples: [] };
  };

  const onCoverPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    if (!p || p.id !== e.pointerId || p.dead) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.active) {
      if (Math.hypot(dx, dy) < 9) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.15 || dx > 0 || reducedRef.current) {
        p.dead = true; // scroll, a swipe the other way, or reduced motion: decided on release
        return;
      }
      p.active = true;
      swingCtl.current?.stop();
      swingToken.current++;
      beginSwing("opening");
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* optional */
      }
    }
    p.samples.push({ x: e.clientX, t: e.timeStamp });
    if (p.samples.length > 6) p.samples.shift();
    const width = metricsRef.current?.w ?? e.currentTarget.offsetWidth;
    angle.set(-clamp(-dx / (width * 0.82), 0, 1) * 158);
  };

  const onCoverPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    if (!p || p.id !== e.pointerId) return;
    pull.current = null;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (p.active) {
      skipClick.current = true;
      const s = p.samples;
      const dt = s.length > 1 ? s[s.length - 1].t - s[0].t : 0;
      const v = dt > 0 ? (s[s.length - 1].x - s[0].x) / dt : 0;
      const commit = v < -0.3 || (v < 0.3 && angle.get() < -55);
      if (commit) {
        cb.current.onOpenChange?.(true);
        swing("open");
      } else {
        setBookState("closing");
        swing("closed");
      }
      return;
    }
    // A flick across the closed cover: left opens it, right turns the passport over.
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      skipClick.current = true;
      if (dx < 0) open();
      else turnOver("back");
    }
  };

  const onCoverPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    if (!p || p.id !== e.pointerId) return;
    pull.current = null;
    if (p.active) {
      setBookState("closing");
      swing("closed");
    }
  };

  const onCoverClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest("a, button, input, [data-no-open]")) return;
    open();
  };

  const onCoverKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      open();
    }
  };

  const onBackKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      turnOver("front");
    }
  };

  /* A swipe made while the cover is still swinging open would otherwise be lost: the pages do not
     take input until it lands. It is noted here and played on landing. */
  const onEarlyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stateRef.current !== "opening" || pull.current?.active) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    early.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onEarlyPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = early.current;
    if (!p || p.id !== e.pointerId) return;
    early.current = null;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    const turn = dx < 0 ? 1 : -1;
    if (stateRef.current === "opening") queuedTurn.current = turn;
    else if (stateRef.current === "open") {
      if (turn > 0) next();
      else prev();
    }
  };

  /* ------------------------------ render ------------------------------ */

  const pageInfos = useMemo<PassportPageInfo[]>(
    () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        count,
        width: pageW,
        height: pageH,
        mode,
        side:
          mode === "single" ? "right" : (index % 2 === 0) === (firstPageSide === "left") ? "left" : "right",
      })),
    [count, pageW, pageH, mode, firstPageSide],
  );

  const isOpen = state === "open";
  const isClosed = state === "closed";
  const spreadNow = spreadOf(page, count, mode, firstPageSide);
  const shownPage = (spreadNow.left >= 0 ? spreadNow.left : spreadNow.right) + 1;

  return (
    <div
      ref={rootRef}
      className={["ipb", className].filter(Boolean).join(" ")}
      style={style}
      role="group"
      aria-label={strings.passport.ariaBook}
      data-state={state}
      data-side={side}
      data-mode={mode}
      data-spread={spread}
      data-chrome={chrome}
      data-engine={engineReady ? "ready" : "pending"}
      data-leafed={page > 0 ? "" : undefined}
      onKeyDown={onKeyDown}
      onPointerDownCapture={onEarlyPointerDown}
      onPointerUpCapture={onEarlyPointerUp}
      onPointerCancelCapture={() => (early.current = null)}
    >
      <div ref={stageRef} className="ipb__stage">
        <div ref={bookRef} className="ipb__book">
          <div ref={castRef} className="ipb__cast" aria-hidden="true" />

          <div className="ipb__board mat-cover" aria-hidden={insideBackCover ? undefined : "true"}>
            <div className="ipb__lining mat-paper">{insideBackCover}</div>
          </div>

          <div className="ipb__stack" aria-hidden="true" />

          <div
            ref={mountRef}
            className="ipb__pages"
            role="region"
            aria-label={t(strings.passport.pageOf, { page: shownPage, total: count })}
            tabIndex={isOpen ? 0 : -1}
            inert={!isOpen}
            aria-hidden={isOpen ? undefined : "true"}
          />

          <div ref={sweepRef} className="ipb__sweep" aria-hidden="true" />

          <div className="ipb__hinge-space">
            <div ref={hingeRef} className="ipb__hinge">
              <div
                ref={frontRef}
                className={`ipb__face ipb__face--front${full ? " mat-cover" : ""}`}
                role="button"
                tabIndex={isClosed && side === "front" ? 0 : -1}
                aria-label={strings.passport.open}
                aria-expanded={!isClosed}
                aria-hidden={isOpen ? "true" : undefined}
                onPointerDown={onCoverPointerDown}
                onPointerMove={onCoverPointerMove}
                onPointerUp={onCoverPointerUp}
                onPointerCancel={onCoverPointerCancel}
                onClick={onCoverClick}
                onKeyDown={onCoverKeyDown}
              >
                <div className="ipb__cover-content">{cover}</div>
                <span className="ipb__layer ipb__sheen mat-sheen" aria-hidden="true" />
                <span className="ipb__layer ipb__spine" aria-hidden="true" />
                <span className="ipb__layer ipb__rim" aria-hidden="true" />
                <span ref={glintRef} className="ipb__layer ipb__glint" aria-hidden="true" />
                <span ref={frontShadeRef} className="ipb__layer ipb__shade" aria-hidden="true" />
              </div>
              <div className="ipb__face ipb__face--inside mat-cover" aria-hidden={insideCover ? undefined : "true"}>
                <div className="ipb__lining mat-paper">{insideCover}</div>
                <div className="ipb__turned mat-paper" aria-hidden="true" />
                <div ref={riderRef} className="ipb__rider" aria-hidden="true" />
                <span className="ipb__layer ipb__inner-gutter" aria-hidden="true" />
                <span ref={insideShadeRef} className="ipb__layer ipb__shade" aria-hidden="true" />
              </div>
              <span className="ipb__thickness" aria-hidden="true" />
            </div>
          </div>

          {hasBack && (
            <div
              ref={backRef}
              className={`ipb__back-face${full ? " mat-cover" : ""}`}
              role="button"
              tabIndex={isClosed && side === "back" ? 0 : -1}
              aria-label={strings.passport.coverTitle}
              aria-hidden={side === "back" ? undefined : "true"}
              onClick={() => turnOver("front")}
              onKeyDown={onBackKeyDown}
            >
              <div className="ipb__cover-content">{backCover}</div>
              <span className="ipb__layer ipb__sheen mat-sheen" aria-hidden="true" />
              <span className="ipb__layer ipb__spine" aria-hidden="true" />
              <span className="ipb__layer ipb__rim" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <div className="ipb__live" aria-live="polite">
        {isOpen ? t(strings.passport.pageOf, { page: shownPage, total: count }) : ""}
      </div>

      {hosts.length === count &&
        hosts.map((host, i) =>
          createPortal(
            <PageContext.Provider value={pageInfos[i]}>
              <div className={`ipb-page${full ? " mat-paper" : ""}`} data-page={i}>
                {pages[i]}
                {full && <div className="mat-page-dim ipb-page__dim" aria-hidden="true" />}
              </div>
            </PageContext.Provider>,
            host,
            `page-${i}`,
          ),
        )}
    </div>
  );
});

export default PassportBook;
