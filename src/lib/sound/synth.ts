/**
 * Island Passport sound design: every sound is synthesized with Web Audio, nothing is downloaded.
 *
 * This file is pure synthesis. A voice schedules nodes on whatever BaseAudioContext it is handed
 * (the live AudioContext in engine.ts, or an OfflineAudioContext in scripts/scratch/sound-render.mjs)
 * and returns how long it lasts in seconds. It keeps no state and imports nothing, so it can be
 * rendered and measured outside the app.
 *
 * Musical key: E major throughout (verified chime, award pad, sparkles, toast), so moments that
 * follow each other sound like one instrument.
 *
 * Phone speakers reproduce almost nothing under ~300 Hz. Every "weighty" sound therefore carries
 * its weight twice: a real low body for laptops and headphones, and a 200 to 600 Hz knock that a
 * phone can play.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Rng = () => number;

/** Where and when a voice plays. */
export interface VoiceContext {
  ctx: BaseAudioContext;
  /** Node the voice connects to (a per-sound gain owned by the caller). */
  out: AudioNode;
  /** Start time on ctx's clock. */
  t: number;
  /** Source of the small random variations. Seeded when rendering offline. */
  rng: Rng;
}

export interface PageFlipOptions {
  /**
   * Seconds the page takes to turn (the flip animation's duration). The swish is stretched to
   * fit and the paper "flap" lands just before the end. Default 0.5, clamped to 0.14..0.95.
   */
  duration?: number;
  /** 0..1: how hard the page is thrown. Louder, brighter. Default 0.6. See intensityFromVelocity(). */
  intensity?: number;
  /** One page of a riffle, or a page falling back: thinner and quieter, no body. */
  light?: boolean;
}

export interface PageRiffleOptions {
  /** How many pages flick past. Default 5, clamped to 2..12. */
  count?: number;
  /** Seconds for the whole riffle. Default 1. */
  duration?: number;
}

export interface CoverOptions {
  /** Seconds from the start of the swing until the board lands. Default 0.96 (open), 0.88 (close). */
  duration?: number;
  /** Schedule the landing thud at `duration`. Pass false and call coverThud() yourself when the swing can be interrupted. Default true. */
  thud?: boolean;
  /** 0..1: how much of the leather creak to play. Default 1. */
  creak?: number;
}

export interface CoverThudOptions {
  /** "open": board on the table. "close": board on the page block (softer, more air). Default "open". */
  kind?: "open" | "close";
}

export interface StampPressOptions {
  /** 0..1: weight of the hit. Default 1. */
  intensity?: number;
  /** Seconds after the hit at which the rubber peels off the paper (a tiny sticky tick). false: none. Default 0.2. */
  lift?: number | false;
}

export interface VerifiedOptions {
  /** Notes in the chime. Default 3. */
  notes?: 2 | 3;
  /** Leave out the embossing press and play the chime alone. Default false. */
  chimeOnly?: boolean;
}

export interface ProvincialRevealOptions {
  /** Seconds from the start at which the swell blooms (the confetti burst). Default 0.46. */
  bloomAt?: number;
  /** Seconds over which the pad swells and holds before it lets go. Default 1.5. */
  duration?: number;
}

export interface ProvincialLandOptions {
  /** Seconds of flight before the stamp reaches the page. Default 0.64. */
  flight?: number;
  /** Seconds of the press that follows the flight. The thud lands at flight + press. Default 0.13. */
  press?: number;
}

export type EmptyOptions = Record<string, never>;

/* ------------------------------------------------------------------ */
/* Small maths                                                         */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Deterministic random numbers for offline renders and tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Map a pointer speed in px/ms at release (0.2 is the engine's flick threshold) to a flip intensity. */
export function intensityFromVelocity(pxPerMs: number): number {
  return clamp(0.35 + Math.abs(pxPerMs) * 0.45, 0.35, 1);
}

/** Random value in [1 - spread, 1 + spread]. */
const vary = (rng: Rng, spread: number) => 1 + (rng() * 2 - 1) * spread;

/* Notes (Hz), E major. */
const N = {
  E4: 329.63,
  B4: 493.88,
  E5: 659.26,
  Fs5: 739.99,
  Gs5: 830.61,
  B5: 987.77,
  Cs6: 1108.73,
  E6: 1318.51,
  Fs6: 1479.98,
  Gs6: 1661.22,
  B6: 1975.53,
  Cs7: 2217.46,
  E7: 2637.02,
} as const;

/* ------------------------------------------------------------------ */
/* Noise                                                               */
/* ------------------------------------------------------------------ */

type NoiseKind = "white" | "crackle";
const NOISE_SECONDS = 3;
const noiseCache = new WeakMap<BaseAudioContext, Record<NoiseKind, AudioBuffer>>();

/**
 * Two noise beds per context.
 *  - white:   plain noise for air, thuds and whooshes.
 *  - crackle: noise whose loudness jumps in thousands of tiny grains a second. Paper, leather and
 *             wet ink are all granular; smooth noise sounds like wind or a hiss instead.
 */
function noiseBuffers(ctx: BaseAudioContext): Record<NoiseKind, AudioBuffer> {
  const hit = noiseCache.get(ctx);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * NOISE_SECONDS);
  const rand = mulberry32(90210);

  const white = ctx.createBuffer(1, length, sr);
  const w = white.getChannelData(0);
  for (let i = 0; i < length; i++) w[i] = rand() * 2 - 1;

  const crackle = ctx.createBuffer(1, length, sr);
  const c = crackle.getChannelData(0);
  const perSample = 1400 / sr; // grains per second
  const decay = Math.exp(-1 / (0.0011 * sr)); // each grain dies in about a millisecond
  let e = 0;
  let sum = 0;
  for (let i = 0; i < length; i++) {
    if (rand() < perSample) {
      const a = rand();
      e = Math.max(e, 0.25 + 0.75 * a * a);
    }
    e *= decay;
    const s = (rand() * 2 - 1) * (0.1 + e);
    c[i] = s;
    sum += s * s;
  }
  // Same RMS as the white bed, so the two are interchangeable in level.
  const k = Math.sqrt(1 / 3) / Math.sqrt(sum / length);
  for (let i = 0; i < length; i++) c[i] = clamp(c[i] * k, -1, 1);

  const made = { white, crackle };
  noiseCache.set(ctx, made);
  return made;
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

type Point = [dt: number, value: number, kind?: "l" | "e"];

/** Automate a param through points relative to t. "e" ramps exponentially (values floor at 0.0001). */
function env(param: AudioParam, t: number, points: Point[]): void {
  points.forEach(([dt, value, kind], i) => {
    const at = t + Math.max(0, dt);
    if (i === 0) param.setValueAtTime(kind === "e" ? Math.max(value, 1e-4) : value, at);
    else if (kind === "e") param.exponentialRampToValueAtTime(Math.max(value, 1e-4), at);
    else param.linearRampToValueAtTime(value, at);
  });
}

/** Drive a param along shape(x), x in 0..1, over dur seconds. The param must have no other automation there. */
function curve(param: AudioParam, t: number, dur: number, shape: (x: number) => number, scale = 1, steps = 48): void {
  const values = new Float32Array(steps);
  for (let i = 0; i < steps; i++) values[i] = shape(i / (steps - 1)) * scale;
  values[steps - 1] = 0;
  param.setValueAtTime(0, Math.max(0, t - 0.001));
  param.setValueCurveAtTime(values, t, Math.max(0.01, dur));
}

type FilterSpec = [type: BiquadFilterType, frequency: number, q?: number];

function chain(v: VoiceContext, source: AudioNode, filters: FilterSpec[]): { last: AudioNode; nodes: BiquadFilterNode[] } {
  let last = source;
  const nodes: BiquadFilterNode[] = [];
  for (const [type, frequency, q] of filters) {
    const f = v.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q ?? 0.707;
    last.connect(f);
    last = f;
    nodes.push(f);
  }
  return { last, nodes };
}

function noiseSource(v: VoiceContext, kind: NoiseKind, t: number, dur: number, rate = 1): AudioBufferSourceNode {
  const src = v.ctx.createBufferSource();
  src.buffer = noiseBuffers(v.ctx)[kind];
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(t, v.rng() * (NOISE_SECONDS - 0.2));
  src.stop(t + dur + 0.03);
  return src;
}

interface BurstSpec {
  noise?: NoiseKind;
  filters: FilterSpec[];
  peak: number;
  attack?: number;
  decay: number;
  rate?: number;
  dest?: AudioNode;
}

/** A percussive puff of filtered noise. */
function burst(v: VoiceContext, t: number, s: BurstSpec): BiquadFilterNode[] {
  const attack = s.attack ?? 0.002;
  const src = noiseSource(v, s.noise ?? "white", t, attack + s.decay, s.rate);
  const { last, nodes } = chain(v, src, s.filters);
  const g = v.ctx.createGain();
  env(g.gain, t, [[0, 0], [attack, s.peak], [attack + s.decay, 0, "e"]]);
  last.connect(g).connect(s.dest ?? v.out);
  return nodes;
}

interface ToneSpec {
  type?: OscillatorType;
  f0: number;
  /** Glide target and time. */
  f1?: number;
  glide?: number;
  peak: number;
  attack?: number;
  decay: number;
  detune?: number;
  dest?: AudioNode;
}

/** A percussive pitched tone, optionally gliding. */
function tone(v: VoiceContext, t: number, s: ToneSpec): void {
  const attack = s.attack ?? 0.002;
  const osc = v.ctx.createOscillator();
  osc.type = s.type ?? "sine";
  osc.frequency.setValueAtTime(s.f0, t);
  if (s.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(s.f1, t + (s.glide ?? s.decay));
  if (s.detune) osc.detune.value = s.detune;
  const g = v.ctx.createGain();
  env(g.gain, t, [[0, 0], [attack, s.peak], [attack + s.decay, 0, "e"]]);
  osc.connect(g).connect(s.dest ?? v.out);
  osc.start(t);
  osc.stop(t + attack + s.decay + 0.02);
}

interface SwellSpec {
  noise?: NoiseKind;
  filters: FilterSpec[];
  /** Index of the filter whose frequency is swept, and the sweep as [x 0..1, Hz] points. */
  sweep?: { index: number; points: [number, number][] };
  shape: (x: number) => number;
  peak: number;
  rate?: number;
  dest?: AudioNode;
}

/** Filtered noise whose loudness follows a shape: swishes, whooshes, creaks. */
function swell(v: VoiceContext, t: number, dur: number, s: SwellSpec): void {
  const src = noiseSource(v, s.noise ?? "white", t, dur, s.rate);
  const { last, nodes } = chain(v, src, s.filters);
  if (s.sweep) {
    const f = nodes[s.sweep.index];
    env(f.frequency, t, s.sweep.points.map(([x, hz]) => [x * dur, hz, "e"] as Point));
  }
  const g = v.ctx.createGain();
  g.gain.value = 0;
  curve(g.gain, t, dur, s.shape, s.peak);
  last.connect(g).connect(s.dest ?? v.out);
}

/** Left/right placement where the browser supports it. Returns the node to connect into. */
function panned(v: VoiceContext, pan: number): AudioNode {
  const ctx = v.ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
  if (typeof ctx.createStereoPanner !== "function" || pan === 0) return v.out;
  const p = ctx.createStereoPanner();
  p.pan.value = clamp(pan, -1, 1);
  p.connect(v.out);
  return p;
}

const shaperCurves = new Map<number, Float32Array<ArrayBuffer>>();

/**
 * Soft saturation for low thuds. Bending a 60 to 150 Hz tone adds quiet harmonics at three and
 * five times its pitch, which is where a phone speaker can actually play it; it also rounds the
 * peak off, so a heavy hit needs less headroom. Returns the node to connect into.
 */
function saturate(v: VoiceContext, drive: number, dest?: AudioNode): AudioNode {
  let c = shaperCurves.get(drive);
  if (!c) {
    c = new Float32Array(new ArrayBuffer(1025 * 4));
    const norm = Math.tanh(drive);
    for (let i = 0; i < c.length; i++) c[i] = Math.tanh(drive * ((i / (c.length - 1)) * 2 - 1)) / norm;
    shaperCurves.set(drive, c);
  }
  const ws = v.ctx.createWaveShaper();
  ws.curve = c;
  ws.oversample = "2x";
  ws.connect(dest ?? v.out);
  return ws;
}

/**
 * A soft struck bar: a detuned pair of sines for a slow shimmer, a quiet octave, and a fourth
 * harmonic that dies at once (the mallet). Warm like a marimba, ringing like glass.
 */
function bell(v: VoiceContext, t: number, f: number, peak: number, decay: number, pan = 0, bright = 1): void {
  const dest = panned(v, pan);
  tone(v, t, { f0: f * 0.9991, peak: peak * 0.5, attack: 0.004, decay, dest });
  tone(v, t, { f0: f * 1.0009, peak: peak * 0.5, attack: 0.004, decay: decay * 0.92, dest });
  tone(v, t, { f0: f * 2, peak: peak * 0.16 * bright, attack: 0.003, decay: decay * 0.45, dest });
  tone(v, t, { f0: f * 4.02, peak: peak * 0.09 * bright, attack: 0.002, decay: Math.min(0.09, decay * 0.18), dest });
}

/** A tiny high ping: one sparkle. */
function ping(v: VoiceContext, t: number, f: number, peak: number, decay: number, pan: number): void {
  const dest = panned(v, pan);
  tone(v, t, { f0: f, peak, attack: 0.003, decay, dest });
  tone(v, t, { f0: f * 2.005, peak: peak * 0.14, attack: 0.002, decay: decay * 0.4, dest });
}

/** Hump that rises, peaks at `at` (0..1) and falls: sin-shaped on both sides. */
const hump = (at: number, sharp = 1) => (x: number) => {
  const y = x < at ? Math.sin((x / at) * (Math.PI / 2)) : Math.cos(((x - at) / (1 - at)) * (Math.PI / 2));
  return Math.pow(Math.max(0, y), sharp);
};

/* ------------------------------------------------------------------ */
/* Paper                                                               */
/* ------------------------------------------------------------------ */

/**
 * One page turning. Four parts, as in a real book:
 *   lift   the fingertip catches the edge: a short dry scrape
 *   swish  the sheet bends through the air: grainy band of noise that brightens, then relaxes
 *   air    the push of air under the sheet (heard on real speakers, not on phones)
 *   flap   the sheet lands on the stack: a soft pat, a tick and a smaller settle
 */
export function pageFlip(v: VoiceContext, o: PageFlipOptions = {}): number {
  const light = !!o.light;
  const D = clamp(o.duration ?? 0.5, 0.14, 0.95);
  const i = clamp(o.intensity ?? 0.6, 0, 1);
  const pitch = vary(v.rng, 0.09) * (0.86 + 0.3 * i);
  const level = (0.55 + 0.5 * i) * vary(v.rng, 0.12) * (light ? 0.6 : 1);
  // A slow page moves less air and rustles less than a quick one.
  const speed = Math.pow(clamp(0.5 / D, 0.45, 1.25), 0.7);
  // The sheet is down a little before the animation finishes easing out.
  const land = D * (0.84 + (v.rng() - 0.5) * 0.04);
  const t = v.t;

  const bus = v.ctx.createGain();
  bus.gain.value = level;
  bus.connect(v.out);
  const b: VoiceContext = { ...v, out: bus };

  if (!light) {
    // Lift: fingertip on the page edge.
    burst(b, t, {
      noise: "crackle",
      filters: [["bandpass", 2600 * pitch, 1], ["highpass", 900]],
      peak: 0.3,
      attack: 0.012,
      decay: 0.11,
      rate: vary(v.rng, 0.1),
    });
  }

  // Swish: quiet while the sheet hangs in the air, brightest just before it comes down.
  const s0 = D * 0.06;
  const sDur = land - s0 + 0.035;
  swell(b, t + s0, sDur, {
    noise: "crackle",
    rate: pitch,
    filters: [["highpass", 500], ["bandpass", 1150 * pitch, 0.7], ["lowpass", 5600, 0.5]],
    sweep: { index: 1, points: [[0, 1150 * pitch], [0.68, 2500 * pitch], [1, 1500 * pitch]] },
    shape: hump(0.68 + (v.rng() - 0.5) * 0.08, light ? 2.4 : 2),
    peak: (light ? 0.5 : 0.42) * speed,
  });

  if (!light) {
    // Air under the sheet.
    swell(b, t + s0, sDur, {
      filters: [["lowpass", 620, 0.5], ["highpass", 140]],
      shape: hump(0.6, 1.6),
      peak: 0.5 * speed,
    });
  }

  // Flap: the sheet meets the stack.
  const f = t + land;
  burst(b, f, { filters: [["bandpass", 900 * pitch, 1], ["lowpass", 3200]], peak: light ? 0.7 : 1.5, attack: 0.003, decay: 0.09 });
  burst(b, f, { noise: "crackle", filters: [["highpass", 2800], ["lowpass", 7000]], peak: light ? 0.16 : 0.26, attack: 0.001, decay: 0.03 });
  if (!light) {
    tone(b, f, { f0: 150 * pitch, f1: 84, glide: 0.05, peak: 0.3, attack: 0.003, decay: 0.12 });
    tone(b, f, { type: "triangle", f0: 340 * pitch, f1: 215, glide: 0.035, peak: 0.2, attack: 0.002, decay: 0.07 });
    // The sheet settles: a second, smaller pat.
    burst(b, f + 0.055 + v.rng() * 0.03, { filters: [["bandpass", 760 * pitch, 1], ["lowpass", 2600]], peak: 0.36, attack: 0.005, decay: 0.08 });
  }
  return land + 0.2;
}

/** Several pages flicking past, then the last one landing properly. */
export function pageRiffle(v: VoiceContext, o: PageRiffleOptions = {}): number {
  const count = Math.round(clamp(o.count ?? 5, 2, 12));
  const total = clamp(o.duration ?? 1, 0.3, 2);
  const step = total / count;
  let end = 0;
  for (let k = 0; k < count; k++) {
    const last = k === count - 1;
    const at = k * step + (last ? 0 : (v.rng() - 0.5) * step * 0.18);
    const len = pageFlip(
      { ...v, t: v.t + Math.max(0, at) },
      { duration: step * (last ? 1.25 : 1.45), light: !last, intensity: last ? 0.55 : 0.4 + 0.25 * (k / count) },
    );
    end = Math.max(end, at + len);
  }
  return end;
}

/* ------------------------------------------------------------------ */
/* Cover                                                               */
/* ------------------------------------------------------------------ */

/**
 * Leather flexing at the spine. A slow sawtooth is the stick-slip of the hinge; two soft
 * resonances make it card and leather instead of a door; grainy noise is the surface.
 * Kept very quiet: a creak that draws attention to itself is a haunted house.
 */
function creak(v: VoiceContext, t: number, dur: number, amount: number, rising: boolean): void {
  if (amount <= 0) return;
  const osc = v.ctx.createOscillator();
  osc.type = "sawtooth";
  const a = 34 * vary(v.rng, 0.12);
  const b = 62 * vary(v.rng, 0.12);
  env(osc.frequency, t, rising ? [[0, a], [dur * 0.55, b, "e"], [dur, b * 0.8, "e"]] : [[0, b], [dur, a, "e"]]);
  // Jitter: the hinge never slips evenly.
  const wobble = noiseSource(v, "white", t, dur, 0.02);
  const depth = v.ctx.createGain();
  depth.gain.value = 9;
  wobble.connect(depth).connect(osc.frequency);

  const g = v.ctx.createGain();
  g.gain.value = 0;
  curve(g.gain, t, dur, hump(0.35, 1.4), 0.3 * amount);
  for (const [f, q, lvl] of [[540, 2.4, 1], [1180, 3, 0.55]] as const) {
    const bp = v.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f * vary(v.rng, 0.08);
    bp.Q.value = q;
    const lg = v.ctx.createGain();
    lg.gain.value = lvl;
    osc.connect(bp).connect(lg).connect(g);
  }
  g.connect(v.out);
  osc.start(t);
  osc.stop(t + dur + 0.03);

  swell(v, t, dur, {
    noise: "crackle",
    rate: 0.7,
    filters: [["bandpass", 1700, 0.9]],
    shape: hump(0.4, 1.2),
    peak: 0.08 * amount,
  });
}

/** The board landing. */
export function coverThud(v: VoiceContext, o: CoverThudOptions = {}): number {
  const t = v.t;
  const p = vary(v.rng, 0.05);
  if (o.kind === "close") {
    // Board on a block of pages: the air between them is squeezed out. No knock.
    const low = saturate(v, 1.8);
    tone(v, t, { f0: 118 * p, f1: 62, glide: 0.09, peak: 0.13, attack: 0.004, decay: 0.3, dest: low });
    tone(v, t, { f0: 236 * p, f1: 130, glide: 0.07, peak: 0.17, attack: 0.003, decay: 0.17, dest: low });
    tone(v, t, { type: "triangle", f0: 430 * p, f1: 270, glide: 0.05, peak: 0.2, attack: 0.003, decay: 0.1 });
    burst(v, t, { filters: [["bandpass", 520, 0.7], ["lowpass", 1500, 0.6]], peak: 1.7, attack: 0.008, decay: 0.16 });
    burst(v, t, { noise: "crackle", filters: [["bandpass", 2300, 0.8]], peak: 0.1, attack: 0.004, decay: 0.07 });
    return 0.34;
  }
  // Board on the table: a damped knock.
  const low = saturate(v, 1.8);
  tone(v, t, { f0: 132 * p, f1: 68, glide: 0.07, peak: 0.13, attack: 0.003, decay: 0.26, dest: low });
  tone(v, t, { f0: 290 * p, f1: 170, glide: 0.05, peak: 0.17, attack: 0.002, decay: 0.14, dest: low });
  tone(v, t, { type: "triangle", f0: 520 * p, f1: 400, glide: 0.04, peak: 0.16, attack: 0.002, decay: 0.08 });
  burst(v, t, { filters: [["bandpass", 440 * p, 1.8]], peak: 2.6, attack: 0.002, decay: 0.14 });
  burst(v, t, { filters: [["bandpass", 860 * p, 2.2]], peak: 1.0, attack: 0.0015, decay: 0.07 });
  burst(v, t, { filters: [["lowpass", 2200, 0.6], ["highpass", 600]], peak: 0.3, attack: 0.002, decay: 0.035 });
  return 0.3;
}

export function coverOpen(v: VoiceContext, o: CoverOptions = {}): number {
  const D = clamp(o.duration ?? 0.96, 0.25, 1.6);
  const t = v.t;
  creak(v, t + 0.03, Math.min(0.42, D * 0.45), clamp(o.creak ?? 1, 0, 1), true);
  // The board moving through the air: slow, low and soft.
  swell(v, t + D * 0.12, D * 0.9, {
    filters: [["bandpass", 340, 0.7], ["lowpass", 1500]],
    sweep: { index: 0, points: [[0, 340], [0.6, 720], [1, 380]] },
    shape: hump(0.62, 1.5),
    peak: 0.3,
  });
  if (o.thud === false) return D + 0.1;
  return D + coverThud({ ...v, t: t + D }, { kind: "open" });
}

export function coverClose(v: VoiceContext, o: CoverOptions = {}): number {
  const D = clamp(o.duration ?? 0.88, 0.25, 1.6);
  const t = v.t;
  creak(v, t + 0.02, Math.min(0.3, D * 0.35), clamp(o.creak ?? 1, 0, 1) * 0.6, false);
  // Closing accelerates into the landing, so the air peaks late.
  swell(v, t + D * 0.1, D * 0.92, {
    filters: [["bandpass", 420, 0.7], ["lowpass", 1700]],
    sweep: { index: 0, points: [[0, 320], [0.8, 820], [1, 520]] },
    shape: hump(0.8, 1.7),
    peak: 0.34,
  });
  if (o.thud === false) return D + 0.1;
  return D + coverThud({ ...v, t: t + D }, { kind: "close" });
}

/* ------------------------------------------------------------------ */
/* Presses                                                             */
/* ------------------------------------------------------------------ */

/**
 * A rubber stamp with a wooden mount coming down on paper on a desk.
 *   body    the desk taking the weight (low; laptops and headphones)
 *   knock   the wooden mount (200 to 600 Hz; what a phone plays as "weight")
 *   slap    rubber meeting paper
 *   squish  ink pressed out sideways: a wet, grainy band that opens for a tenth of a second
 *   peel    the rubber letting go of the paper as the stamp lifts
 */
export function stampPress(v: VoiceContext, o: StampPressOptions = {}): number {
  const k = clamp(o.intensity ?? 1, 0.2, 1);
  const p = vary(v.rng, 0.04);
  const t = v.t;
  const bus = v.ctx.createGain();
  bus.gain.value = 0.55 + 0.45 * k;
  bus.connect(v.out);
  const b: VoiceContext = { ...v, out: bus };

  // Body
  const low = saturate(b, 2.2);
  tone(b, t, { f0: 172 * p, f1: 70, glide: 0.1, peak: 0.15, attack: 0.002, decay: 0.3, dest: low });
  tone(b, t, { f0: 92, peak: 0.07, attack: 0.012, decay: 0.42 });
  // Knock
  tone(b, t, { f0: 318 * p, f1: 150, glide: 0.07, peak: 0.2, attack: 0.0015, decay: 0.17, dest: low });
  tone(b, t, { type: "triangle", f0: 208 * p, f1: 100, glide: 0.09, peak: 0.13, attack: 0.002, decay: 0.2, dest: low });
  tone(b, t, { f0: 560 * p, f1: 410, glide: 0.05, peak: 0.26, attack: 0.001, decay: 0.15 });
  burst(b, t, { filters: [["bandpass", 480 * p, 2]], peak: 3.4, attack: 0.0015, decay: 0.16 });
  burst(b, t, { filters: [["bandpass", 960 * p, 2.4]], peak: 1.6, attack: 0.001, decay: 0.09 });
  // Slap
  burst(b, t, { filters: [["bandpass", 2200, 0.7], ["lowpass", 5500]], peak: 0.95, attack: 0.001, decay: 0.04 });
  // Squish
  const sq = burst(b, t + 0.016, {
    noise: "crackle",
    rate: 0.8,
    filters: [["bandpass", 700, 2.2], ["lowpass", 4200]],
    peak: 1.15,
    attack: 0.026,
    decay: 0.17,
  });
  env(sq[0].frequency, t + 0.016, [[0, 700], [0.13, 1950 * p, "e"]]);
  // Peel
  if (o.lift !== false) {
    const at = t + clamp(o.lift ?? 0.2, 0.08, 1.2);
    const src = noiseSource(b, "crackle", at, 0.07);
    const { last } = chain(b, src, [["bandpass", 2900 * p, 1.5]]);
    const g = b.ctx.createGain();
    env(g.gain, at, [[0, 0], [0.034, 0.16], [0.07, 0, "e"]]);
    last.connect(g).connect(bus);
    return Math.max(0.46, at - t + 0.1);
  }
  return 0.46;
}

/** A seal embossed into paper: slower and rounder than a stamp, with the crunch of paper fibre. */
function embossPress(v: VoiceContext, t: number, scale = 1): void {
  const p = vary(v.rng, 0.03);
  tone(v, t, { f0: 182 * p, f1: 78, glide: 0.09, peak: 0.4 * scale, attack: 0.004, decay: 0.24 });
  tone(v, t, { f0: 372 * p, f1: 196, glide: 0.06, peak: 0.3 * scale, attack: 0.003, decay: 0.14 });
  burst(v, t, { filters: [["bandpass", 430 * p, 2]], peak: 1.8 * scale, attack: 0.003, decay: 0.08 });
  burst(v, t + 0.004, { noise: "crackle", filters: [["bandpass", 2500, 1], ["lowpass", 5200]], peak: 0.36 * scale, attack: 0.006, decay: 0.09 });
}

/**
 * The charity confirms and the gold Verified seal presses on: an embossing press, then a rising
 * E major chime (E5, G#5, B5) over a quiet low fifth. The last note rings; the whole thing is
 * done in about 0.9 s.
 */
export function verified(v: VoiceContext, o: VerifiedOptions = {}): number {
  const t = v.t;
  if (!o.chimeOnly) embossPress(v, t);
  const c = t + (o.chimeOnly ? 0 : 0.055);
  // Warmth under the chime.
  tone(v, c, { f0: N.E4, peak: 0.11, attack: 0.05, decay: 1.0 });
  tone(v, c, { f0: N.B4, peak: 0.07, attack: 0.07, decay: 0.9 });
  if (o.notes === 2) {
    bell(v, c, N.E5, 0.4, 0.8, -0.12);
    bell(v, c + 0.115, N.B5, 0.44, 1.25, 0.12);
    return 0.055 + 0.115 + 1.3;
  }
  bell(v, c, N.E5, 0.36, 0.75, -0.15);
  bell(v, c + 0.095, N.Gs5, 0.36, 0.85, 0);
  bell(v, c + 0.2, N.B5, 0.42, 1.25, 0.15);
  // A hint of gold on the last note.
  ping(v, c + 0.21, N.B6, 0.04, 0.5, 0.2);
  return 0.055 + 0.2 + 1.3;
}

/* ------------------------------------------------------------------ */
/* Provincial Stamp                                                    */
/* ------------------------------------------------------------------ */

/**
 * The award appears. A pad on E add9 fades up from the bottom note to the top while its filter
 * opens (the rise), a breath of air draws in, and at `bloomAt` a soft bell chord opens the sound.
 * Sparkles climb into the bloom and then scatter, thinning out as the pad lets go.
 */
export function provincialReveal(v: VoiceContext, o: ProvincialRevealOptions = {}): number {
  const t = v.t;
  const bloom = clamp(o.bloomAt ?? 0.46, 0.15, 1.2);
  const D = clamp(o.duration ?? 1.5, bloom + 0.4, 3);
  const tail = 0.7;
  const total = D + tail;

  /* Pad */
  const lp = v.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.6;
  env(lp.frequency, t, [[0, 420], [bloom + 0.22, 4200, "e"], [D, 2400, "e"], [total, 900, "e"]]);
  const padOut = v.ctx.createGain();
  padOut.gain.value = 0;
  // Swell to full just after the bloom, hold, then let go.
  const peakX = (bloom + 0.2) / total;
  const holdX = D / total;
  curve(
    padOut.gain,
    t,
    total,
    (x) => {
      if (x < peakX) return Math.pow(x / peakX, 1.8);
      if (x < holdX) return 1 - 0.45 * ((x - peakX) / (holdX - peakX));
      return 0.55 * Math.pow(Math.cos(((x - holdX) / (1 - holdX)) * (Math.PI / 2)), 1.6);
    },
    1,
    96,
  );
  lp.connect(padOut).connect(v.out);

  const pad: [number, number, number][] = [
    // [note, level, entry as a share of the time to the bloom]
    [N.E4, 0.1, 0],
    [N.B4, 0.08, 0.15],
    [N.E5, 0.075, 0.35],
    [N.Fs5, 0.045, 0.55],
    [N.Gs5, 0.065, 0.72],
    [N.B5, 0.04, 0.9],
  ];
  for (const [f, lvl, entry] of pad) {
    const g = v.ctx.createGain();
    const at = entry * bloom;
    env(g.gain, t, [[0, 0], [at, 0], [at + 0.28, lvl]]);
    g.connect(lp);
    for (const cents of [-6, 6]) {
      const osc = v.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      osc.detune.value = cents + (v.rng() - 0.5) * 2;
      osc.connect(g);
      osc.start(t);
      osc.stop(t + total + 0.05);
    }
  }

  /* Breath: air drawn in towards the bloom, gone just after it. */
  swell(v, t, bloom + 0.12, {
    filters: [["bandpass", 4200, 1.4], ["highpass", 2500]],
    sweep: { index: 0, points: [[0, 3600], [1, 8200]] },
    shape: (x) => (x < 0.82 ? Math.pow(x / 0.82, 2.2) : Math.cos(((x - 0.82) / 0.18) * (Math.PI / 2))),
    peak: 0.05,
  });

  /* Bloom */
  const b = t + bloom;
  bell(v, b, N.E5, 0.15, 1.6, -0.2, 0.7);
  bell(v, b + 0.012, N.B5, 0.14, 1.7, 0.2, 0.7);
  bell(v, b + 0.06, N.E6, 0.1, 1.6, 0, 0.6);
  bell(v, b + 0.13, N.Gs6, 0.06, 1.4, 0.25, 0.5);

  /* Sparkles: a climb into the bloom... */
  const climb = [N.B5, N.E6, N.Fs6, N.Gs6, N.B6];
  const climbFrom = Math.max(0.04, bloom - 0.34);
  climb.forEach((f, k) => {
    const at = climbFrom + ((bloom - climbFrom) * k) / climb.length;
    ping(v, t + at, f, 0.03 + 0.014 * k, 0.4, (k / (climb.length - 1)) * 1.2 - 0.6);
  });
  /* ...then a scatter that thins out. */
  const scale = [N.E6, N.Fs6, N.Gs6, N.B6, N.Cs7, N.E7];
  const scatter = 12;
  for (let k = 0; k < scatter; k++) {
    const x = (k + v.rng() * 0.8) / scatter; // 0..1 along the scatter
    const at = bloom + 0.05 + Math.pow(x, 1.35) * (D - bloom + 0.15);
    const f = scale[Math.floor(v.rng() * scale.length)];
    ping(v, t + at, f, (0.1 - 0.06 * x) * vary(v.rng, 0.25), 0.4 + v.rng() * 0.35, v.rng() * 1.5 - 0.75);
  }
  return total + 0.1;
}

/**
 * The stamp flies to its page and is pressed in. A whoosh that grows as it nears the paper and
 * is cut off by the hit; a rounder, softer hit than the rubber stamp; a few sparkles after it.
 */
export function provincialLand(v: VoiceContext, o: ProvincialLandOptions = {}): number {
  const t = v.t;
  const F = clamp(o.flight ?? 0.64, 0.12, 1.5);
  const P = clamp(o.press ?? 0.13, 0, 0.4);
  const hitAt = F + P;
  const p = vary(v.rng, 0.03);

  // Whoosh: grows through the flight, loudest as it drops onto the page, stopped by the hit.
  const whooshShape = (x: number) => (x < 0.86 ? Math.pow(x / 0.86, 2.1) : Math.pow(Math.cos(((x - 0.86) / 0.14) * (Math.PI / 2)), 0.8));
  swell(v, t, hitAt + 0.015, {
    filters: [["bandpass", 420, 1.1], ["lowpass", 3800]],
    sweep: { index: 0, points: [[0, 420], [0.72, 1500], [1, 640]] },
    shape: whooshShape,
    peak: 0.4,
  });
  swell(v, t, hitAt + 0.015, {
    filters: [["highpass", 3000], ["lowpass", 7500]],
    shape: whooshShape,
    peak: 0.045,
  });

  // The hit
  const h = t + hitAt;
  const low = saturate(v, 2);
  tone(v, h, { f0: 156 * p, f1: 64, glide: 0.1, peak: 0.15, attack: 0.003, decay: 0.32, dest: low });
  tone(v, h, { f0: 292 * p, f1: 146, glide: 0.07, peak: 0.18, attack: 0.002, decay: 0.19, dest: low });
  tone(v, h, { f0: 500 * p, f1: 380, glide: 0.05, peak: 0.22, attack: 0.002, decay: 0.15 });
  burst(v, h, { filters: [["bandpass", 440 * p, 1.8]], peak: 2.6, attack: 0.002, decay: 0.15 });
  burst(v, h, { filters: [["bandpass", 900 * p, 2.2]], peak: 1.0, attack: 0.0015, decay: 0.08 });
  burst(v, h, { filters: [["bandpass", 1900, 0.7], ["lowpass", 4800]], peak: 0.5, attack: 0.0015, decay: 0.045 });
  burst(v, h + 0.014, { noise: "crackle", filters: [["bandpass", 1300, 1.8]], peak: 0.3, attack: 0.02, decay: 0.13 });

  // Gold: an open fifth rings out of the hit, then the sparkle tail.
  bell(v, h + 0.02, N.E5, 0.15, 1.0, -0.15, 0.7);
  bell(v, h + 0.03, N.B5, 0.13, 1.15, 0.15, 0.7);
  const tailNotes = [N.B6, N.Gs6, N.E7, N.Cs7, N.Fs6];
  tailNotes.forEach((f, k) => {
    const at = 0.06 + k * 0.075 + v.rng() * 0.03;
    ping(v, h + at, f, 0.075 - 0.009 * k, 0.45, v.rng() * 1.4 - 0.7);
  });
  return hitAt + 1.25;
}

/* ------------------------------------------------------------------ */
/* Interface                                                           */
/* ------------------------------------------------------------------ */

/** A button press: closer to a felt tick than a beep. */
export function tap(v: VoiceContext): number {
  const p = vary(v.rng, 0.03);
  tone(v, v.t, { f0: 1180 * p, f1: 820, glide: 0.03, peak: 0.5, attack: 0.001, decay: 0.06 });
  burst(v, v.t, { filters: [["bandpass", 3600, 1]], peak: 0.3, attack: 0.0008, decay: 0.014 });
  return 0.09;
}

/** A notice dropping in: one soft, rounded blip (B5 with a breath of E6). */
export function toast(v: VoiceContext): number {
  const t = v.t;
  tone(v, t, { f0: N.B5 * 0.97, f1: N.B5, glide: 0.04, peak: 0.42, attack: 0.007, decay: 0.4 });
  tone(v, t + 0.005, { f0: N.E6, peak: 0.16, attack: 0.008, decay: 0.28 });
  tone(v, t, { f0: N.B4, peak: 0.12, attack: 0.012, decay: 0.3 });
  return 0.45;
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export interface SoundOptionsMap {
  pageFlip: PageFlipOptions;
  pageRiffle: PageRiffleOptions;
  coverOpen: CoverOptions;
  coverClose: CoverOptions;
  coverThud: CoverThudOptions;
  stampPress: StampPressOptions;
  verified: VerifiedOptions;
  provincialReveal: ProvincialRevealOptions;
  provincialLand: ProvincialLandOptions;
  tap: EmptyOptions;
  toast: EmptyOptions;
}

export type SoundName = keyof SoundOptionsMap;

export interface SoundDef<K extends SoundName> {
  voice(v: VoiceContext, o?: SoundOptionsMap[K]): number;
  /** Default volume: the sounds are balanced against each other here (see docs/agents/sound.md). */
  level: number;
  /** Calls closer together than this (ms) are dropped, so a burst of events cannot pile up. */
  minGap: number;
}

export const SOUND_DEFS: { [K in SoundName]: SoundDef<K> } = {
  pageFlip: { voice: pageFlip, level: 0.44, minGap: 45 },
  pageRiffle: { voice: pageRiffle, level: 0.38, minGap: 200 },
  coverOpen: { voice: coverOpen, level: 0.6, minGap: 150 },
  coverClose: { voice: coverClose, level: 0.6, minGap: 150 },
  coverThud: { voice: coverThud, level: 0.6, minGap: 100 },
  stampPress: { voice: stampPress, level: 0.6, minGap: 80 },
  verified: { voice: verified, level: 0.44, minGap: 200 },
  provincialReveal: { voice: provincialReveal, level: 0.5, minGap: 400 },
  provincialLand: { voice: provincialLand, level: 0.7, minGap: 300 },
  tap: { voice: tap, level: 0.22, minGap: 40 },
  toast: { voice: toast, level: 0.26, minGap: 120 },
};

export const SOUND_NAMES = Object.keys(SOUND_DEFS) as SoundName[];
