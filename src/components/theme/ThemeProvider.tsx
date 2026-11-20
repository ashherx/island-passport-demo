"use client";

/**
 * Art direction + light/dark provider.
 *
 * - Writes data-direction and data-theme on <html> (the CSS variables in src/lib/directions.ts
 *   key off those attributes) and persists both in localStorage.
 * - The boot script in layout.tsx applies the stored values before first paint; this provider
 *   then adopts whatever is on <html>, so server and client markup always agree.
 * - <DirectionScope> re-themes a subtree, e.g. to preview another direction side by side.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DEFAULT_DIRECTION,
  DEFAULT_MODE,
  DIRECTIONS,
  STORAGE_KEYS,
  isDirectionId,
  type DirectionTokens,
} from "@/lib/directions";
import { DIRECTION_IDS, type DirectionId, type ThemeMode } from "@/lib/types";

export interface ThemeContextValue {
  direction: DirectionId;
  mode: ThemeMode;
  /** Token set of the active direction, for the rare case CSS variables are not enough. */
  tokens: DirectionTokens;
  /** False during server render and the first client pass, before stored values are adopted. */
  ready: boolean;
  setDirection(direction: DirectionId): void;
  setMode(mode: ThemeMode): void;
  toggleMode(): void;
  /** Advance to the next direction (classic, reef, journal, classic ...). */
  cycleDirection(): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Nearest direction: the global one, or a <DirectionScope> override. */
const DirectionContext = createContext<DirectionId>(DEFAULT_DIRECTION);

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Private mode and some in-app browsers refuse storage. The choice still applies this visit. */
  }
}

/**
 * The browser-bar colour. The inline script in layout.tsx creates <meta name="theme-color" data-ip>
 * before first paint; this only ever sets its content (or creates it if that script did not run).
 * It must never remove a node: metas rendered by React are unmounted by React, and a node that
 * has already been taken out of the document makes that unmount throw.
 */
function setThemeColorMeta(color: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-ip]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.setAttribute("data-ip", "");
    document.head.appendChild(meta);
  }
  if (meta.content !== color) meta.content = color;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [direction, setDirectionState] = useState<DirectionId>(DEFAULT_DIRECTION);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [ready, setReady] = useState(false);

  // Adopt what the boot script (or the server defaults) put on <html>.
  useEffect(() => {
    const el = document.documentElement;
    const d = el.getAttribute("data-direction");
    const m = el.getAttribute("data-theme");
    if (isDirectionId(d)) setDirectionState(d);
    if (m === "light" || m === "dark") setModeState(m);
    setReady(true);
    // The tree is interactive from here on: the early-tap script in layout.tsx stands down.
    // Effects run children first, so the demo has already read window.__ipEarly by now.
    (window as unknown as { __ipHydrated?: boolean }).__ipHydrated = true;
  }, []);

  // Follow the system setting until the visitor picks a mode themselves.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      const stored = readStorage(STORAGE_KEYS.mode);
      if (stored !== "light" && stored !== "dark") setModeState(e.matches ? "dark" : "light");
    };
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    // Older WebViews only have the deprecated listener API.
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = document.documentElement;
    el.setAttribute("data-direction", direction);
    el.setAttribute("data-theme", mode);
    el.style.colorScheme = mode;
    setThemeColorMeta(DIRECTIONS[direction].chrome[mode].themeColor);
  }, [direction, mode, ready]);

  const setDirection = useCallback((next: DirectionId) => {
    setDirectionState(next);
    writeStorage(STORAGE_KEYS.direction, next);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeStorage(STORAGE_KEYS.mode, next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      writeStorage(STORAGE_KEYS.mode, next);
      return next;
    });
  }, []);

  const cycleDirection = useCallback(() => {
    setDirectionState((current) => {
      const next = DIRECTION_IDS[(DIRECTION_IDS.indexOf(current) + 1) % DIRECTION_IDS.length];
      writeStorage(STORAGE_KEYS.direction, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      direction,
      mode,
      tokens: DIRECTIONS[direction],
      ready,
      setDirection,
      setMode,
      toggleMode,
      cycleDirection,
    }),
    [direction, mode, ready, setDirection, setMode, toggleMode, cycleDirection],
  );

  return (
    <ThemeContext.Provider value={value}>
      <DirectionContext.Provider value={direction}>{children}</DirectionContext.Provider>
    </ThemeContext.Provider>
  );
}

/** Active direction and mode, with setters. Must be used inside <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/** Direction that applies at this point in the tree (honours <DirectionScope>). Safe without a provider. */
export function useDirectionId(): DirectionId {
  return useContext(DirectionContext);
}

/** Token set that applies at this point in the tree. */
export function useDirectionTokens(): DirectionTokens {
  return DIRECTIONS[useContext(DirectionContext)];
}

export interface DirectionScopeProps {
  direction: DirectionId;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Re-theme a subtree with another art direction. Passport tokens (cover, paper, ink, foil, fonts)
 * and chrome tokens both switch; light/dark still follows <html>.
 */
export function DirectionScope({ direction, children, className, style }: DirectionScopeProps) {
  return (
    <DirectionContext.Provider value={direction}>
      <div data-direction={direction} className={className} style={style}>
        {children}
      </div>
    </DirectionContext.Provider>
  );
}
