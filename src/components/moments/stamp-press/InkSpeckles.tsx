"use client";

/**
 * <InkSpeckles />: the few flecks of ink a rubber stamp throws when it lands.
 *
 * Positions are deterministic from the stamp id, so the flecks the press animation leaves are the
 * same ones a host can keep on the page afterwards:
 *
 *   <div style={{ position: "relative", width: size, height: size }}>
 *     <Stamp stamp={stamp} size={size} />
 *     <InkSpeckles stamp={stamp} size={size} />
 *   </div>
 *
 * With a MotionValue as `progress` (0 = still under the rubber, 1 = landed) the flecks are moved
 * straight on the DOM, with transforms and opacity only.
 */
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Stamp, StampShape, StampStatus } from "@/lib/types";

export interface SpeckleProgress {
  get(): number;
  on(event: "change", callback: (value: number) => void): () => void;
}

export interface InkSpecklesProps {
  stamp: Pick<Stamp, "id" | "shape" | "status" | "kind">;
  /** Pixel size of the stamp box the flecks surround. */
  size: number;
  /** 0..1, or a MotionValue. Default 1 (landed). */
  progress?: number | SpeckleProgress;
  status?: StampStatus;
  className?: string;
  style?: CSSProperties;
}

interface Fleck {
  /** Landing point, in multiples of half the stamp size, from the centre. */
  x: number;
  y: number;
  /** Launch point (under the edge of the rubber). */
  x0: number;
  y0: number;
  /** Radius in px at size 160. */
  r: number;
  /** Elongation along the direction of travel once landed. */
  stretch: number;
  angle: number;
  alpha: number;
  /** 0..0.35: later flecks leave a touch later. */
  delay: number;
}

function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const rnd = (id: string, salt: string) => (hash(`${salt}:${id}`) % 100000) / 100000;

/** Distance from the centre to the frame along `angle`, in multiples of half the stamp size. */
function edge(shape: StampShape, angle: number): number {
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  if (shape === "oval") return 1 / Math.sqrt((c / 0.97) ** 2 + (s / 0.77) ** 2);
  if (shape === "rounded") return Math.min(0.92 / Math.max(c, 1e-3), 0.72 / Math.max(s, 1e-3));
  return 0.95;
}

/** The flecks for a stamp. Most land on the side the rubber touched first (lower left). */
export function inkFlecks(id: string, shape: StampShape): Fleck[] {
  const count = 5 + Math.floor(rnd(id, "fleck-n") * 2);
  const flecks: Fleck[] = [];
  for (let i = 0; i < count; i++) {
    const near = i < 3;
    const base = near ? Math.PI * 0.72 : Math.PI * 2 * rnd(id, `fleck-a${i}`);
    const angle = base + (near ? (rnd(id, `fleck-j${i}`) - 0.5) * 1.5 : 0);
    const e = edge(shape, angle);
    const dist = e + 0.09 + rnd(id, `fleck-d${i}`) * (near ? 0.2 : 0.13);
    const big = i === 1;
    flecks.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      x0: Math.cos(angle) * e * 0.9,
      y0: Math.sin(angle) * e * 0.9,
      r: big ? 1.7 : 0.55 + rnd(id, `fleck-r${i}`) * 0.75,
      stretch: big ? 1.5 : 1 + rnd(id, `fleck-s${i}`) * 0.5,
      angle,
      alpha: big ? 0.8 : 0.5 + rnd(id, `fleck-o${i}`) * 0.35,
      delay: rnd(id, `fleck-t${i}`) * 0.3,
    });
  }
  return flecks;
}

const isSource = (v: unknown): v is SpeckleProgress =>
  typeof v === "object" && v !== null && typeof (v as SpeckleProgress).get === "function";

function place(el: HTMLElement, f: Fleck, half: number, progress: number): void {
  const p = Math.min(1, Math.max(0, (progress - f.delay) / (1 - f.delay)));
  const x = (f.x0 + (f.x - f.x0) * p) * half;
  const y = (f.y0 + (f.y - f.y0) * p) * half;
  const streak = f.stretch + (1 - p) * 2.2; // a streak in flight, a fleck at rest
  el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${f.angle.toFixed(3)}rad) scale(${streak.toFixed(3)}, 1)`;
  el.style.opacity = (p <= 0 ? 0 : Math.min(1, p * 4) * f.alpha).toFixed(3);
}

export function InkSpeckles({ stamp, size, progress = 1, status, className, style }: InkSpecklesProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const flecks = useMemo(() => inkFlecks(stamp.id, stamp.shape), [stamp.id, stamp.shape]);
  const half = size / 2;
  const k = Math.max(0.75, size / 160);
  const inkVar = stamp.kind === "provincial" ? "var(--ink-provincial)" : `var(--ink-${status ?? stamp.status})`;
  const initial = isSource(progress) ? progress.get() : progress;

  useEffect(() => {
    if (!isSource(progress)) return;
    const apply = (value: number) => {
      const nodes = rootRef.current?.children;
      if (!nodes) return;
      for (let i = 0; i < flecks.length && i < nodes.length; i++) place(nodes[i] as HTMLElement, flecks[i], half, value);
    };
    apply(progress.get());
    return progress.on("change", apply);
  }, [progress, flecks, half]);

  return (
    <span
      ref={rootRef}
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, pointerEvents: "none", color: inkVar, ...style }}
    >
      {flecks.map((f, i) => {
        const p = Math.min(1, Math.max(0, (initial - f.delay) / (1 - f.delay)));
        const d = f.r * 2 * k;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: -d / 2,
              top: -d / 2,
              width: d,
              height: d,
              borderRadius: "50%",
              background: "currentColor",
              opacity: p <= 0 ? 0 : Math.min(1, p * 4) * f.alpha,
              transform: `translate3d(${((f.x0 + (f.x - f.x0) * p) * half).toFixed(2)}px, ${((f.y0 + (f.y - f.y0) * p) * half).toFixed(2)}px, 0) rotate(${f.angle.toFixed(3)}rad) scale(${(f.stretch + (1 - p) * 2.2).toFixed(3)}, 1)`,
            }}
          />
        );
      })}
    </span>
  );
}

export default InkSpeckles;
