/**
 * Short vibration where the phone supports it (UX-3). Feature-detected and wrapped in try/catch:
 * iOS Safari has no navigator.vibrate, and some in-app browsers expose it but throw or ignore it
 * without a recent tap.
 */
export const HAPTICS = {
  /** Foil seal pressed onto the stamp: a light tick, then the press. */
  sealPress: [8, 46, 20],
  /** Provincial Stamp revealed. */
  awardReveal: [12, 70, 12, 70, 26],
  /** Provincial Stamp settles on its page. */
  awardLand: [26],
  /** Single pulse used when reduced motion is on. */
  soft: [14],
} as const satisfies Record<string, readonly number[]>;

export function vibrate(pattern: readonly number[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  // Before the first tap on the page Chrome refuses, and logs an error (a moment replayed from a
  // tap made before hydration, a lab that plays on load).
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return false;
  try {
    return navigator.vibrate([...pattern]);
  } catch {
    return false;
  }
}
