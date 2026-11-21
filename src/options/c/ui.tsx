"use client";

/**
 * Option C: small shared pieces. Hooks for the viewport and motion preference, the count-up
 * number, trend arrows, meters and the line-art glyph used for species and stamps.
 */
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { artUrl } from "@/lib/assets";
import { islandStrings, type Trend as TrendValue } from "@/lib/islands";
import type { StampArt } from "@/lib/types";

/* ------------------------------------------------------------------ hooks */

function useMedia(query: string, onServer = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => onServer,
  );
}

/** Desktop layout: a side panel instead of a bottom sheet. Phone first on the server. */
export const WIDE_QUERY = "(min-width: 900px)";
export const useWide = () => useMedia(WIDE_QUERY);
export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");

export function useViewportHeight(): number {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    () => window.innerHeight,
    () => 844,
  );
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --------------------------------------------------------------- count-up */

/**
 * A figure that counts up to its value the first time it is seen. It takes the ready-to-print
 * string ("1.2M", "12,400", "About 800", "91 / 100"), finds the first number in it and animates
 * only that, keeping decimals, thousands separators and the text around it. The real value is
 * always in the markup (and is what a screen reader gets); the animation only rewrites the
 * visible copy, without re-rendering React.
 */
export function Count({ display, delay = 0, duration = 900, className }: { display: string; delay?: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const match = /^(\D*?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/.exec(display);
    if (!el || !match || prefersReducedMotion() || typeof IntersectionObserver !== "function") return;
    const [, before, number, after] = match;
    const target = parseFloat(number.replace(/,/g, ""));
    const decimals = (number.split(".")[1] ?? "").length;
    const grouped = number.includes(",");
    const format = (value: number) => {
      let text = value.toFixed(decimals);
      if (grouped) text = text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return before + text + after;
    };
    let raf = 0;
    let timer = 0;
    el.textContent = format(0);
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // Ease-out-expo: fast off the mark, settling exactly on the value.
        const eased = t >= 1 ? 1 : 1 - 2 ** (-10 * t);
        el.textContent = t >= 1 ? display : format(target * eased);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        timer = window.setTimeout(run, delay);
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      el.textContent = display;
    };
  }, [display, delay, duration]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">
        {display}
      </span>
      <span className="oc-sr">{display}</span>
    </span>
  );
}

/* ------------------------------------------------------------ small marks */

const TREND_PATH: Record<TrendValue, string> = {
  up: "M3 9l6-6M4.5 3H9v4.5",
  down: "M3 3l6 6M9 4.5V9H4.5",
  steady: "M2 6h8M7 3l3 3-3 3",
};

/** Arrow for a trend, with its meaning as text for screen readers. */
export function Trend({ trend, label = true }: { trend: TrendValue; label?: boolean }) {
  return (
    <span className="oc-trend" data-trend={trend}>
      <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d={TREND_PATH[trend]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      </svg>
      <span className={label ? undefined : "oc-sr"}>{islandStrings.trend[trend]}</span>
    </span>
  );
}

/** A hairline meter: a rule with the filled part drawn over it. Decorative; the figure is beside it. */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const share = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <span className={className ? `oc-meter ${className}` : "oc-meter"} aria-hidden="true">
      <span className="oc-meter-fill" style={{ "--oc-share": share } as CSSProperties} />
    </span>
  );
}

/** Line art from the stamp artwork, tinted with the current text colour. */
export function Glyph({ art, className }: { art: StampArt; className?: string }) {
  const url = `url(${artUrl(art)})`;
  return <span className={className ? `oc-glyph ${className}` : "oc-glyph"} style={{ maskImage: url, WebkitMaskImage: url }} aria-hidden="true" />;
}

/** Text that rises out of a mask, one line at a time. `index` staggers it. */
export function Rise({ children, index = 0, as: Tag = "span", className }: { children: ReactNode; index?: number; as?: "span" | "div"; className?: string }) {
  return (
    <Tag className={className ? `oc-rise ${className}` : "oc-rise"} style={{ "--oc-i": index } as CSSProperties}>
      <span className="oc-rise-in">{children}</span>
    </Tag>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

export function ArrowIcon({ direction = "right" }: { direction?: "right" | "left" | "up-right" }) {
  const d = direction === "right" ? "M2 8h11M9 4l4 4-4 4" : direction === "left" ? "M14 8H3M7 4L3 8l4 4" : "M4 12l8-8M5.5 4H12v6.5";
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

/** "09.85° N  124.17° E" */
export function formatCoordinates(lng: number, lat: number): string {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  const pad = (value: number, width: number) => Math.abs(value).toFixed(2).padStart(width, "0");
  return `${pad(lat, 5)}° ${lat >= 0 ? "N" : "S"}  ${pad(wrapped, 6)}° ${wrapped >= 0 ? "E" : "W"}`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
