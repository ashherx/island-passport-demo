/**
 * Sound for the Island Passport demo. See docs/agents/sound.md.
 *
 *   import { play, useSound } from "@/lib/sound";
 *   play.stampPress();
 *   const { muted, toggleMuted } = useSound();
 */
export { play, type Play } from "./play";
export { useSound, type UseSound } from "./useSound";
export {
  canPlaySound,
  getServerSoundState,
  getSoundState,
  playSound,
  setMuted,
  setPlayOnSilentSwitch,
  setVolume,
  subscribe,
  toggleMuted,
  unlock,
  type PlayOptions,
  type SoundHandle,
  type SoundState,
} from "./engine";
export {
  SOUND_DEFS,
  SOUND_NAMES,
  intensityFromVelocity,
  mulberry32,
  type CoverOptions,
  type CoverThudOptions,
  type PageFlipOptions,
  type PageRiffleOptions,
  type ProvincialLandOptions,
  type ProvincialRevealOptions,
  type SoundName,
  type SoundOptionsMap,
  type StampPressOptions,
  type VerifiedOptions,
  type VoiceContext,
} from "./synth";
