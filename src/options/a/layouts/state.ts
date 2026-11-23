"use client";

/**
 * Which layout of the landing is on screen.
 *
 * A "layout" arranges the same pieces (headline, search, island chips, globe, island card) in a
 * different way, and gives the flight to an island a different feel. It is not a design option:
 * the look stays "Daylight Atlas" in every layout.
 *
 * Order of precedence on load: `?layout=` in the URL, then localStorage, then the default.
 * Switching writes localStorage and replaces the URL query (no navigation, no reload), so the
 * address bar is always a link to what is on screen. The selected island is not touched: it lives
 * in the option provider, and the globe stays mounted across a switch.
 *
 * First paint: the server renders the layout named in the URL (or the default). The boot script
 * in src/lib/options/boot.ts stamps the visitor's stored layout on <html data-layout>; if that is
 * a different one, atlas.css keeps the landing invisible for the instant it takes React to swap,
 * so the wrong layout never flashes.
 */
import { useSearchParams } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_LAYOUT, LAYOUT_QUERY, LAYOUT_STORAGE_KEY, isLayoutId, type LayoutId } from "@/lib/options";

let current: LayoutId | null = null;
const listeners = new Set<() => void>();

function readQuery(): LayoutId | null {
  try {
    const value = new URLSearchParams(window.location.search).get(LAYOUT_QUERY);
    return isLayoutId(value) ? value : null;
  } catch {
    return null;
  }
}

function readStorage(): LayoutId | null {
  try {
    const value = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return isLayoutId(value) ? value : null;
  } catch {
    return null;
  }
}

/** The layout for this visit, resolved once on the client. */
function resolve(): LayoutId {
  if (current === null) {
    const attr = document.documentElement.getAttribute("data-layout");
    current = readQuery() ?? (isLayoutId(attr) ? attr : null) ?? readStorage() ?? DEFAULT_LAYOUT;
  }
  return current;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // A link followed inside the app can arrive with a different ?layout= (this module outlives
  // the page it was first used on): the landing adopts it when it mounts.
  const adopt = () => {
    const next = readQuery();
    if (next && next !== current) {
      current = next;
      document.documentElement.setAttribute("data-layout", next);
      emit();
    }
  };
  // Back and Forward within this page (closing an island card goes back one entry) keep the
  // layout that is on screen. A switch only rewrites the entry it happens on, so the entry under
  // an open card can still name the layout the card was opened in; adopting it would switch the
  // layout back when the card closes. The entry's URL is brought up to date instead.
  const onPop = () => {
    if (current !== null && readQuery() !== current) writeQuery(current);
  };
  if (current !== null) queueMicrotask(adopt);
  window.addEventListener("popstate", onPop);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onPop);
  };
}

function writeQuery(layout: LayoutId): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(LAYOUT_QUERY, layout);
    const next = url.pathname + url.search + url.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      // Keep whatever state the entry already carries (Next's router reads its own from it).
      window.history.replaceState(window.history.state, "", next);
    }
  } catch {
    /* A sandboxed frame can refuse history writes. The layout still applies. */
  }
}

export function setLayout(layout: LayoutId): void {
  if (resolve() === layout) return;
  current = layout;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    /* Private mode and some in-app browsers refuse storage. The choice still applies this visit. */
  }
  document.documentElement.setAttribute("data-layout", layout);
  writeQuery(layout);
  emit();
}

export interface LayoutState {
  layout: LayoutId;
  setLayout(layout: LayoutId): void;
}

export function useLayout(): LayoutState {
  // What the server rendered: the layout in the URL, else the default. Hydration starts from the
  // same value, then React switches to the stored layout if that is a different one.
  const fromUrl = useSearchParams()?.get(LAYOUT_QUERY) ?? null;
  const server = isLayoutId(fromUrl) ? fromUrl : DEFAULT_LAYOUT;
  const layout = useSyncExternalStore(subscribe, resolve, () => server);
  const set = useCallback((next: LayoutId) => setLayout(next), []);
  return { layout, setLayout: set };
}
