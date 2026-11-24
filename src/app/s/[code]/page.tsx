import type { Metadata } from "next";
import { headers } from "next/headers";
import { Landing } from "@/components/share/landing/Landing";
import { LinkPreview } from "@/components/share/landing/LinkPreview";
import { detectInApp } from "@/components/share/landing/inapp";
import { buildLanding } from "@/components/share/landing/model";
import { sharePath } from "@/lib/share";
import { strings } from "@/lib/strings";

/**
 * /s/[code]: what a recipient sees after following a shared link.
 *
 *   /s/alex-pamilacan             a traveler's link ("Alex supports Pamilacan")
 *   /s/boholdive-panglao          a partner's link (partner-branded, with their stamp offer)
 *   /s/anything-else              unknown code: the island's own page, nobody credited
 *   ?inapp=instagram|tiktok|facebook   force the in-app browser helper (it is otherwise detected
 *                                      from the user agent)
 *   ?preview=1                    how the link's preview card looks in chat and social apps
 *
 * The preview image is ./opengraph-image.tsx. Notes: docs/agents/p3-landing.md
 */
type Params = Promise<{ code: string }>;
type Query = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const model = buildLanding(code);
  const { title, description } = model.meta;
  return {
    title,
    description,
    // Next replaces these objects whole, so the fields the root layout sets are repeated here.
    // The image comes from ./opengraph-image.tsx, with its size and alt text declared.
    openGraph: { type: "website", siteName: strings.app.name, title, description, url: sharePath(model.code) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedLinkPage({ params, searchParams }: { params: Params; searchParams: Query }) {
  const [{ code }, query, headerList] = await Promise.all([params, searchParams, headers()]);
  const model = buildLanding(code);

  if (one(query.preview)) return <LinkPreview model={model} />;

  const inApp = detectInApp(headerList.get("user-agent") ?? "", one(query.inapp));
  return <Landing model={model} inApp={inApp} />;
}
