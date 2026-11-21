"use client";

/**
 * The sound switch. It is the engine's own mute state (`@/lib/sound`), shown as a button: there is
 * no second copy of "is sound on" anywhere. The choice is saved by the engine and applies to every
 * sound in the demo, on every page that shows this switch.
 *
 * Kept apart from StampPress.tsx so a host can show it without loading the stamping moment (UX-7).
 */
import { useEffect, useState } from "react";
import { play, useSound } from "@/lib/sound";
import { pressStrings } from "./strings";

export interface StampPressSoundToggleProps {
  className?: string;
}

/**
 * Turning it on unlocks audio inside the click (the only moment a browser allows it) and plays one
 * tap as confirmation. Renders nothing where Web Audio is missing, and nothing until the saved
 * choice is known (after mount), so someone who muted last time never sees it flash "on".
 */
export function StampPressSoundToggle({ className }: StampPressSoundToggleProps) {
  const { muted, available, setMuted } = useSound();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !available) return null;
  const sound = !muted;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={sound}
      aria-label={pressStrings.sound.label}
      title={sound ? pressStrings.sound.on : pressStrings.sound.off}
      onClick={() => {
        setMuted(sound);
        // Now on: setMuted(false) has started the audio context in this click, so this is heard.
        if (!sound) play.tap();
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
