"use client";

/**
 * The floating "A · B · C" pill for presenting the three design options.
 *
 * Bottom-left on a phone (above the home indicator), top-right on a desktop. It is a radio group:
 * arrow keys move between options, and the number keys 1, 2, 3 switch from anywhere on the page
 * unless the visitor is typing. Switching replaces the URL query, so the address bar is always a
 * link to the option on screen.
 *
 * To move it clear of an option's own UI, set --opt-switch-lift (extra distance from the bottom
 * on phones) or --opt-switch-top / --opt-switch-right (desktop) on any ancestor, e.g. <html>.
 */
import { useEffect, useRef, type KeyboardEvent } from "react";
import { OPTION_IDS, optionStrings, useOption, type OptionId } from "@/lib/options";
import { t } from "@/lib/strings";
import "./options-ui.css";

export interface OptionSwitcherProps {
  className?: string;
  /** Number keys 1, 2, 3 switch option. Default true. */
  shortcuts?: boolean;
}

export function OptionSwitcher({ className, shortcuts = true }: OptionSwitcherProps) {
  const { option, setOption, ready } = useOption();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const index = ["1", "2", "3"].indexOf(e.key);
      if (index >= 0) setOption(OPTION_IDS[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts, setOption]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = OPTION_IDS.indexOf(option);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % OPTION_IDS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + OPTION_IDS.length) % OPTION_IDS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = OPTION_IDS.length - 1;
    if (next < 0) return;
    // Keep arrow keys away from the globe, which pans with them.
    e.preventDefault();
    e.stopPropagation();
    setOption(OPTION_IDS[next]);
    buttons.current[next]?.focus();
  };

  return (
    <div className={className ? `opt-switch ${className}` : "opt-switch"} data-option={option} data-ready={ready ? "" : undefined}>
      <div className="opt-switch-group" role="radiogroup" aria-label={optionStrings.switcher.label} onKeyDown={onKeyDown}>
        <span className="opt-switch-thumb" aria-hidden="true" />
        {OPTION_IDS.map((id: OptionId, i) => (
          <button
            key={id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            className="opt-switch-item"
            aria-checked={option === id}
            aria-label={t(optionStrings.switcher.option, { id: optionStrings.names[id] })}
            title={optionStrings.switcher.hint}
            tabIndex={option === id ? 0 : -1}
            onClick={() => setOption(id)}
          >
            {optionStrings.names[id]}
          </button>
        ))}
      </div>
      <span className="opt-sr" aria-live="polite">
        {ready ? t(optionStrings.switcher.announce, { id: optionStrings.names[option] }) : ""}
      </span>
    </div>
  );
}
