import type { Metadata } from "next";
import { TravelerFlow } from "@/components/share/traveler/TravelerFlow";
import { isDirection, isFormat, isStatus, isSubject, isTravelerStep } from "@/components/share/traveler/data";

/**
 * /share/traveler: the traveler share flow. After collecting a stamp, the traveler shares it (or
 * the island page, or the whole passport) as a generated post with their own link and QR code.
 *
 * Every screen can be opened directly:
 *   ?step=stamped|choose|design|share  &share=stamp|island|passport  &format=story|feed|film
 *   &style=classic|reef|journal  &status=discovery|pending|verified  &island=<id>  &from=passport
 *
 * Notes: docs/agents/p3-traveler.md
 */
export const metadata: Metadata = { title: "Share your stamp · Island Passport (sample)" };

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function TravelerSharePage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const step = one(query.step);
  const subject = one(query.share);
  const format = one(query.format);
  const direction = one(query.style);
  const status = one(query.status);
  return (
    <TravelerFlow
      initial={{
        step: isTravelerStep(step) ? step : undefined,
        subject: isSubject(subject) ? subject : undefined,
        format: isFormat(format) ? format : undefined,
        direction: isDirection(direction) ? direction : undefined,
        status: isStatus(status) ? status : undefined,
        islandId: one(query.island),
        fromPassport: one(query.from) === "passport",
      }}
    />
  );
}
