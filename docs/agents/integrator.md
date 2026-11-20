# Integrator handoff

The composed demo is the home page: `http://localhost:3100/`.
Add `?debug` for a frame-rate read-out and a `window.__ipBook()` handle (used by the test scripts).

It was only ever run in headless Chromium on this Mac. Nothing here has been seen on a real phone,
on iOS Safari, or inside the Instagram, TikTok or Facebook in-app browsers.

## What the page does

1. **Landing.** One-row header (emblem, progress ring "6 of 12 Bohol stamps", art-direction switcher,
   light/dark). The closed passport floats on the lit scene with a hint, "Tap the passport to open it",
   and a subtle "Sample concept demo" tag.
2. **Open and browse.** Tap or drag the cover. Swipe, drag a corner, tap the page edge or use the arrow
   keys. Tap any stamp for the detail sheet (PAS-4). Tap any empty slot to stamp it (free play).
3. **Scripted story**, from the floating action bar. Each step opens the book if needed, riffles to
   the right page, then plays its moment on the page:
   - **Collect a stamp**: `StampPress` into the empty "Turtle nesting beach" slot on Pamilacan. Discovery. The ring ticks 6 to 7.
   - **Donate**: the same stamp becomes "Donation pending" in place (`DonateTransition`), with a notice that explains the charity's page would open. Nothing says "donated".
   - **Charity confirms**: `StatusUpgrade` to Verified Supporter, inside the slot.
   - That makes three Verified stamps, so `ProvincialAward` opens by itself about a second later. "Add to passport" riffles to the Provincial page and the stamp lands in its slot.
   - **Replay demo** closes the book and restores the sample data.
4. The step shown in the bar is derived from the passport data, so there is no separate step state to get out of sync.

## Files (mine)

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Renders `<Demo />` |
| `src/components/demo/Demo.tsx` | Composition, the story, book navigation, lazy loading |
| `src/components/demo/ActionBar.tsx` | Floating bar: steps in their status colours, the main button, note, tools |
| `src/components/demo/DonateTransition.tsx` | Discovery to Donation pending, in the slot |
| `src/components/demo/Notice.tsx` | The message under the header after each moment |
| `src/components/demo/FpsMeter.tsx` | `?debug` frame-rate read-out |
| `src/components/demo/story.ts` | Which slot the story follows |
| `src/components/demo/demo.css` | All styles, prefix `ipd-`, including the layout budget |
| `scripts/scratch/integ-*` | Throwaway test and screenshot scripts |

## How it is wired

- **Book**: `PassportBook` from `engine-lib` with `chrome="bare"` and the content agent's `usePassportContent`. Not wrapped in `next/dynamic`.
- **Navigation**: `ensureAt(page)` opens the book if needed, calls the new `flipThrough(page)` and resolves on `onFlip` (with a time-out, and spread-aware on desktop).
- **Collect**: mounts `<StampPress target={slot .ipp-slot__stamp} surface={float wrapper}>`. Data is committed in `onImpact`, the overlay unmounted in `onComplete`.
- **Donate and confirm** render inside the slot through a new `SlotOverride.render`, so they move with the page. Ink flecks stay beside fresh stamps through `SlotOverride.after`.
- **Award**: `target` is a function. Before landing it returns a rect (80% of the ornate slot, centred); after `onLanded` it returns the real stamp element.
- **While a moment plays**: a transparent layer over the stage blocks swipes (a tap on it skips the status upgrade), and arrow keys are stopped before they reach the book.
- **Loading (UX-7)**: the cover is server-rendered, so there is no skeleton; the cover itself is the first paint.
  The inside pages render at idle or on first touch, `page-flip` loads at idle inside the book, and the three moments are imported by hand at idle and kept in state.
- **Re-renders**: the current page lives in a small store that only the hint reads, and data commits made in the middle of an animation are `startTransition` updates.
- **Layout**: `demo.css` gives the book whatever height the chrome leaves (`--ipb-max-h` from `100svh` minus the header, intro, hint and bar). Measured book sizes: 336x494 at 390x844, 264x388 at 390x664, 267x392 at 360x660. From 1100px wide the bar moves beside the book and the book becomes a two-page spread.

## Changes in files I do not own

| File | Change |
| --- | --- |
| `src/lib/strings.ts` | TEC-12: now holds all copy. Added `content`, `celebrations`, `press`, `flipCustomLab`, `flipLibLab` and `demo` |
| `content/strings.ts`, `celebrations/strings.ts`, `stamp-press/strings.ts`, `engine-custom/strings.ts` | Now one-line re-exports of the matching `strings.*` object, so existing imports keep working |
| `src/app/lab/flip-lib/page.tsx` | Local `L` copy replaced by `strings.flipLibLab`; `window.__book` removed |
| `engine-lib/flip-engine.ts` | Judge fixes and grafts, listed below |
| `engine-lib/PassportBook.tsx` | Same; new props `reducedMotion`, `pastEnd`, `onFlipStart`; new handle methods `flipThrough(page)`, `goTo(page)` |
| `engine-lib/passport-book.css` | `touch-action: pan-y` on the stage; `--ipb-max-h` uses `svh` where supported |
| `content/types.ts`, `content/IslandPage.tsx` | `SlotOverride.render(px, detail)` and `SlotOverride.after(px)`, compared in the page memo |
| `moments/StatusUpgrade.tsx` | Optional `detail` prop, forwarded to `<Stamp />`, so a slot does not change its level of detail when the upgrade takes it over |

The scratch scripts of the flip-lib and judge agents use `window.__book`, which is gone. Mine use `/?debug` and `window.__ipBook()`.

## Judge fixes for the flip engine

| Fix | Status |
| --- | --- |
| Swipe release too strict | Done. Velocity is a recency-weighted average over the last 100 ms, zero if the finger rested 90 ms; flick threshold 0.2 px/ms; commits at 30% of the page width. 35% in 350 ms: 4 of 4 turn (was 0 of 3). 40% in 300 ms: 8 of 8. Decelerating swipes turn from 30% |
| Input dead during the cover swing | Done. Swing is 0.96 s plus a 0.22 s settle (was 1.18 plus 0.27), and a swipe made while the cover is in the air is played when it lands |
| No feedback on the last page | Done. The page lifts against the finger and falls back. A committed swipe, tap or key closes the book and turns it over onto its back cover (`pastEnd="resist"` turns that off) |
| Backward flip reads as a loose sheet (single view) | Done. Tilt down from about 15 to about 3 degrees, curl shading along the returning sheet's fore edge, deeper drop shadow |
| First-use hitch | Addressed, not proven. One invisible dry-run flip at idle warms the library and the back sheet. The first finger drag at 4x throttle ran at 60 fps with no late frame in my runs, but the judge only saw the hitch in 1 run of 3 |
| Phone landscape | Partly. The book now fits between the top of the screen and the bar, but only after the header (not sticky in landscape) has scrolled away. On first paint its lower edge is under the bar |
| Pages exposed to assistive tech while closed | Done: `aria-hidden` as well as `inert` |
| Real devices | Not done. No device here |
| Strings, test handle, `chrome="bare"` | Done |

Also fixed: `tick()` could schedule two animation frames at once after a flip event, doubling the work per frame until the book came to rest.

Ideas grafted: the release decision, closing onto the back cover, a bounce when the cover closes, `flipThrough` riffle (up to four pages, about 1 s), `onFlipStart`, the `reducedMotion` prop on the book, the `?debug` FPS read-out, and a true cross-fade for reduced-motion open and close in single view.

Not grafted: catching a page in mid-air, and a spring settle on landing.

## Where this differs from the brief

- **Ring ticks 6 to 7, not 3 to 4.** The foundation's sample data starts at 6 of 12, which shows all three statuses on the first pages. I left it alone.
- **The story follows one stamp** (`pamilacan-turtle-beach`) through all three statuses, as the brief describes, not the two slots in `DEMO_SCRIPT`.
- **Header is one row.** The pages agent's two-row header cost 50px of book height on a phone. The demo passes `appearance="none"` and puts the switcher in `actions`: swatches on phones, named chips from 760px. On phones the wordmark text is hidden; the cover right below carries the name.
- **No skeleton**, because the cover is server-rendered.
- **The step note under the button is visually hidden on screens under 720px tall** to give the book the room (it stays in the accessibility tree).
- **A reduced-motion switch for the whole demo was not added.** The book has the prop, but the three moments read the device setting directly.

## What I checked

All in headless Chromium against the dev server.

- `tsc --noEmit` and `eslint src`: clean.
- **Story end to end** at 390x844 in classic, reef and journal, light and dark, plus reduced motion, plus 1280x800: every run ends on "Provincial Stamp awarded", page 8, then replays to the start. No console errors or hydration warnings (reduced motion logs Motion's own dev notice).
- **Edge cases**: free-play stamping, detail sheet and Escape, switching direction mid-press and mode mid-donate, swipe blocked during the upgrade, tap to skip, Escape in the award, replay from the tool button, keyboard-only run with focus staying on the button.
- **Labs**: all six routes load clean. `/lab/pages` and `/lab/celebrations` had been serving stale server HTML (SVG stamps, no textures); they refreshed when `strings.ts` changed.
- **Looked at** screenshots of every step in all six direction and mode combinations, the desktop spread, 390x664, 360x660 and landscape, and frame strips of the cover opening and the backward flip.

Frame pacing at 4x CPU throttle, dev build, software GL (`scripts/scratch/integ-perf.mjs 4`):

| Action | Phone 390x844 | Desktop 1280x800 spread |
| --- | --- | --- |
| Cover opens | 58.6 fps, one 67 ms frame at the tap | 58.2 fps, one 83 ms frame |
| Page turns, finger drag | 60 fps, no late frames | 58 to 59 fps, one 33 to 50 ms frame each |
| Story 1 (open, riffle, stamp) | 55 fps, 16 late frames of 258 | 51 fps, 31 late of 239 |
| Story 2 (donate) | 57.6 fps | 57.0 fps |
| Story 3 (confirm) | 58.6 fps | 57.9 fps |
| Award (riffle, flight, landing) | 58.4 fps, one 67 ms frame | 57.4 fps |

In story 1 the cover swing and the riffle are clean. The late frames are one of 67 to 100 ms at the tap, two when the stamper mounts, and a run of 33 ms frames while the stamper canvas draws. The stamp-press agent measured that same canvas at 60 fps with GPU rendering, so I read this as the software rasteriser, but it is the first thing to check on a real mid-range Android.

## Known issues

- **No real-device testing.** Most at risk on iOS and in-app browsers: the cover's `preserve-3d` swing, `clip-path` on promoted layers during flips, the stamps' `filter: url()` ink, container-query units in the pages, `overflow-x: clip`.
- **Dev build only.** Building was forbidden, so there are no production numbers. The long frame at each tap is partly React's dev mode.
- **Landscape phones**: see the table above. The spread is also small there (about 172px per page).
- **Short phones**: at 390x664 the book is 264px wide (68% of the screen). Going bigger means scrolling or dropping the action bar's top row.
- **A long notice covers the top line of the page** (the "Donation pending" one is four lines on a phone). It never covers the stamp.
- **Stepping past the last page closes the book**, including by a tap on the outer edge of the Provincial page. That is the judge's suggestion, but it can surprise. `pastEnd="resist"` on the book changes it.
- **Free play** only collects (Discovery). Donate and confirm exist for the story stamp only.
- **The engine still reaches into `page-flip` internals.** Keep it pinned at 2.0.7.
- **Sample geography and names** (chart outline, coordinates, charities, promoters) are unverified, as the foundation and pages agents noted.
- **`README.md` is still the create-next-app default.**

## Scripts

```
node scripts/scratch/integ-flow.mjs classic light          # story, with screenshots
node scripts/scratch/integ-flow.mjs reef dark rm reduced   # reduced motion
VP=1280x800 node scripts/scratch/integ-flow.mjs classic light desk
scripts/scratch/integ-all.sh                               # all directions and modes
node scripts/scratch/integ-engine.mjs                      # swipe, riffle, last page, keyboard
node scripts/scratch/integ-edge.mjs                        # edge cases
node scripts/scratch/integ-perf.mjs 4 [1280x800x2]         # frame pacing
node scripts/scratch/integ-labs.mjs                        # every lab route
```

Screenshots are written to the session scratchpad under `integ/`.
