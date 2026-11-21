"use client";

/**
 * Stamp detail (PAS-4): island, promoter, charity, conservation purpose, date and status, in a
 * bottom sheet that springs up from the edge of the screen.
 *
 * - Rendered in a portal on <body>, so the page-flip transforms never clip it. The portal root
 *   carries data-direction, so it keeps the art direction of the page it was opened from.
 * - Drag the handle or the header down to dismiss; Escape and the backdrop also close it.
 * - Focus moves into the sheet, is kept inside it, and returns to the stamp on close. Keys are
 *   handled on the window while the sheet is open, so Escape and Tab work wherever focus is
 *   (after a tap on the text of the sheet it is on the panel or on <body>).
 * - Reduced motion: a plain fade.
 */
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Stamp } from "@/components/stamp";
import { useDirectionId } from "@/components/theme";
import { formatDate, strings, statusLabel } from "@/lib/strings";
import type { Stamp as StampData } from "@/lib/types";
import { contentStrings as cs } from "./strings";
import "./content.css";

export interface StampDetailSheetProps {
  /** The stamp to show. Null closes the sheet; the last stamp stays drawn while it leaves. */
  stamp: StampData | null;
  onClose(): void;
  /** Province name, shown under the island and for the Provincial Stamp. */
  province?: string;
}

/** `a[href]`, not `[href]`: the stamp's SVG has <textPath href> and <use href>, which cannot take focus. */
const FOCUSABLE = 'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function StampDetailSheet({ stamp, onClose, province }: StampDetailSheetProps) {
  const direction = useDirectionId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {stamp && <SheetBody key="sheet" stamp={stamp} onClose={onClose} province={province} direction={direction} />}
    </AnimatePresence>,
    document.body,
  );
}

interface SheetBodyProps {
  stamp: StampData;
  onClose(): void;
  province?: string;
  direction: string;
}

function SheetBody({ stamp, onClose, province, direction }: SheetBodyProps) {
  const reduce = useReducedMotion();
  const drag = useDragControls();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const provincial = stamp.kind === "provincial";

  const close = useRef(onClose);
  close.current = onClose;

  // Focus in, focus back out, and stop the page behind from scrolling.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (closeButton.current ?? panel.current)?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  // The sheet is modal: while it is mounted it owns the keyboard. Listening on the window in the
  // capture phase means this runs wherever focus is and before the book underneath sees the key
  // (Escape would close the book too, arrow keys would turn its pages).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = panel.current;
      if (!root) return;
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && active !== root && root.contains(active);
      if (!inside) {
        // Focus is on the panel itself, on <body> or behind the sheet: bring it back in.
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 650) onClose();
  };

  const status = stamp.status;
  // The title of the Provincial Stamp's sheet already says "Provincial Stamp": its pill says "Awarded".
  const statusText = provincial ? cs.sheet.awarded : statusLabel(status);
  const statusBlurb = provincial ? "" : strings.status[status].blurb;

  // The status is the pill under the title. It is not repeated as a row.
  const rows: { label: string; value: string; mono?: boolean }[] = provincial
    ? [
        { label: cs.sheet.provincialIsland, value: province ?? stamp.island },
        { label: cs.sheet.reason, value: stamp.purpose },
        { label: strings.stampDetail.date, value: formatDate(stamp.date), mono: true },
      ]
    : [
        {
          label: strings.stampDetail.island,
          // "Balicasag, Bohol", but not "Bohol, Bohol" for the main island.
          value: province && province !== stamp.island ? `${stamp.island}, ${province}` : stamp.island,
        },
        { label: strings.stampDetail.promoter, value: stamp.promoter },
        { label: strings.stampDetail.charity, value: stamp.charity },
        { label: strings.stampDetail.purpose, value: stamp.purpose },
        { label: strings.stampDetail.date, value: formatDate(stamp.date), mono: true },
      ].filter((row) => row.value);

  const spring = { type: "spring" as const, stiffness: 270, damping: 25, mass: 1 };
  const rowDelay = (i: number) => (reduce ? 0 : 0.1 + i * 0.035);

  return (
    <div className="ipp-sheet-root" data-direction={direction} data-status={provincial ? "provincial" : status}>
      <motion.div
        className="ipp-sheet__backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.28 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        ref={panel}
        className="ipp-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduce ? { opacity: 0 } : { y: "104%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: "104%", transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
        transition={reduce ? { duration: 0.15 } : spring}
        drag={reduce ? false : "y"}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.7 }}
        onDragEnd={onDragEnd}
      >
        <div className="ipp-sheet__grab" onPointerDown={(e) => !reduce && drag.start(e)}>
          <span className="ipp-sheet__handle" aria-hidden="true" />
          <span className="ipp-sheet__eyebrow">{strings.stampDetail.heading}</span>
          <button
            ref={closeButton}
            type="button"
            className="ipp-sheet__close"
            aria-label={strings.stampDetail.close}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="ipp-sheet__scroll">
          <div className="ipp-sheet__hero mat-paper" onPointerDown={(e) => !reduce && drag.start(e)}>
            <motion.div
              className="ipp-sheet__stamp"
              initial={reduce ? false : { scale: 0.82, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 18, delay: 0.08 }}
            >
              <Stamp stamp={stamp} size={provincial ? 176 : 164} detail={provincial ? "large" : "full"} decorative />
            </motion.div>
            <span className="mat-page-dim ipp-sheet__hero-dim" aria-hidden="true" />
            <span className="sample-tag ipp-sheet__sample">{strings.sample.tag}</span>
          </div>

          <div className="ipp-sheet__head">
            <h2 id={titleId} className="ipp-sheet__title type-display">
              {provincial ? strings.country.regionalStampLabel : stamp.title}
            </h2>
            <p className="ipp-sheet__status">
              <span className="ipp-sheet__chip">
                <i aria-hidden="true" />
                {statusText}
              </span>
              {statusBlurb && <span className="ipp-sheet__blurb">{statusBlurb}</span>}
            </p>
          </div>

          <dl className="ipp-sheet__rows">
            {rows.map((row, i) => (
              <motion.div
                key={row.label}
                className="ipp-sheet__row"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36, delay: rowDelay(i), ease: [0.22, 1, 0.36, 1] }}
              >
                <dt>{row.label}</dt>
                <dd data-mono={row.mono ? "" : undefined}>{row.value}</dd>
              </motion.div>
            ))}
          </dl>

          <p className="ipp-sheet__note">
            {strings.sample.notice} {strings.sample.noDonations}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
