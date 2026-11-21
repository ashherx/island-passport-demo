import type { Metadata } from "next";
import { LandingStage } from "@/components/options-ui/LandingStage";
import { OptionStyles } from "@/components/options-ui/OptionStyles";
import { OptionProvider, isOptionId, optionStrings } from "@/lib/options";
import { strings } from "@/lib/strings";

/**
 * Home: the globe landing, in the design option the visitor is looking at (A, B or C).
 *
 * `?option=b` picks the option and `?island=panglao` opens an island, so every state is a link
 * that can be shared. With no query the saved choice applies (localStorage), then option A.
 * The option is read here so the first HTML is already the right design; the landing itself is a
 * separate chunk per option, and MapLibre loads after first paint (UX-7).
 *
 * The passport demo that used to live here is at /passport.
 */
export const metadata: Metadata = {
  title: optionStrings.meta.title,
  description: optionStrings.meta.description,
  // Next replaces these objects whole, so the fields the root layout sets are repeated here.
  openGraph: { type: "website", siteName: strings.app.name, title: optionStrings.meta.title, description: optionStrings.meta.description },
  twitter: { card: "summary_large_image", title: optionStrings.meta.title, description: optionStrings.meta.description },
};

type Query = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const option = isOptionId(query.option) ? query.option : null;
  const island = typeof query.island === "string" && /^[a-z0-9-]{1,40}$/.test(query.island) ? query.island : null;
  return (
    <>
      <OptionStyles />
      <OptionProvider initialOption={option} initialIsland={island}>
        <LandingStage />
      </OptionProvider>
    </>
  );
}
