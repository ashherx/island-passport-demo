import type { Metadata } from "next";
import { OptionStyles } from "@/components/options-ui/OptionStyles";
import { OptionProvider } from "@/lib/options";
import { OptionALab } from "@/options/a/Lab";

/**
 * /lab/option-a: option A ("Daylight Atlas") mounted directly, without the A · B · C switcher.
 * `?island=bohol` opens an island, as on the home page. Notes: docs/agents/v2-option-a.md
 */
export const metadata: Metadata = { title: "Option A: Daylight Atlas" };

type Query = Record<string, string | string[] | undefined>;

export default async function OptionALabPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const island = typeof query.island === "string" && /^[a-z0-9-]{1,40}$/.test(query.island) ? query.island : null;
  return (
    <>
      <OptionStyles />
      {/* Development only: keep Next's error overlay off this route. An unfinished folder of
          another option (a build error on "/") would otherwise cover this page too, although
          nothing here depends on it. Errors still reach the terminal and the browser console. */}
      {process.env.NODE_ENV === "development" ? <style dangerouslySetInnerHTML={{ __html: "nextjs-portal{display:none!important}" }} /> : null}
      <OptionProvider initialOption="a" initialIsland={island}>
        <OptionALab switcher={query.switcher === "1"} />
      </OptionProvider>
    </>
  );
}
