"use client";

/**
 * <Stamp />: the passport stamp. See docs/agents/foundation.md for the full API.
 *
 * Layers, back to front:
 *   .ip-stamp               sized box, role="img"
 *     .ip-stamp__tilt       per-stamp rotation (deterministic from the id)
 *       .ip-stamp__ink      everything printed in ink: dry speckle, density and the press reveal
 *         svg               frame and pending clock badge (rough edge), then the lettering
 *         .ip-stamp__rough  rough edge for the illustration
 *           .ip-stamp__art  the illustration: CSS mask-image tinted with the status ink
 *       svg.ip-stamp__seal  gold foil (Verified Supporter seal, Provincial ring). Never filtered.
 *
 * The rough edge (displacement) is applied to the frame and the artwork only. Lettering gets a
 * much lighter wobble, and none at all on small stamps, so counters of C, G, O, 0 and 8 stay open.
 *
 * STM-5: the artwork is only a template. Island, promoter, status and date are overlaid here.
 * STM-7: Discovery = crisp outline, one ink. Donation pending = dashed and hollow, in full-strength
 *        ink, with a solid clock badge. Verified Supporter = solid inked band with reversed-out
 *        type plus the foil seal. An empty slot is a faint dotted ghost.
 */
import { useEffect, useId, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { useDirectionTokens } from "@/components/theme/ThemeProvider";
import { artUrl } from "@/lib/assets";
import type { DirectionTokens } from "@/lib/directions";
import { formatDate, formatStampDate, stampDateParts, strings, t } from "@/lib/strings";
import type { Stamp as StampData, StampArt, StampKind, StampShape, StampSlot, StampStatus } from "@/lib/types";
import { FoilDefs, SealMark } from "./Seal";
import { C, arcBottom, arcTop, circlePath, fitFont, polygonPath, rand, round2, scallopPath, sparklePath, starPath } from "./geometry";

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Anything with get() and on("change"), e.g. a Motion `MotionValue<number>`. */
export interface ProgressSource {
  get(): number;
  on(event: "change", callback: (value: number) => void): () => void;
}

export interface StampProps {
  /** The stamp to draw. Omit (or pass null) together with `slot` for an empty slot. */
  stamp?: StampData | null;
  /** Slot template, used for the empty placeholder when there is no stamp yet. */
  slot?: StampSlot;
  /** Pixel width and height of the box. Default 160. Drawn crisply from 80 to 320 and beyond. */
  size?: number;
  /** Draw the stamp as if it had this status (e.g. to preview an upgrade). */
  status?: StampStatus;
  /** "empty" draws the dashed "Not yet collected" placeholder. Default: "stamp" when `stamp` is set. */
  variant?: "stamp" | "empty";
  /**
   * 0..1 ink coverage for the press animation: 0 = nothing printed, 1 = full impression.
   * Pass a number, or a MotionValue to animate without re-rendering React.
   */
  inkProgress?: number | ProgressSource;
  /** Overlay island, promoter and date text. Default true. */
  showLabels?: boolean;
  /** Draw the status mark in the corner (foil seal or pending clock). Default true. */
  showSeal?: boolean;
  /** Rotation in degrees. Default: a small deterministic tilt from the id. `false` = upright. */
  rotate?: number | false;
  /** "rough" applies the SVG ink filter, "clean" skips it. Default "rough". */
  ink?: "rough" | "clean";
  /** "multiply" soaks the ink into the paper under it. Only use on light paper. Default "normal". */
  blend?: "normal" | "multiply";
  /** Level of detail. "auto" picks from `size`: compact below 120px, large from 220px. */
  detail?: "auto" | "compact" | "full" | "large";
  /** Label for the empty slot. Default "Not yet collected". */
  emptyLabel?: string;
  /** Hide from assistive tech (when surrounding text already describes the stamp). */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Where the corner mark sits, as fractions of the stamp box. Use to align an overlaid <VerifiedSeal />. */
export function sealAnchor(shape: StampShape): { x: number; y: number; r: number } {
  const a = badgeAnchor(shape);
  return { x: a.x / 200, y: a.y / 200, r: SEAL_R / 200 };
}

/** Deterministic resting tilt of a stamp, in degrees. */
export function stampTilt(id: string, kind: StampKind = "island"): number {
  const range = kind === "provincial" ? 2.5 : 5.5;
  return round2((rand(id, "tilt") * 2 - 1) * range);
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

type Detail = "compact" | "full" | "large";

interface Template {
  id: string;
  art: StampArt;
  title: string;
  island: string;
  shape: StampShape;
  kind: StampKind;
  promoter: string;
  date: string;
}

interface ArtBox {
  cx: number;
  cy: number;
  size: number;
}

interface Drawn {
  /** Black shapes cut out of `frame` before the rough edge is applied (the gap round the clock badge). */
  hole?: ReactNode;
  /** Lettering knocked out of `frame` (black = paper shows through). Cut after the rough edge, so it stays legible. */
  ko?: ReactNode;
  /** Defs the lettering needs (text paths). */
  defs?: ReactNode;
  /** Frame lines and filled bands. */
  frame: ReactNode;
  /** Text and marks printed in ink on top of the frame. */
  marks?: ReactNode;
  /** Opacity of the frame group (the empty placeholder is a ghost). */
  frameOpacity?: number;
  /** Foil elements, drawn in the unfiltered layer. */
  foil?: ReactNode;
  art: ArtBox;
  artOpacity?: number;
}

interface DrawContext {
  tpl: Template;
  status: StampStatus;
  detail: Detail;
  labels: boolean;
  id: string;
  tok: DirectionTokens;
}

const SEAL_R = 28;
const PENDING_R = 25;

const safeId = (id: string) => `ips${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function badgeAnchor(shape: StampShape): { x: number; y: number } {
  switch (shape) {
    case "oval":
      return { x: 170, y: 155 };
    case "rounded":
      return { x: 171, y: 153 };
    case "seal":
      return { x: 166, y: 166 };
    default:
      return { x: 165.5, y: 165.5 };
  }
}

function outline(shape: StampShape, props: React.SVGProps<SVGElement>): ReactNode {
  const p = props as Record<string, unknown>;
  switch (shape) {
    case "scalloped":
      return <path d={scallopPath(26, 90.4, 0.8)} {...p} />;
    case "octagon":
      return <path d={polygonPath(8, 97)} {...p} />;
    case "oval":
      return <ellipse cx={C} cy={C} rx={97} ry={77} {...p} />;
    case "rounded":
      return <rect x={8} y={28} width={184} height={144} rx={16} {...p} />;
    case "seal":
      return <path d={scallopPath(36, 92.4, 0.74)} {...p} />;
    default:
      return <circle cx={C} cy={C} r={93} {...p} />;
  }
}

/* --- Ring family: circle, scalloped, octagon, oval ------------------ */

interface Band {
  ox: number;
  oy: number;
  ix: number;
  iy: number;
}

function ringBand(shape: StampShape): Band {
  switch (shape) {
    case "scalloped":
      return { ox: 85, oy: 85, ix: 62.5, iy: 62.5 };
    case "octagon":
      return { ox: 83.5, oy: 83.5, ix: 61.5, iy: 61.5 };
    case "oval":
      return { ox: 95.5, oy: 75.5, ix: 73, iy: 53 };
    default:
      return { ox: 91.5, oy: 91.5, ix: 64, iy: 64 };
  }
}

function drawRing(ctx: DrawContext): Drawn {
  const { tpl, status, detail, labels, id, tok } = ctx;
  const compact = detail === "compact";
  const w = tok.impression.weight;
  const { stampTracking: tracking, stampAdvance: adv, stampScale: scale } = tok.type;
  const shape = tpl.shape;
  const band = ringBand(shape);
  const mx = (band.ox + band.ix) / 2;
  const my = (band.oy + band.iy) / 2;
  const bw = band.ox - band.ix;
  const halfArc = Math.PI * Math.sqrt((mx * mx + my * my) / 2);
  const verified = status === "verified";
  const pending = status === "pending";
  const anchor = badgeAnchor(shape);

  // Text on the frame
  const island = tpl.island.toUpperCase();
  const islandSize = fitFont(island, halfArc * (compact ? 0.8 : 0.7), bw * (compact ? 0.7 : 0.6) * scale, adv, tracking);
  const islandCap = islandSize * 0.7;
  const promoter = tpl.promoter.toUpperCase();
  const promoterSize = fitFont(promoter, halfArc * 0.325, bw * 0.37 * scale, adv, tracking * 0.5);
  const promoterCap = promoterSize * 0.7;
  const showPromoter = labels && !compact && promoter.length > 0;
  const showDate = labels && !compact && tpl.date.length > 0;
  const topId = `${id}-top`;
  const botId = `${id}-bot`;

  const frameText = (className?: string): ReactNode => (
    <g className={className} fill="currentColor">
      {labels && (
        <text fontSize={islandSize} letterSpacing={`${tracking}em`} textAnchor="middle">
          <textPath href={`#${topId}`} startOffset="50%">
            {island}
          </textPath>
        </text>
      )}
      {showPromoter && (
        <text fontSize={promoterSize} letterSpacing={`${tracking * 0.5}em`} textAnchor="middle">
          <textPath href={`#${botId}`} startOffset="50%">
            {promoter}
          </textPath>
        </text>
      )}
      <path d={sparklePath(C - mx, C, bw * (compact ? 0.2 : 0.17))} />
      <path d={sparklePath(C + mx, C, bw * (compact ? 0.2 : 0.17))} />
      {compact && <circle cx={C} cy={C + my} r={bw * 0.11} />}
    </g>
  );

  const defs = (
    <>
      <path id={topId} d={arcTop(mx - islandCap / 2, my - islandCap / 2)} />
      <path id={botId} d={arcBottom(mx + promoterCap / 2, my + promoterCap / 2)} />
    </>
  );

  // Frame
  const outerW = (compact ? 4.6 : 3.2) * w;
  const thinW = (compact ? 2 : 1.25) * w;
  const hasSecond = shape === "scalloped" || shape === "octagon";
  let frame: ReactNode;
  let hole: ReactNode;
  let ko: ReactNode;

  if (verified) {
    // Rich impression: the band is solid ink and the type is the paper showing through.
    ko = frameText("ip-stamp__ko");
    frame = (
      <>
        {outline(shape, { fill: "none", stroke: "currentColor", strokeWidth: outerW * 1.05, strokeLinejoin: "round" })}
        <ellipse cx={C} cy={C} rx={mx} ry={my} fill="none" stroke="currentColor" strokeWidth={bw} />
        <ellipse cx={C} cy={C} rx={band.ix - 1} ry={band.iy - 1} fill="currentColor" opacity="0.1" />
        {!compact && (
          <ellipse cx={C} cy={C} rx={band.ix - 4.2} ry={band.iy - 4.2} fill="none" stroke="currentColor" strokeWidth={1.1 * w} />
        )}
      </>
    );
  } else if (pending) {
    // Hollow and provisional, but printed at full strength: dashed outline, dotted inner ring, and a
    // gap where the clock badge sits.
    hole = <circle cx={anchor.x} cy={anchor.y} r={PENDING_R + 4.5} fill="#000" />;
    frame = (
      <>
        {outline(shape, {
          fill: "none",
          stroke: "currentColor",
          strokeWidth: (compact ? 4.2 : 3.0) * w,
          strokeDasharray: compact ? "11 7" : "8 5.2",
          strokeLinecap: "butt",
          strokeLinejoin: "round",
        })}
        <ellipse
          cx={C}
          cy={C}
          rx={band.ix}
          ry={band.iy}
          fill="none"
          stroke="currentColor"
          strokeWidth={(compact ? 3.1 : 2.1) * w}
          strokeDasharray={compact ? "0.1 6.2" : "0.1 4.8"}
          strokeLinecap="round"
        />
      </>
    );
  } else {
    frame = (
      <>
        {outline(shape, { fill: "none", stroke: "currentColor", strokeWidth: outerW, strokeLinejoin: "round" })}
        {hasSecond && !compact && (
          <ellipse cx={C} cy={C} rx={band.ox} ry={band.oy} fill="none" stroke="currentColor" strokeWidth={1.1 * w} />
        )}
        <ellipse cx={C} cy={C} rx={band.ix} ry={band.iy} fill="none" stroke="currentColor" strokeWidth={thinW} />
      </>
    );
  }

  const inner = Math.min(band.ix, band.iy);
  const art: ArtBox = showDate
    ? { cx: C, cy: C - inner * 0.15, size: inner * 1.27 }
    : { cx: C, cy: C, size: inner * (compact ? 1.5 : 1.42) };
  const dateSize = Math.max(8.2, inner * 0.142);
  const dateY = C + inner * 0.735;

  const marks = (
    <>
      {!verified && frameText()}
      {showDate && (
        <text
          className="ip-stamp__mono"
          x={C}
          y={dateY}
          fontSize={dateSize}
          letterSpacing="0.09em"
          textAnchor="middle"
        >
          {formatStampDate(tpl.date)}
        </text>
      )}
    </>
  );

  return { hole, ko, defs, frame, marks, art, artOpacity: pending ? 0.92 : 1 };
}

/* --- Rounded rectangle: an entry-visa layout ------------------------ */

function drawRounded(ctx: DrawContext): Drawn {
  const { tpl, status, detail, labels, tok } = ctx;
  const compact = detail === "compact";
  const w = tok.impression.weight;
  const { stampTracking: tracking, stampAdvance: adv, stampScale: scale } = tok.type;
  const verified = status === "verified";
  const pending = status === "pending";
  const anchor = badgeAnchor("rounded");
  const headerY = compact ? 68 : 61;
  const footerY = 145;

  const island = tpl.island.toUpperCase();
  const islandSize = fitFont(island, 150, (compact ? 21 : 15.5) * scale, adv, tracking);
  const islandY = (28 + headerY) / 2 + islandSize * 0.36 + 1;
  const promoter = tpl.promoter.toUpperCase();
  const promoterSize = fitFont(promoter, 112, 9.6 * scale, adv, tracking * 0.5);
  const date = stampDateParts(tpl.date);
  const showFooter = labels && !compact;
  const showDate = labels && !compact && tpl.date.length > 0;

  const headerText = (className?: string): ReactNode =>
    labels ? (
      <text className={className} x={C} y={islandY} fontSize={islandSize} letterSpacing={`${tracking}em`} textAnchor="middle">
        {island}
      </text>
    ) : null;

  const dash = pending ? { strokeDasharray: compact ? "11 7" : "8 5.2" } : {};
  const dots = pending ? { strokeDasharray: "0.1 4.6", strokeLinecap: "round" as const } : {};
  const outerW = pending ? (compact ? 4.2 : 3.0) * w : (compact ? 4.6 : 3.2) * w;
  const thinW = pending ? 2.1 * w : (compact ? 2 : 1.25) * w;

  const ko = verified ? headerText("ip-stamp__ko") : undefined;
  const hole = pending ? <circle cx={anchor.x} cy={anchor.y} r={PENDING_R + 4.5} fill="#000" /> : undefined;

  const frame = (
    <>
      <rect x={8} y={28} width={184} height={144} rx={16} fill="none" stroke="currentColor" strokeWidth={outerW} {...dash} />
      {verified ? (
        <>
          <path d={`M 8 ${headerY} V 44 A 16 16 0 0 1 24 28 H 176 A 16 16 0 0 1 192 44 V ${headerY} Z`} fill="currentColor" />
          <rect x={14} y={headerY + 5} width={172} height={(showFooter ? footerY : 166) - headerY - 9} rx={5} fill="currentColor" opacity="0.1" />
          {showFooter && <path d={`M 8 ${footerY} H 192`} stroke="currentColor" strokeWidth={2.2 * w} />}
        </>
      ) : (
        <>
          {!compact && (
            <rect x={13.6} y={33.6} width={172.8} height={132.8} rx={11} fill="none" stroke="currentColor" strokeWidth={thinW} {...dots} />
          )}
          <path d={`M ${compact ? 8 : 13.6} ${headerY} H ${compact ? 192 : 186.4}`} stroke="currentColor" strokeWidth={thinW * (compact ? 1 : 1.2)} {...dots} />
          {showFooter && <path d={`M 13.6 ${footerY} H 186.4`} stroke="currentColor" strokeWidth={thinW} {...dots} />}
        </>
      )}
    </>
  );

  const marks = (
    <>
      {!verified && headerText()}
      {showDate && (
        <g textAnchor="middle">
          <text className="ip-stamp__mono" x={143} y={81} fontSize={10.5} letterSpacing="0.22em">
            {date.month}
          </text>
          <text x={143} y={113} fontSize={33 * scale} letterSpacing="0.02em">
            {date.day}
          </text>
          <text className="ip-stamp__mono" x={143} y={129} fontSize={10.5} letterSpacing="0.22em">
            {date.year}
          </text>
          <path d="M 122 86.5 H 164 M 122 118 H 164" stroke="currentColor" strokeWidth={0.9 * w} fill="none" />
        </g>
      )}
      {showFooter && promoter.length > 0 && (
        <text x={22} y={footerY + 14.6} fontSize={promoterSize} letterSpacing={`${tracking * 0.5}em`}>
          {promoter}
        </text>
      )}
    </>
  );

  const art: ArtBox = compact
    ? { cx: C, cy: (headerY + 172) / 2, size: 92 }
    : showDate
      ? { cx: 61, cy: (headerY + footerY) / 2, size: 76 }
      : { cx: C, cy: (headerY + (showFooter ? footerY : 172)) / 2, size: showFooter ? 78 : 96 };

  return { hole, ko, frame, marks, art, artOpacity: pending ? 0.92 : 1 };
}

/* --- Provincial seal ------------------------------------------------ */

function drawSeal(ctx: DrawContext): Drawn {
  const { tpl, detail, labels, id, tok } = ctx;
  const compact = detail === "compact";
  const w = tok.impression.weight;
  const { stampTracking: tracking, stampAdvance: adv, stampScale: scale } = tok.type;
  const ox = 77;
  const ix = 53;
  const mx = (ox + ix) / 2;
  const bw = ox - ix;
  const halfArc = Math.PI * mx;
  const top = t(strings.stamp.provincialOf, { province: tpl.island }).toUpperCase();
  const bottom = strings.stamp.provincial.toUpperCase();
  const topSize = fitFont(top, halfArc * 0.8, bw * 0.5 * scale, adv, tracking * 0.8);
  const bottomSize = fitFont(bottom, halfArc * 0.72, bw * 0.46 * scale, adv, tracking * 0.8);
  const topId = `${id}-top`;
  const botId = `${id}-bot`;
  const showDate = labels && !compact && tpl.date.length > 0;

  const ko = labels ? (
    <g className="ip-stamp__ko">
      <text fontSize={topSize} letterSpacing={`${tracking * 0.8}em`} textAnchor="middle">
        <textPath href={`#${topId}`} startOffset="50%">
          {top}
        </textPath>
      </text>
      <text fontSize={bottomSize} letterSpacing={`${tracking * 0.8}em`} textAnchor="middle">
        <textPath href={`#${botId}`} startOffset="50%">
          {bottom}
        </textPath>
      </text>
      <path d={starPath(C - mx, C, bw * 0.2)} />
      <path d={starPath(C + mx, C, bw * 0.2)} />
    </g>
  ) : undefined;
  const defs = (
    <>
      <path id={topId} d={arcTop(mx - topSize * 0.35)} />
      <path id={botId} d={arcBottom(mx + bottomSize * 0.35)} />
    </>
  );

  const frame = (
    <>
      <circle cx={C} cy={C} r={mx} fill="none" stroke="currentColor" strokeWidth={bw} />
      <circle cx={C} cy={C} r={ix - 1} fill="currentColor" opacity="0.08" />
      <circle cx={C} cy={C} r={ix - 4} fill="none" stroke="currentColor" strokeWidth={1.1 * w} />
      <circle cx={C} cy={C} r={ox + 3.6} fill="none" stroke="currentColor" strokeWidth={1.2 * w} />
    </>
  );

  const marks = showDate ? (
    <text className="ip-stamp__mono" x={C} y={C + ix * 0.7} fontSize={7.4} letterSpacing="0.1em" textAnchor="middle">
      {formatStampDate(tpl.date)}
    </text>
  ) : null;

  // Each foil shape is drawn twice: a soft dark offset first, so the metal reads as embossed and
  // its pale highlights never dissolve into cream paper.
  const edge = scallopPath(36, 92.4, 0.74);
  const stars = [starPath(C, 8.5, 7.6), starPath(C - 17.5, 11.2, 4.6), starPath(C + 17.5, 11.2, 4.6), starPath(C, 191.6, 5.2)];
  const foil = (
    <g fill="none">
      <g transform="translate(0.5 1)" opacity="0.5" style={{ stroke: "var(--foil-shadow)" }}>
        <path d={edge} strokeWidth={2.9} strokeLinejoin="round" />
        <circle cx={C} cy={C} r={85.2} strokeWidth={2.4} strokeDasharray="0.1 4.46" strokeLinecap="round" />
        {stars.map((d) => (
          <path key={d} d={d} stroke="none" style={{ fill: "var(--foil-shadow)" }} />
        ))}
      </g>
      <path d={edge} stroke={`url(#${id}-fa)`} strokeWidth={2.9} strokeLinejoin="round" />
      <circle cx={C} cy={C} r={85.2} stroke={`url(#${id}-fb)`} strokeWidth={2.4} strokeDasharray="0.1 4.46" strokeLinecap="round" />
      {stars.map((d) => (
        <path key={d} d={d} fill={`url(#${id}-fa)`} />
      ))}
    </g>
  );

  const art: ArtBox = showDate ? { cx: C, cy: C - 8, size: 64 } : { cx: C, cy: C, size: 76 };
  return { ko, defs, frame, marks, foil, art };
}

/* --- Empty slot ------------------------------------------------------ */

function drawEmpty(ctx: DrawContext, label: string): Drawn {
  const { tpl, detail, labels } = ctx;
  const compact = detail === "compact";
  const shape = tpl.shape;
  const frame = (
    <>
      {outline(shape, {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: compact ? 2 : 1.4,
        strokeDasharray: compact ? "5 8" : "4 6.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
      })}
    </>
  );
  const words = label.toUpperCase().split(" ");
  const split = words.length > 2 ? Math.ceil(words.length / 2) : words.length;
  const lines = compact ? [] : [words.slice(0, split).join(" "), words.slice(split).join(" ")].filter(Boolean);
  const baseY = shape === "rounded" ? 150 : shape === "oval" ? 146 : shape === "seal" ? 150 : 152;
  const firstY = baseY - (lines.length - 1) * 10;
  const marks =
    labels && lines.length > 0 ? (
      // Words to read, so not as faint as the ghost outline: the paper ink at 70% (TEC-9).
      <g className="ip-stamp__mono" textAnchor="middle" style={{ color: "color-mix(in srgb, var(--paper-ink) 70%, transparent)" }}>
        {lines.map((line, i) => (
          <text key={line} className="ip-stamp__mono" x={C} y={firstY + i * 10.5} fontSize={7.8} letterSpacing="0.18em">
            {line}
          </text>
        ))}
      </g>
    ) : null;
  const size = shape === "oval" ? 78 : shape === "rounded" ? 84 : 88;
  const hasText = labels && lines.length > 0;
  const art: ArtBox = { cx: C, cy: hasText ? C - (shape === "oval" ? 13 : 12) : C, size: hasText ? size : size + 14 };
  // A ghost: clearly lighter than any printed status, the pending one included (STM-7).
  return { frame, marks, art, artOpacity: 0.35, frameOpacity: 0.55 };
}

/* --- Pending clock badge ---------------------------------------------- */

/**
 * The "Donation pending" mark: a solid disc of ink with the clock showing through as paper. It
 * mirrors the foil seal of a Verified stamp in weight and position. Drawn around the origin.
 * The class name and the <g> are relied on by the donate and upgrade animations.
 */
function PendingBadge({ id, r, withText }: { id: string; r: number; withText: boolean }) {
  const k = r / 25;
  const clock = withText ? 8.6 * k : 13 * k;
  const line = (withText ? 2.2 : 2.9) * k;
  const maskId = `${id}-pm`;
  const pad = r + 3;
  return (
    <g className="ip-stamp__pendingmark" data-solid="">
      <mask id={maskId} maskUnits="userSpaceOnUse" x={-pad} y={-pad} width={pad * 2} height={pad * 2}>
        <rect x={-pad} y={-pad} width={pad * 2} height={pad * 2} fill="#fff" />
        <g fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round">
          {withText && (
            <g className="ip-stamp__ko">
              <path id={`${id}-pt`} d={circlePath(r * 0.64)} fill="none" stroke="none" />
              <text fontSize={r * 0.235} textLength={2 * Math.PI * r * 0.64 * 0.96} lengthAdjust="spacing">
                <textPath href={`#${id}-pt`} startOffset="0">
                  {`${strings.status.pending.tab.split(" ").join(" · ")} ·`}
                </textPath>
              </text>
            </g>
          )}
          <circle r={clock} strokeWidth={line} />
          <path d={`M 0 ${-clock * 0.56} V 0 L ${clock * 0.4} ${clock * 0.25}`} strokeWidth={line} />
        </g>
      </mask>
      <circle r={r} fill="currentColor" mask={`url(#${maskId})`} />
    </g>
  );
}

/* --- Ink filters ------------------------------------------------------ */

const REVEAL_SLOPE = 7;
const REVEAL_DONE = "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1";
/** Lettering wobbles this much of the frame's displacement, and not at all below TEXT_ROUGH_FROM px. */
const TEXT_ROUGH = 0.4;
const TEXT_ROUGH_FROM = 160;
/** Margin round the 200-unit box that the in-SVG filters and masks cover. */
const BLEED = 16;

function revealMatrix(p: number): string {
  if (p >= 1) return REVEAL_DONE;
  const threshold = 0.2 + 0.66 * clamp(p, 0, 1);
  return `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${-REVEAL_SLOPE} ${round2(REVEAL_SLOPE * threshold)}`;
}

function inkAlpha(p: number): number {
  if (p <= 0) return 0;
  return clamp(0.35 + 0.9 * p, 0, 1);
}

interface InkFilterProps {
  id: string;
  seed: number;
  size: number;
  status: StampStatus;
  tok: DirectionTokens;
  /** Include the blotchy reveal stage (needed whenever inkProgress can be below 1). */
  reveal: boolean;
  progress: number;
  revealRef: React.Ref<SVGFEColorMatrixElement>;
  /** Also define the lighter rough edge for lettering. */
  textRough: boolean;
}

/**
 * Four filters, one impression:
 *   {id}-f   on the whole ink layer (CSS px): dry speckle, density variation and the press reveal
 *   {id}-dx  on the frame group inside the SVG (stamp units): the rough, wobbly edge
 *   {id}-da  on the artwork wrapper (CSS px): the same rough edge
 *   {id}-dt  on the lettering (stamp units): 40% of that wobble, large stamps only
 * The edge noise has the same seed and the same frequency in all three, so frame and artwork
 * still look like one rubber die.
 */
function InkFilter({ id, seed, size, status, tok, reveal, progress, revealRef, textRough }: InkFilterProps) {
  const k = size / 200; // CSS px per stamp unit
  const rough = tok.impression.rough;
  const speckle = clamp(tok.impression.speckle + (status === "verified" ? -0.2 : 0), 0, 1);
  const edgeF = round2(clamp(0.26 / k, 0.05, 0.9));
  const edgeU = Number((edgeF * k).toFixed(4));
  const grainF = round2(clamp(0.5 / Math.sqrt(k), 0.1, 1.2));
  const blotchF = Number(clamp(0.021 / k, 0.004, 0.2).toFixed(4));
  const grainThreshold = 0.745 - 0.3 * speckle;
  const grainSlope = 6.5;
  // Density variation: how far the lightest patches drop.
  const [blotchSlope, blotchOffset] = status === "verified" ? [0.8, 1.38] : [1.2, 1.5];
  const alphaRow = (slope: number, offset: number) =>
    `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${round2(-slope)} ${round2(offset)}`;
  const unitRegion = { filterUnits: "userSpaceOnUse" as const, x: -BLEED, y: -BLEED, width: 200 + BLEED * 2, height: 200 + BLEED * 2 };

  return (
    <>
      <filter id={`${id}-f`} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={grainF} numOctaves="2" seed={seed + 3} result="grainNoise" />
        <feColorMatrix in="grainNoise" type="matrix" values={alphaRow(grainSlope, grainSlope * grainThreshold + 0.5)} result="grain" />
        <feTurbulence type="fractalNoise" baseFrequency={blotchF} numOctaves="2" seed={seed + 7} result="blotchNoise" />
        <feColorMatrix in="blotchNoise" type="matrix" values={alphaRow(blotchSlope, blotchOffset)} result="blotch" />
        <feComposite in="SourceGraphic" in2="grain" operator="in" result="speckled" />
        <feComposite in="speckled" in2="blotch" operator="in" result="inked" />
        {reveal && (
          <>
            <feTurbulence type="fractalNoise" baseFrequency={Number(clamp(0.05 / k, 0.008, 0.4).toFixed(4))} numOctaves="3" seed={seed + 11} result="revealNoise" />
            <feColorMatrix ref={revealRef} in="revealNoise" type="matrix" values={revealMatrix(progress)} result="revealMask" />
            <feComposite in="inked" in2="revealMask" operator="in" />
          </>
        )}
      </filter>
      <filter id={`${id}-da`} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={edgeF} numOctaves="2" seed={seed} result="edge" />
        <feDisplacementMap in="SourceGraphic" in2="edge" scale={round2(rough * k * 1.2)} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id={`${id}-dx`} {...unitRegion} colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={edgeU} numOctaves="2" seed={seed} result="edge" />
        <feDisplacementMap in="SourceGraphic" in2="edge" scale={round2(rough * 1.2)} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      {textRough && (
        <filter id={`${id}-dt`} {...unitRegion} colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={edgeU} numOctaves="2" seed={seed} result="edge" />
          <feDisplacementMap in="SourceGraphic" in2="edge" scale={round2(rough * 1.2 * TEXT_ROUGH)} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const BLEED_BOX = { x: -BLEED, y: -BLEED, width: 200 + BLEED * 2, height: 200 + BLEED * 2 };
const MASK_BOX = { maskUnits: "userSpaceOnUse" as const, ...BLEED_BOX };

const isSource = (v: unknown): v is ProgressSource =>
  typeof v === "object" && v !== null && typeof (v as ProgressSource).get === "function" && typeof (v as ProgressSource).on === "function";

const INK_OPACITY: Record<StampStatus, number> = { discovery: 0.92, pending: 0.95, verified: 0.97 };

export function Stamp({
  stamp,
  slot,
  size = 160,
  status: statusOverride,
  variant,
  inkProgress = 1,
  showLabels = true,
  showSeal = true,
  rotate,
  ink = "rough",
  blend = "normal",
  detail: detailProp = "auto",
  emptyLabel,
  decorative = false,
  className,
  style,
}: StampProps) {
  const tok = useDirectionTokens();
  const id = safeId(useId());
  const inkRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<SVGSVGElement>(null);
  const revealRef = useRef<SVGFEColorMatrixElement>(null);

  const tpl: Template | null = stamp
    ? { id: stamp.id, art: stamp.art, title: stamp.title, island: stamp.island, shape: stamp.shape, kind: stamp.kind, promoter: stamp.promoter, date: stamp.date }
    : slot
      ? { id: slot.id, art: slot.art, title: slot.title, island: slot.island, shape: slot.shape, kind: slot.kind, promoter: "", date: "" }
      : null;

  const mode: "stamp" | "empty" = variant ?? (stamp ? "stamp" : "empty");
  const isEmpty = mode === "empty" || !stamp;
  const status: StampStatus = statusOverride ?? stamp?.status ?? "discovery";
  const provincial = tpl?.kind === "provincial" || tpl?.shape === "seal";
  const detail: Detail = detailProp === "auto" ? (size < 120 ? "compact" : size >= 220 ? "large" : "full") : detailProp;

  const animated = isSource(inkProgress);
  const initialProgress = animated ? clamp(inkProgress.get(), 0, 1) : clamp(inkProgress as number, 0, 1);
  const baseOpacity = isEmpty ? 1 : provincial ? 0.95 : INK_OPACITY[status];
  const useFilter = ink === "rough" && !isEmpty;
  const needsReveal = useFilter && (animated || initialProgress < 1);

  // Drive ink coverage straight on the DOM when a MotionValue is supplied: no React re-renders.
  useEffect(() => {
    if (!isSource(inkProgress)) return;
    const apply = (value: number) => {
      const p = clamp(value, 0, 1);
      if (inkRef.current) inkRef.current.style.opacity = String(round2(baseOpacity * inkAlpha(p)));
      if (sealRef.current) sealRef.current.style.opacity = String(round2(clamp(p * 1.5, 0, 1)));
      if (revealRef.current) revealRef.current.setAttribute("values", revealMatrix(p));
    };
    apply(inkProgress.get());
    return inkProgress.on("change", apply);
  }, [inkProgress, baseOpacity]);

  const drawn = useMemo<Drawn | null>(() => {
    if (!tpl) return null;
    const ctx: DrawContext = { tpl, status, detail, labels: showLabels, id, tok };
    if (isEmpty) return drawEmpty(ctx, emptyLabel ?? strings.stamp.empty);
    if (provincial) return drawSeal(ctx);
    if (tpl.shape === "rounded") return drawRounded(ctx);
    return drawRing(ctx);
    // tpl is rebuilt every render: depend on its fields instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl?.id, tpl?.art, tpl?.island, tpl?.shape, tpl?.kind, tpl?.promoter, tpl?.date, status, detail, showLabels, id, tok, isEmpty, provincial, emptyLabel]);

  if (!tpl || !drawn) return null;

  const tilt = isEmpty || rotate === false ? 0 : typeof rotate === "number" ? rotate : stampTilt(tpl.id, tpl.kind);
  const seed = 1 + (Math.floor(rand(tpl.id, "ink") * 900) % 900);
  const anchor = badgeAnchor(tpl.shape);
  const withMarkText = detail === "large";
  const showPendingMark = !isEmpty && !provincial && status === "pending" && showSeal;
  const showVerifiedSeal = !isEmpty && !provincial && status === "verified" && showSeal;
  const inkVar = isEmpty ? "var(--ink-empty)" : provincial ? "var(--ink-provincial)" : `var(--ink-${status})`;
  const art = drawn.art;
  const url = artUrl(tpl.art);
  const filterId = `${id}-f`;
  // Lettering: a light wobble on large stamps, none on small ones (see the header comment).
  const textRough = useFilter && size >= TEXT_ROUGH_FROM;
  const roughFilter = useFilter ? `url(#${id}-dx)` : undefined;
  const textFilter = textRough ? `url(#${id}-dt)` : undefined;

  const label = decorative ? undefined : ariaLabel(tpl, status, isEmpty, provincial);

  const rootStyle = {
    width: size,
    height: size,
    "--stamp-ink": inkVar,
    "--stamp-rotate": `${tilt}deg`,
    ...style,
  } as CSSProperties;

  const maskImage = `url("${url}")`;

  return (
    <div
      className={["ip-stamp", className].filter(Boolean).join(" ")}
      style={rootStyle}
      role={decorative ? undefined : "img"}
      aria-label={label}
      aria-hidden={decorative || undefined}
      data-status={isEmpty ? "empty" : status}
      data-kind={tpl.kind}
      data-shape={tpl.shape}
      data-detail={detail}
      data-blend={blend}
    >
      {useFilter && (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <defs>
            <InkFilter
              id={id}
              seed={seed}
              size={size}
              status={provincial ? "verified" : status}
              tok={tok}
              reveal={needsReveal}
              progress={initialProgress}
              revealRef={revealRef}
              textRough={textRough}
            />
          </defs>
        </svg>
      )}
      <div className="ip-stamp__tilt">
        <div
          ref={inkRef}
          className="ip-stamp__ink"
          style={{
            opacity: round2(baseOpacity * inkAlpha(initialProgress)),
            filter: useFilter ? `url(#${filterId})` : undefined,
          }}
        >
          <svg className="ip-stamp__svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
            <defs>
              {drawn.defs}
              {drawn.hole && (
                <mask id={`${id}-mh`} {...MASK_BOX}>
                  <rect {...BLEED_BOX} fill="#fff" />
                  {drawn.hole}
                </mask>
              )}
              {drawn.ko && (
                <mask id={`${id}-mk`} {...MASK_BOX}>
                  <rect {...BLEED_BOX} fill="#fff" />
                  <g className="ip-stamp__disp" filter={textFilter}>
                    {drawn.ko}
                  </g>
                </mask>
              )}
            </defs>
            {/* Knock-out lettering is cut after the rough edge, so the wobble never closes it up. */}
            <g mask={drawn.ko ? `url(#${id}-mk)` : undefined}>
              <g className="ip-stamp__disp" filter={roughFilter} opacity={drawn.frameOpacity}>
                <g mask={drawn.hole ? `url(#${id}-mh)` : undefined}>{drawn.frame}</g>
                {showPendingMark && (
                  <g transform={`translate(${anchor.x} ${anchor.y})`}>
                    <PendingBadge id={id} r={PENDING_R} withText={withMarkText} />
                  </g>
                )}
              </g>
            </g>
            <g className="ip-stamp__disp" filter={textFilter}>
              {drawn.marks}
            </g>
          </svg>
          <div className="ip-stamp__rough" style={useFilter ? { filter: `url(#${id}-da)` } : undefined}>
            <div
              className="ip-stamp__art"
              style={{
                left: `${(art.cx - art.size / 2) / 2}%`,
                top: `${(art.cy - art.size / 2) / 2}%`,
                width: `${art.size / 2}%`,
                height: `${art.size / 2}%`,
                opacity: drawn.artOpacity,
                WebkitMaskImage: maskImage,
                maskImage,
              }}
            />
          </div>
        </div>
        {(drawn.foil || showVerifiedSeal) && (
          <svg
            ref={sealRef}
            className="ip-stamp__seal"
            viewBox="0 0 200 200"
            aria-hidden="true"
            focusable="false"
            style={{ opacity: round2(clamp(initialProgress * 1.5, 0, 1)) }}
          >
            <defs>
              <FoilDefs id={id} />
            </defs>
            {drawn.foil}
            {showVerifiedSeal && (
              <g transform={`translate(${anchor.x} ${anchor.y}) rotate(${round2(-tilt - 8)})`}>
                <SealMark id={id} r={SEAL_R} withText={withMarkText} />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}

function ariaLabel(tpl: Template, status: StampStatus, isEmpty: boolean, provincial: boolean): string {
  if (provincial) {
    return isEmpty
      ? t(strings.stamp.ariaProvincialLocked, { province: tpl.island })
      : t(strings.stamp.ariaProvincial, { province: tpl.island, date: formatDate(tpl.date) });
  }
  if (isEmpty) return t(strings.stamp.ariaEmpty, { title: tpl.title, island: tpl.island });
  const vars = { title: tpl.title, island: tpl.island, status: strings.status[status].label, date: formatDate(tpl.date) };
  return t(tpl.date ? strings.stamp.ariaStamp : strings.stamp.ariaStampNoDate, vars);
}

export default Stamp;
