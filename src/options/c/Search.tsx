"use client";

/**
 * Option C: the island search (UX-1a), drawn as an editorial index.
 *
 * Built on the shared headless combobox (`useIslandSearch`), so the fuzzy matching, the ARIA
 * pattern and the keyboard handling are the same as in the other options; only the look differs:
 * a square, ink-ruled field and a numbered list with small-caps status.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { highlightParts, islandStrings, useIslandSearch, type GlobeIsland } from "@/lib/islands";
import { t } from "@/lib/strings";
import { cStrings } from "./strings";
import { CloseIcon, pad2 } from "./ui";

export interface SearchHandle {
  focus(): void;
  clear(): void;
}

export interface SearchProps {
  onSelect(island: GlobeIsland): void;
  /** "/" focuses the field (desktop). */
  shortcut?: boolean;
}

export const Search = forwardRef<SearchHandle, SearchProps>(function Search({ onSelect, shortcut = false }, ref) {
  const search = useIslandSearch({ onSelect, limit: 7, afterSelect: "clear" });
  const input = useRef<HTMLInputElement>(null);
  const { inputProps } = search;
  const count = search.results.length;

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus({ preventScroll: true }), clear: search.clear }), [search.clear]);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const meta = (island: GlobeIsland, matched: string, field: string) => {
    if (field === "alias") return `${matched} · ${island.country}`;
    return island.region === island.country ? island.country : `${island.region}, ${island.country}`;
  };

  return (
    <div className="oc-search" data-open={search.open ? "" : undefined}>
      <label className="oc-sr" htmlFor={search.inputId}>
        {islandStrings.search.label}
      </label>
      <div className="oc-search-field">
        <svg className="oc-search-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12.6 12.6 17 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        </svg>
        <input {...inputProps} ref={input} className="oc-search-input" placeholder={cStrings.search.placeholder} />
        {search.query ? (
          <button
            type="button"
            className="oc-search-clear"
            aria-label={islandStrings.search.clear}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              search.clear();
              search.setOpen(true);
              input.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        ) : shortcut ? (
          <kbd className="oc-search-kbd" aria-hidden="true" title={cStrings.search.shortcut}>
            /
          </kbd>
        ) : null}
      </div>

      {search.open ? (
        <ul {...search.listProps} className="oc-search-list" aria-label={islandStrings.search.suggested}>
          {search.results.map((result, i) => {
            const { island } = result;
            const live = island.status === "live";
            return (
              <li key={island.id} {...search.optionProps(i)} className="oc-search-option" data-active={i === search.activeIndex ? "" : undefined} data-live={live}>
                <span className="oc-search-no" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                <span className="oc-search-text">
                  <span className="oc-search-name">
                    {highlightParts(island.name, result.ranges).map((part, k) => (part.hit ? <mark key={k}>{part.text}</mark> : <span key={k}>{part.text}</span>))}
                  </span>
                  <span className="oc-search-meta">{meta(island, result.matchedText, result.field)}</span>
                </span>
                <span className="oc-search-tag" data-live={live}>
                  <span className="oc-sr">{islandStrings.status[island.status]}</span>
                  <span aria-hidden="true">{live ? cStrings.search.openTag : cStrings.search.soonTag}</span>
                </span>
              </li>
            );
          })}
          {count === 0 ? (
            <li className="oc-search-empty" role="presentation">
              {t(islandStrings.search.empty, { query: search.query.trim() })}
            </li>
          ) : null}
        </ul>
      ) : null}

      <span className="oc-sr" role="status">
        {search.open && search.query.trim() ? (count === 1 ? islandStrings.search.countOne : t(islandStrings.search.count, { n: count })) : ""}
      </span>
    </div>
  );
});
