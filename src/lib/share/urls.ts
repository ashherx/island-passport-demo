/**
 * Share links. One code carries who shared and which island: /s/<owner>-<island>, for example
 * /s/mia-bohol. The promoter's credit lives in the link itself (not in a cookie), so it survives
 * a hop from an in-app browser to Safari or Chrome.
 *
 * The domain is fictional. What is PRINTED is islandpassport.app/s/<code>; what a tap FOLLOWS
 * inside this demo is the route /s/<code> (src/app/s/[code]/page.tsx).
 */
import { getIsland } from "@/lib/islands/data";
import { SAMPLE_OWNERS, SAMPLE_PARTNERS, SAMPLE_TRAVELER } from "./sample";
import type { ShareOwner, ShareResolution } from "./types";

/** Fictional product domain, printed on links, QR labels and embed code. */
export const SHARE_DOMAIN = "islandpassport.app";

/** `mia-bohol`. Defaults to the owner's first island. */
export function shareCode(owner: ShareOwner, islandId: string = owner.islandIds[0]): string {
  return `${owner.code}-${islandId}`;
}

/** In-demo route for a code: use as the `href` of every link and button. */
export function sharePath(code: string): string {
  return `/s/${encodeURIComponent(code)}`;
}

/** `islandpassport.app/s/mia-bohol`: the short form to print on artwork and in link fields. */
export function shareDisplayUrl(code: string): string {
  return `${SHARE_DOMAIN}/s/${code}`;
}

/** `https://islandpassport.app/s/mia-bohol`: what "Copy link" puts on the clipboard. */
export function shareUrl(code: string): string {
  return `https://${shareDisplayUrl(code)}`;
}

/**
 * What a QR code should encode. On a deployed demo this is the real address of /s/<code>, so
 * scanning the screen with a phone opens the recipient page; on localhost (and on the server) it
 * is the fictional product URL. Call it in an effect or use `useShareTarget` from the kit.
 */
export function liveShareUrl(code: string, origin?: string): string {
  if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(origin)) return shareUrl(code);
  return `${origin}${sharePath(code)}`;
}

/** Snippet a partner pastes into their website. Display-only widget: one button, opens a full tab. */
export function embedSnippet(code: string, height = 420): string {
  return [
    `<iframe src="https://${SHARE_DOMAIN}/embed/${code}"`,
    `  title="Island Passport" loading="lazy"`,
    `  width="100%" height="${height}"`,
    `  style="border:0;border-radius:16px;max-width:420px"></iframe>`,
  ].join("\n");
}

/** `mia-bohol` -> who shared and which island. Accepts a bare owner code (`mia`) too. Null when unknown. */
export function resolveShareCode(raw: string | null | undefined): ShareResolution | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  if (!/^[a-z0-9]{1,24}(-[a-z0-9-]{1,40})?$/.test(code)) return null;
  const dash = code.indexOf("-");
  const ownerCode = dash === -1 ? code : code.slice(0, dash);
  const owner = SAMPLE_OWNERS.find((o) => o.code === ownerCode);
  if (!owner) return null;
  const wanted = dash === -1 ? owner.islandIds[0] : code.slice(dash + 1);
  const islandId = getIsland(wanted)?.status === "live" ? wanted : owner.islandIds[0];
  const canonical = shareCode(owner, islandId);
  return owner.kind === "partner"
    ? { kind: "partner", code: canonical, partner: owner, islandId }
    : { kind: "traveler", code: canonical, traveler: owner, islandId };
}

/** Codes the hub links to. */
export const SAMPLE_PARTNER_CODE = shareCode(SAMPLE_PARTNERS[0]);
export const SAMPLE_TRAVELER_CODE = shareCode(SAMPLE_TRAVELER);

/** Every valid owner-and-island code, for generateStaticParams or a link list. */
export function allShareCodes(): string[] {
  return SAMPLE_OWNERS.flatMap((owner) => owner.islandIds.map((islandId) => shareCode(owner, islandId)));
}
