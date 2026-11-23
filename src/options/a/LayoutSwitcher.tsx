"use client";

/**
 * The floating "Layout" pill: switches between the layouts of the landing by name.
 *
 * Wide screens: a small segmented control in the top right corner. Phones: a compact button in
 * the same corner that opens the list (it has to stay small enough to clear the wordmark, however
 * many layouts there are). Either way it is a radio group: arrow keys move through the layouts.
 * The shell hides it on a phone while an island card is open, so it never sits on the card.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LAYOUT_IDS, optionStrings, type LayoutId } from "@/lib/options";
import { t } from "@/lib/strings";

const text = optionStrings.layouts;

/** A 16px pictogram of each arrangement. */
const GLYPHS: Record<LayoutId, string> = {
  split: "M2.500 3.500h4.200v9H2.500zM9 8a3.300 3.300 0 1 0 6.600 0A3.300 3.300 0 0 0 9 8Z",
  horizon: "M4.500 3.500h7M5.500 6h5M1 13.500c1.600-3.300 4.100-5 7-5s5.400 1.700 7 5",
  orb: "M4.500 2.500h7M5.500 5h5M8 7.400a3.300 3.300 0 1 0 0 6.600a3.300 3.300 0 0 0 0-6.600Z",
  // The map to every edge: a frame, the planet's limb crossing it, a card floating on the right.
  fullbleed: "M2 3.500h12v9H2zM2 10.300c2.300-2.800 5-4.100 8.200-4.100M11 8.200h1.800v2.600H11z",
};

export interface LayoutSwitcherProps {
  layout: LayoutId;
  onChange(layout: LayoutId): void;
  /** Out of the way (a phone with a card open). */
  hidden?: boolean;
}

export function LayoutSwitcher({ layout, onChange, hidden = false }: LayoutSwitcherProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  /** Announce a change, not the layout the page loaded with. */
  const [announced, setAnnounced] = useState<LayoutId | null>(null);

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (id: LayoutId) => {
    setOpen(false);
    if (id === layout) return;
    setAnnounced(id);
    onChange(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = LAYOUT_IDS.indexOf(layout);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % LAYOUT_IDS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + LAYOUT_IDS.length) % LAYOUT_IDS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = LAYOUT_IDS.length - 1;
    if (next < 0) return;
    // Keep the arrow keys away from the globe, which pans with them.
    e.preventDefault();
    e.stopPropagation();
    const id = LAYOUT_IDS[next];
    setAnnounced(id);
    onChange(id);
    items.current[next]?.focus();
  };

  return (
    <div ref={root} className="da-lay" data-open={open ? "" : undefined} data-hidden={hidden ? "" : undefined} inert={hidden ? true : undefined}>
      <button
        ref={toggle}
        type="button"
        className="da-lay-toggle"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t(text.choose, { name: text.fullNames[layout] })}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d={GLYPHS[layout]} fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{text.names[layout]}</span>
        <svg className="da-lay-caret" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path d="M2 3.800 5 6.800l3-3" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={listId} className="da-lay-group" role="radiogroup" aria-label={text.label} onKeyDown={onKeyDown}>
        <span className="da-lay-cap" aria-hidden="true">
          {text.label}
        </span>
        {LAYOUT_IDS.map((id, i) => (
          <button
            key={id}
            ref={(el) => {
              items.current[i] = el;
            }}
            type="button"
            role="radio"
            className="da-lay-item"
            aria-checked={layout === id}
            tabIndex={layout === id ? 0 : -1}
            onClick={() => choose(id)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d={GLYPHS[id]} fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* The full name in the list a phone opens; the short one in the pill on a wide screen. */}
            {text.fullNames[id] === text.names[id] ? (
              text.names[id]
            ) : (
              <>
                <span className="da-lay-full">{text.fullNames[id]}</span>
                <span className="da-lay-short" aria-hidden="true">
                  {text.names[id]}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      <span className="da-sr" role="status">
        {announced ? t(text.announce, { name: text.fullNames[announced] }) : ""}
      </span>
    </div>
  );
}
