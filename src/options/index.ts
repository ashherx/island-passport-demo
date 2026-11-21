"use client";

/**
 * Registry of the three design options for the globe landing.
 *
 * Each entry loads `src/options/<id>/index.tsx` on demand, so a visitor downloads only the option
 * on screen. That file's default export is the option's full-screen Landing: a component that
 * takes no props and builds on the shared pieces (see docs/agents/v2-foundation.md).
 *
 * Option designers own their folder (a, b or c) and leave this file alone.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { OptionLoading } from "@/components/options-ui/OptionStage";
import type { OptionId } from "@/lib/options";

export const OPTION_LANDINGS: Record<OptionId, ComponentType> = {
  a: dynamic(() => import("./a"), { loading: OptionLoading }),
  b: dynamic(() => import("./b"), { loading: OptionLoading }),
  c: dynamic(() => import("./c"), { loading: OptionLoading }),
};
