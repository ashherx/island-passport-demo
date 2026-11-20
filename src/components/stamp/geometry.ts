/**
 * Geometry helpers for the stamp renderer. Everything is in "stamp units": the stamp is drawn
 * in a 200 x 200 box centred on (100, 100) and scaled to the requested pixel size.
 */

export const BOX = 200;
export const C = 100;

/** FNV-1a hash of a string, as an unsigned 32-bit integer. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random number in [0, 1) for an id and a salt. */
export function rand(id: string, salt: string): number {
  return (hash(`${salt}:${id}`) % 100000) / 100000;
}

const n = (v: number) => Number(v.toFixed(2));

/** Half ellipse from the left end over the TOP to the right end. Text sits outside, upright. */
export function arcTop(rx: number, ry: number = rx, cx = C, cy = C): string {
  return `M ${n(cx - rx)} ${cy} A ${n(rx)} ${n(ry)} 0 0 1 ${n(cx + rx)} ${cy}`;
}

/** Half ellipse from the left end under the BOTTOM to the right end. Text sits inside, upright. */
export function arcBottom(rx: number, ry: number = rx, cx = C, cy = C): string {
  return `M ${n(cx - rx)} ${cy} A ${n(rx)} ${n(ry)} 0 0 0 ${n(cx + rx)} ${cy}`;
}

/** Full circle as a path that starts at 12 o'clock and runs clockwise (for text rings). */
export function circlePath(r: number, cx = 0, cy = 0): string {
  return `M ${n(cx)} ${n(cy - r)} A ${n(r)} ${n(r)} 0 1 1 ${n(cx)} ${n(cy + r)} A ${n(r)} ${n(r)} 0 1 1 ${n(cx)} ${n(cy - r)} Z`;
}

/** Regular polygon with a flat top edge. */
export function polygonPath(sides: number, radius: number, cx = C, cy = C): string {
  const offset = -Math.PI / 2 + Math.PI / sides;
  let d = "";
  for (let i = 0; i < sides; i++) {
    const a = offset + (2 * Math.PI * i) / sides;
    d += `${i === 0 ? "M" : "L"} ${n(cx + radius * Math.cos(a))} ${n(cy + radius * Math.sin(a))} `;
  }
  return `${d}Z`;
}

/** Scalloped (postal) edge: `bumps` shallow arcs that bulge outward from `radius`. */
export function scallopPath(bumps: number, radius: number, bulge = 0.8, cx = C, cy = C): string {
  const chord = 2 * radius * Math.sin(Math.PI / bumps);
  const r = chord * bulge;
  let d = "";
  for (let i = 0; i <= bumps; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / bumps;
    const x = n(cx + radius * Math.cos(a));
    const y = n(cy + radius * Math.sin(a));
    d += i === 0 ? `M ${x} ${y} ` : `A ${n(r)} ${n(r)} 0 0 1 ${x} ${y} `;
  }
  return `${d}Z`;
}

/** Star burst with `points` tips, alternating between two radii. */
export function burstPath(points: number, outer: number, inner: number, cx = 0, cy = 0): string {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (Math.PI * i) / points;
    d += `${i === 0 ? "M" : "L"} ${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))} `;
  }
  return `${d}Z`;
}

/** Four-point sparkle used as a separator on the frame. */
export function sparklePath(cx: number, cy: number, size: number): string {
  const s = size;
  const k = size * 0.28;
  return `M ${n(cx)} ${n(cy - s)} L ${n(cx + k)} ${n(cy - k)} L ${n(cx + s)} ${n(cy)} L ${n(cx + k)} ${n(cy + k)} L ${n(cx)} ${n(cy + s)} L ${n(cx - k)} ${n(cy + k)} L ${n(cx - s)} ${n(cy)} L ${n(cx - k)} ${n(cy - k)} Z`;
}

/** Five-point star centred on (cx, cy). */
export function starPath(cx: number, cy: number, size: number): string {
  return burstPath(5, size, size * 0.42, cx, cy);
}

/**
 * Largest font size (not above `base`) at which `text` fits in `maxWidth`.
 * `advance` is the average glyph width in em and `tracking` the letter spacing in em.
 */
export function fitFont(text: string, maxWidth: number, base: number, advance: number, tracking: number): number {
  const count = Math.max(1, text.length);
  return n(Math.min(base, maxWidth / (count * (advance + tracking))));
}

export { n as round2 };
