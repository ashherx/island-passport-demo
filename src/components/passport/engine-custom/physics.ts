/**
 * Geometry, projection and lighting for the custom passport engine.
 * Pure functions, no DOM. Angles are in degrees unless a name ends in "Rad".
 *
 * Coordinate frame (design pixels): the spine is the Y axis at x = 0. A leaf lying on the right
 * stack has angle 0, standing upright towards the viewer 90, lying on the left stack 180.
 * +z points at the viewer, like CSS.
 */

export const RAD = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const smoothstep = (lo: number, hi: number, v: number) => {
  const x = clamp((v - lo) / (hi - lo), 0, 1);
  return x * x * (3 - 2 * x);
};

export const easeInOutSine = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;

/* ------------------------------------------------------------------ */
/* Leaf geometry: a page as a chain of hinged strips                   */
/* ------------------------------------------------------------------ */

export interface LeafGeometry {
  /** Page width in design px. */
  width: number;
  /** Strip count. */
  n: number;
  /** Strip boundaries along the page, n + 1 integers from 0 to width. */
  xs: number[];
  /** Zero-mean curl profile per strip: the free edge bends more than the bound edge. */
  phi: number[];
  /** Largest |phi|. */
  phiSpan: number;
}

export function makeLeafGeometry(width: number, n: number, gamma = 1.55): LeafGeometry {
  const xs: number[] = [];
  for (let i = 0; i <= n; i++) xs.push(Math.round((i * width) / n));
  const raw: number[] = [];
  let mean = 0;
  for (let i = 0; i < n; i++) {
    const u = (xs[i] + xs[i + 1]) / 2 / width;
    raw.push(Math.pow(u, gamma));
    mean += raw[i] / n;
  }
  const phi = raw.map((v) => v - mean);
  const phiSpan = Math.max(...phi.map(Math.abs));
  return { width, n, xs, phi, phiSpan };
}

/** Working buffers for one leaf, so the frame loop allocates nothing. */
export interface LeafPose {
  /** Absolute angle of each strip. */
  angles: Float32Array;
  /** Hinge positions: X[i], Z[i] is where strip i starts. Length n + 1 (last = free edge). */
  X: Float32Array;
  Z: Float32Array;
}

export function makePose(n: number): LeafPose {
  return { angles: new Float32Array(n), X: new Float32Array(n + 1), Z: new Float32Array(n + 1) };
}

/**
 * Pose a flexible leaf. `q` is the mean angle of the leaf and `bend` the curl in degrees:
 * positive when the free edge leads (a finger pulling it), negative when it trails (air drag).
 * Each strip is clamped to the two stacks, which is what makes the page peel up from its edge
 * and roll down flat on landing.
 */
export function poseLeaf(g: LeafGeometry, q: number, bend: number, out: LeafPose): LeafPose {
  const { n, xs, phi } = g;
  let x = 0;
  let z = 0;
  out.X[0] = 0;
  out.Z[0] = 0;
  for (let i = 0; i < n; i++) {
    const a = clamp(q + bend * phi[i], 0, 180);
    out.angles[i] = a;
    const w = xs[i + 1] - xs[i];
    x += w * Math.cos(a * RAD);
    z += w * Math.sin(a * RAD);
    out.X[i + 1] = x;
    out.Z[i + 1] = z;
  }
  return out;
}

/** Where the point at arc length `s` from the spine sits, as [x, z]. */
export function pointOnLeaf(g: LeafGeometry, pose: LeafPose, s: number, out: [number, number]): [number, number] {
  const { n, xs } = g;
  let i = 0;
  while (i < n - 1 && xs[i + 1] < s) i++;
  const d = s - xs[i];
  const a = pose.angles[i] * RAD;
  out[0] = pose.X[i] + d * Math.cos(a);
  out[1] = pose.Z[i] + d * Math.sin(a);
  return out;
}

/** Screen x of a point under CSS perspective `p` with the vanishing point at `ox`. */
export const projectX = (x: number, z: number, ox: number, p: number) => ox + ((x - ox) * p) / (p - z);

const scratchPose = new Map<number, LeafPose>();
const scratchPoint: [number, number] = [0, 0];

/**
 * Find the leaf angle that puts the grabbed point (arc length `s`) under the finger at screen
 * x = `fx`. Bisection: the projected x falls as q rises (bar a sub-pixel wobble near q = 0).
 */
export function solveLeaf(
  g: LeafGeometry,
  s: number,
  bend: number,
  fx: number,
  ox: number,
  p: number,
  qLo: number,
  qHi: number,
): number {
  let pose = scratchPose.get(g.n);
  if (!pose) scratchPose.set(g.n, (pose = makePose(g.n)));
  const at = (q: number) => {
    poseLeaf(g, q, bend, pose!);
    pointOnLeaf(g, pose!, s, scratchPoint);
    return projectX(scratchPoint[0], scratchPoint[1], ox, p);
  };
  if (at(qLo) <= fx) return qLo;
  if (at(qHi) >= fx) return qHi;
  let lo = qLo;
  let hi = qHi;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > fx) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The same for a rigid board (cover) of which the point at distance `s` is held. */
export function solveRigid(s: number, fx: number, ox: number, p: number): number {
  const at = (q: number) => projectX(s * Math.cos(q * RAD), s * Math.sin(q * RAD), ox, p);
  if (at(0) <= fx) return 0;
  if (at(180) >= fx) return 180;
  let lo = 0;
  let hi = 180;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > fx) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

// Key light from the upper left in front of the book, weaker fill from the right.
const KEY_X = -0.447;
const KEY_Z = 0.894;
const FILL_X = 0.447;
const FILL_Z = 0.894;
const KEY = 0.76;
const FILL = 0.24;
const REST = KEY * KEY_Z + FILL * FILL_Z;
// Half vectors between each light and the viewer (0, 0, 1).
const HK_X = -0.2298;
const HK_Z = 0.9732;
const HF_X = 0.2298;
const HF_Z = 0.9732;
const SPEC_POWER = 26;
const SPEC_REST = Math.pow(HK_Z, SPEC_POWER);

export interface Tone {
  /** 0..1 how much darker than a page lying flat. */
  dark: number;
  /** 0..1 specular gleam above a page lying flat. */
  gloss: number;
}

/** Shade and gleam of a surface whose normal is (nx, nz). A flat page facing the viewer is (0, 1). */
export function tone(nx: number, nz: number, out: Tone): Tone {
  const key = Math.max(0, nx * KEY_X + nz * KEY_Z);
  const fill = Math.max(0, nx * FILL_X + nz * FILL_Z);
  out.dark = clamp(1 - (KEY * key + FILL * fill) / REST, 0, 1);
  const sk = Math.pow(Math.max(0, nx * HK_X + nz * HK_Z), SPEC_POWER);
  const sf = Math.pow(Math.max(0, nx * HF_X + nz * HF_Z), SPEC_POWER);
  out.gloss = clamp((Math.max(0, sk - SPEC_REST) + 0.55 * Math.max(0, sf - SPEC_REST)) / (1 - SPEC_REST), 0, 1);
  return out;
}

/** Tone of the front (recto) face of a surface at leaf angle `a`. */
export const toneFront = (a: number, out: Tone) => tone(-Math.sin(a * RAD), Math.cos(a * RAD), out);
/** Tone of the back (verso) face of a surface at leaf angle `a`. */
export const toneBack = (a: number, out: Tone) => tone(Math.sin(a * RAD), -Math.cos(a * RAD), out);
