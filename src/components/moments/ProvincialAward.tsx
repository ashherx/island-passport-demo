"use client";

/**
 * <ProvincialAward />: the full-screen celebration when the Provincial Stamp is earned (UX-4, STM-4).
 *
 *   1. The screen dims to the cover colour and slow rays turn behind the stamp.
 *   2. The stamp rises on a medallion of page paper. Light crosses its foil edge. One burst of
 *      confetti made of tiny stamps, leaves and waves (canvas, at most 1.8s).
 *   3. A line of copy and "Add to passport".
 *   4. The stamp flies to its slot on the Provincial page, is pressed in and leaves an impression.
 *      `onLanded` fires at that instant so the page can show the real stamp underneath.
 *
 * Skippable at any time (Skip button or Escape). With reduced motion it is a plain fade with no
 * rays, confetti or flight. See docs/agents/celebrations.md.
 */
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Stamp, stampTilt } from "@/components/stamp";
import { scallopPath, starPath } from "@/components/stamp/geometry";
import { DirectionScope, useDirectionId, useDirectionTokens } from "@/components/theme";
import { hexToRgba } from "@/lib/directions";
import { strings, t } from "@/lib/strings";
import type { Stamp as StampData } from "@/lib/types";
import { burstConfetti } from "./celebrations/confetti";
import { HAPTICS, vibrate } from "./celebrations/haptics";
import { celebrationStrings } from "./celebrations/strings";
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
   */
  target?: AwardTarget;
  /**
   * The traveler tapped "Add to passport". Flip the book to the Provincial page here. Return a
   * promise to make the stamp wait for the page before it flies (capped at `addTimeout`).
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
}

/** Timeline of the entrance in seconds. */
export const PROVINCIAL_AWARD_TIMELINE = {
  rise: 0.12,
  confetti: 0.46,
  confettiDuration: 1.8,
  sweep: 0.78,
  copy: 0.5,
  cta: 0.86,
  flight: 0.64,
  press: 0.13,
  settle: 0.42,
} as const;

const T = PROVINCIAL_AWARD_TIMELINE;
type Bezier = [number, number, number, number];
const SOFT_EASE: Bezier = [0.22, 1, 0.36, 1];
const PRESS_EASE: Bezier = [0.6, 0, 0.9, 0.3];

type Phase = "enter" | "leaving" | "flying" | "landed" | "closing";

function resolveTarget(target: AwardTarget | undefined): DOMRect | null {
  if (!target) return null;
  const value = typeof target === "function" ? target() : target.current;
  if (!value) return null;
  const rect = value instanceof Element ? value.getBoundingClientRect() : value;
  return rect.width > 4 && rect.height > 4 ? rect : null;
}

function heroSize(): number {
  if (typeof window === "undefined") return 240;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.round(Math.max(150, Math.min(264, w * 0.62, h * 0.3)));
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** White copy of the stamp's foil (edge, beads, stars), revealed by the travelling light band. */
function FoilHighlight({ delay }: { delay: number }) {
  const C = 100;
  return (
    <svg
      className="ipc-award__foilhi ipc-sweep"
      data-run="loop"
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      style={{ "--sweep-delay": `${delay}s` } as CSSProperties}
    >
      <g fill="none" stroke="#fff" opacity="0.95">
        <path d={scallopPath(36, 92.4, 0.74)} strokeWidth={3.1} strokeLinejoin="round" />
        <circle cx={C} cy={C} r={85.2} strokeWidth={2.5} strokeDasharray="0.1 4.46" strokeLinecap="round" />
        <path d={starPath(C, 8.5, 7.6)} fill="#fff" stroke="none" />
        <path d={starPath(C - 17.5, 11.2, 4.6)} fill="#fff" stroke="none" />
        <path d={starPath(C + 17.5, 11.2, 4.6)} fill="#fff" stroke="none" />
        <path d={starPath(C, 191.6, 5.2)} fill="#fff" stroke="none" />
      </g>
    </svg>
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
  onAdd,
  addTimeout = 1400,
  onLanded,
  onComplete,
  haptics = true,
  confetti = true,
}: ProvincialAwardProps) {
  const tok = useDirectionTokens();
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;

  const [phase, setPhase] = useState<Phase>("enter");
  const [size, setSize] = useState(heroSize);
  const [impactAt, setImpactAt] = useState<{ x: number; y: number; d: number } | null>(null);
  const [announce, setAnnounce] = useState("");

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
  const timers = useRef<number[]>([]);
  const anims = useRef<AnimationPlaybackControls[]>([]);
  const stopConfetti = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onAdd, onLanded, onComplete, target, haptics });
  callbacks.current = { onAdd, onLanded, onComplete, target, haptics };

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

  /** Fade everything out and finish. Used by skip, reduced motion and the no-target fallback. */
  const close = useCallback(
    (duration = 0.22) => {
      if (phaseRef.current === "closing") return;
      goto("closing");
      stopConfetti.current?.();
      landed();
      anims.current.push(
        animate(backdropOpacity, 0, { duration, ease: "linear" }),
        animate(uiOpacity, 0, { duration: duration * 0.7, ease: "linear" }),
        animate(flyerOpacity, 0, { duration, ease: "linear" }),
      );
      later(duration + 0.02, complete);
    },
    [backdropOpacity, complete, flyerOpacity, goto, landed, later, uiOpacity],
  );

  const skip = useCallback(() => {
    if (phaseRef.current === "closing") return;
    if (phaseRef.current === "enter") {
      // The award itself is automatic (STM-4). Skipping only skips the show.
      try {
        void callbacks.current.onAdd?.();
      } catch {
        /* the integrator's handler failed: still close */
      }
    }
    anims.current.forEach((a) => a.stop());
    close(0.18);
  }, [close]);

  /** The stamp travels to its slot, is pressed in, then hands over to the real stamp on the page. */
  const fly = useCallback(() => {
    if (!aliveRef.current || phaseRef.current !== "leaving") return;
    const from = slotRef.current?.getBoundingClientRect();
    const to = resolveTarget(callbacks.current.target);
    if (!from || !to) {
      // No slot to land in: let the stamp sink away and finish.
      anims.current.push(
        animate(y, 46, { duration: 0.32, ease: "easeIn" }),
        animate(scale, 0.72, { duration: 0.32, ease: "easeIn" }),
      );
      close(0.3);
      return;
    }
    goto("flying");
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const s = Math.min(to.width, to.height) / from.width;
    const tilt = stampTilt(stamp.id, stamp.kind);
    const lift = Math.min(-18, -Math.abs(dy) * 0.16 - 14);
    const hover = s * 1.16;

    anims.current.push(
      // A shallow arc: it lifts off first, then drops onto the page.
      animate(x, dx, { duration: T.flight, ease: [0.5, 0, 0.2, 1] }),
      animate(y, [y.get(), lift, dy], { duration: T.flight, times: [0, 0.3, 1], ease: ["easeOut", [0.55, 0, 0.35, 1]] }),
      animate(scale, [scale.get(), Math.max(1.08, hover), hover], { duration: T.flight, times: [0, 0.3, 1], ease: ["easeOut", [0.55, 0, 0.35, 1]] }),
      animate(rotate, [0, -7, tilt], { duration: T.flight, times: [0, 0.35, 1], ease: "easeInOut" }),
      // The medallion is page paper: it dissolves so only ink arrives on the real page.
      animate(medalOpacity, 0, { delay: T.flight * 0.34, duration: T.flight * 0.5, ease: "easeIn" }),
    );
    later(T.flight, () => {
      anims.current.push(animate(scale, s, { duration: T.press, ease: PRESS_EASE }));
    });
    later(T.flight + T.press, () => {
      goto("landed");
      buzz(HAPTICS.awardLand);
      setImpactAt({ x: to.left + to.width / 2, y: to.top + to.height / 2, d: Math.min(to.width, to.height) });
      landed();
      // Showing the real stamp may reflow the page. Follow the slot so the hand-over stays aligned.
      requestAnimationFrame(() => {
        const now = resolveTarget(callbacks.current.target);
        if (!now || !aliveRef.current) return;
        const mx = now.left + now.width / 2 - (to.left + to.width / 2);
        const my = now.top + now.height / 2 - (to.top + to.height / 2);
        if (Math.abs(mx) < 0.5 && Math.abs(my) < 0.5) return;
        x.set(x.get() + mx);
        y.set(y.get() + my);
        setImpactAt({ x: now.left + now.width / 2, y: now.top + now.height / 2, d: Math.min(now.width, now.height) });
      });
      // Hand over to the real stamp the page now shows. The flyer holds still while it dissolves,
      // so the two impressions never double up.
      anims.current.push(animate(flyerOpacity, 0, { delay: 0.05, duration: 0.2, ease: "linear" }));
    });
    later(T.flight + T.press + T.settle + 0.06, complete);
  }, [buzz, close, complete, flyerOpacity, goto, landed, later, medalOpacity, rotate, scale, stamp.id, stamp.kind, x, y]);

  const add = useCallback(() => {
    if (phaseRef.current !== "enter") return;
    stopConfetti.current?.();
    let result: void | Promise<unknown>;
    try {
      result = callbacks.current.onAdd?.();
    } catch {
      result = undefined;
    }
    if (reduced) {
      close(0.2);
      return;
    }
    goto("leaving");
    anims.current.push(
      animate(uiOpacity, 0, { duration: 0.2, ease: "linear" }),
      animate(backdropOpacity, 0, { delay: 0.06, duration: 0.5, ease: "easeInOut" }),
      // Anticipation: the stamp lifts off the screen a touch before it travels.
      animate(scale, 1.07, { duration: 0.26, ease: SOFT_EASE }),
      animate(y, -8, { duration: 0.26, ease: SOFT_EASE }),
    );
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      fly();
    };
    if (result && typeof (result as Promise<unknown>).then === "function") {
      const wait = Math.max(0.2, addTimeout / 1000);
      (result as Promise<unknown>).then(() => later(0.05, start), () => later(0.05, start));
      later(wait, start);
    } else {
      later(0.2, start);
    }
  }, [addTimeout, backdropOpacity, close, fly, goto, later, reduced, scale, uiOpacity, y]);

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
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ctaRef.current?.focus({ preventScroll: true });

    anims.current.push(animate(backdropOpacity, 1, { duration: reduced ? 0.2 : 0.38, ease: "easeOut" }));
    if (!reduced) {
      later(T.rise + 0.3, () => buzz(HAPTICS.awardReveal));
      if (confetti) {
        later(T.confetti, () => {
          const canvas = canvasRef.current;
          const slot = slotRef.current?.getBoundingClientRect();
          if (!canvas || !slot || phaseRef.current !== "enter") return;
          const dark = tok.chrome.dark;
          stopConfetti.current = burstConfetti(canvas, {
            x: slot.left + slot.width / 2,
            y: slot.top + slot.height / 2,
            radius: slot.width * 0.5,
            duration: T.confettiDuration * 1000,
            colors: [tok.foil.base, tok.foil.hi, tok.paper.base, dark.status.verified, dark.status.discovery, dark.accent],
          });
        });
      }
    } else {
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
        const items = [skipRef.current, ctaRef.current].filter((el): el is HTMLButtonElement => !!el && !el.disabled);
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
      stopConfetti.current?.();
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
    "--award-backdrop": `radial-gradient(120% 80% at 50% 36%, ${hexToRgba(deep, 0.975)} 0%, ${hexToRgba(edge, 0.985)} 58%, ${hexToRgba(edge, 0.992)} 100%)`,
    "--award-ray": hexToRgba(tok.foil.base, 0.42),
    "--award-glow": hexToRgba(tok.foil.base, 0.34),
    "--award-fg": tok.paper.base,
    "--award-fg-muted": hexToRgba(tok.paper.base, 0.74),
    "--award-line": hexToRgba(tok.paper.base, 0.3),
  } as CSSProperties;

  const interactive = phase === "enter";
  const copy = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.6, ease: SOFT_EASE },
        };

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
      tabIndex={-1}
    >
      <motion.div className="ipc-award__backdrop" style={{ opacity: backdropOpacity }} />

      <canvas ref={canvasRef} className="ipc-award__canvas" aria-hidden="true" />

      <div className="ipc-award__stage">
        <motion.div style={{ opacity: uiOpacity }}>
          <motion.p className="ipc-award__eyebrow" {...copy(T.copy - 0.16)}>
            {t(strings.stamp.provincialOf, { province: stamp.island })}
          </motion.p>
        </motion.div>

        <div ref={slotRef} className="ipc-award__slot" style={{ width: size, height: size, marginBlock: Math.round(size * 0.095) }}>
          {!reduced && (
            <motion.div className="ipc-award__rays" style={{ opacity: uiOpacity }} aria-hidden="true">
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
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: size * 0.42, scale: 0.56, rotate: -9 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate: 0 }}
              transition={
                reduced
                  ? { duration: 0.2 }
                  : {
                      delay: T.rise,
                      opacity: { delay: T.rise, duration: 0.3, ease: "linear" },
                      default: { delay: T.rise, type: "spring", stiffness: 150, damping: 15, mass: 1 },
                    }
              }
            >
              <motion.div style={{ position: "absolute", inset: 0, opacity: medalOpacity }} aria-hidden="true">
                <motion.div className="ipc-award__glow" style={{ opacity: uiOpacity }} />
                <div className="ipc-award__medal foil-fill">
                  <div className="ipc-award__paper mat-paper" />
                </div>
                {!reduced && (
                  <div
                    className="ipc-award__gloss ipc-sweep"
                    data-run="loop"
                    style={{ "--sweep-delay": `${T.sweep}s` } as CSSProperties}
                  />
                )}
              </motion.div>
              <Stamp stamp={stamp} size={size} rotate={false} decorative />
              {!reduced && phase === "enter" && <FoilHighlight delay={T.sweep} />}
            </motion.div>
          </motion.div>
        </div>

        <motion.div style={{ opacity: uiOpacity, display: "flex", flexDirection: "column", alignItems: "center" }}>
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
            <button ref={ctaRef} type="button" className="ipc-award__cta foil-fill" onClick={add} disabled={!interactive}>
              {!reduced && (
                <span
                  className="ipc-award__cta-shine ipc-sweep"
                  data-run="loop"
                  style={{ "--sweep-delay": `${T.cta + 0.7}s` } as CSSProperties}
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
        </motion.div>
      </div>

      <motion.div style={{ opacity: uiOpacity }}>
        <button
          ref={skipRef}
          type="button"
          className="ipc-award__skip"
          onClick={skip}
          disabled={!interactive}
          aria-label={celebrationStrings.award.skipAria}
        >
          {celebrationStrings.award.skip}
        </button>
        <span className="ipc-award__sample" aria-hidden="true">
          {strings.sample.tag}
        </span>
      </motion.div>

      {/* The impression left where the stamp lands. */}
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
            initial={{ opacity: 0.5, scale: 0.96 }}
            animate={{ opacity: 0, scale: 1.3 }}
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
        </div>
      )}

      <span className="ipc-upgrade__sr" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

export default ProvincialAward;
