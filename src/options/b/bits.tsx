/**
 * Option B small parts: the stamp impression, the map pin, hand-drawn icons and chips.
 * All decorative SVG here is aria-hidden; meaning is always carried by text next to it.
 */
import type { CSSProperties, ReactNode } from "react";
import { burstPath, polygonPath, scallopPath } from "@/components/stamp/geometry";
import { artUrl } from "@/lib/assets";
import type { IucnStatus, Trend } from "@/lib/islands";
import type { StampArt, StampShape } from "@/lib/types";
import { bStrings } from "./strings";

/* ------------------------------------------------------------------ stamp impression */

function frame(shape: StampShape): ReactNode {
  switch (shape) {
    case "rounded":
      return (
        <>
          <rect x="14" y="14" width="172" height="172" rx="30" />
          <rect x="24" y="24" width="152" height="152" rx="22" strokeWidth="2.5" />
        </>
      );
    case "oval":
      return (
        <>
          <ellipse cx="100" cy="100" rx="90" ry="72" />
          <ellipse cx="100" cy="100" rx="80" ry="62" strokeWidth="2.5" />
        </>
      );
    case "octagon":
      return (
        <>
          <path d={polygonPath(8, 92)} />
          <path d={polygonPath(8, 81)} strokeWidth="2.5" />
        </>
      );
    case "scalloped":
      return (
        <>
          <path d={scallopPath(18, 84, 0.72)} />
          <circle cx="100" cy="100" r="72" strokeWidth="2.5" />
        </>
      );
    case "seal":
      return (
        <>
          <path d={burstPath(22, 94, 84, 100, 100)} />
          <circle cx="100" cy="100" r="74" strokeWidth="2.5" />
          <circle cx="100" cy="100" r="67" strokeWidth="1.5" strokeDasharray="2 6" />
        </>
      );
    default:
      return (
        <>
          <circle cx="100" cy="100" r="88" />
          <circle cx="100" cy="100" r="77" strokeWidth="2.5" />
        </>
      );
  }
}

export interface StampMarkProps {
  art: StampArt;
  shape?: StampShape;
  /** Ink colour: stamp (vermilion), lagoon (teal), sun (gold) or ink (indigo). */
  tone?: "stamp" | "lagoon" | "sun" | "ink" | "sage";
  size?: number;
  /** Degrees of tilt, as if pressed by hand. */
  tilt?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * A rubber-stamp impression: one of the passport's frame shapes around the stamp artwork from
 * public/stamps, printed in a single ink. Decorative; name the offer in text beside it.
 */
export function StampMark({ art, shape = "circle", tone = "stamp", size = 64, tilt = 0, className, style }: StampMarkProps) {
  const url = artUrl(art);
  return (
    <span
      className={className ? `ob-stampmark ${className}` : "ob-stampmark"}
      data-tone={tone}
      data-shape={shape}
      aria-hidden="true"
      style={{ width: size, height: size, ["--ob-tilt" as string]: `${tilt}deg`, ...style }}
    >
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round">
        {frame(shape)}
      </svg>
      <span className="ob-stampmark-art" style={{ maskImage: `url(${url})`, WebkitMaskImage: `url(${url})` }} />
    </span>
  );
}

/* ------------------------------------------------------------------ map markers */

const PIN_EDGE = scallopPath(14, 82, 0.74);

/** The badge on a participating island: a small perforated stamp with a palm on it. */
export function PinStamp() {
  return (
    <svg className="ob-pin-svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <path className="ob-pin-edge" d={PIN_EDGE} />
      <circle className="ob-pin-ring" cx="100" cy="100" r="66" />
      {/* A palm on a little island, drawn in four strokes. */}
      <g className="ob-pin-art">
        <path d="M58 138c14-12 70-12 84 0" />
        <path d="M100 136c-2-22 0-40 8-58" />
        <path d="M108 78c-16-12-34-8-44 4M108 78c-6-16-22-22-34-18M108 78c14-14 32-12 42-2M108 78c10-4 24 2 30 16" />
      </g>
    </svg>
  );
}

/** The mark on a "coming soon" island: an empty stamp slot. */
export function PinSlot() {
  return (
    <svg className="ob-slot-svg" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle className="ob-slot-fill" cx="20" cy="20" r="13" />
      <circle className="ob-slot-ring" cx="20" cy="20" r="13" />
      <circle className="ob-slot-dot" cx="20" cy="20" r="3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ icons */

interface IconProps {
  className?: string;
  size?: number;
}

function Icon({ className, size = 20, children, viewBox = "0 0 24 24" }: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.2 6.4c3.6 3.4 7.6 7.4 11.6 11.4M17.8 6.2C14 10 10 14 6.2 17.8" />
  </Icon>
);

export const IconGlobe = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M3.6 12.200c5.400-1 11.200-1 16.800 0M12 3.400c-3.400 5.200-3.400 12 0 17.200M12 3.400c3.400 5.200 3.400 12 0 17.200" />
  </Icon>
);

export const IconArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12.200c-4.400-.4-9.200-.4-13.800 0M10.400 6.600C8.400 8.600 6.800 10.400 5 12.200c1.800 1.800 3.400 3.600 5.400 5.400" />
  </Icon>
);

export const IconChevron = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5.600c2.200 2.200 4.200 4.200 6.200 6.400-2 2.200-4 4.200-6.200 6.400" />
  </Icon>
);

export const IconShare = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 14.800V3.600M7.600 7.800C9.200 6.200 10.600 5 12 3.600c1.400 1.400 2.800 2.600 4.400 4.200" />
    <path d="M5.200 11.800c-.4 2.800-.4 5.400 0 8.200 4.600.6 9 .6 13.600 0 .4-2.800.4-5.400 0-8.200" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.800 12.800c1.800 1.600 3.200 3.200 4.600 5 2.800-4.600 6-8.400 10-11.800" />
  </Icon>
);

export const IconWave = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9.400c2-2.200 4-2.200 6 0s4 2.200 6 0 4-2.200 6 0M3 15.400c2-2.200 4-2.200 6 0s4 2.200 6 0 4-2.200 6 0" />
  </Icon>
);

export const IconHeart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20c-4.600-3.400-8.400-6.600-8.400-10.600 0-2.800 2-4.800 4.400-4.800 1.800 0 3.200 1 4 2.600.8-1.600 2.200-2.600 4-2.600 2.400 0 4.400 2 4.400 4.800 0 4-3.800 7.200-8.400 10.600Z" />
  </Icon>
);

export const IconMap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.600 6.400c1.800-.6 3.600-1.400 5.400-2.400 2 1 4 2 6 2.800 1.800-.8 3.600-1.600 5.400-2.600v13.400c-1.800 1-3.600 1.800-5.400 2.600-2-.8-4-1.800-6-2.800-1.800 1-3.600 1.800-5.400 2.400Z" />
    <path d="M9 4.200v13.200M15 6.800v13.200" />
  </Icon>
);

export const IconPhotos = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.400 6.200c5-.4 10.200-.4 15.200 0 .4 3.800.4 7.800 0 11.600-5 .4-10.200.4-15.200 0-.4-3.800-.4-7.800 0-11.600Z" />
    <path d="M4.600 15.600c1.800-1.800 3.200-3.200 4.800-4.400 1.600 1.400 3 2.800 4.400 4.400 1-1 1.800-1.800 2.800-2.600 1 .8 2 1.800 3 2.800" />
    <circle cx="15.400" cy="9.600" r="1.300" />
  </Icon>
);

export const IconPlane = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.400 11.200 20.600 4 16 20.400l-4.400-6.200Z" />
    <path d="M11.600 14.200 20.600 4M11.600 14.200l-.4 5 2.600-2.600" />
  </Icon>
);

export const IconHand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.800 12.600V5.400c0-1.800 2.800-1.800 2.800 0v5.200c.2-1.600 2.800-1.600 2.800.2v.6c.2-1.400 2.600-1.400 2.600.4v.8c.4-1.200 2.400-1 2.400.6 0 4-.6 8-5.200 8-3.800 0-5.200-1.600-7.400-5.600-.8-1.600 1-2.800 2.200-1.600Z" />
  </Icon>
);

export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.400 16.600c1-1.600 1.200-3.400 1.200-5.600 0-3 1.800-5.200 4.400-5.200s4.400 2.200 4.400 5.200c0 2.200.2 4 1.200 5.600-3.800.6-7.400.6-11.200 0Z" />
    <path d="M10.400 19.400c.8 1.200 2.400 1.200 3.200 0M12 5.800V4.200" />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.600" cy="10.600" r="6" />
    <path d="M15.200 15.200c1.400 1.400 2.800 2.800 4.200 4" />
  </Icon>
);

/* ------------------------------------------------------------------ chips */

const TREND_PATH: Record<Trend, string> = {
  up: "M3.500 11.500 8 5l4.500 6.500",
  down: "M3.500 4.500 8 11l4.500-6.500",
  steady: "M3 8h10M9.500 4.500 13 8l-3.500 3.500",
};

/** An arrow and a word. `words` defaults to the neutral Rising / Falling / Steady. */
export function TrendChip({ trend, words = bStrings.trend }: { trend: Trend; words?: Record<Trend, string> }) {
  return (
    <span className="ob-trend" data-trend={trend}>
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={TREND_PATH[trend]} />
      </svg>
      {words[trend]}
    </span>
  );
}

/** IUCN Red List category: the two-letter code in a coloured disc, with the full name beside it. */
export function IucnBadge({ status, name }: { status: IucnStatus; name: string }) {
  return (
    <span className="ob-iucn" data-iucn={status}>
      <span className="ob-iucn-code" aria-hidden="true">
        {status}
      </span>
      {name}
    </span>
  );
}

/** A strip of washi tape. Purely decorative. */
export function Tape({ tone = "sun", className, style }: { tone?: "sun" | "mint" | "blush"; className?: string; style?: CSSProperties }) {
  return <span className={className ? `ob-tape ${className}` : "ob-tape"} data-tone={tone} style={style} aria-hidden="true" />;
}
