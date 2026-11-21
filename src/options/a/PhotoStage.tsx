"use client";

/**
 * The "Photos" side of the Map | Photos toggle: the island seen as pictures, laid over the map
 * area (above the sheet on a phone, beside the panel on a desktop). A native scroll-snap row, so
 * it swipes with the platform's own momentum; arrow keys and buttons for everyone else.
 */
import { memo, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { Photo } from "@/components/options-ui";
import { hasPhoto, islandStrings, type LiveIsland } from "@/lib/islands";
import { t } from "@/lib/strings";
import { galleryOf } from "./Card";
import { aStrings } from "./strings";

export interface PhotoStageProps {
  island: LiveIsland;
  /** Shown (the toggle is on Photos). Hidden stages stay mounted so the cross-fade can run. */
  active: boolean;
  index: number;
  onIndex(index: number): void;
  style?: CSSProperties;
}

export const PhotoStage = memo(function PhotoStage({ island, active, index, onIndex, style }: PhotoStageProps) {
  const row = useRef<HTMLDivElement>(null);
  const photos = galleryOf(island);
  const total = photos.length;
  /** Index the row was last scrolled to by us, so a scroll event does not echo back. */
  const settled = useRef(index);

  const scrollTo = useCallback((i: number, smooth: boolean) => {
    const el = row.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, []);

  // Follow the index when it is set from outside (a thumbnail in the card, the arrow buttons).
  useEffect(() => {
    if (settled.current === index) return;
    settled.current = index;
    scrollTo(index, active);
  }, [index, active, scrollTo]);

  // Becoming visible: make sure the row sits on the current photo.
  useEffect(() => {
    if (active) scrollTo(settled.current, false);
  }, [active, scrollTo]);

  const onScroll = () => {
    const el = row.current;
    if (!el || !el.clientWidth) return;
    const i = Math.max(0, Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
    if (i !== settled.current) {
      settled.current = i;
      onIndex(i);
    }
  };

  const go = (i: number) => onIndex(Math.max(0, Math.min(total - 1, i)));
  const current = photos[Math.min(index, total - 1)];

  return (
    <section className="da-photos" data-active={active ? "" : undefined} data-empty={hasPhoto(current.name) ? undefined : ""} aria-label={t(aStrings.photos.label, { name: island.name })} aria-hidden={active ? undefined : true} style={style}>
      <div
        ref={row}
        className="da-photos-row"
        tabIndex={active ? 0 : -1}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(index + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(index - 1);
          }
        }}
      >
        {photos.map((photo, i) => (
          <figure key={photo.name} className="da-photos-slide" aria-hidden={i === index ? undefined : true}>
            <Photo name={photo.name} alt={photo.alt} aspect="fill" sizes="(min-width: 900px) 62vw, 100vw" priority={i === 0} />
          </figure>
        ))}
      </div>

      <div className="da-photos-bar">
        <p className="da-photos-caption" aria-live="polite">
          <span>{current.caption}</span>
          <span className="da-photos-sample">{islandStrings.sample.photo}</span>
        </p>
        <div className="da-photos-nav">
          <button type="button" onClick={() => go(index - 1)} disabled={index <= 0} aria-label={aStrings.photos.previous} tabIndex={active ? 0 : -1}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M10 3.500 5.500 8l4.500 4.500" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="da-photos-count">{t(aStrings.photos.count, { n: index + 1, total })}</span>
          <button type="button" onClick={() => go(index + 1)} disabled={index >= total - 1} aria-label={aStrings.photos.next} tabIndex={active ? 0 : -1}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M6 3.500 10.500 8 6 12.500" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
});
