"use client";

/**
 * Option A on its own, without the registry of options: /lab/option-a.
 * Useful for a clean recording and while the other options are unfinished. The layout switcher
 * is part of the landing itself. `?themes=1` (or the older `?switcher=1`) also shows the
 * A · B · C pill, to check the layout around it; it cannot change option here.
 */
import { Suspense } from "react";
import { OptionSwitcher, useThemesSwitcher } from "@/components/options-ui";
import { useOption } from "@/lib/options";
import LandingA from "./index";

export function OptionALab({ switcher = false }: { switcher?: boolean }) {
  const { option } = useOption();
  const themes = useThemesSwitcher();
  return (
    <>
      <div className="opt-stage" data-option-root={option}>
        {/* The landing reads ?layout= with useSearchParams, which wants a Suspense boundary above it. */}
        <Suspense fallback={null}>
          <LandingA />
        </Suspense>
      </div>
      {switcher || themes ? <OptionSwitcher /> : null}
    </>
  );
}
