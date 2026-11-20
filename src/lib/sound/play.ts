import { playSound, type PlayOptions, type SoundHandle } from "./engine";
import type { SoundName, SoundOptionsMap } from "./synth";

type Player<K extends SoundName> = (options?: SoundOptionsMap[K] & PlayOptions) => SoundHandle;

/**
 * Every sound in the demo. Each call is fire-and-forget, safe on the server, safe before the
 * first gesture and safe while muted (all three are silent no-ops), and returns a handle whose
 * stop() fades the sound out early.
 */
export const play: { [K in SoundName]: Player<K> } = {
  /** A page turning. Pass the flip animation's `duration` (seconds) so the flap lands with the page. */
  pageFlip: (o) => playSound("pageFlip", o),
  /** Several pages flicking past, as one call. Use pageFlip({ light: true }) per page when the engine reports each flip. */
  pageRiffle: (o) => playSound("pageRiffle", o),
  /** The cover swinging open: a faint creak, air, and the board landing at `duration`. */
  coverOpen: (o) => playSound("coverOpen", o),
  /** The cover swinging shut. */
  coverClose: (o) => playSound("coverClose", o),
  /** The board landing, on its own (for swings that can be interrupted). */
  coverThud: (o) => playSound("coverThud", o),
  /** The rubber stamp hitting the page. Call at the moment of impact. */
  stampPress: (o) => playSound("stampPress", o),
  /** The Verified seal pressing on: an embossing press and a three-note chime. Call at the moment of impact. */
  verified: (o) => playSound("verified", o),
  /** The Provincial Stamp award appearing: a swell that blooms at `bloomAt`. Call when the overlay opens. */
  provincialReveal: (o) => playSound("provincialReveal", o),
  /** The Provincial Stamp flying to its page: whoosh, press, sparkle. Call when the flight starts. */
  provincialLand: (o) => playSound("provincialLand", o),
  /** A button press. */
  tap: (o) => playSound("tap", o),
  /** A notice appearing. */
  toast: (o) => playSound("toast", o),
};

export type Play = typeof play;
