# Part 2: the cover globe, opening to an island, discreet partners

Brief (Client_Brief_Demo_v2.md, "Passport cover"): the same globe on the passport's front, touring the
islands the traveler has collected, zooming in and out; the passport opens to the selected island's
page; sponsors on the front cover, placed discreetly; three options to show the client.

Where to look:

- `http://localhost:3100/passport` : the demo, now with the globe as the first thing on the cover.
- `http://localhost:3100/lab/passport-cover?direction=classic|reef|journal&island=bohol|balicasag|pamilacan|banacon&tour=off`
  : the passport with its cover globe and nothing else, with switches (island, tour on/off, reduced
  motion) and a read-out of the controller's state.

The three options are the three existing art directions. The switcher in the header of `/passport`
changes them live; the map is restyled, not rebuilt.

Everything was checked in headless Chromium on a Mac against the dev server (real GPU through
Metal for motion, 390x844 touch DPR 2 and 1280x800). Nothing was seen on a real phone, on iOS
Safari or in an in-app browser. `next build` was not run.

## What it does

1. **Cover globe.** The emblem on the front cover is replaced by a round window with a live MapLibre
   globe (the shared `<Globe>`), framed per direction. Until the map's first frame, and when there is
   no WebGL, the window shows the engine's SVG poster in the same colours.
2. **Tour.** For the sample traveler the globe visits the islands that hold a stamp, in page order:
   Bohol, Balicasag, Pamilacan, Banacon. It rests on the turning planet, dives to the first island,
   rests, pulls back until the neighbouring islands are in view, dives to the next, and after the
   last one rises to the planet again. One round is about 31 s.
3. **Lettering.** Under the window, in the cover's own foil or ink: the status line
   ("Verified Supporter · 2 of 3") and the island's name. On the planet it reads
   "Environmental stamps / Bohol", as the printed cover did. The line changes as the camera sets off.
4. **Picking an island.** Drag the globe to spin it (the tour stands down and resumes 6 s after the
   last touch). Tap an island on the globe, or one of the small dots under the name (one per island
   with a stamp), to pick it: the camera goes there and stays 11 s before the tour moves on.
5. **Opening.** Under the book the hint is now a button: "Open to Bohol", always naming the island
   the globe shows or is heading for. Tapping the cover (anywhere but the globe, the dots and the
   partner marks), pulling it open by its edge, Enter on the cover, or the button all open the
   passport to that island's page: cover swings, two pages riffle, the island page settles.
6. **Continuity.** As the cover starts to move, the globe's view lifts out of the window as a small
   round lens, hangs over the pages while they turn, and drops onto the locator map at the top of
   the island's page. The locator pulses and the island's stamps are ringed for 2.3 s.
7. **Closing.** The cover comes back showing the island of the page the book was closed from, and
   the tour resumes there.
8. **Partners.** Along the foot of the cover: "In partnership with" in tiny caps and three small
   marks. Hovering, focusing or tapping a mark puts its name in place of the label for a moment.
   The names and marks are invented (see "Partners").

The scripted story (collect, donate, charity confirms, award, replay), the page flips, the detail
sheet and the direction switcher work as before. A story step that opens the book does it without
the lens and goes to its own page.

## Files

New, all under `src/components/passport/cover-globe/`:

| File | What it is |
| --- | --- |
| `controller.ts` | `CoverGlobeController`: the tour, the pauses, the still image. No React. All tour timings are in `TOUR` |
| `CoverGlobeFace.tsx` | What goes on the cover: window with `<Globe>`, frame, lettering, dots, partner strip |
| `CoverOpenCta.tsx` | The "Open to ..." button and the compact map credit, for outside the cover |
| `useCoverBook.ts` | Wires a controller to a `<PassportBook>`: freeze and unfreeze, open-to-island, page following |
| `lens.ts` | The flying lens (plain DOM and Web Animations). Timings in `LENS` |
| `map-style.ts` | One map look per direction, and the poster and window colours |
| `frames.ts` | SVG masks of the classic ring and the journal rose, and the three partner marks |
| `stops.ts` | `coverStops(passport, pages)`: which islands the globe visits |
| `warm.ts` | Tile prefetch for the stops (copied from `src/options/a/prefetch.ts`, retuned for a small window) |
| `cover-globe.css` | All styles, prefix `ipcg-` |
| `lab/CoverLab.tsx`, `lab/cover-lab.css` | The lab page's component |
| `src/app/lab/passport-cover/page.tsx` | The lab route |
| `scripts/scratch/p2-cover-*` | Throwaway: screenshots, film strips, behaviour checks, frame pacing |

Changed in files that are not mine (all additive, defaults unchanged):

| File | Change |
| --- | --- |
| `passport/content/Cover.tsx` | `FrontCover` takes an optional `globe` node. With it the emblem, the two lines under it and (journal) the imprint and the "No." line give way to the globe; the frame gets `data-globe` and `role="group"`. Without it the cover renders exactly as before |
| `passport/content/types.ts`, `buildPassportPages.tsx` | `BuildPassportOptions.coverGlobe`; `usePassportContent` returns `locateIsland(islandId)` (pulses an island page's locator, as a jump from the province page does) |
| `components/demo/Demo.tsx` | Mounts `useCoverBook` and the face; the hint row shows the open button while the book is closed; highlights stamps on arrival; story steps open the book through `cover.scripted()` |
| `components/demo/demo.css` | A few rules for the hint row |
| `lib/strings.ts` | `strings.coverGlobe`; `demo.intro` now describes the globe |
| `app/passport/page.tsx` | Light stage by default (see "Light stage") |

Not touched: `src/options/**`, `src/components/globe/**`, the flip engine.

## Architecture

```
Demo (or CoverLab)
  useCoverBook(...)  -> controller, onOpenChange, onStateChange, onFlip, onFlipStart, prepare, open, scripted
  <PassportBook cover={<FrontCover globe={<CoverGlobeFace controller />} />} ... />
  <CoverOpenCta controller onOpen={cover.open} />
```

- **One globe.** `CoverGlobeFace` is the only `<Globe>` on the page. `FrontCover` renders it as the
  child straight after the body in every direction, so switching direction changes the map's style
  (`map.setStyle`) and the frame, and the WebGL context stays. The behaviour script checks that the
  canvas element is the same one before and after a switch.
- **The controller drives the globe through its public handle only** (`flyToIsland`, `resetView`,
  `snapshot`, `stop`, `map()`). Two settings go through MapLibre's public API in `mapReady()`:
  `setMinZoom(-1.5)` (the whole planet only fits a window this small below the engine's minimum zoom
  of 0.4) and `cancelPendingTileRequestsWhileZooming = false`. The tour starts only after that
  re-framing has been applied.
- **State** is a small store (`subscribe` / `getState`) read with `useSyncExternalStore` by the
  face and the button, so the demo itself does not re-render when the tour moves on.
  `focusId` is the island the lettering and the button refer to; `view` says whether the lettering
  shows the province or the island; `phase` is `boot | planet | travel | island | user | held`.
  The face mirrors them as `data-phase`, `data-view`, `data-status`, `data-frozen`, `data-pinned`
  on `.ipcg` (used by CSS and by the test scripts).
- **Gestures.** The window stops pointer and key events from reaching the cover (React
  `stopPropagation`) and carries `data-no-open`, so a drag spins the globe and never takes the cover
  by its edge, and a tap on it never opens the book. Dots and partner marks are buttons, which the
  book already leaves alone.

### The tour (`controller.ts`)

One `async` loop with an epoch counter: anything that should stop it (`halt()`) bumps the epoch,
clears its timers and calls `globe.stop()`, and every `await` checks the epoch afterwards.

| Step | How | Time |
| --- | --- | --- |
| Planet rest | own `requestAnimationFrame` loop moving the centre west, eased in and out | 1.5 s first time, then 2.6 s at 15 degrees/s |
| Dive | `flyToIsland(id, { speed: 0.86, fill })` | engine-derived, about 2.5 to 3 s |
| Island rest | timer | 3.4 s (11 s when the visitor picked the island) |
| Pull back | `flyToIsland(next, { zoom: 6.7, speed: 0.8 })`, then 0.26 s at the top | about 1.5 to 2 s |
| Rise | `resetView({ speed: 0.8 })` after the last island | about 2 s |

`fill` is 0.62 of the window (it is a circle, so less than the engine's 0.72), and 0.46 for islets
under 8 km2, which would otherwise be a featureless disc.

Pauses:

- **Visitor touches the globe** (`onUserInteraction`): phase `user`, resume 6 s after the last
  touch or the end of the last drag, with the island after the one last shown.
- **Cover out of sight or tab hidden** (IntersectionObserver on the window, `visibilitychange`):
  halted, resumed where it was.
- **Passport not closed** (`freeze()` from the book's `onStateChange`): see below.
- **No WebGL** (`status: "fallback"`): only the lettering and the button move on, every 4.6 s, over
  the static poster.
- **Context lost**: halted until the engine reports `ready` again.

### Freezing: nothing renders in WebGL while the book moves

`freeze()` runs when the book leaves `closed` (the moment the cover starts to swing, or a finger
starts to pull it). It halts the tour and asks the engine for a PNG snapshot. When the image has
loaded, the face shows it between the map and the sphere shading and hides the canvas
(`data-held`), about 60 ms after the tap; until then the canvas shows its last frame. From then on
the cover swing, the riffle and every page turn happen with the map idle.

While the book is open, `useCoverBook.onFlip` waits 450 ms after a page has landed (and checks that
no page is in the air), then calls `showIsland(id)` for the island page that is showing: the hidden
map cuts to that island and the still is renewed once its tiles are in. `unfreeze()` on `closed`
swaps the live map back in and the tour resumes on that island.

### Opening to the island (`useCoverBook.ts`, `lens.ts`)

1. `prepare()` on pointerdown or Enter (capture, over the stage) parks the pages under the closed
   cover two before the focus island's page (`book.goTo`), so the book always opens with a short
   riffle.
2. The book reports the intent (`onOpenChange(true)`). Unless a story step is driving
   (`scripted()` / `isBusy`), the lens is launched from the window's rectangle and `travel(page)`
   (the host's "open if needed, then `flipThrough`") is called one task later.
3. When the page has landed the lens drops onto `.ipp-island__locator` of that page; at touch-down
   `onArrive(stop)` pulses the locator and rings the stamps (`SlotOverride.highlight`).

Measured on `/passport`, phone, classic, from the click:

| Moment | ms |
| --- | --- |
| Cover starts, lens leaves the window, map frozen | 10 |
| Still image in place, canvas hidden | 70 |
| Cover open | 620 |
| Riffle of two pages lands | 1130 |
| Lens touches down, locator pulses, stamps ringed | 1580 |
| Lens gone | 1870 |

On a desktop spread the cover swing is longer (about 1.3 s) and the book slides sideways as it
opens, so the lens first rises over the cover and is re-aimed at the page when the book reports
`open` (`retarget`, 320 ms).

After a pull (the cover is already in the air when the intent is reported) the lens fades in at
its hover point instead of leaving the window.

Lens timings (`LENS`): lift 560 ms, landing 430 / 440 / 360 ms (classic / reef / journal), fade
240 ms, ring 760 / 900 / 520 ms.

### Reduced motion

- No spin and no flights: the window is veiled in the sea colour (340 ms), the camera cuts, the
  veil lifts; each view is held 5.2 s.
- No lens. The book's own reduced-motion path (cross-fade, immediate page change) is used; the
  stamps are still ringed (the ring's animation is already disabled by the pages' own rule).
- The hint row keeps the open button and puts "Play full motion" beside it. The map engine reads
  the device setting itself, so with "Play full motion" the book and the lens move in full while
  the globe keeps its gentle cuts (`reducedTour`).

## Per-direction treatments

| | Classic | Reef | Journal |
| --- | --- | --- | --- |
| Frame | Foil compass ring pressed into the leather: bevel ring, degree ticks, eight compass points, drawn as the emblem is (impression shadow, lit edge, foil through one mask). The foil follows the light with the rest of the cover | Brass porthole: bezel with bolts in real gradients (inline SVG), a ring of the cover's own stitching round it | Compass rose rubber-stamped in the cover's ink, roughened by a displacement filter and dry specks, pressed 7 degrees off square |
| Window | Sunk into the leather: deep inner shadow from above, lit lower edge, faint leather grain over the rim | Glass: a curved highlight top left, a small reflection bottom right, teal inner shadow | A hole punched through the board onto the first page: the notebook's grid ruled across it |
| Map | Lapis sea, gilded land, pale gold island glow | Lagoon aqua, sand, coral island | Pale wash and tan on paper, rust ink island |
| Lettering | Foil caps with diamond ornaments | Coral small caps, foil Fraunces name | Typewriter, in the cover's ink |
| Partners | Blind embossed, a breath of foil; full foil when touched | Tone on tone thread; coral when touched | Small ink stamps; darker when touched |
| Lens | Gilded: steady glide, one band of light, one foil ring on landing | Bubble: small overshoot, bobs, lands in two ripples | Paper cut-out: tilts, comes down like a rubber stamp, ink ring |

Cover layout with a globe (design units, 360 to the cover's width): the title is set a little
smaller and higher; classic window 176 units across in a 232 box, reef 169 in 222, journal 150 in
198 (its label keeps the title, province and traveler; the passport number is inside the book).
On a 390x844 phone the window is about 158 px (classic), on 1280x800 about 190 px.

## Partners

`strings.coverGlobe.partners`: "Visayas Tourism Board", "Coral Trust", "Bohol Dive Co.". The marks
(`frames.ts`, `PARTNER_MARKS`) are three abstract drawings: two sails over a hull line, a coral
branch, a diamond with a wave and a bubble. All invented for the demo; I did not check the names
against real organisations, so check before showing them outside a pitch. The lab prints
"Sample partners. Names and marks are invented."

## Light stage

`/passport` and the lab now default to the light stage: an inline script after the theme boot
script sets `data-theme="light"` when the visitor has not stored a choice (the boot script follows
the system setting, which put dark-mode laptops on the dark stage). The mode toggle still works and
is remembered. Other routes are unchanged.

## Map credits

The window is too small for the engine's credit line, which is hidden there. A compact "©" beside
the open button opens to "Map © OpenStreetMap contributors, OpenFreeMap" with both links (the lab
has the same). It is only on screen while the book is closed, which is when the map is.

## Measured

Frame pacing on `/passport`, phone 390x844 DPR 2, classic, real GPU, CPU throttled 4x, dev build
(`scripts/scratch/p2-cover-perf.mjs 4`):

| | fps | frames over 34 ms | worst |
| --- | --- | --- | --- |
| Dive to an island | 59.7 | 0 | 33 ms |
| Rest on an island | 60 | 0 | 17 ms |
| Pull back and dive | 59.8 | 0 | 33 ms |
| Open to island (cover, riffle, lens) | 53.9 | 1 | 300 ms in the first run of a browser; 117 to 133 ms afterwards |
| Page turn while open | 60 | 0 | 17 ms |
| Close | 60 | 0 | 17 ms |
| Planet rest (spin) | 60 | 0 | 17 ms |

The one long frame is at the tap, before anything moves. With the still image, the page parking
and the lens all switched off it is 83 to 100 ms on the same runs (the sound engine's first
AudioContext and React's dev mode), so the cover adds about 20 to 30 ms there at 4x. Unthrottled
it is one 50 ms frame.

This is main-thread cost on a laptop GPU. It says nothing about a phone's GPU.

Behaviour (`scripts/scratch/p2-cover-behaviour.mjs`, 40 checks): ready, one canvas, tour, dot pick,
partner reveal, drag, cover tap opens to the picked island, lens, highlight, page following,
close and resume, same canvas after a direction switch, the whole story with no lens, replay, no
console output. Passed for classic and reef on the phone, journal on the desktop spread, and reef
with reduced motion.

Also checked: 360x740, 320x568, 412x915 dark, 1280x800 dark (no scrolling, nothing overlapping);
no WebGL (poster, lettering cycles, the button works); every lab route and `/` load clean; leaving
`/passport` and coming back leaves one map and no errors. `tsc --noEmit` and `eslint src`: clean.

## Known issues

1. **No real device.** Most at risk on iOS: a WebGL canvas clipped to a circle inside the cover
   (both `border-radius` and `clip-path` are set), the cover's 3D swing with the still image on it,
   SVG data-URL masks with a filter inside (the journal rose), `color-mix`.
2. **Before hydration the cover is drawn in the classic layout** whatever direction is stored (the
   server does not know the stored direction; the material and colours come from the boot script).
   This was already so for the printed cover; with the globe it also means the poster is in the
   classic colours for that moment. Normally well under a second; on a machine under heavy load it
   was visible for several seconds.
3. **Islets are plain shapes.** Balicasag and Pamilacan are a few hundred metres across; at the
   window's size they are an outline on open sea. `fillFor()` in `controller.ts` sets how large.
4. **No coastline hairline.** The tiles cut water polygons at tile edges and an outline shows those
   cuts as stray lines, so land and sea are told apart by colour only. The journal map would like
   an inked coast; it would need a coastline source of its own.
5. **Danajon Bank is not on the globe** (no outline in the island data), so it has a page but no
   stop. In the sample data it holds no stamp, so the tour is not missing it yet.
6. **Dots and partner marks are small targets** (about 21 x 22 px and 14 px with a 27 px hit area
   on a 390 px phone). They are secondary controls; the button under the book is the main one.
7. **Controls inside a `role="button"`.** The book's cover is a button and now contains buttons.
   Screen readers reach the same actions through the "Open to ..." button outside the cover; the
   nesting itself is not valid ARIA.
8. **`prepare()` moves the hidden pages on every pointerdown over the closed book**, including a
   touch on the globe. Invisible, and a story step still goes to its own page, but `getPage()` on a
   closed book is no longer always 0.
9. **The page-following cut happens 450 ms after a page lands.** A reader who turns again within
   that time skips it (by design); one who turns exactly as it runs gets a map render (a 150 px
   canvas, tiles cached) during the turn. Not seen in the frame pacing.
10. **A still image taken mid-flight is what the lens carries** if the passport is opened while the
    camera is travelling. The cover and the lens agree; the lens just shows sea and a coast instead
    of the island.
11. **Sample content.** Partner names, marks, island statuses and counts are sample data.

## Checker pass (independent test, fixes)

Tested again from scratch on `/passport` and the lab: three directions at 390x844 touch, 1280x800
and 800x600, plus 320x568, dark mode, no WebGL, reduced motion and 4x CPU throttle. Scripts:
`scripts/scratch/p2-cover-check-*`. What was found and changed:

1. **Direction switched while the passport was open: the cover came back in the old colours.**
   The still image on the cover was taken in the previous direction, so the closing cover showed
   (for example) the navy and gold map inside the reef porthole for about 0.7 s, then popped.
   `controller.restyled()` (called by the face when the direction changes) now renews the still.
2. **The map did draw while pages turned.** Measured by counting WebGL draw calls: opening while
   the camera was in flight, and turning a page within about a second of the previous one landing,
   both left MapLibre rendering (tiles arriving, fades) through the swing or the flip. Now the
   controller holds the map's frames back while the book is open (`holdFrames` / `releaseFrames`:
   `map.triggerRepaint` is shadowed on the instance; no engine change). Frames are let through
   only to take a still (one frame as the cover starts to move) and, with the book at rest, to
   follow the page that is showing; `bookMoving()` on every flip start stops that at once.
   Measured after the change: 0 draw calls during the cover swing (after the one still frame),
   the riffle, page turns and the close.
3. **Closing straight after a page turn could bring the cover back on an earlier island.**
   `bookClosing(islandOfThePage)` sets the focus to the island of the page the book is closed
   over, cuts the hidden camera there and renews the still with the next frame.
4. **`?island=` in the lab was ignored** (and so was a tap on a dot before the map was ready): the
   tour's first start overwrote the pick. Fixed in `sync()`.
5. **Neighbouring islands could not be tapped on a phone.** The engine marks and hit-tests rank 2
   islands from zoom 6.8 only, and in a 150 px window Bohol's own view is below that, so Balicasag
   and Pamilacan were unmarked specks. The cover now hands its stops to the globe as rank 1: they
   are marked dots in every view and a tap (16 px tolerance) picks them. From far out the four are
   one dot; a tap there means the first stop (`selectOnMap`, `TOUR.apartZoom`).
6. **Double tap on the globe** asked MapLibre to zoom around a point, which it cannot do on a
   globe (console warning, zoom about the centre). Double-tap zoom is off on the cover map
   (`tuneGestures`, re-applied each time the engine re-enables gestures).
7. **No way to close the open passport except swiping back past page one or Escape.** The hint
   row under the open book now ends in a "Close" word (`strings.demo.close`); the cover returns on
   the island of the page it was closed from and the tour resumes there.
8. **Partners were at the edge of invisible** (label 4.8 px on a phone, marks at 16 % foil). Label
   6.4 units, marks 17.5 units, a little more foil/ink. Still the quietest thing on the cover.

Still true after this pass: known issues 1, 2, 4, 5, 7, 8, 11 above. Issue 3 changed (islets now
carry a marker dot until the camera is on them), 6 is eased for the partner marks only, 9 no
longer applies (a flip stops the map), 10 is unchanged (the lens carries the in-flight view).
One new cost: closing before the map has followed the last page turn takes one extra still at
the start of the swing (one 50 ms frame at 4x CPU throttle, none unthrottled).


## Scripts

All in `scripts/scratch/`, against the running dev server. Output goes to the session scratchpad
(`P2_OUT` overrides).

```
node scripts/scratch/p2-cover-behaviour.mjs classic mobile          # 40 checks
node scripts/scratch/p2-cover-behaviour.mjs journal desktop
node scripts/scratch/p2-cover-behaviour.mjs reef mobile reduced
node scripts/scratch/p2-cover-film.mjs open-classic classic mobile open /passport   # screencast
python3 scripts/scratch/p2-cover-sheet.py open-classic -100 2700 100 10 0.42 0,0.08,1,0.78
TOUR_MS=34000 node scripts/scratch/p2-cover-film.mjs tour classic mobile tour /passport
node scripts/scratch/p2-cover-stills.mjs mobile stills              # 3 directions x planet, Bohol, Balicasag
node scripts/scratch/p2-cover-timing.mjs classic /passport          # timeline of an open
node scripts/scratch/p2-cover-perf.mjs 4 classic mobile             # frame pacing
node scripts/scratch/p2-cover-sizes.mjs                             # small screens, dark, no WebGL
node scripts/scratch/p2-cover-routes.mjs                            # every route loads clean
```

`GPU=0` switches the scripts to software WebGL.
