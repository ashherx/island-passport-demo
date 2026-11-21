"use client";

/**
 * Option B "Photos" view of an island: the map is covered by a sheet of paper and the island's
 * photos are dealt onto it as a stack of prints. Swipe or use the arrows to go through them; on a
 * desktop a row of thumbnails sits underneath.
 *
 * Photos come from the shared <Photo> slot, so a picture that has not been supplied yet shows its
 * placeholder drawing instead of a broken image.
 */
import { motion, type PanInfo } from "motion/react";
import { type CSSProperties, type KeyboardEvent } from "react";
import { Photo } from "@/components/options-ui";
import { islandStrings, type IslandPhoto } from "@/lib/islands";
import { t } from "@/lib/strings";
import { IconArrowLeft, IconChevron, IconMap, Tape } from "./bits";
import { bStrings } from "./strings";

export interface PhotoTableProps {
  name: string;
  photos: IslandPhoto[];
  index: number;
  onIndex(index: number): void;
  onClose(): void;
  wide: boolean;
  reduced: boolean;
  /** Where the table sits: the part of the screen the card leaves free. */
  style: CSSProperties;
}

/** How each print in the stack lies: the top one nearly straight, the ones under it fanned out. */
const LIE = [
  { rotate: -2, x: 0, y: 0, scale: 1, opacity: 1 },
  { rotate: 4.5, x: 16, y: 8, scale: 0.97, opacity: 1 },
  { rotate: -6, x: -15, y: 14, scale: 0.94, opacity: 1 },
  { rotate: 2, x: 0, y: 16, scale: 0.9, opacity: 0 },
];

export function PhotoTable({ name, photos, index, onIndex, onClose, wide, reduced, style }: PhotoTableProps) {
  const n = photos.length;
  const go = (step: number) => onIndex((index + step + n) % n);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -520) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 520) go(-1);
  };

  return (
    <motion.div
      className="ob-table"
      style={style}
      role="group"
      aria-roledescription="carousel"
      aria-label={t(bStrings.photos.label, { name })}
      onKeyDown={onKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.28 }}
    >
      <div className="ob-table-stack">
        {photos.map((photo, i) => {
          const depth = (i - index + n) % n;
          const lie = LIE[Math.min(depth, LIE.length - 1)];
          const top = depth === 0;
          return (
            <motion.figure
              key={photo.name}
              className="ob-print"
              data-top={top ? "" : undefined}
              aria-hidden={top ? undefined : true}
              style={{ zIndex: n - depth }}
              initial={reduced ? false : { opacity: 0, y: 60, rotate: lie.rotate * 3, scale: 0.86 }}
              animate={lie}
              transition={reduced ? { duration: 0.01 } : { type: "spring", stiffness: 230, damping: 20, delay: top ? 0 : Math.min(depth, 3) * 0.04 }}
              drag={top && n > 1 && !reduced ? "x" : false}
              dragSnapToOrigin
              dragElastic={0.7}
              onDragEnd={onDragEnd}
              whileDrag={{ rotate: 0, scale: 1.02 }}
            >
              <Tape tone={i % 2 ? "mint" : "sun"} className="ob-print-tape" />
              <Photo
                name={photo.name}
                alt={top ? photo.alt : ""}
                aspect={4 / 3}
                sizes={wide ? "(min-width: 900px) 520px, 80vw" : "80vw"}
                className="ob-print-photo"
                priority={depth < 2}
                showSampleTag
              />
              <figcaption className="ob-print-cap">{photo.caption}</figcaption>
            </motion.figure>
          );
        })}
      </div>

      <div className="ob-table-bar">
        <button type="button" className="ob-round" onClick={() => go(-1)} aria-label={bStrings.photos.previous} disabled={n < 2}>
          <IconArrowLeft size={18} />
        </button>
        <p className="ob-table-count" aria-live="polite">
          {t(islandStrings.card.photoCount, { n: index + 1, total: n })}
        </p>
        <button type="button" className="ob-round" onClick={() => go(1)} aria-label={bStrings.photos.next} disabled={n < 2}>
          <IconChevron size={18} />
        </button>
      </div>

      {wide ? (
        <ul className="ob-thumbs" aria-label={t(bStrings.photos.label, { name })}>
          {photos.map((photo, i) => (
            <li key={photo.name}>
              <button type="button" className="ob-thumb" aria-label={t(bStrings.photos.show, { n: i + 1 })} aria-current={i === index ? "true" : undefined} onClick={() => onIndex(i)}>
                <Photo name={photo.name} alt="" aspect={1} sizes="64px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" className="ob-table-back" onClick={onClose}>
        <IconMap size={16} />
        {bStrings.photos.back}
      </button>
    </motion.div>
  );
}
