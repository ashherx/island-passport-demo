"use client";

/**
 * <ProvincialAward />: the full-screen celebration when the Provincial Stamp is earned (UX-4, STM-4).
 *
 *   1. The screen dims to the cover colour and slow rays turn behind the stamp.
 *   2. The stamp lands on a medallion of page paper with a small overshoot. Light crosses its foil
 *      edge. Confetti made of tiny stamps, leaves and waves (canvas, at most 1.8s).
 *   3. A line of copy, "Add to passport" and, under it, Skip.
 *   4. On Add the medallion lifts up and out of the book's way while the dialog clears, so the
 *      riffle to the Provincial page plays in full view. Then the stamp flies an arc to its slot,
 *      is pressed in (the page takes the hit) and hands over to the real stamp on the page.
 *      `onLanded` fires at the instant of contact so the page can show the real stamp underneath.
 *
 * Skippable at any time (Skip button or Escape). With reduced motion it is a plain fade with no
 * rays, confetti or flight. See docs/agents/celebrations.md.
 */
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Stamp, stampTilt } from "@/components/stamp";
import { scallopPath, starPath } from "@/components/stamp/geometry";
import { DirectionScope, useDirectionId, useDirectionTokens } from "@/components/theme";
import { hexToRgba } from "@/lib/directions";
import { play as sfx, type SoundHandle } from "@/lib/sound";
import { strings, t } from "@/lib/strings";
import type { Stamp as StampData } from "@/lib/types";
import { burstConfetti } from "./celebrations/confetti";
import { HAPTICS, vibrate } from "./celebrations/haptics";
import { celebrationStrings } from "./celebrations/strings";
import { nudge } from "./stamp-press/feedback";
import "./celebrations/celebrations.css";

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type AwardTarget = RefObject<HTMLElement | null> | (() => HTMLElement | DOMRect | null | undefined);

export interface ProvincialAwardProps {
  /** Show the celebration. Set it back to false in `onComplete`. */
  open: boolean;
  /** The Provincial Stamp as it looks once awarded (e.g. `passport.provincial.stamp`). */
  stamp: StampData;
  /** Number of Verified Supporter stamps that earned it, for the line of copy. */
  verifiedCount: number;
  /**
   * Where the stamp lands: the slot on the Provincial page (a ref, or a function returning the
   * element or its DOMRect). It is measured after `onAdd` resolves. The slot should be square and
   * the size the page draws the stamp at. Without a target the stamp simply drops away.
   *
   * Hand-over: after `onLanded` the flying stamp stays on the page until the real one is there,
   * then fades. A function target says so by returning the real stamp's element (return a DOMRect
   * until then); with a ref, the element must contain a collected `.ip-stamp`. Capped at 0.6 s.
   * While the flying stamp is still settling, the real one is held invisible (inline opacity,
   * restored at the hand-over and on unmount at the latest), so the two never show doubled.
   */
  target?: AwardTarget;
  /**
   * Element that takes the hit when the stamp lands (the page or the whole book): it is nudged
   * like in the stamping moment. Default: the nearest ancestor of the target element with
   * `data-press-surface`, else nothing moves.
   */
  surface?: Element | RefObject<Element | null> | null;
  /**
   * The traveler tapped "Add to passport". Flip the book to the Provincial page here. Return a
   * promise to make the stamp wait for the page before it flies (capped at `addTimeout`).
   * Also called on Skip, which waits for it the same way before `onLanded`.
   */
  onAdd?(): void | Promise<unknown>;
  /** Longest wait for `onAdd`, in ms. Default 1400. */
  addTimeout?: number;
  /**
   * The stamp is on the page (also fires on skip). Show the real stamp in the slot now.
   * Always fires exactly once per opening, before `onComplete`.
   */
  onLanded?(): void;
  /** The overlay has finished and can be unmounted: set `open` to false. */
  onComplete?(): void;
  /** Vibrate on reveal and on landing, where supported. Default true. */
  haptics?: boolean;
  /** Confetti burst. Default true (always off with reduced motion). */
  confetti?: boolean;
  /**
   * Force reduced motion on or off (the host's own switch). Default: the device setting
   * (`prefers-reduced-motion`).
   */
  reducedMotion?: boolean;
}

/** Timeline in seconds. */
export const PROVINCIAL_AWARD_TIMELINE = {
  /** Entrance: the medallion arrives (scale 0.7 to 1.06 to 1, a quarter turn of the wrist). */
  rise: 0.12,
  riseDuration: 0.52,
  confetti: 0.42,
  confettiDuration: 1.8,
  sweep: 0.78,
  copy: 0.5,
  cta: 0.86,
  /** Taps on Skip and Add are ignored for this long after the dialog opens (Escape is not). */
  tapGuard: 0.6,
  /** Add: the medallion moves up and out of the book's way while the dialog clears. */
  lift: 0.28,
  /** The arc from there to the slot. */
  flight: 0.52,
  /** Pressed into the page: contact is at the end of this. */
  press: 0.11,
  /** 0.94 to 1.03 to 1 after contact. */
  settle: 0.26,
  /** The glint crosses the impression this long after contact. */
  glint: 0.15,
  /**
   * Hand-over to the page's own stamp, which starts when the settle has played and the real stamp
   * is on the page, and no later than `handOverMax` after contact: the real stamp comes up under
   * the flying one (`handOverIn`) while the flying one thins away (`handOverFade`).
   */
  handOverMax: 0.6,
  handOverIn: 0.1,
  handOverFade: 0.2,
} as const;

const T = PROVINCIAL_AWARD_TIMELINE;
type Bezier = [number, number, number, number];
const SOFT_EASE: Bezier = [0.22, 1, 0.36, 1];
const PRESS_EASE: Bezier = [0.6, 0, 0.9, 0.3];

/**
 * Where the medallion waits while the book riffles to the Provincial page: up, small, and a little
 * to the left (`x` is a fraction of the viewport width, capped at `maxX` px), so that the flight to
 * a slot straight below it is still an arc and not a drop.
 */
const LIFT = { y: 150, x: -0.16, maxX: 64, scale: 0.62, rotate: -6 } as const;
/** The glint that crosses the impression after the landing, in seconds. */
const GLINT_DURATION = 0.34;
/** Radius of the medallion (stamp plus foil rim) in multiples of the stamp size. */
const MEDAL_RADIUS = 0.595;
/** The page takes this hit when the stamp lands (see nudge() in stamp-press/feedback). */
const LAND_NUDGE = 1.6;
/** A collected stamp, as opposed to the dashed placeholder of an empty slot. */
const REAL_STAMP = '.ip-stamp:not([data-status="empty"])';
const LANDSCAPE_PHONE = "(max-height: 480px) and (orientation: landscape)";

type Phase = "enter" | "leaving" | "flying" | "landed" | "closing";

function readTarget(target: AwardTarget | undefined): Element | DOMRect | null {
  if (!target) return null;
  const value = typeof target === "function" ? target() : target.current;
  return value ?? null;
}

function rectOf(value: Element | DOMRect | null): DOMRect | null {
  if (!value) return null;
  if (value instanceof Element && !value.isConnected) return null;
  const rect = value instanceof Element ? value.getBoundingClientRect() : value;
  return rect.width > 4 && rect.height > 4 && Number.isFinite(rect.left + rect.top) ? rect : null;
}

/** The real stamp on the page, once the host shows it (see `target` in the props). */
function realStamp(target: AwardTarget | undefined, value: Element | DOMRect | null): HTMLElement | null {
  if (!(value instanceof HTMLElement) || !value.isConnected) return null;
  if (typeof target === "function") return value;
  return value.matches(REAL_STAMP) ? value : value.querySelector<HTMLElement>(REAL_STAMP);
}

function surfaceOf(surface: ProvincialAwardProps["surface"], target: Element | DOMRect | null): Element | null {
  if (surface instanceof Element) return surface;
  if (surface && "current" in surface) return surface.current;
  if (surface === undefined && target instanceof Element) return target.closest("[data-press-surface]");
  return null;
}

const centreOf = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function heroSize(): number {
  if (typeof window === "undefined") return 240;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // A phone on its side: the seal sits beside the copy and may use most of the height.
  if (window.matchMedia?.(LANDSCAPE_PHONE).matches) return Math.round(Math.max(120, Math.min(220, h * 0.62, w * 0.3)));
  return Math.round(Math.max(150, Math.min(264, w * 0.62, h * 0.3)));
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** The stamp's foil (edge, beads, stars) as a mask image: the light band shows only through it. */
function foilMask(): string {
  const C = 100;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g fill="none" stroke="#fff">` +
    `<path d="${scallopPath(36, 92.4, 0.74)}" stroke-width="3.1" stroke-linejoin="round"/>` +
    `<circle cx="${C}" cy="${C}" r="85.2" stroke-width="2.5" stroke-dasharray="0.1 4.46" stroke-linecap="round"/>` +
    `<g fill="#fff" stroke="none">` +
    `<path d="${starPath(C, 8.5, 7.6)}"/><path d="${starPath(C - 17.5, 11.2, 4.6)}"/>` +
    `<path d="${starPath(C + 17.5, 11.2, 4.6)}"/><path d="${starPath(C, 191.6, 5.2)}"/>` +
    `</g></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Light catching the stamp's foil. The mask is static and the band inside it only translates, so
 * the pass is composited: nothing is repainted (the old version animated mask-position).
 */
function FoilHighlight({ delay }: { delay: number }) {
  const mask = useMemo(foilMask, []);
  return (
    <div className="ipc-award__foilhi" style={{ WebkitMaskImage: mask, maskImage: mask }} aria-hidden="true">
      <i className="ipc-band" style={{ "--band-delay": `${delay}s` } as CSSProperties} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ProvincialAward(props: ProvincialAwardProps) {
  const direction = useDirectionId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !props.open) return null;
  // Portal to <body> so a transformed ancestor (the book) cannot trap the fixed overlay.
  return createPortal(
    <DirectionScope direction={direction}>
      <AwardOverlay {...props} />
    </DirectionScope>,
    document.body,
  );
}

function AwardOverlay({
  stamp,
  verifiedCount,
  target,
  surface,
  onAdd,
  addTimeout = 1400,
  onLanded,
  onComplete,
  haptics = true,
  confetti = true,
  reducedMotion,
}: ProvincialAwardProps) {
  const tok = useDirectionTokens();
  const deviceReduced = useReducedMotion() ?? false;
  const reduced = reducedMotion ?? deviceReduced;
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;

  const [phase, setPhase] = useState<Phase>("enter");
  const [size, setSize] = useState(heroSize);
  const [impactAt, setImpactAt] = useState<{ x: number; y: number; d: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  // The confetti canvas is a full-screen layer: it is in the document only while a burst can play.
  const [confettiOn, setConfettiOn] = useState(confetti && !reduced);

  const rootRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  // Flight transform of the stamp (the entrance animates a child, so the two never fight).
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const rotate = useMotionValue(0);
  const flyerOpacity = useMotionValue(1);
  const medalOpacity = useMotionValue(1);
  const backdropOpacity = useMotionValue(0);
  const uiOpacity = useMotionValue(1);

  const phaseRef = useRef<Phase>("enter");
  const landedRef = useRef(false);
  const doneRef = useRef(false);
  const aliveRef = useRef(true);
  const openedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const anims = useRef<AnimationPlaybackControls[]>([]);
  const followRaf = useRef(0);
  const stopConfetti = useRef<(() => void) | null>(null);
  const adding = useRef<Promise<void> | null>(null);
  /** The page's real stamp while it is held invisible under the settling flyer. */
  const held = useRef<{ el: HTMLElement; opacity: string; transition: string } | null>(null);
  /** The swell that plays while the award is presented, and the whoosh and hit of the flight. */
  const revealSound = useRef<SoundHandle | null>(null);
  const landSound = useRef<SoundHandle | null>(null);
  const callbacks = useRef({ onAdd, onLanded, onComplete, target, surface, haptics });
  callbacks.current = { onAdd, onLanded, onComplete, target, surface, haptics };

  const goto = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const later = useCallback((seconds: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, seconds * 1000));
  }, []);
  const buzz = useCallback((pattern: readonly number[]) => {
    if (callbacks.current.haptics) vibrate(pattern);
  }, []);

  /** Give the page's real stamp back its own opacity (and, a frame later, its transition). */
  const release = useCallback((fade = 0) => {
    const h = held.current;
    if (!h) return;
    held.current = null;
    const { el, opacity, transition } = h;
    if (fade > 0) {
      void el.offsetWidth; // start the fade from the held state
      el.style.transition = `opacity ${fade}s linear`;
      el.style.opacity = opacity;
      window.setTimeout(() => {
        el.style.transition = transition;
      }, fade * 1000 + 60);
    } else {
      el.style.transition = "none";
      el.style.opacity = opacity;
      requestAnimationFrame(() => {
        el.style.transition = transition;
      });
    }
  }, []);

  /** Fade out whatever this award is playing (Skip, Escape, a flight with nowhere to land, unmount). */
  const quiet = useCallback((fade?: number) => {
    revealSound.current?.stop(fade);
    revealSound.current = null;
    landSound.current?.stop(fade);
    landSound.current = null;
  }, []);

  const endConfetti = useCallback(() => {
    stopConfetti.current?.();
    stopConfetti.current = null;
    setConfettiOn(false);
  }, []);

  const landed = useCallback(() => {
    if (landedRef.current) return;
    landedRef.current = true;
    setAnnounce(celebrationStrings.award.added);
    callbacks.current.onLanded?.();
  }, []);

  const complete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    landed();
    callbacks.current.onComplete?.();
  }, [landed]);

  /** Fade the whole overlay out. */
  const fadeOut = useCallback(
    (duration: number) => {
      goto("closing");
      endConfetti();
      release();
      anims.current.push(
        animate(backdropOpacity, 0, { duration, ease: "linear" }),
        animate(uiOpacity, 0, { duration: duration * 0.7, ease: "linear" }),
        animate(flyerOpacity, 0, { duration, ease: "linear" }),
      );
    },
    [backdropOpacity, endConfetti, flyerOpacity, goto, release, uiOpacity],
  );

  /** Fade everything out and finish. Used by a late skip and the no-target fallback. */
  const close = useCallback(
    (duration = 0.22) => {
      if (phaseRef.current === "closing") return;
      fadeOut(duration);
      landed();
      later(duration + 0.02, complete);
    },
    [complete, fadeOut, landed, later],
  );

  /**
   * Ask the host to turn to the Provincial page (once). Resolves when the page is there, or after
   * `addTimeout`, whichever is first.
   */
  const runAdd = useCallback((): Promise<void> => {
    if (adding.current) return adding.current;
    let result: void | Promise<unknown>;
    try {
      result = callbacks.current.onAdd?.();
    } catch {
      result = undefined; // the integrator's handler failed: carry on
    }
    adding.current = new Promise<void>((resolve) => {
      if (result && typeof (result as Promise<unknown>).then === "function") {
        const settle = () => resolve();
        (result as Promise<unknown>).then(settle, settle);
        later(Math.max(0.2, addTimeout / 1000), settle);
      } else {
        resolve();
      }
    });
    return adding.current;
  }, [addTimeout, later]);

  /**
   * Leave without the flight (Skip, or Add with reduced motion). The award itself is automatic
   * (STM-4), so the book still turns to the Provincial page; the overlay clears at once so that
   * is in view, and the stamp is shown on the page when the page is there.
   */
  const leaveQuietly = useCallback(
    (duration: number) => {
      const arrived = runAdd();
      fadeOut(duration);
      let faded = false;
      let there = false;
      const finish = () => {
        if (!faded || !there || !aliveRef.current) return;
        landed();
        complete();
      };
      later(duration + 0.02, () => {
        faded = true;
        finish();
      });
      void arrived.then(() => {
        there = true;
        finish();
      });
    },
    [complete, fadeOut, landed, later, runAdd],
  );

  const skip = useCallback(() => {
    const now = phaseRef.current;
    if (now === "closing") return;
    anims.current.forEach((a) => a.stop());
    cancelAnimationFrame(followRaf.current);
    // Skipped: the swell, and a flight that will now never land, go with the picture.
    quiet(0.18);
    if (now === "enter" || now === "leaving") leaveQuietly(0.18);
    else close(0.18);
  }, [close, leaveQuietly, quiet]);

  /** Contact: the stamp is on the page. The page takes the hit and the real stamp takes over. */
  const touchDown = useCallback(
    (to: DOMRect, s: number) => {
      if (!aliveRef.current || phaseRef.current !== "flying") return;
      goto("landed");
      buzz(HAPTICS.awardLand);
      nudge(surfaceOf(callbacks.current.surface, readTarget(callbacks.current.target)), LAND_NUDGE);
      let at = centreOf(to);
      setImpactAt({ x: at.x, y: at.y, d: Math.min(to.width, to.height) });
      landed();
      anims.current.push(animate(scale, [s * 0.94, s * 1.03, s], { duration: T.settle, times: [0, 0.5, 1], ease: ["easeOut", "easeInOut"] }));

      /*
       * Hand over to the real stamp. The host shows it when `onLanded` commits, which may be a few
       * frames late (a transition). Three rules:
       *   - the flying stamp stays, at full strength, until the real one is on the page (or
       *     `handOverMax`), so the two are never both gone;
       *   - while the flying stamp is still settling (it changes size), the real one is held
       *     invisible, so the two never show doubled;
       *   - until it has faded, the flying stamp follows the slot every frame (the nudge moves the
       *     page, and showing the real stamp may reflow it).
       */
      const t0 = performance.now();
      let fadeAt = 0;
      let frames = 0;
      const follow = () => {
        followRaf.current = 0;
        if (!aliveRef.current || phaseRef.current !== "landed") return;
        const now = performance.now();
        const elapsed = (now - t0) / 1000;
        const value = readTarget(callbacks.current.target);
        const rect = rectOf(value);
        frames += 1;
        if (rect) {
          const c = centreOf(rect);
          const mx = c.x - at.x;
          const my = c.y - at.y;
          if (Math.abs(mx) >= 0.2 || Math.abs(my) >= 0.2) {
            x.set(x.get() + mx);
            y.set(y.get() + my);
            at = c;
            // A reflow right after the commit moves the rings too. The nudge alone does not.
            if (frames <= 3 && Math.hypot(mx, my) >= 3) setImpactAt({ x: c.x, y: c.y, d: Math.min(rect.width, rect.height) });
          }
        }
        if (!fadeAt) {
          const real = realStamp(callbacks.current.target, value);
          if (real && real !== held.current?.el) {
            release();
            held.current = { el: real, opacity: real.style.opacity, transition: real.style.transition };
            real.style.transition = "none";
            real.style.opacity = "0";
          }
          if ((held.current && elapsed >= T.settle) || elapsed >= T.handOverMax) {
            fadeAt = now;
            release(T.handOverIn);
            anims.current.push(animate(flyerOpacity, 0, { duration: T.handOverFade, ease: "linear" }));
          }
        } else if ((now - fadeAt) / 1000 >= T.handOverFade + 0.03 && elapsed >= Math.max(T.settle + 0.06, T.glint + GLINT_DURATION + 0.02)) {
          complete();
          return;
        }
        followRaf.current = requestAnimationFrame(follow);
      };
      followRaf.current = requestAnimationFrame(follow);
      // Frames stop in a hidden tab: never leave the host waiting.
      later(T.handOverMax + T.handOverFade + 0.4, complete);
    },
    [buzz, complete, flyerOpacity, goto, landed, later, release, scale, x, y],
  );

  /** The stamp flies an arc from where it waits to its slot and is pressed in. */
  const fly = useCallback(() => {
    if (!aliveRef.current || phaseRef.current !== "leaving") return;
    const from = slotRef.current?.getBoundingClientRect();
    const to = rectOf(readTarget(callbacks.current.target));
    if (!from || !to) {
      // No slot to land in: let the stamp sink away and finish.
      quiet(0.3);
      anims.current.push(
        animate(y, y.get() + 46, { duration: 0.32, ease: "easeIn" }),
        animate(scale, scale.get() * 0.72, { duration: 0.32, ease: "easeIn" }),
      );
      close(0.3);
      return;
    }
    goto("flying");
    // Whoosh through the flight, the hit on the audio clock exactly where touchDown() is due.
    landSound.current = sfx.provincialLand({ flight: T.flight, press: T.press });
    const a = centreOf(from);
    const b = centreOf(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const s = Math.min(to.width, to.height) / from.width;
    const tilt = stampTilt(stamp.id, stamp.kind);
    const y0 = y.get();
    // It rises a little more before it drops, but never off the top of the screen.
    const top = a.y + y0 - from.width * MEDAL_RADIUS * scale.get();
    const rise = Math.max(0, Math.min(36, top - 4));

    anims.current.push(
      // Across first, then down: it is over the slot before it comes down hard.
      animate(x, dx, { duration: T.flight, ease: [0.5, 0, 0.15, 1] }),
      animate(y, [y0, y0 - rise, dy], { duration: T.flight, times: [0, 0.3, 1], ease: ["easeOut", PRESS_EASE] }),
      animate(rotate, [rotate.get(), 4, tilt], { duration: T.flight, times: [0, 0.46, 1], ease: "easeInOut" }),
      animate(scale, s * 1.16, { duration: T.flight, ease: [0.45, 0, 0.55, 1] }),
      // The medallion is page paper: it dissolves so only ink arrives on the real page.
      animate(medalOpacity, 0, { delay: T.flight * 0.4, duration: T.flight * 0.46, ease: "easeIn" }),
    );
    later(T.flight, () => {
      anims.current.push(animate(scale, s * 0.94, { duration: T.press, ease: "easeIn" }));
    });
    later(T.flight + T.press, () => touchDown(to, s));
  }, [close, goto, later, medalOpacity, quiet, rotate, scale, stamp.id, stamp.kind, touchDown, x, y]);

  const add = useCallback(() => {
    if (phaseRef.current !== "enter") return;
    if (reduced) {
      revealSound.current?.stop(0.2);
      revealSound.current = null;
      leaveQuietly(0.2);
      return;
    }
    endConfetti();
    const arrived = runAdd();
    goto("leaving");
    // The presentation is over: its swell lets go while the medallion lifts, and the riffle and
    // the flight are heard on their own.
    revealSound.current?.stop(T.lift);
    revealSound.current = null;

    // Up and out of the book's way, staying a little below the top safe area.
    const root = rootRef.current;
    const slot = slotRef.current?.getBoundingClientRect();
    const safeTop = root ? parseFloat(getComputedStyle(root).paddingTop) || 0 : 0;
    let liftY = -LIFT.y;
    let liftX = Math.max(-LIFT.maxX, window.innerWidth * LIFT.x);
    if (slot) {
      const radius = slot.width * MEDAL_RADIUS * LIFT.scale;
      const c = centreOf(slot);
      liftY = Math.min(0, Math.max(-LIFT.y, safeTop + 12 + radius - c.y));
      // Never off the left edge either.
      liftX = Math.min(0, Math.max(liftX, 8 + radius - c.x));
    }
    anims.current.push(
      animate(uiOpacity, 0, { duration: 0.2, ease: "linear" }),
      animate(backdropOpacity, 0, { duration: 0.5, ease: "easeInOut" }),
      animate(x, liftX, { duration: T.lift, ease: SOFT_EASE }),
      animate(y, liftY, { duration: T.lift, ease: SOFT_EASE }),
      animate(scale, LIFT.scale, { duration: T.lift, ease: SOFT_EASE }),
      animate(rotate, LIFT.rotate, { duration: T.lift, ease: SOFT_EASE }),
    );

    // Fly as soon as both the lift has played and the page is there.
    let lifted = false;
    let there = false;
    let started = false;
    const start = () => {
      if (started || !lifted || !there) return;
      started = true;
      // Two frames for the page to settle where the riffle left it, then measure and go.
      later(0.032, fly);
    };
    later(T.lift, () => {
      lifted = true;
      start();
    });
    void arrived.then(() => {
      there = true;
      start();
    });
  }, [backdropOpacity, endConfetti, fly, goto, later, leaveQuietly, reduced, rotate, runAdd, scale, uiOpacity, x, y]);

  /* A tap that was aimed at the page just before the dialog opened must not land on a button. */
  const guarded = useCallback(
    (fn: () => void) => {
      // With reduced motion the buttons are fully visible after 0.2 s, so the guard ends sooner.
      const guard = reduced ? Math.min(T.tapGuard, 0.3) : T.tapGuard;
      if (performance.now() - openedAt.current < guard * 1000) return;
      fn();
    },
    [reduced],
  );
  const onAddClick = useCallback(() => guarded(add), [add, guarded]);
  const onSkipClick = useCallback(() => guarded(skip), [guarded, skip]);

  /* --- Entrance -------------------------------------------------------- */

  useLayoutEffect(() => {
    const onResize = () => {
      if (phaseRef.current === "enter") setSize(heroSize());
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    openedAt.current = performance.now();
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ctaRef.current?.focus({ preventScroll: true });

    anims.current.push(animate(backdropOpacity, 1, { duration: reduced ? 0.2 : 0.38, ease: "easeOut" }));
    if (!reduced) {
      // The swell rises with the backdrop and the medallion and blooms with the confetti burst.
      // Nothing was tapped to open this: it plays through the audio the earlier taps unlocked.
      // (Kept across the effect's double run in React's dev mode: see the clean-up below.)
      revealSound.current ??= sfx.provincialReveal({ bloomAt: T.confetti });
      later(T.rise + 0.3, () => buzz(HAPTICS.awardReveal));
      if (confetti) {
        later(T.confetti, () => {
          const canvas = canvasRef.current;
          const slot = slotRef.current?.getBoundingClientRect();
          if (!canvas || !slot || phaseRef.current !== "enter") {
            setConfettiOn(false);
            return;
          }
          const dark = tok.chrome.dark;
          stopConfetti.current = burstConfetti(canvas, {
            x: slot.left + slot.width / 2,
            y: slot.top + slot.height / 2,
            radius: slot.width * 0.5,
            duration: T.confettiDuration * 1000,
            colors: [tok.foil.base, tok.foil.hi, tok.paper.base, dark.status.verified, dark.status.discovery, dark.accent],
            // Finished (or stopped): take the canvas out of the document.
            onDone: () => {
              if (aliveRef.current) setConfettiOn(false);
            },
          });
        });
      }
    } else {
      // A plain fade: two notes of the chime, no swell.
      revealSound.current ??= sfx.verified({ chimeOnly: true, notes: 2 });
      buzz(HAPTICS.soft);
    }

    // Keyboard: Escape skips, Tab stays inside, and arrow keys never reach the book underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        skip();
        return;
      }
      if (e.key === "Tab") {
        const items = [ctaRef.current, skipRef.current].filter((el): el is HTMLButtonElement => !!el && !el.disabled);
        if (items.length === 0) return;
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length] ?? items[0];
        e.preventDefault();
        next.focus();
        return;
      }
      if (e.key.startsWith("Arrow") || e.key === "PageUp" || e.key === "PageDown" || e.key === "Home" || e.key === "End") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);

    const timerList = timers;
    const animList = anims;
    return () => {
      aliveRef.current = false;
      window.removeEventListener("keydown", onKey, true);
      timerList.current.forEach((id) => window.clearTimeout(id));
      timerList.current = [];
      animList.current.forEach((a) => a.stop());
      animList.current = [];
      cancelAnimationFrame(followRaf.current);
      stopConfetti.current?.();
      stopConfetti.current = null;
      // The swell never outlives the dialog. Decided a task later, because React's dev mode runs
      // this clean-up once right after mounting and the swell must survive that. The landing is
      // left to ring: when the overlay goes after a flight, the stamp is on the page and its
      // sparkle tail belongs there.
      window.setTimeout(() => {
        if (aliveRef.current) return;
        revealSound.current?.stop(0.15);
        revealSound.current = null;
      }, 0);
      release();
      document.body.style.overflow = prevOverflow;
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
    // Runs once per opening: the overlay is mounted when `open` turns true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Render ---------------------------------------------------------- */

  const kraft = tok.cover.material === "kraft";
  const deep = kraft ? tok.cover.ink : tok.cover.deep;
  const edge = kraft ? "#14100b" : tok.cover.edge;
  const vars = {
    // Opaque: nothing of the page may ghost through the celebration. The entrance and exit fades
    // run on the backdrop's own opacity, so the book still shows through while the stamp is added.
    "--award-backdrop": `radial-gradient(120% 80% at 50% 36%, ${hexToRgba(deep, 1)} 0%, ${hexToRgba(edge, 1)} 58%, ${hexToRgba(edge, 1)} 100%)`,
    "--award-ray": hexToRgba(tok.foil.base, 0.42),
    "--award-glow": hexToRgba(tok.foil.base, 0.34),
    "--award-fg": tok.paper.base,
    "--award-fg-muted": hexToRgba(tok.paper.base, 0.74),
    "--award-line": hexToRgba(tok.paper.base, 0.3),
  } as CSSProperties;

  const interactive = phase === "enter";
  // The light bands and the rays belong to the presentation: gone once the stamp is on its way.
  const shining = !reduced && phase === "enter";
  const copy = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.6, ease: SOFT_EASE },
        };
  const tilt = stampTilt(stamp.id, stamp.kind);

  return (
    <div
      ref={rootRef}
      className="ipc-award"
      style={{ ...vars, pointerEvents: interactive ? "auto" : "none" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      data-phase={phase}
      data-reduced={reduced ? "true" : undefined}
      tabIndex={-1}
    >
      <motion.div className="ipc-award__backdrop" style={{ opacity: backdropOpacity }} />

      {confettiOn && <canvas ref={canvasRef} className="ipc-award__canvas" aria-hidden="true" />}

      <div className="ipc-award__stage">
        <motion.div className="ipc-award__ui" style={{ opacity: uiOpacity }}>
          <motion.p className="ipc-award__eyebrow" {...copy(T.copy - 0.16)}>
            {t(strings.stamp.provincialOf, { province: stamp.island })}
          </motion.p>
        </motion.div>

        <div ref={slotRef} className="ipc-award__slot" style={{ width: size, height: size, marginBlock: Math.round(size * 0.095) }}>
          {!reduced && (phase === "enter" || phase === "leaving" || phase === "closing") && (
            <motion.div className="ipc-award__rays ipc-award__ui" style={{ opacity: uiOpacity }} aria-hidden="true">
              <motion.div
                style={{ position: "absolute", inset: 0 }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: T.rise + 0.1, duration: 1.1, ease: SOFT_EASE }}
              >
                <i />
              </motion.div>
            </motion.div>
          )}
          <motion.div className="ipc-award__flyer" style={{ x, y, scale, rotate, opacity: flyerOpacity }}>
            <motion.div
              className="ipc-award__rise"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: size * 0.1, scale: 0.7, rotate: -10 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: [0.7, 1.06, 1], rotate: 0 }}
              transition={
                reduced
                  ? { duration: 0.2 }
                  : {
                      delay: T.rise,
                      duration: T.riseDuration,
                      ease: SOFT_EASE,
                      opacity: { delay: T.rise, duration: 0.18, ease: "linear" },
                      // Arrives a touch large, then settles: the overshoot gives it weight.
                      scale: { delay: T.rise, duration: T.riseDuration, times: [0, 0.6, 1], ease: [SOFT_EASE, "easeInOut"] },
                    }
              }
            >
              <motion.div className="ipc-award__medalwrap" style={{ opacity: medalOpacity }} aria-hidden="true">
                <motion.div className="ipc-award__glow ipc-award__ui" style={{ opacity: uiOpacity }} />
                <div className="ipc-award__medal foil-fill">
                  <div className="ipc-award__paper mat-paper" />
                </div>
                {shining && (
                  <div className="ipc-award__gloss">
                    <i className="ipc-band" style={{ "--band-delay": `${T.sweep}s` } as CSSProperties} />
                  </div>
                )}
              </motion.div>
              <div className="ipc-award__stamp">
                <Stamp stamp={stamp} size={size} rotate={false} decorative />
              </div>
              {shining && <FoilHighlight delay={T.sweep} />}
            </motion.div>
          </motion.div>
        </div>

        <motion.div className="ipc-award__copy ipc-award__ui" style={{ opacity: uiOpacity }}>
          <motion.h2 id={titleId} className="ipc-award__title type-display foil-text" {...copy(T.copy)}>
            {strings.moments.provincialTitle}
          </motion.h2>
          <motion.p id={bodyId} className="ipc-award__body" {...copy(T.copy + 0.1)}>
            {t(strings.moments.provincialBody, { n: verifiedCount, province: stamp.island })}
          </motion.p>
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.94 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            transition={reduced ? { duration: 0.2 } : { delay: T.cta, duration: 0.6, ease: SOFT_EASE }}
          >
            <button ref={ctaRef} type="button" className="ipc-award__cta foil-fill" onClick={onAddClick} disabled={!interactive}>
              {shining && (
                <span
                  className="ipc-award__cta-shine ipc-band"
                  style={{ "--band-delay": `${T.cta + 0.7}s` } as CSSProperties}
                  aria-hidden="true"
                />
              )}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 2.5 H13.5 A1.5 1.5 0 0 1 15 4 V14 A1.5 1.5 0 0 1 13.5 15.5 H4.5 A1.5 1.5 0 0 1 3 14 V4 A1.5 1.5 0 0 1 4.5 2.5 Z" />
                <path d="M9 6 V12 M6 9 H12" />
              </svg>
              <span style={{ position: "relative" }}>{celebrationStrings.award.cta}</span>
            </button>
          </motion.div>
          <motion.div {...(reduced ? copy(0) : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: T.cta + 0.2, duration: 0.5, ease: "linear" as const } })}>
            <button
              ref={skipRef}
              type="button"
              className="ipc-award__skip"
              onClick={onSkipClick}
              disabled={!interactive}
              aria-label={celebrationStrings.award.skipAria}
            >
              {celebrationStrings.award.skip}
            </button>
          </motion.div>
        </motion.div>
      </div>

      <motion.div className="ipc-award__ui" style={{ opacity: uiOpacity }}>
        <span className="ipc-award__sample" aria-hidden="true">
          {strings.sample.tag}
        </span>
      </motion.div>

      {/* What the landing leaves behind: two rings and one glint across the impression. */}
      {impactAt && !reduced && (
        <div aria-hidden="true">
          <motion.div
            className="ipc-award__impact"
            style={{
              left: impactAt.x - impactAt.d / 2,
              top: impactAt.y - impactAt.d / 2,
              width: impactAt.d,
              height: impactAt.d,
              boxShadow: "0 0 0 2px var(--ink-provincial)",
            }}
            initial={{ opacity: 0.62, scale: 0.96 }}
            animate={{ opacity: 0, scale: 1.32 }}
            transition={{ duration: 0.6, ease: SOFT_EASE }}
          />
          <motion.div
            className="ipc-award__impact"
            style={{
              left: impactAt.x - impactAt.d / 2,
              top: impactAt.y - impactAt.d / 2,
              width: impactAt.d,
              height: impactAt.d,
              boxShadow: "0 0 0 1.5px var(--foil), 0 0 14px 2px var(--foil-hi)",
            }}
            initial={{ opacity: 0.85, scale: 1 }}
            animate={{ opacity: 0, scale: 1.62 }}
            transition={{ delay: 0.05, duration: 0.75, ease: SOFT_EASE }}
          />
          <div
            className="ipc-award__glint"
            style={{
              left: impactAt.x - impactAt.d * 0.47,
              top: impactAt.y - impactAt.d * 0.47,
              width: impactAt.d * 0.94,
              height: impactAt.d * 0.94,
              transform: `rotate(${tilt}deg)`,
            }}
          >
            <motion.i
              style={{ skewX: -20 }}
              initial={{ x: "-150%" }}
              animate={{ x: "290%" }}
              transition={{ delay: T.glint, duration: GLINT_DURATION, ease: [0.3, 0, 0.5, 1] }}
            />
          </div>
        </div>
      )}

      <span className="ipc-upgrade__sr" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

export default ProvincialAward;
