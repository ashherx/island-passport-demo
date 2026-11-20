"use client";

/**
 * Collection progress ring (UX-1b): "6 of 12 Bohol stamps".
 *
 * - The arc is driven by a spring, so it sweeps in on first paint and overshoots a little when a
 *   stamp is added. Motion values write straight to the SVG; React does not re-render per frame.
 * - The count rolls like an odometer, the dial bumps and a ripple leaves it when the count goes up.
 * - `breakdown` splits the arc into the three status colours (Verified, pending, Discovery).
 * - Reduced motion: values change with no animation.
 */
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { contentStrings as cs } from "@/components/passport/content/strings";
import { useDirectionId } from "@/components/theme";
import { strings, t } from "@/lib/strings";
import type { StampStatus } from "@/lib/types";
import "./chrome.css";

export interface ProgressRingProps {
  /** Stamps collected, of any status. */
  collected: number;
  total: number;
  /** Province name for the label, e.g. "Bohol". */
  province: string;
  /** Per-status counts. When given, the arc is drawn in the three status colours. */
  breakdown?: Partial<Record<StampStatus, number>>;
  /** Diameter of the dial in px. Default 44. */
  size?: number;
  /** Stroke width in px. Default scales with size. */
  thickness?: number;
  /** "side" prints "of 12 / Bohol stamps" beside the dial; "none" shows the dial only. */
  label?: "side" | "none";
  /** Makes the ring a button (e.g. to open My Stats). */
  onClick?(): void;
  className?: string;
}

const SPRING = { stiffness: 150, damping: 13, mass: 0.9 };
const ORDER: StampStatus[] = ["verified", "pending", "discovery"];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface ArcProps {
  /** Start and end as fractions of the circle (0..1). */
  from: MotionValue<number>;
  to: MotionValue<number>;
  radius: number;
  thickness: number;
  color: string;
  round: boolean;
}

function Arc({ from, to, radius, thickness, color, round }: ArcProps) {
  const circumference = 2 * Math.PI * radius;
  const dasharray = useTransform(() => {
    const length = Math.max(0, clamp01(to.get()) - clamp01(from.get())) * circumference;
    return `${length.toFixed(2)} ${(circumference - length + 1).toFixed(2)}`;
  });
  const dashoffset = useTransform(() => -clamp01(from.get()) * circumference);
  const opacity = useTransform(() => (to.get() - from.get() > 0.002 ? 1 : 0));
  return (
    <motion.circle
      cx="50%"
      cy="50%"
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={thickness}
      strokeLinecap={round ? "round" : "butt"}
      style={{ strokeDasharray: dasharray, strokeDashoffset: dashoffset, opacity }}
    />
  );
}

/** A spring that follows `target`; jumps instead when motion is reduced. */
function useFollow(target: number, reduce: boolean | null): MotionValue<number> {
  const value = useSpring(0, SPRING);
  useEffect(() => {
    if (reduce) value.jump(target);
    else value.set(target);
  }, [target, reduce, value]);
  return value;
}

export function ProgressRing({
  collected,
  total,
  province,
  breakdown,
  size = 44,
  thickness,
  label = "side",
  onClick,
  className,
}: ProgressRingProps) {
  const reduce = useReducedMotion();
  const dir = useDirectionId();
  const stroke = thickness ?? Math.max(3, Math.round(size * 0.095));
  const radius = (size - stroke) / 2;
  const safeTotal = Math.max(1, total);

  // Segment boundaries as fractions: 0, verified, verified + pending, collected.
  const counts = ORDER.map((s) => breakdown?.[s] ?? 0);
  const split = breakdown !== undefined && counts.reduce((a, b) => a + b, 0) > 0;
  const edge1 = split ? counts[0] / safeTotal : collected / safeTotal;
  const edge2 = split ? (counts[0] + counts[1]) / safeTotal : collected / safeTotal;
  const edge3 = collected / safeTotal;

  const zero = useFollow(0, reduce);
  const a = useFollow(edge1, reduce);
  const b = useFollow(edge2, reduce);
  const c = useFollow(edge3, reduce);

  // React to the count changing: roll direction, bump and ripple.
  const previous = useRef(collected);
  const [direction, setDirection] = useState(1);
  const [ripple, setRipple] = useState(0);
  const bump = useAnimationControls();
  useEffect(() => {
    const before = previous.current;
    previous.current = collected;
    if (before === collected) return;
    setDirection(collected > before ? 1 : -1);
    if (collected > before && !reduce) {
      setRipple((n) => n + 1);
      void bump.start({
        scale: [1, 1.17, 0.97, 1],
        transition: { duration: 0.62, times: [0, 0.28, 0.66, 1], ease: "easeOut" },
      });
    }
  }, [collected, reduce, bump]);

  const aria = [
    t(strings.progress.ariaRing, { n: collected, total, province }),
    breakdown
      ? t(strings.progress.byStatus, {
          verified: breakdown.verified ?? 0,
          pending: breakdown.pending ?? 0,
          discovery: breakdown.discovery ?? 0,
        })
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const dial = (
    <motion.span className="ipc-ring__dial" style={{ width: size, height: size }} animate={bump}>
      {ripple > 0 && (
        <motion.span
          key={ripple}
          className="ipc-ring__ripple"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        />
      )}
      <svg className="ipc-ring__svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ipc-ring__track" cx="50%" cy="50%" r={radius} fill="none" strokeWidth={stroke} />
        {split ? (
          <>
            <Arc from={b} to={c} radius={radius} thickness={stroke} color="var(--status-discovery)" round />
            <Arc from={a} to={b} radius={radius} thickness={stroke} color="var(--status-pending)" round />
            <Arc from={zero} to={a} radius={radius} thickness={stroke} color="var(--status-verified)" round />
          </>
        ) : (
          <Arc from={zero} to={c} radius={radius} thickness={stroke} color="var(--accent)" round />
        )}
      </svg>
      <span className="ipc-ring__count" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.span
            key={collected}
            custom={direction}
            variants={{
              enter: (dir: number) => (reduce ? { opacity: 0 } : { y: `${dir * 85}%`, opacity: 0 }),
              center: { y: "0%", opacity: 1 },
              exit: (dir: number) => (reduce ? { opacity: 0 } : { y: `${dir * -85}%`, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.1 } : { type: "spring", stiffness: 520, damping: 26 }}
          >
            {collected}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.span>
  );

  const text =
    label === "side" ? (
      <span className="ipc-ring__label" aria-hidden="true">
        <span className="ipc-ring__of">{t(cs.header.ringOf, { total })}</span>
        <span className="ipc-ring__what">{t(cs.header.ringBottom, { province })}</span>
      </span>
    ) : null;

  const classes = ["ipc-ring", className].filter(Boolean).join(" ");
  const vars = { "--ring-fs": `${Math.round(size * 0.42)}px` } as CSSProperties;
  if (onClick) {
    return (
      <button type="button" className={classes} data-label={label} data-dir={dir} style={vars} aria-label={aria} onClick={onClick}>
        {dial}
        {text}
      </button>
    );
  }
  return (
    <div className={classes} data-label={label} data-dir={dir} style={vars}>
      {/* A live region, so a screen reader hears the count change. The visuals are hidden from it. */}
      <span className="ipc-sr" role="status">
        {aria}
      </span>
      {dial}
      {text}
    </div>
  );
}
