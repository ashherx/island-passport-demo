# Sound handoff

Sound design for the demo: paper, cover, stamp, the Verified seal, the Provincial Stamp and the interface. Everything is synthesized with Web Audio at the moment it plays. No audio files, no downloads, no licences.

Audition: `http://localhost:3100/lab/sound` (a button per sound and variant, the mute switch, master volume, and the whole story in order).

**Nothing is wired into the demo yet.** This step only added new files. The hook-up plan is at the end.

**Nobody has listened to these.** They were designed from first principles and checked by numbers (levels, spectra, envelopes). They need a pass by ear on a phone and on a laptop before the pitch; the knobs to turn are listed under "Tuning".

## Files

| Path | What it is |
| --- | --- |
| `src/lib/sound/index.ts` | The public surface: `play`, `useSound`, `setMuted`, `setVolume`, ... |
| `src/lib/sound/synth.ts` | The sounds. Pure synthesis on any `BaseAudioContext`; no state, no imports. Default levels live in `SOUND_DEFS` at the bottom |
| `src/lib/sound/engine.ts` | One lazy `AudioContext`, gesture unlock, resume, master gain, limiter, mute and volume store, persistence |
| `src/lib/sound/play.ts` | `play.x()` wrappers |
| `src/lib/sound/useSound.ts` | React hook (`useSyncExternalStore`) |
| `src/lib/sound/strings.ts` | Copy for the sound switch and the lab page |
| `src/app/lab/sound/page.tsx` | The lab page |
| `scripts/scratch/sound-render.mjs` | Renders every sound offline to `scripts/scratch/sound-renders/*.wav` and prints levels, spectra and envelopes |
| `scripts/scratch/sound-lab.mjs` | Loads the lab page, presses every button, checks for errors, real output, mute, persistence, resume, and a browser with no Web Audio |
| `scripts/scratch/sound-limiter.mjs` | Measures the limiter's built-in make-up gain |

No packages were added.

## API

```ts
import { play, useSound, setMuted, intensityFromVelocity } from "@/lib/sound";

play.stampPress();                                  // fire and forget
play.pageFlip({ duration: 0.78 });                  // options per sound
const h = play.provincialReveal({ volume: 0.8 });   // every call takes volume and delay
h.stop();                                           // fade out early (skip, interruption)

const { muted, volume, unlocked, available, toggleMuted, setMuted, setVolume } = useSound();
```

Every `play.x(options?)` is safe anywhere: on the server, before the first gesture, while muted and where Web Audio is missing it is a silent no-op. Nothing in the module throws.

Common options on every sound: `volume` (multiplies the default level, 0..2) and `delay` (seconds from now, scheduled on the audio clock so it is exact). Every call returns `{ stop(fade = 0.08) }`.

| Call | Options | What you hear | Audible length |
| --- | --- | --- | --- |
| `play.pageFlip` | `duration` (s, the flip animation; default 0.5), `intensity` 0..1 (default 0.6), `light` | Fingertip scrape, a grainy swish that brightens as the sheet comes over, a soft flap and a smaller settle. The flap lands at 84% of `duration`. Pitch, filter, level and timing vary a little on every call | `duration` + 0.05 s |
| `play.pageRiffle` | `count` (5), `duration` (1 s) | `count - 1` light flips and a full one, as a single call | about 1.1 s |
| `play.coverOpen` | `duration` (0.96 s to landing), `thud` (true), `creak` 0..1 | Faint leather creak, air, the board landing on the table | 1.1 s |
| `play.coverClose` | `duration` (0.88), `thud`, `creak` | Shorter creak, air that builds, the board landing on the pages | 1.05 s |
| `play.coverThud` | `kind: "open" \| "close"` | The landing alone | 0.15 s |
| `play.stampPress` | `intensity` 0..1 (1), `lift` (s after the hit, default 0.2; `false` for none) | Wood-and-desk thunk, rubber slap, a wet ink squish, then a tiny sticky peel as the stamp lifts | 0.25 s |
| `play.verified` | `notes: 2 \| 3` (3), `chimeOnly` | Embossing press, then E5, G#5, B5 over a quiet low fifth | 0.8 s |
| `play.provincialReveal` | `bloomAt` (0.46 s), `duration` (1.5 s) | Pad on E add9 fading up from the bottom note while its filter opens, a breath of air, a soft bell chord at `bloomAt`, sparkles climbing into it and scattering after | 2.1 s |
| `play.provincialLand` | `flight` (0.64 s), `press` (0.13 s) | Whoosh that grows through the flight, a rounded hit at `flight + press`, an open fifth and five sparkles | 1.3 s |
| `play.tap` | | A felt tick | 0.03 s |
| `play.toast` | | One rounded blip (B5) | 0.17 s |

`intensityFromVelocity(pxPerMs)` maps a drag's release speed to `intensity` (0.2 px/ms, the engine's flick threshold, gives 0.44; 1.45 px/ms and up gives 1).

Other exports: `setMuted(bool)`, `toggleMuted()`, `setVolume(0..1)`, `getSoundState()`, `subscribe(fn)`, `canPlaySound()`, `unlock()`, `setPlayOnSilentSwitch(bool)`, `playSound(name, options)`, `SOUND_DEFS`, `SOUND_NAMES`.

### State

`useSound()` returns `{ muted, volume, unlocked, available }`:

- `muted`: the user's choice, saved in `localStorage` under `ip-sound` (inside try/catch; where storage is blocked it lasts for the visit). Default `false`.
- `volume`: master volume, default 0.8, saved with it.
- `unlocked`: a gesture has started the audio context and it is running.
- `available`: the browser has Web Audio.

On the server and during hydration the hook returns the defaults, then the saved choice. A switch should render its "on" look only after mount (see the lab page's `mounted` flag) to avoid a flash for someone who muted last time.

### How the engine behaves

- **No context until it is needed.** It is created on the first gesture, and only if sound is not muted. A muted visitor never creates one.
- **Unlock.** Capture-phase listeners on `window` for `pointerdown`, `pointerup`, `touchend`, `click` and `keydown` create and resume the context. They run before any React handler, so a sound played in the very first click handler still plays. iOS Safari and the in-app browsers only accept `touchend`, `pointerup` and `click`; the resume is retried on each.
- **Suspended or interrupted** (phone call, lock screen, tab switch): resumed on the next gesture and when the page becomes visible.
- **Never late.** A sound asked for while the context is not running waits up to 250 ms for the resume and is otherwise dropped. A moment that plays with no gesture behind it stays silent; it does not go off later.
- **Throttle.** Each sound has a minimum gap (`minGap` in `SOUND_DEFS`: 45 ms for flips, 40 ms for taps) so a burst of events cannot stack.
- **Limiter.** Master gain, then a compressor at -4 dB, then a trim that cancels the compressor's own make-up gain. Single sounds pass untouched; overlaps cannot clip.
- **iPhone silent switch.** Web Audio follows it: a phone on silent plays nothing. `setPlayOnSilentSwitch(true)` (iOS 17+) overrides that. It is off by default. **For the pitch, decide this deliberately**: if the judges' phones are on silent and nobody calls it, they hear nothing.

## Levels

Measured from offline renders at 48 kHz, before the master volume (which is 0.8, another -1.9 dB). "Loudest 100 ms" is K-weighted, as in loudness metering. The phone column is the same measure through a 380 Hz high-pass, which is roughly what a phone speaker leaves.

| Sound | Peak dBFS | Loudest 100 ms | On a phone |
| --- | --- | --- | --- |
| stampPress | -3.5 | -16.0 | -20.5 |
| provincialLand | -6.1 | -16.2 | -20.7 |
| verified | -10.8 | -19.2 | -19.8 |
| provincialReveal | -11.7 | -19.2 | -21.2 |
| coverOpen / coverClose | -7.3 / -8.7 | -21.0 / -19.6 | -27.4 / -26.0 |
| pageFlip (default) | -12 to -15 | -23 to -24 | -23 to -24.5 |
| pageFlip, hard flick | -12.1 | -21.0 | -21.6 |
| pageFlip, 780 ms tap flip | -12.7 | -25.7 | -25.9 |
| pageFlip, light | -19.6 | -26.6 | -26.6 |
| toast | -16.5 | -24.3 | -24.6 |
| tap | -19.4 | -33.3 | -33.6 |

The order is the intended one: the two presses lead, the chime and the award sit just under them, paper is 6 to 8 dB below, the interface is barely there. Nothing clips. Full table with spectra and envelopes: `scripts/scratch/sound-renders/levels.txt`; re-run with `node scripts/scratch/sound-render.mjs`.

Design notes that matter when tuning:

- **Decay values are the time to -80 dB**, not a time constant. A `decay: 0.3` tone is 30 dB down after about 110 ms.
- **Phones play nothing under about 300 Hz.** Every thud has a low body (through a soft saturator, which adds harmonics a phone can play) and a 400 to 1000 Hz knock. The cover thuds are deliberately the weakest on a phone.
- **Paper uses a grainy noise bed** (`crackle`), not smooth noise. Smooth noise sounds like wind.
- **Everything pitched is in E major**, so the chime, the award and the notice blip sound like one instrument.

### Tuning

All in `src/lib/sound/synth.ts`:

- Relative loudness: the `level` of each entry in `SOUND_DEFS`.
- Too hissy or too dull a page: the swish band-pass sweep in `pageFlip` (1150 to 2500 Hz) and its low-pass (5600 Hz).
- Creak too present: `creak()` (or pass `creak: 0`; the lab has that button).
- Chime key or notes: the `N` table and `verified()`.
- Award too long or too sweet: `duration`, the pad levels and the scatter count (12) in `provincialReveal()`.

## Hook-up plan

Line numbers move while other work is in flight, so each step names the function. All calls are one-liners; none needs a guard.

### 1. One mute switch for everything

- `src/components/demo/Demo.tsx`: remove `const [sound, setSound] = useState(false)`. Use `const { muted, setMuted } = useSound()`.
- The switch in the action bar (`tools={<StampPressSoundToggle ... />}`): keep the component, drive it from the engine: `sound={mounted && !muted}` and `onSoundToggle={(on) => { setMuted(!on); if (on) play.tap(); }}`. `mounted` is a `useEffect` flag, as on the lab page.
- `src/components/moments/stamp-press/SoundToggle.tsx`: in `onClick`, delete `if (next && primeSound()) playThunk(0.5)` and the `feedback` import; use `canPlaySound` from `@/lib/sound` for the availability check. `setMuted(false)` unlocks audio inside the click.
- Default: the engine starts unmuted, so the demo makes sound from the first tap. If the pitch should open silent, call `setMuted(true)` once when nothing is saved, or leave it and let the switch do its job. The lab page for the stamp press (`src/app/lab/stamp-press/page.tsx`) has its own `sound` state: switch it to `useSound()` the same way.

### 2. Stamp press

- `src/components/moments/StampPress.tsx`, `impact(physical)`: replace `if (p.sound && soundReady()) playThunk();` with `if (p.sound !== false) play.stampPress({ intensity: physical ? 1 : 0.5, lift: physical ? PRESS.liftStart - PRESS.impact : false });`. That is the instant the rubber meets the paper (`PRESS.impact`, 0.70 s into the moment); the peel tick then lands on `PRESS.liftStart` (0.90 s). `physical` is false for the reduced-motion and skipped paths, which get a softer hit and no peel.
- Change the `sound` prop's default to `true` and its doc comment (the global mute now decides), or drop the prop and the `sound={sound}` line in `Demo.tsx`.
- `src/components/moments/stamp-press/feedback.ts`: delete the whole "Sound" section (`audio`, `noise`, `audioCtor`, `canPlaySound`, `primeSound`, `soundReady`, `noiseBuffer`, `playThunk`) and their re-exports in `StampPress.tsx` (`canPlaySound, primeSound, playThunk`). Vibration and `nudge` stay.

### 3. Page flips

The engine knows the three things the sound wants (duration, riffle or not, release speed), so the call goes in the engine, not in the React wrapper.

- `src/components/passport/engine-lib/flip-engine.ts`, `patchAnimation()`, inside `flip.animateFlippingTo`, right after `duration` and `ease` are decided:
  - `if (isTurned)` (next to the existing `onFlipStart` call): `play.pageFlip({ duration: duration / 1000, light: !!this.riffle && this.riffle.left > 0, intensity: release ? this.releaseIntensity : 0.6 });`. Offset 0: the sound's own layout puts the flap at 84% of `duration`, where the page lands. In a riffle every page but the last is `light`, and the 45 ms throttle keeps a fast riffle from stacking.
  - `else if (needReset && release)` (a dragged page let go and falling back): `play.pageFlip({ duration: duration / 1000, light: true, intensity: 0.3 });`.
  - Not for `!needReset` (the corner peel under a hovering mouse) and not for `peek()`: silent.
- Release speed: add `private releaseIntensity = 0.6;`. In `onPointerUp`, in the `drag.active` branch where `v` is computed, set `this.releaseIntensity = intensityFromVelocity(v);` before `this.flip.animateFlippingTo(...)`.
- `turnTo(page, fade)` (the cross-fade used for reduced motion and jumps): `play.pageFlip({ duration: 0.2, light: true, intensity: 0.3 })` at the start of the fade, or nothing.
- `src/components/passport/engine-custom/engine.ts` is not used by the demo; if it is ever shown, the same call goes where a turn is committed.

### 4. Cover

`src/components/passport/engine-lib/PassportBook.tsx`, `swing(target)`. The swing can be reversed mid-air, so play the air at the start and the landing when it happens:

- At the top of `swing`, after `share` is computed and the `share < 0.004` early return: `coverSound.current?.stop(); coverSound.current = target === "open" ? play.coverOpen({ duration: from > -1 ? 0.96 : 0.3 + 0.6 * share, thud: false, creak: share > 0.6 ? 1 : 0 }) : play.coverClose({ duration: 0.3 + 0.58 * share, thud: false, creak: share > 0.6 ? 0.6 : 0 });` with `const coverSound = useRef<SoundHandle | null>(null)`.
- Opening, in `settle()` (the main swing's `onComplete`, the instant the board meets the table, before the 0.22 s give): `play.coverThud({ kind: "open" })`.
- Closing, in the close animation's `onComplete`, before the `share < 0.5` check: `play.coverThud({ kind: "close" })`.
- Do not put it in `finish()` or in `thud()`: those run after the bounce, 0.22 to 0.24 s late.
- `crossfade()` (reduced motion): `play.coverThud({ kind, volume: 0.6 })` when the fade starts. `turnOver()` (front to back): `play.coverThud({ kind: "close", volume: 0.7 })` in its `onComplete`, next to `thud()`.

### 5. Verified seal

`src/components/moments/StatusUpgrade.tsx`:

- In `play()`, in the `at(T.impact, ...)` callback (1.42 s, the seal pressing on), before `impact(HAPTICS.sealPress)`: `play.verified();`.
- Reduced-motion branch, `at(0.12, ...)`: `play.verified({ chimeOnly: true, volume: 0.8 });`.
- Not in `impact()` itself: `finish()` calls it for the skip path, and a skipped upgrade should stay quiet. If a skip should still confirm, add `play.verified({ chimeOnly: true })` in `skip()`.

### 6. Provincial Stamp

`src/components/moments/ProvincialAward.tsx`, `AwardOverlay`:

- Reveal: in the mount effect, next to `animate(backdropOpacity, 1, ...)`, in the `!reduced` branch: `revealSound.current = play.provincialReveal({ bloomAt: T.confetti });` (`T.confetti` is 0.46 s, so the bell chord opens with the confetti burst). Reduced motion: `play.verified({ chimeOnly: true, notes: 2 })` instead, or nothing. Note the overlay opens from a state change, not from a click: it plays because the context is already running from the visitor's earlier taps.
- Leaving: in `add()`, after `goto("leaving")`: `revealSound.current?.stop(0.3);` so the pad does not hang over the flight.
- Land: in `fly()`, right after `goto("flying")`: `landSound.current = play.provincialLand({ flight: T.flight, press: T.press });`. The hit then falls at 0.77 s, exactly where `later(T.flight + T.press, ...)` calls `buzz(HAPTICS.awardLand)`. Not in the no-target fallback above it.
- Skip: in `skip()` and in `close()`: `revealSound.current?.stop(); landSound.current?.stop();`.

### 7. Action bar and notices

- `src/components/demo/ActionBar.tsx`: `play.tap()` at the top of the main button's `onClick` (wrap `onAction`) and of the replay button's `onClick`. Not on `onIntent` (hover and touch-start preloading).
- `src/components/passport/content/StampDetailSheet.tsx` and the cover's open button, if wanted: `play.tap()` on open. Keep taps off anything that already makes a bigger sound in the same instant (the "Collect stamp" tap is 0.7 s before the stamp hit, which is fine).
- `src/components/demo/Demo.tsx`, `say()`: `play.toast({ delay: 0.12 })` for tones `"discovery"`, `"pending"` and `"neutral"`. Skip it for `"verified"` and `"provincial"`: those notices follow the chime and the award, and a blip on top of them is clutter. If the "Stamp collected" notice appears within about 0.3 s of the stamp hit, skip it there too or raise the delay to 0.5.

### 8. After wiring

- `node scripts/scratch/sound-lab.mjs` still passes (it only touches the lab page).
- Listen on a real iPhone (Safari and one in-app browser) and a laptop. Check: first tap makes sound; lock and unlock the phone, next tap still makes sound; the switch silences a sound already playing.
- `pnpm exec tsc --noEmit`.
