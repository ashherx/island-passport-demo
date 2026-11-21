"use client";

/**
 * Option C: "Modern Editorial".
 *
 * A magazine cover built around a halftone globe: near-white page, ink type, one ultramarine
 * accent. The continents are a field of fine dots that dissolves into a crisp monochrome map as
 * the camera comes down; participating islands are the only colour.
 *
 * The sequence (see docs/agents/v2-option-c.md):
 *   home    globe spins, cover line, search, numbered index of islands
 *   flight  search / tap / index -> the cover line gives way to an "en route" slug with the
 *           island's name and live coordinates while the globe turns and dives
 *   card    the camera lands (onArrive) -> the island pings, the card rises (bottom sheet on a
 *           phone, panel on a desktop), its name comes up out of a mask and the figures count up
 *   close   Escape, the close button, the browser's Back, or dragging the sheet away: the card
 *           leaves, the camera flies back out and the spin resumes
 */
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Globe, type GlobeHandle } from "@/components/globe";
import { COMING_SOON_ISLANDS, ISLANDS, LIVE_ISLANDS, getIsland, islandStrings, isLive, type GlobeIsland } from "@/lib/islands";
import { useOption } from "@/lib/options";
import { strings, t } from "@/lib/strings";
import { optionCStyle } from "./map-style";
import { Panel, type CardView, type Snap, type SnapHeights } from "./Panel";
import { PhotoStage } from "./PhotoStage";
import { Search, type SearchHandle } from "./Search";
import { photosOf } from "./sections";
import { cStrings } from "./strings";
import { Rise, formatCoordinates, pad2, useReducedMotion, useViewportHeight, useWide } from "./ui";
import "./option-c.css";

/** Width of the left column on a desktop: the cover copy, then the card. */
const COLUMN = 480;
const COUNTRIES = new Set(ISLANDS.map((island) => island.countryCode)).size;

export default function LandingC() {
  const { selectedIslandId, selectIsland } = useOption();
  const wide = useWide();
  const viewportHeight = useViewportHeight();
  const reducedMotion = useReducedMotion();

  const globe = useRef<GlobeHandle>(null);
  const search = useRef<SearchHandle>(null);
  const root = useRef<HTMLElement>(null);
  const coords = useRef<HTMLSpanElement>(null);
  const flightCoords = useRef<HTMLSpanElement>(null);

  const island = getIsland(selectedIslandId);
  /** The card opens when the camera arrives, not when the island is chosen. */
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("half");
  const [view, setView] = useState<CardView>("map");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const cardOpen = Boolean(island && cardFor === island.id);
  const phase: "home" | "flight" | "card" = !island ? "home" : cardOpen ? "card" : "flight";
  const photos = useMemo(() => (isLive(island) ? photosOf(island) : []), [island]);
  const showPhotos = cardOpen && view === "photos" && photos.length > 0;

  /** Latest values for callbacks that the globe keeps hold of. */
  const selected = useRef(selectedIslandId);
  selected.current = selectedIslandId;
  /** What had focus when the card was opened, to give it back on close. */
  const opener = useRef<HTMLElement | null>(null);
  /** True while this landing has put an entry on the history stack for the open island. */
  const pushed = useRef(false);

  /* ----------------------------------------------------------- geometry */

  const heights = useMemo<SnapHeights>(() => {
    const live = isLive(island);
    return {
      peek: 176,
      half: live ? Math.round(viewportHeight * 0.56) : Math.min(Math.round(viewportHeight * 0.66), 560),
      full: viewportHeight,
    };
  }, [island, viewportHeight]);

  const sheetHeight = snap === "peek" ? heights.peek : heights.half;

  const padding = useMemo(() => {
    if (wide) return { left: COLUMN };
    if (!island) return { top: 262, bottom: 140 };
    return { top: 124, bottom: sheetHeight };
  }, [wide, island, sheetHeight]);

  /* ------------------------------------------------------ open and close */

  const open = useCallback(
    (id: string) => {
      if (id !== selected.current) {
        setCardFor(null);
        setView("map");
        setPhotoIndex(0);
        setSnap("half");
        const active = document.activeElement;
        if (!selected.current) opener.current = active instanceof HTMLElement ? active : null;
        // One history entry per open card, so the browser's Back button closes it (most visitors
        // arrive in an in-app browser, where Back is the only navigation there is).
        if (!selected.current && !pushed.current) {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("option", "c");
            url.searchParams.set("island", id);
            window.history.pushState(null, "", url.pathname + url.search + url.hash);
            pushed.current = true;
          } catch {
            /* A sandboxed frame can refuse history writes. Closing still works without it. */
          }
        }
        selectIsland(id);
      }
      // Ask for the flight directly as well: picking the island that is already open (after
      // dragging the map away) should still fly back to it.
      void globe.current?.flyToIsland(id, { speed: 0.92 });
    },
    [selectIsland],
  );

  const close = useCallback(() => {
    if (pushed.current) {
      // Leave through the history entry we added; the provider clears the selection on popstate.
      pushed.current = false;
      window.history.back();
    } else selectIsland(null);
  }, [selectIsland]);

  // The selection changed, by us or from outside (Back/Forward, a shared link, an option switch).
  const previous = useRef(selectedIslandId);
  useEffect(() => {
    const before = previous.current;
    previous.current = selectedIslandId;
    if (before === selectedIslandId) return;
    // Keep a card that has already been told to open for this island (reduced motion and the
    // no-WebGL fallback "arrive" at once, before this effect runs).
    setCardFor((current) => (current === selectedIslandId ? current : null));
    if (selectedIslandId) return;
    pushed.current = false;
    setView("map");
    void globe.current?.resetView({ speed: 0.86 });
    // Give focus back to where the visitor was, but never to a text field: on a phone that
    // would bring the keyboard up over the globe.
    const target = opener.current;
    opener.current = null;
    if (target && target.isConnected && target.tagName !== "INPUT") target.focus({ preventScroll: true });
    else globe.current?.map()?.getCanvas().focus({ preventScroll: true });
  }, [selectedIslandId]);

  const onArrive = useCallback((id: string) => {
    if (id === selected.current) setCardFor(id);
  }, []);

  // The visitor grabbed the globe mid-flight: let them steer, and offer the card small.
  const onFlightEnd = useCallback((id: string | null, completed: boolean) => {
    if (completed || !id || id !== selected.current) return;
    setSnap("peek");
    setCardFor(id);
  }, []);

  /* ----------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (showPhotos) setView("map");
      else if (selected.current) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, showPhotos]);

  // The option provider drops data-option from <html> on popstate and only restores it when the
  // option or the island changed. Put it back if a Back press changed neither.
  useEffect(() => {
    const onPop = () =>
      window.setTimeout(() => {
        const html = document.documentElement;
        if (!html.hasAttribute("data-option")) html.setAttribute("data-option", "c");
      }, 0);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The A · B · C switcher sits bottom-left on a phone: keep it clear of the sheet.
  useEffect(() => {
    const html = document.documentElement;
    if (wide || !cardOpen) html.style.removeProperty("--opt-switch-lift");
    else html.style.setProperty("--opt-switch-lift", snap === "full" && isLive(island) ? "110vh" : `${sheetHeight + 4}px`);
    return () => {
      html.style.removeProperty("--opt-switch-lift");
    };
  }, [wide, cardOpen, snap, sheetHeight, island]);

  /* ------------------------------------------------- coordinates readout */

  const onReady = useCallback((map: MapLibreMap) => {
    let last = 0;
    const write = () => {
      const now = performance.now();
      if (now - last < 90) return;
      last = now;
      const centre = map.getCenter();
      const text = formatCoordinates(centre.lng, centre.lat);
      if (coords.current) coords.current.textContent = text;
      if (flightCoords.current) flightCoords.current.textContent = text;
    };
    map.on("move", write);
    write();
  }, []);

  /* --------------------------------------------------------------- share */

  const share = useCallback(async () => {
    const target = getIsland(selected.current);
    if (!target) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: t(cStrings.card.shareTitle, { name: target.name }), url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* The visitor closed the share sheet, or the clipboard is blocked. Nothing to do. */
    }
  }, []);

  const onView = useCallback(
    (next: CardView) => {
      setView(next);
      // A full-height sheet covers the stage: come down so the map or the photo can be seen.
      if (!wide) setSnap((current) => (current === "full" ? "half" : current));
    },
    [wide],
  );

  const onPhoto = useCallback(
    (index: number) => {
      setPhotoIndex(index);
      onView("photos");
    },
    [onView],
  );

  /* -------------------------------------------------------------- render */

  const renderMarker = useCallback(
    (target: GlobeIsland, state: { selected: boolean; live: boolean }) => (state.live ? <span className="oc-pin" data-selected={state.selected ? "" : undefined} /> : null),
    [],
  );

  const vars = {
    "--oc-column": `${COLUMN}px`,
    "--oc-sheet": `${sheetHeight}px`,
    // The static poster draws its land with this: the same halftone as the live globe.
    "--globe-land": "url(#oc-halftone)",
  } as CSSProperties;

  const place = island ? (island.region === island.country ? island.country : `${island.region}, ${island.country}`) : "";

  return (
    <MotionConfig reducedMotion="user">
      <main ref={root} className="oc" data-phase={phase} data-wide={wide ? "" : undefined} data-view={showPhotos ? "photos" : "map"} style={vars}>
        {/* Halftone for the static first paint (the poster's land is filled with it). */}
        <svg className="oc-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <defs>
            <pattern id="oc-halftone" width="0.034" height="0.03" patternUnits="userSpaceOnUse">
              <circle cx="0.0085" cy="0.0075" r="0.0052" />
              <circle cx="0.0255" cy="0.0225" r="0.0052" />
            </pattern>
          </defs>
        </svg>

        <Globe
          ref={globe}
          className="oc-globe"
          style={optionCStyle}
          selectedId={selectedIslandId}
          onSelect={open}
          onArrive={onArrive}
          onFlightEnd={onFlightEnd}
          onReady={onReady}
          autoRotate={6.5}
          rotateResumeMs={4500}
          padding={padding}
          globeSize={wide ? 0.84 : 1.1}
          renderMarker={renderMarker}
        >
          <div className="oc-rim" aria-hidden="true" />
        </Globe>

        <AnimatePresence>
          {showPhotos && island ? (
            <PhotoStage key="stage" name={island.name} photos={photos} index={photoIndex} onIndex={setPhotoIndex} onBackToMap={() => setView("map")} />
          ) : null}
        </AnimatePresence>

        <header className="oc-top">
          <p className="oc-brand">
            <span className="oc-brand-mark" aria-hidden="true" />
            {strings.app.name}
          </p>
          <span className="oc-tag oc-top-tag" title={islandStrings.sample.notice}>
            {islandStrings.sample.tag}
          </span>
        </header>

        <div className="oc-search-slot">
          <Search ref={search} onSelect={(target) => open(target.id)} shortcut={wide} />
        </div>

        {/* The cover slot: the headline at home, the "en route" slug in flight, nothing over the map. */}
        <AnimatePresence initial={false}>
          {phase === "home" ? (
            <motion.div key="cover" className="oc-cover" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22, ease: "easeIn" }}>
              <h1 className="oc-headline">
                <Rise as="div">{cStrings.cover.lead}</Rise>
                <Rise as="div" index={1} className="oc-headline-accent">
                  {cStrings.cover.follow}
                </Rise>
              </h1>
              <p className="oc-cover-sub">{cStrings.cover.sub}</p>
              <dl className="oc-cover-stats">
                <div>
                  <dd>{pad2(LIVE_ISLANDS.length)}</dd>
                  <dt>{cStrings.cover.open}</dt>
                </div>
                <div>
                  <dd>{pad2(COMING_SOON_ISLANDS.length)}</dd>
                  <dt>{cStrings.cover.soon}</dt>
                </div>
                <div>
                  <dd>{pad2(COUNTRIES)}</dd>
                  <dt>{cStrings.cover.countries}</dt>
                </div>
              </dl>
            </motion.div>
          ) : null}
          {phase === "flight" && island ? (
            <motion.div key={`flight-${island.id}`} className="oc-flight" role="status" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <p className="oc-flight-kicker">
                <span className="oc-flight-dot" aria-hidden="true" />
                {cStrings.flight.kicker}
                <span className="oc-flight-coords" ref={flightCoords} aria-hidden="true" />
              </p>
              <p className="oc-flight-name">
                <Rise>{island.name}</Rise>
              </p>
              <p className="oc-flight-place">
                <Rise index={1}>{place}</Rise>
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Index: every island, numbered. A second way in for anyone who would rather not spin. */}
        <nav className="oc-index" aria-label={cStrings.index.title} inert={phase !== "home"}>
          <p className="oc-index-label" aria-hidden="true">
            {cStrings.index.label}
          </p>
          <ol className="oc-index-list">
            {ISLANDS.map((target, i) => (
              <li key={target.id}>
                <button type="button" className="oc-index-item" data-live={target.status === "live"} onClick={() => open(target.id)}>
                  <span className="oc-index-no" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                  <span className="oc-index-name">{target.name}</span>
                  <span className="oc-index-status">
                    <span className="oc-index-dot" aria-hidden="true" />
                    <span className="oc-index-status-text">{islandStrings.status[target.status]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="oc-foot-row" aria-hidden={phase !== "home"}>
          <p className="oc-hint">{islandStrings.globe.hint}</p>
          <p className="oc-coords" aria-hidden="true">
            <span ref={coords} />
          </p>
        </div>

        <AnimatePresence>
          {cardOpen && island ? (
            <Panel
              key={`${island.id}-${wide ? "wide" : "sheet"}`}
              island={island}
              wide={wide}
              heights={heights}
              snap={snap}
              onSnap={setSnap}
              view={showPhotos ? "photos" : "map"}
              onView={onView}
              onPhoto={onPhoto}
              onClose={close}
              onOpenIsland={open}
              onShare={() => void share()}
              copied={copied}
            />
          ) : null}
        </AnimatePresence>

        {/* Screen readers hear the landing even with reduced motion, where nothing moves. */}
        <p className="oc-sr" role="status">
          {cardOpen && island ? t(cStrings.flight.arrived, { name: island.name }) : ""}
        </p>
        {reducedMotion ? null : <span className="oc-motion-ok" hidden />}
      </main>
    </MotionConfig>
  );
}
