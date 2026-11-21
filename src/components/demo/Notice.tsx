"use client";

/**
 * The message that follows each moment ("Stamp collected", "Donation pending" and so on).
 * It drops in under the header, over the intro line, so it never covers the stamp it describes.
 * The demo fires it a fixed beat after the moment's impact, so it reads as the echo of the hit.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { strings } from "@/lib/strings";

export type NoticeTone = "discovery" | "pending" | "verified" | "provincial" | "neutral";

export interface NoticeData {
  id: number;
  tone: NoticeTone;
  title: string;
  body: string;
  /** Milliseconds on screen. Default 5200. */
  duration?: number;
}

export interface NoticeProps {
  notice: NoticeData | null;
  onDismiss(): void;
  /** Overrides the device's reduced-motion setting. */
  reduced?: boolean;
}

export function Notice({ notice, onDismiss, reduced: reducedProp }: NoticeProps) {
  const deviceReduced = useReducedMotion() ?? false;
  const reduced = reducedProp ?? deviceReduced;

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(onDismiss, notice.duration ?? 5200);
    return () => window.clearTimeout(id);
  }, [notice, onDismiss]);

  return (
    <div className="ipd-notice-slot" role="status" aria-live="polite">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            className="ipd-notice"
            data-tone={notice.tone}
            // A short drop and no scale: four of these arrive in one story, each as the echo of a hit
            // on the page, so the entrance stays out of the way.
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0.18 } } : { opacity: 0, y: -8, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
          >
            <span className="ipd-notice__mark" aria-hidden="true" />
            <span className="ipd-notice__text">
              <span className="ipd-notice__title">{notice.title}</span>
              <span className="ipd-notice__body">{notice.body}</span>
            </span>
            <button type="button" className="ipd-notice__close" onClick={onDismiss} aria-label={strings.demo.toast.dismiss}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Notice;
