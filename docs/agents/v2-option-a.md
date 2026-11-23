# v2 option A handoff: "Daylight Atlas"

> **Update.** The landing now has layouts ("split" is the arrangement described here, "horizon" is the default, "orb" is the centred small planet, "fullbleed" is the map as the whole page), a "Layout" pill replaces the A · B · C pill (which needs `?themes=1`), and `index.tsx` is a layout-agnostic shell. See `docs/agents/v2-layouts.md`. Everything below about the look, the card and the map style still holds; the layout numbers and the open and close sequence described here are the split layout's (`src/options/a/layouts/split.tsx`).

Bright, airy travel atlas: a pale sky, a sunlit globe with warm sand land and sky-blue sea, turquoise participating islands, a frosted white island card. Display type is Instrument Serif, everything else DM Sans (both loaded by this option only).

## Where to look

| URL | What |
| --- | --- |
| `http://localhost:3100/lab/option-a` | Option A on its own. **Works now.** `?island=bohol` opens an island, `?switcher=1` shows the A · B · C pill (layout check only) |
| `http://localhost:3100/?option=a` | The real entry. **Blocked at the time of writing, not by this option:** see "Blocker" below |

### Blocker: `/` does not compile

`src/options/c/index.tsx` imports `./option-c.css`, which does not exist (option C is paused part-way). The registry in `src/options/index.ts` imports all three options, so Next fails the whole `/` route with "Module not found". It is the only unresolved import in `src/options/b` and `src/options/c`. I did not touch it: those folders are not mine.

Smallest fix, for whoever owns it: create an empty `src/options/c/option-c.css` (option C will then render unstyled until it is finished), or finish option C. Nothing in option A needs to change.

Until then Next's dev overlay shows that build error on every route. The lab page hides the overlay in development (one `<style>` in `src/app/lab/option-a/page.tsx`, commented) so option A can be seen and recorded. Remove that line once `/` compiles if you want the overlay back on the lab.

## Files (all mine)

| Path | What it is |
| --- | --- |
| `src/options/a/index.tsx` | The landing: layout numbers, phases, open/close, history, focus, the glow-then-card timing |
| `src/options/a/atlas.css` | All styling, prefix `da-`. Layout by media query at 900px, so the server HTML is right on both phone and desktop |
| `src/options/a/style.ts` | The MapLibre style, hand-written on the OpenMapTiles schema |
| `src/options/a/aura.ts` | The wide glow around an island: convex hull of the outline, added to the map at run time |
| `src/options/a/prefetch.ts` | Warms the HTTP cache with the destination's tiles when a flight starts |
| `src/options/a/Card.tsx` | Card head, the six sections, the coming-soon body, the action buttons |
| `src/options/a/Sheet.tsx` | Bottom sheet: peek / half / full, drag with momentum, spring |
| `src/options/a/PhotoStage.tsx` | The Photos side of the Map / Photos toggle |
| `src/options/a/Search.tsx` | Search pill on the shared `useIslandSearch` hook |
| `src/options/a/viz.tsx` | Ring gauge, meter, trend mark, IUCN scale, stamp mark |
| `src/options/a/hooks.ts`, `fonts.ts`, `strings.ts` | Small hooks, the two typefaces, option-only strings (TEC-12) |
| `src/options/a/Lab.tsx`, `src/app/lab/option-a/page.tsx` | The lab route |
| `scripts/scratch/v2-option-a-*` | Test scripts; output in `scripts/scratch/v2-option-a-out/` |

No shared file was edited.

## The sequence

`data-phase` on the root: `idle` (landing) → `flying` (island chosen) → `landed` (card open).

1. **Spin.** 5°/s, resumes 4.2 s after a touch. A slow double ring pulses on each participating island's dot (a DOM marker through `renderMarker`; the dot itself is a map layer).
2. **Choose** by search, by tapping the globe, or by an island chip. The headline folds away, the search rides to the top, and a name plate rises from the bottom ("Flying to Bohol") while the camera rises, turns and dives. Flight speed is the engine's derived duration × 1.22: about 4 s from the home view to Bohol, about 6.5 s to Moorea.
3. **Land.** In `onArrive` the island's glow blooms first (a wide aura plus a bright core on the true outline, 0.8 s fade), and the card follows 320 ms later (`CARD_AFTER_GLOW_MS`): the sheet springs to half height, or the desktop panel unfolds from its name plate, and the content staggers in. After 1.3 s the glow settles to a steady level.
4. **Leave** with Escape, the close button, a flick down on the sheet, or the browser's Back. The card drops, the camera flies out, and the words return once the globe is nearly home. Escape on the Photos view goes back to Map first.

The selection lives in `useOption()`, so `?island=` deep links and an option switch keep the island open. The first island opened pushes one history entry, so Back returns to the globe rather than leaving the page.

## The card

Phone: bottom sheet. Peek (118 px) is the name plate. Half shows name, hero photo with three figures at a glance, the row of section tabs, and the action bar. Full scrolls. A tab tapped at half opens the sheet and goes to that section. Desktop (900 px and up): a 448 px frosted panel on the left with its own scroll and a footer for the actions.

Sections, in the client's order, all from `island.card`:

1. About: headline, text, a four-cell fact table, a photo strip (tapping a photo opens the Photos view at it).
2. Tourism impact: stat tiles (ring gauges for percentages, pictograms for counts), "Under pressure" and "Tread lightly" lists.
3. Endangered species: a swipeable row of cards with the IUCN category and its place on the five-step scale.
4. Water quality and reef: the reef health ring, then metrics with meters.
5. Conservation projects: cards with a progress meter.
6. Collect a stamp here: "How a stamp is earned" with the three example thresholds as rising steps, then partners grouped into island stamps and official seals. Every row links to `/passport`.

Sample labelling (PUB-7): "Sample" by the brand, "Sample photo" on photos, "Sample data" / "Sample survey" on sections, "Example amounts. Each organisation sets its own." under the thresholds, "example" beside each amount, and the shared notice that donations happen on the charity's platform and none are processed here. The coming-soon "Notify me" form says nothing was sent or saved.

Coming-soon islands get a lighter card (tagline, teaser, notify form, a link to Bohol), apricot instead of turquoise on the map, and no stamp actions.

## The map style (`style.ts`)

Written from scratch rather than through `base.build`, because the coastline, shallows and graticule sit between base layers.

- Sea `#bfe0f6`, turning slightly lagoon-green below zoom 11. Land `#f9edd2` with Natural Earth relief as a soft tint and sage landcover. White coastline with a pale blurred band of "shallows".
- A faint white graticule (20° grid) so open ocean still reads as a turning globe; gone by zoom 5.5.
- Country names in spaced capitals, sea names in italics. Towns from zoom 8.4, villages from 11.5, roads from 7.8, buildings from 14.
- Islands: turquoise fill and outline for participating ones (the open island's fill drops to 13% so its land shows), dashed apricot for coming soon, dots and names that follow the engine's per-island zoom thresholds.
- MapLibre `sky` with a low `atmosphere-blend` (0.12 at the globe, 0 by zoom 6.5). The rest of the "sunny day from orbit" is CSS over the map: the engine's shade and halo recoloured through `--globe-*`, plus two children of `<Globe>`: `.da-depth` (the sea deepening toward the poles) and `.da-air` (a bright rim that falls away into sky blue). Both follow `--globe-x/y/r/t` and disappear once the planet fills the screen.

### Things implemented here because the engine does not offer them

- **Aura on a convex hull** (`aura.ts`). A wide blurred line on a real coastline, or on the engine's rounded `island-glow` source, still spikes where the coast has detail finer than the line (the foundation's known issue 4). The aura instead follows each island's convex hull, thinned so no segment is shorter than the glow is wide, pushed out 3.5% and smoothed. It is a GeoJSON source (`da-aura`) and layer (`da-bloom`) added in `onReady` from the outlines the engine already loaded (`source.getData()`). The narrow glow layers on `island-glow` were made narrower for the same reason.
- **Tile warming** (`prefetch.ts`). At the start of a flight it fetches the destination's vector tiles for the last few zoom levels (at most about 20 small requests, skipped with Save-Data) so the end of the dive is not drawn from coarse parent tiles. Tiles are immutable and cached.
- **Relief capped at the globe's own tile level** (zoom 2 on a phone, 3 on a larger window). Deeper relief levels were the largest single cost of the dive under CPU throttling (two 100 ms frames); below the globe view the relief is only a tint, which the coarse tiles give.
- **Credits position.** `.da .ipg-credit` is moved by CSS on a phone: into the bottom row on the landing, just above the name plate during a flight.
- **Desktop first paint.** The server renders the phone padding (it cannot know the width). Until hydration, CSS overrides `--ipg-pad-*` and `--ipg-size` on `.ipg-stage` at 900 px and up, so the poster globe is already where the desktop layout puts it.

## Accessibility and motion

- Document order is words, search, island chips, then the map, then the card, so a keyboard reaches the search first. The search is the shared ARIA combobox; island chips and map markers are buttons.
- The card is a labelled, non-modal dialog. Focus moves to it on arrival (not while a text field has focus, so a phone keyboard is not disturbed), and returns to what opened it on close; the search field gets focus back without reopening its list.
- A polite live region announces "Flying to …" and "Arrived at …".
- Reduced motion: no spin, no flight, the card opens at once, meters are drawn, all CSS animation is cut.
- Text contrast (computed): on white, ink `#12293a` 15.0:1, body `#37505f` 8.5:1, muted `#4f6271` 6.3:1, turquoise text `#06706d` 5.9:1, apricot text `#ad4a25` 5.6:1; on the palest sky blue, muted 5.1:1 and turquoise text 4.8:1; white on the primary button 5.0:1 at its lightest point; IUCN labels 6.0:1 or more. Turquoise `#0fb5ae` is used for marks only, never for text.
- Inputs are 16 px (no iOS zoom). Small controls (close, Map / Photos, section tabs) have hit areas of 44 px or more.

## Measured

Chromium on this machine's GPU, CPU throttled 4x, the dev server (React in development mode), `/lab/option-a`. Not a real phone.

| | phone 390x844 @2x, CPU 4x | desktop 1280x800, CPU 4x | desktop, no throttle |
| --- | --- | --- | --- |
| Spin | 60 fps, worst frame 17 ms | 60 fps | 60 fps |
| Fly to Bohol | 54 fps, 5 frames over 34 ms | 42 fps, 15 over 34 ms | 60 fps, none |
| Fly to Moorea | 59 fps, 2 over 34 ms | 46 fps, 17 over 34 ms | 60 fps, none |
| Fly to Balicasag | 56 fps, 8 over 34 ms | 45 fps, 24 over 34 ms | 60 fps, none |
| Card entrance | 59 to 60 fps | 59 to 60 fps | 60 fps |
| Fly home | 51 fps, 4 over 34 ms | 37 fps, 12 over 34 ms | 60 fps, none |

The median frame is 16.7 ms in every row. The worst frame of a flight is the one at the tap (about 135 ms at 4x), which is React mounting the sheet; a CPU profile attributes most of the script time in it to `jsxDEV`, which a production build does not have. The card's long body is mounted through `useDeferredValue`, which cut that frame from about 285 ms.

Behaviour checks: `node scripts/scratch/v2-option-a-behaviour.mjs`, 45 of 45 pass (keyboard flow, focus, Back and Forward, share, tabs, touch drag between all three snaps, flick to close, coming soon, reduced motion, no WebGL, deep link, first paint without script). `tsc --noEmit` and `eslint src` report nothing in `src/options/a` or `src/app/lab/option-a`.

Other scripts: `-shot` (one screenshot), `-seq` (film strip of the sequence), `-card` (the card scrolled through), `-states` (coming soon, photos, close, search), `-sizes` (five viewport sizes), `-perf`, `-perf2`, `-perf3`, `-prof`, `-nojs`, `-sheet.py` (contact sheets).

## Decisions

- **Half sheet is a summary, not a cut-off page.** It holds exactly the name, photo, tabs and actions, so the map stays visible above it and the tabs show what the card contains.
- **Glass only at rest.** The sheet and panel are opaque while the camera moves and frosted once landed: a live blur over a moving WebGL canvas is the most expensive thing to ask of a phone.
- **The demo's switcher shares the phone's action bar.** With the bar showing, the A · B · C pill sits in its left end (`--opt-switch-lift`); without the switcher (the lab) the button takes the full width.
- **Photo placeholders are pale.** A missing photo gets dark type and no scrim, so placeholders look intended. Real photos swap in through the manifest with no code change.
- **Share** uses `navigator.share` on touch devices when it exists and otherwise copies the link and says so (in-app browsers often lack `navigator.share`).

## Known issues

1. **`/?option=a` cannot be shown until option C's missing stylesheet exists** (above). Option A was verified only on the lab route, with and without the switcher.
2. **Not tested on a real phone, on iOS Safari, or in the Instagram, TikTok and Facebook in-app browsers.** Sheet dragging uses non-passive touch listeners and was exercised with synthetic touch events in Chromium only.
3. **Frame rates are from a development build on a desktop GPU.** Under 4x CPU throttling a desktop-sized window drops to 37 to 46 fps in flight; unthrottled it holds 60.
4. **Only `bohol-hero` is a real photo.** The other slots show placeholders until the files are dropped in `assets-raw/photos/` and `scripts/process-photos.py` is run.
5. **Sample data shows "Sample survey, January 2027"**, a date in the future (`reef.updated` in `src/lib/islands/data.ts`, not my file).
6. **Tablet widths (600 to 899 px) get the phone layout** stretched to full width. It works, but it was not designed for.
7. **The flight cannot be re-timed in stages.** The engine exposes one `speed` for the whole flight, so a longer dive also means a longer rise. From the home view to Bohol the first 1.8 s is mostly the rise and turn.
8. **A coming-soon island with a deeply concave outline** (Moorea) shows its aura as a visible soft ring a little way off the shore, because the aura follows the hull.
9. **Map labels can sit under the search pill or the credits** at island zoom ("Cebu City", "Pamilacan"). MapLibre does not know about the UI above it.
