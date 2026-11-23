"use client";

/**
 * Pieces of the landing that every layout arranges in its own way: the wordmark, the headline,
 * the island chips and the hint. The layouts in ./layouts compose them; none of them owns state.
 */
import type { RefObject } from "react";
import { COMING_SOON_ISLANDS, LIVE_ISLANDS, islandStrings, type GlobeIsland } from "@/lib/islands";
import { strings } from "@/lib/strings";
import { aStrings } from "./strings";

export function Brand({ className }: { className: string }) {
  return (
    <div className={className}>
      <span className="da-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" focusable="false">
          <circle cx="16" cy="16" r="14.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1.6 2.3" strokeLinecap="round" />
          <circle cx="16" cy="16" r="9.4" fill="currentColor" opacity="0.14" />
          <circle cx="16" cy="16" r="9.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6.6 16h18.800M16 6.600c3.400 2.700 3.400 16.100 0 18.800M16 6.600c-3.400 2.700-3.400 16.100 0 18.800" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </span>
      <span className="da-brand-name">{strings.app.name}</span>
      <span className="da-sample">{islandStrings.sample.tag}</span>
    </div>
  );
}

/** Wordmark, headline and the line under it. Folds away when an island is chosen. */
export function Intro({ hidden, contentRef }: { hidden: boolean; contentRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="da-intro" aria-hidden={hidden ? true : undefined}>
      <div className="da-intro-clip">
        <div className="da-intro-content" ref={contentRef}>
          <Brand className="da-brand da-brand-intro" />
          <h1 className="da-title">
            {aStrings.hero.title} <em>{aStrings.hero.accent}</em>
          </h1>
          <p className="da-sub">{aStrings.hero.body}</p>
        </div>
      </div>
    </div>
  );
}

export function Hint() {
  return (
    <p className="da-hint">
      <span className="da-hint-mark" aria-hidden="true" />
      {islandStrings.globe.hint}
    </p>
  );
}

export interface IslandChipsProps {
  onOpen(id: string): void;
  /** The pointer or focus is on an island: a chance to fetch its map tiles ahead of the flight. */
  onIntent?(island: GlobeIsland): void;
}

/** One chip per island: participating ones first, then the ones still to come. */
export function IslandChips({ onOpen, onIntent }: IslandChipsProps) {
  const intent = (island: GlobeIsland) => (onIntent ? { onPointerEnter: () => onIntent(island), onFocus: () => onIntent(island), onTouchStart: () => onIntent(island) } : null);
  return (
    <ul className="da-chips" aria-label={aStrings.rail.label}>
      {LIVE_ISLANDS.map((item) => (
        <li key={item.id}>
          <button type="button" className="da-chip" data-status="live" onClick={() => onOpen(item.id)} {...intent(item)}>
            <span className="da-chip-dot" aria-hidden="true" />
            {item.name}
          </button>
        </li>
      ))}
      <li className="da-chips-label" aria-hidden="true">
        {aStrings.rail.soonLabel}
      </li>
      {COMING_SOON_ISLANDS.map((item) => (
        <li key={item.id} data-soon="">
          <button type="button" className="da-chip" data-status="coming-soon" onClick={() => onOpen(item.id)} {...intent(item)}>
            <span className="da-chip-dot" aria-hidden="true" />
            {item.name}
            <span className="da-chip-soon">{aStrings.rail.soon}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
