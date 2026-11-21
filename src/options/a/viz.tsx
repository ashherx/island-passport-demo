"use client";

/**
 * Small data-viz pieces for the island card: a ring gauge, a meter bar, a trend mark, the IUCN
 * scale and a stamp mark. All plain SVG and CSS. Each one draws itself in once it has scrolled
 * into view (the `data-seen` attribute; see atlas.css), and is fully drawn with reduced motion.
 */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { artUrl } from "@/lib/assets";
import { islandStrings, type IucnStatus, type StampOffer, type Trend } from "@/lib/islands";
import { t } from "@/lib/strings";
import { useSeen } from "./hooks";
import { aStrings } from "./strings";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Marks its children as seen once they scroll into view, so meters animate when you reach them. */
export function Seen({ children, className, as: Tag = "div", style }: { children: ReactNode; className?: string; as?: "div" | "li" | "section"; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  const seen = useSeen(ref);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- one ref type for three block tags
    <Tag ref={ref as any} className={className} data-seen={seen ? "" : undefined} style={style}>
      {children}
    </Tag>
  );
}

export interface RingProps {
  value: number;
  max?: number;
  /** Outer size in px. */
  size?: number;
  stroke?: number;
  /** What sits in the middle. */
  children?: ReactNode;
  /** Accessible description, e.g. "Reef health 68 out of 100". */
  label: string;
  tone?: "sea" | "sun" | "light";
  className?: string;
}

const RING_STOPS: Record<NonNullable<RingProps["tone"]>, [string, string]> = {
  sea: ["#5fe3d6", "#078a86"],
  sun: ["#ffc37a", "#e8793f"],
  light: ["#ffffff", "#bff7f0"],
};

/** A ring gauge. The arc length is driven by a CSS variable so it can transition. */
export function Ring({ value, max = 100, size = 112, stroke = 9, children, label, tone = "sea", className }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = clamp01(value / max);
  const id = `da-ring-${tone}`;
  return (
    <span className={className ? `da-ring ${className}` : "da-ring"} data-tone={tone} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} style={{ width: size, height: size, "--ring-c": c, "--ring-share": share } as CSSProperties}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={RING_STOPS[tone][0]} />
            <stop offset="1" stopColor={RING_STOPS[tone][1]} />
          </linearGradient>
        </defs>
        <circle className="da-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="da-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? <span className="da-ring-mid">{children}</span> : null}
    </span>
  );
}

/** A thin meter. Decorative: the figure is always printed next to it. */
export function Bar({ value, max, tone = "sea" }: { value: number; max: number; tone?: "sea" | "sun" }) {
  return (
    <span className="da-meter" data-tone={tone} aria-hidden="true" style={{ "--meter-share": clamp01(value / max) } as CSSProperties}>
      <span className="da-meter-fill" />
    </span>
  );
}

/** A small arrow for a trend. The direction is neutral in colour: "up" is not always good. */
export function TrendMark({ trend }: { trend: Trend }) {
  const rotate = trend === "up" ? -45 : trend === "down" ? 45 : 0;
  return (
    <span className="da-trend" data-trend={trend}>
      <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" style={{ transform: `rotate(${rotate}deg)` }}>
        <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="da-sr">{aStrings.card.trend[trend]}</span>
    </span>
  );
}

const IUCN_ORDER: IucnStatus[] = ["LC", "NT", "VU", "EN", "CR"];

/** The Red List category as a badge plus its place on the five-step scale. */
export function IucnBadge({ status }: { status: IucnStatus }) {
  const step = IUCN_ORDER.indexOf(status);
  return (
    <span className="da-iucn" data-iucn={status} title={islandStrings.iucnSource}>
      <span className="da-iucn-code" aria-hidden="true">
        {status}
      </span>
      <span className="da-iucn-name">{islandStrings.iucn[status]}</span>
      <span className="da-iucn-scale" role="img" aria-label={t(aStrings.card.iucnScale, { status: islandStrings.iucn[status], n: step + 1 })}>
        {IUCN_ORDER.map((s, i) => (
          <i key={s} data-on={i <= step ? "" : undefined} />
        ))}
      </span>
    </span>
  );
}

/** A stamp as a small inked mark: the passport artwork as a mask, in this option's inks. */
export function StampMark({ offer, index = 0, size = 60 }: { offer: StampOffer; index?: number; size?: number }) {
  const tilt = [-7, 5, -4, 8, -6, 4][index % 6];
  const url = artUrl(offer.art);
  return (
    <span className="da-stamp" data-kind={offer.kind} data-shape={offer.shape} aria-hidden="true" style={{ width: size, height: size, "--stamp-tilt": `${tilt}deg` } as CSSProperties}>
      <span className="da-stamp-art" style={{ maskImage: `url(${url})`, WebkitMaskImage: `url(${url})` }} />
    </span>
  );
}
