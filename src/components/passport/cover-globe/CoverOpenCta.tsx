"use client";

/**
 * The affordance under the closed passport: "Open to Bohol". It names the island the globe is
 * showing (or heading for) and opens the passport to that island's page. Tapping the cover does
 * the same; this says so in words, and is the keyboard and screen-reader path.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { strings } from "@/lib/strings";
import type { CoverGlobeController } from "./controller";
import { useCoverGlobeState } from "./CoverGlobeFace";

const S = strings.coverGlobe;
const [BEFORE, AFTER = ""] = S.openTo.split("{island}");

/** The name changes with the tour: the new one fades in where the old one was. */
function Name({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span className="ipcg-swap ipcg-cta__island">
      <span key={id} className="ipcg-swap__item">
        {children}
      </span>
    </span>
  );
}

export interface CoverOpenCtaProps {
  controller: CoverGlobeController;
  onOpen(): void;
  /** The small pulsing dot that says "start here". */
  pulse?: boolean;
  className?: string;
}

export function CoverOpenCta({ controller, onOpen, pulse = false, className }: CoverOpenCtaProps) {
  const state = useCoverGlobeState(controller);
  const stop = state.stops.find((s) => s.id === state.focusId) ?? null;
  // The server and the first client pass render the same thing: the stops arrive in an effect.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <button type="button" className={className ? `ipcg-cta ${className}` : "ipcg-cta"} onClick={onOpen}>
      {pulse && <i className="ipcg-cta__pulse" aria-hidden="true" />}
      {mounted && stop ? (
        <span>
          {BEFORE}
          <Name id={stop.id}>{stop.name}</Name>
          {AFTER}
        </span>
      ) : (
        <span>{S.open}</span>
      )}
      <svg className="ipcg-cta__arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8h9.5M8.5 4l4 4-4 4" />
      </svg>
    </button>
  );
}

/**
 * The map's credits. The window on the cover is too small to carry them, so they sit beside the
 * "Open to ..." button as a compact "©" that opens to the full line, the way map libraries
 * collapse their attribution on small maps.
 */
export function CoverMapCredit({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span ref={ref} className={className ? `ipcg-credit ${className}` : "ipcg-credit"} data-open={open ? "" : undefined}>
      <button type="button" className="ipcg-credit__btn" aria-expanded={open} aria-label={S.mapCreditLabel} title={S.mapCreditLabel} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">©</span>
      </button>
      {open && (
        <span className="ipcg-credit__pop" role="note">
          {S.mapCreditLead}{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
            {S.mapCreditData}
          </a>
          {", "}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer noopener">
            {S.mapCreditTiles}
          </a>
        </span>
      )}
    </span>
  );
}
