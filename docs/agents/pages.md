# Pages handoff

> **Updated by the polish round.** Timings, props and layout numbers below may be out of date. `docs/agents/polish.md` lists what changed and is the current reference where the two disagree.

Passport content (cover art, page designs, stamp detail sheet) and the app chrome (header, progress ring).
Review page: `http://localhost:3100/lab/pages` (cover, all eight pages and the back cover laid flat; the header's switcher changes direction and mode; the buttons step through the demo story).

## Files

| Path | What it is |
| --- | --- |
| `src/components/passport/content/index.ts` | Public exports |
| `.../buildPassportPages.tsx` | `buildPassportPages`, `usePassportContent`, `getPassportPageMap` |
| `.../types.ts` | `BuildPassportOptions`, `SlotOverride`, `PassportContent`, `PassportPageMap` |
| `.../Cover.tsx` | `FrontCover`, `BackCover`, `requestCoverMotion`, the foil light hook |
| `.../Pages.tsx` | `HolderPage`, `ProvincePage`, `ProvincialPage` |
| `.../IslandPage.tsx` | `IslandPage`, `SlotView`, the stamp scatter layouts |
| `.../PageFrame.tsx` | `Frame` (design-unit system), `Page` (paper, head, footer), `usePageMetrics`, `useStampPx` |
| `.../StampDetailSheet.tsx` | `StampDetailSheet` (PAS-4 bottom sheet) |
| `.../chart.tsx` | Stylised province chart and island locator |
| `.../patterns.ts` | Procedural SVG: emblem, guilloche rosette and ribbon, contours, wreath, ruler |
| `.../strings.ts` | `contentStrings`: copy for these components (see "Strings") |
| `.../content.css` | All styles for the above |
| `src/components/chrome/` | `Header`, `Wordmark`, `EmblemGlyph`, `ProgressRing`, `chrome.css` |
| `src/app/lab/pages/page.tsx` | The review page |
| `scripts/scratch/pages-*` | Throwaway screenshot, flow, tilt and frame-pacing scripts |

## Quick start

```tsx
"use client";
import { usePassportContent } from "@/components/passport/content";
import { Header } from "@/components/chrome";
import { getProgress } from "@/lib/sample-data";

const { cover, pages, backCover, sheet, pageMap, openStamp } = usePassportContent(passport, {
  slotOverrides,                 // optional, see "Hooks for the motion layer"
  onEmptySlotSelect: (slot) => collect(slot.id),   // optional
});

<Header progress={getProgress(passport)} province={passport.province} />
<PassportBook ref={book} cover={cover} pages={pages} backCover={backCover} />
{sheet}                          // once, anywhere; it portals to <body>

book.current.flipTo(pageMap.forSlot(DEMO_SCRIPT.collectSlotId));   // 6: the Danajon Bank page
```

`usePassportContent` is `buildPassportPages` plus the detail sheet wired up: tapping a collected stamp opens it, and it always shows the stamp's current state. Use `buildPassportPages(data, opts)` directly if you want to own the sheet; it returns `{ cover, pages, backCover, pageMap }`.

Both live in a `"use client"` module, so call them from a client component.

### Page order (zero-based, as `flipTo` expects)

| Index | Page |
| --- | --- |
| 0 | Holder page (inside cover): monogram, name, passport no., issued date, pledge, signature, "Sample" overprint, two MRZ lines |
| 1 | Province page: chart with the five islands, index with a status dot per slot, stamp key |
| 2 to 6 | One page per island: Bohol, Balicasag, Pamilacan, Banacon, Danajon Bank |
| 7 | Provincial Stamp: ornate slot, progress pips, the rule |

`pageMap` gives `holder`, `province`, `islands[islandId]`, `provincial`, `count` and `forSlot(slotId)` (the Provincial Stamp id resolves to the Provincial page). `getPassportPageMap(data)` returns the same without building anything.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `onStampSelect(slot, stamp)` | | A collected stamp was tapped. Without it (and outside `usePassportContent`) stamps are not buttons |
| `onEmptySlotSelect(slot)` | | An empty slot was tapped. Without it empty slots are not buttons |
| `onProvincialSelect(stamp)` | | The awarded Provincial Stamp was tapped |
| `slotOverrides` | | `Record<slotId, SlotOverride>`, see below |
| `layout` | `"single"` | `"spread"` alternates gutter shading and page-number side, with `pages[0]` on the left |
| `pageWidth` | 360 | Expected page width in px before the first measurement |
| `coverInteractive` | `true` | Foil follows pointer, tilt and an idle glint |
| `coverPageEdge` | `false` | Draws the page block past the fore edge. For covers shown outside the book |

Pass a stable `slotOverrides` object (memoise it). Pages are `React.memo`'d and compare slots one by one, so changing one stamp re-renders its island page and the province page only.

## Sizing: the design-unit system

Every surface is a `.ipp-frame` that fills its parent (`width: 100%; height: 100%`). It is 360 design units wide and everything inside is sized in units (`--u`), so a cover or page looks the same at 110px or 420px wide. The parent must have a definite size; if it has no definite height the frame falls back to `aspect-ratio: 360 / 560`.

- `--u` comes from container-query units in CSS, so it is right on first paint. Browsers without `cqw` get it from a ResizeObserver.
- Page height is flexible. Layouts read the measured height and adapt: stamp sizes, the chart and the ornate slot shrink for a shorter book. I checked 360x560 (0.64) and 320x470 (0.68, the ratio `engine-lib` uses). Below about 0.72 wide-to-tall the three-slot pages get tight.
- `<Stamp size>` needs px, so stamps get `round(units * scale)` from the same observer. A frame that mounts hidden (width 0, as in a detached page host) starts from the last measured size.

## Cover

`FrontCover` / `BackCover` take `province`, `country`, `passportNo`, `holderName`, `interactive`, `pageEdge`, `initialWidth`. Material is `mat-cover`, so a photographed texture takes over when the manifest lists one.

- Classic: double foil frame, foil title, debossed foil emblem, foil subtitle.
- Reef: stitched frame, foil title in Fraunces, coral print for the small lines.
- Journal: cloth spine tape, pasted paper label with typewriter fields, emblem stamped in dark ink (no foil, as foundation asked).
- Back: blind-debossed emblem (ink on Journal), tagline, sample notice.

The emblem is an original mark: compass ring, three hills, rising sun, waves. No coat of arms, and the title sits above the emblem rather than a country name.

**Foil light.** `--tx` / `--ty` (-1..1) are written on `.ipp-cover-wrap` by a rAF loop that only runs while something changes. Sources: pointer over the cover, device tilt, and a slow idle glint every 6.5s when nothing else moved it. Foil `background-position` and a transform-only specular layer read those variables. With reduced motion nothing runs and the foil is static.

- Tilt is used only where the browser gives `deviceorientation` without a prompt (Android). iOS needs a permission prompt from a tap; the cover never asks. To opt in, call `requestCoverMotion()` from a click handler; covers on screen start listening when it resolves true.
- The idle glint keeps running while the cover is in the viewport. If the book hides the cover when open (`visibility: hidden`), the glint still ticks; pass `coverInteractive: false` while open if you want it stopped.

**Doubling with the book's own lighting.** The cover draws a hinge groove, an edge bevel and `mat-sheen`. Both engines also draw a spine and sheen. Put `data-ipp-cover="bare"` on any ancestor to remove the cover's hinge, bevel and sheen (Journal keeps its cloth tape). Corner radii follow `--ipp-cover-radius` / `--ipp-cover-radius-spine` if set on an ancestor (defaults: `--r-passport`, 4px).

## Stamp slots and the detail sheet

- Slots are `<button>`s when tappable, so both engines leave the tap alone instead of starting a flip.
- Slots are scattered from fixed layouts per slot count (1 to 4, then a grid), so nothing shifts when a stamp is added.
- `StampDetailSheet`: `stamp` (null closes it), `onClose`, `province`. It shows island, promoter, charity, conservation purpose, date and status, plus the sample notice. Spring up, drag the handle or the header down to dismiss, Escape and backdrop close. Focus moves in, is trapped, and returns to the stamp. It stops key events from leaving the dialog so arrow keys do not turn pages. Reduced motion: fade only.

### Hooks for the motion layer

Attributes on the page DOM:

| Selector | What |
| --- | --- |
| `[data-slot-id="…"]` | Slot root (button or div). Also on the Provincial slot with the Provincial Stamp id |
| `[data-slot-status]` | `empty`, `discovery`, `pending`, `verified`, or `provincial` |
| `.ipp-slot__stamp` | The square box the stamp sits in. Use its `getBoundingClientRect()` to land an overlay |
| `[data-provincial-slot]` | The ornate slot; `.ipp-ornate__ring` is the ornament, `.ipp-ornate__stamp` the stamp |
| `[data-page-kind]`, `[data-page-number]`, `[data-island-id]` | On the page frame |

`SlotOverride`, keyed by slot id (or the Provincial Stamp id):

| Field | Effect |
| --- | --- |
| `hidden` | Draw the slot as empty even though the data holds a stamp (while an overlay stamp flies in) |
| `status` | Draw the stamp at this status |
| `inkProgress` | Passed to `<Stamp inkProgress>`; a MotionValue animates the in-page stamp with no re-render |
| `showSeal` | Passed to `<Stamp showSeal>` for the upgrade |
| `highlight` | Soft breathing ring around the slot (static with reduced motion) |

Stamps on pages use the default rough ink and `blend="normal"`. I left `multiply` off because blended layers are costly while a page flips.

## Chrome

```tsx
<Header progress={progress} province="Bohol" />
<ProgressRing collected={7} total={12} province="Bohol" breakdown={{ verified: 3, pending: 1, discovery: 3 }} />
```

`Header` props: `progress`, `province`, `sticky` (default true), `appearance` (`"row"` shows the direction switcher and mode toggle under the bar, `"none"` hides them), `ringBreakdown` (default true), `onProgressClick`, `homeHref`, `actions`, `className`.

`ProgressRing` props: `collected`, `total`, `province`, `breakdown`, `size` (44), `thickness`, `label` (`"side"` or `"none"`), `onClick`, `className`.

- To trigger the tick-up, change `collected`. The arc springs forward with a little overshoot, the count rolls, the dial bumps and a ripple leaves it. It also sweeps in from zero on first paint.
- With `breakdown` the arc is three segments in `--status-verified|pending|discovery`; without it, one arc in `--accent`.
- A visually hidden `role="status"` line announces the new count.
- Under 360px wide the ring drops its label and the switcher becomes swatches.

## Strings (action for the integrator)

`src/lib/strings.ts` is not mine, so the copy these components need is in `src/components/passport/content/strings.ts` as `contentStrings`, in the same shape. No component hard-codes text. To get back to one translation file (TEC-12), move that object into `strings` and re-export it from the old path.

## What I checked, and what I did not

Checked in headless Chromium at 390x844 @2x by screenshot: all ten surfaces in Classic, Reef and Journal in light mode; a sample of pages in dark mode for each direction; 320x470 pages; 1280px desktop; the detail sheet for verified, pending and Provincial stamps; keyboard open, focus trap, Escape and focus return; reduced motion; the ring before and after adding a stamp; the foil at three pointer positions. A 340px viewport has no horizontal overflow. `tsc --noEmit` and eslint are clean. No console errors or hydration warnings on `/lab/pages` (only Motion's dev notice when reduced motion is on).

Frame pacing under 4x CPU throttle on the dev build, measured with a rAF counter in headless Chromium on this Mac: foil following the pointer held 16.7ms frames; the sheet opening and the ring tick each had one long frame (about 150ms and 130ms) at the moment React mounts or re-renders, then held 16.7ms. That is not a phone measurement.

Not checked:

- **Inside either PassportBook.** I read both engines' CSS to match how they mount content, but did not render my pages in them or profile a flip.
- **Safari, iOS and the in-app browsers.** Things to look at first: the foil frame (`mask-composite`), the emblem (three `mask-image` layers), `container-type` units, the perforated passport number (`background-clip: text`).
- **Device tilt.** Written to the spec; no device here to feel it on.
- **The no-`cqw` fallback path** (pre-2022 browsers).
- **Photographed textures.** The manifest is still empty.

## Known issues and notes

- The province chart is a stylised drawing: outline, island positions and the "approx." coordinates printed on island pages are from memory, not a survey. They are sample content; check them before anything public.
- Chart art is keyed by province and island id in `chart.tsx` (only Bohol exists). An island without an entry gets a compass mark, and a province without one gets no chart, so nothing breaks, but new provinces need art (TEC-11).
- Reef's coral cover print is a constant in `content.css` (`--ipp-cover-accent: #ff9f87`); the tokens have no cover accent.
- The pattern CSS (emblem, rosette, contours and so on as data URIs) is about 37 KB before compression, injected once as a de-duplicated `<style>`.
- The holder page's MRZ lines are decorative and `aria-hidden`.
- The detail sheet locks body scroll while open but does not make the background `inert`.
