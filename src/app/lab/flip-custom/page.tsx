"use client";

/**
 * /lab/flip-custom: the custom passport engine on its own, with eight placeholder pages.
 * Drag or swipe to turn, tap the cover to open, arrow keys on the keyboard.
 * The FPS read-out measures frames while anything in the book is moving.
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { CustomPassportBookHandle, CustomPassportBookProps } from "@/components/passport/engine-custom";
import { flipLabStrings as L } from "@/components/passport/engine-custom/strings";
import { Stamp } from "@/components/stamp";
import { ThemeSwitcher, useTheme } from "@/components/theme";
import { artUrl } from "@/lib/assets";
import { SAMPLE_PASSPORT, SAMPLE_PROVINCIAL, getProgress, slotsByIsland } from "@/lib/sample-data";
import { formatDate, strings, t } from "@/lib/strings";
import type { Island, StampSlot } from "@/lib/types";

/* The engine is loaded only when this page needs it (UX-7). */
const PassportBook = dynamic(() => import("@/components/passport/engine-custom"), {
  ssr: false,
  loading: () => (
    <div className="grid w-full place-items-center" style={{ aspectRatio: "390 / 560" }} role="status">
      <span className="type-label text-subtle">{L.loading}</span>
    </div>
  ),
}) as React.ForwardRefExoticComponent<CustomPassportBookProps & React.RefAttributes<CustomPassportBookHandle>>;

const P = strings.passport;

/* ------------------------------------------------------------------ */
/* Placeholder pages (design size 320 x 454)                           */
/* ------------------------------------------------------------------ */

function PageFrame({ n, children, label }: { n: number; children: ReactNode; label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col px-[22px] pb-[14px] pt-[20px] text-paper-ink">
      {children}
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="type-label !text-[8px] text-paper-muted opacity-70">{label ?? strings.sample.tag}</span>
        <span className="font-mono text-[10px] tracking-[0.12em] text-paper-muted">
          {t(L.pageNo, { n: String(n).padStart(2, "0") })}
        </span>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="type-label !text-[8px] text-paper-muted">{label}</p>
      <p className={mono ? "font-mono text-[13px] tracking-[0.08em]" : "font-display text-[19px] leading-tight"}>
        {value}
      </p>
    </div>
  );
}

function IdentityPage() {
  const h = SAMPLE_PASSPORT.holder;
  const [given, ...rest] = h.name.toUpperCase().split(" ");
  const mrz = t(P.mrzLine, { surname: rest.join("<") || given, given }).slice(0, 30);
  return (
    <PageFrame n={1}>
      <p className="type-label !text-[8.5px] text-paper-muted">{strings.country.republic}</p>
      <h2 className="font-display mt-1 text-[30px] leading-[0.98]">{P.coverTitle}</h2>
      <div className="mt-5 flex gap-4">
        <div
          className="relative h-[112px] w-[88px] shrink-0 overflow-hidden rounded-[4px]"
          style={{ boxShadow: "inset 0 0 0 1px var(--paper-line)", background: "var(--paper-shade)" }}
        >
          <div
            className="absolute inset-[10px]"
            style={{
              background: "var(--ink-discovery)",
              opacity: 0.55,
              WebkitMask: `url(${artUrl("stamp-tarsier")}) center / contain no-repeat`,
              mask: `url(${artUrl("stamp-tarsier")}) center / contain no-repeat`,
            }}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Field label={L.holderName} value={h.name} />
          <Field label={P.passportNo} value={h.passportNo} mono />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label={P.memberSince} value={formatDate(h.memberSince)} mono />
        <Field label={strings.country.regionLabel} value={SAMPLE_PASSPORT.province} mono />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Stamp stamp={SAMPLE_PROVINCIAL.stamp} variant="empty" size={92} emptyLabel={strings.stamp.locked} />
        <p className="text-[11px] leading-snug text-paper-muted">{t(strings.progress.toProvincialOne, {})}</p>
      </div>
      <p className="mt-auto break-all font-mono text-[10.5px] leading-[1.5] tracking-[0.16em] text-paper-muted">
        {mrz}
        <br />
        {`${h.passportNo.replace(/[^A-Z0-9]/gi, "")}<<${strings.country.code}<<<<<<<<<<<<<<<<<<`.slice(0, 30)}
      </p>
    </PageFrame>
  );
}

/** Stamps sit a little askew and overlap the margins, the way a border officer leaves them. */
const SPOTS: Record<number, { x: number; y: number; size: number }[]> = {
  2: [
    { x: 12, y: 86, size: 156 },
    { x: 146, y: 232, size: 156 },
  ],
  3: [
    { x: 8, y: 78, size: 140 },
    { x: 166, y: 150, size: 140 },
    { x: 30, y: 268, size: 140 },
  ],
};

function IslandPage({ island, slots, n }: { island: Island; slots: StampSlot[]; n: number }) {
  const held = slots.filter((s) => s.stamp).length;
  const spots = SPOTS[slots.length] ?? SPOTS[3];
  return (
    <PageFrame n={n}>
      <p className="type-label !text-[8.5px] text-paper-muted">
        {t(strings.province.of, { province: island.province })}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[28px] leading-none">{island.name}</h2>
        <span className="font-mono text-[10px] tracking-[0.06em] text-paper-muted">
          {t(P.stampsOnIsland, { n: held, total: slots.length })}
        </span>
      </div>
      <div className="mt-2 h-px w-full" style={{ background: "var(--paper-line)" }} />
      {slots.map((slot, i) => {
        const spot = spots[i % spots.length];
        const style: CSSProperties = { position: "absolute", left: spot.x, top: spot.y };
        return slot.stamp ? (
          <Stamp key={slot.id} stamp={slot.stamp} size={spot.size} style={style} blend="multiply" />
        ) : (
          <Stamp key={slot.id} slot={slot} size={spot.size} style={style} />
        );
      })}
    </PageFrame>
  );
}

function ProvincialPage({ n }: { n: number }) {
  const progress = getProgress(SAMPLE_PASSPORT);
  return (
    <PageFrame n={n}>
      <p className="type-label !text-[8.5px] text-paper-muted">
        {t(strings.province.of, { province: SAMPLE_PASSPORT.province })}
      </p>
      <h2 className="font-display mt-1 text-[28px] leading-none">{P.provincialPage}</h2>
      <div className="mt-2 h-px w-full" style={{ background: "var(--paper-line)" }} />
      <div className="mt-6 flex justify-center">
        <Stamp
          stamp={SAMPLE_PROVINCIAL.stamp}
          variant="empty"
          size={232}
          emptyLabel={
            progress.toProvincial === 1
              ? strings.stamp.provincialLockedOne
              : t(strings.stamp.provincialLocked, { n: progress.toProvincial })
          }
        />
      </div>
      <p className="mx-auto mt-4 max-w-[220px] text-center text-[11.5px] leading-snug text-paper-muted">
        {progress.toProvincial === 1
          ? strings.progress.toProvincialOne
          : t(strings.progress.toProvincial, { n: progress.toProvincial })}
      </p>
    </PageFrame>
  );
}

function NotesPage({ n }: { n: number }) {
  return (
    <PageFrame n={n} label={strings.sample.tag}>
      <p className="type-label !text-[8.5px] text-paper-muted">{strings.app.name}</p>
      <h2 className="font-display mt-1 text-[28px] leading-none">{L.notesHeading}</h2>
      <div className="mt-2 h-px w-full" style={{ background: "var(--paper-line)" }} />
      <div className="mt-5 flex flex-col gap-[25px]" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="h-px w-full" style={{ background: "var(--paper-line)", opacity: 0.7 }} />
        ))}
      </div>
      <p className="mt-5 text-[11.5px] italic leading-snug text-paper-muted">{L.notesBody}</p>
      <p className="mt-2 text-[10px] leading-snug text-paper-muted opacity-80">{strings.sample.notice}</p>
    </PageFrame>
  );
}

function CoverArt() {
  const { tokens } = useTheme();
  const kraft = tokens.cover.material === "kraft";
  const foil = kraft ? "" : "foil-text";
  const mask = `url(${artUrl("stamp-provincial")}) center / contain no-repeat`;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between px-6 pb-9 pt-10 text-center">
      <div
        className="pointer-events-none absolute inset-[13px] rounded-[calc(var(--r-passport)-6px)]"
        style={{
          boxShadow: `inset 0 0 0 1px ${kraft ? "var(--cover-ink)" : "var(--foil)"}`,
          opacity: kraft ? 0.4 : 0.5,
        }}
      />
      <span className={`type-label !text-[11px] !tracking-[0.34em] ${foil}`}>{strings.country.name}</span>
      <div className="flex flex-col items-center gap-6">
        <div
          className={kraft ? "" : "foil-fill"}
          style={{
            width: 132,
            height: 132,
            backgroundColor: kraft ? "var(--cover-ink)" : undefined,
            WebkitMask: mask,
            mask,
          }}
        />
        <span className={`font-display text-[38px] leading-[0.98] ${foil}`}>
          {P.coverTitle.split(" ").map((word) => (
            <span key={word} className="block">
              {word}
            </span>
          ))}
        </span>
      </div>
      <span className={`type-label !text-[11px] !tracking-[0.34em] ${foil}`}>{strings.province.name}</span>
    </div>
  );
}

function BackArt() {
  const { tokens } = useTheme();
  const kraft = tokens.cover.material === "kraft";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end px-8 pb-10 text-center">
      <span
        className={`type-label !text-[9px] !tracking-[0.2em] ${kraft ? "" : "foil-text"}`}
        style={{ opacity: 0.85 }}
      >
        {L.backNote}
      </span>
      <span
        className="sample-tag mt-3"
        style={{ color: "var(--cover-ink)", borderColor: "currentColor", opacity: 0.6 }}
      >
        {strings.sample.tag}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FPS meter                                                           */
/* ------------------------------------------------------------------ */

interface FpsStats {
  frames: number;
  avgFps: number;
  worstMs: number;
  over20: number;
  over34: number;
  deltas: number[];
}

/** Samples requestAnimationFrame while `active()` is true and writes the result into the DOM. */
function useFpsMeter(active: () => boolean) {
  const nowRef = useRef<HTMLSpanElement>(null);
  const worstRef = useRef<HTMLSpanElement>(null);
  const stats = useRef<FpsStats>({ frames: 0, avgFps: 0, worstMs: 0, over20: 0, over34: 0, deltas: [] });
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let wasActive = false;
    let shown = 0;
    const loop = (ts: number) => {
      const isActive = active();
      if (isActive && !wasActive) {
        stats.current = { frames: 0, avgFps: 0, worstMs: 0, over20: 0, over34: 0, deltas: [] };
      } else if (isActive && last) {
        const d = ts - last;
        const s = stats.current;
        s.deltas.push(d);
        s.frames++;
        if (d > s.worstMs) s.worstMs = d;
        if (d > 20) s.over20++;
        if (d > 34) s.over34++;
        const total = s.deltas.reduce((a, b) => a + b, 0);
        s.avgFps = (s.frames / total) * 1000;
        if (ts - shown > 120) {
          shown = ts;
          if (nowRef.current) nowRef.current.textContent = t(L.fpsNow, { fps: Math.round(s.avgFps) });
          if (worstRef.current) worstRef.current.textContent = t(L.fpsWorst, { ms: Math.round(s.worstMs) });
        }
      } else if (!isActive && wasActive) {
        const s = stats.current;
        if (nowRef.current) nowRef.current.textContent = t(L.fpsNow, { fps: Math.round(s.avgFps) });
        if (worstRef.current) worstRef.current.textContent = t(L.fpsWorst, { ms: Math.round(s.worstMs) });
      }
      wasActive = isActive;
      last = ts;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return { nowRef, worstRef, stats };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type LayoutChoice = "auto" | "single" | "spread";

declare global {
  interface Window {
    __flipLab?: {
      book: CustomPassportBookHandle | null;
      busy: () => boolean;
      stats: () => FpsStats;
    };
  }
}

export default function FlipCustomLabPage() {
  const book = useRef<CustomPassportBookHandle>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<LayoutChoice>("auto");
  const moving = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pages = useMemo(() => {
    const groups = slotsByIsland(SAMPLE_PASSPORT);
    return [
      <IdentityPage key="id" />,
      ...groups.map((g, i) => <IslandPage key={g.island.id} island={g.island} slots={g.slots} n={i + 2} />),
      <ProvincialPage key="prov" n={groups.length + 2} />,
      <NotesPage key="notes" n={groups.length + 3} />,
    ];
  }, []);
  const cover = useMemo(() => <CoverArt />, []);
  const back = useMemo(() => <BackArt />, []);
  const total = pages.length;

  // "Moving" for the FPS meter: from the moment a turn starts until shortly after it lands.
  const markMoving = () => {
    moving.current = true;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => (moving.current = false), 1400);
  };
  const markLanded = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => (moving.current = false), 120);
  };
  const active = useRef(() => moving.current).current;
  const { nowRef, worstRef, stats } = useFpsMeter(active);

  useEffect(() => {
    window.__flipLab = { book: book.current, busy: () => moving.current, stats: () => stats.current };
    const id = setInterval(() => {
      if (window.__flipLab) window.__flipLab.book = book.current;
    }, 200);
    return () => {
      clearInterval(id);
      delete window.__flipLab;
    };
  }, [stats]);

  const btn =
    "type-label rounded-chip border border-line bg-elev px-4 py-2.5 text-fg transition-opacity disabled:opacity-35";

  return (
    <main className="scene-bg flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-[color:color-mix(in_srgb,var(--bg)_86%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[20px] leading-none text-fg">{L.title}</h1>
            <span className="sample-tag mt-1.5">{strings.sample.tag}</span>
          </div>
          <ThemeSwitcher variant="compact" />
        </div>
      </header>

      <div
        className="mx-auto w-full max-w-[1100px] flex-1 pt-2"
        onPointerDownCapture={markMoving}
        onKeyDownCapture={markMoving}
      >
        <PassportBook
          ref={book}
          cover={cover}
          pages={pages}
          backCover={back}
          mode={layout}
          onOpenChange={(o) => {
            setOpen(o);
            markMoving();
          }}
          onFlipStart={(p) => {
            setPage(p);
            markMoving();
          }}
          onFlip={markLanded}
        />
      </div>

      <footer className="sticky bottom-0 z-20 border-t border-line bg-[color:color-mix(in_srgb,var(--bg)_90%,transparent)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[560px] flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={btn}
              aria-label={P.prevPage}
              onClick={() => {
                markMoving();
                book.current?.prev();
              }}
            >
              ←
            </button>
            <button
              type="button"
              className={`${btn} min-w-[88px]`}
              onClick={() => {
                markMoving();
                if (open) book.current?.close();
                else book.current?.open();
              }}
            >
              {open ? L.close : L.open}
            </button>
            <p className="type-label min-w-[92px] text-center text-muted" aria-live="off">
              {open ? t(P.pageOf, { page: page + 1, total }) : L.closed}
            </p>
            <button
              type="button"
              className={btn}
              onClick={() => {
                markMoving();
                book.current?.peek();
              }}
              disabled={!open}
            >
              {L.peek}
            </button>
            <button
              type="button"
              className={btn}
              aria-label={P.nextPage}
              onClick={() => {
                markMoving();
                book.current?.next();
              }}
            >
              →
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1" role="group" aria-label={L.layout}>
              {(["auto", "single", "spread"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={layout === choice}
                  onClick={() => setLayout(choice)}
                  className={`type-label rounded-chip px-2.5 py-1.5 !text-[9px] ${
                    layout === choice ? "bg-accent-soft text-fg" : "text-subtle"
                  }`}
                >
                  {choice === "auto" ? L.layoutAuto : choice === "single" ? L.layoutSingle : L.layoutSpread}
                </button>
              ))}
            </div>
            <p className="font-mono text-[10px] tracking-[0.04em] text-subtle" aria-hidden="true">
              <span className="text-muted">{L.fps} </span>
              <span ref={nowRef}>{L.fpsIdle}</span> <span ref={worstRef} />
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
