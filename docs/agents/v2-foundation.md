# v2 foundation handoff: globe, islands, options

What the three option designers build on. Live reference: `http://localhost:3100/lab/globe-core` (engine with every control) and `http://localhost:3100/` (the starter landing in options A, B, C).

Routes: `/` is now the globe landing. The passport demo moved, unchanged, to `/passport`.

## Files

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Home. Reads `?option=` and `?island=` on the server, mounts `OptionProvider` and the landing |
| `src/app/passport/page.tsx` | The old home demo (`<Demo />`), plus the cover-texture preload it used to get from the layout |
| `src/app/lab/globe-core/page.tsx` | Engine lab |
| `src/options/index.ts` | Registry: `OPTION_LANDINGS.a/b/c`, each a lazy chunk of `src/options/<id>/index.tsx` |
| `src/options/{a,b,c}/index.tsx` | **Yours to replace.** Default export = full-screen Landing, no props. Currently the starter |
| `src/lib/options/` | Option system: `OptionProvider`, `useOption`, palettes, boot script, strings |
| `src/lib/islands/` | Island data, types, strings, fuzzy search (`searchIslands`, `useIslandSearch`), photo slots |
| `src/components/globe/` | The engine: `Globe`, style builders, camera maths, poster, CSS |
| `src/components/options-ui/` | `OptionSwitcher`, `OptionStage`, `IslandSearch`, `Photo`, `StarterLanding` |
| `public/geo/islands.geojson`, `island-labels.geojson` | Real island outlines and label points from OpenStreetMap |
| `public/photos/`, `src/lib/islands/photos.manifest.json` | Processed photos and their manifest |
| `scripts/fetch-coastlines.mjs` | Fetches outlines (Overpass). Input: `src/lib/islands/osm-sources.json` |
| `scripts/fetch-coastlines.land.mjs` | World land outline for the static poster (Natural Earth 110m) |
| `scripts/process-photos.py` | Raw photos to WebP renditions and the manifest |

## Writing an option

Replace `src/options/<id>/index.tsx`. Keep `"use client"` and a default export with no props. Everything you need is imported from four places:

```tsx
"use client";
import { useMemo, useRef, useState } from "react";
import { Globe, type GlobeHandle, type StyleInput } from "@/components/globe";
import { IslandSearch, Photo } from "@/components/options-ui";
import { getIsland, islandStrings, isLive } from "@/lib/islands";
import { useOption } from "@/lib/options";

export default function LandingA() {
  const { selectedIslandId, selectIsland } = useOption();   // shared by A, B and C
  const globe = useRef<GlobeHandle>(null);
  const [cardFor, setCardFor] = useState<string | null>(null);
  const style = useMemo<StyleInput>(() => (base) => base.build(MY_MAP_PALETTE, { relief: 0.5, islands: MY_ISLAND_COLORS }), []);

  const open = (id: string) => { setCardFor(null); selectIsland(id); void globe.current?.flyToIsland(id); };
  const close = () => { setCardFor(null); selectIsland(null); void globe.current?.resetView(); };

  return (
    <main style={{ position: "fixed", inset: 0 }}>
      <Globe ref={globe} style={style} selectedId={selectedIslandId} onSelect={open}
             onArrive={setCardFor}              // camera has landed: pop the card
             autoRotate={7} padding={cardFor ? { bottom: 380 } : undefined} />
      <IslandSearch onSelect={(island) => open(island.id)} />
      {/* your card, driven by getIsland(selectedIslandId) and cardFor */}
    </main>
  );
}
```

`src/components/options-ui/StarterLanding.tsx` is this pattern in full (bottom sheet on a phone, side panel on a desktop). Copy from it freely; do not import it into a finished option.

Rules that will save you time:

- **Open the card in `onArrive`, not in `onSelect`.** `onArrive(id)` fires when the camera has come to rest on the selected island: after a flight, and at once when no flight was needed (after an option switch the new globe is already there; reduced motion; no WebGL). It is the one signal that works in every case.
- **Keep the `style` reference stable** (`useMemo` or module scope). A new reference restyles the map.
- **Selection lives in `useOption()`**, not in your component, so switching A/B/C keeps the same island open, and `?island=` deep links work.
- Call `globe.current.flyToIsland(id)` as well as `selectIsland(id)` when the visitor picks an island. The engine flies by itself when `selectedId` changes, but only the explicit call re-centres an island that was already selected.
- The switcher is rendered for you by the stage. Do not render another.
- Fonts: the `--nf-*` variables from the root layout are available (`--nf-fraunces`, `--nf-hanken`, `--nf-cormorant`, `--nf-cinzel`, `--nf-nunito`, `--nf-archivo`, `--nf-plex-mono`). Set `--o-font` on your root to change the typeface of the shared pieces. Map labels drawn by MapLibre can only use OpenFreeMap's Noto Sans; for brand type on the map use `renderMarker`.
- The passport's light/dark theme does not apply here. While an option is mounted the page is forced light.

## Option system (`@/lib/options`)

Options `a | b | c` are a separate concept from the passport's art directions. `<html>` carries `data-option`. Precedence on load: `?option=`, then `localStorage["ip.option"]`, then `a`.

```ts
const { option, palette, ready, setOption, cycleOption, selectedIslandId, selectIsland } = useOption();
```

- Switching replaces the URL query without a navigation: `/?option=b&island=panglao` is always a shareable link to what is on screen. Back/forward are followed.
- `palette` is the option's starter `OptionPalette`. It is published as CSS variables under `[data-option]`:
  `--o-bg --o-bg-alt --o-surface --o-ink --o-ink-muted --o-line --o-accent --o-accent-ink --o-accent-soft --o-second --o-ocean --o-ocean-deep --o-land --o-green --o-shore --o-halo --o-theme-color`.
  The starter palettes (lagoon, sunwashed, paper atlas) are placeholders. Restate any `--o-*` on your landing's root to restyle the shared pieces, or ask for your entry in `palettes.ts` to be changed.
- `OptionSwitcher`: the floating "A · B · C" pill, bottom-left on a phone, top-right from 768px. Radio group with arrow keys; number keys 1, 2, 3 switch from anywhere unless typing. To move it clear of your UI set on `<html>` (or any ancestor): `--opt-switch-lift` (extra distance from the bottom on phones; the starter lifts it above its sheet), `--opt-switch-top`, `--opt-switch-right`.
- Switching option swaps the whole landing, so the globe remounts. The engine remembers its camera in memory (`view-memory.ts`) and the next globe starts exactly there with a 180 ms fade, so it reads as a restyle. Opt out with `restoreView={false}`.

## Island data (`@/lib/islands`)

```ts
ISLANDS, LIVE_ISLANDS, COMING_SOON_ISLANDS, getIsland(id), FEATURED_ISLAND_ID, HOME_VIEW, TOUR_ORDER
```

`GlobeIsland = LiveIsland | ComingSoonIsland` (`isLive()` narrows). Every island has `id, name, aliases, country, countryCode, region, coordinates [lng, lat], bbox [w, s, e, n], areaKm2, rank (1 = marked from globe altitude, 2 = appears in its region), parentId?, tagline, status, view?`.

- Live: `bohol` (richest), `panglao`, `balicasag`, `pamilacan`, `banacon`. Coming soon: `siargao`, `palawan` (shown as "El Nido, Palawan"), `koh-tao`, `gili-air`, `moorea`, `bonaire` (each has a two-sentence `teaser`).
- `island.card` (live only) follows Dan's section order:
  `description { headline, body[], facts[] }`, `hero`, `photos[]`, `tourism { summary, stats: Metric[], pressures[], tips[] }`, `species[] { name, scientific, iucn, note, art?, photo? }`, `reef { healthIndex { value, max: 100, label, trend }, summary, metrics: Metric[], updated, photo? }`, `projects[] { title, organisation, summary, progress?, photo?, art? }`, `partners[] { name, type, handle?, blurb, offer { kind, title, art, shape, threshold { amount, currency, display }, charity, purpose, passportSlotId? } }`.
- `Metric` carries both `value` (for meters and charts, with optional `max`) and `display` (ready to print), plus `trend` and `note`.
- Partner types cover creator, travel agency, local business, charity, tourism board, government. `offer.kind` is `stamp | tourism-seal | government-seal` with example thresholds $5 / $50 / $100. `offer.art` and `offer.shape` feed the existing `<Stamp>`; `passportSlotId` links to the sample passport.
- **Strings** are in `islandStrings` (`@/lib/islands`): section titles, CTA labels ("Collect a stamp", "Open passport", "Share"), the Map / Photos toggle labels, IUCN names, partner type names, status labels and the sample notices. Use them so the three options say the same thing. Fill placeholders with `t()` from `@/lib/strings`.
- **Sample labelling (PUB-7)**: everything here is sample content. Show `islandStrings.sample.tag` or `.data` wherever figures appear, `.thresholds` next to amounts ("Example amounts. Each organisation sets its own."), and `.donationPlatform` / `.noDonations` near any donate or collect action. Never imply money moves in the demo.
- CTAs: "Collect a stamp" and "Open passport" link to `/passport` for now.
- Nothing is tied to the Philippines (TEC-11): to add an island add a record in `data.ts` and an entry in `osm-sources.json`, then run `node scripts/fetch-coastlines.mjs <id>`.

### Search (UX-1a)

- `searchIslands(islands, query, { limit })`: pure fuzzy match on name, aliases, region and country. Ignores case and accents, matches word starts ("hills" finds Bohol), skipped letters ("bhl") and typos ("pangloa"). Live islands win ties. An empty query returns all islands.
- `useIslandSearch({ islands?, onSelect, limit?, browseWhenEmpty?, afterSelect? })`: headless combobox. Returns `query, setQuery, results, open, activeIndex, select, clear, inputProps, listProps, optionProps(i), inputId`. Spread the props and you have the full ARIA pattern and keyboard handling.
- `<IslandSearch onSelect placeholder? placement="below|above" onFocusChange? className? />`: the default box built on the hook. Classes `ips-*`, colours from `--o-*`. The input is 16px so iOS does not zoom.

## Globe engine (`@/components/globe`)

MapLibre GL JS 5 with `projection: globe`, OpenFreeMap vector tiles (no key, global). MapLibre is imported after first paint; until its first frame the visitor sees an SVG poster of the same view.

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `style` | `StyleSpecification \| (base) => StyleSpecification` | required | Your map style. Keep the reference stable |
| `islands` | `GlobeIsland[]` | all | |
| `selectedId` | `string \| null` | `null` | Glowing outline; flown to when it changes |
| `onSelect` | `(id) => void` | | Tap on an outline, dot, label or marker. Coming-soon islands too (see `selectable`) |
| `onArrive` | `(id) => void` | | Camera at rest on the selected island. Open the card here |
| `onBackgroundClick` | `() => void` | | Tap that hit no island |
| `autoRotate` | degrees/second | `0` | 6 to 8 reads calm. Pauses on any interaction, resumes after `rotateResumeMs` (6000). Off while an island is selected, in flight, off-screen, in a hidden tab and with reduced motion |
| `padding` | `{ top, right, bottom, left }` px | none | Area covered by your UI. Islands and the globe are framed in what is left. Changes animate |
| `globeSize` | number | `0.86` | Globe diameter in the home view as a share of the free area's shorter side. Above 1 crops the globe at the edges |
| `homeCenter` | `[lng, lat]` | `HOME_VIEW.center` | Where the globe faces at rest |
| `interactive` | boolean | `true` | `false` for a decorative globe |
| `flyOnSelect` | boolean | `true` | |
| `selectable` | `"all" \| "live"` | `"all"` | |
| `renderMarker` | `(island, { selected, live }) => ReactNode` | | DOM marker per island, as a real button (keyboard reachable, web fonts, CSS animation). Return `null` to skip |
| `staticImage` | URL | | Replaces the built-in poster |
| `restoreView` | boolean | `true` | |
| `maxPixelRatio` | number | `2` | |
| `attribution` | corner | `"bottom-right"` | Credits sit inside the free area, so a sheet never covers them. Keep them visible |
| `children` | node | | Rendered over the map, inside the box, with the `--globe-*` variables in scope |
| `onReady(map)`, `onStatusChange(status)`, `onFlightStart(id)`, `onFlightEnd(id, completed)`, `onUserInteraction()` | | | |

### Handle

```ts
globe.current.flyToIsland(id, { duration?, speed?, viaGlobe?, zoom?, fill?, bearing?, pitch?, animate? }): Promise<boolean>
globe.current.resetView(options?): Promise<boolean>
globe.current.tour(ids, { dwellMs = 2600, loop?, viaGlobe?, onStep?, onArrive? }): Promise<boolean>
globe.current.stop()
globe.current.snapshot({ type?, quality?, background?, maxSize? }): Promise<string>   // data URL
globe.current.map(): MapLibreMap | null
globe.current.whenReady(): Promise<void>
```

- Promises resolve `true` on arrival and `false` when interrupted (the visitor touched the map, or another flight started). All are safe to call before the map has loaded.
- **Choreography** (`camera.ts`, `planFlight`): rise to an altitude from which the trip is in view (at most the whole globe) while rotating along a great circle; a camera already at the top breathes out slightly on a long trip; then dive. Rotation finishes early in the dive, so the island is centred and still while the camera comes down. Duration is derived (0.9 to 5.6 s); `speed: 0.7` makes it brisker.
- `tour` is for the passport cover: it highlights each island as it goes, and any touch stops it. `viaGlobe: true` pulls back to the whole globe between islands.
- `snapshot` reads the canvas inside a render, so `preserveDrawingBuffer` stays off. JPEG by default with `--o-bg` behind the globe; `type: "image/png"` keeps transparency.

### Styling the map

`style={(base) => base.build(palette, options)}` gives a lean light style from your colours:

```ts
base.build(
  { ocean, land, green, ice, sand, shore, border, river, road, roadMinor, building, label, labelMuted, labelHalo, waterLabel },
  { labels: "none" | "minimal" | "full", relief: 0..1, reliefSaturation, roads, buildings, islands: IslandColors | false, atmosphere, extraLayers },
)
base.paletteFromOption(palette)        // map colours from an OptionPalette
base.islandColorsFromOption(palette)   // { live, liveFill, soon, soonFill, glow, contrast, label }
base.islandLayers(colors)              // the default island layers, to append to a hand-written style
```

- `relief` adds Natural Earth shaded relief under the land up to zoom 8. It gives the globe most of its texture; 0.45 to 0.6 works on light palettes.
- `labels: "minimal"` is the default because labels are the costliest thing on a spinning globe.
- Or pass a complete `StyleSpecification` of your own. Layer ids of OpenFreeMap's `positron` and `liberty` styles are a good reference. Source layers follow the OpenMapTiles schema.

**Island layer hooks.** Whatever the style, the engine injects three GeoJSON sources:

| Source (`base.sources.*`) | Geometry |
| --- | --- |
| `islands` | outlines as mapped |
| `island-glow` | the same outlines simplified and rounded. Use this for wide blurred strokes: on the real coastline they pile up into dark spikes |
| `island-points` | one point per island |

Feature properties: `id, name, country, status, rank, minZoom, dotZoom`. Feature states set by the engine: `selected`, `hover`, `dimmed` (every other island while one is selected). Ready-made expressions: `base.expr.selected / hovered / dimmed / live`, and `base.expr.perZoom(z => ...)` with `appear(z)` and `dotFade(z)` for opacity that follows each island's own zoom thresholds (MapLibre needs the zoom ramp outermost; put every factor inside it). Any layer on `islands` or `island-points` is automatically a tap target. `islandLayers()` in `style.ts` shows all of it: live fill, dim fill, two-stroke glow, outline, dots, labels.

**CSS hooks.** On the root `.ipg`: `data-status` (`poster | ready | lost | fallback`), `data-altitude` (`globe | region | island`), `data-space` (`false` once the planet fills the box), `data-flying`, `data-rotating`, `data-touring`, `data-quality`. On `.ipg-stage` (in scope for `children`): `--globe-x`, `--globe-y` (centre, px), `--globe-r` (silhouette radius, px), `--globe-t` (0 at rest to 1 as the planet outgrows the box).

Variables you can set on `.ipg` or an ancestor: `--globe-halo` (glow behind the globe), `--globe-shade`, `--globe-shine` (rim shading and highlight that make the disc a ball; `transparent` removes them), `--globe-ocean`, `--globe-land`, `--globe-shore`, `--globe-dot`, `--globe-dot-soon` (poster colours; default to the option palette, so set them if your map colours differ), `--globe-credit`, `--globe-credit-bg`.

Markers: the button gets `data-live`, `data-selected`, `data-near` (`true` once the outline is big enough to see, so fade your dot then), and is hidden below the island's minimum zoom and behind the globe.

### What the engine already handles

- **First paint (UX-7)**: `GlobePoster` is server-rendered SVG, sized by CSS container units, projected with the same perspective as the live home view. The live map fades in over it. MapLibre (about 275 KB gzipped) and the outlines (84 KB gzipped) load after hydration.
- **No WebGL**: checked before MapLibre is downloaded. The poster stays, its island dots become buttons, `onSelect` and `onArrive` still fire, the handle's promises resolve at once.
- **Context loss**: status goes to `lost` and the poster returns. MapLibre recovers by itself when the browser hands the context back; if it does not within 2.5 s a "tap to bring it back" button rebuilds the map.
- **Reduced motion**: no spin, flights are cuts, tour dwells longer.
- **Resize and rotation**: the home view and a framed island are re-fitted.
- **Adaptive quality**: if frames average worse than about 38 fps while moving, the pixel ratio drops 2, 1.5, 1.
- **Map errors**: network errors are silent; a mistake in your style is logged with `console.error` in development.
- **Keyboard**: the canvas is focusable (arrows pan, plus and minus zoom); markers and search make islands reachable without a pointer.

## Photos

Drop files in `assets-raw/photos/` and run:

```
python3 -I scripts/process-photos.py assets-raw/photos public/photos
```

Names are forgiving ("Chocolate Hills.jpg" becomes `bohol-chocolate-hills`). Output: WebP at 640, 1280 and up to 1920 wide, plus the manifest with size, average colour and a blurred preview. EXIF orientation is applied and metadata dropped. `bohol-hero` is picked up from `assets-raw/bohol-hero.png` and is processed now; it is the Chocolate Hills at sunrise.

```tsx
<Photo name="bohol-tarsier" sizes="(min-width: 900px) 380px, 92vw" aspect={4 / 5} priority />
<Photo name="bohol-hero" aspect="fill" position="50% 70%" />   // covers a positioned parent
```

Until a photo exists `<Photo>` draws a placeholder: a soft gradient from the option palette with a faint line drawing of the subject (four moods, so a gallery is not monotone). The swap is automatic. Slots: `bohol-hero`, `bohol-chocolate-hills`, `bohol-alona-beach`, `bohol-balicasag-reef`, `bohol-tarsier`, `bohol-pamilacan-dolphins`, `bohol-mangroves`, `bohol-reef-aerial`, `bohol-coral-closeup`, `bohol-conservation`, `bohol-loboc-river`. Helpers: `hasPhoto`, `photoAsset`, `photoSources`, `photoAspect`, `PHOTO_SLOTS`.

## Measured

Chromium with the machine's GPU (Metal), CPU throttled 4x, `/lab/globe-core`, relief on, minimal labels:

| | phone 390x844 @2x | desktop 1280x800 |
| --- | --- | --- |
| Spin | 60 fps, worst frame 17 ms | 60 fps, worst 17 ms |
| Fly to Bohol | 58 fps, 2 frames over 34 ms, worst 67 ms | 57 fps, 3 over 34 ms, worst 67 ms |
| Fly to Balicasag | 59 fps, 1 over 34 ms, worst 50 ms | 59 fps, 1 over 34 ms, worst 50 ms |
| Fly to Moorea | 60 fps, none over 34 ms | 56 fps, 3 over 34 ms, worst 50 ms |
| Reset | 59 fps, none over 34 ms | 56 fps, 1 over 34 ms, worst 117 ms |

Numbers are from the last of three runs; flights varied between 54 and 60 fps across runs, and one early run had a single 483 ms frame on the first dive to Balicasag that did not recur.

This is main-thread cost on a fast GPU, not a phone's GPU. It has not been run on a real mid-range Android. The long frames are tile uploads and first-use shader compiles during a dive.

Scripts in `scripts/scratch/v2-foundation-*`: `behaviour.mjs` (33 checks: flights, tour, snapshot, search, tap, context loss, deep link, option switch, storage, reduced motion, no WebGL), `routes.mjs` (console check of `/`, `/passport`, every lab), `perf.mjs`, `flight.mjs` (film strip), `shot.mjs`. Import `launch` from `v2-foundation-browser.mjs`: `launch()` is software WebGL for stable pixels, `launch({ gpu: true })` uses the real GPU. Use the GPU for anything about motion; software WebGL stalls for seconds on desktop-sized frames.

## Decisions

- **Own minimal CSS instead of `maplibre-gl.css`**: only the canvas, touch-action and marker rules are needed, and the credits are our own element.
- **Selection above the landings**: in `OptionProvider`, so it survives a switch and is in the URL.
- **Status comes from the island data, not the GeoJSON**: the engine stamps `status`, `name`, `rank` onto features at load, so flipping an island to live needs no script run.
- **"El Nido, Palawan"**: the outline is all of Palawan; the label and the camera go to El Nido.
- **Card content is plausible, not sourced.** Place descriptions stick to what is commonly known. All figures, organisations and thresholds are invented and typed as sample.

## Known issues

1. **`src/app/layout.tsx` still preloads the passport cover texture when the path is `/`** (about 300 KB, high priority, never used by the globe). Not my file. One-token fix in `headBootScript`: `location.pathname==="/"` to `location.pathname==="/passport"`. Until then `src/lib/options/boot.ts` removes the `<link>` during parse, which cancels the download when it is still in flight (always on a real network; on localhost it sometimes finishes first and Chrome logs a "preloaded but not used" warning). `/passport` does its own preload from the page. After the fix, delete both stopgaps.
2. **Chrome on macOS logs a WebGL "READ-usage buffer" performance warning** from MapLibre's own globe precision check. Upstream behaviour, warning level, harmless.
3. **Small spikes can remain in the glow** where an island has a thin spit (Panglao's west tip). Much reduced by the rounded glow source; narrower strokes remove the rest.
4. **Bohol's poster dot hides Siargao's and Palawan's** at globe scale; on the live map the labels resolve it. In fallback mode only live islands are named until hover or focus.
5. **Outlines are 281 KB (84 KB gzipped)**, more than half of it Palawan and Siargao. A coarser tolerance for coming-soon islands would halve it.
6. **Option switch remounts the map** (about 0.3 s to the first frame from cache). The camera and selection are kept; tiles are re-requested from the HTTP cache.
7. **Not tested in real Instagram, TikTok or Facebook in-app browsers**, nor on iOS Safari. Storage failures are caught and the option still applies for the visit.
8. `tour` is implemented and exercised in the lab, but nothing uses it yet (it is for the passport cover).
