import type { Metadata } from "next";
import { PartnerFlow } from "@/components/share/partner/PartnerFlow";

/**
 * /share/partner: the partner share flow. A partner signs in with a one-time code, lands on their
 * profile, chooses what to promote, personalises a prepared island video and shares it with their
 * own link and QR code, or places the widget on their website.
 *
 * Deep links (handy for a walkthrough): ?as=mia|islatrips|boholdive|coraltrust|visayas
 * &step=profile|choose|studio|share|plan &format=feed|story|short &tab=site
 * Notes: docs/agents/p3-partner.md
 */
export const metadata: Metadata = { title: "Partner share flow · Island Passport (sample)" };

type Query = Record<string, string | string[] | undefined>;

export default async function PartnerSharePage({ searchParams }: { searchParams?: Promise<Query> }) {
  const query = (await searchParams) ?? {};
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return <PartnerFlow initial={{ as: one(query.as), step: one(query.step), format: one(query.format), tab: one(query.tab) }} />;
}
