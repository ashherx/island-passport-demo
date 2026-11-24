# Part 3 share kit (key: kit)

Shared building blocks for the partner share flow, the traveler share flow and the recipient
landing page. Everything is fictional sample content and light "Daylight Atlas" styling.

- Components: `src/components/share/kit/**` (import from `@/components/share/kit`)
- Sample data and URL helpers: `src/lib/share/**` (import from `@/lib/share`)
- Hub: `/share` (`src/app/share/page.tsx`, `hub.css`)
- Living reference with every component wired up: `/share/kit` (`src/app/share/kit/KitGallery.tsx`).
  Copy from it freely; it is the quickest way to see correct usage.
- Placeholders the next agents own and replace: `src/app/share/partner/page.tsx`,
  `src/app/share/traveler/page.tsx`, `src/app/s/[code]/page.tsx`. They use
  `src/app/share/ComingSoon.tsx`; drop that import when you replace the page.

## Product rules the kit already encodes (keep them in the flows)

- No passwords anywhere. Wording: `shareCopy.noPasswords` ("one-time code, with a sign-in link as a backup").
- Island Passport never collects donations. Wording: `shareCopy.noDonations` (`{charity}` placeholder)
  and `shareCopy.pending` ("Pending confirmation. Your stamp is issued once {charity} confirms the donation.").
- Any partner type can offer a stamp: creator, travel agency, establishment, charity, tourism board.
- Thresholds are EXAMPLES. Never print a figure without `shareCopy.exampleThreshold`.
- Everything fictional carries a SAMPLE mark: `<SampleTag />`, `ShareShell` puts one in the brand bar
  and a notice in the footer, `PostPreview` prints one inside every mockup.
- No platform branding. Formats are called "Feed post", "Story", "Short video" (`shareCopy.formats`).
  The mockup chrome is generic: heart, speech bubble, forward arrow, star.
- Consistent with `Technical_Questions.md`: a website cannot post straight into a story or a short
  video app, so `ShareSheet` is "share sheet when the phone offers it, else save, copy caption, open
  your app"; the QR code and short link are always inside the artwork (captions are not tappable);
  the promoter's code lives in the link (`/s/<owner>-<island>`), not in a cookie; the embed is a
  display-only iframe with one button. Do not present in-app browser behaviour as solved.

## Sample data (`@/lib/share`)

```ts
import {
  SAMPLE_PARTNERS, DEFAULT_PARTNER, getPartner,       // SharePartner[]
  SAMPLE_TRAVELER, featuredStampAs,                   // ShareTraveler
  SAMPLE_OWNERS,                                      // partners + traveler
  BOHOL_REELS, reelsForIsland, featuredReel, getReel, reelSeconds, formatDuration,
  captionSuggestions, hashtagSuggestions, defaultHashtags, BRAND_TAGS, CAPTION_LIMIT,
  shareCopy, EXAMPLE_THRESHOLDS,
  shareCode, sharePath, shareDisplayUrl, shareUrl, liveShareUrl, embedSnippet,
  resolveShareCode, allShareCodes, SAMPLE_PARTNER_CODE, SAMPLE_TRAVELER_CODE, SHARE_DOMAIN,
} from "@/lib/share";
```

### Partners (`SAMPLE_PARTNERS`, type `SharePartner`)

| id | code | type | name | handle | socialHandle | islands (first is default) | offer | hasWebsite |
|---|---|---|---|---|---|---|---|---|
| mia-sample | `mia` | creator | Mia Sample | @mia.sample | @mia.sample | bohol, panglao, balicasag, pamilacan | Sea turtle stamp, $5 | no |
| isla-trips | `islatrips` | travel-agency | Isla Trips | Tagbilaran, Bohol | @islatrips.sample | bohol, pamilacan, balicasag, banacon | River mangroves stamp, $5 | yes |
| bohol-dive-co | `boholdive` | establishment | Bohol Dive Co. | Alona Beach, Panglao | @boholdive.sample | panglao, balicasag, bohol | Reef wall stamp, $5 | yes |
| coral-trust | `coraltrust` | charity | Coral Trust | Reef conservation charity | @coraltrust.sample | bohol, balicasag, panglao, banacon | Double barrier reef stamp, $5 | yes |
| visayas-tourism-board | `visayas` | tourism-board | Visayas Tourism Board | Official tourism board | @visayastourism.sample | all five | Tourism Board Seal, $50 | yes |

Shape: `{ kind: "partner", id, code, type, name, handle, socialHandle, avatar: { initials, tint: [light, deep] },
blurb, islandIds, offer, stats, hasWebsite }`.

- `offer: { kind, title, art, shape, threshold: { amount, currency, display, example: true }, charity, purpose, passportSlotId? }`.
  `art` and `shape` are the passport demo's `StampArt` and `StampShape`, so `<Stamp>` from
  `@/components/stamp` can draw it. Every sample offer is confirmed by "Coral Trust".
- `stats: { donationsGenerated: { amount, display, donors }, stampsIssued, stampsPending, linkVisits, postsThisYear, postsGoal: 6 }`
  ("six posts a year", `shareCopy.postsGoal`). All invented.
- Labels for the type: `shareCopy.partnerTypes[partner.type]`.

### Traveler (`SAMPLE_TRAVELER`, type `ShareTraveler`)

The passport demo's sample traveler (Alex Rivera, from `SAMPLE_PASSPORT` in `src/lib/sample-data.ts`).
`{ kind: "traveler", id: "alex-rivera", code: "alex", name, handle, socialHandle: "@alex.sample", avatar,
passport, stamps, featuredStamp, charity, islandIds: ["pamilacan", "bohol", "balicasag", "banacon"], stats }`.

- `featuredStamp` is the stamp the passport demo collects (`DEMO_SCRIPT.collectSlotId`, the Pamilacan
  spinner dolphins), in status `"pending"`. `featuredStampAs("verified")` gives the same stamp at another stage.
- `stamps` = the stamps already in the passport plus the featured one.
- `stats: { linkVisits, friendsJoined, donationsGenerated }`.

### The six island videos (`BOHOL_REELS`, type `IslandReel`)

`{ id, islandId: "bohol", number: 1..6, title, summary, theme, art, endCardSeconds: 4, scenes: ReelScene[] }`
with `ReelScene = { photo: PhotoName, line, seconds, move: "in"|"out"|"left"|"right"|"up"|"down", focus?: [x%, y%] }`.

1. `bohol-sunrise` Sunrise over the Chocolate Hills (Landscape, 0:12)
2. `bohol-tarsier` Meet the tarsier (Wildlife, 0:13)
3. `bohol-reef-wall` The reef wall at Balicasag (Underwater, 0:13)
4. `bohol-dolphins` Dolphins at first light (Wildlife, 0:13)
5. `bohol-mangroves` The forest planted by hand (Conservation, 0:13)
6. `bohol-fifteen` Bohol in fifteen seconds (Highlights, 0:15)

- `reelsForIsland(islandId)`: the six, with the island's best match first (Bohol and its small islands
  all share the Bohol set; any other island returns `[]`).
- `featuredReel(islandId)`, `getReel(id)`, `reelSeconds(reel)` (without the end card), `formatDuration(s)` -> `"0:12"`.

### Captions and hashtags

- `captionSuggestions(owner, islandId)` -> three `{ id, tone, text }` ("Warm", "Short", "Facts first" for
  partners; "Warm", "Short", "The why" for the traveler), written per partner type and per island.
  None relies on a tappable link in the text: they point at the QR code and the profile link.
- `hashtagSuggestions(islandId, partner.type | "traveler")` -> eight tags (brand, island, audience).
- `defaultHashtags(islandId, audience)` -> the four switched on to start with.
- `CAPTION_LIMIT` = 2200.

### URL helpers (`src/lib/share/urls.ts`)

One code carries who shared and which island: `<ownerCode>-<islandId>`, e.g. `mia-bohol`, `alex-pamilacan`.

| helper | result |
|---|---|
| `shareCode(owner, islandId?)` | `"mia-bohol"` (defaults to the owner's first island) |
| `sharePath(code)` | `"/s/mia-bohol"`: the in-demo route. Use it as the `href` of every link and button |
| `shareDisplayUrl(code)` | `"islandpassport.app/s/mia-bohol"`: what is printed |
| `shareUrl(code)` | `"https://islandpassport.app/s/mia-bohol"`: what "Copy link" copies |
| `liveShareUrl(code, origin)` | what a QR encodes: the fictional URL on localhost, the real `/s/<code>` address on a deployed demo (so a phone can scan the screen). In components use the `useShareTarget(code)` hook |
| `embedSnippet(code, height?)` | the `<iframe>` snippet for a partner's website |
| `resolveShareCode(raw)` | `{ kind: "partner", code, partner, islandId } \| { kind: "traveler", code, traveler, islandId } \| null`. Accepts a bare owner code (`mia`); an unknown island falls back to the owner's first; unknown owner returns null |
| `allShareCodes()` | every valid code |
| `SAMPLE_PARTNER_CODE`, `SAMPLE_TRAVELER_CODE` | `"mia-bohol"`, `"alex-pamilacan"` (the hub links to these) |

Island names and data: `getIsland(islandId)` from `@/lib/islands/data`. Photos:
`photoSources(name, 640 | 1280 | 1672)` from `@/lib/islands/photos` returns `{ src, srcSet }`.

## Components (`@/components/share/kit`)

All styling is scoped under `.sk`. `ShareShell` sets it; for a root that is not a `ShareShell` (a
full-bleed recipient page, a portal) put `className={skRootClass}` on it. The stylesheet is imported
by `primitives.tsx`, so importing anything from the kit loads it.

### ShareShell (server-safe)

Page shell: soft sky background, sticky brand bar (wordmark links to `/share`, SAMPLE tag), centred
column, sample notice at the foot. Always light.

```tsx
<ShareShell back={{ href: "/share", label: "All share flows" }} end={<span>2 / 4</span>} width="narrow">
  ...
</ShareShell>
```

Props: `children`, `back?: { href, label }`, `end?: ReactNode` (right of the bar), `width?: "narrow" (560px, default) | "wide" (1120px)`,
`footer?: ReactNode | false`, `className?`.

### StepHeader (server-safe)

Progress for a multi-step flow: one bar per step, labels from 600px, "2 / 4 Personalise" on phones,
then eyebrow, title (an `<h1>`, one per screen) and lead.

```tsx
<StepHeader steps={[{ id: "choose", label: "Choose" }, ...]} current={step} onSelect={setStep}
  eyebrow="Mia Sample · Creator" title="Make it yours" lead="Add your name or a short line." />
```

Props: `steps: { id, label }[]`, `current: string`, `onSelect?: (id) => void` (finished steps become
tappable), `eyebrow?`, `title?`, `lead?`, `className?`.

### SkButton, Avatar, SampleTag (server-safe)

- `<SkButton variant="primary" | "secondary" | "ghost" | "ink" size="m" | "s" block href? ...buttonProps>`.
  With `href` it is a Next `<Link>`, otherwise a `<button type="button">`.
- `<Avatar avatar={owner.avatar} size={46} />`: initials on a tinted disc. No photos of people.
- `<SampleTag />` (or `<SampleTag>Sample partner</SampleTag>`).

### QrCode (server-safe)

Crisp SVG from the `qrcode` module matrix: soft pill rows, rounded finder eyes, globe mark in a
centre clearing (error correction rises to H when there is a mark). Checked with a decoder at the
sizes used here, including inside the rendered PNGs.

```tsx
const target = useShareTarget(code);
<QrCode value={target} name={partner.offer.charity} link={shareDisplayUrl(code)} />
```

Props: `value` (required), `size = 168`, `label = "Scan to support" | false`, `name?` (serif line under
the label: the charity or partner), `link?` (short link under the code; wraps, never cut),
`mark = true | false | ReactNode`, `frame = "card" | "bare"`, `variant = "soft" | "square"`,
`color = "#12293a"` (keep it dark), `animate = true`, `title?`, `className?`, `style?`.
Also exported: `qrMatrix(value, withMark?)`.

### LinkField (client)

The affiliate link with a Copy button that confirms itself. Prints and copies
`islandpassport.app/s/<code>`; tapping the link text follows `/s/<code>` inside the demo.

```tsx
<LinkField code={code} hint="Your code travels in the link, so you get the credit." />
```

Props: `code` (required), `label = "Your link" | false`, `hint?`, `newTab = false`, `onCopied?: (url) => void`, `className?`.

### CaptionEditor (client, controlled)

Tone chips, a textarea that grows, hashtag chips that toggle, live count of text plus hashtags.

```tsx
const [text, setText] = useState(suggestions[0].text);
const [tags, setTags] = useState(() => defaultHashtags(islandId, partner.type));
<CaptionEditor value={text} onChange={setText} suggestions={captionSuggestions(partner, islandId)}
  hashtags={hashtagSuggestions(islandId, partner.type)} selected={tags} onSelectedChange={setTags} />
const posted = composeCaption(text, tags); // text, blank line, hashtags
```

Props: `value`, `onChange`, `hashtags`, `selected`, `onSelectedChange`, `suggestions?`, `limit = 2200`,
`label = "Caption"`, `placeholder?`, `className?`.

### PostPreview (server-safe)

Neutral phone mockup. `format`: `"feed"` (4:5 media, header, action row, caption), `"story"` (9:16,
progress bars, link sticker, reply bar), `"short"` (9:16, action rail, caption over the video).
Everything inside is sized in container units, so it is crisp from a 96px thumbnail to 320px.

```tsx
<PostPreview format="story" width={264} author={authorOf(partner, "Bohol, Philippines")}
  caption={text} hashtags={tags} link={shareDisplayUrl(code)}
  media={<IslandReel reel={reel} islandName="Bohol" code={code} byline={`with ${partner.name}`} />} />
```

Props: `format` (required), `author: { handle, avatar, place? }` (use `authorOf(owner, place?)`),
`media: ReactNode` (an `<IslandReel>`, an `<img>`, or any node that fills its parent; a bare `<img>` is
cropped to cover), `caption?`, `hashtags?`, `link?` (story link sticker), `frame = "phone" | "bare"`,
`label?: string | false` (default the format name), `width?: number | string` (default 100% of the
parent: cap it), `lines?` (caption clamp: feed 4, short 2), `className?`, `style?`.
Also exported: `POST_FORMATS`, `POST_ASPECT`, `type PostFormat`.

For your own media (a passport, a stamp card) the frame exposes how much room its chrome covers as CSS
variables on the media area: `--sk-media-t`, `--sk-media-b`, `--sk-media-r` (in `cqw`). Pad with them so
nothing sits under the story header or the reply bar. Size things in `cqw` to scale with the mockup.

### IslandReel (client)

Turns a prepared photo sequence into a short animated "video": Ken Burns moves, crossfades, a line
per scene that rises in word by word, the sharer's byline and optional personal line, progress
segments, and an end card with the QR code and the short link. DOM and CSS, nothing is encoded.
Fills its parent (drop it in `PostPreview media`), or pass `aspect` to stand alone. Runs only while on
screen. Under reduced motion it does not autoplay and the photos stay still.

```tsx
const player = useRef<IslandReelHandle>(null);
<IslandReel ref={player} reel={reel} islandName="Bohol" code={code}
  byline={`with ${partner.name}`} avatar={partner.avatar} message="Come see it with me"
  support={`Scan to support ${partner.offer.charity}`} />
player.current?.showEnd(); // also play(), pause(), restart()
```

Props: `reel`, `islandName`, `code` (required); `byline?`, `avatar?`, `message?` (the sharer's own line,
under about 60 characters), `endTitle?` (default "Collect the *{islandName}* stamp"),
`support = "Scan to support"`, `autoPlay = true`, `loop = true`, `mode = "player" | "poster"` (poster = one
still frame, no timers: use it for pickers and grids), `posterAt = 0 | n | "end"`, `segments?`,
`controls?` (tap to pause and resume), `aspect?: "9/16" | "4/5" | "1/1"`, `sizes?`,
`onSceneChange?: (index, isEndCard) => void`, `onEnded?`, `className?`, `style?`.

### ShareSheet (client)

Bottom sheet on phones, centred dialog from 640px. Esc, scrim and close button dismiss it; focus is
trapped and handed back. Contents: thumbnail of the PNG it drew, "Share with…" (only when the
browser has the Web Share API; shares the PNG file when `canShare` allows it), then the three steps
that always work (Save the image, Copy the caption, Open your app and post), then Copy link and,
for partners with a website, the embed code. Inside an in-app browser it adds the "press and hold
the picture, or open in your phone's browser" hint.

```tsx
<ShareSheet open={open} onClose={() => setOpen(false)} code={code}
  caption={composeCaption(text, tags)} summary={reel.title} embed={partner.hasWebsite}
  image={{ format: "story", photo: reel.scenes[0].photo, focus: reel.scenes[0].focus,
    islandName: "Bohol", headline: reel.scenes[0].line, byline: `with ${partner.name}`,
    code, supportName: partner.offer.charity, qrValue: target }} />
```

Props: `open`, `onClose`, `code`, `caption` (required); `image?: PostImageSpec | (() => Promise<Blob>) | null`
(a function lets a flow draw its own artwork, e.g. a passport card), `fileName?`, `title = "Share your post"`,
`summary?`, `embed?: boolean | string`, `onAction?: (action: "native" | "image" | "caption" | "link" | "embed") => void`.

### Rendering a post to PNG (`render.ts`, client only)

- `renderPostImage(spec: PostImageSpec): Promise<Blob>`: 2D canvas, photo cropped to cover, kicker,
  island name, headline, byline and a white panel with the QR code, "SCAN TO SUPPORT", the charity
  and the short link. `format: "feed"` = 1080 x 1350, `"story"` = 1080 x 1920 (also right for a short
  video cover). `POST_IMAGE_SIZE` has the sizes.
- `PostImageSpec = { format, photo, focus?, islandName, headline, byline?, code, support?, supportName?, qrValue? }`.
- `drawQr(ctx, value, x, y, size, color?)`: the same soft QR on a canvas, for custom artwork.
- `downloadBlob(blobOrObjectUrl, fileName)`, `isInAppBrowser(userAgent?)`.

### Hooks and helpers

- `useCopy(resetMs?)` -> `{ copied, failed, copy(text) }`; `copyText(text)` (clipboard API with a textarea fallback).
- `useShareTarget(code)` -> what a QR code should encode (hydration-safe).
- `usePrefersReducedMotion()` -> boolean, false on the first render so it never causes a hydration
  mismatch. Use it instead of motion's `useReducedMotion` wherever markup depends on it.
- Icons (`icons.tsx`): `BrandMark`, `IconCopy`, `IconCheck`, `IconLink`, `IconShare`, `IconDownload`,
  `IconCode`, `IconText`, `IconClose`, `IconPlus`, `IconArrow`, `IconBack`, `IconPlay`, `IconPause`,
  `IconReplay`, `IconHeart`, `IconBubble`, `IconSend`, `IconKeep`, `IconDots`. All take `size` and SVG props.

## Design tokens and classes

Tokens (on `.sk`): ink `--sk-ink #12293a`, `--sk-ink-2`, `--sk-muted`; lines `--sk-line`, `--sk-line-2`;
sea `--sk-sea #0fb5ae`, `--sk-sea-deep #06706d`, `--sk-sea-ink`, `--sk-sea-soft`, `--sk-sea-glow`;
sky `--sk-sky`, `--sk-sky-soft`, `--sk-sky-deep`; sun `--sk-sun #ee8a5c`, `--sk-sun-deep`, `--sk-sun-soft`;
gold `--sk-gold`, `--sk-gold-soft`; surfaces `--sk-cream`, `--sk-sand`, `--sk-paper`;
type `--sk-f-serif` (Instrument Serif), `--sk-f-sans` (DM Sans), `--sk-f-mono`;
motion `--sk-ease`, `--sk-spring`; radii `--sk-r-s 10px`, `--sk-r-m 16px`, `--sk-r-l 24px`;
shadows `--sk-shadow-s|m|l`; focus ring `--sk-focus`; safe areas `--sk-safe-t`, `--sk-safe-b`.

Utility classes: `sk-eyebrow` (small caps, sea), `sk-title` (serif display, `<em>` turns sea italic),
`sk-h2` (serif), `sk-h3` (sans 16/650), `sk-lead`, `sk-note` (13px muted), `sk-hint`, `sk-field-label`,
`sk-card` (white, hairline, soft shadow), `sk-chip` (pill toggle; `aria-pressed="true"` or
`data-on="true"` = selected), `sk-btn` (via `SkButton`), `sk-sample`, `sk-code`, `sk-sr` (screen-reader only).

Use sea for partner accents and sun for traveler accents (the hub does this).

## Conventions

- Mobile first: design at 390 wide, then 1280. Tap targets 44px or more. Text never under 12px.
- Grids that hold kit components: use `grid-template-columns: minmax(0, 1fr)` (or `min-width: 0` on
  flex children) so long links are cut with an ellipsis instead of widening the page.
- Motion: `motion/react`, ease `[0.22, 1, 0.36, 1]`, short (0.2 to 0.6s). Respect reduced motion with
  `usePrefersReducedMotion()`; the stylesheet already neutralises CSS animations under `.sk`.
- Every link to a recipient page uses `sharePath(code)`; every printed link uses `shareDisplayUrl(code)`.
- Images: plain `<img>` with `photoSources(...)` (the demo does not use next/image).
- Server components can use `ShareShell`, `StepHeader`, `SkButton`, `Avatar`, `SampleTag`, `QrCode`,
  `PostPreview`; anything with state (`LinkField`, `CaptionEditor`, `IslandReel`, `ShareSheet`) is a
  client component and can still be rendered from a server page.
- Scratch scripts: `scripts/scratch/p3-kit-shot.mjs` (screenshots; `LIVE=1` uses localhost:3100) and
  `p3-kit-interact.mjs` (copy, sheet, end card, reduced motion with `REDUCED=1`).

## Known limits

- Reels exist for Bohol only (and are reused for its small islands). Photos are the eleven in
  `public/photos`.
- "Save the image" saves a still PNG, not an MP4: making video in the browser is unresolved
  (Technical_Questions.md section 2). The reel is an on-screen preview of the prepared video.
- `/embed/<code>` in the embed snippet is not a route in the demo; the snippet is shown as text only.
- The native share button appears only where `navigator.share` exists (not in most desktop browsers
  or Android in-app browsers), so on those the three manual steps are the whole path.
