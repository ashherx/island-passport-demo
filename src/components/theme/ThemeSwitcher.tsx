"use client";

/**
 * Compact appearance control: three art-direction chips and a light/dark toggle.
 *
 *   <ThemeSwitcher />                    chips with names + toggle
 *   <ThemeSwitcher variant="compact" />  swatches only, for tight headers
 *
 * Keyboard: Tab reaches the selected chip, arrow keys move between directions (radio group),
 * Tab again reaches the mode toggle, Enter/Space activates.
 */
import { useId, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { DIRECTION_LIST } from "@/lib/directions";
import { strings } from "@/lib/strings";
import type { DirectionId } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

export interface ThemeSwitcherProps {
  variant?: "full" | "compact";
  /** Hide the light/dark toggle (e.g. when it lives elsewhere). */
  hideMode?: boolean;
  className?: string;
}

export function ThemeSwitcher({ variant = "full", hideMode = false, className }: ThemeSwitcherProps) {
  const { direction, setDirection } = useTheme();
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, DIRECTION_LIST.findIndex((d) => d.id === direction));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const count = DIRECTION_LIST.length;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % count;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation(); // arrow keys also flip passport pages: keep them inside the control
    setDirection(DIRECTION_LIST[next].id);
    chips.current[next]?.focus();
  };

  return (
    <div
      className={["ip-switcher", `ip-switcher--${variant}`, className].filter(Boolean).join(" ")}
      aria-label={strings.theme.switcherLabel}
      role="group"
    >
      <div
        className="ip-switcher__track"
        role="radiogroup"
        aria-label={strings.theme.directionLabel}
        onKeyDown={onKeyDown}
        style={{ "--ip-switch-index": index, "--ip-switch-count": DIRECTION_LIST.length } as CSSProperties}
      >
        <span className="ip-switcher__thumb" aria-hidden="true" />
        {DIRECTION_LIST.map((d, i) => {
          const selected = d.id === direction;
          const copy = strings.theme.directions[d.id as DirectionId];
          return (
            <button
              key={d.id}
              ref={(el) => {
                chips.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={variant === "compact" ? `${copy.name}: ${copy.hint}` : undefined}
              title={copy.hint}
              tabIndex={selected ? 0 : -1}
              className="ip-switcher__chip"
              data-selected={selected ? "" : undefined}
              onClick={() => setDirection(d.id)}
            >
              <span
                className="ip-switcher__swatch"
                aria-hidden="true"
                style={
                  {
                    "--sw-cover": d.cover.base,
                    "--sw-deep": d.cover.deep,
                    "--sw-foil": d.cover.material === "kraft" ? d.cover.ink : d.foil.base,
                  } as CSSProperties
                }
              />
              {variant === "full" && <span className="ip-switcher__name">{copy.name}</span>}
            </button>
          );
        })}
      </div>
      {!hideMode && <ModeToggle />}
    </div>
  );
}

export function ModeToggle({ className }: { className?: string }) {
  const { mode, toggleMode } = useTheme();
  const dark = mode === "dark";
  const maskId = `ipm${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <button
      type="button"
      className={["ip-mode", className].filter(Boolean).join(" ")}
      role="switch"
      aria-checked={dark}
      aria-label={strings.theme.modeLabel}
      title={dark ? strings.theme.toLight : strings.theme.toDark}
      data-mode={mode}
      onClick={toggleMode}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="ip-mode__icon">
        <mask id={maskId}>
          <rect width="24" height="24" fill="#fff" />
          <circle className="ip-mode__cut" cx="24" cy="2" r="7" fill="#000" />
        </mask>
        <circle className="ip-mode__disc" cx="12" cy="12" r="5" fill="currentColor" mask={`url(#${maskId})`} />
        <g className="ip-mode__rays" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 2.2v2.2M12 19.6v2.2M2.2 12h2.2M19.6 12h2.2M5.07 5.07l1.56 1.56M17.37 17.37l1.56 1.56M5.07 18.93l1.56-1.56M17.37 6.63l1.56-1.56" />
        </g>
      </svg>
    </button>
  );
}
