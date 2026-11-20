# Stamp press handoff (UX-3: earning a stamp)

The moment a stamp is earned. A stamper appears above the slot with its inked face showing, swings over the page, slams down and lifts away to leave the impression.

Live: `http://localhost:3100/lab/stamp-press` (a passport page, a "Collect stamp" button, repeatable, six stamps covering every frame shape).

## Files

| Path | What it is |
| --- | --- |
| `src/components/moments/StampPress.tsx` | `<StampPress />`, `preloadStampPress()`, and re-exports of everything below |
| `src/components/moments/stamp-press/timeline.ts` | The whole moment as keyframes: every value on screen is a pure function of time |
| `src/components/moments/stamp-press/stamper.ts` | Canvas renderer for the stamper (the hand tool) |
| `src/components/moments/stamp-press/materials.ts` | What the stamper is made of in each art direction |
| `src/components/moments/stamp-press/feedback.ts` | Vibration, the synthesized thunk, the page nudge |
| `src/components/moments/stamp-press/InkSpeckles.tsx` | `<InkSpeckles />`: the ink flecks around a fresh stamp |
| `src/components/moments/stamp-press/SoundToggle.tsx` | `<StampPressSoundToggle />` |
| `src/components/moments/stamp-press/strings.ts` | Copy this moment adds (see "Things in files I do not own") |
| `src/app/lab/stamp-press/page.tsx` | The lab page |
| `scripts/scratch/stamp-press-*` | Throwaway screenshot, behaviour and performance scripts |

No packages were added.

## Use it

```tsx
import { StampPress, InkSpeckles, preloadStampPress } from "@/components/moments/StampPress";

const slotRef = useRef<HTMLDivElement>(null);   // the box that holds the slot's <Stamp />
const bookRef = useRef<HTMLDivElement>(null);   // whatever should take the hit

<div ref={bookRef}>
  <div ref={slotRef} style={{ position: "relative", width: 176, height: 176 }}>
    {slot.stamp ? (
      <>
        <Stamp stamp={slot.stamp} size={176} />
        <InkSpeckles stamp={slot.stamp} size={176} />   {/* optional, see below */}
      </>
    ) : (
      <Stamp slot={slot} size={176} />
    )}
  </div>
</div>

{pressing && (
  <StampPress
    key={runId}                 // a new key replays it
    stamp={newStamp}            // the stamp exactly as the page will show it
    target={slotRef}
    surface={bookRef}
    sound={soundOn}
    onImpact={() => commitStamp()}        // put the stamp in your data: slot, counters, ring
    onComplete={() => setPressing(false)} // unmount
  />
)}
```

The contract, in order:

1. Mount `<StampPress>` (or flip `active` to true). It measures the target and plays.
2. At impact it sets `opacity: 0` on the **target element** and, about 50 ms later, calls `onImpact`. Commit the stamp there. Your real `<Stamp />` renders into the hidden target unseen.
3. From 1.16 s the target fades back in under the overlay, then the overlay fades out (the hand-over). At 1.42 s `onComplete` fires with the overlay already invisible. Unmount it.

If you only commit in `onComplete`, it still works: the overlay stays opaque until you unmount it, and you get a hard swap in place of the hand-over (a one-frame change in ink grain, see Known issues).

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `stamp` | `Stamp` | | The stamp being earned. Its `id` fixes the tilt, the ink grain and the flecks |
| `target` | `Element \| RefObject \| {left,top,width,height} \| () => rect \| null` | | The slot, in viewport coordinates. An element is followed while the page scrolls or resizes |
| `active` | `boolean` | `true` | False renders nothing. Plays when it turns true |
| `size` | `number` | measured | Pixel size of the impression. Default: the `.ip-stamp` inside the target, else the target's smaller side. Must equal the size of the page's own stamp |
| `rotate` | `number \| false` | stamp's own tilt | Pass the same value you pass to the page's `<Stamp rotate>` |
| `ink` | `"rough" \| "clean"` | `"rough"` | `clean` drops the SVG ink filter while animating. A fallback for very slow phones |
| `surface` | `Element \| RefObject \| null` | nearest `[data-press-surface]` ancestor | Element nudged on impact |
| `hideTarget` | `boolean` | `true` | Hide the target from impact until the hand-over |
| `sound` | `boolean` | `false` | Play the thunk. Silent until `primeSound()` has run in a gesture (the toggle does that) |
| `haptics` | `boolean` | `true` | `navigator.vibrate([12, 30, 18])` at impact, feature-detected |
| `skippable` | `boolean` | `true` | Tap anywhere, Escape, Enter or Space fast-forwards (the rest plays in about 0.2 s) |
| `announce` | `boolean` | `true` | Visually hidden `role="status"`: the skip hint, then "Stamp collected ...". Set false if you show your own status message |
| `speed` | `number` | `1` | Playback rate. `0.25` is slow motion |
| `zIndex` | `number` | `80` | Of the fixed overlay |
| `onImpact` | `() => void` | | Once, about 0.75 s in |
| `onComplete` | `() => void` | | Once, about 1.42 s in, or right after a skip |
| `freezeAt` | `number` | | Development aid: hold the moment at this time (seconds) |

`onImpact` then `onComplete` always fire, in that order, including after a skip, with reduced motion, and when the target cannot be found (both fire at once so the host never hangs).

### What plays (seconds)

| Time | Beat |
| --- | --- |
| 0.00 | Stamper fades in above the slot, tipped back so the inked, mirrored face of the die shows |
| 0.18 | It swings over the page, lifts and tilts (anticipation) |
| 0.575 | Slam, accelerating |
| 0.70 | Impact: squash, page nudge, vibration, thunk, shock ring, ink flecks fly out |
| 0.72 | Hold: the tool rests on the page and rocks once |
| 0.90 | Lift: the rubber sticks for a beat, then peels away |
| 0.74 to 1.24 | Ink: `inkProgress` goes blotchy, stalls, fills in, under a radial mask that spreads from the contact point (lower left of centre). Hidden under the tool until the lift at 0.90 |
| 0.93 to 1.42 | Micro-bleed: a soft wet copy under the ink dries away; the impression relaxes from 102% |
| 1.04 to 1.40 | Glint crosses the wet impression |
| 1.16 to 1.42 | Hand-over to the page's own stamp |

All of it lives in `timeline.ts` as keyframe tables. `STAMP_PRESS_TIMING` (`duration`, `impact`, `liftStart`) is exported if another moment needs to sync.

### Reduced motion (UX-5)

No stamper, no nudge, no canvas. The impression fades in over 0.35 s and hands over in a further 0.15 s. One 12 ms vibration. `onImpact` fires at the start, `onComplete` at the end.

### Sound

```tsx
import { StampPressSoundToggle } from "@/components/moments/stamp-press/SoundToggle";
const [sound, setSound] = useState(false);          // muted by default
<StampPressSoundToggle sound={sound} onSoundToggle={setSound} className="..." />
<StampPress sound={sound} ... />
```

The toggle is a `role="switch"` button. Turning it on creates the `AudioContext` inside the click (the only time a browser allows it) and plays one quiet thunk as confirmation. Nothing audio-related exists before that click. It renders nothing where Web Audio is missing. The thunk is synthesized (a pitched-down sine, a short triangle knock, a band-passed noise slap, about 160 ms). To prime from your own control, call `primeSound()` in a click handler.

### Flecks that stay

The overlay throws five or six ink flecks around the stamp. They fade with the overlay unless the page draws the same ones: put `<InkSpeckles stamp={stamp} size={size} />` in the same `position: relative` box as the stamp. Positions are deterministic from the stamp id, so they match.

### Warming up (UX-7)

```tsx
preloadStampPress(stampAboutToBeEarned, tokens, slotSizePx); // tokens from useTheme()
```

Fetches and tints the artwork for the die face, and with a size bakes the engraved top of the tool. Cached, safe to call repeatedly. Without it the first press still works; the artwork on the die may then be missing if it arrives after the face has turned away.

**Do not load `StampPress` with `next/dynamic` or `React.lazy`.** A component that suspends on its first mount is held back by React's 300 ms fallback throttle, so the first press would start a third of a second late. Import the module by hand and keep the component in state, as the lab page does:

```tsx
const loadPress = () => import("@/components/moments/StampPress");
const [Press, setPress] = useState<typeof import("@/components/moments/StampPress")["StampPress"] | null>(null);
useEffect(() => { void loadPress().then((m) => setPress(() => m.StampPress)); }, []); // or on idle
{pressing && Press && <Press ... />}
```

## How it is built

- **Overlay.** A `position: fixed` layer portalled to `<body>`, so nothing in a passport page can clip it. It carries `data-direction`, so it is themed correctly inside a `<DirectionScope>` too. It holds the impression (positioned on the slot, snapped to device pixels), the stamper canvas and a full-screen tap catcher while playing.
- **Stamper.** Drawn on a 2D canvas by a small software renderer: the handle is a lathe profile drawn as stacked ellipses, the mount and die are extruded footprints, and the pitch flips the painter's order when the face turns away. Canvas rather than CSS 3D so it looks identical in every engine and has no `preserve-3d` sorting to go wrong. The mount matches the stamp's frame (round, oval, rounded rectangle, octagon), the top is engraved with "ISLAND PASSPORT" and the island name, and the die shows the stamp's own artwork mirrored. Materials per direction: classic is midnight lacquer and brass on oxblood rubber, reef is coral enamel on a sea-green mount, journal is turned beech on walnut with black rubber.
- **Impression.** The foundation `<Stamp inkProgress>` driven by a MotionValue, under a radial CSS mask that spreads from the contact point, over a blurred "wet" copy that fades.
- **One clock.** A single `animate(0, 1.42)` drives everything. Skip fast-forwards the same timeline, so the end state is always the same.
- **Nudge.** Web Animations on the individual `translate` and `scale` properties, so it composes with any `transform` the surface already has and leaves no inline style. Engines without those properties skip it.

## Accessibility

- The overlay is decorative (`aria-hidden` canvas, decorative stamps). A hidden `role="status"` announces the skip hint and then "Stamp collected. {title}, {island}. A Discovery stamp is now in your passport."
- Escape, Enter and Space skip. The handler ignores key repeat and the first 140 ms, so the Enter that started the press does not also skip it.
- Keep the trigger button focusable while the press plays: use `aria-disabled`, not `disabled`. A disabled button drops focus to `<body>` (the lab had this bug; fixed).

## What I checked, and how

All in Chromium only (headless, 390x844 at 2x). Scripts are in `scripts/scratch/stamp-press-*`.

- **Looks**: froze the moment with `?t=` and read the screenshots: 14 points for classic light, 4 to 12 for the others, covering all three directions, light and dark, and all four mount shapes (round, oval, rounded rectangle, octagon). Not every direction/mode/shape combination. Stills only: I cannot watch it move, so the feel of the timing is judged from frame sequences, not from playback.
- **Live run**: impact fires `navigator.vibrate([12,30,18])` once; `onImpact` then `onComplete`; overlay unmounts; the slot's inline opacity is restored; focus stays on the button.
- **Skip**: by tap and by Escape, both finish in under 0.6 s from the click that started the press.
- **Reduced motion**: no canvas, no nudge animation on the surface, done in about 0.6 s.
- **Scroll**: scrolling 90 px mid-press keeps the overlay on the slot (same rect to the pixel).
- **Sound**: no `AudioContext` exists before the toggle is clicked; one is created on the click; the press plays through it.
- **Frame pacing**: with GPU rendering (`--use-angle=metal`, an Apple M3) and CDP CPU throttling at 4x, one press in each direction ran at 60 fps: 111 to 114 frames averaging 16.8 to 17.0 ms, the only long frame being one of 33 to 50 ms at the click (mounting). One run at 6x looked the same. Earlier runs, made while the art was still the SVG placeholders, had a 100 ms frame at the click and sometimes a 33 ms frame when the host re-rendered after `onImpact`. Without a GPU (default headless, software rasteriser) and 4x throttling it averages 32 ms a frame, about 30 fps. That says more about software canvas than about phones, but it is the reason for the `ink="clean"` escape hatch. A desktop GPU is not a mid-range Android: treat these numbers as "the main thread is not the bottleneck", not as a phone measurement.

Not checked: any real phone, iOS Safari, or the Instagram, TikTok and Facebook in-app browsers. I could only run Chromium here. I have not heard the thunk (headless), only confirmed it is scheduled.

## Known issues and notes

- **WebKit is untested.** The pieces most worth a look on a real iPhone: `filter: url(#...)` being re-run each frame during the ink reveal (0.9 to 1.24 s), the radial `-webkit-mask-image` on its parent, and the nudge (`translate`/`scale` in Web Animations needs Safari 14.1 or later; older ones simply skip it). If the reveal stutters, pass `ink="clean"`.
- **iOS has no Vibration API.** `canVibrate()` is false there and nothing happens. The lab shows which case the current device is.
- **The overlay and the page's stamp are never pixel-identical.** Same component, same size, same seed, but the SVG ink filter rasterises differently in a different layer (edges differ by a fraction of a pixel). That is why the moment ends in a cross-fade and not a swap. If you commit the stamp in `onComplete` and skip the hand-over, expect a faint one-frame change in grain.
- **`hideTarget` writes inline `opacity` and `transition` on the target** and restores both at the end. Do not drive `opacity` on that same element from React during the press. Pass the element that holds only the slot's stamp: anything else inside it (a caption, say) is hidden for those 0.7 s too.
- **The target must contain the real stamp by 1.16 s** for the hand-over, which means committing in `onImpact`. The check is `.ip-stamp:not([data-status="empty"])` inside the target.
- **A rect target cannot be hidden or handed over** (there is no element). The overlay then stays until you unmount it.
- **The nudge needs a surface.** Without `surface` and without a `[data-press-surface]` ancestor, only the impression itself nudges. Do not use `<body>`: a transform there would re-anchor every `position: fixed` element for the duration.
- **Mounting costs one long frame** (33 to 50 ms at 4x CPU throttling: two stamps, the canvas, and the baked top face when it was not preloaded). It happens on the tap, before the first frame, so it reads as latency, not as a dropped frame mid-swing.
- **The stamper canvas is capped at 2x device pixel ratio.** On a 3x phone the tool is slightly softer than the page. It moves the whole time, so I judged that the right trade.
- **The die face shows the artwork and frame, not the lettering.** Text on the die is drawn as dashes; it is on screen for about 0.3 s at an angle.
- **Provincial Stamp: untested.** The code handles `kind: "provincial"` (round mount, provincial ink), but I never ran it: the lab only offers island stamps, and the award celebration is another agent's.
- **Generated art arrived while I was working** (`assets.manifest.json` now lists PNGs and textures). The die face uses `artUrl()`, so it switched by itself; I re-checked it with the PNG art. Right after the switch the dev server served stale HTML for my route until I re-saved `page.tsx` (the same stale-module issue the foundation notes describe).

## Things in files I do not own

- **Strings (TEC-12).** `src/lib/strings.ts` is the foundation's. The copy this moment adds is in `src/components/moments/stamp-press/strings.ts` (`pressStrings`: the skip hint, the sound toggle labels, the lettering engraved on the tool, and the lab page copy). Move that object into `strings` and re-point the imports in `StampPress.tsx`, `SoundToggle.tsx` and the lab page (three files). Everything else on screen already comes from `strings`.
- **Progress text in the lab.** The count that ticks on impact is assembled from `strings.progress.ring` with an empty `{n}` so the number can animate on its own. A `ringRest` string ("of {total} {province} stamps") would be cleaner.
- **Direction tokens.** The stamper's materials are in `stamp-press/materials.ts`, not in `directions.ts`. They only take the foil colours from the tokens. If the art directions change colour, check the tool still matches.
