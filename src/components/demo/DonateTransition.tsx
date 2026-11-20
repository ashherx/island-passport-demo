"use client";

/**
 * Discovery becomes "Donation pending" in place (STM-2). A small, quiet change on purpose: the
 * traveler has only tapped Donate, so nothing celebrates. The solid Discovery ink drains away,
 * the paler dashed pending impression soaks in, and one dashed ring leaves the stamp.
 *
 * Rendered inside the passport page through `slotOverrides[slotId].render` (see Demo.tsx).
 */
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { Stamp } from "@/components/stamp";
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
}

export const DONATE_TRANSITION_MS = { swap: 430, total: 1020, reducedSwap: 120, reducedTotal: 320 } as const;

export function DonateTransition({ stamp, size, detail, onSwap, onDone }: DonateTransitionProps) {
  const reduced = useReducedMotion() ?? false;
  const ink = useMotionValue(reduced ? 1 : 0);
  const fromOpacity = useMotionValue(1);
  const toOpacity = useMotionValue(reduced ? 0 : 1);
  const scale = useMotionValue(1);
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
          animate(fromOpacity, 0, { delay: 0.16, duration: 0.5, ease: "easeInOut" }),
          animate(ink, 1, { delay: 0.12, duration: 0.74, ease: [0.3, 0.1, 0.3, 1] }),
          animate(scale, [1, 0.975, 1.012, 1], { duration: 0.6, times: [0, 0.22, 0.62, 1], ease: "easeOut" }),
        ];
    const swap = window.setTimeout(() => callbacks.current.onSwap?.(), reduced ? T.reducedSwap : T.swap);
    const done = window.setTimeout(() => callbacks.current.onDone?.(), reduced ? T.reducedTotal : T.total);
    return () => {
      controls.forEach((c) => c.stop());
      window.clearTimeout(swap);
      window.clearTimeout(done);
    };
  }, [reduced, fromOpacity, toOpacity, ink, scale]);

  return (
    <motion.span className="ipd-donate" style={{ width: size, height: size, scale }}>
      <motion.span className="ipd-donate__layer" style={{ opacity: fromOpacity }}>
        <Stamp stamp={stamp} status="discovery" size={size} detail={detail} decorative />
      </motion.span>
      <motion.span className="ipd-donate__layer" style={{ opacity: toOpacity }}>
        <Stamp stamp={stamp} status="pending" size={size} detail={detail} inkProgress={ink} decorative />
      </motion.span>
      {!reduced && (
        <motion.span
          className="ipd-donate__ring"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.86, 1.04, 1.2] }}
          transition={{ delay: 0.2, duration: 0.8, times: [0, 0.3, 1], ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </motion.span>
  );
}

export default DonateTransition;
