"use client";

/**
 * Small building blocks for the partner flow: an animated number, a segmented control with a
 * sliding pill, a seal medallion, the still photo post (with the QR sticker built in) and a few
 * icons the kit does not have. Styles: ./partner.css
 */
import { motion } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type SVGProps } from "react";
import { BrandMark, QrCode, usePrefersReducedMotion, useShareTarget } from "@/components/share/kit";
import { photoAsset, photoSources } from "@/lib/islands/photos";
import type { PhotoName } from "@/lib/islands/types";
import { SHARE_DOMAIN, shareDisplayUrl } from "@/lib/share";
import type { ShareAvatar } from "@/lib/share/types";
import { strings } from "@/lib/strings";
import type { PhotoChoice } from "./data";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const IconMail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.6" />
    <path d="m4 8 8 5.6L20 8" />
  </Svg>
);
export const IconQr = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1.4" />
    <rect x="14" y="4" width="6" height="6" rx="1.4" />
    <rect x="4" y="14" width="6" height="6" rx="1.4" />
    <path d="M14 14h2.5v2.5M20 14v0M14 20h0M17.5 20H20v-2.5" />
  </Svg>
);
export const IconVideo = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="6" width="12.5" height="12" rx="2.6" />
    <path d="m16 10.4 4.5-2.6v8.4L16 13.6" />
  </Svg>
);
export const IconPhoto = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.6" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17 4.6-4.2 3.4 3 2.6-2.2 4.4 3.6" />
  </Svg>
);
export const IconPen = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 19.5 5.6 15 15.8 4.8a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L9 18.4z" />
    <path d="m14 6.6 3.4 3.4" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.6" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </Svg>
);
export const IconGlobeWeb = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
    <path d="M3 9h18M6.2 6.8h0M8.8 6.8h0" />
  </Svg>
);
export const IconLeaf = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 19c0-8 5-13.5 14.5-14 .4 9-4.6 14.4-12.5 14.4" />
    <path d="M5 19c2.4-4.5 5.4-7.6 9.5-9.8" />
  </Svg>
);
export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5c.7 4.3 2.2 5.8 6.5 6.5-4.3.7-5.8 2.2-6.5 6.5-.7-4.3-2.2-5.8-6.5-6.5 4.3-.7 5.8-2.2 6.5-6.5Z" />
    <path d="M18.5 15.5c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z" />
  </Svg>
);
export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.3 2.8 7.6 7 9 4.2-1.4 7-4.7 7-9V6z" />
    <path d="m9 12 2.2 2.2L15.2 10" />
  </Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

/* ------------------------------------------------------------------ */
/* Animated number                                                     */
/* ------------------------------------------------------------------ */

const number = new Intl.NumberFormat("en-US");

/** Counts up to `value` when it mounts and whenever the value changes. */
export function CountUp({ value, prefix = "", duration = 1000 }: { value: number; prefix?: string; duration?: number }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = Math.round(start + (value - start) * eased);
      from.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return (
    <span className="pf-count" aria-label={`${prefix}${number.format(value)}`}>
      <span aria-hidden="true">
        {prefix}
        {number.format(shown)}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
}

/** A row of choices with a pill that slides to the selected one. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "m",
  className = "",
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: "m" | "s";
  className?: string;
}) {
  const id = useId();
  const reduced = usePrefersReducedMotion();
  return (
    <div className={`pf-seg ${className}`} role="group" aria-label={label} data-size={size}>
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button type="button" key={option.id} className="pf-seg-btn" aria-pressed={on} onClick={() => onChange(option.id)}>
            {on ? (
              <motion.span
                className="pf-seg-pill"
                layoutId={`${id}-pill`}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
              />
            ) : null}
            <span className="pf-seg-text">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seal medallion                                                      */
/* ------------------------------------------------------------------ */

function burst(points: number, outer: number, inner: number): string {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d += `${i ? "L" : "M"}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

const BURST = burst(18, 23, 20.6);

/** A small scalloped seal: gold when earned, a dashed outline while it is still ahead. */
export function SealMedal({ earned, size = 44, glyph = "check" }: { earned: boolean; size?: number; glyph?: "check" | "star" | "crest" }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg className="pf-medal" data-earned={earned} viewBox="-26 -26 52 52" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#f6dc93" />
          <stop offset="0.45" stopColor="#d9a93c" />
          <stop offset="1" stopColor="#b7862a" />
        </linearGradient>
      </defs>
      {earned ? (
        <>
          <path d={BURST} fill="rgba(122, 84, 14, 0.25)" transform="translate(0 1.4)" />
          <path d={BURST} fill={`url(#${id}-g)`} />
          <circle r="16.4" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.9" />
          <circle r="13.6" fill="none" stroke="rgba(122, 84, 14, 0.45)" strokeWidth="0.7" strokeDasharray="0.2 2.3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle r="21.5" fill="#fff" stroke="rgba(18,41,58,0.22)" strokeWidth="1.2" strokeDasharray="2.4 3" strokeLinecap="round" />
          <circle r="15" fill="none" stroke="rgba(18,41,58,0.1)" strokeWidth="1" />
        </>
      )}
      <g fill="none" stroke={earned ? "#6b4a0c" : "rgba(18,41,58,0.34)"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {glyph === "check" ? <path d="M-6.5 0.6-2 5 7-5" /> : null}
        {glyph === "star" ? <path d="M0-8.2 2.4-2.7l6-.4-4.6 3.9 1.5 5.8L0 3.4l-5.3 3.2 1.5-5.8-4.6-3.9 6 .4z" strokeWidth="1.8" /> : null}
        {glyph === "crest" ? <path d="M-6.5-6.5h13v6.2c0 3.8-2.7 6.3-6.5 7.8-3.8-1.5-6.5-4-6.5-7.8z" strokeWidth="1.9" /> : null}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

/** A cover-cropped photo from public/photos, with its average colour behind it while it loads. */
export function Photo({
  name,
  focus,
  sizes,
  eager,
  width = 640,
  className = "",
  style,
}: {
  name: PhotoName;
  focus?: [number, number];
  sizes?: string;
  eager?: boolean;
  width?: 640 | 1280 | 1672;
  className?: string;
  style?: CSSProperties;
}) {
  const src = photoSources(name, width);
  if (!src) return <span className={className} style={{ background: "#d5e6ef", ...style }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP renditions with a srcSet; next/image is not used in this demo
    <img
      className={className}
      src={src.src}
      srcSet={src.srcSet}
      sizes={sizes}
      alt=""
      draggable={false}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      style={{ background: photoAsset(name)?.color, objectFit: "cover", objectPosition: focus ? `${focus[0]}% ${focus[1]}%` : undefined, ...style }}
    />
  );
}

/**
 * A still post: one photo, the island, a headline, who is sharing, and a sticker with the QR code
 * and the short link. A still has no end card, so the code has to live in the picture itself.
 * Fills its parent (drop it into <PostPreview media />); everything is sized in container units.
 */
export function PhotoPost({
  choice,
  islandName,
  code,
  byline,
  avatar,
  message,
  support,
  compact,
}: {
  choice: PhotoChoice;
  islandName: string;
  code: string;
  byline?: string;
  avatar?: ShareAvatar;
  message?: string;
  /** Line over the QR code, e.g. "Scan to support Coral Trust". */
  support: string;
  /** Leave the sticker and the byline out (for small thumbnails). */
  compact?: boolean;
}) {
  const target = useShareTarget(code);
  return (
    <div className="pf-still" data-compact={compact}>
      <Photo name={choice.name} focus={choice.focus} width={1280} sizes="(max-width: 480px) 92vw, 420px" eager className="pf-still-photo" />
      <div className="pf-still-shade" />
      <div className="pf-still-text">
        <div className="pf-still-kicker">
          <BrandMark />
          <span>{strings.app.name}</span>
        </div>
        <div className="pf-still-lower">
          <div className="pf-still-words">
            <p className="pf-still-island">{islandName}</p>
            <p className="pf-still-line">{choice.line}</p>
            {!compact && (byline || message) ? (
              <div className="pf-still-by">
                {avatar ? (
                  <span className="sk-avatar sk-post-avatar" style={{ "--a": avatar.tint[0], "--b": avatar.tint[1] } as CSSProperties} aria-hidden="true">
                    {avatar.initials}
                  </span>
                ) : null}
                <div>
                  {message ? <q>{message}</q> : null}
                  {byline ? <span>{byline}</span> : null}
                </div>
              </div>
            ) : null}
          </div>
          {compact ? null : (
            <div className="pf-still-sticker">
              <QrCode value={target} frame="bare" label={false} animate={false} title={`QR code for ${shareDisplayUrl(code)}`} />
              <span className="pf-still-sticker-k">{support}</span>
              <span className="pf-still-sticker-l">
                <span>{SHARE_DOMAIN}</span>
                <span>/s/{code}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
