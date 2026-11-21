"use client";

/**
 * The default island search box (UX-1a): an accessible combobox over useIslandSearch.
 * Choosing a result calls onSelect; fly the globe there.
 *
 *   <IslandSearch onSelect={(island) => { selectIsland(island.id); globe.current?.flyToIsland(island.id); }} />
 *
 * Restyling: every part has an `ips-` class and reads `--o-*` palette variables, so most options
 * only need a few overrides. An option that wants different markup uses the hook directly.
 */
import { useRef } from "react";
import { highlightParts, islandStrings, useIslandSearch, type GlobeIsland, type UseIslandSearchOptions } from "@/lib/islands";
import { t } from "@/lib/strings";
import "./options-ui.css";

export interface IslandSearchProps extends UseIslandSearchOptions {
  className?: string;
  placeholder?: string;
  /** Where the list opens: below the field (default) or above it (a search box near the bottom). */
  placement?: "below" | "above";
  /** Called when the field gains or loses focus, e.g. to pause the globe's spin. */
  onFocusChange?(focused: boolean): void;
}

export function IslandSearch({ className, placeholder = islandStrings.search.placeholder, placement = "below", onFocusChange, ...options }: IslandSearchProps) {
  const search = useIslandSearch(options);
  const input = useRef<HTMLInputElement>(null);
  const { inputProps } = search;
  const count = search.results.length;

  const meta = (island: GlobeIsland, matched: string, field: string) => {
    // Say why a result matched when it was not the name ("Alona Beach" for Panglao).
    if (field === "alias") return `${matched} · ${island.country}`;
    return island.region === island.country ? island.country : `${island.region}, ${island.country}`;
  };

  return (
    <div className={className ? `ips ${className}` : "ips"} data-open={search.open ? "" : undefined} data-placement={placement}>
      <label className="opt-sr" htmlFor={search.inputId}>
        {islandStrings.search.label}
      </label>
      <div className="ips-field">
        <svg className="ips-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="9" cy="9" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13.2 13.2 17 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          {...inputProps}
          ref={input}
          className="ips-input"
          placeholder={placeholder}
          onFocus={(e) => {
            inputProps.onFocus(e);
            onFocusChange?.(true);
          }}
          onBlur={(e) => {
            inputProps.onBlur(e);
            onFocusChange?.(false);
          }}
        />
        {search.query ? (
          <button
            type="button"
            className="ips-clear"
            aria-label={islandStrings.search.clear}
            // Keep focus in the field: clearing should not close the keyboard on a phone.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              search.clear();
              search.setOpen(true);
              input.current?.focus();
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {search.open ? (
        <ul {...search.listProps} className="ips-list" aria-label={islandStrings.search.suggested}>
          {search.results.map((result, i) => {
            const { island } = result;
            return (
              <li
                key={island.id}
                {...search.optionProps(i)}
                className="ips-option"
                data-active={i === search.activeIndex ? "" : undefined}
                data-status={island.status}
              >
                <span className="ips-dot" aria-hidden="true" />
                <span className="ips-text">
                  <span className="ips-name">
                    {highlightParts(island.name, result.ranges).map((part, k) =>
                      part.hit ? <mark key={k}>{part.text}</mark> : <span key={k}>{part.text}</span>,
                    )}
                  </span>
                  <span className="ips-meta">{meta(island, result.matchedText, result.field)}</span>
                </span>
                {island.status === "coming-soon" ? <span className="ips-badge">{islandStrings.status["coming-soon"]}</span> : null}
              </li>
            );
          })}
          {count === 0 ? (
            <li className="ips-empty" role="presentation">
              {t(islandStrings.search.empty, { query: search.query.trim() })}
            </li>
          ) : null}
        </ul>
      ) : null}

      <span className="opt-sr" role="status">
        {search.open && search.query.trim() ? (count === 1 ? islandStrings.search.countOne : t(islandStrings.search.count, { n: count })) : ""}
      </span>
    </div>
  );
}
