/**
 * The stamper: a turned handle on a mount with a rubber die, drawn on a 2D canvas.
 *
 * It is a small software 3D renderer for one very specific object. The handle is a lathe profile
 * drawn as stacked ellipses; the mount and die are extruded footprints. Pitch is the angle between
 * the tool's axis and the viewer: 0 looks straight down on the knob, 90 is a side view, and past
 * 90 the inked face turns toward the viewer. Painter's order flips at 90.
 *
 * Why canvas and not CSS 3D: the result is identical in every engine (the demo has to survive the
 * Instagram, TikTok and Facebook in-app browsers), there is no preserve-3d sorting to go wrong,
 * and a frame is about a hundred small fills.
 */
import type { StampShape } from "@/lib/types";
import type { StamperMaterial, Surface } from "./materials";
import { PRESS, easeOutCubic } from "./timeline";

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const CONTACT_SIN = Math.sin(PRESS.contactPitch * RAD);

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

/** Parse "#rgb", "#rrggbb" or "rgb(r,g,b)". */
function parseHex(color: string): [number, number, number] {
  if (color.charCodeAt(0) !== 35) {
    const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(color);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  }
  let h = color.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two colours. t = 0 returns a, t = 1 returns b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})`;
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

export type FootprintKind = "round" | "oval" | "rect" | "octagon";

export interface StamperSpec {
  /** Pixel size of the stamp this tool prints. */
  size: number;
  kind: FootprintKind;
  /** Half extents of the mount. */
  hx: number;
  hy: number;
  corner: number;
  mountT: number;
  dieT: number;
  /** Unit of the handle: its radii are multiples of this. */
  hu: number;
  handleH: number;
}

export function stamperSpec(size: number, shape: StampShape): StamperSpec {
  const half = size / 2;
  let kind: FootprintKind = "round";
  let hx = half * 1.04;
  let hy = half * 1.04;
  let corner = 0;
  if (shape === "oval") {
    kind = "oval";
    hy = half * 0.84;
  } else if (shape === "rounded") {
    kind = "rect";
    hx = half * 1.0;
    hy = half * 0.8;
    corner = half * 0.2;
  } else if (shape === "octagon") {
    kind = "octagon";
    hx = half * 1.02;
    hy = half * 1.02;
  }
  const hu = Math.min(hx, hy) * (kind === "round" || kind === "octagon" ? 1 : 1.12);
  return { size, kind, hx, hy, corner, mountT: half * 0.2, dieT: half * 0.075, hu, handleH: hu * 1.5 };
}

/** How far the tool can reach from the contact point, for sizing the canvas. */
export function stamperReach(spec: StamperSpec): { side: number; up: number; down: number } {
  const maxScale = 1.34;
  const tall = (spec.handleH + spec.mountT + spec.dieT) * maxScale;
  return {
    // Room for the entrance from the lower right (DRIFT 0.55, DROP 0.5 in timeline.ts) and for the
    // top of the backswing (HEIGHT 1.5).
    side: spec.hx * maxScale + spec.size * 0.72,
    up: spec.size * 1.0 + tall + spec.hy * 0.6,
    down: spec.hy * 1.9 + spec.size * 0.72,
  };
}

const smooth = (p: number) => p * p * (3 - 2 * p);
const smoother = (p: number) => p * p * p * (p * (p * 6 - 15) + 10);

/** Handle radius (in multiples of `hu`) at s = 0 (on the mount) .. 1 (top of the knob). */
function profile(s: number): number {
  if (s < 0.085) return 0.335 + 0.024 * Math.sin((Math.PI * s) / 0.085); // ferrule with a rolled bead
  if (s < 0.4) return 0.27 + (0.172 - 0.27) * smooth((s - 0.085) / 0.315); // waist
  if (s < 0.78) return 0.172 + (0.4 - 0.172) * smoother((s - 0.4) / 0.38); // swell
  const x = (s - 0.78) / 0.22;
  return 0.4 * Math.pow(Math.max(0, 1 - x * x), 0.55); // dome
}

/** dr/dz of the handle (radius change per unit of height). */
function profileSlope(s: number): number {
  return (profile(Math.min(1, s + 0.003)) - profile(Math.max(0, s - 0.003))) / 0.006 / 1.5;
}

/** 0 handle, 1 metal ferrule, 2 turned band */
function profileMaterial(s: number): 0 | 1 | 2 {
  if (s < 0.085) return 1;
  return (s > 0.5 && s < 0.528) || (s > 0.552 && s < 0.566) ? 2 : 0;
}

/* ------------------------------------------------------------------ */
/* Paths and gradients                                                 */
/* ------------------------------------------------------------------ */

/** Trace the mount footprint, centred on (0, yc), squashed vertically by `ac`, scaled by `f`. */
function footprint(ctx: CanvasRenderingContext2D, spec: StamperSpec, yc: number, ac: number, f = 1): void {
  const hx = spec.hx * f;
  const hy = Math.max(spec.hy * f * ac, 0.4);
  ctx.beginPath();
  if (spec.kind === "rect") {
    const c = Math.min(spec.corner * f, hx);
    const cy = Math.max(Math.min(spec.corner * f * ac, hy), 0.05);
    ctx.moveTo(-hx + c, yc - hy);
    ctx.lineTo(hx - c, yc - hy);
    ctx.ellipse(hx - c, yc - hy + cy, c, cy, 0, -Math.PI / 2, 0);
    ctx.lineTo(hx, yc + hy - cy);
    ctx.ellipse(hx - c, yc + hy - cy, c, cy, 0, 0, Math.PI / 2);
    ctx.lineTo(-hx + c, yc + hy);
    ctx.ellipse(-hx + c, yc + hy - cy, c, cy, 0, Math.PI / 2, Math.PI);
    ctx.lineTo(-hx, yc - hy + cy);
    ctx.ellipse(-hx + c, yc - hy + cy, c, cy, 0, Math.PI, Math.PI * 1.5);
    ctx.closePath();
  } else if (spec.kind === "octagon") {
    const rv = hx / Math.cos(Math.PI / 8);
    const sy = hy / hx;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + Math.PI / 8 + (TAU * i) / 8;
      const px = rv * Math.cos(a);
      const py = yc + rv * Math.sin(a) * sy;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    ctx.ellipse(0, yc, hx, hy, 0, 0, TAU);
  }
}

/**
 * Horizontal shading for a rounded wall, lit from the upper left. Spans x0..x1.
 * `soft` (0..1) flattens the contrast: used where the surface turns toward the viewer.
 * `tone` (-1..1) lifts the whole wall toward white (negative) or drops it toward black (positive).
 */
function wallGradient(
  ctx: CanvasRenderingContext2D,
  s: Surface,
  x0: number,
  x1: number,
  flat = false,
  soft = 0,
  tone = 0,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  const toned = (c: string) => (tone === 0 ? c : mix(c, tone > 0 ? "#000000" : "#ffffff", Math.abs(tone)));
  if (flat) {
    g.addColorStop(0, s.deep);
    g.addColorStop(0.035, s.dark);
    g.addColorStop(0.11, s.base);
    g.addColorStop(0.3, mix(s.base, s.light, 0.75));
    g.addColorStop(0.36, mix(s.light, "#ffffff", s.gloss * 0.45));
    g.addColorStop(0.43, mix(s.base, s.light, 0.6));
    g.addColorStop(0.72, s.base);
    g.addColorStop(0.9, mix(s.base, s.dark, 0.7));
    g.addColorStop(0.965, s.dark);
    g.addColorStop(1, s.deep);
    return g;
  }
  const light = mix(s.light, s.base, soft * 0.62);
  const dark = mix(s.dark, s.base, soft * 0.42);
  const deep = mix(s.deep, s.dark, soft);
  const rim = mix(s.rim, dark, soft);
  const gloss = s.gloss * (1 - soft);
  g.addColorStop(0, toned(deep));
  g.addColorStop(0.05, toned(dark));
  g.addColorStop(0.2 - soft * 0.06, toned(s.base));
  g.addColorStop(0.31, toned(light));
  g.addColorStop(0.36, toned(mix(light, "#ffffff", gloss * 0.7)));
  g.addColorStop(0.42 + soft * 0.06, toned(light));
  g.addColorStop(0.6 + soft * 0.08, toned(s.base));
  g.addColorStop(0.83 + soft * 0.05, toned(dark));
  g.addColorStop(0.95, toned(deep));
  g.addColorStop(1, toned(rim));
  return g;
}

/** Fill the wall of an extrusion: the far footprint plus the band up to the near face. */
function extrude(
  ctx: CanvasRenderingContext2D,
  spec: StamperSpec,
  yFar: number,
  yNear: number,
  ac: number,
  f: number,
  fill: CanvasGradient | string,
): void {
  ctx.fillStyle = fill;
  footprint(ctx, spec, yFar, ac, f);
  ctx.fill();
  const top = Math.min(yFar, yNear);
  const h = Math.abs(yFar - yNear);
  if (h > 0.01) ctx.fillRect(-spec.hx * f, top, spec.hx * f * 2, h);
}

/* ------------------------------------------------------------------ */
/* Draw                                                                */
/* ------------------------------------------------------------------ */

export interface StamperPose {
  /** Page contact point (where the die centre rests), in canvas CSS pixels. */
  x: number;
  y: number;
  /** Pixels above the page. */
  height: number;
  /** Degrees. See the file header. */
  pitch: number;
  roll: number;
  /** Sideways drift in pixels. */
  drift: number;
  /** 0..1 compression on impact. */
  squash: number;
  scale: number;
  /** 0..1 progress of the shock ring (0 = none yet, 1 = gone). */
  ring: number;
}

export interface StamperPaint {
  material: StamperMaterial;
  /** Ink colour of the stamp being printed (hex). */
  ink: string;
  /** Colour used for the shadow and the shock ring (hex): the page's own ink colour. */
  pageInk: string;
  /** Pre-tinted artwork for the die face, or null while it loads. */
  art: CanvasImageSource | null;
  /** Resolved font family for the engraved lettering, or null to skip it. */
  font: string | null;
  /** Lettering engraved around the mount. */
  lettering: string;
  /** Filled in by the renderer: gradients and the baked top face, reused between frames. */
  cache?: { ctx: CanvasRenderingContext2D; slices: Map<number, CanvasGradient>; top: HTMLCanvasElement | null };
}

function paintCache(ctx: CanvasRenderingContext2D, paint: StamperPaint): NonNullable<StamperPaint["cache"]> {
  if (!paint.cache || paint.cache.ctx !== ctx) paint.cache = { ctx, slices: new Map(), top: null };
  return paint.cache;
}

/** Screen-space travel per pixel of height, and how much closer the tool looks as it rises. */
const RISE = 0.62;
const PERSPECTIVE = 0.24;

export function drawStamper(ctx: CanvasRenderingContext2D, spec: StamperSpec, paint: StamperPaint, pose: StamperPose): void {
  // A slot that lost its size mid-press (rotation, a layout breakpoint) must never reach the
  // gradient constructors: they throw on non-finite values, inside the animation frame.
  if (
    !(spec.size > 0) ||
    !Number.isFinite(spec.size) ||
    !Number.isFinite(spec.hx) ||
    !Number.isFinite(spec.hy) ||
    !Number.isFinite(pose.x) ||
    !Number.isFinite(pose.y) ||
    !Number.isFinite(pose.height) ||
    !Number.isFinite(pose.pitch) ||
    !Number.isFinite(pose.roll) ||
    !Number.isFinite(pose.drift) ||
    !Number.isFinite(pose.squash) ||
    !Number.isFinite(pose.scale) ||
    !Number.isFinite(pose.ring)
  ) {
    return;
  }
  const { material: mat } = paint;
  const hRel = pose.height / spec.size;
  const q = pose.squash;

  /* --- Shadow on the page ------------------------------------------- */
  {
    const reach = 1.1 + hRel * 0.6;
    const alpha = 0.36 / (1 + hRel * 2.4);
    ctx.save();
    ctx.translate(pose.x + pose.drift * 0.6 + pose.height * 0.16, pose.y + pose.height * 0.2);
    ctx.scale(1, (spec.hy / spec.hx) * 0.95);
    const g = ctx.createRadialGradient(0, 0, spec.hx * 0.2, 0, 0, spec.hx * reach);
    g.addColorStop(0, rgba(paint.pageInk, alpha));
    g.addColorStop(0.6 - Math.min(0.3, hRel * 0.3), rgba(paint.pageInk, alpha * 0.82));
    g.addColorStop(1, rgba(paint.pageInk, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, spec.hx * reach, 0, TAU);
    ctx.fill();
    // Contact shadow: tightens to a dark seam as the rubber meets the paper.
    const near = 1 - Math.min(1, hRel / 0.22);
    if (near > 0) {
      const c = ctx.createRadialGradient(0, 0, spec.hx * 0.86, 0, 0, spec.hx * 1.13);
      c.addColorStop(0, rgba(paint.pageInk, 0.5 * near));
      c.addColorStop(0.55, rgba(paint.pageInk, 0.26 * near));
      c.addColorStop(1, rgba(paint.pageInk, 0));
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, spec.hx * 1.13, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* --- Shock ring ----------------------------------------------------- */
  if (pose.ring > 0 && pose.ring < 1) {
    const p = easeOutCubic(pose.ring);
    const fade = (1 - pose.ring) * (1 - pose.ring);
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.lineJoin = "round";
    footprint(ctx, spec, 0, 0.94, 1.07 + 0.36 * p);
    ctx.strokeStyle = rgba(paint.pageInk, 0.17 * fade);
    ctx.lineWidth = 0.8 + 2.2 * (1 - p);
    ctx.stroke();
    footprint(ctx, spec, 0, 0.94, 1.07 + 0.62 * p);
    ctx.strokeStyle = rgba(paint.pageInk, 0.08 * fade);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /* --- The tool -------------------------------------------------------- */
  const theta = pose.pitch * RAD;
  const sn = Math.sin(theta);
  const cs = Math.cos(theta);
  const ac = Math.abs(cs);
  const seesTop = cs >= 0;

  const dieT = spec.dieT * (1 - 0.5 * q);
  const mountT = spec.mountT;
  const handleH = spec.handleH * (1 - 0.075 * q);
  const bulge = 1 + 0.03 * q;
  const zc = (spec.mountT + spec.handleH) * 0.42; // the tool swings about this point
  const yd = zc * (sn - CONTACT_SIN); // screen y of the die face centre
  const yOf = (z: number) => yd - z * sn;
  const yDie = yOf(0);
  const yMount0 = yOf(dieT);
  const yMount1 = yOf(dieT + mountT);
  const zHandle = dieT + mountT;

  ctx.save();
  ctx.translate(pose.x + pose.drift, pose.y - pose.height * RISE);
  ctx.rotate(pose.roll * RAD);
  const s = pose.scale * (1 + hRel * PERSPECTIVE);
  ctx.scale(s, s);
  ctx.lineJoin = "round";

  const flatWall = spec.kind === "rect" || spec.kind === "octagon";
  const rubberWall = wallGradient(ctx, mat.rubber, -spec.hx, spec.hx, flatWall);
  const mountWall = wallGradient(ctx, mat.mountSide, -spec.hx, spec.hx, flatWall);
  const dieScale = 0.955 * bulge;

  const drawHandle = () => {
    const { slices } = paintCache(ctx, paint);
    const bandSurface: Surface =
      mat.bands === "inlay" ? mat.metal : { ...mat.handle, base: mat.handle.dark, light: mat.handle.base, dark: mat.handle.deep };
    // One fill per slice. Its gradient is picked from a cache keyed by material, how far up
    // the swell it sits (the tight specular streak fades out toward the dome) and how much light
    // the slope of the profile catches there.
    const sliceGradient = (kind: 0 | 1 | 2, soft: number, tone: number): CanvasGradient => {
      // Quantised finely enough that neighbouring slices never show a step.
      const softQ = kind === 0 ? Math.round(soft * 20) : 0;
      const toneQ = Math.round(tone * 64);
      const key = kind * 1000000 + softQ * 1000 + (toneQ + 100);
      let g = slices.get(key);
      if (!g) {
        const surface = kind === 1 ? mat.metal : kind === 2 ? bandSurface : mat.handle;
        g = wallGradient(ctx, surface, -1, 1, false, softQ / 20, toneQ / 64);
        slices.set(key, g);
      }
      return g;
    };
    const pxPerS = handleH * sn; // screen travel per unit of s
    let sPos = seesTop ? 0 : 1;
    let prevY: number | null = null;
    const dir = seesTop ? 1 : -1;
    for (let guard = 0; guard < 420; guard++) {
      const r = profile(sPos) * spec.hu * bulge;
      const slope = profileSlope(sPos);
      if (r >= 0.35) {
        const kind = profileMaterial(sPos);
        // Surfaces that face up catch the light; the underside of the swell falls into shade.
        const shade = slope > 0 ? Math.min(0.42, slope * 0.55) : 0;
        const lift = slope < 0 ? Math.min(0.26, -slope * 0.12) : 0;
        const occlusion = sPos < 0.2 && kind === 0 ? (0.2 - sPos) * 1.2 : 0;
        const soft = 0.88 * smooth(Math.min(1, Math.max(0, (sPos - 0.55) / 0.27)));
        const y = yOf(zHandle + sPos * handleH);
        const ry = Math.max(r * ac, 0.5);
        ctx.save();
        ctx.translate(0, y);
        ctx.scale(r, ry);
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, TAU);
        // Seen from the side a slice is a sliver. Join it to the previous one with a bar, so the
        // silhouette stays a clean line instead of a row of pointed ends.
        if (prevY != null && ry < 3) {
          const gap = (prevY - y) / ry;
          ctx.rect(-1, Math.min(0, gap), 2, Math.abs(gap));
        }
        ctx.fillStyle = sliceGradient(kind, soft, shade + occlusion > 0 ? Math.min(0.6, shade + occlusion) : -lift);
        ctx.fill();
        ctx.restore();
        prevY = y;
      }
      if ((dir > 0 && sPos >= 1) || (dir < 0 && sPos <= 0)) break;
      // Step so that neither the silhouette nor the nested rings of the dome move more than a pixel.
      const pxPerSRadius = Math.abs(slope) * 1.5 * spec.hu;
      const ds = Math.min(0.04, Math.max(0.0015, 0.9 / Math.max(pxPerS, pxPerSRadius, 1e-3)));
      sPos = Math.min(1, Math.max(0, sPos + dir * ds));
    }
    if (seesTop && cs > 0.12) {
      // Specular on the dome.
      const rk = 0.4 * spec.hu * bulge;
      const yk = yOf(zHandle + handleH * 0.86);
      const gx = -rk * 0.34;
      const gy = yk - rk * 0.2 * ac;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, rk * 0.5);
      const a = 0.2 + 0.62 * mat.handle.gloss;
      g.addColorStop(0, `rgba(255,255,255,${(a * Math.min(1, cs * 1.4)).toFixed(3)})`);
      g.addColorStop(0.35, `rgba(255,255,255,${(a * 0.32 * cs).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, rk * 0.5, 0, TAU);
      ctx.fill();
    }
  };

  if (seesTop) {
    // Far to near: die wall, mount wall, mount top, handle.
    extrude(ctx, spec, yDie, yMount0, ac, dieScale, rubberWall);
    extrude(ctx, spec, yMount0, yMount1, ac, 1, mountWall);
    // Shade under the lower edge of the wall.
    const wallH = yMount0 - yMount1;
    if (wallH > 1) {
      const shadeG = ctx.createLinearGradient(0, yMount1, 0, yMount0 + spec.hy * ac);
      shadeG.addColorStop(0, "rgba(0,0,0,0)");
      shadeG.addColorStop(1, "rgba(0,0,0,.34)");
      ctx.save();
      footprint(ctx, spec, yMount0, ac);
      ctx.rect(-spec.hx, yMount1, spec.hx * 2, wallH);
      ctx.clip();
      ctx.fillStyle = shadeG;
      ctx.fillRect(-spec.hx, yMount1, spec.hx * 2, wallH + spec.hy * ac);
      ctx.restore();
    }
    drawMountTop(ctx, spec, paint, yMount1, ac, cs);
    drawHandle();
  } else {
    // Seen from below. Far to near: handle, mount wall, mount underside, die wall, die face.
    drawHandle();
    extrude(ctx, spec, yMount1, yMount0, ac, 1, mountWall);
    footprint(ctx, spec, yMount0, ac);
    ctx.fillStyle = mix(mat.mountSide.dark, mat.mountSide.deep, 0.5);
    ctx.fill();
    extrude(ctx, spec, yMount0, yDie, ac, dieScale, rubberWall);
    drawDieFace(ctx, spec, paint, yDie, ac, dieScale);
  }

  ctx.restore();
}

/** Resolution of the baked top face, in texture pixels per CSS pixel. */
const TOP_TEX = 3;
const TOP_CACHE = new Map<string, HTMLCanvasElement>();

/**
 * Paint the mount's top face once, seen from straight above: lacquer or wood, the engraved line
 * and lettering, the metal rim and the shade where the handle stands. Each frame then draws it
 * with a single drawImage, squashed by the pitch.
 */
function bakeMountTop(spec: StamperSpec, paint: StamperPaint): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const { material: mat } = paint;
  const key = [spec.kind, spec.hx.toFixed(1), spec.hy.toFixed(1), mat.mountTop.base, mat.metal.base, paint.font, paint.lettering].join("|");
  const hit = TOP_CACHE.get(key);
  if (hit) return hit;
  const top = mat.mountTop;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(spec.hx * 2 * TOP_TEX);
  canvas.height = Math.ceil(spec.hy * 2 * TOP_TEX);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(TOP_TEX, TOP_TEX);
  ctx.translate(spec.hx, spec.hy);
  ctx.lineJoin = "round";

  footprint(ctx, spec, 0, 1);
  ctx.clip();

  // Face
  const lx = -spec.hx * 0.42;
  const ly = -spec.hy * 0.5;
  const face = ctx.createRadialGradient(lx, ly, 0, lx, ly, spec.hx * 1.75);
  face.addColorStop(0, mix(top.base, top.light, 0.85));
  face.addColorStop(0.32, top.base);
  face.addColorStop(0.75, top.dark);
  face.addColorStop(1, top.deep);
  ctx.fillStyle = face;
  ctx.fillRect(-spec.hx, -spec.hy, spec.hx * 2, spec.hy * 2);

  if (mat.grain) {
    // Wood grain: long shallow arcs across the face.
    for (let i = -9; i <= 9; i++) {
      const gy = (i / 9) * spec.hy * 1.04;
      ctx.lineWidth = i % 3 === 0 ? 1.1 : 0.7;
      ctx.strokeStyle = i % 2 === 0 ? "rgba(40,24,10,.17)" : "rgba(255,225,180,.09)";
      ctx.beginPath();
      ctx.moveTo(-spec.hx, gy + Math.sin(i * 1.7) * 3);
      ctx.quadraticCurveTo(spec.hx * 0.1 * Math.sin(i), gy + 4 + 3 * Math.cos(i * 2.3), spec.hx, gy + Math.sin(i * 0.9 + 1) * 3);
      ctx.stroke();
    }
  }

  // Engraved line, with a highlight just below it so it reads as cut into the surface.
  const inset = spec.kind === "rect" ? 0.84 : 0.8;
  footprint(ctx, spec, 0.9, 1, inset);
  ctx.strokeStyle = mat.engraveHi;
  ctx.lineWidth = 1;
  ctx.stroke();
  footprint(ctx, spec, 0, 1, inset);
  ctx.strokeStyle = mat.engrave;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Engraved lettering around the handle (round mounts only).
  if (paint.font && (spec.kind === "round" || spec.kind === "octagon")) {
    const radius = spec.hx * 0.6;
    const text = paint.lettering;
    const fontPx = Math.max(6, Math.min(11, (TAU * radius) / text.length / 0.82));
    ctx.font = `700 ${fontPx.toFixed(1)}px ${paint.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? mat.engraveHi : mat.engrave;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " ") continue;
        ctx.save();
        ctx.translate(0, pass === 0 ? 0.8 : 0);
        ctx.rotate((i / text.length) * TAU + Math.PI);
        ctx.translate(0, -radius);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
    }
  }

  // Metal rim
  const rimPx = mat.rimWidth * spec.hx;
  const rim = ctx.createLinearGradient(-spec.hx, -spec.hy, spec.hx, spec.hy);
  const m = mat.metal;
  rim.addColorStop(0, m.light);
  rim.addColorStop(0.2, mix(m.light, "#ffffff", 0.5));
  rim.addColorStop(0.34, m.base);
  rim.addColorStop(0.58, m.dark);
  rim.addColorStop(0.76, m.base);
  rim.addColorStop(0.9, m.light);
  rim.addColorStop(1, m.dark);
  footprint(ctx, spec, 0, 1);
  ctx.strokeStyle = rim;
  ctx.lineWidth = rimPx * 2;
  ctx.stroke();
  footprint(ctx, spec, 0, 1, 1 - mat.rimWidth);
  ctx.strokeStyle = "rgba(0,0,0,.38)";
  ctx.lineWidth = 0.9;
  ctx.stroke();
  footprint(ctx, spec, 0, 1);
  ctx.strokeStyle = "rgba(255,255,255,.42)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Occlusion and a short cast shadow where the handle stands.
  const ax = spec.hu * 0.07;
  const ay = spec.hu * 0.05;
  const ao = ctx.createRadialGradient(ax, ay, spec.hu * 0.3, ax, ay, spec.hu * 0.72);
  ao.addColorStop(0, "rgba(0,0,0,.55)");
  ao.addColorStop(0.45, "rgba(0,0,0,.2)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ao;
  ctx.beginPath();
  ctx.arc(ax, ay, spec.hu * 0.72, 0, TAU);
  ctx.fill();
  if (TOP_CACHE.size >= 10) TOP_CACHE.delete(TOP_CACHE.keys().next().value as string);
  TOP_CACHE.set(key, canvas);
  return canvas;
}

/**
 * Bake the top face ahead of the first frame that needs it. Baked faces are kept in a small
 * module-level cache, so a host that warms one up (preloadStampPress) pays nothing at press time.
 */
export function prepareStamper(spec: StamperSpec, paint: StamperPaint): void {
  bakeMountTop(spec, paint);
}

/** Resolve the direction's stamp font to real family names, which is what a canvas needs. */
export function resolveStampFont(directionId: string): string | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.setAttribute("data-direction", directionId);
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;font-family:var(--ff-stamp)";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return family || null;
}

function drawMountTop(
  ctx: CanvasRenderingContext2D,
  spec: StamperSpec,
  paint: StamperPaint,
  y: number,
  ac: number,
  cs: number,
): void {
  if (ac < 0.03) return;
  const cache = paintCache(ctx, paint);
  if (!cache.top) cache.top = bakeMountTop(spec, paint);
  if (cache.top) {
    ctx.save();
    ctx.translate(0, y);
    ctx.scale(1, ac);
    ctx.drawImage(cache.top, -spec.hx, -spec.hy, spec.hx * 2, spec.hy * 2);
    ctx.restore();
  }
  // Sheen across the lacquer, strongest when seen from above.
  const gloss = paint.material.mountTop.gloss;
  if (gloss > 0.3) {
    const sheen = ctx.createLinearGradient(-spec.hx, y - spec.hy * ac, spec.hx * 0.4, y + spec.hy * ac);
    sheen.addColorStop(0, `rgba(255,255,255,${(0.2 * gloss * cs).toFixed(3)})`);
    sheen.addColorStop(0.38, "rgba(255,255,255,0)");
    footprint(ctx, spec, y, ac);
    ctx.fillStyle = sheen;
    ctx.fill();
  }
}

/** The rubber die seen from below: the design in relief, mirrored, wet with ink. */
function drawDieFace(
  ctx: CanvasRenderingContext2D,
  spec: StamperSpec,
  paint: StamperPaint,
  y: number,
  ac: number,
  f: number,
): void {
  const rub = paint.material.rubber;
  footprint(ctx, spec, y, ac, f);
  const lx = -spec.hx * 0.35;
  const ly = y - spec.hy * ac * 0.45;
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, spec.hx * 1.7);
  g.addColorStop(0, rub.light);
  g.addColorStop(0.4, rub.base);
  g.addColorStop(1, rub.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (ac < 0.06) return;

  const wet = mix(paint.ink, "#ffffff", 0.34);
  const k = spec.size / 200;
  ctx.save();
  footprint(ctx, spec, y, ac, f);
  ctx.clip();
  ctx.translate(0, y);
  ctx.scale(-k, k * ac); // mirrored, as a real die is
  ctx.strokeStyle = wet;
  ctx.fillStyle = wet;
  ctx.lineJoin = "round";
  let artSize = 82;
  let artX = 0;
  if (spec.kind === "oval") {
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 96, 76, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 73, 53, 0, 0, TAU);
    ctx.stroke();
    artSize = 66;
  } else if (spec.kind === "rect") {
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-76, -72);
    ctx.arcTo(92, -72, 92, 72, 16);
    ctx.arcTo(92, 72, -92, 72, 16);
    ctx.arcTo(-92, 72, -92, -72, 16);
    ctx.arcTo(-92, -72, 92, -72, 16);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-86, -39);
    ctx.lineTo(86, -39);
    ctx.moveTo(-86, 45);
    ctx.lineTo(86, 45);
    ctx.stroke();
    ctx.fillRect(-56, -62, 112, 12); // the island name, as a bar of type
    artSize = 74;
    artX = -39;
  } else if (spec.kind === "octagon") {
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + Math.PI / 8 + (TAU * i) / 8;
      if (i === 0) ctx.moveTo(97 * Math.cos(a), 97 * Math.sin(a));
      else ctx.lineTo(97 * Math.cos(a), 97 * Math.sin(a));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 61.5, 0, TAU);
    ctx.stroke();
    artSize = 78;
  } else {
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, TAU);
    ctx.stroke();
    // Lettering on the band, as dashes of type.
    ctx.lineWidth = 9;
    ctx.setLineDash([5.5, 3.2]);
    ctx.beginPath();
    ctx.arc(0, 0, 78, Math.PI * 1.14, Math.PI * 1.86);
    ctx.stroke();
    ctx.lineWidth = 5.5;
    ctx.setLineDash([4, 2.6]);
    ctx.beginPath();
    ctx.arc(0, 0, 78, Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (paint.art) {
    try {
      ctx.drawImage(paint.art, artX - artSize / 2, -artSize / 2 - (spec.kind === "rect" ? -3 : 4), artSize, artSize);
    } catch {
      /* An image that failed to decode simply leaves the frame empty. */
    }
  }
  // Wet ink catches the light.
  const gloss = ctx.createLinearGradient(-100, -100, 60, 100);
  gloss.addColorStop(0, "rgba(255,255,255,.26)");
  gloss.addColorStop(0.45, "rgba(255,255,255,.02)");
  gloss.addColorStop(1, "rgba(0,0,0,.2)");
  ctx.fillStyle = gloss;
  ctx.fillRect(-110, -110, 220, 220);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Artwork for the die face                                            */
/* ------------------------------------------------------------------ */

const ART_CACHE = new Map<string, Promise<HTMLCanvasElement | null>>();

/**
 * Load a stamp artwork (transparent PNG mask or SVG line art) and tint it with `color`.
 * Results are cached, so a host can call this ahead of the press (see preloadStampPress) and the
 * die shows its artwork from the very first frame. Resolves to null if anything fails: the die
 * then shows its frame only.
 *
 * `wanted` is asked just before the tinting work, which is the expensive part. Return false to
 * skip it, e.g. when the face of the die has already turned away.
 */
export function loadTintedArt(
  url: string,
  color: string,
  wanted: () => boolean = () => true,
  px = 224,
): Promise<HTMLCanvasElement | null> {
  const key = `${url}|${color}|${px}`;
  const hit = ART_CACHE.get(key);
  if (hit) return hit;
  const job = tintArt(url, color, wanted, px);
  ART_CACHE.set(key, job);
  // A skipped or failed job must not poison the cache.
  void job.then((canvas) => {
    if (!canvas) ART_CACHE.delete(key);
  });
  return job;
}

async function tintArt(url: string, color: string, wanted: () => boolean, px: number): Promise<HTMLCanvasElement | null> {
  if (typeof document === "undefined") return null;
  let src = url;
  let revoke: string | null = null;
  try {
    if (/\.svg(\?|$)/i.test(url)) {
      // SVG files without width and height have no intrinsic size in some engines.
      const text = await (await fetch(url)).text();
      const sized = /<svg[^>]*\swidth=/.test(text) ? text : text.replace(/<svg\b/, `<svg width="${px}" height="${px}"`);
      revoke = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
      src = revoke;
    }
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = "async";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("art failed to load"));
      el.src = src;
    });
    if (!wanted()) return null;
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(img, 0, 0, px, px);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = color;
    c.fillRect(0, 0, px, px);
    return canvas;
  } catch {
    return null;
  } finally {
    if (revoke) URL.revokeObjectURL(revoke);
  }
}
