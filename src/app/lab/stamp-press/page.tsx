"use client";

/**
 * /lab/stamp-press: the stamping moment on its own (UX-3).
 * A passport page with an empty slot and a "Collect stamp" button. Repeatable.
 *
 * Debug query parameters (for screenshots and tuning):
 *   ?slot=<slot id>   which stamp to collect
 *   ?t=<seconds>      hold the moment at this time instead of playing it
 *   ?speed=<rate>     playback rate, e.g. 0.25
 *   ?auto=1           start pressing as soon as the page is ready
 *
 * Integration recipe and API: docs/agents/stamp-press.md
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InkSpeckles } from "@/components/moments/stamp-press/InkSpeckles";
import { canVibrate } from "@/components/moments/stamp-press/feedback";
import { StampPressSoundToggle } from "@/components/moments/stamp-press/SoundToggle";
import { pressStrings } from "@/components/moments/stamp-press/strings";
import { Stamp } from "@/components/stamp";
import { ThemeSwitcher, useTheme } from "@/components/theme";
import { DEMO_SCRIPT, SAMPLE_PASSPORT, getProgress, stampForSlot } from "@/lib/sample-data";
import { formatDate, strings, t } from "@/lib/strings";

/*
 * The moment is loaded on demand and warmed up while the visitor reads the page (UX-7).
 * Deliberately not next/dynamic or React.lazy: a component that suspends on first mount is held
 * back by React's 300 ms fallback throttle, which would delay the very first press. The module is
 * imported by hand and the component kept in state, so it mounts in the same frame as the tap.
 */
type PressModule = typeof import("@/components/moments/StampPress");
let pressModule: Promise<PressModule> | null = null;
const loadPress = () => (pressModule ??= import("@/components/moments/StampPress"));

const L = pressStrings.lab;
// The demo script's slot first, then the other empty slots: between them they cover every shape.
const EMPTY_SLOTS = SAMPLE_PASSPORT.slots
  .filter((s) => !s.stamp)
  .sort((a, b) => Number(b.id === DEMO_SCRIPT.collectSlotId) - Number(a.id === DEMO_SCRIPT.collectSlotId));
const BASE = getProgress(SAMPLE_PASSPORT);
const HERO = 176;
const SMALL = 84;

function Chip({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick(): void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`shrink-0 rounded-chip px-3.5 py-2 text-[13px] font-semibold leading-none transition-colors ${
        selected ? "bg-fg text-bg" : "bg-elev text-muted shadow-[inset_0_0_0_1px_var(--line)]"
      }`}
      style={{ touchAction: "manipulation" }}
    >
      {children}
    </button>
  );
}

export default function StampPressLabPage() {
  const prefersReduced = useReducedMotion() ?? false;
  const [hydrated, setHydrated] = useState(false);
  // The server cannot know the visitor's motion preference: adopt it after hydration.
  const reduced = hydrated && prefersReduced;
  const { tokens } = useTheme();
  const [slotId, setSlotId] = useState<string>(DEMO_SCRIPT.collectSlotId);
  const [collected, setCollected] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [run, setRun] = useState(0);
  const [toast, setToast] = useState(false);
  const [sound, setSound] = useState(false);
  const [slow, setSlow] = useState(false);
  const [haptics, setHaptics] = useState<boolean | null>(null);
  const [debug, setDebug] = useState<{ freezeAt?: number; speed?: number }>({});
  const [Press, setPress] = useState<PressModule["StampPress"] | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const slot = useMemo(() => SAMPLE_PASSPORT.slots.find((s) => s.id === slotId) ?? EMPTY_SLOTS[0], [slotId]);
  const island = SAMPLE_PASSPORT.islands.find((i) => i.id === slot.islandId)!;
  const siblings = SAMPLE_PASSPORT.slots.filter((s) => s.islandId === slot.islandId && s.id !== slot.id);
  const stamp = useMemo(() => stampForSlot(slot.id, "discovery", DEMO_SCRIPT.today), [slot.id]);
  const islandHeld = siblings.filter((s) => s.stamp).length + (collected ? 1 : 0);
  const count = BASE.collected + (collected ? 1 : 0);

  const collect = useCallback(() => {
    if (pressing) return;
    setToast(false);
    setCollected(false);
    setRun((n) => n + 1);
    setPressing(true);
    // Normally loaded long before the first tap. If not, the press starts as soon as it arrives.
    void loadPress().then((m) => setPress(() => m.StampPress));
  }, [pressing]);

  useEffect(() => {
    setHydrated(true);
    setHaptics(canVibrate());
    // Warm the moment up once the page is idle, so the first press starts instantly.
    const warm = () => void loadPress().then((m) => setPress(() => m.StampPress));
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(warm) : window.setTimeout(warm, 600);
    void id;

    const q = new URLSearchParams(window.location.search);
    const wanted = q.get("slot");
    if (wanted && SAMPLE_PASSPORT.slots.some((s) => s.id === wanted)) setSlotId(wanted);
    const freeze = q.get("t");
    const speed = q.get("speed");
    setDebug({
      freezeAt: freeze != null && freeze !== "" ? Number(freeze) : undefined,
      speed: speed ? Number(speed) : undefined,
    });
    if (freeze != null || q.get("auto")) {
      setRun((n) => n + 1);
      setPressing(true);
    }
  }, []);

  // Warm the die artwork for whichever stamp and direction is showing.
  useEffect(() => {
    let live = true;
    void loadPress().then((m) => {
      if (live) m.preloadStampPress(stamp, tokens, HERO);
    });
    return () => {
      live = false;
    };
  }, [stamp, tokens]);

  const choose = (id: string) => {
    if (pressing) return;
    setSlotId(id);
    setCollected(false);
    setToast(false);
  };

  const toggleClass =
    "inline-flex items-center gap-2 rounded-chip px-3.5 py-2.5 text-[13px] font-semibold leading-none text-muted shadow-[inset_0_0_0_1px_var(--line)] transition-colors aria-checked:bg-accent-soft aria-checked:text-fg aria-checked:shadow-[inset_0_0_0_1px_var(--line-strong)]";

  return (
    <main className="scene-bg min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-[color:color-mix(in_srgb,var(--bg)_86%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[20px] leading-none text-fg">{L.title}</h1>
            <span className="sample-tag mt-1.5">{strings.sample.tag}</span>
          </div>
          <ThemeSwitcher variant="compact" />
        </div>
      </header>

      <div className="mx-auto max-w-[430px] px-4 pb-16 pt-5">
        {/* Progress, ticking on impact (UX-1b) */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="type-label text-subtle">{L.pageLabel}</p>
          <p className="type-label flex items-center gap-2 text-muted" aria-live="polite">
            <motion.span
              key={count}
              initial={reduced || count === BASE.collected ? false : { scale: 1.5, color: "var(--accent)" }}
              animate={{ scale: 1, color: "var(--fg)" }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              className="inline-block font-semibold"
            >
              {count}
            </motion.span>
            <span>{t(strings.progress.ring, { n: "", total: BASE.total, province: SAMPLE_PASSPORT.province }).trim()}</span>
          </p>
        </div>

        {/* The passport page */}
        <div
          ref={surfaceRef}
          data-press-surface=""
          className="mat-paper relative overflow-hidden rounded-page shadow-[inset_0_0_0_1px_var(--paper-edge),0_1px_2px_rgba(0,0,0,.1),0_24px_48px_-24px_rgba(0,0,0,.5)]"
        >
          <div className="relative px-5 pb-6 pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="type-label text-paper-muted">{t(strings.province.of, { province: island.province })}</p>
              <p className="type-label text-paper-muted">
                {t(strings.passport.stampsOnIsland, { n: islandHeld, total: siblings.length + 1 })}
              </p>
            </div>
            <h2 className="font-display mt-1.5 text-[34px] leading-[1] text-paper-ink">{island.name}</h2>
            <div className="mt-3 h-px bg-[color:var(--paper-edge)]" />

            {/* The slot */}
            <div className="mt-6 flex flex-col items-center">
              <div ref={slotRef} className="relative" style={{ width: HERO, height: HERO }}>
                {collected ? (
                  <>
                    <Stamp stamp={stamp} size={HERO} />
                    <InkSpeckles stamp={stamp} size={HERO} />
                  </>
                ) : (
                  <Stamp slot={slot} size={HERO} />
                )}
              </div>
              <p className="font-display mt-4 text-[21px] leading-none text-paper-ink">{slot.title}</p>
              <p className="type-label mt-2 flex items-center gap-1.5 text-paper-muted">
                {collected && <span className="inline-block size-1.5 rounded-full" style={{ background: "var(--ink-discovery)" }} />}
                {collected ? `${strings.status.discovery.label} / ${formatDate(stamp.date)}` : strings.stamp.empty}
              </p>
            </div>

            {siblings.length > 0 && (
              <div className="mt-6 flex items-start justify-center gap-5 border-t border-dashed border-[color:var(--paper-edge)] pt-5">
                {siblings.map((s) => (
                  <Stamp key={s.id} stamp={s.stamp} slot={s} size={SMALL} />
                ))}
              </div>
            )}
          </div>
          <div className="mat-page-dim absolute inset-0" aria-hidden="true" />
        </div>

        {/* What just happened. Fixed height, so the button below never moves. */}
        <div className="relative mt-3 h-[84px]">
          <AnimatePresence>
            {toast && (
              <motion.div
                role="status"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="absolute inset-x-0 top-0 flex items-start gap-3 rounded-card bg-elev px-4 py-3 shadow-[0_0_0_1px_var(--line),0_10px_24px_-14px_rgba(0,0,0,.4)]"
              >
                <span className="mt-1 inline-block size-2.5 shrink-0 rounded-full" style={{ background: "var(--status-discovery)" }} />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-tight text-fg">{strings.moments.stampEarnedTitle}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">
                    {t(strings.moments.stampEarnedBody, { title: stamp.title, island: stamp.island })}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <p
            className="px-1 pt-1 text-[13px] leading-snug text-subtle transition-opacity duration-200"
            style={{ opacity: toast ? 0 : 1 }}
            aria-hidden={toast}
          >
            {reduced ? L.reducedMotion : L.intro}
          </p>
        </div>

        {/* Controls */}
        <button
          type="button"
          onClick={collect}
          aria-disabled={pressing}
          onPointerEnter={() => void loadPress()}
          onFocus={() => void loadPress()}
          className="mt-3 flex h-[54px] w-full items-center justify-center rounded-chip bg-accent text-[16px] font-semibold tracking-[0.01em] text-accent-fg shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_10px_22px_-10px_var(--accent)] transition-[transform,opacity] duration-150 active:scale-[0.98] aria-disabled:opacity-60"
          style={{ touchAction: "manipulation" }}
        >
          {collected ? strings.actions.replay : strings.actions.collect}
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StampPressSoundToggle sound={sound} onSoundToggle={setSound} className={toggleClass} />
          <button
            type="button"
            role="switch"
            aria-checked={slow}
            onClick={() => setSlow((v) => !v)}
            className={toggleClass}
            style={{ touchAction: "manipulation" }}
          >
            <span aria-hidden="true" className="font-mono text-[11px]">
              {slow ? "0.25x" : "1x"}
            </span>
            {L.slowMotion}
          </button>
        </div>

        <p className="mt-3 flex items-center gap-2 px-1 text-[12px] text-subtle">
          <span
            aria-hidden="true"
            className="inline-block size-1.5 rounded-full"
            style={{ background: haptics ? "var(--status-verified)" : "var(--fg-subtle)" }}
          />
          {L.haptics}: {haptics == null ? "" : haptics ? L.hapticsOn : L.hapticsOff}
        </p>

        <p id="press-choose" className="type-label mb-2 mt-7 px-1 text-subtle">
          {L.choose}
        </p>
        <div role="radiogroup" aria-labelledby="press-choose" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {EMPTY_SLOTS.map((s) => (
            <Chip key={s.id} selected={s.id === slot.id} onClick={() => choose(s.id)}>
              {s.title}
            </Chip>
          ))}
        </div>

        <footer className="mt-8 px-1 text-[12px] leading-relaxed text-subtle">
          <p>{strings.sample.notice}</p>
          <p>{strings.sample.noDonations}</p>
        </footer>
      </div>

      {pressing && Press && (
        <Press
          key={run}
          stamp={stamp}
          target={slotRef}
          surface={surfaceRef}
          announce={false}
          sound={sound}
          speed={debug.speed ?? (slow ? 0.25 : 1)}
          freezeAt={debug.freezeAt}
          onImpact={() => setCollected(true)}
          onComplete={() => {
            setPressing(false);
            setToast(true);
          }}
        />
      )}
    </main>
  );
}
