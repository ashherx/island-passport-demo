# v2-research handoff

Deliverable: `/Users/muhammadashher/Desktop/Code/island-passport/Technical_Questions.md` (client-facing, for Dan; about 2,900 words including 23 dated sources). No app code touched.

## What it covers
1. Shared links inside Instagram / TikTok / Facebook in-app browsers
2. Sharing image / MP4 to Instagram Stories and TikTok from the web
3. Open Graph previews and caching
4. Partner widget via iframe
5. Donation confirmation by per-charity email address
6. Passwordless sign-in: code vs magic link
Plus five decisions needed from Dan.

## Findings that affect the demo build (for integrator / share-flow agents)
- No web API posts directly to Instagram Stories or TikTok. Share flows should show "Save, Copy caption, Open app" with the native share sheet as an optional shortcut. Do not mock a one-tap "Post to Instagram" as if it were real.
- `navigator.share` is likely undefined in Android in-app browsers: always feature-detect and keep a visible fallback.
- Download buttons for blob-generated images are unreliable in iOS in-app browsers: prefer a real `<img>` at an https URL the user can long-press, and keep the QR code and short link in the artwork.
- Recipient landing: the promoter/partner code must live in the URL path, not in cookies or referrer.
- Sign-in screens in the demo should lead with a 6-digit code; magic link is secondary.
- Widget/iframe demo: display-only card with one button opening the full site in a top-level tab.
- Donation copy: never imply automatic or instant confirmation; "pending until the charity confirms" stays accurate.

## Known gaps (stated in the doc as untested)
- Nothing was tested on real devices; all in-app browser behaviour is from desk research, mostly forum posts and vendor blogs.
- No reliable source found for: TikTok in-app browser download/share behaviour, link previews in Instagram/TikTok DMs, whether Meta flags new domains, GCash/PayPal/GlobalGiving BCC options, Postmark inbound exposing a DMARC verdict.
- Legal points (PH Data Privacy Act, GDPR) are from summaries, not full texts; needs a lawyer.
- Length is slightly over the 4-page target because of the source list.
