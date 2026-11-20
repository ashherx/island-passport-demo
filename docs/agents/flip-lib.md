# flip-lib handoff: passport book on StPageFlip

The interactive passport (UX-2, PAS-3) built on the `page-flip` npm package (StPageFlip 2.0.7, HTML mode).
Live demo: `http://localhost:3100/lab/flip-lib` (8 placeholder pages, controls for every handle method).

## Files

| Path | What it is |
| --- | --- |
| `src/components/passport/engine-lib/index.ts` | Entry point. Default export `PassportBook`, plus `usePassportPage` and the types |
| `src/components/passport/engine-lib/PassportBook.tsx` | The component: book structure, cover swing, turn-over, keyboard, focus, mounting of the engine |
| `src/components/passport/engine-lib/flip-engine.ts` | React-free driver around StPageFlip: render loop, easing, pointer input, shading, warm pages |
| `src/components/passport/engine-lib/passport-book.css` | Structure, rest poses and the materials the engine adds |
| `src/components/passport/engine-lib/page-flip.d.ts` | Typings for `page-flip` (the package ships none) |
| `src/app/lab/flip-lib/page.tsx` | Lab page |
| `scripts/scratch/flip-lib-*.mjs` | Throwaway: screenshots, behaviour checks, frame pacing, trace analysis |

Nothing outside these paths was edited. No package was added.

## Usage

```tsx
import PassportBook, { usePassportPage, type PassportBookLibHandle } from "@/components/passport/engine-lib";

const book = useRef<PassportBookLibHandle>(null);

<PassportBook
  ref={book}
  cover={<Cover />}
  pages={pages}            // ReactNode[]; index 0 is the first page, the cover is not a page
  backCover={<BackCover />}
  onFlip={(pageIndex) => …}
  onOpenChange={(open) => …}
  chrome="bare"            // when the content draws its own cover material and paper (see below)
/>
```

It implements `PassportBookProps` and `PassportBookHandle` from `src/lib/types.ts` and adds a few optional extras.
It is a client component but renders on the server: the closed cover is plain markup, so it is on screen at first paint and
there is nothing to hydrate differently. Do not wrap it in `next/dynamic`; the flip library is imported lazily inside it.

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `cover` | `ReactNode` | | Printed on the front cover. Fills the cover (`position: absolute; inset: 0` is fine) |
| `pages` | `ReactNode[]` | | One node per page. Keep the array and the nodes referentially stable between renders (see Performance) |
| `backCover` | `ReactNode` | | Outside of the back cover. Seen by turning the closed passport over |
| `onFlip` | `(pageIndex) => void` | | Fires when the visible page changes. In a spread it reports the left page of the spread |
| `onOpenChange` | `(open) => void` | | Fires when opening or closing starts (intent), not when the swing ends |
| `className`, `style` | | | On the root |
| `insideCover` | `ReactNode` | | Printed on the inside of the front cover (the strip left of the page on a phone) |
| `insideBackCover` | `ReactNode` | | Printed on the inside of the back cover |
| `defaultOpen` | `boolean` | `false` | |
| `startPage` | `number` | `0` | |
| `spread` | `"auto" \| "single" \| "double"` | `"auto"` | Auto: one page below a 780px container, two pages from 780px (a container query, not the viewport) |
| `firstPageSide` | `"left" \| "right"` | `"left"` | In a spread: `left` pairs pages as [0,1] [2,3], matching the content agent's `layout: "spread"`. `right` leaves the inside cover on the left of page 0 |
| `chrome` | `"full" \| "bare"` | `"full"` | `full`: the engine draws `mat-cover`, `mat-paper`, the spine shading and `mat-page-dim`. `bare`: content brings its own surfaces; the engine adds only the book around it (boards, page block, shadows, flip shading) |
| `hint` | `boolean` | `true` | After the first opening, the lower page corner lifts once and falls back |
| `onStateChange` | `(state) => void` | | `"closed" \| "opening" \| "open" \| "closing"` |

With the content agent's `Cover` and `Page` (they draw their own material, paper, gutter and dim), pass `chrome="bare"`.
Leaving it on `full` still works but doubles the spine shading and the dark-mode tint.

### Handle

| Method | Behaviour |
| --- | --- |
| `open()` | Plays the cover swing. From the back side it turns the passport over first |
| `close()` | Swings the cover shut. The current page is kept; reopening returns to it |
| `next()` | Next page (next spread). On a closed book it opens it. Nothing on the last page |
| `prev()` | Previous page. On the first page it closes the book |
| `flipTo(page)` | One flip straight to that page. On a closed book: goes to the page, then opens on it |
| `peek()` | Extra. Lifts the lower corner as a hint |
| `turnOver(side?)` | Extra. Closed book only: shows `backCover`, or the front again |
| `getState()`, `getPage()` | Extra |

### Inside a page

```tsx
const info = usePassportPage(); // { index, count, width, height, mode, side } or null outside a book
<Stamp stamp={stamp} size={Math.round((info?.width ?? 320) * 0.4)} />
```

`width`/`height` are the page size in px (0 before the first measurement), `mode` is `"single" | "double"`,
`side` is `"left" | "right"` (always `right` in single mode). Each page and the cover are size containers, so content can
also use `cqw`/`cqh` (1cqw = 1% of the page width). The root carries `--ipb-page-w`, `--ipb-page-h` and `--ipb-u`
(1% of the page width) in px.

### Sizing

CSS only, so the size is right before any script runs. Override on the root (`style` or a class):

| Variable | Default | |
| --- | --- | --- |
| `--ipb-ratio` | `0.68` | Page width / height (360 x 529 in the content agent's units) |
| `--ipb-max-w` | `420px` | Widest one page gets |
| `--ipb-max-h` | `min(76vh, 660px)` | Tallest the book gets |
| `--ipb-margin` | `26px` | Room kept free on each side of the book |
| `--ipb-pad` | `clamp(20px, 6vw, 44px)` | Block padding of the root |

The root is `width: 100%` and clips horizontally (`overflow-x: clip`): on a phone the opened cover lies to the left
of the page and runs off the screen, which is intended. Give the book the full width of the screen; do not put it
in a narrow card with its own overflow.

### Attributes for styling and tests

Root `.ipb`: `data-state` (closed, opening, open, closing), `data-side` (front, back), `data-mode` (single, double),
`data-engine` (pending, ready), `data-leafed` (present when not on the first page), `data-chrome`.
`.ipb__flip[data-state]` carries the flip state: `read`, `flipping`, `user_fold`, `fold_corner`.

Inside pages: `data-no-flip` on an element keeps drags and taps that start on it away from the book
(use it on anything that handles its own gestures). Buttons, links and `role="button"` already keep their taps.
On the cover: `data-no-open` on an element stops a click on it from opening the book.

## Interaction

- Cover: tap or click opens. A leftward drag takes the cover by its edge and it follows the finger; let go past about
  55 degrees, or flick, and it opens, otherwise it falls shut. A rightward flick turns the closed passport over.
- Pages, touch: a horizontal drag folds the page from its edge and follows the finger; it completes by position or
  flick speed. A tap in the outer 20% of a page turns it. Vertical drags scroll the page as usual (`touch-action: pan-y`).
- Pages, mouse: the corner lifts under the pointer; click it or the outer 20% to turn, or drag anywhere.
- A back-swipe on the first page closes the book.
- Keyboard (TEC-9): the cover is a button (Enter, Space). Open: Right/PageDown, Left/PageUp, Home, End, Escape to close.
  Focus moves to the pages when the book is opened from the keyboard and back to the cover when it closes.
  Arrow keys are handled only while focus is inside the book. A polite live region announces "Page x of y".
- Reduced motion (UX-5): no swing and no curl. The cover cross-fades, page changes are immediate with a short fade,
  and swipes still change page.
- Pages not lying open in front are `inert` and `aria-hidden`. A page becomes live about 90 ms after it lands.

## How it is built

StPageFlip does the geometry (fold line, clip polygons, page stacking, spreads). `flip-engine.ts` replaces what
holds it back on a phone. It uses the library unmodified from npm and reaches into private members that the
minified bundle keeps by name, so **keep `page-flip` pinned at 2.0.7** (it has not changed since 2021).

1. Render loop. The library runs `requestAnimationFrame` forever, restyling every page each frame even at rest, and
   keeps doing so after `destroy()`. The engine swallows that loop at start-up and ticks the library only while
   something moves. Measured at rest: zero style recalculations.
2. Motion. Library flips move the corner at constant speed in a straight line. Here flips are eased and bow slightly.
3. Input. Library touch input waits 250 ms before a page follows the finger. Here Pointer Events drive the fold directly.
4. Shading. The library's two fold shadows repaint large clipped divs every frame. Here they are fixed strips that
   only change `transform` and `opacity`, plus a blurred drop shadow under the sheet in the air.
5. Painting. Three changes stop the browser from repainting page content during a flip:
   each page is its own layer under the element the library clips; resting pages are styled with the same properties
   as turning ones; and the pages a flip would bring in are painted ahead of time underneath the current page.
6. In single-page mode the back of a turning page is one reusable sheet of paper, not a deep clone of the page.

The cover swing is the only 3D in the component and has its own stacking context holding the cover alone.
At rest everything is flat. In a spread, the page left of the spine rides the inside of the cover as a static copy
while the cover is in the air.

React safety: page content is rendered through portals into host elements the component creates. The library moves
those hosts around and the engine hands them back before the library removes its own DOM, so React never meets a node
it did not put there. Strict Mode double effects are covered (the dev server runs with them on): the engine is created
after an async import that the first effect's cleanup cancels. Rebuilding on a breakpoint change keeps the page.

## Performance

Measured in headless Chromium on the dev build, CPU throttled 4x with `Emulation.setCPUThrottlingRate`,
viewport 412x915 at DPR 2.625 (phone, single page) and 1280x860 at DPR 2 (desktop, spread).
Scripts: `flip-lib-perf.mjs` (frame pacing from `requestAnimationFrame` deltas), `flip-lib-trace.mjs` (trace breakdown).

Frame pacing, 4x CPU throttle (fps from frame deltas; "late" = frames over 20 ms; "busy" = share of the time the main thread was working):

| Action | Phone, single page | Desktop, spread |
| --- | --- | --- |
| Cover opens | 59.5 fps, 1 late frame (33 ms, the first), 14% busy | 59.5 fps, 1 late frame (33 ms), 16% busy |
| Flip forward (3 runs) | 60 fps, 0 late, 12 to 15% busy | 60 fps, 0 late, 15 to 17% busy |
| Flip back (2 runs) | 60 fps, 0 late, 13% busy | 60 fps, 0 late, 15 to 17% busy |
| Finger or mouse drag, then release | 60 fps, 0 late, 11 to 13% busy | forward 58.7 fps with 1 late frame (67 ms); back 60 fps |
| Cover closes | 60 fps, 0 late, 12% busy | 59.3 fps, 1 late frame (33 ms), 42% busy |
| At rest, 2 s, closed or open | 0 style recalculations | 0 style recalculations |

No task over 50 ms in any run. These are the last runs taken with the machine quiet. Other agents were running
browsers on the same machine: of four phone runs, three looked like the table (at most one 33 ms frame, on the
cover) and one run under load showed a 67 ms frame on a flip.

Trace of three flips on the phone profile (2.47 s of animation):

| | Before the paint work | After |
| --- | --- | --- |
| Raster during the flips | 970 ms in 3,973 tasks | 52 ms in 1,350 tasks, largest 0.8 ms (clip masks only, no page content) |
| Raster during the cover opening | 1,457 ms | 41 ms |
| Main thread during the flips | 14 to 20% busy | 8 to 12% busy, longest task 18 ms |

The 18 ms task is React re-rendering the lab page in `onFlip`, on the last frame of the flip.

Rerun with:

```
node scripts/scratch/flip-lib-perf.mjs 4
node scripts/scratch/flip-lib-perf.mjs 4 classic 1280 860 2
DETAIL=1 node scripts/scratch/flip-lib-trace.mjs 4 flips
node scripts/scratch/flip-lib-trace.mjs 4 open
```

What these numbers do and do not show: CPU throttling slows the main thread only. They show that script, style,
layout and paint recording fit in a frame with room to spare, and that no page content is rasterised during a flip.
They say nothing about a phone GPU. Compositing here is software, on a laptop.

For page authors:

- Keep `pages` and the nodes in it stable (`useMemo`). The book re-renders when the page changes; stable nodes are skipped.
- Do not animate layout or paint properties inside a page while it is turning.
- A stamp animation that repaints a stamp (ink reveal) repaints the page layer it sits on. Run it when the page is
  at rest, or promote the stamp (`will-change: transform`) for the length of the animation.
- `data-stamp-ink="clean"` was not needed: the ink filters are not re-run during flips.

## Known issues and limits

- Tested in headless Chromium only (the only browser installed here). Not verified: iOS Safari and the Instagram,
  TikTok and Facebook in-app browsers. Things to look at on a real iPhone: the cover swing (`preserve-3d` with
  `backface-visibility`), `clip-path` on promoted layers during a flip, `overflow-x: clip` (Safari 16+; older
  versions fall back to `overflow: hidden`, which also clips the top of the swinging cover), and container queries
  (Safari 16+; without them the book stays single-page, which is the right fallback on a phone).
- The engine depends on StPageFlip internals (listed at the top of `flip-engine.ts`). A different version of the
  package may break it silently.
- `window.requestAnimationFrame` is replaced for the duration of one synchronous library call at start-up, to stop the
  library's endless loop from starting. It is restored in a `finally`.
- `backCover` is only reachable by turning the closed passport over (rightward flick on the cover, or `turnOver()`).
  Turning the last page does not close the book onto its back.
- In a spread, the copy of the left page that rides the cover is a DOM clone. It is static, so anything animating on
  that page freezes for the 1.2 s of the swing, and element ids inside it are duplicated for that time.
- `onFlip` in a spread reports the left page of the spread (0, 2, 4 with `firstPageSide="left"`).
- The turning page can rise above the top of the book and over whatever sits there. Leave some room above it or keep
  headers on a higher z-index (the lab's sticky header is).
- Text on the back-cover button is taken from `strings.passport.coverTitle`; there is no "turn over" string yet.
- Lab copy (`L` in `src/app/lab/flip-lib/page.tsx`) is local to that file because `strings.ts` is not mine to edit.
  Fold it into `strings.lab` when merging.
- The lab exposes the handle as `window.__book` for the scratch scripts.
- With real textures the page paper is a large tiled image. First paint of a page is heavier than with the generated
  materials; the warm-page mechanism hides that, except for the very first flip if it starts within about 100 ms of
  the book opening.
