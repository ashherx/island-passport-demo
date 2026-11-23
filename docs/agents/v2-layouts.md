# v2 layouts handoff: the layout system and the "horizon", "orb" and "full-bleed" layouts

The presentation is no longer a choice between design options A, B and C. The look stays option A ("Daylight Atlas"); what the visitor switches between is the **layout** of the landing: where the headline, the search and the globe sit, where the island card lives, and how the flight to an island feels.

Built so far: `split` (the landing as it was), `horizon` (Dan's sketch 1, the default), `orb` (Dan's sketch 2, "Centred orb": see the "Orb" section) and `fullbleed` (the map as the whole page, with a tilted landing: see the "Full-bleed" section). Planned next, one at a time: an island carousel and a scroll story.

## How to view

| URL | What |
| --- | --- |
| `http://localhost:3100/` | Horizon (the default) |
| `http://localhost:3100/?layout=split` | Split |
| `http://localhost:3100/?layout=horizon&island=bohol` | Deep link: starts on the horizon and flies to Bohol |
| `http://localhost:3100/?layout=orb` | Orb |
| `http://localhost:3100/?layout=orb&island=bohol` | Deep link: starts on the orb and flies to Bohol |
| `http://localhost:3100/lab/option-a` | Option A alone, same query parameters |
| `http://localhost:3100/?layout=fullbleed` | Full-bleed |
| `http://localhost:3100/?layout=fullbleed&island=bohol` | Deep link: starts on the full-bleed landing and flies to Bohol |
| add `&themes=1` | Brings back the A · B · C design-option pill (hidden otherwise) |

The "Layout" pill is top right: a segmented control from 1280px (it was 1100px with three layouts: four are about 400px wide, which a docked search only clears from 1280), a compact button that opens the list below that. On a phone it is hidden while an island card is open.

**The dev server was not running while split and horizon were built** (nothing was listening on port 3100, and starting one was not permitted). They were verified against a static bundle of option A in headless Chromium (see "Test harness"), not against Next. The orb layout was built and tested against the real dev server on port 3100, and horizon and split were checked again on it then (see "Orb", "Checks").

## Files

| Path | What it is |
| --- | --- |
| `src/lib/options/layouts.ts` | **New (shared).** Layout ids, order, default, the `?layout=` and `?themes=` query names, the storage key |
| `src/lib/options/boot.ts` | **Changed (shared).** The boot script also stamps `<html data-layout>` before first paint |
| `src/lib/options/strings.ts`, `index.ts` | **Changed (shared).** Switcher strings; exports |
| `src/components/options-ui/OptionStage.tsx`, `index.ts` | **Changed (shared).** The A · B · C pill renders only with `?themes=1`; `useThemesSwitcher()` |
| `src/options/a/index.tsx` | The shell: all state, the globe, the card, the open and close sequence. Layout-agnostic |
| `src/options/a/layouts/types.ts` | What a layout module provides (`LayoutModule`) |
| `src/options/a/layouts/state.ts` | `useLayout()`: which layout is on screen, URL and storage |
| `src/options/a/layouts/index.ts` | The registry |
| `src/options/a/layouts/split.tsx` | Layout "split" |
| `src/options/a/layouts/horizon.tsx`, `horizon.css` | Layout "horizon" (and the docked card's styles, which any layout with `card: "dock"` uses) |
| `src/options/a/layouts/orb.tsx`, `orb.css` | Layout "orb" |
| `src/options/a/layouts/fullbleed.tsx`, `fullbleed.css` | Layout "fullbleed" |
| `src/options/a/photos.ts` | Fetches a card's lead photo ahead of the card (see "Fixes for all layouts", the photo) |
| `src/options/a/LayoutSwitcher.tsx` | The pill |
| `src/options/a/parts.tsx` | Pieces every layout arranges: wordmark, headline, island chips, hint |
| `src/options/a/camera.ts` | Island zoom the way the engine fits it; reading a flight's progress back from the map; the planet's size on screen; the engine's dive curve inverted |
| `src/options/a/tiles.ts` | Keeping the dive sharp (see "Fixes"), and the backdrop for the way home (see "Orb") |
| `src/options/a/Card.tsx` | `CardHero` extracted; optional expand button in `CardHead` |
| `src/options/a/atlas.css` | Shared styles and the split arrangement (the base). Additions: switcher, veil, layout swap, first-paint rules |
| `scripts/scratch/v2-horizon-*` | Throwaway test scripts and the static harness |
| `scripts/scratch/v2-orb-*` | Throwaway test scripts for the orb layout (they run against the dev server) |
| `scripts/scratch/v2-fullbleed-*` | Throwaway test scripts for the full-bleed layout and the photo fix (dev server) |

Nothing in `src/components/globe`, `src/options/b` or `src/options/c` was touched.

## The layout system

**State.** `useLayout()` returns `{ layout, setLayout }`. Order of precedence on load: `?layout=`, then `localStorage["ip.layout"]`, then the default (`horizon`). `setLayout` writes storage and replaces the URL query without a navigation, so the address bar is always a link to what is on screen. The selected island is not involved: it stays in the option provider, so it survives a switch.

**First paint.** The server renders the layout named in the URL (read with `useSearchParams`), else the default. The boot script puts the visitor's resolved layout on `<html data-layout>`. If that differs from what the server rendered (a stored layout and no `?layout=` in the URL), `atlas.css` keeps the landing invisible until React swaps it, the same rule the option system uses. Since a switch always writes `?layout=`, this only happens on a bare `/` with a stored non-default layout.

**The shell and the modules.** `index.tsx` owns everything that is the same in every layout: selection, phases (`idle`, `flying`, `landed`), the card's state, history, focus, the bloom, and the one `<Globe>`. The globe and the card stay mounted across a switch. A layout is an object (`LayoutModule`):

| Field | Meaning |
| --- | --- |
| `Top` | Component: the landing's words, search and chips, arranged its own way from `parts.tsx` and `Search` |
| `home(env)` | The globe at rest: `padding`, `globeSize`, `center` |
| `islandPadding(env)`, `islandSize(env)` | The area an open island is framed in, and the globe size once it is open |
| `card` | Wide screens: `"side"` (panel down the left), `"dock"` (wide card along the bottom) or `"float"` (the side panel's markup, placed on the right over the map by the layout's stylesheet, added for full-bleed) |
| `plateInFlight` | `true`: the card's name plate rides along during the flight. `false`: nothing shows until the camera lands, then the whole card rises |
| `spin`, `flightSpeed`, `homeSpeed` | Spin in degrees per second; multipliers on the engine's flight time |
| `ownsFlight`, `flyOptions()` | `true`: the layout starts every island flight itself with exact options (see horizon) |
| `shape` | Optional re-timing of the journey: `frame(t, out, view)` and `pitch(t, out, view)`, and optionally `height(s, out, levels, env)` and `anchored` (both added for the orb, see "Orb"), `bearing(t, out, view)` and `lift(t, out, env)` (both added for full-bleed: which way the camera faces, and zoom levels added to its height) |
| `islandView` | `{ pitch, bearing }`: the open island is seen at an angle. The shell hands the engine islands that carry that view, so the engine lands on it, keeps it when it re-frames, and levels out on the way home (full-bleed) |
| `drift` | Degrees: the landing sways that far either side of where the layout faces it instead of turning all the way round (full-bleed) |
| `peekMs` | An island tapped on the globe shows its label (`.da-peek`) for that long before the flight starts (full-bleed) |
| `homeBackdrop` | `true`: a coarse sea is drawn under the map on the way home, wherever the map's own tiles are still loading (see "Orb"). A number: the same, drawn from tiles of that zoom level, for a landing closer in than zoom 2 (see "Full-bleed") |
| `zoomAtHome` | `false` locks zoom gestures on the landing (dragging to spin still works) |
| `vars(env)` | Custom properties for the layout's stylesheet, from the same numbers the camera uses |
| `GlobeExtras` | Component drawn over the globe (an atmosphere) |

`env` is `{ wide, vw, vh, sheetCover, dockHeight, introHeight, safeTop, safeBottom }`. `view` is `{ radius, env, start }`: the radius of the planet's silhouette on screen at that instant, in px, and the pitch and bearing the camera had when the flight set off (a flight does not always start level: a second island chosen with one open, a flight turned round half-way).

**CSS.** The root carries `data-layout` and `data-card`. `atlas.css` is shared pieces plus the split arrangement; every other layout has its own stylesheet that restates what it moves, each rule scoped under `.da[data-layout="<id>"]`.

**Switching.** The canvas takes its new size first (`map.resize()` in a layout effect), the camera cuts to the new layout's frame (home, or the open island), and the globe cross-fades in (`data-switching`, 0.5 s). `Top` remounts and plays its entrance. On the landing the globe keeps the longitude its spin had reached.

### Adding the next layout

1. Add the id to `LayoutId` and `LAYOUT_IDS` in `src/lib/options/layouts.ts`, and its name to `optionStrings.layouts.names`. The boot script, the switcher and the URL handling follow.
2. Create `src/options/a/layouts/<id>.tsx` exporting a `LayoutModule`, and register it in `layouts/index.ts`. Start from `split.tsx` (the simplest: engine flights, no shaping).
3. Create `layouts/<id>.css`, import it in `index.tsx` next to `horizon.css`, and scope every rule under `.da[data-layout="<id>"]`. Add the id to the "wrong layout" rule in `atlas.css` (`html[data-layout="<id>"] .da:not([data-layout="<id>"])`) and add a glyph in `LayoutSwitcher.tsx`. A name too long for the pill goes in `optionStrings.layouts.fullNames` (the list a phone opens, and screen readers) with a short one in `names`.
4. First paint: the server frames the globe for a 390 x 844 phone. If the layout's `home()` depends on the screen, mirror its numbers in CSS for `.da[data-layout="<id>"]:not([data-hydrated]) .ipg-stage` (`--ipg-pad-*`, `--ipg-d`), as split and horizon do.
5. If the landing needs something the shell does not have (a carousel instead of a globe, say), put it in `Top`; the globe and card can be hidden or restyled from the layout's CSS. A layout with a different card shape adds a value to `card` and a branch where the shell renders the card.

Check with `node scripts/scratch/v2-horizon-behaviour.mjs` and the film scripts below. Things that bit while the orb was built: on a phone the base `.da-rail` is `position: fixed; bottom: 0`, so a rail that a layout positions absolutely needs `bottom: auto`; and `.da-intro-clip` cuts the headline off line by line as the intro folds, unless the layout lets it overflow.

## Horizon

Centred and stacked: a three-line headline, a wide search bar, a row of island chips, the hint, and a huge globe of which only the top arc rises from the bottom of the screen. The wordmark is a bar top left.

**Geometry** (`horizonGeometry` in `horizon.tsx`, mirrored in `horizon.css` as `--hz-r`, `--hz-top`, `--hz-box`):

| | phone (under 900px) | wide |
| --- | --- | --- |
| Planet radius | `min(95vw, 90vh)` | `min(58vw, 145vh)` |
| Top of the arc | 55% down the screen | 60% down |

At 390 x 844 the radius is 370px and the arc fills the bottom 45%. At 1280 x 800 the radius is 742px: the globe is 1484px across and the arc comes within 30px of both edges at the bottom of the screen.

**How the arc is made.** MapLibre keeps the centre of its view inside the canvas, so the globe's box is taller than the screen: it starts at the top and runs past the bottom edge until the planet's centre sits 40px above the box's own bottom (`.da` clips the rest). The landing frames the globe in an 80px strip at the bottom of the box (the engine never frames in less) with `globeSize = 2r / 80`. With an island open the box is the same; the bottom padding is the hidden part plus the card. No resize happens during a flight. The home centre is `[121, -22]`, which puts the Philippines well inside the arc at both sizes.

**The flight** is the engine's, in one move, with three things on top:

- `flyOptions` passes an exact zoom, and the landing's globe size is kept until the camera arrives. The engine measures how far to climb against the "whole globe" view for the current globe size; with the landing's huge size that view is not above the camera, so it only breathes out slightly instead of pulling back to a small ball.
- `shape.frame` re-times the tilt. The engine moves the frame (padding) evenly over the whole flight; here it finishes by 62% so the planet rises into view while it turns, the island never drops out of sight, and the dive starts centred.
- `shape.pitch` adds a swoop: the camera leans to 34° at 64% of the flight and is level again on arrival.

The shaping is applied in the map's `move` event, which fires from inside the engine's own `jumpTo`: the engine sets its camera for the frame, the shell restates padding and pitch, then the map draws. Progress is read back from the padding the engine applied (`flightProgress` in `camera.ts`), so there is no second clock.

### Choreography and timings

Measured on a film strip at 1280 x 800 and 390 x 844, flying to Bohol. Flight time is the engine's derived duration times `flightSpeed` (1.25): 3.4 s on the desktop, 3.7 s on the phone. Far islands take longer (the engine caps its own figure at 5.6 s before the multiplier).

Open:

| Time | What happens |
| --- | --- |
| 0 | Island chosen (search, chip, or tap on the globe). Chips fade and drift up (0.3 s), headline fades and drifts up (0.32 s), the search rides to the top edge (0.8 s). Taps on the globe are ignored until the landing |
| 0.35 s | "Flying to Bohol" caption fades in under the docked search |
| 0.4 to 2.1 s | The planet rises into view and turns toward the island (the frame eases from the horizon to the island's over the first 62% of the flight) |
| 1.0 to 3.4 s | The camera leans into the dive: pitch 0 to 34° (peak at 64%, about 2.2 s) and back to 0 |
| 3.4 s | Arrival. If the last map tiles are in (the usual case) the island's glow blooms at once. If not, a veil of haze holds the island for at most 0.9 s until they are |
| +0.32 s | The card rises from the bottom: the dock slides up (0.95 s) on a wide screen, the sheet springs to half height on a phone. Content staggers in |

Close (Escape, the close button, a flick down on the sheet, or Back):

| Time | What happens |
| --- | --- |
| 0 | Card drops (0.5 s). The search field empties |
| 0 to 2.3 s | Camera climbs and turns back (engine time times `homeSpeed` 1.05). Pitch rises to 26° at 52% as it looks up toward the horizon, level at the end. The frame stays on the island for the first 14%, then settles to the horizon |
| 1.15 s | The search leaves the top edge and settles into the column (1 s) |
| 1.75 s | Phone: wordmark and layout pill return |
| 1.95 s | Headline fades in (0.7 s) |
| 2.15 s | Chips and hint fade in (0.7 s) |
| about 3.5 s | Spin resumes (the engine waits 1.2 s after a flight) |

Reduced motion: no flight and no spin. The camera cuts, the card opens at once, and the globe cross-fades for 0.45 s on each change of island (`data-cut`).

Tuning: the constants at the top of `horizon.tsx` (`TILT_OUT_END`, `TILT_HOME_START`, `PITCH_OUT`, `PITCH_HOME`, `flightSpeed`, `homeSpeed`) and the transition delays under "the column" in `horizon.css`.

### The card

Phone: the existing bottom sheet with its three snaps, held below the screen until the camera lands.

Wide screens: a docked card, up to 1120px wide, 46% of the height at rest (320 to 440px), 20px above the bottom edge. Left column (396px): status, Map / Photos toggle, expand and close buttons, name, place, the lead photo, the actions. Right column: the section tabs and Dan's six sections, scrolling, with the fact table at four columns. The expand button pulls the card up to nearly full height. A coming-soon island gets a single narrow column. Photos view fills the map area above the dock.

## Orb

Dan's sketch 2, "Centred orb" ("Orb" in the pill). Centred and stacked like the horizon, but the globe is a small, complete planet floating under the words: a three-line headline, a wide search bar, one row of island chips, and below them the whole sphere with a sky-blue atmosphere around it and a faint shadow beneath. Its caption ("Drag to spin. Tap an island to open it.") sits under it on a phone and in the bottom left corner on a wide screen. The line under the headline is not shown in this layout. On a wide screen the chips are the five participating islands only; the islands still to come are in the search and on the globe (on a phone they are in the same scrolling row).

**Geometry** (`orbGeometry` in `orb.tsx`, mirrored in `orb.css` as `--orb-font`, `--orb-inset`, `--orb-stack`, `--orb-foot`, `--orb-band`, `--orb-d`, `--orb-cy`: change both together). The "band" is the stack's own height: top inset, three lines of headline, the search, the chips. The orb is centred in what is left between the band and a foot strip (the caption and the map credits), with 18 to 20px of air above and below.

| | phone (under 900px) | wide |
| --- | --- | --- |
| Headline size | `clamp(30px, 9.4vw, 42px)`; under 700px tall `clamp(27px, 8vw, 34px)` | `clamp(36px, min(3.6vw, 5.8vh), 60px)` |
| Top inset | 50px (18px when under 700px tall and at least 780px wide) | 32px (24px under 620px tall) |
| Foot | 64px (30px under 700px tall, where the caption goes) | 40px (30px under 620px tall) |
| Diameter | `min(78vw, room - 40px)`, between 184 and 540px | `min(50vw, room - 36px)`, between 184 and 540px |
| Under 520px tall ("flat": a phone on its side, a very low window) | No headline (taken out of the column, still read out). Top inset 50px, foot 30px, `room - 16px` | No headline. Top inset 66px (under the wordmark and the pill), foot 30px, `room - 20px` |

184px is the smallest planet the map draws (the engine's lowest zoom, 0.4): asking for less only put the poster and the live map out of step, and under about 450px tall it made the bottom padding negative, which MapLibre refuses (the map never started and the poster stayed). `home()` also clamps the padding at zero now.

| Screen | Orb | Centre from the top |
| --- | --- | --- |
| 390 x 844 | 304px (78% of the width) | 540px |
| 390 x 664 | 304px | 453px |
| 800 x 600 | 281px | 410px |
| 1024 x 700 | 349px | 467px |
| 1280 x 800 | 422px | 531px |
| 1440 x 900 | 504px | 590px |
| 1920 x 1080 | 540px (the cap) | 692px |
| 844 x 390 (flat) | 184px | 262px |
| 932 x 430 (flat, wide) | 200px | 290px |

The globe's box is the whole screen. The landing's padding leaves exactly the orb's square free and `globeSize` is 1, so the engine draws the globe to fill it. It faces `[116, 10]` and spins at 5 degrees a second. Zoom gestures are locked on the landing (`zoomAtHome: false`); dragging spins it. The map is clipped to the planet's disc (`clip-path` on `.ipg-map`, from the engine's `--globe-*`), because place names near the limb are flat text and hung over the edge of so small a sphere; the clip goes once the planet fills the screen.

**First paint.** `orb.css` frames the poster from viewport units before any script runs. At the ten sizes in `v2-orb-first.mjs` (bundles blocked, so only the server's HTML and CSS) the poster and the live map agree to within a pixel in position and 0.1px in size.

**What draws the planet's surroundings.** `.da-orb-glow` (the atmosphere: a soft sky-blue glow from the limb out to 1.6 radii) and `.da-orb-shadow` (an ellipse 9% of a radius below the sphere), both from the layout's `GlobeExtras`, on top of what every layout has (`.ipg-halo`, `.da-air`, `.da-depth`). All of them follow the engine's `--globe-x/y/r` and fade with `--globe-t`, which is what dissolves the halo as the planet swells: the shadow is gone after 0.6 doublings, the glow after 1.6, the rim after 2.4.

### The journey

The flight is the engine's, one move, started by the layout with an exact zoom (`ownsFlight`, `flyOptions`), as on the horizon. No tilt (`pitch` is 0 throughout): the planet turns in place, then swells straight toward the visitor. Three things are added on top, all through `shape`, and all in the shell's `move` handler (same place as the horizon's shaping):

- **`anchored` frame.** The globe's frame (padding) is a pure function of how big the planet is on screen: at the orb's size it is the orb's square; it starts to move once the planet has grown by 0.2 doublings and has reached the open island's frame by 3.4 doublings (`SWELL_HOLD`, `SWELL_SPAN`). So the orb stays where it floats while it turns, grows from its own centre, and only glides up to the island's place above the card as it outgrows the screen, most of that after the limb has left the screen. The same function runs backwards on the way home. Because it does not depend on where a flight started, a flight that is cut short and started again, or turned round with Escape, carries on without a jump.
- **`height`: the dive re-timed.** The engine dives with an ease-in-out cubic, which creeps for half a second and then rushes through the moment the planet fills the screen, which is the moment this layout is about (measured: 0.55 s from 1.1 times the orb's size to filling the screen). The shell reads how far through its dive the engine is (it inverts the cubic from the zoom the engine applied, `diveTime` in `camera.ts`) and asks the layout for the height at that time instead. `dive()` in `orb.tsx`: the first 42% of the dive's time (`SWELL_TIME`) takes the planet from the orb to filling the screen at a steady pace (measured: 1.1 s), then the camera speeds up over the map and eases down onto the island. The flight's length, its turn toward the island and its breath before the dive are still the engine's. Home is the same curve played backwards (the engine's climb is an ease-in-out sine of the flight's own progress, so no inversion is needed there).
- **`homeBackdrop`: a coarse sea for the way home.** Pulling out fast, the camera uncovers parts of the planet whose tiles are not loaded, and MapLibre draws those as bare land with no sea: hard-edged pale squares across the globe exactly as the world shrinks back into a ball. `installBackdrop` (`tiles.ts`) adds a second, tiny vector source on the same tiles but only zoom 0 and 1 (five tiles for the whole world, which the landing has fetched already, so nothing is downloaded twice: it is added once the map is idle), with one fill layer for the sea, right under the map's own, at opacity 0. During a flight home it is at opacity 1; it goes back to 0 when the map is sharp again (4 s at most). The orb's landing is under zoom 2, where the map itself draws from those tiles, so nothing changes when it goes. Only a layout that sets `homeBackdrop` gets the source at all.

### Choreography and timings

Measured on film strips at 1280 x 800 and 390 x 844 flying to Bohol from the page as it loads (Bohol is about 8 degrees from the centre of the orb then). Flight time is the engine's derived duration times `flightSpeed` (1.12): 3.4 s on the desktop, 3.5 s on the phone. An island on the far side of the planet takes longer (Bonaire from the same start: 6.3 s, of which 3 s is the turn).

Open:

| Time | What happens |
| --- | --- |
| 0 | Island chosen (search, chip, or tap on the orb). The words and the chips part round the search: the headline lifts 26px and fades (0.24 s), the chips stay where they stood, sink 24px and fade (0.3 s), the caption under the orb fades, and the search rides to the top edge (0.8 s; on a wide screen it narrows to 360px). Phone: wordmark and layout pill fade. Taps on the globe are ignored until the landing |
| 0.4 s | "Flying to Bohol" caption fades in under the docked search |
| 0 to 1.0 s | The orb turns in place to bring the island to the front, and breathes in: to 93% of its size for a near island, down to 75% for one on the far side (the engine's pull-back; it reads as the wind-up before the swell) |
| 1.0 to 2.1 s | The swell. The planet grows from its centre at a steady pace until it fills the screen. Its shadow goes first, then the glow, then the bright rim. From about 1.3 s its centre, which is where the island is by now, begins to glide up toward the island's place above the card |
| 2.1 to 3.4 s | The camera carries on down over the map and eases onto the island; the frame reaches the island's at about 2.7 s |
| 3.4 s | Arrival. The island's glow blooms (or the veil of haze holds it for at most 0.9 s if the last tiles are late, as in every layout) |
| +0.32 s | The card rises from the bottom: the dock on a wide screen, the sheet to half height on a phone |

Close (Escape, the close button, a flick down on the sheet, or Back). The flight home is the engine's climb (2.6 s) times `homeSpeed` (1.12): 2.9 s.

| Time | What happens |
| --- | --- |
| 0 | Card drops (0.5 s). The search field empties |
| 0 to 1.3 s | The camera climbs fast; the island's frame holds until the planet is back to about ten times the orb's size |
| 1.3 to 2.9 s | The world shrinks back into the orb at a steady pace and settles softly; its centre glides back down to the orb's place; the rim, the glow and then the shadow return |
| 1.55 s | The search leaves the top edge and comes down into the column (1 s); the chips ride down under it, still clear |
| 1.9 s | Phone: wordmark (and layout pill, at 1.75 s) return |
| 2.05 s | Headline fades in (0.7 s) |
| 2.25 s | Chips fade in (0.7 s); the caption under the orb at 2.35 s |
| about 4.1 s | Spin resumes (the engine waits 1.2 s after a flight) |

Reduced motion: no flight and no spin. The camera cuts, the card opens at once, and the globe cross-fades for 0.45 s on each change of island (the shell's `data-cut`, as on the horizon).

Tuning: the constants at the top of `orb.tsx` (`SWELL_HOLD`, `SWELL_SPAN`, `SWELL_TIME`, `flightSpeed`, `homeSpeed`) and the `--orb-back*` delays at the top of `orb.css` (when the search, the words and the chips come back).

### The card

The horizon's: the docked card on a wide screen (`card: "dock"`), the bottom sheet with its snaps on a phone, both held back until the camera lands (`plateInFlight: false`). No new card code.

### Changes outside the layout's own two files

- `src/lib/options/layouts.ts`: `"orb"` added to `LayoutId` and `LAYOUT_IDS` (order: Split, Horizon, Orb; the default is still horizon). `strings.ts`: `names.orb` ("Orb") and a new `fullNames` map ("Centred orb").
- `LayoutSwitcher.tsx`, `atlas.css`: a glyph; the list a phone opens and the screen-reader text use the full name, the wide pill the short one.
- `index.tsx` (the shell): journeys can be `anchored` and can re-time the camera's height (both only when a layout's `shape` asks; horizon's path through that code is unchanged); the backdrop is switched on and off around flights home for a layout with `homeBackdrop`; `LayoutEnv` has `safeTop` and `safeBottom`. The safe-area insets are now read again when the window changes size, instead of once: a phone turned on its side reports different ones. That is the only change that reaches split and horizon, and only on a device with insets.
- `style.ts`: the sea layer's id is exported (`WATER_LAYER`).
- Nothing in `src/components/globe`, `src/options/b` or `src/options/c` was touched. `camera.ts` imports four pure functions straight from `@/components/globe/camera` (they are not in the engine's index).

### Checks

All on the dev server at `http://localhost:3100`, headless Chromium with the real GPU, at 390 x 844 (touch, DPR 2), 1280 x 800 and 800 x 600.

| Script | What |
| --- | --- |
| `v2-orb-behaviour.mjs` | 67 checks, all pass. Desktop: geometry, wheel lock, spin, chip, Back and Forward, hop from an open card, coming-soon island, Escape mid-flight, resize idle and open, tap on the orb, a key during the flight. Phone: sheet held and inert, landing, hop, close, coming-soon chip. Switching: order and default, idle, card open, mid-flight both ways, during the flight home, arrow keys. Deep link on both, reduced motion, stored layout, `/lab/option-a` |
| `v2-orb-stress.mjs` | 20 checks, all pass: Escape at six moments of the flight, a second island chosen mid-flight, an island chosen again while the world is still shrinking |
| `v2-orb-trace.mjs` | Per-frame camera trace. Open and close are one move: the largest step between two frames is 0.09 zoom levels (3.8% in size) and 7px of the centre, also when Escape turns the flight round mid-swell. 60 fps on this machine; with the CPU throttled 4x, 8 frames over 34 ms in an open |
| `v2-orb-first.mjs` | First paint against the live map at ten sizes |
| `v2-orb-film.mjs`, `v2-orb-sheet.py` | Film strips and contact sheets (`--close`, `--search`, `--tap`, `--deeplink`, `--log`) |
| `v2-orb-nogl.mjs` | No WebGL: the poster is the orb, its dots open islands, the poster moves above the card |
| `v2-orb-split.mjs` | Split still behaves as before, desktop and phone (14 checks, all pass) |
| `v2-horizon-behaviour.mjs` with `HZ_BASE=http://localhost:3100` | The horizon's 32 checks, all pass. Stills of horizon and split before and after: every element in the same place, the only difference the third name in the pill |

`tsc --noEmit` and `eslint` report nothing for `src/options/a`, `src/lib/options` and `src/app/lab/option-a`.

### Known issues (orb)

1. **The breath before the swell is the engine's, and varies:** the orb shrinks to between 93% and 75% of its size while it turns, more for a far island and more on a wide screen. It reads as a wind-up, but it cannot be tuned from the layout.
2. **A far island is a long flight** (up to about 6.3 s for the other side of the planet), half of it the small orb turning. The engine's cap, times 1.12.
3. **The re-timed dive leans on one more engine detail** than the horizon's shaping does: that the dive is an ease-in-out cubic of time and the climb home an ease-in-out sine. If either changes in `src/components/globe/camera.ts`, `diveTime` in `src/options/a/camera.ts` must follow, or the swell will be mis-timed (it cannot jump: the curve still starts and ends where the engine's does).
4. **Coarse land mid-dive**, as in every layout (known issue 5 below).
5. **Place names are cut by the limb** on the landing (the clip that stops them hanging over the edge). The rim covers the cut.
6. **A notch or home indicator** is allowed for (`safeTop`, `safeBottom` in the geometry, `env()` in the CSS), but only tested with zero insets: headless Chromium has none.
7. **Wide screens: the coming-soon islands have no chips** (one row). They are in the search and on the globe.
8. **Desktop headline is smaller than the horizon's** (46px against 62px at 1280 x 800): the room goes to the orb. At 1280 x 800 the orb is 422px; a taller headline would take it under 420.
9. **Not tested on a real phone, on iOS Safari, or in in-app browsers.** `clip-path: circle()` on the map canvas and container units are the two things to look at there.

### Check pass (orb, independent test, same day)

On the dev server, headless Chromium with the real GPU, at 390 x 844 and 360 x 640 (touch, DPR 2), 1280 x 800, 800 x 600 and a dozen other sizes from 320 x 568 to 1920 x 1080. Scripts: `scripts/scratch/v2-orb-check-*.mjs`, output in `scripts/scratch/v2-orb-out/check/`.

Fixed:

- **A layout switched while a card was open switched back when the card closed** (all layouts; `layouts/state.ts`). Closing a card goes back one history entry, and the entry under the card still named the layout the card had been opened in; Back and Forward adopted it. Now Back and Forward inside the page keep the layout on screen and bring the entry's URL up to date. A link followed into the page with a different `?layout=` is still adopted when the landing mounts.
- **Orb on a low screen (a phone on its side, 667 x 375 and the like): the map never started** ("Invalid value for edge-insets": the orb's frame had a negative bottom padding) and only the poster showed; from about 390 to 500px tall the orb overlapped the chips and ran off the bottom. The "flat" arrangement above, the 184px floor and the clamp in `home()`.
- **A window resized while the camera was flying home left the landing framed for the old size** (orb 14px too large at 1280 to 1100; the horizon likewise; `index.tsx`). The engine ignores a new size during a flight; a landing with a fixed composition is now re-framed as the flight ends (`reframeHome`).

Checked and passing: `v2-orb-check-desk.mjs` (42), `-phone.mjs` (36 at each of the two phone sizes: touch drag, pinch, tap on the orb, sheet snaps, tabs, Photos, flick to close, coming soon, the layout list), `-misc.mjs` (Escape at six moments, a second island mid-flight, keyboard, crossing 900px with a card open, stored layout, `/passport`, `/lab/option-a`, `/`), `-stress.mjs` (double click, drag then choose, resize mid-flight, six layout switches in half a second, four during one flight), `-revert.mjs` (15), `-rshome.mjs` (6), `-trace.mjs` (60 fps unthrottled, 50 to 53 fps with the CPU throttled 4x, the one long frame at the tap; largest step between frames 3.8% in size, 7px of the centre), first paint at 16 sizes. The earlier suites still pass (orb 67 and 20, horizon 32, split 14).

Still open, found in this pass:

- **Escape does nothing while focus is in the search field and its list is closed** (every layout). The shared search hook (`src/lib/islands/useIslandSearch.ts`) keeps Escape to itself: the first press closes the list, the second empties the field, and none of them reaches the shell. With a card open and the cursor in the docked search, the card has to be closed with its button.
- **An island chosen while another is open** flies the engine's own, unshaped path (the frame does not change, so there is nothing to read the flight's progress from): for a far island the planet shrinks to a small ball under the docked search, about half the orb's size, turns and dives. One move, no cut, but not the orb's place or pace.
- **568 x 320 and smaller:** the smallest planet (184px) overlaps the chips and touches the bottom edge.
- **Low screens with a card open** (every layout): on a phone on its side the half-height sheet covers nearly all of the map.

## Full-bleed

"Full-bleed" in the pill, the fourth and last so far (order: Split, Horizon, Orb, Full-bleed; horizon is still the default). The map is the page: the globe fills the whole screen, edge to edge, and everything else floats over it as light frosted glass. A compact wordmark bar top left, the search pill near the top (under the wordmark on a phone, top centre on a wide screen) with the hint in a small capsule under it, a short three-line headline bottom left on a wide screen (along the bottom, above the chips, on a phone), smaller than in the other layouts (30px on a phone, 40px at 1280), and one floating row of island chips along the bottom. Behind the type the map is lifted toward white by two washes of light (`.da-fb-wash`, drawn inside the globe's box, under its credits): nothing is darkened anywhere.

**Geometry** (`fullbleedGeometry` in `fullbleed.tsx`; the poster's size is mirrored in `fullbleed.css`). The globe's box is the screen and the landing's frame has no padding: the planet's centre is the screen's centre.

| | phone (under 900px) | wide |
| --- | --- | --- |
| Planet radius | 1.04 x the screen's half diagonal: it overflows every corner | 0.9 x the half diagonal: the limb and its atmosphere show in the four corners |
| At 390 x 844 / 1280 x 800 | 483px, zoom 3.10 | 679px, zoom 3.83 |
| Faces | `[120, 4.5]` (the Coral Triangle; Bohol a little right of the middle and above it) | the same |
| Floating card | the bottom sheet | `clamp(380px, 33vw, 440px)` wide, 24px from the right edge, from 84px down to 24px above the bottom |
| Open island framed in | under the docked search (74px) and above the sheet | left of the card: top 104, right 24 + card + 44, bottom 56, left 56 |

The landing **sways** instead of spinning (`spin: 0.75` degrees a second, `drift: 6`): at this range a full turn would carry the islands out of sight for minutes. The spin is the engine's; the shell flips its direction when the globe has turned 6 degrees from `[120, 4.5]`, easing through zero over about 3 seconds (`SWAY_TICK_MS`, `SWAY_STEP` in `index.tsx`). One sway is about 36 seconds. A globe the visitor dragged away drifts back the same way. Zoom gestures are not locked on this landing.

**Markers.** A layout with `peekMs` gets two extra elements in every marker: `.da-beacon-core` (a solid dot with a white ring over the map's own, breathing, with two slow rings round it; coming-soon islands get a smaller apricot one) and `.da-peek` (a small glass tag: the island's name and "Open now" or "Coming soon"). The tag shows on hover and keyboard focus, and for 420 ms after a tap on the globe, before the flight starts (`pick` in `index.tsx`; a chip or the search starts the flight at once). The big markers only show from globe height (`data-altitude="globe"`): closer in, the small islands get dots too and a cluster of these would crowd them.

**First paint.** The poster is the full-bleed landing: `fullbleed.css` frames it from container units (`hypot(100cqw, 100cqh)` times 1.04 or 0.9) before any script runs, and at seven sizes from 360 x 640 to 1920 x 1080 the poster and the live map agree to 0.1px in position and size. One more thing was needed here: the server draws the poster's land with the perspective of the phone it assumes, and this layout's camera is so close that on a wider screen the land would sit up to a third too small until the script re-drew it, then jump. Until then the land and the dots are scaled by the difference (`--fb-poster-k`, stepped by the screen's shape) and the sea's disc scaled back; the shell stamps `data-measured` on the root before the first paint after hydration, which is when the poster is drawn for the real screen and the correction goes.

### The journey

One flight, the engine's, started by the layout with an exact zoom and an exact length (`ownsFlight`, `flyOptions`), shaped in the shell's `move` handler like the horizon's. What is different from the horizon (which tilts up from the limb and lands level) and the orb (a sphere that swells, never tilted): the camera lands **tilted**, looking across the island at 52 degrees with the map turned 17 degrees (`islandView: { pitch: 52, bearing: -17 }`), and stays that way while the card is open.

- **Pull-back** (`shape.lift`): the camera backs off 0.42 zoom levels, peaking 20% into the flight and over by 50%. On a phone the planet, which overflowed the screen, shows its limb and atmosphere for a moment; on a desktop it becomes a ball about 80% of its landing size. The engine adds its own breath for a far island.
- **Bank** (`shape.bearing`): the planet rolls toward the island's bearing from the first frame, done by 72%.
- **Frame** (`shape.frame`): the globe slides from the screen's centre to where the island will land (left of the card, or above the sheet) by 56%, so the dive comes straight down on it.
- **Tilt** (`shape.pitch`): level through the pull-back, then from 36% to 97% of the flight the camera leans over to 52 degrees. It is also held to the camera's height (`tiltAllowed`): none while the limb can be on screen (the atmosphere drawn round it in CSS is a circle, and a tilted planet is not one), all of it 3.6 zoom levels further in.
- **Length** (`flightMs`): the engine's derived time times 1.7 from the landing, times 1.3 between two open islands, never more than 6.4 s (the far side of the planet would otherwise be 9 s).
- **Home**: level again by 60% of the climb, facing north by 72%, the frame holds on the island for the first 16%, and the last stretch eases onto the landing (`OVERSHOOT`).
- **A second island with one open** is shaped too, which the other layouts' is not: the frame does not change then, so there is no padding to read the flight's progress from, and the shell falls back to a second clock (the flight's start and the exact length the layout gave it). Tilted on both islands; if the trip is long enough to climb to planet height the camera levels over the top (`tiltAllowed`) and leans again on the way down.

`homeBackdrop: 3`: the backdrop for the way home (see "Orb") is drawn from level 3 tiles here, the level the landing itself is drawn from, so its coastline is the landing's; it shows only below zoom 6.2 (further in its sea would cover real land).

### Choreography and timings

Measured per frame (`v2-fullbleed-trace.mjs`) and on film strips, flying to Bohol from the page as it loads, at 1280 x 800 and 390 x 844. Flight: 4.0 s on the desktop, 3.9 s on the phone.

Open:

| Time | What happens |
| --- | --- |
| -0.42 s | Only for a tap on the globe: the island's label pops over its dot and the dot swells. The card's photo and the dive's tiles are already being fetched |
| 0 | Island chosen. The headline drops 34px and fades (0.3 s), the chips slide down off the bottom edge (0.6 s), the hint and the washes of light fade, the search docks to the top (0.8 s: up 48px on a phone, where the wordmark and the layout pill make way; narrower on a wide screen). Taps on the globe are ignored until the landing |
| 0.4 s | "Flying to Bohol" caption under the docked search |
| 0 to 2.0 s | Pull-back (deepest at about 0.9 s) and bank; the planet slides toward the island's place (there by 2.25 s) |
| 1.45 to 3.9 s | The dive, tilting as it goes: 11 degrees at 2.3 s, 36 at 3.1 s, 52 at 3.9 s |
| 4.0 s | Arrival, looking across the island. Its glow blooms (or the veil of haze holds it for at most 0.9 s if the last tiles are late, as in every layout) |
| +0.33 s | The card arrives: the glass card glides in from the right edge (0.95 s) on a wide screen, the sheet springs to half height on a phone |

Close (Escape, the close button, a flick down on the sheet, or Back). The flight home is 3.1 s on the desktop, 3.0 s on the phone.

| Time | What happens |
| --- | --- |
| 0 | The card leaves: out to the right (0.5 s) on a wide screen, down on a phone. The search field empties |
| 0 to 1.9 s | The camera rises and levels (52 degrees to 0); the map turns back to north by 2.2 s |
| 0.5 to 3.1 s | The planet slides back to the middle of the screen and settles |
| 1.6 s | The search leaves the top edge (1 s); the washes of light return |
| 1.95 s | Phone: the wordmark returns (the layout pill at 1.75 s) |
| 2.05 s | The headline rises back in (0.7 s) |
| 2.25 s | The chips and the hint (0.7 s) |
| about 4.3 s | The sway resumes (the engine waits 1.2 s after a flight) |

Reduced motion: no flight, no sway, no pulsing. The camera cuts (to the tilted view), the card opens at once, and the globe cross-fades for 0.45 s (the shell's `data-cut`).

Tuning: the constants at the top of `fullbleed.tsx` (`PITCH`, `BEARING`, `LIFT`, `FRAME_OUT_END`, `BANK_OUT_END`, `TILT_OUT_START`, `TILT_LEVELS`, `SPEED_OUT`, `SPEED_HOP`, `MAX_FLIGHT`, `homeSpeed`, `spin`, `drift`) and the `--fb-back*` delays at the top of `fullbleed.css`.

### The card

Phone: the existing bottom sheet with its snaps, held below the screen (and `inert`) until the camera lands. Wide screens: `card: "float"`, which is the side panel's markup (`.da-panel`) placed on the right by `fullbleed.css`, held off screen and `inert` until the landing, with the same glass as every card once the camera is at rest. The island is framed in what is left of the screen to its left. Checked by projecting the island's whole outline to the screen: with the tilt and the turn, Bohol at 1280 x 800 spans x 145 to 682 and the card starts at 834; at 1100 x 720, 54 to 594 against 696. A coming-soon island gets the same card, short. The Photos view takes the map area left of the card.

### Sharpness at the tilted landing

A tilted camera sees a good deal of ground beyond the island. `warmTiles(map, island, tilted)` (`prefetch.ts`) fetches, at the two levels nearest the landing, the tiles on every side of the island's own as well (nine instead of four per level). With the CPU throttled 4x: at 8 Mbit/s every tile of the landing view is in when the camera arrives, on phone and desktop, and no veil shows; at 4 Mbit/s and below the veil holds the island for its 0.9 s and the surroundings sharpen within about 0.6 s after it (`v2-fullbleed-slow.mjs`).

### Changes outside the layout's own two files

- `src/lib/options/layouts.ts`: `"fullbleed"` added to `LayoutId` and `LAYOUT_IDS`. `strings.ts`: `names.fullbleed` and `fullNames.fullbleed` ("Full-bleed").
- `LayoutSwitcher.tsx`: a glyph. `atlas.css`: the "wrong layout" rule, and the segmented pill now starts at 1280px instead of 1100px (the only change that shows in split, horizon and orb: between 1100 and 1279px they have the compact pill).
- `layouts/types.ts`: `card: "float"`, `islandView`, `drift`, `peekMs`, `shape.bearing`, `shape.lift`, `FlightView.start`, `homeBackdrop` as a number.
- `index.tsx` (the shell): the islands handed to `<Globe>` carry the layout's `islandView`; `shape.bearing` and `shape.lift` are applied with the frame and the pitch; a second clock for a flight whose frame does not change (only when the layout gives the flight an exact length); the sway; `pick` (the label before the flight) and the two extra elements in a marker when the layout has `peekMs`; the side panel is `inert` while a layout holds it back; `data-measured`; and one fix for every layout: a window resized during one of the engine's own moves with an island open (the half second after a landing) left the island framed for the old size, and is now put right (`reframeIsland`). None of the new paths runs in split, horizon or orb: they set none of the new fields.
- `tiles.ts`: `installBackdrop` and `setBackdrop` take a level. `prefetch.ts`: `warmTiles` takes `tilted`.
- The photo fix below (`photos.ts`, `Card.tsx`, `atlas.css`, `index.tsx`).
- Nothing in `src/components/globe`, `src/options/b` or `src/options/c` was touched. `fullbleed.tsx` imports two pure functions from `@/components/globe/camera` (`cameraDistance`, `radiusForLimb`) and `planFlight` from the engine's index.

### Checks

All on the dev server at `http://localhost:3100`, headless Chromium with the real GPU.

| Script | What |
| --- | --- |
| `v2-fullbleed-behaviour.mjs` | 68 checks, all pass. Desktop (28): default and order, geometry, sway, chip, held and inert card, tilted landing, the card clear of the island's projected outline, lead photo on screen at the landing, a second island with one open, coming-soon, Escape, Escape mid-flight, Back and Forward, tap on the globe (label, then flight), resize with a card open and on the landing. Phone (12): overflow, no limb, top row, Bohol clear of the type, sheet held and inert, tilted landing between search and sheet, photo, close, a far coming-soon island. Switching (13): idle, card open to and from every other layout, mid-flight both ways, during the flight home, arrow keys. Misc (15): deep link on both, reduced motion, 800 x 600, crossing 900px with a card open, `/lab/option-a`, a stored layout |
| `v2-fullbleed-trace.mjs` | Per-frame camera trace. Open and close are one move: the largest step between two frames is 0.08 zoom levels, 1.1 degrees of pitch, 0.13 of bearing, 2.6px of the centre. 60 fps unthrottled; with the CPU throttled 4x about 49 fps, six or seven long frames in an open (the worst, about 200 ms, at the tap) |
| `v2-fullbleed-film.mjs`, `-hop.mjs`, `-sheet.py` | Film strips and contact sheets: open, close (`--close`), tap (`--tap`), a second island |
| `v2-fullbleed-first.mjs`, `-load.mjs` | First paint against the live map at seven sizes; the load filmed from the first byte |
| `v2-fullbleed-slow.mjs` | The landing on a throttled connection and CPU |
| `v2-fullbleed-photo.mjs` | When the card's photo shows, per layout (see the photo fix) |
| `v2-fullbleed-nogl.mjs`, `-drift.mjs` | No WebGL (the poster is the landing, its dots open islands); the sway |
| Earlier suites | Horizon 32 of 32. Orb behaviour 66 of 67 (the one that fails asserts that there are exactly three layouts). `v2-orb-split` 14, `v2-orb-stress` 20, `v2-orb-check-desk` 42, `v2-orb-check-phone` 36, all pass. `v2-orb-check-misc` 27 of 28: its keyboard-order check tabs on from the search field, where focus was put back when the card it had opened from the search closed; from a fresh load the order is search, chips, pill, map in every layout (`v2-fullbleed-tab.mjs`) |

`tsc --noEmit` and `eslint` report nothing for `src/options/a`, `src/lib/options` and `src/app/lab/option-a`.

### Known issues (full-bleed)

1. **Flat land.** The tilt gives the island a 3D feel, but the map has no terrain: the island is a flat shape seen at an angle. Real relief needs elevation tiles, which the engine does not load.
2. **A single frame of bare land at the screen's edge on the way home**, around zoom 6 to 7, where neither the map's tiles nor the backdrop's cover the newly uncovered strip. The same class as "pale squares" in the orb; the backdrop removes it below zoom 6.
3. **Pale squares over the far side of the planet** on a long flight between two open islands (Bohol to Bonaire), while the whole-world tiles load. No backdrop is drawn on flights out.
4. **The far hop's tilt is quick**: coming down from planet height the camera leans 52 degrees in about 0.75 s, because there it follows the height, not a clock.
5. **A card that is leaving shows the next island's name** for the 0.5 s it takes to go when a second island is chosen (every layout: the card's content switches at once).
6. **A phone on its side** (844 x 390 and the like): Bohol's marker sits under the search pill on the landing, and with a card open the sheet covers most of the map (as in every layout).
7. **Wide screens under 1560px: no chips for the coming-soon islands** (one row). They are in the search and on the map.
8. **The hint still says "Drag to spin"** (a shared string), though this landing sways.
9. **`hypot()` in CSS** frames the poster (Chrome 120, Safari 15.4, Firefox 118). An older browser gets a poster large enough to cover any screen until the script takes over.
10. **Not tested on a real phone, on iOS Safari, or in in-app browsers.** A tilted map over four glass pieces is more work for a phone than the other layouts; the search pill drops its blur while the camera flies.

## Fixes for all layouts

- **The card's photo was missing for a second or two after the card opened on a phone** (found while full-bleed was built; `photos.ts`, `Card.tsx`, `index.tsx`, `atlas.css`). Measured on a throttled phone (1.6 Mbit/s, CPU 4x): the lead photo was asked for when the card mounted, at the same moment as the flight's tiles, the Photos view's large pictures and the body's thumbnails, and had not arrived 3 s after the card landed; the card showed its blurred preview. Now: (1) the lead photo is fetched ahead, in two sizes, the narrowest rendition (about 35 KB) and the one the card's own `<img>` will pick (same `srcset` and `sizes`, so the same file), as soon as intent shows (a chip under the pointer or finger, a highlighted search result, a tap on the globe) and in any case when an island is chosen, deep links and Back and Forward included; (2) the tile prefetch waits for the narrow rendition, 450 ms at most; (3) the card shows the narrow rendition over its blurred preview until the sharp photo has faded in under it (`.da-hero-lo`), so the area is never empty and never only a blur; (4) every other picture (the Photos view, the strip, wildlife, projects) waits for the landing and then for the lead photo, 2.5 s at most (`picturesFor`; each keeps its tinted frame meanwhile, so nothing moves). Same throttle, every layout, phone and desktop (`v2-fullbleed-photo.mjs <layout> <m|d> --slow --cpu=4`): the narrow rendition is in 0.4 to 0.7 s after the tap, four seconds before the card lands, and the photo is on screen as the card rises. On a normal connection both sizes are in within 0.2 s.

- **(a) Empty area between the name and the tabs.** Not reproduced: ten ways of opening a card on a phone (chip, deep link, interrupted flight, sheet pulled up mid-flight, second island, each with and without the old pill) all painted the photo, and all photos now exist. The one mechanism that could produce it was removed: the photo and the staggered content used to be invisible by default and made visible by an animation tied to the `landed` phase. They are now visible by default and only start from nothing while that animation is waiting or running.
- **(b) Switcher over the card's tabs.** The A · B · C pill is gone unless `?themes=1`. The layout pill sits top right and is hidden on a phone while a card is open; it returns after the search has left the top edge.
- **(c) Blocky land during the dive.** Three changes in `tiles.ts` and `prefetch.ts`: tiles are fetched ahead as soon as a chip is under the pointer or a search result is highlighted; MapLibre no longer cancels the in-between zoom levels on a dive, so the land sharpens step by step; and if the camera still lands before the last tiles, a veil of haze holds the island (0.9 s at most) and the glow and card wait for it. With tiles held back 1.4 s the veil shows for 0.8 s and clears as the island comes into focus.
- **(d) Wrong sphere on first load.** Horizon is framed entirely from viewport units before any script runs; at 390, 800, 1000, 1280 and 1600px wide the server HTML, the poster after hydration and the live map are in the same place. Split: from 900px the first paint mirrors the new numbers below; between 600 and 899px, where the stacked globe depends on how the headline wraps, the poster now waits for the script and fades in at its real size instead of jumping.
- **Split globe at 800 to 1100px.** The globe starts where the words column ends rather than at a fixed 560px, and is never drawn under 520px: 520px at 900 (cropped 55px at the right edge), 526px at 1000, 587px at 1100 (was 340, 440, 540). Unchanged from 1218px up.
- **Overlapping markers.** At globe scale Siargao's marker sat on Bohol's and took its taps. Participating islands' markers are now on top; a coming-soon marker passes the tap to the map, which picks the nearest island.
- **Resize.** The canvas is resized before the engine re-frames (it used to measure the old size), which matters for horizon and corrects a small error in split.

## Test harness

Because no server could be started, `scripts/scratch/v2-horizon-harness/build.mjs` bundles option A with the webpack that ships inside Next (TypeScript transpile only, `next/font` and `next/navigation` stubbed) and `v2-horizon-lib.mjs` serves it to headless Chromium through Playwright request interception. No port, no process. A second bundle server-renders the landing for first-paint checks. Set `HZ_BASE=http://localhost:3100` to point the same scripts at the real server once it is up.

| Script | What |
| --- | --- |
| `v2-horizon-behaviour.mjs` | 32 checks: default layout, framing, Back and Forward, island hop, Escape mid-flight, resize, keyboard switch, reload, tap on the globe, sheet drag, reduced motion, no WebGL. All pass |
| `v2-horizon-film.mjs` | Film strip from a screencast (real GPU): open, and close with `--close` |
| `v2-horizon-first.mjs` | Server HTML without script, poster after hydration, live map, at several sizes |
| `v2-horizon-deeplink.mjs`, `-slow.mjs`, `-switch.mjs`, `-stored.mjs`, `-timing.mjs`, `-states.mjs` | Deep link, late tiles, layout switching, stored layout, timeline, stills |
| `v2-horizon-sheet.py` | Contact sheets |

`tsc --noEmit` and `eslint` report nothing for `src/options/a`, `src/app/lab/option-a`, `src/components/options-ui` and `src/lib/options`.

## Known issues

1. **Not run on the Next dev server.** `/`, `/lab/option-a` and `/passport` were type-checked but not loaded. The harness does not exercise `next/dynamic`, the real `useSearchParams`, or the real fonts pipeline.
2. **Engine: the spin can whirl at start-up.** `GlobeEngine.tick` takes `dt = Math.min(64, elapsed)`; when the spin starts while the page is stalled, `elapsed` is negative, the ease-in ramp goes far out of range and the globe turns at up to hundreds of degrees per second for a moment. One-line fix in `src/components/globe/engine.ts`: `Math.max(0, Math.min(64, elapsed))`. Not my file; the shell works around it by holding the spin until a few frames arrive on time (`spinReady`).
3. **Horizon draws a taller canvas** on wide screens: 1280 x 1262 instead of 1280 x 800 (58% more pixels). The engine's adaptive quality lowers the pixel ratio if frames drop. Not measured on a slow GPU.
4. **The journey shaping leans on two engine details:** that `move` fires inside its `jumpTo`, and that padding is eased with an ease-in-out quadratic. If either changes, `flightProgress` in `camera.ts` must follow.
5. **Coarse land mid-dive** is still visible for about 0.5 to 0.8 s between zoom 5 and 8. MapLibre has no way to load a destination's tiles ahead of the camera; the veil only covers tiles that are late at arrival.
6. ~~Split, phone: the chips reappear at once on close.~~ Fixed in the check pass (below).
7. **A stored layout with no `?layout=` in the URL** shows only the background until hydration (by design, see "First paint").
8. ~~Horizon, phone: the sheet is off screen during the flight but still in the tab order.~~ Fixed in the check pass: the held sheet is `inert`.
9. **Horizon, wide screens under 860px tall: the coming-soon chips are hidden** to keep the column clear of the atmosphere. Those islands are reachable by search and on the globe.
10. ~~Keyboard on the map canvas can still interrupt a horizon flight.~~ Fixed in the check pass (it left the card open over a small whole globe).
11. **Not tested on a real phone, on iOS Safari, or in in-app browsers.** The first paint uses `svh` units where supported.

## Check pass (independent test, same day)

Still no dev server on port 3100, so this pass also ran on the static harness (real GPU, 390 x 844 touch, 1280 x 800, 800 x 600 and seven other sizes). Scripts: `scripts/scratch/v2-horizon-check-*.mjs`.

Fixed:

- **Chips ghosting over the docked search after a layout switch with a card open** (any layout to split, and a split deep link to an island). The remounted rail played its entrance from 35% opacity. With an island open the rail now has no entrance animation (`atlas.css`).
- **Split, phone: chips and hint came back the instant a card closed**, over the zoomed-in map. They now return with `da-return` after 1.1 s, as on a wide screen.
- **Split, wide: the headline re-wrapped in the docked column for a few frames** when an island was chosen. It is hidden at once there.
- **Switching layout on the landing after an island had been opened** used the "return" animation (search and chips invisible for 0.85 s). The shell clears `returned` on a switch at idle.
- **Horizon: a key pressed with the map in focus during the flight** (the map takes focus when an island is tapped on it) cut the flight short and left the card open over a small whole globe. Keys other than Escape and Tab no longer reach the map during a flight the layout owns, and a flight that is cut short anyway (Tab) is started again instead of opening the card (`onFlightEnd`, at most 12 times per island).
- **Horizon, phone: the held sheet is `inert`** until the camera lands (`Sheet` has an `inert` prop).
- **Docked card, photo view:** the photo area was a 4:1 strip across the screen and cropped faces out of frame. It is now centred and at most 2:1.

Measured: with the CPU throttled 4x the flight keeps 60 fps in both layouts (mean frame 17 to 18 ms, one long frame of about 120 ms at the tap, which split has too); the camera path has no cut (largest step between frames 0.3 zoom levels, 2 degrees of pitch).
