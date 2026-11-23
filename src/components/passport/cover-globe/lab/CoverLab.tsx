"use client";

/**
 * /lab/passport-cover: the passport with its cover globe and nothing else, plus switches for the
 * direction, the island, the tour and reduced motion, and a read-out of the controller's state.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getPassportPageMap, usePassportContent, type SlotOverride } from "@/components/passport/content";
import PassportBook, { type BookState, type PassportBookLibHandle } from "@/components/passport/engine-lib";
import { ThemeSwitcher, useTheme } from "@/components/theme";
import { SAMPLE_PASSPORT } from "@/lib/sample-data";
import { strings } from "@/lib/strings";
import type { DirectionId } from "@/lib/types";
import { CoverGlobeFace, CoverMapCredit, CoverOpenCta, useCoverBook, useCoverGlobeState, type CoverStop } from "..";
import "./cover-lab.css";

const L = strings.coverGlobe.lab;
const PAGE_MAP = getPassportPageMap(SAMPLE_PASSPORT);
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

export interface CoverLabProps {
  direction?: DirectionId;
  island?: string;
  tour?: boolean;
}

export function CoverLab({ direction: wanted, island, tour = true }: CoverLabProps) {
  const { direction, setDirection, ready } = useTheme();
  const systemReduced = useSystemReducedMotion();
  const [forceReduced, setForceReduced] = useState(false);
  const reduced = systemReduced || forceReduced;
  const [touring, setTouring] = useState(tour);
  const [bookState, setBookState] = useState<BookState>("closed");
  const [wide, setWide] = useState(false);
  const [highlight, setHighlight] = useState<string[]>([]);

  const book = useRef<PassportBookLibHandle>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const flipWaiter = useRef<{ page: number; resolve(): void } | null>(null);
  const stateWaiter = useRef<{ state: BookState; resolve(): void } | null>(null);
  const highlightTimer = useRef(0);
  const locateRef = useRef<(id: string) => void>(() => {});

  // ?direction= wins over the stored one, once the theme provider has adopted the document.
  const appliedDirection = useRef(false);
  useEffect(() => {
    if (!ready || appliedDirection.current) return;
    appliedDirection.current = true;
    if (wanted && wanted !== direction) setDirection(wanted);
  }, [ready, wanted, direction, setDirection]);

  useEffect(() => {
    const el = floatRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWide(el.clientWidth >= 780));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isSpread = () => floatRef.current?.querySelector(".ipb")?.getAttribute("data-mode") === "double";

  const travel = useCallback(async (page: number) => {
    const b = book.current;
    if (!b) return;
    const wait = <T,>(install: (finish: () => void) => T, timeout: number) =>
      new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          resolve();
        };
        const timer = window.setTimeout(finish, timeout);
        install(finish);
      });
    if (b.getState() !== "open") {
      b.open();
      if (b.getState() !== "open") await wait((finish) => (stateWaiter.current = { state: "open", resolve: finish }), 3600);
    }
    const here = b.getPage();
    if (here === page || (isSpread() && Math.floor(here / 2) === Math.floor(page / 2))) return;
    await wait((finish) => {
      flipWaiter.current = { page, resolve: finish };
      b.flipThrough(page);
    }, 2600);
  }, []);

  const onArrive = useCallback((stop: CoverStop) => {
    locateRef.current(stop.id);
    setHighlight(stop.slotIds);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlight([]), 2300);
  }, []);
  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  const cover = useCoverBook({
    passport: SAMPLE_PASSPORT,
    pages: PAGE_MAP.islands,
    book,
    root: floatRef,
    direction,
    reduced,
    travel,
    onArrive,
  });
  const { controller } = cover;
  const state = useCoverGlobeState(controller);

  useEffect(() => controller.setEnabled(touring), [controller, touring]);

  // ?island= : start on that island.
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !island || !state.stops.length) return;
    applied.current = true;
    controller.select(island);
  }, [controller, island, state.stops.length]);

  const face = useMemo(() => <CoverGlobeFace controller={controller} province={SAMPLE_PASSPORT.province} />, [controller]);
  const slotOverrides = useMemo(() => {
    const overrides: Record<string, SlotOverride> = {};
    for (const id of highlight) overrides[id] = { highlight: true };
    return overrides;
  }, [highlight]);

  const built = usePassportContent(SAMPLE_PASSPORT, {
    slotOverrides,
    layout: wide ? "spread" : "single",
    pageWidth: 338,
    coverInteractive: bookState === "closed",
    coverGlobe: face,
  });
  locateRef.current = built.locateIsland;

  const onFlip = useCallback(
    (page: number) => {
      const w = flipWaiter.current;
      if (w && (w.page === page || (isSpread() && Math.floor(w.page / 2) === Math.floor(page / 2)))) {
        flipWaiter.current = null;
        w.resolve();
      }
      cover.onFlip(page);
    },
    [cover],
  );
  const onStateChange = useCallback(
    (next: BookState) => {
      setBookState(next);
      const w = stateWaiter.current;
      if (w && w.state === next) {
        stateWaiter.current = null;
        w.resolve();
      }
      cover.onStateChange(next);
    },
    [cover],
  );

  const focus = state.stops.find((s) => s.id === state.focusId);

  return (
    <div className="ipcl scene-bg" data-book={bookState}>
      <header className="ipcl-head">
        <div>
          <h1 className="ipcl-title">{L.title}</h1>
          <p className="ipcl-intro">{L.intro}</p>
        </div>
        <ThemeSwitcher variant="compact" />
      </header>

      <main className="ipcl-main">
        <div className="ipcl-stage" onPointerDownCapture={cover.prepare} onKeyDownCapture={cover.prepare}>
          <div ref={floatRef} className="ipcl-float">
            <PassportBook
              ref={book}
              className="ipcl-book"
              cover={built.cover}
              pages={built.pages}
              backCover={built.backCover}
              chrome="bare"
              attract={false}
              reducedMotion={forceReduced ? true : undefined}
              onFlip={onFlip}
              onFlipStart={cover.onFlipStart}
              onOpenChange={cover.onOpenChange}
              onStateChange={onStateChange}
            />
          </div>
        </div>

        <div className="ipcl-under">
          {bookState === "closed" ? (
            <span className="ipcl-open">
              <CoverOpenCta controller={controller} onOpen={cover.open} pulse={!reduced} />
              <CoverMapCredit />
            </span>
          ) : (
            <button type="button" className="ipcg-cta" onClick={() => book.current?.close()}>
              {L.close}
            </button>
          )}
        </div>
      </main>

      <section className="ipcl-panel" aria-label={L.state}>
        <div className="ipcl-row">
          <span className="ipcl-label">{L.island}</span>
          {state.stops.map((s) => (
            <button key={s.id} type="button" className="ipcl-chip" data-on={s.id === state.focusId ? "" : undefined} onClick={() => controller.select(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="ipcl-row">
          <button type="button" className="ipcl-chip" data-on={touring ? "" : undefined} aria-pressed={touring} onClick={() => setTouring((v) => !v)}>
            {touring ? L.tourOn : L.tourOff}
          </button>
          <button type="button" className="ipcl-chip" data-on={forceReduced ? "" : undefined} aria-pressed={forceReduced} onClick={() => setForceReduced((v) => !v)}>
            {L.reduced}
          </button>
        </div>
        <p className="ipcl-state" data-testid="cover-state">
          {state.status} · {state.phase} · {state.view} · {focus?.name ?? "-"}
          {state.pinned ? " · pinned" : ""}
          {state.frozen ? " · frozen" : ""}
        </p>
        <p className="ipcl-note">{strings.coverGlobe.partnersNote}</p>
      </section>

      {built.sheet}
    </div>
  );
}
