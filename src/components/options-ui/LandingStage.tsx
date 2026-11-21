"use client";

/**
 * The home page's client root: the current option's landing from the registry, and the switcher.
 * Kept out of the barrel on purpose: the registry imports from this folder, and the landings
 * import the barrel.
 */
import { OPTION_LANDINGS } from "@/options";
import { OptionStage } from "./OptionStage";

export function LandingStage() {
  return <OptionStage landings={OPTION_LANDINGS} />;
}
