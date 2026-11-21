# Foundation handoff

> **Updated by the polish round.** Timings, props and layout numbers below may be out of date. `docs/agents/polish.md` lists what changed and is the current reference where the two disagree.

Shared types, design tokens, theme, strings, sample data, the asset pipeline and the `<Stamp />` renderer.
Live gallery: `http://localhost:3100/lab/stamp` (all stamps, statuses and directions; use it as the visual reference).

## Files

| Path | What it is |
| --- | --- |
| `src/lib/types.ts` | `Stamp`, `StampSlot`, `Island`, `PassportData`, `PassportProgress`, `StampStatus`, `StampKind`, `StampShape`, `StampArt`, `DirectionId`, `ThemeMode`, and the book contract `PassportBookProps` / `PassportBookHandle` |
| `src/lib/directions.ts` | Token sets for `classic`, `reef`, `journal` (`DIRECTIONS`, `DIRECTION_LIST`, `getDirection`), `directionsCss()`, `themeBootScript`, `STORAGE_KEYS`, `hexToRgba` |
| `src/lib/strings.ts` | Every on-screen string (`strings`), `t(template, vars)`, `formatStampDate`, `formatDate`, `stampDateParts`, `statusLabel` |
| `src/lib/sample-data.ts` | `SAMPLE_PASSPORT`, `SAMPLE_ISLANDS`, `SAMPLE_PROVINCIAL`, `DEMO_SCRIPT`, and pure helpers |
| `src/lib/assets.ts` + `assets.manifest.json` | `artUrl(name)`, `textureUrl(name)`, `hasGeneratedArt`, `allArtUrls()` |
| `src/components/stamp/` | `Stamp`, `VerifiedSeal`, `sealAnchor`, `stampTilt` (import from `@/components/stamp`) |
| `src/components/theme/` | `ThemeProvider`, `useTheme`, `DirectionScope`, `useDirectionId`, `useDirectionTokens`, `ThemeSwitcher`, `ModeToggle` (import from `@/components/theme`) |
| `src/app/globals.css` | Tailwind theme mapping, material classes, stamp and switcher CSS |
| `src/app/layout.tsx` | Fonts, token `<style>`, no-flash boot script, `<ThemeProvider>` |
| `src/app/lab/stamp/page.tsx` | The gallery |
| `public/stamps/*.svg` | Seven placeholder line drawings |
| `scripts/process-stamps.py` | Raw art to ink masks and textures, rewrites the manifest |

`src/app/page.tsx` is untouched.

## Theme

`<html>` carries `data-direction="classic|reef|journal"` and `data-theme="light|dark"`. The provider is already mounted in the root layout.

```tsx
import { useTheme, ThemeSwitcher, DirectionScope } from "@/components/theme";

const { direction, mode, tokens, setDirection, setMode, toggleMode, cycleDirection, ready } = useTheme();

<ThemeSwitcher />                    // chips with names + light/dark toggle
<ThemeSwitcher variant="compact" />  // swatches only, about 170px wide
<ThemeSwitcher hideMode />           // chips only; <ModeToggle /> is exported separately
<DirectionScope direction="reef">…</DirectionScope>  // re-theme a subtree (light/dark still follows <html>)
```

- Persisted in `localStorage` (`ip.direction`, `ip.theme`), wrapped in try/catch. With nothing stored, the mode follows the system setting.
- The switcher is a radio group: arrow keys, Home and End move between directions and it stops those keys from bubbling, so it will not flip passport pages.
- `tokens` is the full `DirectionTokens` object for cases CSS variables cannot cover (canvas, share images).

### CSS variables

Passport (same in light and dark; the passport is a physical object):

`--cover --cover-deep --cover-edge --cover-ink` · `--cover-image --cover-size --cover-repeat --cover-blend` ·
`--foil --foil-hi --foil-lo --foil-shadow --foil-gradient` ·
`--paper --paper-shade --paper-edge --paper-ink --paper-ink-muted --paper-line` · `--paper-image --paper-size --paper-repeat --paper-blend` ·
`--ink-discovery --ink-pending --ink-verified --ink-provincial --ink-empty` ·
`--ff-display --ff-body --ff-mono --ff-stamp --display-weight --display-tracking --display-variation --stamp-weight` ·
`--r-chip --r-card --r-passport --r-page`

Chrome and lighting (change with light/dark):

`--bg --bg-elev --bg-sunken --fg --fg-muted --fg-subtle --line --line-strong --accent --accent-fg --accent-soft --focus --scene` ·
`--status-discovery --status-pending --status-verified` (status colours that stay legible on the chrome background; use these for chips and ring segments, not the `--ink-*` colours, which are meant for paper) ·
`--passport-shadow` (box-shadow under the book) · `--passport-sheen` (gradient to lay over the cover) · `--page-dim` (tint to lay over pages; transparent in light mode) · `--scene-glow`

### Classes (globals.css)

| Class | Use |
| --- | --- |
| `mat-cover` | Cover material: leather, linen or kraft |
| `mat-paper` | Page material: guilloche, watercolour wash or grid |
| `mat-sheen` | Absolutely positioned overlay on a cover; lighting adapts to the mode |
| `mat-page-dim` | Absolutely positioned overlay on a page; dims paper on a dark stage |
| `foil-text`, `foil-fill` | Metallic foil. Animate `background-position` for a shine sweep |
| `scene-bg` | Stage background around the passport |
| `font-display` / `type-display` | Display face with the direction's weight, tracking and variation |
| `type-label` | Small tracked mono caps |
| `sample-tag` | The subtle "Sample" marker (PUB-7) |

Tailwind utilities are mapped: `bg-bg bg-elev bg-sunken text-fg text-muted text-subtle border-line text-accent bg-accent-soft bg-paper text-paper-ink text-paper-muted text-foil bg-cover text-ink-verified text-status-pending …`, `font-display font-body font-mono font-stamp`, `rounded-chip rounded-card rounded-passport rounded-page`, `shadow-passport`, `ease-out-soft ease-spring ease-press`, and a `dark:` variant keyed to `data-theme`.

Journal prints its cover type in dark ink (`--cover-ink`), not foil. Check `tokens.cover.material === "kraft"` before applying `foil-text` to cover type.

## Stamp

```tsx
import { Stamp, VerifiedSeal, sealAnchor, stampTilt } from "@/components/stamp";

<Stamp stamp={stamp} size={160} />                    // status comes from stamp.status
<Stamp stamp={stamp} status="verified" />             // override, e.g. preview the upgrade
<Stamp slot={slot} size={96} />                       // empty slot: dashed "Not yet collected"
<Stamp stamp={provincial.stamp} size={236} />         // Provincial: double ring, foil
<Stamp stamp={provincial.stamp} variant="empty" emptyLabel="1 more Verified to unlock" />
<Stamp stamp={stamp} inkProgress={motionValue} />     // press animation
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `stamp` | `Stamp \| null` | | The stamp to draw |
| `slot` | `StampSlot` | | Template for the empty placeholder when there is no stamp |
| `size` | `number` (px) | `160` | Square box. Must be a number: the ink filter is tuned from it |
| `status` | `StampStatus` | `stamp.status` | Override |
| `variant` | `"stamp" \| "empty"` | by `stamp` | |
| `inkProgress` | `number \| MotionValue<number>` | `1` | 0 = nothing printed, 1 = full impression. Blotchy reveal plus opacity. A MotionValue is applied straight to the DOM with no React re-render |
| `showLabels` | `boolean` | `true` | Island, promoter and date overlay (STM-5) |
| `showSeal` | `boolean` | `true` | Corner mark: foil seal (verified) or clock badge (pending) |
| `rotate` | `number \| false` | deterministic | Degrees. Default is a tilt of up to 5.5° derived from the id |
| `ink` | `"rough" \| "clean"` | `"rough"` | `clean` skips the SVG filter |
| `blend` | `"normal" \| "multiply"` | `"normal"` | `multiply` soaks ink into the paper pattern. Only on light paper |
| `detail` | `"auto" \| "compact" \| "full" \| "large"` | `"auto"` | Auto: compact below 120px (island name and art only), large from 220px (adds text rings to the seal and clock) |
| `emptyLabel` | `string` | "Not yet collected" | |
| `decorative` | `boolean` | `false` | Drops `role="img"` and the aria-label |
| `className`, `style` | | | On the root box |

How the statuses differ (STM-7), each with its own ink colour per direction:

- Discovery: crisp outline frame, one ink.
- Donation pending: dashed outer frame, dotted inner ring, paler ink, hollow clock badge in the lower-right corner. Never looks donated.
- Verified Supporter: the frame band is solid ink with the type reversed out of it, a light wash behind the art, and the gold-foil seal overlapping the lower-right corner.
- Provincial: scalloped foil edge, beaded foil ring, three-star crown, solid inked band.
- Empty: dashed outline in `--ink-empty`, ghost art, no tilt, no filter.

Hooks for animation:

- Root: `.ip-stamp` with `data-status`, `data-kind`, `data-shape`, `data-detail`. Inner layers: `.ip-stamp__tilt` (rotation), `.ip-stamp__ink` (everything inked), `.ip-stamp__art` (illustration), `.ip-stamp__seal` (foil SVG), `.ip-stamp__sealmark`, `.ip-stamp__pendingmark`.
- Press: animate transform and opacity on a wrapper and drive `inkProgress` 0 to 1 with a MotionValue. The gallery's Press button shows the pattern.
- Upgrade pending to verified: render `<Stamp status="verified" showSeal={false} />`, fly in a standalone `<VerifiedSeal size={…} />`, land it at `sealAnchor(stamp.shape)` (returns `{x, y, r}` as fractions of the box; multiply by `size`), then switch to `showSeal`. The seal inside the stamp is counter-rotated to stay upright; add `stampTilt(id)` to your wrapper if you need to match the tilt.
- `data-stamp-ink="clean"` on any ancestor removes the SVG filter from every stamp below it. Use it while a page is mid-flip if a slow phone drops frames, then remove it.

## Sample data

`SAMPLE_PASSPORT`: 12 slots over 5 islands. 6 collected (2 verified, 2 pending, 2 discovery), 6 empty, so the ring reads "6 of 12 Bohol stamps". The Provincial Stamp needs 3 verified and is not yet earned.

`DEMO_SCRIPT` names the beats so every agent animates the same stamps: `collectSlotId: "danajon-reef"` (empty slot that gets the new Discovery stamp), `upgradeSlotId: "pamilacan-dolphins"` (pending to verified, which makes 3 verified and unlocks the Provincial Stamp), `today`.

Helpers, all pure: `getProgress(p)`, `slotsByIsland(p)`, `collectedStamps(p)`, `findSlot(p, id)`, `stampForSlot(id, status, date)`, `withStampStatus(p, id, status)`, `withProvincialEarned(p)`, `provincialUnlocked(p)`.

Ring text: `t(strings.progress.ring, { n, total, province })`.

## Asset pipeline

1. Put raw images in `assets-raw/`. Names are forgiving: `stamp-sea-turtle.png`, `Sea Turtle.jpg` and `stamp_sea_turtle.webp` all work. Textures: `tex-cover-navy`, `tex-cover-teal`, `tex-cover-kraft`, `tex-paper`.
2. Run `python3 -I scripts/process-stamps.py assets-raw public/stamps`.
3. It writes `public/stamps/<name>.png` (512px transparent ink masks), `public/textures/<name>.webp` (longest side 1024) and rewrites `src/lib/assets.manifest.json`. `artUrl()` then returns the PNG, and `--cover-image` / `--paper-image` switch to the photographs. Nothing else changes.

To switch by hand, edit the manifest: add the base name to `"stamps"`, or `"tex-paper": "tex-paper.webp"` to `"textures"`. `--no-manifest` converts without touching it.

Brief for the generated stamp art, so the masks come out clean: pure black line art on a pure white background, square, 1024px or larger, one centred subject filling about 85% of the frame, even bold outlines (roughly the weight of the placeholders), no grey shading, no text, and no border or circle around it (the app draws the frame). Thin hairlines disappear at 80px.

## Known issues and notes

- Tested in Chromium only (the only browser installed here). The stamp relies on `filter: url(#…)` on an HTML element and `mask-image` (with the `-webkit-` prefix); both are long supported in WebKit, but check on a real iPhone inside Instagram before the pitch. `ink="clean"` or `data-stamp-ink="clean"` is the fallback if anything looks wrong.
- Each rough stamp carries its own small SVG filter (three `feTurbulence` passes). They rasterise once and are cheap when static. Anything that repaints a stamp every frame (animating its size, or a clip-path on an ancestor) re-runs the filter. Animate with transform and opacity, and use the `clean` escape hatch if a flip stutters under 4x CPU throttling. I did not profile the page-flip, because that component is not mine.
- Do not animate `inkProgress` on many stamps at once; one stamp at a time is smooth.
- Token CSS is generated on the server in `layout.tsx`. After editing `directions.ts`, a route occasionally kept serving the old token CSS until its own page file was saved again (seen once with the shared dev server). If a token change does not show up, re-save the route's `page.tsx`.
- `DirectionScope` scopes the direction only. Light/dark always comes from `<html>`.
- Placeholder art was produced by `scripts/scratch/foundation-gen-art.py` (throwaway, kept so the SVGs can be regenerated). The other `scripts/scratch/foundation-*` files are screenshot helpers. `foundation-browser.mjs` works around Playwright 1.65 expecting a newer Chromium build than the one installed, by pointing at the installed headless shell.
- Promoter text on ring stamps is short on purpose (it must clear the corner mark); long handles shrink to fit and become texture below about 200px. The stamp detail sheet (PAS-4) should carry the readable promoter name.
- The sample charity and promoter names are invented. I did not check them against real organisations.
