/**
 * Physical feedback for the stamping moment: vibration, a synthesized "thunk" and the page nudge.
 * Everything is feature-detected and wrapped so that an in-app browser without the API just
 * carries on silently.
 */

/* ------------------------------------------------------------------ */
/* Vibration (UX-3)                                                    */
/* ------------------------------------------------------------------ */

/** Short double tap: the hit, a breath, the weight settling. */
export const IMPACT_PATTERN: readonly number[] = [12, 30, 18];

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Returns true when the browser accepted the request. iOS Safari has no Vibration API. */
export function vibrate(pattern: number | readonly number[] = IMPACT_PATTERN): boolean {
  if (!canVibrate()) return false;
  try {
    return navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Sound: a very short synthesized thunk                               */
/* ------------------------------------------------------------------ */

type AudioContextCtor = typeof AudioContext;

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audioCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function canPlaySound(): boolean {
  return audioCtor() !== null;
}

/**
 * Create (or resume) the audio context. Browsers only allow this inside a user gesture, so call
 * it from a click or key handler: the sound toggle does. Returns false when audio is unavailable.
 */
export function primeSound(): boolean {
  const Ctor = audioCtor();
  if (!Ctor) return false;
  try {
    if (!audio) audio = new Ctor();
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);
    return true;
  } catch {
    audio = null;
    return false;
  }
}

/** True once primeSound() has run inside a gesture. */
export function soundReady(): boolean {
  return audio !== null && audio.state !== "closed";
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const length = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic noise, so the thunk sounds the same every time.
  let seed = 22222;
  for (let i = 0; i < length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  noise = buffer;
  return buffer;
}

/**
 * Wood on paper on a desk: a pitched-down body, a soft slap and a tiny click. About 160 ms.
 * Does nothing until primeSound() has been called from a user gesture.
 */
export function playThunk(volume = 1): void {
  const ctx = audio;
  if (!ctx || ctx.state === "closed") return;
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime + 0.005;
    const out = ctx.createGain();
    out.gain.value = Math.max(0, Math.min(1, volume)) * 0.9;
    out.connect(ctx.destination);

    // Body
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(168, now);
    body.frequency.exponentialRampToValueAtTime(46, now + 0.11);
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.9, now + 0.006);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    body.connect(bodyGain).connect(out);
    body.start(now);
    body.stop(now + 0.18);

    // Knock: the wooden mount
    const knock = ctx.createOscillator();
    const knockGain = ctx.createGain();
    knock.type = "triangle";
    knock.frequency.setValueAtTime(420, now);
    knock.frequency.exponentialRampToValueAtTime(180, now + 0.04);
    knockGain.gain.setValueAtTime(0.0001, now);
    knockGain.gain.exponentialRampToValueAtTime(0.28, now + 0.003);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    knock.connect(knockGain).connect(out);
    knock.start(now);
    knock.stop(now + 0.08);

    // Slap: rubber meeting paper
    const slap = ctx.createBufferSource();
    slap.buffer = noiseBuffer(ctx);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1500;
    band.Q.value = 0.8;
    const slapGain = ctx.createGain();
    slapGain.gain.setValueAtTime(0.32, now);
    slapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    slap.connect(band).connect(slapGain).connect(out);
    slap.start(now);
    slap.stop(now + 0.08);

    window.setTimeout(() => {
      try {
        out.disconnect();
      } catch {
        /* already gone */
      }
    }, 400);
  } catch {
    /* Audio is a nicety. Never let it break the moment. */
  }
}

/* ------------------------------------------------------------------ */
/* Page nudge                                                          */
/* ------------------------------------------------------------------ */

/**
 * Knock the surface down a few pixels and let it spring back, with a slight twist so the hit reads
 * as weight landing off-centre and not as a scroll jitter.
 *
 * Uses the individual `translate`, `scale` and `rotate` properties through the Web Animations API,
 * so it composes with whatever `transform` the element already has (a passport page mid-layout,
 * for example) and leaves no inline style behind. Engines without those properties ignore it.
 * `strength` 1 is 3.6 px and about 0.24 degrees; the twist stops growing at strength 1.7.
 */
export function nudge(el: Element | null | undefined, strength = 1): void {
  if (!el || typeof (el as HTMLElement).animate !== "function") return;
  if (!Number.isFinite(strength) || strength <= 0) return;
  try {
    const d = 3.6 * strength;
    const r = (0.4 * Math.min(strength, 1.7)) / 1.7;
    const deg = (v: number) => `${v.toFixed(3)}deg`;
    (el as HTMLElement).animate(
      [
        { translate: "0px 0px", scale: "1", rotate: "0deg" },
        { translate: `0px ${d.toFixed(2)}px`, scale: "0.994", rotate: deg(r), offset: 0.16 },
        { translate: `0px ${(-d * 0.3).toFixed(2)}px`, scale: "1.0015", rotate: deg(-r * 0.3), offset: 0.5 },
        { translate: `0px ${(d * 0.08).toFixed(2)}px`, scale: "1", rotate: deg(r * 0.08), offset: 0.76 },
        { translate: "0px 0px", scale: "1", rotate: "0deg" },
      ],
      { duration: 340, easing: "cubic-bezier(.2,.8,.3,1)" },
    );
  } catch {
    /* No Web Animations support for these properties: skip the nudge. */
  }
}
