import type { Metadata } from "next";
import { Artboard } from "@/components/share/traveler/Artboard";

/** /share/traveler/artboard: every generated post on one page (reference, not part of the flow). */
export const metadata: Metadata = { title: "Traveler artboard · Island Passport (sample)" };

export default function TravelerArtboardPage() {
  return <Artboard />;
}
