import type { Metadata } from "next";
import { KitGallery } from "./KitGallery";

/** /share/kit: every share-kit component on one page, wired to the sample data. A living reference. */
export const metadata: Metadata = { title: "Share kit · Island Passport (sample)" };

export default function ShareKitPage() {
  return <KitGallery />;
}
