/**
 * Physical feedback for the stamping moment: vibration and the page nudge. (The sound of the hit
 * is `play.stampPress()` from `@/lib/sound`.) Everything is feature-detected and wrapped so that
 * an in-app browser without the API just carries on.
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
  // Before the first tap on the page Chrome refuses, and logs an error.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return false;
  try {
    return navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
  } catch {
    return false;
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
