"use client";

/**
 * A plain, working landing built only from the shared pieces: the globe, the search box, DOM
 * markers, a photo slot and the shared island selection. It is what options A, B and C render
 * until their own design replaces it, and a reference for how the pieces fit together:
 *
 *   - `useOption()` gives the palette and the selected island (shared by all three options)
 *   - `<Globe style={(base) => base.build(...)} selectedId autoRotate padding onSelect />`
 *   - `onArrive(id)` fires when the camera has come to rest on the selected island: open the card
 *   - `padding` tells the globe which part of the screen the card covers
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Globe, type GlobeHandle, type StyleInput } from "@/components/globe";
import { getIsland, islandStrings, isLive, type GlobeIsland } from "@/lib/islands";
import { useOption } from "@/lib/options";
import { strings } from "@/lib/strings";
import { IslandSearch } from "./IslandSearch";
import { Photo } from "./Photo";
import "./starter.css";

export interface StarterLandingProps {
  /** Shaded relief under the land, 0 to 1. */
  relief?: number;
  /** How many place names the base map shows. */
  labels?: "none" | "minimal" | "full";
  /** Spin in degrees per second. */
  spin?: number;
}

const WIDE = "(min-width: 900px)";

function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

function useViewportHeight(): number {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    () => window.innerHeight,
    () => 844,
  );
}

export function StarterLanding({ relief = 0.5, labels = "minimal", spin = 7 }: StarterLandingProps) {
  const { palette, selectedIslandId, selectIsland } = useOption();
  const globe = useRef<GlobeHandle>(null);
  const wide = useWide();
  const viewportHeight = useViewportHeight();
  const island = getIsland(selectedIslandId);
  /** The card opens when the camera arrives, not when the island is chosen. */
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // A stable style function: a new one would restyle the map.
  const style = useMemo<StyleInput>(
    () => (base) =>
      base.build(base.paletteFromOption(palette), {
        relief,
        labels,
        islands: base.islandColorsFromOption(palette),
      }),
    [palette, relief, labels],
  );

  const padding = useMemo(() => {
    if (!island) return wide ? { top: 40 } : { top: 120, bottom: 40 };
    return wide ? { left: 452 } : { top: 124, bottom: Math.round(viewportHeight * 0.44) };
  }, [island, wide, viewportHeight]);

  const open = useCallback(
    (id: string) => {
      setCardFor(null);
      selectIsland(id);
      // Also ask for the flight directly: a search for the island that is already selected
      // (after the visitor has dragged away) should still fly back to it.
      void globe.current?.flyToIsland(id);
    },
    [selectIsland],
  );

  const close = useCallback(() => {
    setCardFor(null);
    selectIsland(null);
    void globe.current?.resetView();
  }, [selectIsland]);

  // The card opens when the camera has arrived, however it got there: a flight, a shared link,
  // an option switch that found the camera already on the island, or no map at all.
  const onArrive = useCallback((id: string) => setCardFor(id), []);

  const share = useCallback(async (target: GlobeIsland) => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${target.name} · ${strings.app.name}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* The visitor closed the share sheet, or the clipboard is blocked. Nothing to do. */
    }
  }, []);

  const cardOpen = Boolean(island && cardFor === island.id);

  // On a phone the A · B · C switcher sits bottom-left, where the sheet is: lift it above the sheet.
  useEffect(() => {
    const el = document.documentElement;
    if (island && !wide) el.style.setProperty("--opt-switch-lift", "calc(44dvh + 4px)");
    else el.style.removeProperty("--opt-switch-lift");
    return () => {
      el.style.removeProperty("--opt-switch-lift");
    };
  }, [island, wide]);

  return (
    <main className="osl" data-card={cardOpen ? "" : undefined} data-selected={island ? "" : undefined}>
      <Globe
        ref={globe}
        className="osl-globe"
        style={style}
        selectedId={selectedIslandId}
        onSelect={open}
        onArrive={onArrive}
        autoRotate={spin}
        padding={padding}
        globeSize={wide ? 0.84 : 1.04}
        renderMarker={(target, state) => (state.live ? <span className="osl-pulse" data-selected={state.selected} /> : null)}
      />

      <header className="osl-top">
        <div className="osl-brand">
          <span className="osl-wordmark">{strings.app.name}</span>
          <span className="osl-sample">{islandStrings.sample.tag}</span>
        </div>
        <IslandSearch className="osl-search" onSelect={(target) => open(target.id)} />
      </header>

      {!island ? <p className="osl-hint">{islandStrings.globe.hint}</p> : null}

      {island ? (
        <section className="osl-card" aria-label={island.name} data-open={cardOpen ? "" : undefined}>
          <button type="button" className="osl-close" onClick={close} aria-label={islandStrings.globe.reset}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <p className="osl-status" data-status={island.status}>
            {islandStrings.status[island.status]}
          </p>
          <h1 className="osl-name">{island.name}</h1>
          <p className="osl-place">
            {island.region === island.country ? island.country : `${island.region}, ${island.country}`}
          </p>
          <p className="osl-tagline">{isLive(island) ? island.card.description.headline : island.teaser}</p>
          {isLive(island) ? (
            <>
              <Photo className="osl-photo" name={island.card.hero.name} alt={island.card.hero.alt} aspect={16 / 9} sizes="(min-width: 900px) 380px, 92vw" priority />
              <div className="osl-actions">
                <Link className="osl-cta" href="/passport">
                  {islandStrings.card.cta.collect}
                </Link>
                <button type="button" className="osl-ghost" onClick={() => void share(island)}>
                  {copied ? "Link copied" : islandStrings.card.cta.share}
                </button>
              </div>
              <p className="osl-note">{islandStrings.sample.noDonations}</p>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
