# Part 3: partner share flow (key: partner)

The flow Dan described: a partner arrives at their profile, chooses what to promote, gets a
ready-made post (caption, hashtags, image or video, island-specific link, QR code), previews it,
shares it, and comes back to do it again six times a year. Or puts it on their website in an iframe.

- Route: `/share/partner` (`src/app/share/partner/page.tsx`, server; reads the query string)
- Website widget: `/embed/[code]` (`src/app/embed/[code]/page.tsx`, `embed.css`)
- Everything else: `src/components/share/partner/**`
- Built on the share kit (`docs/agents/p3-kit.md`). No kit or `src/lib/share` files were changed.

## Screens

| Step | File | What it shows |
|---|---|---|
| Sign in (gate) | `SignIn.tsx` | "Welcome back", the five sample partner types, one button: "Email me a one-time code". The demo then plays the round trip: an email notification drops in (code plus "or tap the sign-in link"), the six digits type themselves, the profile opens. No password field anywhere. |
| 1 Profile | `Profile.tsx` | Identity card, four figures (scans and link visits, travelers who gave, donations generated, stamps issued with the pending count), the seals the partner is earning against example thresholds, six-a-year progress, the default link. |
| 2 Choose | `Choose.tsx` | Island (the partner's own list), lead with the stamp or the charity, starting format. The island-specific link updates as the island changes. |
| 3 Personalise | `Studio.tsx` | The content studio. Three phones (feed post, story, short video) in a row that wraps round; the middle one plays. Tools: footage (six videos or a photo), your touch (name on or off, short line with suggestions), caption (tones, text, hashtags). "See the QR end card" jumps the video to its end card. |
| 4 Share | `ShareStep.tsx` | "Post it": kit `ShareSheet`, save image, copy caption, `LinkField`, QR code with "Save QR code", caption block. "On your website": a sample browser window with the real `/embed/<code>` in an iframe, the embed code and a copy button. |
| 5 Six a year | `YearPlan.tsx` | Segmented ring, a 12-month strip, six cards (one per prepared video) with a postmark on the posted ones. A post logged in this session is stamped in with a spring. |

`PartnerFlow.tsx` owns all state, the step transitions and the floating dock (back, primary action).
`post.tsx` holds the draft and everything derived from it; `parts.tsx` holds small pieces (count-up,
segmented control, seal medallion, the still photo post, icons); `data.ts` holds the sample data that
only this flow needs.

## Deep links

`/share/partner?as=<code>&step=<step>&format=<format>&tab=site`

- `as`: `mia` (creator), `islatrips` (travel agency), `boholdive` (establishment), `coraltrust` (charity), `visayas` (tourism board)
- `step`: `profile`, `choose`, `studio`, `share`, `plan`. Any `step` skips the sign-in gate.
- `format`: `feed`, `story`, `short` (the starting format)
- `tab=site`: with `step=share`, opens "On your website"

The address is kept in step with the flow (`history.replaceState`), so any screen can be reloaded
or linked to. Without a `step` the flow starts at the sign-in gate.

## How the product rules show up

- **No passwords.** One-time code first, sign-in link in the same email as a backup
  (`Technical_Questions.md` section 6, option B). The profile says "Signed in with a one-time code".
- **Donations stay with the charity.** "Donations generated" reads "given on Coral Trust's own page";
  the profile, the choose step and the widget print `shareCopy.noDonations`. "Stamps issued" carries
  an "N pending confirmation" pill, and a line explains that a stamp is issued once the charity's
  confirmation arrives.
- **Any partner type.** The switcher is on the gate and on the profile. Each type has its own offer,
  captions, hashtags, short-line suggestions and figures.
- **Thresholds are examples.** Every figure has an EXAMPLE chip and `shareCopy.exampleThreshold`
  next to it. The partner seal tiers ($500, $2,500, $5,000 of donations generated) are placeholders
  invented for the demo: the brief gives no figures for partner seals. They live in
  `PARTNER_SEAL_TIERS` (`data.ts`).
- **No platform chrome.** Formats are "Feed post", "Story", "Short video", drawn with the kit's
  neutral `PostPreview`.
- **Honest sharing** (`Technical_Questions.md` section 2): "A website cannot post into a story or a
  short video for you"; the sheet is share sheet when available, else save, copy, post. Saved files
  are still PNGs, and the share step says that delivering the six videos as files is an open question.
- **Credit in the link** (section 1): the code `mia-bohol` is in the address, and the copy says why.
- **Display-only widget** (section 4): one button, opens `/s/<code>` in a new tab, nothing depends on
  cookies, and "still to test: some website builders restrict embedded frames".

## The post

`Draft` (`post.tsx`): `{ islandId, lead: "stamp" | "charity", format, footage: { kind: "reel", id } |
{ kind: "photo", name }, showName, name, message, caption, tags }`.

- `newDraft(partner, reelId?)`, `retarget(partner, draft, { islandId?, lead? })` (keeps a caption the
  partner rewrote by hand; otherwise swaps in the matching suggestion; another island brings its
  featured video), `buildPost(partner, draft)` and `imageSpec(post, format, qrValue)`.
- **Lead with** changes the wording, not the destination: the end card title ("Collect the *Sea
  turtle* stamp" or "Help *Coral Trust* protect Bohol"), the line with the QR code, the default
  caption tone and the QR card label. The link is the same either way, so `/s/<code>` always matches.
- `<PostMedia post format live />` fills a `PostPreview`. A video is the kit's `IslandReel`. A photo is
  `<PhotoPost>` in feed and story (a still has no end card, so it carries a QR sticker) and a
  one-scene reel with a slow zoom and the end card as a short video.
- The six prepared videos are `BOHOL_REELS`. Photos per island are `ISLAND_PHOTOS` in `data.ts`.

## Six a year

`postingYear(partner, logged)` (`data.ts`) lays out the partner's posting year: six slots two months
apart, one prepared video each, in video order 1 to 6. The first `stats.postsThisYear` are posted and
the year is positioned so the next one falls in the demo's current month (`DEMO_SCRIPT.today`,
16 Feb 2027). "I posted it" on the share step logs a post for this session only (nothing is stored)
and the plan step postmarks it. The studio's footage row shows "Posted" ticks and "Next" from the
same data, and "Make post N" starts the next draft with that video picked.

## The widget

`/embed/<code>` resolves the code with `resolveShareCode`, and draws the island photo, the stamp, who
is sharing, a QR code and one button (`target="_blank"` to `/s/<code>`). It fills its frame: stacked
up to 560px wide, side by side beyond; the QR code hides under 330px. Designed for 440px height
(`EMBED_HEIGHT`), which is what the printed snippet uses (`embedSnippet(code, 440)`). The preview's
iframe points at the real route; the printed snippet uses the fictional `islandpassport.app` domain.
An unknown or traveler code shows a small "not one of the samples" card.

## Motion

- Step changes slide and fade in the direction of travel (`AnimatePresence`, 0.42s), then each block
  rises in with a short stagger (`.pf-rise`, CSS).
- Sign-in: notification spring, digits pop in one by one, tick.
- Profile: numbers count up, the seal rail fills, earned seals spin in.
- Studio: the three phones slide with a slight overshoot; the one that wraps round the back fades
  out and in instead of sweeping across. Swipe on a phone to change format; tap a side phone to pick it.
- Six a year: ring arcs draw in order, the new post's arc is drawn in the sun colour and its postmark
  lands with a spring.
- Reduced motion: everything becomes a short fade or is instant; videos do not autoplay (kit behaviour).

## Checked

- `tsc` and `eslint` clean for `src/components/share/partner`, `src/app/share/partner`, `src/app/embed`.
- Dev server at 390x844 (mobile, touch, DPR 2), 360, 768, 1024, 1280x800 and 1440: no horizontal
  overflow, no console errors or hydration warnings.
- `scripts/scratch/p3-partner-interact.mjs`: touch swipe changes format without pausing the video,
  side phone tap, name toggle, copy caption, save image (1080x1350 PNG), save QR (900x1120 PNG),
  the iframe shows the live widget with the right link, copy embed code, link routes to `/s/<code>`,
  logging a post moves the count, "Make post N" opens the studio with that video.
- `p3-partner-walk.mjs [m|d]` walks the whole flow with screenshots (`REDUCED=1` for reduced motion);
  `p3-partner-shot.mjs` takes full-page shots per step; `p3-partner-embed.mjs` shoots the widget at
  260, 320, 420 and 720 wide. Output: `scripts/scratch/p3-partner-out/`.

## Known limits

- Sign-in is a scripted animation. No email is sent and the code is fixed.
- Logging a post lives in memory: a reload returns to the sample counts.
- "Save image" is a still PNG cover, not an MP4 (same as the kit; an open technical question).
- The six videos exist for Bohol only. The small islands reuse the set with their own best match
  first, so a few scenes on a Panglao post come from elsewhere in Bohol.
- On a short video's end card the mockup's own side rail sits over the right end of the link pill
  (kit layout; the QR code itself is clear).
- The partner seal tiers and all figures are invented for the demo.
- The embed preview needs the dev server to compile `/embed/[code]` on first view, so the frame can
  take a second to fill the first time.
- The dock floats over the page bottom; pages add bottom padding so the last block can always be
  scrolled clear of it.
