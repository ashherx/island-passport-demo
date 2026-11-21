"use client";

/**
 * Option A on its own, without the A · B · C registry: /lab/option-a.
 * Useful for a clean recording (no switcher) and while the other options are unfinished.
 * `?switcher=1` shows the switcher, to check the layout around it.
 */
import { OptionSwitcher } from "@/components/options-ui";
import { useOption } from "@/lib/options";
import LandingA from "./index";

export function OptionALab({ switcher = false }: { switcher?: boolean }) {
  const { option } = useOption();
  return (
    <>
      <div className="opt-stage" data-option-root={option}>
        <LandingA />
      </div>
      {/* Only to check the layout around the demo's switcher; it cannot change option here. */}
      {switcher ? <OptionSwitcher /> : null}
    </>
  );
}
