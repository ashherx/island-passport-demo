/**
 * The layouts of option A's landing, one module each. Ids, order and the default are in
 * src/lib/options/layouts.ts; which one is on screen is in ./state.ts.
 */
import type { LayoutId } from "@/lib/options";
import { fullbleedLayout } from "./fullbleed";
import { horizonLayout } from "./horizon";
import { orbLayout } from "./orb";
import { splitLayout } from "./split";
import type { LayoutModule } from "./types";

export const LAYOUTS: Record<LayoutId, LayoutModule> = {
  split: splitLayout,
  horizon: horizonLayout,
  orb: orbLayout,
  fullbleed: fullbleedLayout,
};

export { useLayout } from "./state";
export type { FlightView, HomeFrame, LayoutEnv, LayoutModule, TopProps } from "./types";
