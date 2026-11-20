/**
 * The stamping moment as one deterministic timeline (UX-3).
 *
 * Everything on screen is a pure function of `t` (seconds since the press started). That keeps
 * the moment skippable (fast-forward `t`), freezable for inspection, and free of React renders.
 *
 *   0.00  enter        the stamper sweeps in from the lower right (where the thumb just tapped),
 *                      tipped back so its inked face shows; over the slot by 0.22
 *   0.16  turn over    it rolls over the page, face down
 *   0.34  backswing    a clear wind-up: it rises to 1.5 stamp sizes and tilts (anticipation)
 *   0.50  slam         accelerates into the paper
 *   0.62  IMPACT       squash, page nudge, vibration, thunk, shock ring, ink flecks fly out
 *   0.64  hold + rock  weight stays on the paper, rocking once (140 ms)
 *   0.76  lift         the rubber sticks for a beat, then peels away
 *   0.78  reveal       ink spreads from the contact point, blotchy first, then fills in
 *   0.96  settle       wet halo dries (micro-bleed), a glint crosses the wet ink
 *   1.02  hand-over    the page's own stamp rises under the overlay, which then thins away
 *   1.28  done
 */

export const PRESS = {
  duration: 1.28,
  impact: 0.62,
  liftStart: 0.76,
  /** Pitch (degrees) at which the stamper sits on the page. 0 would be seen from straight above. */
  contactPitch: 22,
  /** Where the rubber touches first, as fractions of the stamp box. Ink spreads from here. */
  contact: { x: 0.44, y: 0.6 },
} as const;

/* ------------------------------------------------------------------ */
/* Easing and keyframes                                                */
/* ------------------------------------------------------------------ */

export type Ease = (p: number) => number;

export const linear: Ease = (p) => p;
export const easeOutQuad: Ease = (p) => 1 - (1 - p) * (1 - p);
export const easeOutCubic: Ease = (p) => 1 - Math.pow(1 - p, 3);
export const easeOutQuint: Ease = (p) => 1 - Math.pow(1 - p, 5);
export const easeInQuad: Ease = (p) => p * p;
export const easeInCubic: Ease = (p) => p * p * p;
export const easeInQuart: Ease = (p) => p * p * p * p;
export const easeInOutCubic: Ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeInOutSine: Ease = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
export const easeOutBack: Ease = (p) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

/** [time, value, easing of the segment that ENDS at this key] */
export type Key = readonly [number, number, Ease?];

export function track(t: number, keys: readonly Key[]): number {
  const first = keys[0];
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t <= k[0]) {
      const prev = keys[i - 1];
      const span = k[0] - prev[0];
      const p = span <= 0 ? 1 : (t - prev[0]) / span;
      return prev[1] + (k[1] - prev[1]) * (k[2] ?? linear)(p);
    }
  }
  return keys[keys.length - 1][1];
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ------------------------------------------------------------------ */
/* Stamper (the tool)                                                  */
/* ------------------------------------------------------------------ */

const I = PRESS.impact;
const L = PRESS.liftStart;
const CP = PRESS.contactPitch;
/** The tool is clear of the page and gone. */
const OUT = L + 0.32;
/** Top of the backswing: the slam starts here. */
const TOP = 0.5;

/** Height above the page, in multiples of the stamp size. */
const HEIGHT: Key[] = [
  [0, 1.12],
  [0.22, 1.04, easeOutCubic],
  [0.34, 0.98, easeInOutSine], // sinks a touch as the hand gathers...
  [TOP, 1.5, easeOutQuad], // ...then the backswing
  [I, 0, easeInCubic],
  [L, 0],
  [L + 0.045, 0.012, easeInQuad], // the rubber sticks to the wet ink for a beat
  [OUT, 1.3, easeOutCubic],
];

/** 0 = seen from straight above, 90 = side view, above 90 = the inked face is toward the viewer. */
const PITCH: Key[] = [
  [0, 126],
  [0.16, 121, easeOutQuad],
  [0.42, 15, easeInOutCubic],
  [TOP + 0.02, 28, easeInOutSine], // tips back at the top of the swing
  [I, CP, easeInCubic],
  [L, CP],
  [OUT, 38, easeOutCubic],
];

/** In-plane tilt, degrees. */
const ROLL: Key[] = [
  [0, 16],
  [0.22, -6, easeOutCubic],
  [TOP, 14, easeInOutCubic],
  [I, -1.6, easeInCubic],
  [I + 0.05, 2.1, easeOutCubic], // rock one way...
  [I + 0.1, -0.8, easeInOutSine], // ...and back, pressing the ink in
  [L, 0, easeInOutSine],
  [OUT, -12, easeOutCubic],
];

/** Sideways drift, in multiples of the stamp size. */
const DRIFT: Key[] = [
  [0, 0.55],
  [0.22, -0.03, easeOutCubic],
  [TOP, 0.03, easeInOutSine],
  [I, 0, easeInCubic],
  [L, 0],
  [OUT, 0.2, easeOutCubic],
];

/**
 * Vertical offset of the whole tool (and its shadow), in multiples of the stamp size, positive
 * down the screen. With DRIFT it makes the entrance a path from the lower right, where the thumb
 * just tapped, instead of a fade in place.
 */
const DROP: Key[] = [
  [0, 0.6],
  [0.22, 0, easeOutCubic],
];

const ALPHA: Key[] = [
  [0, 0],
  [0.08, 1, easeOutQuad],
  [L + 0.15, 1],
  [L + 0.29, 0, easeInQuad],
];

const SQUASH: Key[] = [
  [I, 0],
  [I + 0.028, 1, easeOutQuad],
  [I + 0.11, 0.42, easeOutCubic],
  [L, 0.36],
  [L + 0.05, 0, easeOutQuad],
];

const ENTER_SCALE: Key[] = [
  [0, 0.9],
  [0.22, 1, easeOutBack],
];

export interface StamperFrame {
  /** Height above the page in multiples of the stamp size. */
  height: number;
  pitch: number;
  roll: number;
  drift: number;
  /** Vertical offset in multiples of the stamp size, positive down the screen (entrance only). */
  drop: number;
  alpha: number;
  squash: number;
  scale: number;
  /** 0..1 progress of the shock ring after impact (0 before, 1 = gone). */
  ring: number;
}

export function stamperFrame(t: number): StamperFrame {
  return {
    height: track(t, HEIGHT),
    pitch: track(t, PITCH),
    roll: track(t, ROLL),
    drift: track(t, DRIFT),
    drop: track(t, DROP),
    alpha: track(t, ALPHA),
    squash: track(t, SQUASH),
    scale: track(t, ENTER_SCALE),
    ring: t < I ? 0 : clamp01((t - I) / 0.34),
  };
}

/* ------------------------------------------------------------------ */
/* Impression (the ink left on the page)                               */
/* ------------------------------------------------------------------ */

/**
 * Drives <Stamp inkProgress>. The ink starts to take while the rubber is still down (hidden), is
 * blotchy as the tool peels away, stalls while the paper drinks, then fills in.
 */
const INK: Key[] = [
  [I + 0.04, 0],
  [L, 0.5, easeOutCubic],
  [L + 0.1, 0.72, easeOutQuad],
  [L + 0.17, 0.78, linear],
  [L + 0.34, 1, easeInOutSine],
];

/**
 * Radius of the spread from the contact point, in multiples of the stamp size. It stays inside
 * the footprint of the rubber until the lift, then runs out to the far edge.
 */
const SPREAD_END = L + 0.32;
const SPREAD: Key[] = [
  [I + 0.04, 0.06],
  [L, 0.3, easeOutCubic],
  [L + 0.12, 0.74, easeOutCubic],
  [SPREAD_END, 1.32, easeInOutSine],
];

/** Wet halo: a soft copy of the stamp under the ink that dries away (micro-bleed). */
const BLEED: Key[] = [
  [L + 0.03, 0],
  [L + 0.15, 0.46, easeOutQuad],
  [L + 0.24, 0.4, linear],
  [PRESS.duration, 0, easeOutCubic],
];

/** The wet impression sits a hair large and relaxes as it dries. */
const IMPRESSION_SCALE: Key[] = [
  [L, 1.022],
  [L + 0.48, 1, easeOutQuint],
];

const GLINT_POS: Key[] = [
  [L + 0.14, 0],
  [L + 0.5, 1, easeInOutSine],
];

const GLINT_ALPHA: Key[] = [
  [L + 0.14, 0],
  [L + 0.22, 1, easeOutQuad],
  [L + 0.4, 1],
  [L + 0.5, 0, easeInQuad],
];

/** Ink flecks thrown out by the impact. 0 = still under the rubber, 1 = landed. */
const SPECKLE: Key[] = [
  [I, 0],
  [I + 0.17, 1, easeOutCubic],
];

/**
 * Hand-over to the page's own stamp. The overlay's impression and the page's stamp are the same
 * drawing, but an SVG ink filter never rasterises twice to the same pixel, so a hard swap would
 * shimmer. Instead the page's stamp comes up underneath, then the overlay thins away.
 */
const HAND_IN: Key[] = [
  [L + 0.26, 0],
  [L + 0.38, 1, linear],
];

const HAND_OUT: Key[] = [
  [L + 0.38, 1],
  [PRESS.duration, 0, linear],
];

export interface ImpressionFrame {
  ink: number;
  /** Spread radius in multiples of the stamp size, or null once the mask is no longer needed. */
  spread: number | null;
  bleed: number;
  scale: number;
  glintPos: number;
  glintAlpha: number;
  speckle: number;
  /** 0..1 opacity of the page's own stamp, rising beneath the overlay. */
  handIn: number;
  /** 1..0 opacity of the overlay once the page's stamp is fully up. */
  handOut: number;
}

export function impressionFrame(t: number): ImpressionFrame {
  return {
    ink: track(t, INK),
    spread: t >= SPREAD_END ? null : track(t, SPREAD),
    bleed: track(t, BLEED),
    scale: track(t, IMPRESSION_SCALE),
    glintPos: track(t, GLINT_POS),
    glintAlpha: track(t, GLINT_ALPHA),
    speckle: track(t, SPECKLE),
    handIn: track(t, HAND_IN),
    handOut: track(t, HAND_OUT),
  };
}

/** Reduced motion: the impression simply fades in. Seconds. */
export const REDUCED_FADE = 0.5;
