# Part 3: the traveler share flow (key: traveler)

Brief (Client_Brief_Demo_v2.md, section 2): "After collecting a stamp, the traveler can share their
passport or island page with a generated social post and their own affiliate link/QR code.
Travelers become promoters too." Plus Dan's idea, to demonstrate and not a settled spec: an MP4 of
the passport opening, flipping through islands, closing and revealing a "scan to help my charity"
QR code on the back.

Where to look:

- `http://localhost:3100/share/traveler` : the flow, four steps.
- `http://localhost:3100/passport` : collect the stamp, then **Share** in the bar (see "The passport
  hook").
- `http://localhost:3100/share/traveler/artboard` : every generated post and the film in all three
  art directions on one page. A reference, not part of the flow.

Checked in headless Chromium on a Mac against the dev server at 390x844 (touch, DPR 2) and 1280x800,
plus a reduced-motion run. Not seen on a real phone, on iOS Safari or inside an in-app browser.
`next build` was not run. `tsc` and `eslint` are clean for everything listed under "Files".

## What it does

1. **Stamped** (`?step=stamped`). The moment after a stamp: the fresh stamp is pressed onto a page of
   the traveler's passport (the real `<Stamp>`, in their art direction) with a scatter of ink and
   foil, over a sheet that says what happened and offers **Share your stamp**. The wording follows the
   stamp's status: Verified says the charity confirmed the donation; Pending and Discovery say so and
   claim nothing.
2. **Choose** (`?step=choose`). My passport, this island, or this stamp. Each choice is shown as the
   story it would make, with the link it creates. Sharing an island asks which island (any island the
   traveler holds a stamp on).
3. **Design** (`?step=design`). Format tabs: **Story** (9:16), **Feed post** (4:5), **Passport film**
   (concept). The headline is editable (64 characters, three ideas to start from) and the passport
   style can be switched (Classic, Reef, Journal). The post is shown in the kit's neutral phone mockup.
4. **Share** (`?step=share`). The personal link and QR code ("Scan to help my charity"), caption and
   hashtags (kit `CaptionEditor`), then **Share** opens the kit `ShareSheet` with the PNG that was
   previewed. "See what your friend sees" follows the link to `/s/<code>`.

A dashed "Demo control" strip under every step switches the stamp between Discovery, Donation
pending and Verified Supporter, so the honest wording and artwork for each can be shown.

### Deep links

`/share/traveler?step=stamped|choose|design|share&share=stamp|island|passport&format=story|feed|film&style=classic|reef|journal&status=discovery|pending|verified&island=<id>&from=passport`

The address is kept in step with the screen (`history.replaceState`), so any state can be copied
and sent. Without `style` the flow adopts the art direction saved by the passport demo.

### Links

The traveler's code travels in the link itself (Technical_Questions.md, section 1):

| Choice | Code | Printed |
| --- | --- | --- |
| This stamp, this island | `alex-<island>` | `islandpassport.app/s/alex-pamilacan` |
| My passport | `alex` | `islandpassport.app/s/alex` |

Both resolve on `/s/[code]` (`resolveShareCode`). Every button uses `sharePath(code)`; the QR code
encodes `useShareTarget(code)`.

## The artwork: one canvas renderer

Posts and the film are drawn by one 2D-canvas renderer in `src/components/share/traveler/art/`.
The preview on screen is that canvas, so the saved PNG (and the recorded video) is exactly what was
previewed. Everything it loads is same-origin, so the canvases can be exported.

| File | What it draws |
| --- | --- |
| `core.ts` | Image and font loading (reads the hashed next/font names from the page), small helpers |
| `stamp.ts` | `drawStamp`: a static recreation of `<Stamp>` with the same geometry, three statuses, direction inks and lettering, speckled like a dry pad; `drawFoilSeal` |
| `passport.ts` | Paper per direction (guilloche, wash, grid), front cover with a still globe (land from `globe/land.generated.json`), back cover with the QR label, holder page, island page, stamp card, island card |
| `post.ts` | `drawPost` / `renderPost` / `postBlob`: story 1080x1920 and feed 1080x1350 |
| `film.ts` | `createFilm` (a pure function of time), `recordFilm`, `recordingSupport`, `filmPoster` |

The passport pages are lightweight recreations for pictures and video, not the flip engine and not
screenshots of the real pages. The DOM `<Stamp>` is used only in step 1.

Post layout: island photo on top, brand and handle, the traveler's headline, then what is shared
(the stamp large on a passport page, the island's page, or the cover with a page peeking out and a
"7 of 12 Bohol stamps" pill), then a white panel with the QR code, "SCAN TO HELP MY CHARITY", the
charity and the short link. The story keeps its content out of the top 190px and bottom 230px that
a story's own chrome covers.

Honesty in the artwork: the stamp is drawn at its real status (dashed with a clock when pending),
its label is printed under it, and the default headline only says "I helped protect ..." when the
stamp is Verified. Otherwise it reads "I just collected the Spinner dolphins stamp".

## The passport film (concept)

Labelled "Concept: export as video" wherever it appears. A 9:16 sequence of about 14 seconds:

| Chapter | What happens |
| --- | --- |
| Cover | The closed passport floats in, one pass of light crosses the foil |
| Open | The cover swings open, the holder page shows the progress ring |
| Islands | A page per island with a stamp (Bohol, Balicasag, Pamilacan, Banacon): each stamp inks in as its page lands, the new one harder, with a ring |
| Close | The cover comes back over |
| Scan | The passport turns over; the back cover reads "Scan to help my charity", the QR label lands, corner brackets breathe, the link appears |

- `film.draw(ctx, seconds)` paints one frame. `<PassportFilm>` calls it from `requestAnimationFrame`
  (only while on screen), with a chapter strip to jump around and tap-to-pause.
- Page turns are faked in 2D: each leaf is cut into 44 vertical strips placed with a simple
  perspective, paper bows as it turns, and a shadow falls on the page under it.
- **Save video** is a bonus. Where the browser can record a canvas (`MediaRecorder` plus
  `canvas.captureStream`), the film is played once into a hidden canvas and recorded in real time:
  MP4 where the browser offers it (Chromium here), otherwise WebM. Where it cannot, the button is
  replaced by a line saying so and the film still plays.
- Reduced motion: the film does not start by itself; it rests on the closed cover with a play button.
- In the share sheet the film contributes its last frame (the back cover with the QR code) as a PNG.

This is a demonstration of the idea. It does not claim that browser-made video is the production
answer: Technical_Questions.md section 2 leaves the render approach open, and the note under the
button says so.

## The passport hook (`/passport`)

Additive, and the story (collect, donate, charity confirms, Provincial Stamp, replay), the stepper
jumps, the direction switcher and the cover globe behave as before (checked by
`scripts/scratch/p3-traveler-passport.mjs` and `p3-traveler-passport2.mjs`).

- Once the story stamp is in the passport, a **Share** button appears in the action bar's tool row,
  beside the sound switch. It is a quiet icon while the stamp is Discovery or pending, and a labelled
  pill in the accent colour once the charity has confirmed.
- When the story is complete, the note under the main button becomes a link: "Share your stamp with
  your own link and QR code".
- Both go to `/share/traveler?from=passport&status=<status>&style=<direction>`, so the flow opens on
  the same stamp, at the same status, in the same art direction. With `from=passport` the flow's
  back arrow and "Not now" return to `/passport`.

Changed files (none of them mine originally):

| File | Change |
| --- | --- |
| `src/components/demo/Demo.tsx` | `shareHref` from the story stamp's status and the direction; the Share link is passed in the bar's existing `tools` slot; the done-state note becomes the link |
| `src/components/demo/demo.css` | `.ipd-tool--share`, `.ipd-bar__share` |
| `src/lib/strings.ts` | `strings.demo.share` |

`ActionBar.tsx` was not changed: the link goes through its `tools` prop. The bar's height is unchanged.

## Files

Mine:

- `src/app/share/traveler/page.tsx` (replaces the placeholder), `src/app/share/traveler/artboard/page.tsx`
- `src/components/share/traveler/`
  - `TravelerFlow.tsx` : state, steps, the address, the share sheet
  - `Celebrate.tsx`, `ChooseStep.tsx`, `DesignControls.tsx` (`FormatTabs`, `DesignControls`, `FilmConcept`)
  - `PostCanvas.tsx` (`scale` prop for thumbnails), `PassportFilm.tsx`, `Artboard.tsx`
  - `data.ts` (choices, links, headlines, captions, photos), `copy.ts` (all wording), `traveler.css` (prefix `skt-`)
  - `art/` as above
- `scripts/scratch/p3-traveler-*` : throwaway checks (flow screenshots, the end-to-end walk with QR
  decoding and downloads, film strips, the passport story, video playback)

## Kit changes

None to the kit's files. Two things done locally instead:

- `traveler.css` narrows the story mockup's bottom shade inside this flow
  (`.skt .sk-post[data-format="story"] .sk-post-over::after`). The kit shades the lower third for
  photo and video posts; the traveler's card is light there and carries the QR panel.
- `LinkField` cuts a long link with an ellipsis on a phone, so step 4 also prints the full link as
  text beside the QR code.

Imports from folders I do not own (read only): `@/components/stamp` (`Stamp`, `geometry`),
`@/components/globe/camera` (`projectToDisc`) and `land.generated.json`, `@/components/theme`.

## Known limits

- **Video length in some players.** A browser recording has no length in its header, so some players
  show a wrong duration until the file has been played through once. Playback itself is right
  (checked: 14.0 s, ends on the QR code).
- **Recording is real time** (about 14 s) and needs the tab in front. It was only tried in desktop
  headless Chromium. Safari and in-app browsers are untested; inside an in-app browser the note warns
  that saving can be blocked.
- **The film leaves out** the Provincial Stamp page and the province map; it shows the holder page
  and one page per island with a stamp.
- **The canvas stamp is a recreation.** It matches the real stamp's layout and inks, without the
  displaced rough edge of the SVG filter. The provincial seal is not drawn.
- **Photos** exist for Bohol's islands only; every island with a stamp has one.
- **Coming back from the flow resets the passport demo** (a fresh page load), as any navigation does.
- Arriving with `status=discovery` or `pending` works, but the passport demo offers the labelled
  Share pill only after verification, as the task asked.
