import type { Metadata } from "next";
import { GlobeCoreLab } from "@/components/globe/lab/GlobeCoreLab";
import { OptionStyles } from "@/components/options-ui/OptionStyles";
import { OptionProvider } from "@/lib/options";

/**
 * /lab/globe-core: the globe engine on its own, with a plain light style.
 * Buttons for flyToIsland (every island), resetView, tour and snapshot, toggles for the spin,
 * padding, labels and relief, a WebGL context-loss test, and a frame-rate read-out.
 * API reference: docs/agents/v2-foundation.md
 */
export const metadata: Metadata = { title: "Globe engine lab" };

export default function GlobeCoreLabPage() {
  return (
    <>
      <OptionStyles />
      <OptionProvider>
        <GlobeCoreLab />
      </OptionProvider>
    </>
  );
}
