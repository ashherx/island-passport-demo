# Celebrations handoff

Two moments that follow the first stamp: the status upgrade (UX-3, STM-3) and the Provincial Stamp award (UX-4, STM-4).
Live lab: `http://localhost:3100/lab/celebrations` (both moments, with trigger, replay and reset buttons).

## Files

| Path | What it is |
| --- | --- |
| `src/components/moments/StatusUpgrade.tsx` | `StatusUpgrade`, `StatusUpgradeHandle`, `STATUS_UPGRADE_TIMELINE` |
| `src/components/moments/ProvincialAward.tsx` | `ProvincialAward`, `AwardTarget`, `PROVINCIAL_AWARD_TIMELINE` |
| `src/components/moments/celebrations/StatusChip.tsx` | `StatusChip`: the label that morphs from "Donation pending" to "Verified Supporter" |
| `src/components/moments/celebrations/confetti.ts` | `burstConfetti(canvas, options)`: canvas confetti, returns a stop function |
| `src/components/moments/celebrations/haptics.ts` | `vibrate(pattern)` (feature-detected), `HAPTICS` patterns |
| `src/components/moments/celebrations/outline.ts` | `outlinePath(shape)`: each stamp outline as one path |
| `src/components/moments/celebrations/strings.ts` | `celebrationStrings`: copy that `src/lib/strings.ts` does not have yet |
| `src/components/moments/celebrations/celebrations.css` | All styles, prefixed `ipc-`. Imported by the components |
| `src/app/lab/celebrations/page.tsx` | The lab page |
| `scripts/scratch/celebrations-*` | Throwaway capture, behaviour and frame-time scripts |

Nothing outside these paths was edited.

## StatusUpgrade

An inline component the size of one stamp. Put it where the pending `<Stamp />` sits, then play it.

```tsx
import { StatusUpgrade, type StatusUpgradeHandle } from "@/components/moments/StatusUpgrade";

const ref = useRef<StatusUpgradeHandle>(null);

<StatusUpgrade
  ref={ref}
  stamp={stamp}            // the pending stamp
  size={236}
  label="paper"            // morphing chip under the stamp; "chrome" off the page; false to hide
  onImpact={() => …}       // seal lands: update the ring and counters here
  onComplete={() => …}     // finished: swap back to a plain <Stamp status="verified" /> if you like
/>

ref.current?.play();
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `stamp` | `Stamp` | | Its own `status` is ignored: drawn pending, then verified |
| `size` | `number` | `200` | Same rule as `<Stamp />`: a number of px |
| `initial` | `"pending" \| "verified"` | `"pending"` | State on mount |
| `autoPlay` | `boolean` | `false` | Play once after mounting |
| `delay` | `number` | `350` | ms before `autoPlay` |
| `label` | `"paper" \| "chrome" \| false` | `"paper"` | Paper uses the stamp inks, chrome uses `--status-*` |
| `haptics` | `boolean` | `true` | `[8, 46, 20]` when the seal lands |
| `rotate`, `blend` | | | Forwarded to `<Stamp />` |
| `onImpact` | `() => void` | | Fires once, when the seal lands or on skip |
| `onComplete` | `() => void` | | Fires once per play |

Handle: `play()` (no-op while playing; from done it restarts from pending), `skip()`, `reset()`.

What happens, about 2.5s (`STATUS_UPGRADE_TIMELINE`, seconds):

1. `0.06` A solid line in the verified ink is drawn over the dashed outline, led by a bead of wet ink. The clock badge's hands race.
2. `0.42` Verified ink soaks in (the stamp's own `inkProgress` reveal plus a soft wash) while the pending ink fades.
3. `0.82` The clock badge pops off.
4. `1.02` to `1.42` The foil seal comes down onto the corner. At impact: the stamp dips, a ring of light and six foil sparks, the vibration, `onImpact`, and the chip starts to morph.
5. `1.54` A band of light crosses the foil.
6. `2.5` Overlays are removed and the component renders a plain verified `<Stamp />` with its own seal. `onComplete`.

It differs from the first stamping moment on purpose: no stamper and no second impression. The provisional mark is confirmed in place.

Skipping: tap the stamp or press Escape while it plays, or call `skip()`. Reduced motion: a 0.26s cross-fade from the pending stamp to the verified one, the chip swaps without transition, one short vibration.

Accessibility: the box is `role="img"` with the same label format as `<Stamp />`, updated to the new status. A polite live region announces "Verified Supporter. {charity} confirmed your support for {island}."

`StatusChip` can be used on its own: `<StatusChip status="pending" surface="chrome" />`, then set `status="verified"`. It is CSS only.

## ProvincialAward

A full-screen dialog, portalled to `<body>` (it re-applies the current art direction inside the portal).

```tsx
import { ProvincialAward } from "@/components/moments/ProvincialAward";

<ProvincialAward
  open={open}
  stamp={passport.provincial.stamp}
  verifiedCount={3}
  target={slotRef}                    // square element the size the page draws the stamp at
  onAdd={() => book.flipTo(page)}     // may return a promise; the stamp waits for it (max 1400ms)
  onLanded={() => setEarned(true)}    // show the real stamp in the slot now
  onComplete={() => setOpen(false)}   // unmount
/>
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `open` | `boolean` | | Mounts the overlay. Set false in `onComplete` |
| `stamp` | `Stamp` | | The Provincial Stamp as awarded |
| `verifiedCount` | `number` | | For the copy line |
| `target` | ref, or `() => HTMLElement \| DOMRect \| null` | | Measured after `onAdd` resolves. Without it the stamp drops away and the overlay closes |
| `onAdd` | `() => void \| Promise` | | "Add to passport" tapped. Flip to the Provincial page here |
| `addTimeout` | `number` | `1400` | Longest wait for `onAdd`, ms |
| `onLanded` | `() => void` | | Exactly once per opening, also on skip, always before `onComplete` |
| `onComplete` | `() => void` | | The overlay is finished |
| `haptics` | `boolean` | `true` | Reveal `[12, 70, 12, 70, 26]`, landing `[26]` |
| `confetti` | `boolean` | `true` | Always off with reduced motion |

Sequence:

1. The screen dims to the cover colour (near-opaque, no backdrop blur, so nothing behind is re-blurred per frame). Slow rays turn behind the stamp.
2. The stamp rises on a medallion of page paper with a foil rim. Light crosses the foil edge and repeats every 3.8s while waiting.
3. One confetti burst: 44 tiny postmarks, leaves, waves and sparks in the direction's colours, on a canvas, hard-stopped at 1.8s.
4. Copy and the "Add to passport" button (focused on open).
5. On the button: copy and backdrop fade, `onAdd` runs, the stamp lifts, flies an arc to `target` (0.64s), the medallion dissolves on the way, the stamp is pressed in (0.13s), `onLanded` fires, two rings spread from the impression, and the flyer dissolves into the real stamp over 0.2s.

Integration notes:

- The slot must render `<Stamp stamp={provincial.stamp} size={slotWidth} />` in `onLanded`. The flyer matches its size, position and tilt, then cross-fades, so the hand-over has no jump. If showing the stamp reflows the page, the flyer re-measures the slot on the next frame and follows it.
- The flyer is drawn at hero size (up to 264px) and scaled down to the slot. Slots much larger than the hero would be scaled up and look soft.
- The page must be visible when `onAdd` resolves. If the target has no size the fallback (drop away) runs.
- Skip (the Skip button or Escape) still awards the stamp: `onAdd` (not awaited), `onLanded`, `onComplete`.
- While open: body scroll is locked, Tab is trapped between Skip and the button, and arrow keys, PageUp/Down, Home and End are stopped in the capture phase so they cannot turn passport pages. Focus returns to the element that had it.
- z-index is 1000.

Reduced motion: fade in, no rays, shimmer or confetti. The button closes with a fade and fires `onLanded` and `onComplete`. No flight.

## Strings

`celebrationStrings` holds the copy that `src/lib/strings.ts` lacks ("Add to passport", "Skip", the skip hint, the lab page text). I do not own `strings.ts`, so they live in `celebrations/strings.ts`. To satisfy TEC-12 strictly, move the object into `strings` and re-point four imports. Everything else comes from `strings` (`moments.verified*`, `moments.provincial*`, `status.*`, `stamp.provincialOf`, `actions.*`, `sample.tag`).

## What was checked

All in Chromium (headless shell, the only browser installed), dev server, 390x844 @2x.

- Looked at time-accurate frames (CDP screencast) of both moments in classic light, and at key frames in all three directions in light and dark.
- `scripts/scratch/celebrations-behaviour.mjs`: 26 checks pass. They cover the seal hand-over (0.00px offset, same size), replay, tap and Escape skip, reduced motion for both moments, dialog label, initial focus, Tab trap, scroll lock, focus return, Enter on the button through to landing, vibration patterns, console errors, and a 360x600 viewport.
- Main-thread frame times with 4x CPU throttling (`celebrations-perf.mjs`): flight 16.7ms average with no frame over 20ms; upgrade and award entrance 17 to 18ms average with one long frame (about 115 to 185ms) at the tap, before anything moves. That frame is React mounting the overlays in the dev build.
- `tsc --noEmit` and eslint are clean for these files. No hydration warnings, with or without reduced motion.

## Known issues

- Not tested on a real phone, on iOS, or inside the Instagram, TikTok or Facebook browsers. Nothing exotic is used (`mask-image` with the `-webkit-` prefix, `clip-path: polygon`, `repeating-conic-gradient`, 2D canvas, `navigator.vibrate` feature-detected), but the foundation's caveat about `filter: url()` on iOS applies to the stamps here too.
- The frame-time numbers are requestAnimationFrame intervals. They do not include raster or compositor time, so they say nothing about the cost of the stamp's SVG ink filter on a real GPU. The ink soak animates `inkProgress` on one stamp for 0.8s, which the foundation doc describes as the supported case. If it stutters on a device, wrap the component in `data-stamp-ink="clean"`.
- The long first frame was measured in the dev build only. I could not measure a production build (the task forbids building).
- Three small paints are not compositor-only: the outline draw (`stroke-dashoffset`), the wash (`r`), and the light sweeps (`mask-position`). Each covers one stamp-sized element for under a second.
- `StatusUpgrade` reads two things the stamp package does not export from its index: `@/components/stamp/geometry` and the outline shapes, which `outline.ts` mirrors from `Stamp.tsx`. It also reuses the `ip-stamp__svg` and `ip-stamp__pendingmark` classes so the animated clock matches the printed one. If the foundation changes a stamp outline or the pending badge, update `outline.ts` and the clock in `InkOverlay`.
- During the ink soak the amber clock sits on the green band for about 0.4s before it pops off. It reads as intended in motion but looks odd in a still.
- Vibration needs a recent tap in Chrome and does nothing on iOS.
- The lab's dev-only Next.js badge overlaps the bottom-left corner in screenshots.
