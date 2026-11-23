import type { Metadata } from "next";
import { CoverLab } from "@/components/passport/cover-globe/lab/CoverLab";
import { strings } from "@/lib/strings";
import { DIRECTION_IDS, type DirectionId } from "@/lib/types";

/**
 * /lab/passport-cover: the cover globe on its own passport, for direct testing.
 *   ?direction=classic|reef|journal   art direction to show
 *   ?island=bohol|balicasag|...       start with the globe on this island
 *   ?tour=off                         start with the tour paused
 * Reference: docs/agents/p2-cover.md
 */
export const metadata: Metadata = { title: strings.coverGlobe.lab.title };

/** The lab opens on the light stage unless the visitor has picked a mode themselves. */
const lightDefaultScript = `(function(){try{var m=null;try{m=localStorage.getItem("ip.theme")}catch(x){}if(m!=="light"&&m!=="dark"){var e=document.documentElement;e.setAttribute("data-theme","light");e.style.colorScheme="light"}}catch(x){}})();`;

type Search = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PassportCoverLabPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const d = first(params.direction);
  const direction = DIRECTION_IDS.includes(d as DirectionId) ? (d as DirectionId) : undefined;
  return (
    <>
      <script id="ip-cover-lab-light" dangerouslySetInnerHTML={{ __html: lightDefaultScript }} />
      <CoverLab direction={direction} island={first(params.island)} tour={first(params.tour) !== "off"} />
    </>
  );
}
