"use client";

/**
 * Renders the landing of the current design option, plus the A · B · C switcher.
 *
 * Each landing is its own chunk (see src/options/index.ts), so a visitor only downloads the
 * option they are looking at. The stage marks which option it has rendered; if the boot script
 * found a different one in localStorage, CSS keeps this first render invisible for the instant
 * it takes React to swap, so there is no flash of the wrong design.
 */
import type { ComponentType } from "react";
import { useOption, type OptionId } from "@/lib/options";
import { OptionSwitcher } from "./OptionSwitcher";
import "./options-ui.css";

export interface OptionStageProps {
  /** The registry from src/options/index.ts. */
  landings: Record<OptionId, ComponentType>;
  /** Hide the switcher (a clean recording). Default false. */
  hideSwitcher?: boolean;
}

export function OptionStage({ landings, hideSwitcher = false }: OptionStageProps) {
  const { option } = useOption();
  const Landing = landings[option];
  return (
    <>
      <div className="opt-stage" data-option-root={option}>
        <Landing key={option} />
      </div>
      {hideSwitcher ? null : <OptionSwitcher />}
    </>
  );
}

/** Shown while an option's chunk is on its way: the option's background, nothing else. */
export function OptionLoading() {
  return <div className="opt-loading" aria-hidden="true" />;
}
