/**
 * The sound engine: one AudioContext for the whole app, created lazily, unlocked by the first
 * user gesture, with a master volume and a global mute that React can subscribe to.
 *
 * Rules it keeps:
 *  - Nothing here ever throws. Where Web Audio is missing, every call is a silent no-op.
 *  - No AudioContext exists until a gesture arrives and sound is not muted. iOS Safari and the
 *    Instagram, TikTok and Facebook in-app browsers refuse audio outside a gesture, and an idle
 *    context costs battery.
 *  - A context that is "suspended" or "interrupted" (a phone call, a tab switch, the lock screen)
 *    is resumed on the next gesture and when the page becomes visible again.
 *  - A sound that cannot start within a quarter of a second is dropped, never played late.
 */
import { SOUND_DEFS, type SoundName, type SoundOptionsMap, type VoiceContext } from "./synth";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface SoundState {
  /** The user's choice. Persisted. Default false: sound is on once a gesture has unlocked it. */
  muted: boolean;
  /** Master volume, 0..1. Persisted. */
  volume: number;
  /** A gesture has unlocked audio and the context is running. */
  unlocked: boolean;
  /** This browser has Web Audio at all. False on the server. */
  available: boolean;
}

/** Options every play.x() call accepts on top of its own. */
export interface PlayOptions {
  /** Multiplies the sound's default level. Default 1. */
  volume?: number;
  /** Seconds from now at which the sound starts. Scheduled on the audio clock, so it is exact. */
  delay?: number;
}

/** Returned by every play.x(). */
export interface SoundHandle {
  /** Fade this sound out early (a skipped celebration, an interrupted swing). `fade` in seconds, default 0.08. */
  stop(fade?: number): void;
}

const NOOP_HANDLE: SoundHandle = { stop() {} };
const STORAGE_KEY = "ip-sound";
const DEFAULT_VOLUME = 0.8;
const SERVER_STATE: SoundState = { muted: false, volume: DEFAULT_VOLUME, unlocked: false, available: false };

type AudioContextCtor = typeof AudioContext;
type Listener = () => void;

let state: SoundState = SERVER_STATE;
const listeners = new Set<Listener>();
let booted = false;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const lastPlayed = new Map<SoundName, number>();

function ctor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function setState(patch: Partial<SoundState>): void {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof SoundState)[]) {
    if (state[key] !== patch[key]) changed = true;
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a listener's problem, not ours */
    }
  });
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: state.muted, volume: state.volume }));
  } catch {
    /* private mode, storage disabled, in-app browser: the choice lasts for this visit only */
  }
}

/** Client-only set-up, run once: read the saved choice and start listening for gestures. */
function boot(): void {
  if (booted || typeof window === "undefined") return;
  booted = true;
  let muted = false;
  let volume = DEFAULT_VOLUME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { muted?: unknown; volume?: unknown };
      if (typeof saved.muted === "boolean") muted = saved.muted;
      if (typeof saved.volume === "number" && Number.isFinite(saved.volume)) volume = Math.min(1, Math.max(0, saved.volume));
    }
  } catch {
    /* unreadable: defaults */
  }
  state = { muted, volume, unlocked: false, available: ctor() !== null };
  if (!state.available) return;
  try {
    // pointerdown and keydown come first on desktop; iOS only counts touchend, pointerup and click.
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    for (const type of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
      window.addEventListener(type, onGesture, opts);
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
  } catch {
    /* no events, no sound */
  }
}

/* ------------------------------------------------------------------ */
/* The context                                                         */
/* ------------------------------------------------------------------ */

function isRunning(c: AudioContext | null): c is AudioContext {
  return c !== null && c.state === "running";
}

function createContext(): AudioContext | null {
  if (ctx && ctx.state !== "closed") return ctx;
  const Ctor = ctor();
  if (!Ctor) return null;
  try {
    let made: AudioContext;
    try {
      made = new Ctor({ latencyHint: "interactive" });
    } catch {
      made = new Ctor();
    }
    const gain = made.createGain();
    gain.gain.value = state.muted ? 0 : state.volume;
    // A safety limiter. Single sounds stay under its threshold (see docs/agents/sound.md), so it
    // leaves them alone; it only works when several land at once (a stamp, a notice and a page
    // flip, say). The node adds 1.46 dB of make-up gain at these settings (measured with
    // scripts/scratch/sound-limiter.mjs); the trim after it takes that back out.
    try {
      const limiter = made.createDynamicsCompressor();
      limiter.threshold.value = -4;
      limiter.knee.value = 4;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      const trim = made.createGain();
      trim.gain.value = 0.845;
      gain.connect(limiter).connect(trim).connect(made.destination);
    } catch {
      gain.connect(made.destination);
    }
    made.onstatechange = () => setState({ unlocked: isRunning(ctx) });
    ctx = made;
    master = gain;
    return made;
  } catch {
    ctx = null;
    master = null;
    return null;
  }
}

/**
 * Ask a context that is not running to run. Safe to call at any time; only works after a gesture.
 * Deliberately not de-duplicated: on iOS a resume() made in pointerdown (which does not count as
 * a gesture there) stays pending, and the one made in touchend is the one that succeeds.
 */
function resume(): Promise<void> | null {
  const c = ctx;
  if (!c || c.state === "closed") return null;
  if (c.state === "running") {
    setState({ unlocked: true });
    return null;
  }
  try {
    return c.resume().then(
      () => setState({ unlocked: isRunning(ctx) }),
      () => undefined,
    );
  } catch {
    return null;
  }
}

/**
 * Create and start the context. Must be reached from inside a user gesture the first time.
 * Called automatically on every gesture; call it yourself from a click handler if a sound has to
 * play in that same handler before the automatic listeners have run (they are capture-phase
 * listeners on window, so this is rarely needed).
 */
export function unlock(): boolean {
  boot();
  if (!state.available || state.muted) return false;
  const fresh = !ctx || ctx.state === "closed";
  const c = createContext();
  if (!c) return false;
  if (fresh) {
    // Older iOS only opens the audio route once a buffer has actually been started in a gesture.
    try {
      const silent = c.createBufferSource();
      silent.buffer = c.createBuffer(1, 1, c.sampleRate);
      silent.connect(c.destination);
      silent.start(0);
    } catch {
      /* not needed on current browsers */
    }
  }
  void resume();
  return true;
}

function onGesture(): void {
  if (state.muted) return;
  if (isRunning(ctx)) return;
  unlock();
}

function onVisibility(): void {
  try {
    if (document.visibilityState === "visible" && ctx && !state.muted) void resume();
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Playing                                                             */
/* ------------------------------------------------------------------ */

/** How long a sound may wait for the context to start before it is dropped (ms). */
const LATE_MS = 250;

export function playSound<K extends SoundName>(name: K, options?: SoundOptionsMap[K] & PlayOptions): SoundHandle {
  try {
    boot();
    if (!state.available || state.muted) return NOOP_HANDLE;
    const def = SOUND_DEFS[name];
    const now = performance.now();
    const last = lastPlayed.get(name);
    if (last !== undefined && now - last < def.minGap) return NOOP_HANDLE;

    // No context yet means no gesture yet: there is nothing to play through. Stay silent.
    const c = ctx;
    if (!c || c.state === "closed") return NOOP_HANDLE;
    lastPlayed.set(name, now);

    let bus: GainNode | null = null;
    let stopped = false;
    const start = () => {
      if (stopped || !isRunning(ctx) || !master || state.muted) return;
      try {
        const live = ctx;
        const g = live.createGain();
        g.gain.value = def.level * Math.max(0, Math.min(2, options?.volume ?? 1));
        g.connect(master);
        bus = g;
        const v: VoiceContext = { ctx: live, out: g, t: live.currentTime + 0.012 + Math.max(0, options?.delay ?? 0), rng: Math.random };
        const length = (def.voice as (v: VoiceContext, o?: unknown) => number)(v, options);
        window.setTimeout(
          () => {
            try {
              g.disconnect();
            } catch {
              /* already gone */
            }
          },
          (Math.max(0, options?.delay ?? 0) + length + 0.4) * 1000,
        );
      } catch {
        /* Sound is a nicety. Never let it break the moment. */
      }
    };

    if (c.state === "running") start();
    else {
      // Suspended or interrupted. Inside a gesture the resume succeeds within a few milliseconds
      // and the sound still plays; anywhere else it is dropped rather than played late.
      const p = resume();
      if (p) void p.then(() => (performance.now() - now <= LATE_MS ? start() : undefined));
    }

    return {
      stop(fade = 0.08) {
        stopped = true;
        const g = bus;
        const live = ctx;
        if (!g || !live) return;
        try {
          g.gain.cancelScheduledValues(live.currentTime);
          g.gain.setTargetAtTime(0, live.currentTime, Math.max(0.005, fade / 4));
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    return NOOP_HANDLE;
  }
}

/* ------------------------------------------------------------------ */
/* Mute and volume                                                     */
/* ------------------------------------------------------------------ */

function applyMaster(): void {
  if (!ctx || !master || ctx.state === "closed") return;
  try {
    // A short ramp, so sounds already in the air fade instead of clicking off.
    master.gain.setTargetAtTime(state.muted ? 0 : state.volume, ctx.currentTime, 0.015);
  } catch {
    /* ignore */
  }
}

/** Turn all sound off or on. Turning it on from a click also unlocks audio in that click. */
export function setMuted(muted: boolean): void {
  boot();
  if (state.muted === muted) return;
  setState({ muted });
  persist();
  if (!muted) unlock();
  applyMaster();
}

export function toggleMuted(): boolean {
  boot();
  setMuted(!state.muted);
  return state.muted;
}

/** Master volume, 0..1. */
export function setVolume(volume: number): void {
  boot();
  const v = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : DEFAULT_VOLUME));
  if (v === state.volume) return;
  setState({ volume: v });
  persist();
  applyMaster();
}

/* ------------------------------------------------------------------ */
/* Store (for useSyncExternalStore)                                    */
/* ------------------------------------------------------------------ */

export function subscribe(listener: Listener): () => void {
  boot();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSoundState(): SoundState {
  boot();
  return state;
}

export function getServerSoundState(): SoundState {
  return SERVER_STATE;
}

/** True where sounds could ever play: Web Audio exists. Use it to decide whether to show a sound switch. */
export function canPlaySound(): boolean {
  return ctor() !== null;
}

/**
 * iOS only. By default Web Audio follows the ring/silent switch, so a phone on silent plays
 * nothing. Pass true to play regardless (the "playback" audio session, iOS 17+), false to follow
 * the switch again. Off by default: a demo that makes noise on a silenced phone is rude.
 */
export function setPlayOnSilentSwitch(on: boolean): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = on ? "playback" : "auto";
  } catch {
    /* not iOS 17+: nothing to do */
  }
}
