"use client";

/**
 * Headless island search (UX-1a): query state, fuzzy results and the full ARIA combobox wiring
 * (keyboard, active option, ids). It renders nothing, so each option can build its own search
 * box. <IslandSearch> in src/components/options-ui is the default one built on it.
 *
 *   const s = useIslandSearch({ onSelect: (island) => globe.current?.flyToIsland(island.id) });
 *   <input {...s.inputProps} />
 *   {s.open && <ul {...s.listProps}>{s.results.map((r, i) => <li key={r.island.id} {...s.optionProps(i)}>…</li>)}</ul>}
 */
import { useCallback, useId, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import { ISLANDS } from "./data";
import { searchIslands, type IslandSearchResult } from "./search";
import type { GlobeIsland } from "./types";

export interface UseIslandSearchOptions {
  /** Islands to search. Default: all sample islands. */
  islands?: readonly GlobeIsland[];
  /** Called when a result is chosen (Enter, click or tap). Fly the globe here. */
  onSelect?(island: GlobeIsland): void;
  /** Most results to show. Default 6. */
  limit?: number;
  /** Show every island when the field is focused and empty. Default true. */
  browseWhenEmpty?: boolean;
  /** What the field shows after a choice: the island's name (default) or nothing. */
  afterSelect?: "name" | "clear";
}

export interface IslandSearchState {
  query: string;
  setQuery(query: string): void;
  results: IslandSearchResult[];
  /** True while the list should be visible. */
  open: boolean;
  setOpen(open: boolean): void;
  /** Index of the keyboard-highlighted result, or -1. */
  activeIndex: number;
  setActiveIndex(index: number): void;
  select(island: GlobeIsland): void;
  clear(): void;
  /** Spread on the <input>. */
  inputProps: {
    id: string;
    role: "combobox";
    type: "text";
    inputMode: "search";
    enterKeyHint: "search";
    autoComplete: "off";
    autoCorrect: "off";
    autoCapitalize: "off";
    spellCheck: false;
    "aria-autocomplete": "list";
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-activedescendant": string | undefined;
    value: string;
    onChange(e: ChangeEvent<HTMLInputElement>): void;
    onKeyDown(e: KeyboardEvent<HTMLInputElement>): void;
    onFocus(e: FocusEvent<HTMLInputElement>): void;
    onBlur(e: FocusEvent<HTMLInputElement>): void;
  };
  /** Spread on the list element. */
  listProps: { id: string; role: "listbox" };
  /** Spread on each result. */
  optionProps(index: number): {
    id: string;
    role: "option";
    "aria-selected": boolean;
    onMouseDown(e: MouseEvent): void;
    onMouseEnter(): void;
    onClick(): void;
  };
  /** Id of the input, for a <label htmlFor>. */
  inputId: string;
}

export function useIslandSearch(options: UseIslandSearchOptions = {}): IslandSearchState {
  const { islands = ISLANDS, onSelect, limit = 6, browseWhenEmpty = true, afterSelect = "name" } = options;
  const [query, setQueryState] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  /** Set when a choice has just filled the field, so the list does not reopen on that name. */
  const chosen = useRef<string | null>(null);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed && !browseWhenEmpty) return [];
    if (chosen.current !== null && chosen.current === query) return searchIslands(islands, "", { limit });
    return searchIslands(islands, trimmed, { limit });
  }, [islands, query, limit, browseWhenEmpty]);

  const setQuery = useCallback((next: string) => {
    chosen.current = null;
    setQueryState(next);
    setActiveIndex(next.trim() ? 0 : -1);
    setOpen(true);
  }, []);

  const select = useCallback(
    (island: GlobeIsland) => {
      const text = afterSelect === "name" ? island.name : "";
      chosen.current = text;
      setQueryState(text);
      setOpen(false);
      setActiveIndex(-1);
      onSelect?.(island);
    },
    [afterSelect, onSelect],
  );

  const clear = useCallback(() => {
    chosen.current = null;
    setQueryState("");
    setActiveIndex(-1);
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Keep these keys away from anything else on the page (the globe pans with arrow keys).
      if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"].includes(e.key)) e.stopPropagation();
      const count = results.length;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!open) setOpen(true);
          if (count) setActiveIndex((i) => (i + 1) % count);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!open) setOpen(true);
          if (count) setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
          break;
        case "Home":
          if (open && count) {
            e.preventDefault();
            setActiveIndex(0);
          }
          break;
        case "End":
          if (open && count) {
            e.preventDefault();
            setActiveIndex(count - 1);
          }
          break;
        case "Enter": {
          const pick = open ? (results[activeIndex] ?? (query.trim() ? results[0] : undefined)) : undefined;
          if (pick) {
            e.preventDefault();
            select(pick.island);
          }
          break;
        }
        case "Escape":
          if (open) {
            e.preventDefault();
            setOpen(false);
            setActiveIndex(-1);
          } else if (query) {
            e.preventDefault();
            clear();
          }
          break;
      }
    },
    [results, open, activeIndex, query, select, clear],
  );

  const active = open && activeIndex >= 0 && activeIndex < results.length ? `${baseId}-opt-${activeIndex}` : undefined;

  return {
    query,
    setQuery,
    results,
    open: open && (results.length > 0 || query.trim().length > 0),
    setOpen,
    activeIndex,
    setActiveIndex,
    select,
    clear,
    inputId,
    inputProps: {
      id: inputId,
      role: "combobox",
      type: "text",
      inputMode: "search",
      enterKeyHint: "search",
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "off",
      spellCheck: false,
      "aria-autocomplete": "list",
      "aria-expanded": open && results.length > 0,
      "aria-controls": listId,
      "aria-activedescendant": active,
      value: query,
      onChange: (e) => setQuery(e.target.value),
      onKeyDown,
      onFocus: () => setOpen(true),
      // A tap on a result fires blur first; optionProps.onMouseDown prevents that blur, so by the
      // time this runs the focus really has left the search.
      onBlur: () => {
        setOpen(false);
        setActiveIndex(-1);
      },
    },
    listProps: { id: listId, role: "listbox" },
    optionProps: (index) => ({
      id: `${baseId}-opt-${index}`,
      role: "option",
      "aria-selected": index === activeIndex,
      onMouseDown: (e) => e.preventDefault(),
      onMouseEnter: () => setActiveIndex(index),
      onClick: () => {
        const r = results[index];
        if (r) select(r.island);
      },
    }),
  };
}
