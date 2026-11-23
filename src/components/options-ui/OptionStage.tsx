"use client";

/**
 * Renders the landing of the current design option. The A · B · C switcher is no longer part of
 * what is presented (the choice on show is the landing's layout, which option A switches itself):
 * it only appears with `?themes=1` in the URL.
 *
 * Each landing is its own chunk (see src/options/index.ts), so a visitor only downloads the
 * option they are looking at. The stage marks which option it has rendered; if the boot script
 * found a different one in localStorage, CSS keeps this first render invisible for the instant
 * it takes React to swap, so there is no flash of the wrong design.
 */
import { useEffect, useState, type ComponentType } from "react";
import { THEMES_QUERY, useOption, type OptionId } from "@/lib/options";
import { OptionSwitcher } from "./OptionSwitcher";
import "./options-ui.css";

export interface OptionStageProps {
  /** The registry from src/options/index.ts. */
  landings: Record<OptionId, ComponentType>;
  /** Never show the switcher, whatever the URL says (a clean recording). Default false. */
  hideSwitcher?: boolean;
}

/** True when the URL asks for the design-option switcher (`?themes=1`). Read after hydration. */
export function useThemesSwitcher(): boolean {
  const [themes, setThemes] = useState(false);
  useEffect(() => {
    setThemes(new URLSearchParams(window.location.search).get(THEMES_QUERY) === "1");
  }, []);
  return themes;
}

export function OptionStage({ landings, hideSwitcher = false }: OptionStageProps) {
  const { option } = useOption();
  const themes = useThemesSwitcher();
  const Landing = landings[option];
  return (
    <>
      <div className="opt-stage" data-option-root={option}>
        <Landing key={option} />
      </div>
      {themes && !hideSwitcher ? <OptionSwitcher /> : null}
    </>
  );
}

/** Shown while an option's chunk is on its way: the option's background, nothing else. */
export function OptionLoading() {
  return <div className="opt-loading" aria-hidden="true" />;
}
