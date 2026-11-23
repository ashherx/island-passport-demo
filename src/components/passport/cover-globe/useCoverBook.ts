"use client";

/**
 * Wires the cover globe to a <PassportBook>:
 *
 *   - the controller follows the book: frozen (a still image, no WebGL frames) from the moment
 *     the cover starts to move until the book lies closed again;
 *   - opening the passport from its cover (a tap, a pull, Enter, or the "Open to ..." button)
 *     opens it to the island the globe is showing: the pages under the cover are parked two
 *     before that island, the cover swings open, the last pages riffle, and the lens carries the
 *     globe's view from the cover to the locator map on the page;
 *   - while the book is open, the hidden globe follows the island page that is showing, so
 *     closing the book finds the cover on that island and the tour resumes there.
 *
 * The host supplies `travel(page)` ("open if needed, turn to this page, resolve when it has
 * landed"), because it owns the book's navigation queue.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { BookState, PassportBookLibHandle } from "@/components/passport/engine-lib";
import type { DirectionId, PassportData } from "@/lib/types";
import { CoverGlobeController } from "./controller";
import { LENS, launchLens, type Lens, type LensPose } from "./lens";
import { COVER_MAP_LOOKS } from "./map-style";
import { coverStops } from "./stops";
import type { CoverStop } from "./types";

/** Pages thumbed through after the cover has opened (when the island is that far into the book). */
export const RIFFLE_PAGES = 2;

/** How long a page must lie open before the hidden globe is moved to its island. */
const FOLLOW_PAGE_MS = 450;

export interface UseCoverBookOptions {
  passport: PassportData;
  /** Island id to page index (PassportPageMap.islands). */
  pages: Record<string, number>;
  book: RefObject<PassportBookLibHandle | null>;
  /** An element that contains the book's root (.ipb). */
  root: RefObject<HTMLElement | null>;
  direction: DirectionId;
  reduced: boolean;
  /**
   * Reduced motion for the globe's tour alone (default: `reduced`). The map engine always follows
   * the device setting, so a host that lets the visitor play the full motion anyway passes the
   * device setting here and the tour keeps its gentle cuts.
   */
  reducedTour?: boolean;
  /** Open the book if needed and turn to `page`. Resolves when the page has landed. */
  travel(page: number): Promise<void>;
  /** True while something else (a scripted step) is driving the book: no lens, no parking. */
  isBusy?(): boolean;
  /** The book has opened on this island's page (the lens has just touched down). */
  onArrive?(stop: CoverStop): void;
}

export interface CoverBook {
  controller: CoverGlobeController;
  /** Pass these to <PassportBook>. */
  onOpenChange(open: boolean): void;
  onStateChange(state: BookState): void;
  onFlip(page: number): void;
  onFlipStart(page: number): void;
  /** Call from pointerdown / keydown (capture) over the book: parks the pages for the focus island. */
  prepare(): void;
  /** The "Open to ..." button. */
  open(): void;
  /** Run `fn` (which opens the book for a scripted step) without the cover's own choreography. */
  scripted<T>(fn: () => T): T;
}

function bookEl(root: HTMLElement | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>(".ipb") ?? null;
}

/**
 * Where the lens hangs while the pages turn: over the upper outer part of the island's page.
 * A two-page spread slides sideways as it opens, so while the book is still closed the lens only
 * rises over the cover; it is re-aimed at the page once the book lies open.
 */
function hoverPose(root: HTMLElement | null, page: number, opened: boolean): LensPose | null {
  const spread = bookEl(root)?.getAttribute("data-mode") === "double";
  if (spread && !opened) {
    const cover = root?.querySelector<HTMLElement>(".ipb__face--front")?.getBoundingClientRect();
    return cover && cover.width > 0 ? { x: cover.left + cover.width * 0.66, y: cover.top + cover.height * 0.2, scale: LENS.hoverScale } : null;
  }
  const pages = root?.querySelector<HTMLElement>(".ipb__pages");
  if (!pages) return null;
  const r = pages.getBoundingClientRect();
  if (!(r.width > 0)) return null;
  const pageW = spread ? r.width / 2 : r.width;
  const left = spread && page % 2 === 1 ? r.left + pageW : r.left;
  return { x: left + pageW * 0.7, y: r.top + r.height * 0.2, scale: LENS.hoverScale };
}

function locatorRect(root: HTMLElement | null, islandId: string): DOMRect | null {
  const el = root?.querySelector<HTMLElement>(`.ipb__pages [data-island-id="${islandId}"] .ipp-island__locator`);
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? r : null;
}

export function useCoverBook(options: UseCoverBookOptions): CoverBook {
  const { passport, pages, book, root, direction, reduced } = options;
  const reducedTour = options.reducedTour ?? reduced;
  const [controller] = useState(() => new CoverGlobeController());
  const latest = useRef(options);
  latest.current = options;

  const stops = useMemo(() => coverStops(passport, pages), [passport, pages]);
  useEffect(() => controller.setStops(stops), [controller, stops]);
  useEffect(() => controller.setReducedMotion(reducedTour), [controller, reducedTour]);
  useEffect(() => {
    controller.revive();
    return () => controller.destroy();
  }, [controller]);

  const scriptedRef = useRef(false);
  const run = useRef<{ id: number; lens: Lens | null; page: number } | null>(null);
  const runId = useRef(0);
  const followTimer = useRef(0);
  const directionRef = useRef(direction);
  directionRef.current = direction;

  const endRun = useCallback((cancelLens: boolean) => {
    const r = run.current;
    run.current = null;
    if (r?.lens && cancelLens) r.lens.cancel();
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(followTimer.current);
      run.current?.lens?.cancel();
      run.current = null;
    },
    [],
  );

  const prepare = useCallback(() => {
    const b = book.current;
    const o = latest.current;
    if (!b || b.getState() !== "closed" || o.isBusy?.()) return;
    if (bookEl(root.current)?.getAttribute("data-side") === "back") return;
    const stop = controller.focusStop();
    if (!stop) return;
    const park = Math.max(0, stop.page - RIFFLE_PAGES);
    if (b.getPage() !== park) b.goTo(park);
  }, [book, controller, root]);

  /** The cover is opening by the visitor's hand: carry the globe's view to its island's page. */
  const openToFocus = useCallback(
    (fromCover: boolean) => {
      const o = latest.current;
      const stop = controller.focusStop();
      if (!stop) return;
      endRun(true);
      const id = ++runId.current;
      let lens: Lens | null = null;
      const state = controller.getState();
      const windowEl = root.current?.querySelector<HTMLElement>(".ipcg__window");
      const hover = hoverPose(root.current, stop.page, false);
      if (!o.reduced && state.status === "ready" && windowEl && hover) {
        const rect = windowEl.getBoundingClientRect();
        if (rect.width > 0) {
          lens = launchLens({
            direction: directionRef.current,
            from: fromCover ? rect : null,
            size: Math.max(60, windowEl.offsetWidth),
            hover,
            image: () => controller.getState().still,
            watch: controller.subscribe,
            space: COVER_MAP_LOOKS[directionRef.current].css.space,
          });
        }
      }
      run.current = { id, lens, page: stop.page };
      // One task later: a tap reports its intent from inside the book's own open(), before the
      // cover has started to move, and travel() must find the book already opening.
      void Promise.resolve()
        .then(() => o.travel(stop.page))
        .catch(() => {})
        .then(async () => {
          if (run.current?.id !== id) return;
          const target = locatorRect(root.current, stop.id);
          if (lens && target) await lens.land(target);
          else lens?.cancel();
          if (run.current?.id !== id) return;
          run.current = null;
          latest.current.onArrive?.(stop);
        });
    },
    [controller, endRun, root],
  );

  /** The stop whose page is lying open (on a spread: the focus island if it is one of the two). */
  const stopShowing = useCallback(
    (page: number): CoverStop | null => {
      if (page < 0) return null;
      const spread = bookEl(root.current)?.getAttribute("data-mode") === "double";
      const showing = spread ? [page - (page % 2), page - (page % 2) + 1] : [page];
      const state = controller.getState();
      const here = state.stops.filter((s) => showing.includes(s.page));
      return here.find((s) => s.id === state.focusId) ?? here[0] ?? null;
    },
    [controller, root],
  );

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) return;
      const o = latest.current;
      if (scriptedRef.current || o.isBusy?.()) return;
      // A tap reports its intent before the cover moves; after a pull the cover is already in the air.
      openToFocus(book.current?.getState() === "closed");
    },
    [book, openToFocus],
  );

  const onStateChange = useCallback(
    (state: BookState) => {
      if (state === "closed") {
        endRun(true);
        window.clearTimeout(followTimer.current);
        controller.unfreeze();
        return;
      }
      controller.freeze();
      if (state === "closing") {
        endRun(true);
        window.clearTimeout(followTimer.current);
        controller.bookClosing(stopShowing(book.current?.getPage() ?? -1)?.id ?? null);
      }
      else if (state === "open") {
        // The book may have moved as it opened (a spread slides sideways): re-aim the lens.
        const r = run.current;
        const hover = r?.lens ? hoverPose(root.current, r.page, true) : null;
        if (r?.lens && hover) r.lens.retarget(hover);
      }
    },
    [book, controller, endRun, root, stopShowing],
  );

  const onFlipStart = useCallback(() => {
    window.clearTimeout(followTimer.current);
    // A page is leaving the stack: the hidden map stops drawing until the book is at rest again.
    controller.bookMoving();
  }, [controller]);

  const onFlip = useCallback(
    (page: number) => {
      window.clearTimeout(followTimer.current);
      followTimer.current = window.setTimeout(() => {
        const b = book.current;
        if (!b || b.getState() !== "open" || run.current) return;
        // Never while a page is in the air.
        const flip = root.current?.querySelector(".ipb__flip")?.getAttribute("data-state");
        if (flip && flip !== "read") return;
        const stop = stopShowing(page);
        if (stop) void controller.showIsland(stop.id);
      }, FOLLOW_PAGE_MS);
    },
    [book, controller, root, stopShowing],
  );

  const open = useCallback(() => {
    const b = book.current;
    if (!b || latest.current.isBusy?.()) return;
    prepare();
    if (b.getState() === "closed") b.open();
  }, [book, prepare]);

  const scripted = useCallback(<T,>(fn: () => T): T => {
    scriptedRef.current = true;
    try {
      return fn();
    } finally {
      scriptedRef.current = false;
    }
  }, []);

  return useMemo(
    () => ({ controller, onOpenChange, onStateChange, onFlip, onFlipStart, prepare, open, scripted }),
    [controller, onOpenChange, onStateChange, onFlip, onFlipStart, prepare, open, scripted],
  );
}
