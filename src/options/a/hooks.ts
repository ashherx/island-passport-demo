"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/** Side panel instead of a bottom sheet from this width. */
export const WIDE_QUERY = "(min-width: 900px)";

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    if (typeof window.matchMedia !== "function") return () => {};
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}

const subscribeWide = subscribeMedia(WIDE_QUERY);
const subscribeReduced = subscribeMedia("(prefers-reduced-motion: reduce)");

export function useWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
  };
}

export function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerHeight,
    () => 844,
  );
}

export function useViewportWidth(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth,
    () => 390,
  );
}

/**
 * Height of an element, kept up to date. `fallback` is used until it has been measured.
 * Pass `key` when the element behind the ref can be replaced (a layout switch remounts it).
 */
export function useHeight(ref: RefObject<HTMLElement | null>, fallback: number, key?: string): number {
  const [height, setHeight] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setHeight(Math.round(el.getBoundingClientRect().height));
    read();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, key]);
  return height;
}

/**
 * Keeps the last non-null value for `ms` after it turns null, so a card can animate out before
 * it is removed. `leaving` is true during that time.
 */
export function useLinger<T>(value: T | null, ms: number): { shown: T | null; leaving: boolean } {
  const [kept, setKept] = useState<T | null>(value);
  if (value !== null && value !== kept) setKept(value);
  useEffect(() => {
    if (value !== null) return;
    const timer = window.setTimeout(() => setKept(null), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return { shown: value ?? kept, leaving: value === null && kept !== null };
}

/** True once the element has scrolled into view (of `root`, or the viewport). Stays true. */
export function useSeen(ref: RefObject<Element | null>, root?: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return;
    if (typeof IntersectionObserver !== "function") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          done.current = true;
          setSeen(true);
          observer.disconnect();
        }
      },
      // As soon as its top edge is a little way in: a tall section must not wait, half blank.
      { root: root?.current ?? null, threshold: 0, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, root]);
  return seen;
}
