# flip-custom handoff

A passport book engine written from scratch with Motion (`motion/react`) and CSS 3D transforms. No page-flip library.
Lab: `http://localhost:3100/lab/flip-custom` (eight placeholder pages, FPS read-out, layout switch).

It implements `PassportBookProps` and `PassportBookHandle` from `src/lib/types.ts`, so it is a drop-in alternative to the StPageFlip engine.

## Files

| Path | What it is |
| --- | --- |
| `src/components/passport/engine-custom/index.ts` | Default export `PassportBook`, plus the extra prop and handle types and `PAGE_W`, `PAGE_H` |
| `src/components/passport/engine-custom/PassportBook.tsx` | React component: sizing, DOM skeleton, keyboard, live region. Never re-renders during a turn |
| `src/components/passport/engine-custom/engine.ts` | `BookEngine`: turn physics, pointer handling, every per-frame DOM write |
| `src/components/passport/engine-custom/physics.ts` | Pure maths: hinged-strip pose, finger solver, lighting |
| `src/components/passport/engine-custom/layout.ts` | Constants, sizing, page-to-leaf bookkeeping |
| `src/components/passport/engine-custom/passport-book.css` | All `.pb-*` styles. Imported by the component |
| `src/components/passport/engine-custom/strings.ts` | Copy used only by the lab page (see "Strings") |
| `src/app/lab/flip-custom/page.tsx` | The lab |
| `scripts/scratch/flip-custom-*.mjs` | Throwaway: screenshots, film strips, traces, the FPS script |

## Use

```tsx
import dynamic from "next/dynamic";
import type { CustomPassportBookHandle } from "@/components/passport/engine-custom";

// UX-7: the engine is its own chunk and needs the DOM to measure itself.
const PassportBook = dynamic(() => import("@/components/passport/engine-custom"), { ssr: false });

const book = useRef<CustomPassportBookHandle>(null);

<PassportBook
  ref={book}
  cover={<CoverArt />}
  pages={pages}            // ReactNode[], one per page
  backCover={<BackArt />}  // optional
  onOpenChange={setOpen}
  onFlip={setPage}         // fires when the page has landed
/>
```

`next/dynamic` drops the ref type; cast the result as the lab page does.

### Props

The contract props (`cover`, `pages`, `backCover`, `onFlip`, `onOpenChange`, `className`) plus these optional ones:

| Prop | Default | Notes |
| --- | --- | --- |
| `mode` | `"auto"` | `"single"`, `"spread"` or `"auto"`: one page below `spreadFrom`, two-page spread from it |
| `spreadFrom` | `640` | Container width in CSS px (the component's own width, not the viewport) |
| `maxPageWidth` | `400` | CSS px |
| `maxPageHeight` | 62% of the viewport height | CSS px |
| `onFlipStart(page)` | | Fires as soon as a turn is decided, before the page lands. Use it for a snappy page counter |
| `reducedMotion` | system setting | Force the fallback on or off |

### Handle

`open()`, `close()`, `flipTo(page)`, `next()`, `prev()` from the contract, plus:

- `peek()`: lifts the fore edge of the current page and drops it. A hint that pages turn.
- `isOpen()`, `getPage()`.

All are safe to call at any time, including while a leaf is in the air.

### Callback timing

- `onOpenChange(open)` fires when the open or close is decided (cover starts moving).
- `onFlipStart(page)` fires when a turn is decided. During `flipTo` across several pages it fires once, with the destination.
- `onFlip(page)` fires once everything has landed. This is the moment to start a stamp press.
- `page` is the zero-based index of the first page in view. In a spread that is the left-hand page, except on the first opening where it is 0.

## What the engine draws, and what you supply

- The engine draws the materials: cover board (`mat-cover`, sheen, spine crease, board thickness), paper (`mat-paper`, `mat-page-dim`), gutter shadow, endpapers, the shadow under the book. `cover`, `backCover` and each page are laid over them, so pass content only, with a transparent background.
- Content is laid out in design pixels: a page is `PAGE_W` x `PAGE_H` (320 x 454) and the cover 325 x 464. The whole book is scaled once to fit. `Stamp size` can therefore be a constant. Page content is `position: absolute; inset: 0`.
- Sizing: the component fills its container's width and sets its own height. In single view the page takes 84% of the width.
- Single view: the book sits slightly right of centre when open, so a sliver of the left-hand stack shows beside the spine and runs off the edge. The root has `overflow-x: clip`. Give it the full width of the screen on phones.
- Root attributes for styling: `data-mode="single|spread"`, `data-open="true|false"`, `data-pb-state="front|open|back"`, `data-ready`, `data-reduced`.

### Pages are snapshotted while they turn

At rest every page is one real DOM node, so the host can animate on it. When a turn starts the page is copied with `cloneNode` into six hinged strips; when it lands the real node is shown again. Consequences:

- Animate stamps on a page at rest (after `onFlip`), not while it turns. A turning leaf shows the page as it was when the snapshot was taken.
- Snapshots are taken while idle and retaken when the real page's DOM changes (a `MutationObserver` watches it), so a page that was just stamped turns with the stamp on it.
- A page that mutates its DOM on every frame forever (a looping JS animation) makes every turn of that page take the slower path. CSS animations do not count.
- Ids are rewritten inside snapshots. Nothing to do on your side.
- Each strip keeps only the stamps that reach into it. Any other fixed-size, self-contained heavy widget can opt in with `data-pb-prune`.
- Pages are mounted gradually while idle and stay mounted, hidden with `visibility: hidden`.

### Pointer rules

- Drag horizontally to turn. `touch-action: pan-y`, so vertical scrolling of the page still works.
- Tap the closed book to open it. Tapping the outer edge of a page (the outer 14% to go on, the inner 10% in single view to go back) turns it. Taps on `a, button, input, select, textarea, [role=button], [data-pb-no-flip]` are left alone, so wrap tappable stamps in a `button`.
- A click that ends a drag is swallowed.

## Motion

- Paper: the turning page is six strips hinged edge to edge. A spring drives the page angle and a second spring drives the curl: the fore edge leads while a finger holds it, trails in flight, and each strip stops when it meets the stack, so the page peels up from its edge and rolls down flat on landing.
- Drag: the point under the finger stays under the finger (the angle is solved against the CSS perspective each frame). Release decides by angle and velocity; a flick always turns. A leaf going the wrong way can be caught in the air. Several leaves can be in the air at once, so quick flicks turn a page each.
- Light: each strip is shaded from the angle at its two edges, so shade and gloss run smoothly across the bend. The leaf throws a shadow on the page under it.
- Cover: a rigid board with thickness. Eased swing with a band of light crossing it, a small overshoot when it opens and a small bounce when it closes onto the pages. The book slides to its open position as the cover turns.
- `close()` from the middle of the book: the turned pages ride on the cover as one block.
- `flipTo` over several pages riffles them one after another.
- In single view with a back cover, stepping past the last page closes the book on its back in one go.
- The last page cannot turn without a `backCover`: it lifts against resistance and falls back.
- Only `transform`, `opacity` and `visibility` are written during motion. No React render happens in the engine while a leaf moves.

### Reduced motion (UX-5)

With `prefers-reduced-motion` (or `reducedMotion`), nothing turns: page changes cross-fade in 260 ms, opening and closing fade the book out and in, and a swipe counts as next or previous. `peek()` does nothing.

### Keyboard and screen readers (TEC-9)

The book is one tab stop (`role="group"`, labelled from `strings.passport.ariaBook`), with a focus ring drawn round the book.

- Right / Page Down: next (opens the book when closed). Left / Page Up: previous (closes from the first page).
- Home / End: first and last page. Enter or Space: open, when focus is on the book itself. Escape: close.
- The page is announced through a polite live region on landing (`strings.passport.pageOf`).
- Pages not on show are `visibility: hidden`; snapshots are `inert` and `aria-hidden`.

## Performance

Measured with `scripts/scratch/flip-custom-perf.mjs`: Chrome for Testing (new headless, Apple M3 GPU), 390 x 844 at DPR 2.625, `Emulation.setCPUThrottlingRate` 4, frame intervals from `requestAnimationFrame`. The figures below are from the runs made while the machine was quiet. The headless shell (software GL) gave the same picture for single turns: 58 to 60 fps at 4x.

| Scenario (4x CPU throttle) | Average | Slowest frame |
| --- | --- | --- |
| Cover open, cover close | 60 fps | 17 ms |
| Page turn by button, forwards and back | 60 fps | 17 ms |
| Slow drag and settle | 59 to 60 fps | 17 to 33 ms |
| Three quick flicks, leaves overlapping | 58 fps | 33 ms |
| `flipTo` riffle over 4 to 6 pages | 50 to 55 fps | 33 to 50 ms |

- A single turn costs about 2.5 ms of main-thread time per frame at 4x throttle (trace: style 0.7, layerize 0.75, paint 0.3, commit 0.25, script 0.25).
- The riffle drops a frame as each new leaf appears: showing a leaf restyles and repaints its strips (15 to 25 ms at 4x). Unthrottled it runs at 60.
- Spread view at 4x throttle is heavier (both faces of a leaf carry content): 59 fps for single turns, 48 to 55 during flicks and riffles.
- `visibility` toggling was kept after trying to park leaves off screen instead: parking kept about 500 layers alive and measured slower.
- Numbers move a lot when the machine is busy. My last run was made with other agents' browsers running (load average 6 to 12): cover and single turns 59 to 60 fps, slow drags 60, three quick flicks 53, riffles 32 to 48 with 60 to 110 ms long tasks. Re-run `node scripts/scratch/flip-custom-perf.mjs 4 full` on a quiet machine before quoting a number, and test on a real mid-range Android: CPU throttling does not slow the GPU or the raster threads.

## Known issues

- Tested in Chromium only (headless shell and Chrome for Testing). Not run on a real phone, iOS Safari or the Instagram, TikTok and Facebook in-app browsers. It uses nothing exotic: pointer events, `touch-action`, `backface-visibility` (with the `-webkit-` prefix), `ResizeObserver`, `MutationObserver`, `inert`, `overflow: clip` (with an `overflow: hidden` fallback for Safari before 16). Check 3D sorting of the stacked leaves on iOS: leaves are separated by 1 px in depth.
- No vibration here: the stamp moment owns `navigator.vibrate`.
- Single view shows the reverse of every leaf as blank paper. Page content is on the fronts only, as in the StPageFlip portrait mode.
- The pool holds eight ready leaves. A book with more pages still works; leaves further away are snapshotted on demand, which costs a frame or two when one of those turns.
- If the host re-renders a page's content during a turn, the leaf in the air does not show the change until it lands.
- `PassportBook` skips re-rendering its skeleton when `cover`, `backCover` and each entry of `pages` are the same elements as last time. Memoise them (`useMemo`) or every host render re-renders all pages.
- The focus ring moves to its new position at once while the back cover is still swinging.
- Motion logs a development-only warning when reduced motion is on. It is not an error.
- Layout switch in the lab (`Auto / Single / Spread`) remounts the pages; the current page is kept.

## Strings

The engine uses only existing entries of `src/lib/strings.ts` (`passport.ariaBook`, `passport.title`, `passport.pageOf`).
The lab page needs extra copy, which lives in `engine-custom/strings.ts` because `src/lib/strings.ts` is not mine. To finish TEC-12, move `flipLabStrings` into `strings.lab` (or delete the lab page with the file).

## Notes for the integrator

- Against StPageFlip: this engine keeps real DOM for the page at rest, lets several leaves fly at once, can be interrupted and caught mid-turn, has a hinged cover with weight, a spread on desktop from the same component, and a reduced-motion path. StPageFlip has the diagonal corner fold, which this engine does not attempt (pages turn around the spine).
- To run the stamp moment: `book.current.flipTo(page)`, wait for `onFlip(page)`, then animate the real stamp on that page.
- The tsc errors in `src/components/moments/StampPress.tsx` seen during my runs belong to another agent's work in progress; `engine-custom` and the lab type-check and lint clean.
