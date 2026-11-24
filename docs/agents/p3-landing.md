# Part 3 recipient landing (key: landing)

What someone sees after following a shared link, plus the link's preview card.
Built on the share kit (`docs/agents/p3-kit.md`); fictional sample content throughout.

- Route: `src/app/s/[code]/page.tsx` (server), preview image `src/app/s/[code]/opengraph-image.tsx`
- Components: `src/components/share/landing/**` (styles `landing.css`, prefixes `lp-` and `lpv-`)
- JPEG photo renditions for the preview image: `public/og/*.jpg`, made by `scripts/og-photos.py`

## URLs

| URL | What it shows |
|---|---|
| `/s/alex-pamilacan` | A traveler's link: "Alex supports Pamilacan", Alex's stamp and passport glimpse |
| `/s/mia-bohol`, `/s/boholdive-panglao`, `/s/islatrips-bohol`, `/s/coraltrust-balicasag` | Partner-branded pages ("Bohol Dive Co. recommends Panglao"), with the partner's stamp offer |
| `/s/visayas-bohol` | A tourism board offering a seal ("Welcome to Bohol", example amount $50) |
| `/s/nobody-banacon`, `/s/anything` | Unknown code: the island's own page, nobody credited. The island comes from the end of the code, else Bohol |
| `?inapp=instagram` / `tiktok` / `facebook` | Forces the in-app browser helper and draws a neutral mock browser bar marked "simulated" |
| `?preview=1` | "How this link looks when shared": the real preview card in three neutral frames |
| `/s/<code>/opengraph-image` | The 1200 x 630 PNG itself |

Codes are case-insensitive; a bare owner code (`/s/mia`) and an owner with an unknown island both
resolve to the owner's first island. Every code returns 200.

## What is on the page

1. **Hero** (in the first HTML): island photo, who shared (avatar chip with SAMPLE tag), the stamp
   on a slip of passport paper, headline, one line on what Island Passport is, the primary button
   ("Collect a Pamilacan stamp" / "Earn the Tourism Board Seal"), "Email code, no password" and
   "You give on the charity's own page", and the attribution line.
2. **The stamp you can collect**: stamp, charity (SAMPLE), what the gift pays for, the threshold
   marked "Example amount", and the three example thresholds as a legend.
3. **How it works**: give on the charity's own page -> the charity confirms (pending, shown
   honestly) -> stamp issued. Each step shows the real stamp at that status. Then "No password, ever".
4. **Traveler links:** the sharer's passport strip (their other stamps). **Partner links:** the
   partner card (type, handle, blurb, one sample figure).
5. **About the island**: headline, a paragraph, photos, facts, "Explore the globe" (`/?island=<id>`).
6. **Demo controls** (dashed box, marked as not part of the product): other sample links, "view as
   if opened inside" each app, the link preview, all share flows, start again.
7. A **sticky button** on phones once the hero button has scrolled away.

Accent follows the kit: sun for a traveler's link, sea for partners and the island page.

## The collect flow (`CollectFlow.tsx`)

A bottom sheet on phones, a dialog from 640px. Everything is simulated: nothing is sent, no page
opens, no money moves.

`email` -> `code` (or `confirm`) -> `welcome` -> `give` -> `pending` -> `verified`

- **email**: one field. "No password. We email a one-time code, with a sign-in link as a backup."
- **code**: six cells over one real input (`inputmode="numeric"`, `autocomplete="one-time-code"`,
  paste works). A sample email slides in with the code **482916**; "Use this code" types it in.
  A wrong code shakes and clears. Resend countdown.
- **confirm**: the magic-link path ("Tap the link instead"). It lands on a "Confirm sign-in"
  button, and says that a link tapped in an email opens the phone's default browser, not the tab
  the person started in.
- **welcome**: the stamp is pressed into the passport as a discovery stamp; "Credited to <sharer>".
- **give**: hand-off to the charity. States that Island Passport never collects donations, the
  example amount, what it pays for, and "give with this email" so the confirmation can be matched.
- **pending**: the stamp in its pending look, a three-row track, and a button marked DEMO that
  simulates the charity's confirmation.
- **verified**: the Verified Supporter stamp, links to `/passport`, `/share/traveler` and the globe.

The step and the email are kept in `localStorage` (`ip.share.collect.v1`, per code), so a reload
or a trip to the mail app reopens where the person left off. The hero button and the offer card
follow the saved step ("Enter your code", "Give to Coral Trust", "Check your stamp", "View your stamp").

## In-app browsers (`inapp.ts`, `InAppHelper.tsx`)

- Detected on the server from the user agent, so the helper is in the first paint:
  Instagram (`Instagram`), TikTok (`TikTok`, `musical_ly`, `BytedanceWebview`, `trill`),
  Facebook and Messenger (`FBAN`, `FBAV`, `FB_IAB`, `FBIOS`, `FB4A`, `Messenger`).
- The helper is a small card above the page. It never blocks. It says the page works where it is,
  offers "How to open in Safari/Chrome" (menu steps per app, "wording varies by app version"),
  "Copy link", three reasons (sign-in links, saving and the wallet pass, storage that lasts), and
  that staying is fine because the 6-digit code signs in within the same tab.
- Dismissing it is remembered for the session (`sessionStorage`).
- Inside the sheet, the email, code and confirm steps add a line for in-app visitors.
- This follows option C in `Technical_Questions.md` section 1. Nothing here has been tested on
  real devices, there is no automatic "escape" attempt, and the copy does not claim otherwise.

## Attribution (`Attribution.tsx`)

"Visit credited to Alex Rivera" under the hero button; tap it for the explanation. The code is in
the link, which is what the product would record on the server. The demo stores
`ip.share.ref.v1` in `localStorage` (code, name, first seen, last seen, visits) and a cookie
`ip_ref=<code>` for 30 days, and the note says so. Unknown codes show "Nobody is credited".

## Link preview

- `generateMetadata` sets title, description, Open Graph and Twitter fields per code. `og:url` is
  the demo's own `/s/<code>` address, not the fictional product domain.
- `opengraph-image.tsx`: photo on the left, who shared / island / stamp / charity on the right, a
  paper slip with the stamp artwork across the seam, SAMPLE tag, the short link. It never shows a
  stamp's status (previews are cached by chat apps; see `Technical_Questions.md` section 3).
- Fonts are fetched from Google Fonts, subset to the letters used; a failure falls back to the
  built-in face.
- The renderer cannot decode WebP, so it reads `public/og/<photo>.jpg`. After changing photos run
  `python3 -I scripts/og-photos.py assets-raw/photos public/og`.
- `?preview=1` (`LinkPreview.tsx`) shows the picture and the card in a chat thread, a feed post
  and a text message. The frames are neutral: no platform logo, icon or chrome.

## Files

| File | Role |
|---|---|
| `model.ts` | `buildLanding(code)` -> `LandingModel`: one plain object for the page, the sheet, the preview and the image |
| `text.ts` | `possessive`, `withCharity`, `SAMPLE_LANDING_CODES` (safe to import from client components) |
| `Landing.tsx` | The page (server component) |
| `CollectFlow.tsx` | `CollectProvider`, `CollectButton`, `CollectStatusLine`, `ProgressStamp`, `LandingStamp`, `StickyCta`, the sheet |
| `InAppHelper.tsx`, `inapp.ts` | Helper and detection |
| `Attribution.tsx` | Credit line and demo storage |
| `DemoControls.tsx` | Presenter controls |
| `LinkPreview.tsx` | `?preview=1` |
| `icons.tsx` | Extra line icons |

## Checked

390x844 (mobile, touch, DPR 2) and 1280x800 on the dev server: no horizontal overflow, no console
errors from these files, `tsc` and `eslint` clean. Also: real Instagram (iPhone) and TikTok
(Android) user agents, reduced motion, a saved dark theme from the passport demo (the page stays
light), odd codes. Scratch scripts: `scripts/scratch/p3-landing-*.mjs`, output in
`scripts/scratch/p3-landing-out/`.

## Known limits

- The tourism board seal is drawn with the passport's existing seal artwork, whose ring reads
  "Provincial Stamp". It needs its own artwork.
- A seal looks the same at every status, so an unissued one is drawn faded in "How it works".
- Partner offers are drawn with the island named in the link (`mia-bohol` shows a Bohol stamp
  with the sea turtle), not the island of the offer's passport slot.
- The preview image's alt text is one generic sentence for every code.
- The preview image reads files from `public/` on disk and falls back to fetching them from the
  site. Not tried on a serverless host.
- `og:image` is an absolute URL built from `NEXT_PUBLIC_SITE_URL` (see `src/app/layout.tsx`); set
  it where the demo is hosted or previews will point at localhost.

## Kit changes

None. Added outside my folders: `public/og/*.jpg` and `scripts/og-photos.py`.
