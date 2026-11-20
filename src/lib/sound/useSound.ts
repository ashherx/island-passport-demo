"use client";

import { useSyncExternalStore } from "react";
import { getServerSoundState, getSoundState, setMuted, setVolume, subscribe, toggleMuted, type SoundState } from "./engine";
import { play } from "./play";

export interface UseSound extends SoundState {
  play: typeof play;
  setMuted: typeof setMuted;
  toggleMuted: typeof toggleMuted;
  setVolume: typeof setVolume;
}

/**
 * The sound engine for React: the live mute / volume / unlocked state, plus the actions.
 *
 *   const { muted, toggleMuted, play } = useSound();
 *
 * Renders with the defaults on the server and during hydration (muted: false, available: false),
 * then with the saved choice. Components that only play sounds do not need the hook: import
 * `play` directly and they will not re-render when the state changes.
 */
export function useSound(): UseSound {
  const state = useSyncExternalStore(subscribe, getSoundState, getServerSoundState);
  return { ...state, play, setMuted, toggleMuted, setVolume };
}
