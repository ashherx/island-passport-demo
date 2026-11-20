"use client";

/**
 * Switch for the stamp sound. Kept apart from StampPress.tsx so a host can show it without loading
 * the stamping moment itself (UX-7).
 */
import { useEffect, useState } from "react";
import { canPlaySound, playThunk, primeSound } from "./feedback";
import { pressStrings } from "./strings";

export interface StampPressSoundToggleProps {
  /** Whether the thunk is on. Muted (false) by default in every host. */
  sound: boolean;
  onSoundToggle(on: boolean): void;
  className?: string;
}

/**
 * Small switch for the stamp sound. Turning it on creates the audio context inside the click,
 * which is the only moment a browser allows it, and plays one quiet thunk as confirmation.
 * Renders nothing where Web Audio is missing.
 */
export function StampPressSoundToggle({ sound, onSoundToggle, className }: StampPressSoundToggleProps) {
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(canPlaySound()), []);
  if (!available) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={sound}
      aria-label={pressStrings.sound.label}
      title={sound ? pressStrings.sound.on : pressStrings.sound.off}
      onClick={() => {
        const next = !sound;
        if (next && primeSound()) playThunk(0.5);
        onSoundToggle(next);
      }}
      className={className}
      style={{ touchAction: "manipulation" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" fillOpacity={sound ? 0.18 : 0} />
        {sound ? (
          <>
            <path d="M15.4 9.2a4 4 0 0 1 0 5.6" />
            <path d="M17.9 6.8a7.4 7.4 0 0 1 0 10.4" />
          </>
        ) : (
          <path d="M16 9.6l4.6 4.8M20.6 9.6L16 14.4" />
        )}
      </svg>
      <span>{sound ? pressStrings.sound.on : pressStrings.sound.off}</span>
    </button>
  );
}
