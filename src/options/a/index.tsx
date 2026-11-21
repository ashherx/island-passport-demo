"use client";

/**
 * Option A: "Daylight Atlas".
 *
 * A bright, airy travel atlas: pale sky sea, cream land, turquoise islands, a serif wordmark.
 * The signature sequence is choreographed here:
 *
 *   spin  ->  search, tap or chip  ->  the card's name plate rises while the globe turns and
 *   dives  ->  the island blooms as the camera lands  ->  the card springs open and its content
 *   staggers in.  Escape, the close button and the browser's Back fly back out to the spin.
 *
 * Phases (data-phase on the root): "idle" (the landing), "flying" (an island is chosen, the
 * camera is on its way), "landed" (the card is open). The island itself lives in useOption(), so
 * it survives a switch between options A, B and C and is mirrored in the URL.
 *
 * Handoff notes: docs/agents/v2-option-a.md
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Globe, type GlobeHandle } from "@/components/globe";
import { COMING_SOON_ISLANDS, LIVE_ISLANDS, getIsland, hasPhoto, islandStrings, isLive, type GlobeIsland } from "@/lib/islands";
import { useOption } from "@/lib/options";
import { strings, t } from "@/lib/strings";
import { CardActions, CardBody, CardHead, SoonBody, type CardView } from "./Card";
import { fontClass } from "./fonts";
import { useHeight, useLinger, useReducedMotion, useViewportHeight, useViewportWidth, useWide } from "./hooks";
import { PhotoStage } from "./PhotoStage";
import { warmTiles } from "./prefetch";
import { Search, type SearchHandle } from "./Search";
import { Sheet, type Snap } from "./Sheet";
import { aStrings } from "./strings";
import { BLOOM_CORE_LAYER, BLOOM_LAYER, atlasStyle, outlineSourceId } from "./style";
import { installAura } from "./aura";
import { Ring } from "./viz";
import { Photo } from "@/components/options-ui";
import "./atlas.css";

/* Layout numbers shared with atlas.css (see the matching custom properties there). */
const HEAD_H = 118; // sheet: grab bar + name plate
const TABS_H = 54; // sheet: the row of section tabs under the photo
const CTA_H = 76; // sheet: the fixed action bar
const SEARCH_TOP = 10;
const SEARCH_H = 52;
const RAIL_H = 136; // phone landing: hint + island chips + the row the option switcher sits in
const PANEL_X = 24;
const PANEL_W = 448;
const SOON_HALF = 388;

/** Slower than the engine's default: this option's flight is a long, calm dive. */
const FLIGHT_SPEED = 1.22;
const SPIN_DEG_PER_S = 5;
/** The card follows the island's glow by this much. */
const CARD_AFTER_GLOW_MS = 320;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function Brand({ className }: { className: string }) {
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

/** Bottom safe-area inset in px (the home indicator), read once from CSS. */
function useSafeBottom(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(probe);
    setInset(Math.round(parseFloat(getComputedStyle(probe).paddingBottom) || 0));
    probe.remove();
  }, []);
  return inset;
}

export default function LandingA() {
  const { selectedIslandId, selectIsland } = useOption();
  const globe = useRef<GlobeHandle>(null);
  const searchRef = useRef<SearchHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const wide = useWide();
  const vh = useViewportHeight();
  const vw = useViewportWidth();
  const reduced = useReducedMotion();
  const safeBottom = useSafeBottom();
  const introH = useHeight(introRef, 206);

  const island = getIsland(selectedIslandId) ?? null;
  /** The card opens when the camera arrives, not when the island is chosen. */
  const [cardFor, setCardFor] = useState<string | null>(null);
  /** The camera is at rest on this island (set a moment before the card opens). */
  const [arrivedFor, setArrivedFor] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("peek");
  const [view, setView] = useState<CardView>("map");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  /** The demo's A · B · C switcher shares the bottom-left corner; the lab route has none. */
  /** An island has been opened at least once: the landing then "returns" instead of entering. */
  const [returned, setReturned] = useState(false);
  const [hasSwitcher, setHasSwitcher] = useState(true);
  /** False in the server's HTML: until then CSS supplies the desktop layout's globe position. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHasSwitcher(Boolean(document.querySelector(".opt-switch")));
    setHydrated(true);
  }, []);

  const landed = Boolean(island && cardFor === island.id);
  const glowing = Boolean(island && (arrivedFor === island.id || landed));
  const phase = !island ? "idle" : landed ? "landed" : "flying";
  const live = isLive(island);

  /* -------------------------------------------------------------- sizes */

  const heights = useMemo<Record<Snap, number>>(() => {
    const photo = clamp(Math.round(vh * 0.25), 128, 224);
    const full = Math.max(320, vh - (SEARCH_TOP + SEARCH_H + 10));
    return {
      peek: HEAD_H + safeBottom,
      half: Math.min(full, live || !island ? HEAD_H + photo + TABS_H + CTA_H + safeBottom : SOON_HALF + safeBottom),
      full,
    };
  }, [vh, live, island, safeBottom]);
  const snaps = useMemo<readonly Snap[]>(() => (live ? ["peek", "half", "full"] : ["peek", "half"]), [live]);
  const shownSnap: Snap = !landed ? "peek" : snap === "full" && !live ? "half" : snap;
  /** How much of the screen the sheet covers as far as the map is concerned. */
  const sheetCover = landed && shownSnap === "peek" ? heights.peek : heights.half;

  const padding = useMemo(() => {
    if (wide) {
      if (island) return { left: PANEL_X + PANEL_W + 24, top: 28, right: 24, bottom: 28 };
      return { left: Math.round(clamp(vw * 0.46, 560, 720)), top: 24, right: 0, bottom: 24 };
    }
    if (island) return { top: SEARCH_TOP + SEARCH_H + 12, bottom: sheetCover };
    return { top: SEARCH_TOP + introH + 12 + SEARCH_H + 10, bottom: RAIL_H };
  }, [wide, island, vw, sheetCover, introH]);

  /* ------------------------------------------------------ open and close */

  const selectedRef = useRef(selectedIslandId);
  selectedRef.current = selectedIslandId;
  const cardRef = useRef(cardFor);
  cardRef.current = cardFor;
  /** Element to give focus back to when the card closes. */
  const opener = useRef<HTMLElement | null>(null);
  /** True while a history entry of ours sits under the open card, so Back closes it. */
  const pushed = useRef(false);
  /** Delays the card a beat behind the island's glow. */
  const arriveTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(arriveTimer.current), []);

  const open = useCallback(
    (id: string) => {
      if (!getIsland(id)) return;
      const again = selectedRef.current === id && cardRef.current === id;
      if (!again) {
        const active = document.activeElement;
        if (!selectedRef.current) opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
        window.clearTimeout(arriveTimer.current);
        setCardFor(null);
        setArrivedFor(null);
        setView("map");
        setPhotoIndex(0);
        // Back should return to the globe rather than leave the page: give the globe its own
        // history entry the first time an island is opened. (The provider then rewrites the
        // current entry's URL to carry ?island=.)
        if (!selectedRef.current && !pushed.current) {
          try {
            window.history.pushState(window.history.state, "", window.location.href);
            pushed.current = true;
          } catch {
            /* A sandboxed frame can refuse history writes. Close still works. */
          }
        }
      }
      // A phone's keyboard should not stay up over the flight.
      if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
      setReturned(true);
      const target = getIsland(id);
      if (target) warmTiles(globe.current?.map() ?? null, target);
      selectIsland(id);
      // Ask for the flight directly as well: only this re-centres an island that is already selected.
      void globe.current?.flyToIsland(id, { speed: FLIGHT_SPEED });
    },
    [selectIsland],
  );

  const close = useCallback(() => {
    if (!selectedRef.current) return;
    if (pushed.current) {
      // Our entry is on top: going back hands the selection (now none) to the provider.
      pushed.current = false;
      window.history.back();
    } else selectIsland(null);
  }, [selectIsland]);

  // The selection can also change without us: Back and Forward, a shared link, an option switch.
  const previous = useRef(selectedIslandId);
  useEffect(() => {
    const before = previous.current;
    previous.current = selectedIslandId;
    if (before === selectedIslandId) return;
    if (!selectedIslandId) {
      pushed.current = false;
      window.clearTimeout(arriveTimer.current);
      setCardFor(null);
      setArrivedFor(null);
      setView("map");
      void globe.current?.resetView({ speed: 0.92 });
      const back = opener.current;
      opener.current = null;
      // Give focus back to what opened the card (not to a text field on a phone: that would
      // bring the keyboard up).
      if (!back?.isConnected) return;
      if (searchRef.current?.owns(back)) {
        if (window.matchMedia?.("(hover: hover)").matches) searchRef.current.focusQuietly();
      } else back.focus({ preventScroll: true });
    } else {
      setView("map");
      setPhotoIndex(0);
    }
  }, [selectedIslandId]);

  // Landing, in two beats: the island's glow blooms the moment the camera comes to rest, and the
  // card rises a breath later.
  const onArrive = useCallback(
    (id: string) => {
      if (cardRef.current === id) return;
      window.clearTimeout(arriveTimer.current);
      setArrivedFor(id);
      const show = () => {
        if (selectedRef.current !== id) return;
        setCardFor(id);
        setSnap("half");
      };
      if (reduced) show();
      else arriveTimer.current = window.setTimeout(show, CARD_AFTER_GLOW_MS);
    },
    [reduced],
  );

  // A flight the visitor interrupted never "arrives". Open the card anyway (small, on a phone),
  // so an island is never left selected with nothing to show for it.
  const inFlight = useRef(false);
  const onFlightStart = useCallback(() => {
    inFlight.current = true;
  }, []);
  const onFlightEnd = useCallback((id: string | null, completed: boolean) => {
    inFlight.current = false;
    if (completed || !id) return;
    window.setTimeout(() => {
      if (inFlight.current || selectedRef.current !== id || cardRef.current === id) return;
      setCardFor(id);
      setSnap("peek");
    }, 120);
  }, []);

  /* --------------------------------------------------- the island's bloom */

  const bloomTimer = useRef(0);
  const syncBloom = useCallback((landedNow: boolean) => {
    const map = globe.current?.map();
    if (!map) return;
    window.clearTimeout(bloomTimer.current);
    const id = selectedRef.current ?? "";
    const set = (layer: string, opacity: number, filter: boolean) => {
      try {
        if (!map.getLayer(layer)) return;
        if (filter) map.setFilter(layer, ["==", ["get", "id"], id]);
        map.setPaintProperty(layer, "line-opacity", opacity);
      } catch {
        /* The style is not ready or was replaced; the next sync catches up. */
      }
    };
    // Swell as the camera lands, then settle to a steady glow.
    set(BLOOM_LAYER, landedNow ? 1 : 0, true);
    set(BLOOM_CORE_LAYER, landedNow ? 0.95 : 0, true);
    if (landedNow) {
      bloomTimer.current = window.setTimeout(() => {
        set(BLOOM_LAYER, 0.46, false);
        set(BLOOM_CORE_LAYER, 0.6, false);
      }, 1300);
    }
  }, []);
  const landedRef = useRef(glowing);
  landedRef.current = glowing;
  useEffect(() => {
    syncBloom(glowing);
    return () => window.clearTimeout(bloomTimer.current);
  }, [selectedIslandId, glowing, syncBloom]);
  const onReady = useCallback(
    (map: MapLibreMap) => {
      syncBloom(landedRef.current);
      void installAura(map, outlineSourceId()).then((added) => {
        if (added) syncBloom(landedRef.current);
      });
      if (process.env.NODE_ENV !== "production") (window as unknown as { __daMap?: MapLibreMap }).__daMap = map;
    },
    [syncBloom],
  );

  /* ------------------------------------------------------ focus and keys */

  // When the card opens, move focus to the dialog itself. It is labelled by the island's name, so
  // a screen reader starts there, and the next Tab goes to the card's first control.
  useEffect(() => {
    if (!landed) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    headingRef.current?.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true });
  }, [landed, island?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !selectedRef.current) return;
      if (view === "photos") setView("map");
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, view]);

  /* ------------------------------------------------------------ actions */

  const copiedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  const share = useCallback(async () => {
    const target = getIsland(selectedRef.current);
    if (!target) return;
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function" && window.matchMedia?.("(hover: none)").matches) {
        await navigator.share({ title: t(aStrings.share.title, { name: target.name }), url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* The visitor closed the share sheet, or the clipboard is blocked. Nothing to do. */
    }
  }, []);

  const changeView = useCallback(
    (next: CardView) => {
      setView(next);
      // On a phone the photos show above the sheet: make room if it is fully open.
      if (next === "photos") setSnap((s) => (s === "full" ? "half" : s));
    },
    [],
  );

  const openPhoto = useCallback(
    (index: number) => {
      setPhotoIndex(index);
      changeView("photos");
    },
    [changeView],
  );

  // The A · B · C switcher sits bottom-left on a phone: keep it clear of the sheet. With the
  // action bar showing it tucks into the bar's left end.
  const ctaShown = !wide && landed && live && shownSnap !== "peek";
  useEffect(() => {
    const el = document.documentElement;
    if (wide || !island) el.style.removeProperty("--opt-switch-lift");
    else if (ctaShown) el.style.setProperty("--opt-switch-lift", "8px");
    else el.style.setProperty("--opt-switch-lift", `${(shownSnap === "peek" ? heights.peek : heights.half) - safeBottom + 8}px`);
    return () => {
      el.style.removeProperty("--opt-switch-lift");
    };
  }, [wide, island, ctaShown, shownSnap, heights, safeBottom]);

  /* -------------------------------------------------------------- render */

  // The card lingers for its exit animation after the selection is cleared.
  const { shown: cardIsland, leaving } = useLinger<GlobeIsland>(island, 520);
  const cardLive = isLive(cardIsland) ? cardIsland : null;
  const photosOn = view === "photos" && landed && Boolean(cardLive);
  // The card's long body is rendered at low priority, a moment after the island is chosen:
  // mounting it in the same frame as the tap would stall the first frames of the flight.
  const bodyFor = useDeferredValue(cardLive?.id ?? null);
  const bodyReady = Boolean(cardLive) && bodyFor === cardLive?.id;
  const expand = useCallback(() => setSnap("full"), []);

  const rootStyle = {
    "--da-sheet-cover": `${sheetCover}px`,
    "--da-photo-h": `${clamp(Math.round(vh * 0.25), 128, 224)}px`,
    "--da-intro-h": `${introH}px`,
  } as CSSProperties;

  const cardHead = cardIsland ? (
    <CardHead island={cardIsland} headingId={headingId} headingRef={headingRef} view={view} onView={changeView} onClose={close} flying={!landed && !leaving} />
  ) : null;

  const cardScroll = cardIsland ? (
    <div className="da-scroll" data-scroller="" ref={scrollerRef} tabIndex={-1}>
      {cardLive ? (
        <>
          <div className="da-hero da-rise" data-empty={hasPhoto(cardLive.card.hero.name) ? undefined : ""} style={{ "--i": 0 } as CSSProperties}>
            <Photo name={cardLive.card.hero.name} alt={cardLive.card.hero.alt} aspect="fill" sizes="(min-width: 900px) 420px, 94vw" priority position="50% 60%" />
            <ul className="da-glance" aria-label={aStrings.card.facts}>
              <li>
                <Ring value={cardLive.card.reef.healthIndex.value} max={cardLive.card.reef.healthIndex.max} size={18} stroke={3} label="" tone="light" />
                {t(aStrings.glance.reef, { value: cardLive.card.reef.healthIndex.value })}
              </li>
              <li>{t(aStrings.glance.species, { n: cardLive.card.species.length })}</li>
              <li>{t(aStrings.glance.stamps, { n: cardLive.card.partners.length })}</li>
            </ul>
            <span className="da-hero-caption">{cardLive.card.hero.caption}</span>
            <span className="da-hero-sample">{islandStrings.sample.photo}</span>
          </div>
          {bodyReady ? <CardBody island={cardLive} scrollerRef={scrollerRef} onOpenPhoto={openPhoto} expanded={wide || shownSnap === "full"} onExpand={expand} /> : null}
        </>
      ) : cardIsland.status === "coming-soon" ? (
        <SoonBody island={cardIsland} onOpenIsland={open} />
      ) : null}
    </div>
  ) : null;

  return (
    <main className={`da ${fontClass}`} data-phase={phase} data-wide={wide ? "" : undefined} data-view={photosOn ? "photos" : "map"} data-live={live ? "" : undefined} data-switcher={hasSwitcher ? "" : undefined} data-returned={returned ? "" : undefined} data-hydrated={hydrated ? "" : undefined} style={rootStyle}>
      <div className="da-sky" aria-hidden="true" />

      {/* Words and search come first in the document, so they come first for a keyboard. */}
      <Brand className="da-brand da-brand-bar" />

      <div className="da-top">
        <div className="da-intro" aria-hidden={island ? true : undefined}>
          <div className="da-intro-clip">
            <div className="da-intro-content" ref={introRef}>
              <Brand className="da-brand da-brand-intro" />
              <h1 className="da-title">
                {aStrings.hero.title} <em>{aStrings.hero.accent}</em>
              </h1>
              <p className="da-sub">{aStrings.hero.body}</p>
            </div>
          </div>
        </div>
        <Search ref={searchRef} onSelect={(target) => open(target.id)} current={island?.name ?? null} />

        {/* Phone: pinned to the bottom of the screen. Desktop: under the search, in the column. */}
        <div className="da-rail" inert={island ? true : undefined}>
          <p className="da-hint">
            <span className="da-hint-mark" aria-hidden="true" />
            {islandStrings.globe.hint}
          </p>
          <ul className="da-chips" aria-label={aStrings.rail.label}>
            {LIVE_ISLANDS.map((item) => (
              <li key={item.id}>
                <button type="button" className="da-chip" data-status="live" onClick={() => open(item.id)}>
                  <span className="da-chip-dot" aria-hidden="true" />
                  {item.name}
                </button>
              </li>
            ))}
            <li className="da-chips-label" aria-hidden="true">
              {aStrings.rail.soonLabel}
            </li>
            {COMING_SOON_ISLANDS.map((item) => (
              <li key={item.id}>
                <button type="button" className="da-chip" data-status="coming-soon" onClick={() => open(item.id)}>
                  <span className="da-chip-dot" aria-hidden="true" />
                  {item.name}
                  <span className="da-chip-soon">{aStrings.rail.soon}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>


      <Globe
        ref={globe}
        className="da-globe"
        style={atlasStyle}
        selectedId={selectedIslandId}
        onSelect={open}
        onArrive={onArrive}
        onFlightStart={onFlightStart}
        onFlightEnd={onFlightEnd}
        onReady={onReady}
        autoRotate={SPIN_DEG_PER_S}
        rotateResumeMs={4200}
        padding={padding}
        globeSize={wide ? 1 : 0.96}
        renderMarker={(target, state) => <span className="da-beacon" data-live={state.live} />}
      >
        <div className="da-depth" aria-hidden="true" />
        <div className="da-air" aria-hidden="true" />
      </Globe>

      {cardLive && bodyReady ? <PhotoStage island={cardLive} active={photosOn} index={photoIndex} onIndex={setPhotoIndex} /> : null}

      {cardIsland && !wide ? (
        <>
          <Sheet
            key="sheet"
            heights={heights}
            snaps={snaps}
            snap={shownSnap}
            onSnap={(next) => {
              setSnap(next);
              // Dragging the sheet open means the visitor wants the card, wherever the camera is.
              if (!landed && next !== "peek") setCardFor(cardIsland.id);
            }}
            onDismiss={close}
            leaving={leaving}
            reducedMotion={reduced}
            labelledBy={headingId}
          >
            {cardHead}
            {cardScroll}
          </Sheet>
          {cardLive ? (
            <div className="da-bar" data-on={ctaShown && !leaving ? "" : undefined} inert={ctaShown && !leaving ? undefined : true}>
              <CardActions onShare={share} copied={copied} />
            </div>
          ) : null}
        </>
      ) : null}

      {cardIsland && wide ? (
        <aside className="da-panel" role="dialog" tabIndex={-1} aria-modal="false" aria-labelledby={headingId} data-leaving={leaving ? "" : undefined} data-open={landed ? "" : undefined} data-live={cardLive ? "" : undefined}>
          <div className="da-panel-inner">
            {cardHead}
            {cardScroll}
            {cardLive ? (
              <div className="da-panel-foot">
                <CardActions onShare={share} copied={copied} />
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      <p className="da-sr" role="status">
        {island ? t(landed ? aStrings.flight.arrived : aStrings.flight.flying, { name: island.name }) : ""}
      </p>
    </main>
  );
}
