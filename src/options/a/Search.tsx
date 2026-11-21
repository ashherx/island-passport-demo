"use client";

/**
 * Option A's island search (UX-1a): a frosted pill built on the shared headless combobox
 * (`useIslandSearch`), so the keyboard and ARIA behaviour are the same in all three options.
 * Results are grouped into "Open now" and "Coming soon".
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { highlightParts, islandStrings, useIslandSearch, type GlobeIsland } from "@/lib/islands";
import { t } from "@/lib/strings";
import { aStrings } from "./strings";

export interface SearchHandle {
  focus(): void;
  /** Give the field focus without opening the list (focus handed back when a card closes). */
  focusQuietly(): void;
  /** True when the element is this search's text field. */
  owns(element: Element | null): boolean;
}

export interface SearchProps {
  onSelect(island: GlobeIsland): void;
  /** Name of the open island, mirrored into the field. Null clears it. */
  current: string | null;
  onFocusChange?(focused: boolean): void;
}

export const Search = forwardRef<SearchHandle, SearchProps>(function Search({ onSelect, current, onFocusChange }, ref) {
  const search = useIslandSearch({ onSelect, limit: 11 });
  const input = useRef<HTMLInputElement>(null);
  const { inputProps, setQuery, setOpen, clear } = search;
  const quiet = useRef(false);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus(),
      focusQuietly: () => {
        if (!input.current || document.activeElement === input.current) return;
        quiet.current = true;
        input.current.focus({ preventScroll: true });
        quiet.current = false;
      },
      owns: (element) => element !== null && element === input.current,
    }),
    [],
  );

  // Mirror the open island into the field (a tap on the globe, a chip, a deep link), and empty
  // it when the card closes. Typing is never overwritten: this only runs when `current` changes.
  const mirrored = useRef<string | null>(null);
  useEffect(() => {
    if (current === mirrored.current) return;
    mirrored.current = current;
    if (current) {
      setQuery(current);
      setOpen(false);
    } else clear();
  }, [current, setQuery, setOpen, clear]);

  const count = search.results.length;
  const firstSoon = search.results.findIndex((r) => r.island.status === "coming-soon");
  const hasLive = search.results.some((r) => r.island.status === "live");

  return (
    <div className="da-search" data-open={search.open ? "" : undefined}>
      <label className="da-sr" htmlFor={search.inputId}>
        {islandStrings.search.label}
      </label>
      <div className="da-search-field">
        <svg className="da-search-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="9" cy="9" r="5.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M13.3 13.3 17 17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          {...inputProps}
          ref={input}
          className="da-search-input"
          placeholder={aStrings.search.placeholder}
          onFocus={(e) => {
            inputProps.onFocus(e);
            if (quiet.current) {
              setOpen(false);
              return;
            }
            // Start a fresh search when the field still shows the open island's name.
            if (current && search.query === current) e.currentTarget.select();
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
            className="da-search-clear"
            aria-label={islandStrings.search.clear}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              clear();
              setOpen(true);
              input.current?.focus();
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {search.open ? (
        <ul {...search.listProps} className="da-search-list" aria-label={islandStrings.search.suggested}>
          {search.results.map((result, i) => {
            const { island } = result;
            const live = island.status === "live";
            const meta = result.field === "alias" ? `${result.matchedText} · ${island.country}` : island.region === island.country ? island.country : `${island.region}, ${island.country}`;
            return [
              i === 0 && live ? (
                <li key="h-live" className="da-search-group" role="presentation">
                  {aStrings.search.open}
                </li>
              ) : null,
              i === firstSoon ? (
                <li key="h-soon" className="da-search-group" role="presentation" data-first={hasLive ? undefined : ""}>
                  {aStrings.search.soon}
                </li>
              ) : null,
              <li key={island.id} {...search.optionProps(i)} className="da-search-option" data-active={i === search.activeIndex ? "" : undefined} data-status={island.status}>
                <span className="da-search-pin" aria-hidden="true" />
                <span className="da-search-text">
                  <span className="da-search-name">
                    {highlightParts(island.name, result.ranges).map((part, k) => (part.hit ? <mark key={k}>{part.text}</mark> : <span key={k}>{part.text}</span>))}
                  </span>
                  <span className="da-search-meta">{meta}</span>
                </span>
                <svg className="da-search-go" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </li>,
            ];
          })}
          {count === 0 ? (
            <li className="da-search-empty" role="presentation">
              {t(islandStrings.search.empty, { query: search.query.trim() })}
            </li>
          ) : null}
        </ul>
      ) : null}

      <span className="da-sr" role="status">
        {search.open && search.query.trim() ? (count === 1 ? islandStrings.search.countOne : t(islandStrings.search.count, { n: count })) : ""}
      </span>
    </div>
  );
});
