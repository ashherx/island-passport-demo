/**
 * <QrCode />: a crisp SVG QR code drawn from the `qrcode` package's module matrix.
 *
 * The dark modules are drawn as horizontal runs with round caps (soft "pill" rows), the three
 * finder eyes as rounded squares, and an optional mark sits in a clearing at the centre (error
 * correction goes up to H when there is one). No hooks: it renders on the server too.
 */
import { create } from "qrcode";
import type { CSSProperties, ReactNode } from "react";
import { shareCopy } from "@/lib/share/sample";

export interface QrMatrix {
  /** Modules per side. */
  size: number;
  /** True where a module is dark. */
  dark: (x: number, y: number) => boolean;
}

/** The module matrix for a value. Level H when a centre mark will cover part of it, else M. */
export function qrMatrix(value: string, withMark = false): QrMatrix {
  const { modules } = create(value, { errorCorrectionLevel: withMark ? "H" : "M" });
  const { size, data } = modules;
  return { size, dark: (x, y) => x >= 0 && y >= 0 && x < size && y < size && data[y * size + x] === 1 };
}

/** Quiet zone, in modules, drawn inside the SVG. Keep the code on white for the rest. */
export const QR_MARGIN = 2;

interface QrGeometry {
  /** Runs of dark modules as a stroked path (stroke-width 1, round or butt caps). */
  runs: string;
  eyes: { x: number; y: number }[];
  /** Radius, in modules, of the centre clearing (0 without a mark). */
  hole: number;
  size: number;
}

/** Shared by the SVG below and the canvas renderer in render.ts. */
export function qrGeometry(matrix: QrMatrix, withMark: boolean, soft: boolean): QrGeometry {
  const { size, dark } = matrix;
  const eyes = [
    { x: 0, y: 0 },
    { x: size - 7, y: 0 },
    { x: 0, y: size - 7 },
  ];
  const inEye = (x: number, y: number) => eyes.some((e) => x >= e.x && x < e.x + 7 && y >= e.y && y < e.y + 7);
  // The clearing covers about 5% of the modules, well inside what level H can rebuild.
  const hole = withMark ? Math.max(3.2, size * 0.135) : 0;
  const c = size / 2;
  const inHole = (x: number, y: number) => hole > 0 && Math.hypot(x + 0.5 - c, y + 0.5 - c) < hole;
  const on = (x: number, y: number) => dark(x, y) && !inEye(x, y) && !inHole(x, y);
  let runs = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!on(x, y)) {
        x++;
        continue;
      }
      let end = x;
      while (end + 1 < size && on(end + 1, y)) end++;
      const n = end - x + 1;
      // Round caps add half a module at each end, so a soft run is drawn between module centres.
      runs += soft ? `M${x + 0.5} ${y + 0.5}h${n === 1 ? 0.01 : n - 1}` : `M${x} ${y + 0.5}h${n}`;
      x = end + 1;
    }
  }
  return { runs, eyes, hole, size };
}

export interface QrCodeProps {
  /** What the code encodes. For a share code pass `useShareTarget(code)` (or `shareUrl(code)`). */
  value: string;
  /** Pixel size of the code itself. Default 168. Scales crisply: it is an SVG. */
  size?: number;
  /**
   * Small caps line above the code. Default "Scan to support". Pass false for none. With `name`
   * it reads as "SCAN TO SUPPORT / Coral Trust".
   */
  label?: string | false;
  /** Larger serif line under the label: the charity or partner being supported. */
  name?: string;
  /** Line under the code: the short link, e.g. `shareDisplayUrl(code)`. */
  link?: string;
  /** Mark at the centre. true = the Island Passport globe; or pass any small node. Default true. */
  mark?: boolean | ReactNode;
  /** "card" = white card with shadow and viewfinder corners. "bare" = just the code (and labels). */
  frame?: "card" | "bare";
  /** "soft" = rounded pill rows (default). "square" = classic square modules. */
  variant?: "soft" | "square";
  /** Ink colour. Default the palette ink (#12293a). Keep it dark: contrast is what scanners read. */
  color?: string;
  /** Scale-in when it first appears. Default true (off under reduced motion). */
  animate?: boolean;
  /** Accessible name. Default "QR code for <link or value>". */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export function QrCode({
  value,
  size = 168,
  label = shareCopy.scanToSupport,
  name,
  link,
  mark = true,
  frame = "card",
  variant = "soft",
  color = "#12293a",
  animate = true,
  title,
  className = "",
  style,
}: QrCodeProps) {
  const withMark = Boolean(mark);
  const soft = variant === "soft";
  const geo = qrGeometry(qrMatrix(value, withMark), withMark, soft);
  const n = geo.size;
  const box = n + QR_MARGIN * 2;
  const c = n / 2;
  return (
    <figure
      className={`sk-qr ${className}`}
      data-frame={frame}
      data-animate={animate}
      style={{ margin: 0, "--qr-size": `${size}px`, ...style } as CSSProperties}
    >
      {label || name ? (
        <figcaption className="sk-qr-label">
          {label ? <span className="sk-qr-kicker">{label}</span> : null}
          {name ? <span className="sk-qr-name">{name}</span> : null}
        </figcaption>
      ) : null}
      <div className="sk-qr-code">
        <svg viewBox={`${-QR_MARGIN} ${-QR_MARGIN} ${box} ${box}`} role="img" aria-label={title ?? `QR code for ${link ?? value}`}>
          <rect x={-QR_MARGIN} y={-QR_MARGIN} width={box} height={box} rx={soft ? 2.4 : 0} fill="#fff" />
          <path d={geo.runs} stroke={color} strokeWidth={soft ? 0.94 : 1} strokeLinecap={soft ? "round" : "butt"} fill="none" shapeRendering={soft ? undefined : "crispEdges"} />
          {geo.eyes.map((e) => (
            <g key={`${e.x}-${e.y}`}>
              <rect x={e.x + 0.5} y={e.y + 0.5} width={6} height={6} rx={soft ? 1.9 : 0} fill="none" stroke={color} strokeWidth={1} />
              <rect x={e.x + 2} y={e.y + 2} width={3} height={3} rx={soft ? 1 : 0} fill={color} />
            </g>
          ))}
          {withMark ? (
            <g transform={`translate(${c} ${c})`}>
              {mark === true ? (
                <g color="#06706d">
                  <circle r={geo.hole - 0.7} fill="#e2f6f4" />
                  <g transform={`scale(${(geo.hole - 1.2) / 9.4})`} fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <circle r="9.4" fill="#fff" />
                    <path d="M-9.4 0h18.8M0-9.4c3.4 2.7 3.4 16.1 0 18.8M0-9.4c-3.4 2.7-3.4 16.1 0 18.8" />
                  </g>
                </g>
              ) : (
                <foreignObject x={-geo.hole + 0.6} y={-geo.hole + 0.6} width={geo.hole * 2 - 1.2} height={geo.hole * 2 - 1.2}>
                  {mark}
                </foreignObject>
              )}
            </g>
          ) : null}
        </svg>
      </div>
      {link ? <span className="sk-qr-link">{link}</span> : null}
    </figure>
  );
}
