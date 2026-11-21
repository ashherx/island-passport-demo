"use client";

/**
 * Discovery becomes "Donation pending" in place (STM-2). A small, quiet change on purpose: the
 * traveler has only tapped Donate, so nothing celebrates. It reads as something added to the
 * stamp, never as the stamp fading away:
 *
 *     0 ms   a dashed line starts at 12 o'clock and runs clockwise round the edge (450 ms),
 *            while the pending impression soaks in underneath the solid Discovery ink (700 ms)
 *   250 ms   the Discovery ink starts to give way (gone by 750 ms)
 *   430 ms   onSwap: the pending ink is the one that reads now
 *   450 ms   the clock badge pops on; one dashed ring leaves the stamp
 *  1020 ms   onDone
 *
 * Rendered inside the passport page through `slotOverrides[slotId].render` (see Demo.tsx).
 */
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef } from "react";
import { outlinePath } from "@/components/moments/celebrations/outline";
import { Stamp, stampTilt } from "@/components/stamp";
import type { Stamp as StampData } from "@/lib/types";

export interface DonateTransitionProps {
  stamp: StampData;
  /** Pixel size of the stamp box, as the page draws it. */
  size: number;
  detail?: "auto" | "compact" | "full" | "large";
  /** Half-way: the pending ink is the one that reads now. Commit the new status here. */
  onSwap?(): void;
  /** Finished: the page's own stamp can take over. */
  onDone?(): void;
  /** Overrides the device's reduced-motion setting. */
  reduced?: boolean;
}

export const DONATE_TRANSITION_MS = { swap: 430, total: 1020, reducedSwap: 120, reducedTotal: 320 } as const;

const INK_EASE = [0.3, 0.1, 0.3, 1] as const;
/** Milliseconds: the clock badge pops on once the dashed line has closed. */
const BADGE = { at: 450, duration: 220 } as const;

export function DonateTransition({ stamp, size, detail, onSwap, onDone, reduced: reducedProp }: DonateTransitionProps) {
  const deviceReduced = useReducedMotion() ?? false;
  const reduced = reducedProp ?? deviceReduced;
  const maskId = `ipd${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-draw`;
  const ink = useMotionValue(reduced ? 1 : 0);
  const fromOpacity = useMotionValue(1);
  const toOpacity = useMotionValue(reduced ? 0 : 1);
  const scale = useMotionValue(1);
  const pendingLayer = useRef<HTMLSpanElement>(null);
  const callbacks = useRef({ onSwap, onDone });
  callbacks.current = { onSwap, onDone };

  useEffect(() => {
    const T = DONATE_TRANSITION_MS;
    const controls = reduced
      ? [
          animate(fromOpacity, 0, { duration: 0.24, ease: "linear" }),
          animate(toOpacity, 1, { duration: 0.24, ease: "linear" }),
        ]
      : [
          // The ink on the page never dips: the solid impression holds until the new one is there.
          animate(fromOpacity, 0, { delay: 0.25, duration: 0.5, ease: "easeInOut" }),
          animate(ink, 1, { duration: 0.7, ease: INK_EASE }),
          animate(scale, [1, 0.975, 1.012, 1], { duration: 0.6, times: [0, 0.22, 0.62, 1], ease: "easeOut" }),
        ];

    // The clock badge is part of the pending stamp's own drawing: it pops on from nothing.
    let badge: Animation | null = null;
    const mark = reduced ? null : pendingLayer.current?.querySelector<SVGGElement>(".ip-stamp__pendingmark");
    if (mark && typeof mark.animate === "function") {
      mark.style.transformBox = "fill-box";
      mark.style.transformOrigin = "center";
      try {
        badge = mark.animate(
          [
            { transform: "scale(0)", easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
            { transform: "scale(1.15)", offset: 0.62, easing: "ease-in-out" },
            { transform: "scale(1)" },
          ],
          { delay: BADGE.at, duration: BADGE.duration, fill: "backwards" },
        );
      } catch {
        badge = null;
      }
    }

    const swap = window.setTimeout(() => callbacks.current.onSwap?.(), reduced ? T.reducedSwap : T.swap);
    const done = window.setTimeout(() => callbacks.current.onDone?.(), reduced ? T.reducedTotal : T.total);
    return () => {
      controls.forEach((c) => c.stop());
      badge?.cancel();
      window.clearTimeout(swap);
      window.clearTimeout(done);
    };
  }, [reduced, fromOpacity, toOpacity, ink, scale]);

  const outline = outlinePath(stamp.shape);
  // 1.6 px on screen, in the stamp's 200-unit box, with the dashes of the pending outline it becomes.
  const lineWidth = (1.6 * 200) / Math.max(1, size);
  const compact = detail === "compact" || ((detail ?? "auto") === "auto" && size < 120);

  return (
    <motion.span className="ipd-donate" style={{ width: size, height: size, scale }}>
      <motion.span className="ipd-donate__layer" style={{ opacity: fromOpacity }}>
        <Stamp stamp={stamp} status="discovery" size={size} detail={detail} decorative />
      </motion.span>
      <motion.span ref={pendingLayer} className="ipd-donate__layer" style={{ opacity: toOpacity }}>
        <Stamp stamp={stamp} status="pending" size={size} detail={detail} inkProgress={ink} decorative />
      </motion.span>
      {!reduced && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            pointerEvents: "none",
            transform: `rotate(${stampTilt(stamp.id, stamp.kind)}deg)`,
          }}
        >
          <motion.svg
            viewBox="0 0 200 200"
            width="100%"
            height="100%"
            focusable="false"
            style={{ display: "block", overflow: "visible", color: "var(--ink-pending)" }}
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.75, 1], ease: "linear" }}
          >
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x="-10" y="-10" width="220" height="220">
                <motion.path
                  d={outline}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={lineWidth * 3}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45, ease: INK_EASE }}
                />
              </mask>
            </defs>
            <path
              d={outline}
              fill="none"
              stroke="currentColor"
              strokeWidth={lineWidth}
              strokeDasharray={compact ? "10 7.5" : "7.5 5.5"}
              mask={`url(#${maskId})`}
            />
          </motion.svg>
        </span>
      )}
      {!reduced && (
        <motion.span
          className="ipd-donate__ring"
          aria-hidden="true"
          style={{ borderWidth: 1.5 }}
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.86, 1.04, 1.2] }}
          transition={{ delay: 0.2, duration: 0.8, times: [0, 0.3, 1], ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </motion.span>
  );
}

export default DonateTransition;
