"use client";

/**
 * Option C: the island as photographs.
 *
 * The card's Map | Photos toggle swaps what fills the stage: the live map, or this full-bleed
 * photo viewer in the same place (above the sheet on a phone, beside the panel on a desktop).
 * Swipe, use the arrow keys or the buttons; each photo slides in with its caption and its number.
 * Until the real photographs are supplied, <Photo> draws its placeholder here too.
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Photo } from "@/components/options-ui";
import { islandStrings, type IslandPhoto } from "@/lib/islands";
import { t } from "@/lib/strings";
import { cStrings } from "./strings";
import { ArrowIcon, pad2 } from "./ui";

export interface PhotoStageProps {
  name: string;
  photos: IslandPhoto[];
  index: number;
  onIndex(index: number): void;
  onBackToMap(): void;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function PhotoStage({ name, photos, index, onIndex, onBackToMap }: PhotoStageProps) {
  const total = photos.length;
  const photo = photos[Math.min(index, total - 1)];
  const direction = useRef(1);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);

  const go = (delta: number) => {
    direction.current = delta;
    onIndex((index + delta + total) % total);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight") {
        direction.current = 1;
        onIndex((index + 1) % total);
      } else if (event.key === "ArrowLeft") {
        direction.current = -1;
        onIndex((index - 1 + total) % total);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, onIndex]);

  const onPointerDown = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.2) go(dx < 0 ? 1 : -1);
  };

  if (!photo) return null;

  return (
    <motion.section
      className="oc-stage"
      aria-label={t(cStrings.stage.label, { name })}
      aria-roledescription="carousel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: "linear" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
    >
      <AnimatePresence initial={false} custom={direction.current}>
        <motion.div
          key={photo.name}
          className="oc-stage-photo"
          custom={direction.current}
          variants={{
            enter: (d: number) => ({ clipPath: d > 0 ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)" }),
            show: { clipPath: "inset(0% 0% 0% 0%)" },
            exit: { opacity: 0.999 },
          }}
          initial="enter"
          animate="show"
          exit="exit"
          transition={{ duration: 0.55, ease: EASE }}
        >
          <Photo name={photo.name} alt={photo.alt} aspect="fill" sizes="(min-width: 900px) 70vw, 100vw" priority showSampleTag />
        </motion.div>
      </AnimatePresence>

      <div className="oc-stage-shade" aria-hidden="true" />

      <div className="oc-stage-caption" aria-live="polite">
        <span className="oc-stage-count">
          <span className="oc-stage-count-now">{pad2(index + 1)}</span>
          <span className="oc-stage-count-total">/ {pad2(total)}</span>
          <span className="oc-sr">{t(islandStrings.card.photoCount, { n: index + 1, total })}</span>
        </span>
        <motion.span key={photo.name} className="oc-stage-text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.12 }}>
          {photo.caption}
        </motion.span>
      </div>

      {total > 1 ? (
        <div className="oc-stage-nav">
          <button type="button" className="oc-icon-button oc-icon-button-solid" onClick={() => go(-1)} aria-label={cStrings.stage.previous}>
            <ArrowIcon direction="left" />
          </button>
          <button type="button" className="oc-icon-button oc-icon-button-solid" onClick={() => go(1)} aria-label={cStrings.stage.next}>
            <ArrowIcon />
          </button>
        </div>
      ) : null}

      <button type="button" className="oc-stage-back" onClick={onBackToMap}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {islandStrings.card.view.map}
        <span className="oc-sr">: {cStrings.stage.backToMap}</span>
      </button>

      {total > 1 ? (
        <ol className="oc-stage-ticks" aria-hidden="true">
          {photos.map((p, i) => (
            <li key={p.name} data-on={i === index ? "" : undefined} />
          ))}
        </ol>
      ) : null}
    </motion.section>
  );
}
