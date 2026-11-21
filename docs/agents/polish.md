# Polish round: what changed, what was left, how to show it

This is the current reference for the home-page demo (`http://localhost:3100/`). Where an older file
in `docs/agents/` disagrees with this one, this one is right.

Everything here was checked in headless Chromium on a Mac, against the dev server. Nothing has been
seen on a real phone, on iOS Safari, or inside the Instagram, TikTok or Facebook in-app browsers.
`next build` was never run in this round (the dev server was in use), so there are no production
numbers and the production build itself is untested.

## State at the end of the round

- `pnpm exec tsc --noEmit` and `pnpm exec eslint src`: clean.
- The story (collect, donate, charity confirms, award, replay), twice in a row with Replay, at
  390x844 touch DPR 2 in classic, reef and journal, light and dark: no failed check, no console
  error or warning. Also clean at 360x740, 375x667, 320x568, 412x915, at 1280x800 (spread), and with
  reduced motion (the only log there is Motion's own dev notice that Reduced Motion is on).
- No page scrolls in any story state at those sizes (`scrollHeight === innerHeight`).
- All seven labs (`/lab/stamp`, `/lab/pages`, `/lab/flip-lib`, `/lab/flip-custom`, `/lab/stamp-press`,
  `/lab/celebrations`, `/lab/sound`) return 200 with no console output at 390 and 1280 wide.
- Frame pacing at 4x CPU throttle, dev build, software GL: 57 to 60 fps in every step, worst frame
  67 ms (one, at the Collect tap).

### Story timing, 390x844, from the tap

| Step | What happens | When |
| --- | --- | --- |
| Collect | cover open | 0.65 s |
| | riffle to page 5 lands, stamper appears | 1.5 s |
| | stamp hits the page | 2.2 s |
| | button offers "Donate", toast drops | 2.4 s |
| Donate | ink swaps to "Donation pending" | 0.5 s |
| | button and toast | 0.7 s |
| Charity confirms | seal lands, stamp is Verified | 1.5 s |
| | toast, then "3 of 3 Verified in Bohol" on the button | 1.6 s, 1.8 s |
| | award opens by itself | 3.5 s |
| Add to passport | riffle to page 8 | 0.8 s |
| | stamp lands in its slot | 1.4 s |
| | "Replay demo" and toast | 1.6 s |
| Replay | cover shut, "Collect a stamp" back | 0.8 s |

With reduced motion the same steps take 0.75, 0.4, 1.35, 0.5 and 0.4 s.

## The four items from the first review

| Item | Result |
| --- | --- |
| (a) Next.js "N" badge over the action bar | Gone. `devIndicators: false` in `next.config.ts` |
| (b) Button says "Stamping" for 2 s after the stamp lands | Fixed. The button and toast are scheduled from the stamper's impact, not from the overlay's teardown: "Donate" appears about 0.2 s after the hit |
| (c) "Turtle nesting beach, Pamilacan" beside a page about dolphins | Fixed. The story now follows the "Spinner dolphins" slot; the island text mentions both dolphins and the turtle beach; counts are 2 Verified, 2 pending, 2 Discovery, 6 empty |
| (d) `Cannot read properties of null (reading 'removeChild')` | Cause found and removed: a `<meta name="theme-color">` that React rendered and the theme script also replaced. The meta is now created once by an inline script and only ever updated in place. See below for what was tested |

### What was tested for (d)

The flip library moves the page hosts around, so this was the suspect. It is not the cause: the hosts
are plain `div`s created by `PassportBook`, React only portals into them, and `FlipEngine.destroy()`
hands them back before React unmounts anything.

`scripts/scratch/polish-verify-unmount.mjs` leaves the home page by client navigation and comes back
in seven states (closed, mid cover swing, mid riffle, mid stamp press, mid donate, with a finger
holding a page, with the award open), then triggers hot reload five times in mid-story by touching
`flip-engine.ts`, `PassportBook.tsx`, `Demo.tsx`, `IslandPage.tsx` and `sample-data.ts`. No page
error, no console error, no stray overlay or page host left in the document. Direction and mode
switches mid-press, mid-upgrade and mid-flight, a resize across the spread breakpoint mid-press, and
replay mid-flip also ran clean (`polish-eng-stress.mjs`, `polish-fix-moments-stress.mjs`).

Hot reload was only tried with comment-only edits. An edit that changes a hook list or a module's
exports forces React to remount, which is a different path and was not exercised.

## What changed, by area

### Story and action bar (`src/components/demo/`)

- Fixed waits removed. Each moment reports its visible hit and the demo hands the button back and
  drops the toast a fixed beat later (150 to 250 ms).
- Button labels follow the phase: "Opening your passport", "Stamping", "Marking as pending",
  "Confirming", "3 of 3 Verified in Bohol", "Awarding the Provincial Stamp", "Closing the passport".
- A tap made while the previous overlay is still fading is queued, not lost.
- The steps in the bar are buttons: each puts the sample data at the start of that step.
- Honest-status copy: the Donate note reads "Opens the charity's own page. Nothing is charged here."
  and the pending toast "Nothing is charged here. The stamp upgrades only when {charity} confirms."
- With Reduce Motion on, the hint says so and offers "Play full motion" once (not persisted).
- A tap on the button or the cover before hydration is remembered and replayed.
- Tapping an island on the Province page riffles to its page.
- Bidder name and contact are empty in `strings.app`; filling them in switches on the byline and the page title.

### Flip engine (`src/components/passport/engine-lib/`)

- Phone cover opens in 0.56 s (was 1.25 s) and closes in 0.72 s (was 1.2 s), with a thud and a short vibrate at contact.
- A tap or `next()` turn reports after 0.52 s (was 0.77 s); backward turns show the sheet from the first frame.
- Riffle of four pages: 0.85 s, one `onFlip`.
- Replay from the back cover ends face up on page 1.
- With reduced motion, a swipe that starts on a stamp turns the page; a tap still opens the detail sheet.
- New optional `attract` prop: 1.2 s after mount the closed cover lifts 12 degrees and falls back, once.
- Touches that start within 12 px of the left screen edge are left to the browser (iOS back swipe).
- A rebuild across the one-page / two-page breakpoint lands on the page last asked for.

### Moments (`src/components/moments/`)

- Stamp press: 1.28 s, sweep in, backswing, impact at 0.62, lift; the page jolts at impact.
- Status upgrade: 2.05 s in total.
- Award: opaque backdrop, entrance with overshoot, 111 confetti pieces in three layers, Skip under
  the main button, taps ignored for the first 0.6 s so a tap aimed at the page cannot hit a button.
- "Add to passport": the medallion lifts, the book riffles under it, it lands in the slot and the
  page dips. The real stamp is held invisible until the flyer has settled, so there is no doubled impression.
- At rest the award repaints nothing; the flight is 30 raster tasks (was 200 to 300).

### Stamps, tokens, pages (`src/components/stamp/`, `src/lib/directions.ts`, `passport/content/`)

- Pending and empty are now clearly apart; the pending clock badge is a solid disc.
- Verified is green and pending is amber in every direction; several inks were darkened after
  measuring on the textured paper. Functional text is at least 4.79:1 on pages 1 to 8 in all six themes.
- Detail sheet: focus trap, Escape, focus returns to the stamp, fits 390x844 without scrolling.
- Cover light: nothing animates or repaints while the closed cover is at rest on a touch device.
- Journal lettering stays legible (the rough-edge filter no longer distorts small type).
- Stamp level of detail is chosen from rendered size: under 120 px a stamp drops its date and handle.

### Shell (`src/components/demo/demo.css`, `src/app/`)

- One screen, no scrolling, from 320x568 up; landscape phones still scroll.
- The notice has its own reserved space on tall phones; on desktop it sits above the card.
- "Simulate: charity confirms" is an outlined button, so it does not read as the traveler's action.
- 44 px touch targets on the switcher, mode toggle, sound and replay tools and the stepper.
- `icon.svg`, a share card at `/opengraph-image`, real metadata, a real README; the create-next-app leftovers are deleted.

### Fixed by the verifier

| Fix | File |
| --- | --- |
| An ink fleck landed in the gap of the caption and read as "SPINNER.DOLPHINS". Flecks no longer land below the stamp's box | `moments/stamp-press/InkSpeckles.tsx` |
| With reduced motion the award's "Add to passport" was visible but dead for 0.6 s. The guard is 0.3 s there | `moments/ProvincialAward.tsx` |
| At 320 px wide the pending toast was cut before "confirms". Three lines are allowed under 340 px | `demo/demo.css` |
| After a keyboard jump from the Province page, focus fell to `<body>`. It now moves to the open pages | `demo/Demo.tsx` |
| `navigator.vibrate` before any tap logs an error in Chrome. Both helpers now check `userActivation` first | `celebrations/haptics.ts`, `stamp-press/feedback.ts` |
| `/lab/flip-custom` overflowed by 5 px at 390 wide | `app/lab/flip-custom/page.tsx` |
| Share-card text was a constant in the component | `strings.app.shareKind` |
| Stale story references | `lib/types.ts`, `docs/agents/integrator.md` |

## Deferred, and why

| Item | Why it was left |
| --- | --- |
| Story button tapped with a second finger while the first holds a page fold: the moment plays on the half-turned page | Two-handed edge case. A clean fix needs a new "let go of the page" method on the book handle |
| Notice overlaps the top 27 px of the book on screens under 800 px tall (the running head, never the title or a stamp; at 320 px it touches the title) | Reserving the space costs about 26 px of book width on exactly the phones where the book is smallest |
| Book is 322 px wide at 390x844 (was 336) | The price of the notice space and the two-line note. Stamps on island pages are now 117 px, so they render in compact detail there (no date or handle); the detail sheet and the desktop spread show both |
| Step note is hidden under 800 px of height | Gives the book 312 px at 360x740 instead of 251 |
| Landscape phones scroll and the spread is small | Not a pitch scenario |
| Island rows on the Province page are 23 px tall with a 32 px hit area | Taller rows shrink the chart |
| Island buttons are labelled "Pamilacan: 1 of 2 stamps, page 5", not "Go to Pamilacan" | Works for screen readers as it is |
| The device-tilt branch of the cover light | Headless Chromium sends no orientation events; it has never run |
| `reducedMotion={false}` forced on the moments while the device asks for reduced motion ("Play full motion") | The book and the press were watched; the award's forced path was not |
| `/lab/celebrations` does not pass `surface`, so the page does not dip there | It does on the home page |
| `HINT_BUTTON` sets `color: inherit` inline and `demo.css` overrides it with `!important` | Cosmetic |
| The older files in `docs/agents/` | Each now carries a note pointing here; their timings and layout numbers were not rewritten |
| Catching a page in mid-air, spring settle on landing | Same as before this round |

## Remaining risks

1. **No real device.** Highest risk, in order:
   - iOS Safari and the in-app browsers (all WebKit on iOS): the cover's `preserve-3d` swing,
     `clip-path` on promoted layers during flips, the stamps' `filter: url()` ink, container-query
     units in the pages, `overflow: clip`, `100svh` with the in-app browser's own bars.
   - iOS has no `navigator.vibrate`. The haptic part of UX-3 is Android only, and the code says so.
   - The left-edge guard for the iOS back swipe is 12 px and was only simulated.
   - Sound needs a tap first and, on iPhone, the silent switch off (or the option in `/lab/sound`).
2. **Mid-range Android.** The stamper canvas is the heaviest part: it is the only place with runs of
   33 ms frames at 4x throttle on software GL. Check the Collect step first.
3. **Dev build only.** The first tap of each kind carries React's dev overhead. A production build
   should be faster but has not been made or measured in this round. Do it before sharing a link.
4. **In-app browser viewport.** The one-screen layout is budgeted from `100svh`. If an in-app browser
   reports a height that includes its toolbar, the action bar's lower edge could sit under it.
5. **Fonts and textures on a cold 4G load.** Cinzel and the cover texture are preloaded; the other
   display faces swap in. In the dev build at "Fast 4G" with 4x CPU, a tap made at 0.9 s was answered
   at about 2.6 s, when the page had hydrated. UX-7's 3-second target has not been measured on a production build.
6. **Share card font** is fetched from Google Fonts at render time (3 s timeout, then a built-in face).
7. **`page-flip` internals.** The engine reaches into the library. Keep it pinned at 2.0.7.
8. **Sample content** (chart outline, coordinates, charities, handles ending in `.sample`) is fictional and unverified.
9. **`?debug`** draws a frame-rate badge over the lower-left of the book. Do not present with it on.

## Before a call

- Use a real phone if at all possible, in the browser the evaluator is likely to use, and run the
  story once beforehand so the moments are loaded.
- Start from a fresh load of `/` (no `?debug`). Reduce Motion off. Sound is off by default; turn it
  on with the speaker button in the bar only if the room can hear it.
- If anything looks stuck, the circular-arrow button in the bar resets the demo.

## 60-second walkthrough

Times are when to tap. The animations take about 11 seconds in total; the rest is for talking.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Nothing. The cover lifts once by itself | "This is the traveler's passport. It runs in the phone browser, no app install. Six of twelve Bohol stamps so far, up in the ring." |
| 0:06 | Tap **Collect a stamp** | "A traveler arrives from a promoter's link. The passport opens, turns to Pamilacan, and the stamp is pressed onto the page. That is a Discovery stamp. The ring goes to seven." |
| 0:16 | Tap **Donate** | "They tap Donate. The charity's own page would open. The same stamp changes to Donation pending. We never show it as donated, because nothing has been confirmed yet." |
| 0:24 | Tap **Simulate: charity confirms** | "Later the charity confirms the donation. The traveler does nothing. The stamp upgrades in place to Verified Supporter." |
| 0:29 | Wait. The award opens by itself | "That was the third Verified stamp in Bohol, which is the threshold, so the Provincial Stamp is awarded automatically." |
| 0:34 | Tap **Add to passport** | "It goes into the passport on its own page." |
| 0:39 | Swipe back two pages, slowly, holding one page half-turned for a moment | "Pages follow the finger. This is the StPageFlip library with our own shading and timing on top." |
| 0:45 | Tap any stamp, then close the sheet | "Tap a stamp for island, promoter, charity, purpose, date and status." |
| 0:50 | Tap the second swatch in the header, then the third, then the sun/moon | "Three art directions and light and dark from one set of tokens. The owner picks the look; the motion stays." |
| 0:57 | Tap the circular arrow in the bar | "Replay puts it back. The map fly-to is the one motion piece not in this demo." |

If you only have 20 seconds: Collect, Donate, Confirm, wait for the award, Add to passport.

If asked about accessibility or older phones: turn on Reduce Motion in the phone's settings and
reload. The same story plays with fades only, and the hint offers the full motion once.

## Scripts from this round

All under `scripts/scratch/`, all against the running dev server.

```
node scripts/scratch/polish-verify-story.mjs classic light           # story twice with Replay, with checks
node scripts/scratch/polish-verify-story.mjs reef dark reduced       # reduced motion
VP=1280x800 node scripts/scratch/polish-verify-story.mjs classic light
node scripts/scratch/polish-verify-labs.mjs                          # every lab, phone and desktop
node scripts/scratch/polish-verify-unmount.mjs                       # leave and hot-reload mid-motion
node scripts/scratch/polish-verify-sheet.mjs                         # browse, detail sheet, themes, free play
node scripts/scratch/polish-verify-misc.mjs                          # keyboard focus, reduced-motion award tap
node scripts/scratch/polish-motion-story.mjs classic light verify    # screencast, then polish-motion-sheet.py
node scripts/scratch/polish-perf-story.mjs 4                         # frame pacing at 4x CPU
```

Screenshots and contact sheets are in `scripts/scratch/polish-verify-out/`.
`polish-verify-unmount.mjs` appends a comment to five source files and restores them; do not run it
while someone is editing those files.
