"use client";

/**
 * Option provider for the globe landing.
 *
 * - Holds the current design option (a, b or c) and writes data-option on <html>, so each option's
 *   palette (`--o-*`, see palettes.ts) applies to everything on the page.
 * - Order of precedence on load: `?option=` in the URL, then localStorage, then "a". The boot
 *   script in boot.ts applies that before first paint; this provider adopts what it finds.
 * - Switching writes localStorage and replaces the URL query (no navigation, no reload), so the
 *   address bar is always a shareable link to the option on screen.
 * - Also holds the selected island. It lives here, above the three landings, so switching option
 *   keeps the same island open, and it is mirrored to `?island=` for the same reason.
 *
 * Mount it once per page that shows an option (src/app/page.tsx does). It removes data-option
 * again when it unmounts, so the passport and the labs are not affected.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { OPTION_PALETTES } from "./palettes";
import {
  DEFAULT_OPTION,
  ISLAND_QUERY,
  OPTION_IDS,
  OPTION_QUERY,
  OPTION_STORAGE_KEY,
  isOptionId,
  type OptionId,
  type OptionPalette,
} from "./types";

export interface OptionContextValue {
  option: OptionId;
  /** Starter palette of the current option, for canvas or map colours CSS variables cannot reach. */
  palette: OptionPalette;
  /** False during server render and the first client pass, before the stored option is adopted. */
  ready: boolean;
  setOption(option: OptionId): void;
  /** Advance to the next option (a, b, c, a ...). */
  cycleOption(): void;
  /** Island currently open, shared by all three options. */
  selectedIslandId: string | null;
  selectIsland(id: string | null): void;
}

const OptionContext = createContext<OptionContextValue | null>(null);

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(OPTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string): void {
  try {
    window.localStorage.setItem(OPTION_STORAGE_KEY, value);
  } catch {
    /* Private mode and some in-app browsers refuse storage. The choice still applies this visit. */
  }
}

function readQuery(): { option: OptionId | null; island: string | null } {
  const params = new URLSearchParams(window.location.search);
  const option = params.get(OPTION_QUERY);
  const island = params.get(ISLAND_QUERY);
  return { option: isOptionId(option) ? option : null, island: island && /^[a-z0-9-]{1,40}$/.test(island) ? island : null };
}

/** Replace the query without a navigation. Next's router keeps its own state through this call. */
function writeQuery(option: OptionId, island: string | null): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(OPTION_QUERY, option);
    if (island) url.searchParams.set(ISLAND_QUERY, island);
    else url.searchParams.delete(ISLAND_QUERY);
    const next = url.pathname + url.search + url.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, "", next);
    }
  } catch {
    /* Sandboxed frames can refuse history writes. The option still applies. */
  }
}

/**
 * Keep the browser bar on the option's colour while the landing is mounted. The root layout owns
 * one <meta name="theme-color" data-ip>; ThemeProvider writes the passport colour into it, so this
 * re-applies ours whenever that changes and puts the previous value back on unmount. The node is
 * only ever updated, never removed (see the note in src/components/theme/ThemeProvider.tsx).
 */
function useThemeColor(color: string): void {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-ip]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.setAttribute("data-ip", "");
      document.head.appendChild(meta);
    }
    const node = meta;
    let previous = node.content;
    const apply = () => {
      if (node.content !== color) {
        previous = node.content || previous;
        node.content = color;
      }
    };
    apply();
    const observer = typeof MutationObserver === "function" ? new MutationObserver(apply) : null;
    observer?.observe(node, { attributes: true, attributeFilter: ["content"] });
    return () => {
      observer?.disconnect();
      if (previous && previous !== color) node.content = previous;
    };
  }, [color]);
}

export interface OptionProviderProps {
  children: ReactNode;
  /** `?option=` as read on the server, so the first HTML already shows the right option. */
  initialOption?: OptionId | null;
  /** `?island=` as read on the server. */
  initialIsland?: string | null;
  /** Set false on a page that should not touch the URL (a lab that embeds several globes). */
  syncUrl?: boolean;
}

export function OptionProvider({ children, initialOption = null, initialIsland = null, syncUrl = true }: OptionProviderProps) {
  const [option, setOptionState] = useState<OptionId>(initialOption ?? DEFAULT_OPTION);
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(initialIsland);
  const [ready, setReady] = useState(false);
  /** True once the visitor (or a link) has chosen something worth putting in the URL. */
  const explicit = useRef(initialOption !== null || initialIsland !== null);

  // Adopt what the boot script put on <html>, and follow back/forward.
  useEffect(() => {
    const el = document.documentElement;
    const adopt = () => {
      const query = readQuery();
      const attr = el.getAttribute("data-option");
      const stored = readStorage();
      const next = query.option ?? (isOptionId(attr) ? attr : isOptionId(stored) ? stored : DEFAULT_OPTION);
      setOptionState(next);
      setSelectedIslandId(query.island);
      if (query.option || query.island) explicit.current = true;
    };
    adopt();
    setReady(true);
    const onPop = () => {
      el.removeAttribute("data-option");
      adopt();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      el.removeAttribute("data-option");
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.setAttribute("data-option", option);
    if (syncUrl && explicit.current) writeQuery(option, selectedIslandId);
  }, [option, selectedIslandId, ready, syncUrl]);

  useThemeColor(OPTION_PALETTES[option].themeColor);

  const setOption = useCallback((next: OptionId) => {
    explicit.current = true;
    writeStorage(next);
    setOptionState(next);
  }, []);

  const cycleOption = useCallback(() => {
    explicit.current = true;
    setOptionState((current) => {
      const next = OPTION_IDS[(OPTION_IDS.indexOf(current) + 1) % OPTION_IDS.length];
      writeStorage(next);
      return next;
    });
  }, []);

  const selectIsland = useCallback((id: string | null) => {
    explicit.current = true;
    setSelectedIslandId(id);
  }, []);

  const value = useMemo<OptionContextValue>(
    () => ({ option, palette: OPTION_PALETTES[option], ready, setOption, cycleOption, selectedIslandId, selectIsland }),
    [option, ready, setOption, cycleOption, selectedIslandId, selectIsland],
  );

  return <OptionContext.Provider value={value}>{children}</OptionContext.Provider>;
}

/** Current option, its palette and the shared island selection. Must be under <OptionProvider>. */
export function useOption(): OptionContextValue {
  const ctx = useContext(OptionContext);
  if (!ctx) throw new Error("useOption must be used inside <OptionProvider>");
  return ctx;
}

/** Same as useOption, but returns null outside a provider (for pieces that also run in labs). */
export function useOptionMaybe(): OptionContextValue | null {
  return useContext(OptionContext);
}
