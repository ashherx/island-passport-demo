"use client";

/**
 * PassportBook, custom engine: a passport that opens and turns its pages in 3D (UX-2, PAS-3),
 * built with Motion and CSS transforms only. See docs/agents/flip-custom.md.
 *
 * This component renders the book's skeleton and sizes it. All motion is driven by engine.ts,
 * which writes transform and opacity straight to the DOM, so turning a page never re-renders React.
 */
import { useReducedMotion } from "motion/react";
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { strings, t } from "@/lib/strings";
import type { PassportBookHandle, PassportBookProps } from "@/lib/types";
import { BookEngine } from "./engine";
import {
  BOARD_OVERHANG,
  BOARD_THICK,
  PAGE_H,
  PAGE_W,
  PERSPECTIVE,
  POOL_SIZE,
  STAGE_PAD,
  STRIPS,
  type BookLayout,
  type BookMode,
  type BookShape,
  computeLayout,
  leafDepth,
  makeShape,
  rectoPage,
  versoPage,
} from "./layout";
import { makeLeafGeometry } from "./physics";
import "./passport-book.css";

export interface CustomPassportBookProps extends PassportBookProps {
  /** "auto" (default) shows one page on narrow containers and a two-page spread on wide ones. */
  mode?: BookMode | "auto";
  /** Container width in CSS px from which the spread is used. Default 640. */
  spreadFrom?: number;
  /** Largest page width in CSS px. Default 400. */
  maxPageWidth?: number;
  /** Largest page height in CSS px. Default 62% of the viewport height. */
  maxPageHeight?: number;
  /** Fires as soon as a turn is decided, before the page lands. `onFlip` fires on landing. */
  onFlipStart?(pageIndex: number): void;
  /** Force the reduced-motion fallback on or off. Default: the system setting. */
  reducedMotion?: boolean;
}

export interface CustomPassportBookHandle extends PassportBookHandle {
  /** Lift the fore edge of the current page and let it drop: a hint that pages turn. */
  peek(): void;
  isOpen(): boolean;
  /** Zero-based index of the first page in view. */
  getPage(): number;
}

const COVER_W = PAGE_W + BOARD_OVERHANG;
const COVER_H = PAGE_H + BOARD_OVERHANG * 2;
const GEO = makeLeafGeometry(PAGE_W, STRIPS);
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** One face of a paper leaf: paper, content, dark-mode dim and the gutter shadow. */
function SheetInner({ side, blank, children }: { side: "l" | "r"; blank?: boolean; children?: ReactNode }) {
  return (
    <div className={`pb-inner pb-inner--${side}${blank ? " pb-inner--blank" : ""}`}>
      <div className="pb-paper mat-paper" />
      {!blank && <div className="pb-content">{children}</div>}
      <div className="mat-page-dim pb-fill" aria-hidden="true" />
      <div className={`pb-gutter pb-gutter--${side}`} aria-hidden="true" />
    </div>
  );
}

const pageBox = { width: PAGE_W, height: PAGE_H } as const;

/** The pooled turning leaves. Static markup: the engine fills the holders with page snapshots. */
const LeafPool = memo(function LeafPool() {
  return (
    <>
      {Array.from({ length: POOL_SIZE }, (_, slot) => (
        <div key={slot} className="pb-leaf" data-pb-leaf={slot} aria-hidden="true" inert>
          {Array.from({ length: STRIPS }, (_, i) => {
            const x = GEO.xs[i];
            // Each strip overlaps the next by a pixel so no hairline shows at the hinges.
            const w = GEO.xs[i + 1] - x + (i < STRIPS - 1 ? 1 : 0);
            return (
              <div key={i} className="pb-strip" data-pb-strip={i} style={{ width: w, height: PAGE_H }}>
                <div className="pb-face pb-face--f">
                  <div
                    className="pb-holder"
                    data-pb-hold="f"
                    style={{ ...pageBox, transform: `translateX(${-x}px)` }}
                  />
                  <i className="pb-tone pb-tone--dl" data-pb-tone="" />
                  <i className="pb-tone pb-tone--dr" data-pb-tone="" />
                  <i className="pb-tone pb-tone--gl" data-pb-tone="" />
                  <i className="pb-tone pb-tone--gr" data-pb-tone="" />
                </div>
                <div className="pb-face pb-face--b">
                  <div className="pb-holder" style={{ ...pageBox, transform: `translateX(${-(PAGE_W - x - w)}px)` }}>
                    <SheetInner side="l" blank />
                    <div className="pb-fill" data-pb-hold="b" />
                  </div>
                  <i className="pb-tone pb-tone--dl" data-pb-tone="" />
                  <i className="pb-tone pb-tone--dr" data-pb-tone="" />
                  <i className="pb-tone pb-tone--gl" data-pb-tone="" />
                  <i className="pb-tone pb-tone--gr" data-pb-tone="" />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
});

interface LiveHandle {
  set(text: string): void;
}

/** Announces the page to screen readers without re-rendering the book. */
const LiveStatus = forwardRef<LiveHandle>(function LiveStatus(_, ref) {
  const [text, setText] = useState("");
  useImperativeHandle(ref, () => ({ set: setText }), []);
  return (
    <div className="pb-sr" role="status" aria-live="polite">
      {text}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

interface SkeletonProps {
  layout: BookLayout;
  shape: BookShape;
  mounted: [number, number];
  cover: ReactNode;
  pages: ReactNode[];
  backCover: ReactNode;
}

/**
 * The book's DOM. Memoised on what it actually draws, so a host that re-renders on every flip
 * (to update a page counter, say) costs nothing here while a leaf is in the air.
 */
const Skeleton = memo(
  function Skeleton({ layout, shape, mounted, cover, pages, backCover }: SkeletonProps) {
    const bookMode = shape.mode;
    const sheets: ReactNode[] = [];
    {
      for (let leaf = 1; leaf <= shape.sheets; leaf++) {
        if (leaf < mounted[0] || leaf > mounted[1]) continue;
        const depth = leafDepth(shape, leaf);
        const r = rectoPage(shape, leaf);
        const v = versoPage(shape, leaf);
        if (r >= 0) {
          sheets.push(
            <div
              key={`r${leaf}`}
              className="pb-sheet pb-sheet--r"
              data-pb-recto={leaf}
              style={{ ...pageBox, transform: `translateZ(${depth}px)` }}
            >
              <SheetInner side="r">{pages[r]}</SheetInner>
            </div>,
          );
        }
        if (v >= 0) {
          sheets.push(
            <div
              key={`v${leaf}`}
              className="pb-sheet"
              data-pb-verso={leaf}
              style={{ ...pageBox, left: -PAGE_W, transform: `translateZ(${-depth}px)` }}
            >
              <SheetInner side="l">{pages[v]}</SheetInner>
            </div>,
          );
        }
      }
    }

    const boardBox = { top: -BOARD_OVERHANG, width: COVER_W, height: COVER_H } as const;
    const leaves = shape.leaves;
    return (
      <div
        className="pb-scaler"
        data-pb="scaler"
        style={{ width: layout.stageW, height: layout.stageH, transform: `scale(${layout.scale})` }}
      >
        <div
          className="pb-stage"
          style={{
            perspective: PERSPECTIVE,
            perspectiveOrigin: `${layout.originX}px ${layout.originY}px`,
          }}
        >
          <div key={bookMode} className="pb-book" data-pb="book" style={{ top: STAGE_PAD, height: PAGE_H }}>
            <div
              className="pb-ground pb-ground--r"
              data-pb="groundR"
              style={{ ...boardBox, transform: `translateZ(${-(BOARD_THICK + 1.5)}px)` }}
            />
            <div
              className="pb-ground pb-ground--l"
              data-pb="groundL"
              style={{ ...boardBox, left: -COVER_W, transform: `translateZ(${-(leaves + BOARD_THICK + 1.5)}px)` }}
            />

            {/* Back cover: its inside faces up under the right-hand pages. */}
            <div className="pb-cover" data-pb="back" style={boardBox}>
              <div className="pb-board pb-board--inside">
                <div
                  className="pb-endpaper mat-paper"
                  style={{ ...pageBox, left: 0, top: BOARD_OVERHANG, borderRadius: "0 var(--r-page) var(--r-page) 0" }}
                />
                <div className="pb-dim" data-pb="backShadeIn" />
              </div>
              <div
                className="pb-board pb-board--flip pb-board--outside mat-cover"
                style={{ transform: `translateZ(${-BOARD_THICK}px) rotateY(180deg)` }}
              >
                <div className="pb-cover-content">{backCover}</div>
                <div className="pb-spine" aria-hidden="true" />
                <div className="mat-sheen pb-fill" aria-hidden="true" />
                <div className="pb-dim" data-pb="backShadeOut" />
              </div>
              <div className="pb-edge" data-pb="backEdge" style={{ width: BOARD_THICK, transform: "rotateY(90deg)" }} />
            </div>

            <div
              className="pb-block pb-block--r"
              data-pb="blockR"
              style={{ ...pageBox, transform: "translateZ(1.5px)" }}
            />
            <div
              className="pb-block pb-block--l"
              data-pb="blockL"
              style={{ ...pageBox, left: -PAGE_W, transform: `translateZ(${-(leaves - 0.5)}px)` }}
            />

            {sheets}

            <div className="pb-sheet" data-pb="blankL" style={{ ...pageBox, left: -PAGE_W }} aria-hidden="true">
              <SheetInner side="l" blank />
            </div>

            <div className="pb-cast pb-cast--r" data-pb="castR" style={pageBox} />
            <div className="pb-cast pb-cast--l" data-pb="castL" style={{ ...pageBox, left: -PAGE_W }} />

            <div className="pb-sheet pb-sheet--r pb-fade" data-pb="fadeR" style={pageBox} aria-hidden="true" inert />
            <div
              className="pb-sheet pb-fade"
              data-pb="fadeL"
              style={{ ...pageBox, left: -PAGE_W }}
              aria-hidden="true"
              inert
            />

            <LeafPool />
            <div
              className="pb-focus"
              aria-hidden="true"
              style={{ ["--pb-cw" as string]: `${COVER_W}px`, top: -BOARD_OVERHANG - 7, height: COVER_H + 14 }}
            />

            {/* Front cover. */}
            <div className="pb-cover" data-pb="front" style={boardBox}>
              <div
                className="pb-board pb-board--outside mat-cover"
                style={{ transform: `translateZ(${BOARD_THICK}px)` }}
              >
                <div className="pb-cover-content">{cover}</div>
                <div className="pb-spine" aria-hidden="true" />
                <div className="mat-sheen pb-fill" aria-hidden="true" />
                <div className="pb-glare" data-pb="frontGlare" />
                <div className="pb-dim" data-pb="frontShadeOut" />
              </div>
              <div className="pb-board pb-board--flip pb-board--inside" style={{ transform: "rotateY(180deg)" }}>
                <div
                  className="pb-endpaper mat-paper"
                  style={{ ...pageBox, right: 0, top: BOARD_OVERHANG, borderRadius: "var(--r-page) 0 0 var(--r-page)" }}
                />
                <div
                  className="pb-passenger"
                  data-pb="passenger"
                  style={{ ...pageBox, right: 0, top: BOARD_OVERHANG }}
                  aria-hidden="true"
                  inert
                />
                <div className="pb-dim" data-pb="frontShadeIn" />
              </div>
              <div
                className="pb-edge"
                data-pb="frontEdge"
                style={{ width: BOARD_THICK, transform: "rotateY(-90deg)" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  },
  (a, b) =>
    a.layout === b.layout &&
    a.shape === b.shape &&
    a.mounted === b.mounted &&
    a.cover === b.cover &&
    a.backCover === b.backCover &&
    a.pages.length === b.pages.length &&
    a.pages.every((page, i) => page === b.pages[i]),
);

/* ------------------------------------------------------------------ */
/* PassportBook                                                        */
/* ------------------------------------------------------------------ */

const PassportBook = forwardRef<CustomPassportBookHandle, CustomPassportBookProps>(function PassportBook(
  {
    cover,
    pages,
    backCover,
    onFlip,
    onFlipStart,
    onOpenChange,
    className,
    mode = "auto",
    spreadFrom,
    maxPageWidth,
    maxPageHeight,
    reducedMotion,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BookEngine | null>(null);
  const liveRef = useRef<LiveHandle>(null);
  const [layout, setLayout] = useState<BookLayout | null>(null);
  /** Leaves whose pages are mounted. Grows as the reader moves through the book (UX-7). */
  const [mounted, setMounted] = useState<[number, number]>([0, 2]);
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion ?? systemReduced ?? false;

  const hasBack = backCover != null;
  const pageCount = pages.length;
  const bookMode: BookMode = layout?.mode ?? "single";
  const shape = useMemo(() => makeShape(bookMode, pageCount, hasBack), [bookMode, pageCount, hasBack]);

  /* ---- callbacks: always the latest props, never a new engine ---- */
  const cbRef = useRef({ onFlip, onFlipStart, onOpenChange, pageCount });
  cbRef.current = { onFlip, onFlipStart, onOpenChange, pageCount };

  const callbacks = useMemo(
    () => ({
      onFlipStart: (page: number) => cbRef.current.onFlipStart?.(page),
      onFlip: (page: number) => {
        // Announced on landing, so a screen reader hears the page once, not every page passed.
        liveRef.current?.set(t(strings.passport.pageOf, { page: page + 1, total: cbRef.current.pageCount }));
        cbRef.current.onFlip?.(page);
      },
      onOpenChange: (open: boolean) => {
        const root = rootRef.current;
        if (root) root.dataset.open = String(open);
        if (!open) liveRef.current?.set("");
        cbRef.current.onOpenChange?.(open);
      },
      ensureMounted: (lo: number, hi: number) =>
        setMounted((m) => (lo >= m[0] && hi <= m[1] ? m : [Math.min(lo, m[0]), Math.max(hi, m[1])])),
    }),
    [],
  );

  /* ---- size ---- */
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const w = root.clientWidth;
      if (w <= 0) return;
      const next = computeLayout(w, window.innerHeight, { mode, spreadFrom, maxPageWidth, maxPageHeight });
      setLayout((prev) =>
        prev && prev.mode === next.mode && Math.abs(prev.scale - next.scale) < 0.0005 && prev.stageW === next.stageW
          ? prev
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [mode, spreadFrom, maxPageWidth, maxPageHeight]);

  /* ---- engine ---- */
  const ready = layout !== null;
  const latest = useRef({ layout, shape });
  latest.current = { layout, shape };

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const now = latest.current;
    if (!ready || !root || !now.layout) return;
    const engine = new BookEngine(root, now.layout, now.shape, callbacks);
    engineRef.current = engine;
    applied.current = { layout: now.layout, shape: now.shape };
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [ready, callbacks]);

  const applied = useRef<{ layout: BookLayout | null; shape: typeof shape | null }>({ layout: null, shape: null });
  useIsoLayoutEffect(() => {
    const engine = engineRef.current;
    if (!engine || !layout) return;
    if (applied.current.shape !== shape) engine.setShape(shape, layout);
    else if (applied.current.layout !== layout) engine.setLayout(layout);
    applied.current = { layout, shape };
  }, [layout, shape]);

  useIsoLayoutEffect(() => {
    engineRef.current?.invalidateSheets();
  }, [mounted]);

  useIsoLayoutEffect(() => {
    engineRef.current?.setReducedMotion(reduced);
  }, [reduced, ready]);

  useImperativeHandle(
    ref,
    () => ({
      open: () => engineRef.current?.open(),
      close: () => engineRef.current?.close(),
      flipTo: (page: number) => engineRef.current?.flipTo(page),
      next: () => engineRef.current?.next(),
      prev: () => engineRef.current?.prev(),
      peek: () => engineRef.current?.peek(),
      isOpen: () => engineRef.current?.isOpen() ?? false,
      getPage: () => engineRef.current?.getPage() ?? 0,
    }),
    [],
  );

  /* ---- keyboard (TEC-9) ---- */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (!engine || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const onRoot = e.target === e.currentTarget;
    let handled = true;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        engine.next();
        break;
      case "ArrowLeft":
      case "PageUp":
        engine.prev();
        break;
      case "Home":
        if (engine.isOpen()) engine.flipTo(0);
        else handled = false;
        break;
      case "End":
        if (engine.isOpen()) engine.flipTo(pageCount - 1);
        else handled = false;
        break;
      case "Enter":
      case " ":
        // Enter and Space belong to whatever control inside a page has focus.
        if (onRoot && !engine.isOpen()) engine.open();
        else handled = false;
        break;
      case "Escape":
        if (engine.isOpen()) engine.close();
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };

  return (
    <div
      ref={rootRef}
      className={["pb-root", className].filter(Boolean).join(" ")}
      style={{ height: layout ? layout.cssHeight : undefined, aspectRatio: layout ? undefined : "390 / 560" }}
      tabIndex={0}
      role="group"
      aria-roledescription={strings.passport.title}
      aria-label={strings.passport.ariaBook}
      data-ready={ready}
      data-mode={bookMode}
      data-open="false"
      data-pb-state="front"
      data-reduced={reduced}
      onKeyDown={onKeyDown}
    >
      {layout && (
        <Skeleton layout={layout} shape={shape} mounted={mounted} cover={cover} pages={pages} backCover={backCover} />
      )}
      <LiveStatus ref={liveRef} />
    </div>
  );
});

export default PassportBook;
