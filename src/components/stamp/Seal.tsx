/**
 * Status marks that sit on the lower-right corner of a stamp:
 *   - SealMark:    the gold-foil "Verified Supporter" seal (crisp, never ink-filtered)
 *   - PendingMark: the hollow clock badge for "Donation pending" (part of the ink impression)
 * Both are drawn around the origin so the caller positions them with a transform.
 *
 * <VerifiedSeal /> is the foil seal on its own, for the upgrade animation to fly in and press.
 */
import { useId, type CSSProperties } from "react";
import { strings } from "@/lib/strings";
import { burstPath, circlePath } from "./geometry";

const safeId = (id: string) => `ips${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

/** Two foil gradients (one the reverse of the other, for an embossed look). */
export function FoilDefs({ id }: { id: string }) {
  const stops = (
    <>
      <stop offset="0" style={{ stopColor: "var(--foil-lo)" }} />
      <stop offset="0.22" style={{ stopColor: "var(--foil)" }} />
      <stop offset="0.42" style={{ stopColor: "var(--foil-hi)" }} />
      <stop offset="0.58" style={{ stopColor: "var(--foil)" }} />
      <stop offset="0.8" style={{ stopColor: "var(--foil-lo)" }} />
      <stop offset="1" style={{ stopColor: "var(--foil)" }} />
    </>
  );
  return (
    <>
      <linearGradient id={`${id}-fa`} x1="0.1" y1="0" x2="0.9" y2="1">
        {stops}
      </linearGradient>
      <linearGradient id={`${id}-fb`} x1="0.9" y1="1" x2="0.1" y2="0">
        {stops}
      </linearGradient>
    </>
  );
}

export interface SealMarkProps {
  /** Id prefix of the <FoilDefs> to paint with. */
  id: string;
  /** Outer radius in stamp units. */
  r?: number;
  /** Show the "VERIFIED SUPPORTER" text ring (only legible on large stamps). */
  withText?: boolean;
}

export function SealMark({ id, r = 28, withText = false }: SealMarkProps) {
  const burst = burstPath(24, r, r * 0.905);
  const k = r / 28;
  const checkScale = withText ? 0.6 : 1;
  return (
    <g className="ip-stamp__sealmark">
      <path d={burst} transform={`translate(${0.6 * k} ${1.5 * k})`} style={{ fill: "var(--foil-shadow)" }} opacity="0.42" />
      <path d={burst} fill={`url(#${id}-fa)`} />
      <path d={burst} fill="none" style={{ stroke: "var(--foil-hi)" }} strokeWidth={0.5 * k} opacity="0.75" />
      <circle r={r * 0.79} fill={`url(#${id}-fb)`} />
      <circle r={r * 0.79} fill="none" style={{ stroke: "var(--foil-shadow)" }} strokeWidth={0.6 * k} opacity="0.55" />
      <circle r={r * 0.745} fill="none" style={{ stroke: "var(--foil-hi)" }} strokeWidth={0.55 * k} opacity="0.8" />
      {withText ? (
        <>
          <path id={`${id}-st`} d={circlePath(r * 0.5)} fill="none" />
          <text
            className="ip-stamp__sealtext"
            fontSize={r * 0.172}
            style={{ fill: "var(--foil-shadow)" }}
            textLength={2 * Math.PI * r * 0.5 * 0.97}
            lengthAdjust="spacing"
          >
            <textPath href={`#${id}-st`} startOffset="0">
              {`${strings.status.verified.seal.split(" ").join(" ✦ ")} ✦`}
            </textPath>
          </text>
          <circle r={r * 0.44} fill="none" style={{ stroke: "var(--foil-shadow)" }} strokeWidth={0.4 * k} opacity="0.5" />
        </>
      ) : (
        <circle
          r={r * 0.655}
          fill="none"
          style={{ stroke: "var(--foil-shadow)" }}
          strokeWidth={0.9 * k}
          strokeDasharray={`${0.1 * k} ${2.3 * k}`}
          strokeLinecap="round"
          opacity="0.6"
        />
      )}
      <g transform={`scale(${k * checkScale})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M -9.5 0.8 L -3.2 7 L 10 -7.4" style={{ stroke: "var(--foil-hi)" }} strokeWidth="4.6" transform="translate(0.7 0.9)" opacity="0.85" />
        <path d="M -9.5 0.8 L -3.2 7 L 10 -7.4" style={{ stroke: "var(--foil-shadow)" }} strokeWidth="4.2" />
      </g>
    </g>
  );
}

export interface PendingMarkProps {
  id: string;
  r?: number;
  withText?: boolean;
}

/** Hollow clock badge. Inherits the ink colour through currentColor. */
export function PendingMark({ id, r = 25, withText = false }: PendingMarkProps) {
  const k = r / 25;
  const clock = withText ? 8.6 * k : 12.5 * k;
  return (
    <g className="ip-stamp__pendingmark" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle r={r} strokeWidth={2.2 * k} />
      {withText ? (
        <>
          <path id={`${id}-pt`} d={circlePath(r * 0.6)} stroke="none" />
          <text
            fontSize={r * 0.215}
            stroke="none"
            textLength={2 * Math.PI * r * 0.6 * 0.96}
            lengthAdjust="spacing"
          >
            <textPath href={`#${id}-pt`} startOffset="0">
              {`${strings.status.pending.tab.split(" ").join(" · ")} ·`}
            </textPath>
          </text>
        </>
      ) : (
        <circle r={r * 0.8} strokeWidth={1.1 * k} strokeDasharray={`${0.1 * k} ${3.1 * k}`} />
      )}
      <circle r={clock} strokeWidth={2.2 * k} />
      <path d={`M 0 ${-clock * 0.58} V 0 L ${clock * 0.42} ${clock * 0.26}`} strokeWidth={2.2 * k} />
    </g>
  );
}

export interface VerifiedSealProps {
  /** Pixel size of the seal. */
  size?: number;
  withText?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Hide from assistive tech when the stamp next to it already announces the status. */
  decorative?: boolean;
}

/** The foil seal as a standalone graphic. */
export function VerifiedSeal({ size = 56, withText, className, style, decorative = false }: VerifiedSealProps) {
  const id = safeId(useId());
  return (
    <svg
      className={className}
      style={{ overflow: "visible", display: "block", ...style }}
      width={size}
      height={size}
      viewBox="-32 -32 64 64"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : strings.stamp.ariaSeal}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <FoilDefs id={id} />
      </defs>
      <SealMark id={id} r={28} withText={withText ?? size >= 110} />
    </svg>
  );
}
