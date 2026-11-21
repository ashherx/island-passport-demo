# Island Passport: motion prototype

A Next.js 15 demo for the Island Passport proposal: the passport, page flips, the stamping moment,
the Verified Supporter upgrade and the Provincial Stamp award, in three art directions and light/dark.

```bash
pnpm install
pnpm dev -p 3100        # http://localhost:3100
```

- `/` is the guided story: open the passport, collect a stamp, donate, the charity confirms, the award.
  Add `?debug` for a frame-rate read-out and the `window.__ipBook()` test handle.
- `/lab/stamp`, `/lab/pages`, `/lab/flip-lib`, `/lab/flip-custom`, `/lab/stamp-press`, `/lab/celebrations`
  and `/lab/sound` show each part by itself.
- All sample content is fictional: people, promoters, charities and coordinates. No donations are processed.
- All copy lives in `src/lib/strings.ts`; the art directions and their tokens in `src/lib/directions.ts`.
- Architecture and handoff notes, one file per area: `docs/agents/` (start with `integrator.md`, then `polish.md` for the latest state and the walkthrough script).
- Set `NEXT_PUBLIC_SITE_URL` where the demo is hosted, so the share card gets an absolute URL.
