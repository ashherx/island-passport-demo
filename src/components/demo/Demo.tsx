"use client";

/**
 * The composed demo (home page): header with the progress ring, the interactive passport on the
 * StPageFlip engine, and a scripted story driven from the floating action bar:
 *
 *   1. Collect a stamp      StampPress into the empty slot, Discovery, the ring ticks up
 *   2. Donate               the same stamp becomes "Donation pending" (never shown as donated)
 *   3. Charity confirms     StatusUpgrade to Verified Supporter
 *   then                    three Verified stamps unlock the Provincial Stamp: ProvincialAward
 *
 * The step is derived from the passport data, so "Replay" is simply the sample data again.
 * Every step first turns the book to the right page, then plays its moment on the page itself.
 *
 * Timing: the button and the toast follow what is on screen, not the teardown of an overlay. Each
 * moment reports its visible hit (the stamper's impact, the ink swap, the seal, the landing) and
 * the demo hands the button back and drops the toast a fixed beat after it. A tap that arrives
 * while the previous overlay is still fading is queued behind it, never lost.
 *
 * Loading (UX-7): the closed cover is server-rendered. The inside pages render when the browser
 * is idle (or when the cover is first touched), the flip library loads at idle inside
 * PassportBook, and the three moments are imported at idle and kept in state.
 */
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { Header } from "@/components/chrome";
import { vibrate } from "@/components/moments/celebrations/haptics";
import { nudge } from "@/components/moments/stamp-press/feedback";
import { InkSpeckles } from "@/components/moments/stamp-press/InkSpeckles";
import { StampPressSoundToggle } from "@/components/moments/stamp-press/SoundToggle";
import type { StatusUpgradeHandle } from "@/components/moments/StatusUpgrade";
import { getPassportPageMap, usePassportContent, type SlotOverride } from "@/components/passport/content";
import {
  CoverGlobeFace,
  CoverMapCredit,
  CoverOpenCta,
  useCoverBook,
  type CoverBook,
  type CoverGlobeController,
  type CoverStop,
} from "@/components/passport/cover-globe";
import PassportBook, { type BookState, type PassportBookLibHandle } from "@/components/passport/engine-lib";
import { ThemeSwitcher, useTheme } from "@/components/theme";
import {
  SAMPLE_PASSPORT,
  findSlot,
  getProgress,
  provincialUnlocked,
  stampForSlot,
  withProvincialEarned,
  withStampStatus,
} from "@/lib/sample-data";
import { play, stopAllSounds } from "@/lib/sound";
import { strings, t } from "@/lib/strings";
import type { PassportData, Stamp } from "@/lib/types";
import { ActionBar, type JumpStep, type StoryStep } from "./ActionBar";
import { DonateTransition } from "./DonateTransition";
import { FpsMeter } from "./FpsMeter";
import { Notice, type NoticeData, type NoticeTone } from "./Notice";
import { STORY } from "./story";
import "./demo.css";

const D = strings.demo;

/* ------------------------------------------------------------------ */
/* The moments, loaded by hand                                         */
/* ------------------------------------------------------------------ */

/*
 * Not next/dynamic or React.lazy: a component that suspends on its first mount is held back by
 * React's Suspense throttle, which would delay the first stamp by a third of a second. The modules
 * are imported at idle and the components kept in state (see docs/agents/stamp-press.md).
 */
type PressModule = typeof import("@/components/moments/StampPress");
type UpgradeModule = typeof import("@/components/moments/StatusUpgrade");
type AwardModule = typeof import("@/components/moments/ProvincialAward");

interface Moments {
  StampPress: PressModule["StampPress"];
  preloadStampPress: PressModule["preloadStampPress"];
  StatusUpgrade: UpgradeModule["StatusUpgrade"];
  ProvincialAward: AwardModule["ProvincialAward"];
}

let momentsPromise: Promise<Moments> | null = null;

function loadMoments(): Promise<Moments> {
  if (!momentsPromise) {
    momentsPromise = Promise.all([
      import("@/components/moments/StampPress"),
      import("@/components/moments/StatusUpgrade"),
      import("@/components/moments/ProvincialAward"),
    ])
      .then(([press, upgrade, award]) => ({
        StampPress: press.StampPress,
        preloadStampPress: press.preloadStampPress,
        StatusUpgrade: upgrade.StatusUpgrade,
        ProvincialAward: award.ProvincialAward,
      }))
      .catch((error) => {
        momentsPromise = null;
        throw error;
      });
  }
  return momentsPromise;
}

function whenIdle(run: () => void, timeout = 1500): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(run, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 220);
  return () => window.clearTimeout(id);
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
  else mq.addListener(onChange);
  return () => {
    if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
    else mq.removeListener(onChange);
  };
}

/** UX-5. False on the server and during hydration, then the device setting. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/**
 * The notice's blip, in seconds after the notice is asked for: React commits it a frame or two
 * later and it then drops in on a spring, so the blip lands as it becomes readable (measured, see
 * docs/agents/sound.md).
 */
const TOAST_SOUND_DELAY = 0.09;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** The next painted frame (or 50 ms, when the tab is hidden and frames do not run). */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, 50);
    window.requestAnimationFrame(finish);
  });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Busy = null | "collect" | "donate" | "confirm" | "award" | "reset";

interface PressRun {
  run: number;
  slotId: string;
  stamp: Stamp;
  target: Element;
}

interface InlineRun {
  run: number;
  kind: "donate" | "confirm";
  slotId: string;
  /** The stamp as it was when the moment started. */
  stamp: Stamp;
}

/** Where each page is. The page order depends only on the islands, which the story never changes. */
const PAGE_MAP = getPassportPageMap(SAMPLE_PASSPORT);

const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", "Escape"]);

/** The square box that holds a slot's stamp on the page that is lying open. */
function slotBox(root: HTMLElement | null, slotId: string): HTMLElement | null {
  return root?.querySelector<HTMLElement>(`.ipb__pages [data-slot-id="${slotId}"] .ipp-slot__stamp`) ?? null;
}

/**
 * Width of a slot's stamp box in px, whether or not its page is showing. 0 when unknown.
 * The flip library does not lay out pages that are not showing. Their slots are sized in units of
 * the page width (`--slot` units of width / 360, see content.css), so a page that is laid out
 * gives the answer. Only used to prepare the stamper early: the press itself measures the slot.
 */
function slotSize(root: HTMLElement | null, slotId: string): number {
  const box = slotBox(root, slotId);
  if (!box || !root) return 0;
  if (box.offsetWidth > 0) return Math.round(box.offsetWidth);
  const units = parseFloat(box.closest<HTMLElement>(".ipp-slot")?.style.getPropertyValue("--slot") ?? "");
  if (!(units > 0)) return 0;
  for (const canvas of root.querySelectorAll<HTMLElement>(".ipb__pages .ipp-canvas")) {
    if (canvas.offsetWidth > 0) return Math.round((canvas.offsetWidth * units) / 360);
  }
  return 0;
}

/** Attribute of the book's root element, followed without re-rendering the demo. */
function useBookAttr(root: RefObject<HTMLElement | null>, name: string): string | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const el = root.current?.querySelector(".ipb");
      if (!el || typeof MutationObserver === "undefined") return () => {};
      const observer = new MutationObserver(onChange);
      observer.observe(el, { attributes: true, attributeFilter: [name] });
      return () => observer.disconnect();
    },
    [root, name],
  );
  return useSyncExternalStore(
    subscribe,
    () => root.current?.querySelector(".ipb")?.getAttribute(name) ?? null,
    () => null,
  );
}

function storyStep(passport: PassportData): StoryStep {
  const status = findSlot(passport, STORY.slotId)?.stamp?.status;
  if (!status) return "collect";
  if (status === "discovery") return "donate";
  if (status === "pending") return "confirm";
  if (!passport.provincial.earned && provincialUnlocked(passport)) return "award";
  return "done";
}

const EMPTY_PAGES_CACHE = new Map<number, ReactNode[]>();
/** Stable placeholder array while the inside pages are not rendered yet. */
function emptyPages(count: number): ReactNode[] {
  let pages = EMPTY_PAGES_CACHE.get(count);
  if (!pages) {
    pages = Array.from({ length: count }, () => null);
    EMPTY_PAGES_CACHE.set(count, pages);
  }
  return pages;
}

/**
 * The page lying open, kept outside React state: a riffle passes four pages in a second, and only
 * the hint under the book cares. It subscribes on its own, so the demo does not re-render per page.
 */
interface PageStore {
  get(): number;
  set(page: number): void;
  subscribe(listener: () => void): () => void;
}

function createPageStore(): PageStore {
  let page = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => page,
    set(next) {
      if (next === page) return;
      page = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

interface HintProps {
  store: PageStore;
  passport: PassportData;
  /** The wrapper the book lives in: its side and layout are read from the book's root element. */
  root: RefObject<HTMLElement | null>;
  open: boolean;
  quiet: boolean;
  /**
   * Reduced motion is on and the book has not been opened yet: say so, and offer the full motion
   * once (this page is a motion demo).
   */
  motionChoice: boolean;
  onFullMotion(): void;
  pulse: boolean;
  pageCount: number;
  /** The cover globe's director, and what its "Open to ..." button does. */
  cover: CoverGlobeController;
  onOpenCover(): void;
  /** The open passport: close it (the cover comes back on the island of the page it was closed from). */
  onCloseBook(): void;
}

/* Two short lines inside the height the layout reserves for one. demo.css styles `.ipd-hint__btn`
   beyond this reset. */
const HINT_CHOICE: CSSProperties = { flexDirection: "column", gap: 3, lineHeight: 1.05, letterSpacing: "0.08em" };
const HINT_BUTTON: CSSProperties = {
  margin: "-7px -12px",
  padding: "7px 12px",
  border: 0,
  background: "none",
  font: "inherit",
  letterSpacing: "inherit",
  textTransform: "inherit",
  color: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  cursor: "pointer",
  touchAction: "manipulation",
};

function Hint({ store, passport, root, open, quiet, motionChoice, onFullMotion, pulse, pageCount, cover, onOpenCover, onCloseBook }: HintProps) {
  const page = useSyncExternalStore(store.subscribe, store.get, () => 0);
  const side = useBookAttr(root, "data-side");
  const spread = useBookAttr(root, "data-mode") === "double";

  // The pages lying open: one, or the pair of a spread.
  const first = spread ? page - (page % 2) : page;
  const last = spread ? Math.min(first + 1, pageCount - 1) : page;

  let hint: string;
  if (motionChoice) hint = D.reducedOn;
  else if (!open) hint = side === "back" ? D.hintBack : D.hintOpen;
  else {
    // What the open pages invite: a stamp to tap, an empty slot to stamp, or turning on.
    const islandIds = Object.keys(PAGE_MAP.islands).filter((id) => PAGE_MAP.islands[id] >= first && PAGE_MAP.islands[id] <= last);
    const slots = passport.slots.filter((slot) => islandIds.includes(slot.islandId));
    const provincialShown = PAGE_MAP.provincial >= first && PAGE_MAP.provincial <= last;
    if (provincialShown && passport.provincial.earned) hint = D.hintStamp;
    else if (slots.some((slot) => !slot.stamp)) hint = D.hintEmpty;
    else if (slots.length > 0) hint = D.hintStamp;
    else hint = D.hintSwipe;
  }
  // The closed passport, face up: the hint is the button that opens it to the globe's island.
  if (!open && side !== "back") {
    return (
      <div className="ipd-hint ipd-hint--cta" aria-hidden={quiet || undefined} data-quiet={quiet ? "" : undefined}>
        <CoverOpenCta controller={cover} onOpen={onOpenCover} pulse={pulse} className="ipd-hint__cta" />
        <CoverMapCredit />
        {motionChoice && !quiet && (
          // Reduced motion is on: the full motion is offered once, beside the button.
          <button type="button" className="ipd-hint__btn" style={HINT_BUTTON} title={D.reducedOn} onClick={onFullMotion}>
            {D.playFull}
          </button>
        )}
      </div>
    );
  }
  return (
    <p className="ipd-hint" aria-hidden={quiet || undefined} data-quiet={quiet ? "" : undefined}>
      <span key={hint} className="ipd-hint__text" style={motionChoice ? HINT_CHOICE : undefined}>
        {!open && !motionChoice && pulse && <i className="ipd-hint__pulse" aria-hidden="true" />}
        {hint}
        {motionChoice && !quiet && (
          <button type="button" className="ipd-hint__btn" style={HINT_BUTTON} onClick={onFullMotion}>
            {D.playFull}
          </button>
        )}
      </span>
      {open && (
        <span className="ipd-hint__page">
          {last > first
            ? t(D.pagesOf, { from: first + 1, to: last + 1, total: pageCount })
            : t(D.pageOf, { page: page + 1, total: pageCount })}
        </span>
      )}
      {open && !quiet && (
        // Swiping back past the first page closes the book too; this says so in one word.
        <button type="button" className="ipd-hint__btn ipd-hint__close" onClick={onCloseBook}>
          {D.close}
        </button>
      )}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function Demo() {
  const { tokens, direction } = useTheme();
  const systemReduced = usePrefersReducedMotion();
  /** Reduce Motion is on, and the visitor asked to see the full motion anyway. Never persisted. */
  const [fullMotion, setFullMotion] = useState(false);
  const reduced = systemReduced && !fullMotion;
  /** Handed to everything that reads the device setting itself: undefined leaves that untouched. */
  const motionOverride = fullMotion ? false : undefined;

  const [passport, setPassport] = useState<PassportData>(SAMPLE_PASSPORT);
  const [bookState, setBookState] = useState<BookState>("closed");
  /** The cover's foil follows the pointer only while the book lies closed. Changed at rest, never mid-swing. */
  const [coverIdle, setCoverIdle] = useState(true);
  const [busy, setBusyState] = useState<Busy>(null);
  /** Collect: the book still has to open or turn to the page before the stamper appears. */
  const [opening, setOpening] = useState(false);
  /** Verified count shown on the button between the seal landing and the award opening. */
  const [bridge, setBridge] = useState<number | null>(null);
  const [press, setPress] = useState<PressRun | null>(null);
  const [inline, setInline] = useState<InlineRun | null>(null);
  const [awardOpen, setAwardOpen] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  /** Stamps ringed for a moment when the passport opens on their island from the cover globe. */
  const [arrived, setArrived] = useState<string[]>([]);
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [moments, setMoments] = useState<Moments | null>(null);
  /** Inside pages are rendered (after idle, or as soon as the cover is touched). */
  const [live, setLive] = useState(false);
  const [wide, setWide] = useState(false);
  const [started, setStarted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [debug, setDebug] = useState(false);

  const [pageStore] = useState(createPageStore);
  const book = useRef<PassportBookLibHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const upgradeRef = useRef<StatusUpgradeHandle>(null);

  /**
   * The passport data as the story knows it, updated the moment something happens. The `passport`
   * state follows it, often as a transition in the middle of an animation, so decisions (which
   * step is next, is this slot empty) are taken from here and never from a render that is behind.
   */
  const dataRef = useRef(passport);
  const busyRef = useRef<Busy>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const runId = useRef(0);
  const noticeId = useRef(0);
  const timers = useRef<number[]>([]);
  const closeStampRef = useRef<() => void>(() => {});
  const onActionRef = useRef<() => void>(() => {});
  const flipWaiter = useRef<{ page: number; resolve(): void } | null>(null);
  const stateWaiter = useRef<{ state: BookState; resolve(): void } | null>(null);
  /** Calls to ensureAt run one after another. */
  const navChain = useRef<Promise<void>>(Promise.resolve());
  /** Moment overlays that are still mounted, and whoever is waiting for them to go. */
  const overlays = useRef({ press: false, inline: false, award: false });
  const overlayWaiters = useRef<Array<() => void>>([]);
  /** Hand-backs (button, toast) scheduled from a moment's impact and not yet run. */
  const beats = useRef<Array<() => void>>([]);
  const upgradeImpactAt = useRef(0);
  const awardTimer = useRef(0);
  const awardRun = useRef<{ travel: Promise<void> | null; landed: boolean; arrived: boolean } | null>(null);
  /** The cover globe's wiring (set below, once the book's navigation exists). */
  const coverRef = useRef<CoverBook | null>(null);
  const locateRef = useRef<(islandId: string) => void>(() => {});
  const arrivedTimer = useRef(0);

  const setBusy = useCallback((next: Busy) => {
    busyRef.current = next;
    setBusyState(next);
  }, []);
  /** A moment hands the button back, unless something newer has taken it since. */
  const release = useCallback(
    (owner: Exclude<Busy, null>) => {
      if (busyRef.current === owner) setBusy(null);
    },
    [setBusy],
  );

  const say = useCallback((tone: NoticeTone, title: string, body: string, duration?: number) => {
    setNotice({ id: ++noticeId.current, tone, title, body, duration });
    // One soft blip as the notice drops in. Not after the seal or the award: those notices follow
    // the chime and the landing, which are still ringing, and a blip on top of them is clutter.
    if (tone !== "verified" && tone !== "provincial") play.toast({ delay: TOAST_SOUND_DELAY });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const later = useCallback((ms: number, run: () => void): number => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      run();
    }, ms);
    timers.current.push(id);
    return id;
  }, []);
  const cancelLater = useCallback((id: number) => {
    window.clearTimeout(id);
    timers.current = timers.current.filter((t) => t !== id);
  }, []);

  /**
   * Run `fn` once, `ms` after a moment's impact, so the button and the toast read as the echo of
   * the hit. If the moment ends first (a skip, a direction switch), flushBeats() runs it then.
   */
  const beat = useCallback(
    (ms: number, fn: () => void) => {
      let done = false;
      const run = () => {
        if (done) return;
        done = true;
        beats.current = beats.current.filter((b) => b !== run);
        fn();
      };
      beats.current.push(run);
      later(ms, run);
    },
    [later],
  );
  const flushBeats = useCallback(() => {
    const pending = beats.current;
    beats.current = [];
    pending.forEach((run) => run());
  }, []);

  /** Resolves when no stamping or in-slot overlay is mounted any more (900 ms at most). */
  const overlayGone = useCallback(() => {
    return new Promise<void>((resolve) => {
      const o = overlays.current;
      if (!o.press && !o.inline && !o.award) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(finish, 900);
      overlayWaiters.current.push(finish);
    });
  }, []);
  const overlayEnded = useCallback((which: "press" | "inline" | "award") => {
    overlays.current[which] = false;
    const waiting = overlayWaiters.current;
    overlayWaiters.current = [];
    waiting.forEach((resolve) => resolve());
  }, []);

  /** Change the passport data. A transition unless `urgent`: most changes land mid-animation. */
  const apply = useCallback((next: PassportData, opts: { urgent?: boolean; fresh?: (list: string[]) => string[] } = {}) => {
    dataRef.current = next;
    const commit = () => {
      setPassport(next);
      if (opts.fresh) setFresh(opts.fresh);
    };
    if (opts.urgent) commit();
    else startTransition(commit);
  }, []);
  /**
   * Make the rendered passport catch up with the data now, if a transition is still on its way.
   * Called when the button is handed back, so the step it offers is always the real one.
   */
  const settle = useCallback(() => setPassport(dataRef.current), []);

  /* --------------------------- loading --------------------------- */

  const warm = useCallback(() => {
    void loadMoments().then(
      (m) => setMoments((prev) => prev ?? m),
      () => {},
    );
  }, []);

  useEffect(() => {
    setHydrated(true);
    const cancelPages = whenIdle(() => startTransition(() => setLive(true)), 300);
    const cancelMoments = whenIdle(warm, 2500);
    const debugging = /[?&]debug\b/.test(window.location.search);
    setDebug(debugging);
    // For checking on a device and for the test scripts: the book handle, only with ?debug.
    if (debugging) (window as unknown as { __ipBook?: () => PassportBookLibHandle | null }).__ipBook = () => book.current;

    // A tap made before the page was interactive (remembered by the script in layout.tsx) is
    // answered now. One task later, so the book has finished its own first effects.
    const w = window as unknown as { __ipEarly?: string };
    const early = w.__ipEarly;
    const replayEarly =
      early === "cta" || early === "cover"
        ? window.setTimeout(() => {
            w.__ipEarly = undefined;
            if (early === "cta") onActionRef.current();
            else {
              setLive(true);
              warm();
              book.current?.open();
            }
          }, 0)
        : 0;
    return () => {
      cancelPages();
      cancelMoments();
      window.clearTimeout(replayEarly);
    };
  }, [warm]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      // Leaving the page: nothing goes on ringing over the next one.
      stopAllSounds();
    },
    [],
  );

  // The book lays out a two-page spread from 780px of width (a container query on its root).
  useEffect(() => {
    const el = floatRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWide(el.clientWidth >= 780));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The stamper is prepared ahead of time, so the first press starts complete and its bake does
  // not land just before the stamper appears: the artwork as soon as the moments are loaded, the
  // engraved tool at idle once the pages are laid out and the slot's real size is known.
  useEffect(() => {
    if (!moments) return;
    const stamp = stampForSlot(STORY.slotId, "discovery", STORY.today);
    moments.preloadStampPress(stamp, tokens);
    if (!live) return;
    return whenIdle(() => {
      const size = slotSize(floatRef.current, STORY.slotId);
      if (size > 0) moments.preloadStampPress(stamp, tokens, size);
    }, 1200);
  }, [moments, tokens, live, wide]);

  /* ----------------------- book navigation ----------------------- */

  const isSpread = useCallback(() => floatRef.current?.querySelector(".ipb")?.getAttribute("data-mode") === "double", []);

  /** The book lies open on `target` (or on the spread that holds it). */
  const onPage = useCallback(
    (target: number) => {
      const b = book.current;
      if (!b || b.getState() !== "open") return false;
      const here = b.getPage();
      return here === target || (isSpread() && Math.floor(here / 2) === Math.floor(target / 2));
    },
    [isSpread],
  );

  const waitForState = useCallback((state: BookState, timeout: number) => {
    return new Promise<void>((resolve) => {
      if (book.current?.getState() === state) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (stateWaiter.current?.resolve === finish) stateWaiter.current = null;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(finish, timeout);
      stateWaiter.current = { state, resolve: finish };
    });
  }, []);

  const travel = useCallback(
    async (target: number) => {
      const b = book.current;
      if (!b || !(target >= 0)) return;
      setLive(true);
      if (b.getState() !== "open") {
        // A step of the story opens the book: the cover globe's own opening (lens, riffle to its
        // island) stays out of it. When the visitor opened the cover this is a no-op.
        const c = coverRef.current;
        if (c) c.scripted(() => b.open());
        else b.open();
        // The book reports "open" when its pages can be turned; nothing is added on top of that.
        await waitForState("open", 3600);
        if (reducedRef.current) await wait(80);
      }
      if (onPage(target)) {
        await nextFrame();
        return;
      }
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (flipWaiter.current?.resolve === finish) flipWaiter.current = null;
          window.clearTimeout(timer);
          resolve();
        };
        const timer = window.setTimeout(finish, 2600);
        flipWaiter.current = { page: target, resolve: finish };
        b.flipThrough(target);
      });
      if (reducedRef.current) await wait(40);
    },
    [onPage, waitForState],
  );

  /**
   * Open the book if needed and turn to `target`. Resolves when the page has landed. Calls queue
   * behind one another, so two requests never turn the book at the same time.
   */
  const ensureAt = useCallback(
    (target: number) => {
      const run = navChain.current.then(() => travel(target));
      navChain.current = run.catch(() => {});
      return run;
    },
    [travel],
  );

  const onFlip = useCallback(
    (index: number) => {
      pageStore.set(index);
      coverRef.current?.onFlip(index);
      const w = flipWaiter.current;
      if (w && (w.page === index || (isSpread() && Math.floor(w.page / 2) === Math.floor(index / 2)))) w.resolve();
    },
    [isSpread, pageStore],
  );

  const onStateChange = useCallback((state: BookState) => {
    // First, and at once: the cover globe holds still from the moment the cover moves.
    coverRef.current?.onStateChange(state);
    // Not urgent: the book has already put itself in the new state. Keeps the first frame of the swing free.
    startTransition(() => {
      setBookState(state);
      if (state !== "closed") setStarted(true);
      if (state === "open") setCoverIdle(false);
      else if (state === "closed") setCoverIdle(true);
    });
    if (stateWaiter.current?.state === state) stateWaiter.current.resolve();
  }, []);

  /* ------------------------- the cover globe ------------------------- */

  /** The passport has opened on an island from the cover: its locator pulses, its stamps are ringed. */
  const onCoverArrive = useCallback((stop: CoverStop) => {
    locateRef.current(stop.id);
    window.clearTimeout(arrivedTimer.current);
    startTransition(() => setArrived(stop.slotIds));
    arrivedTimer.current = window.setTimeout(() => startTransition(() => setArrived([])), 2300);
  }, []);
  useEffect(() => () => window.clearTimeout(arrivedTimer.current), []);

  const coverBusy = useCallback(() => busyRef.current !== null, []);
  const cover = useCoverBook({
    passport,
    pages: PAGE_MAP.islands,
    book,
    root: floatRef,
    direction,
    reduced,
    // The map engine follows the device setting whatever the visitor chose here.
    reducedTour: systemReduced,
    travel: ensureAt,
    isBusy: coverBusy,
    onArrive: onCoverArrive,
  });
  coverRef.current = cover;
  const coverFace = useMemo(
    () => <CoverGlobeFace controller={cover.controller} province={SAMPLE_PASSPORT.province} />,
    [cover.controller],
  );
  const onFlipStart = useCallback(
    (index: number) => {
      pageStore.set(index);
      coverRef.current?.onFlipStart(index);
    },
    [pageStore],
  );

  /* --------------------------- the story --------------------------- */

  const progress = getProgress(passport);
  const step = storyStep(passport);
  const storySlot = findSlot(passport, STORY.slotId);
  const storyStamp = useMemo(
    () => storySlot?.stamp ?? stampForSlot(STORY.slotId, "discovery", STORY.today),
    [storySlot],
  );

  /** The slot holds a stamp from here on. Idempotent. */
  const collected = useCallback(
    (slotId: string, urgent = false) => {
      const addFresh = (list: string[]) => (list.includes(slotId) ? list : [...list, slotId]);
      const data = dataRef.current;
      const next = findSlot(data, slotId)?.stamp ? data : withStampStatus(data, slotId, "discovery", STORY.today);
      apply(next, { urgent, fresh: addFresh });
    },
    [apply],
  );

  /** The story stamp has this status from here on. Idempotent. */
  const storyStatus = useCallback(
    (status: "pending" | "verified", urgent = false) => {
      const data = dataRef.current;
      const next = findSlot(data, STORY.slotId)?.stamp?.status === status ? data : withStampStatus(data, STORY.slotId, status);
      apply(next, { urgent });
    },
    [apply],
  );

  /** Step 1, and also any empty slot the reader taps: the stamp is pressed onto the page. */
  const collect = useCallback(
    async (slotId: string) => {
      if (busyRef.current) return;
      const slot = findSlot(dataRef.current, slotId);
      if (!slot || slot.stamp) return;
      const page = PAGE_MAP.forSlot(slotId);
      closeStampRef.current();
      setOpening(!onPage(page));
      setBusy("collect");
      dismissNotice();
      const stamp = stampForSlot(slotId, "discovery", STORY.today);
      const stampCollected = () =>
        say("discovery", strings.moments.stampEarnedTitle, t(strings.moments.stampEarnedBody, { title: stamp.title, island: stamp.island }));
      try {
        await overlayGone();
        if (findSlot(dataRef.current, slotId)?.stamp) {
          release("collect");
          return;
        }
        // The stamper is baked for the slot's size while the book is still on its way.
        const known = slotSize(floatRef.current, slotId);
        const loading = loadMoments().then((m) => {
          if (known > 0) m.preloadStampPress(stamp, tokensRef.current, known);
          return m;
        });
        const [m] = await Promise.all([loading, ensureAt(page)]);
        setMoments((prev) => prev ?? m);
        const target = slotBox(floatRef.current, slotId);
        if (!target) throw new Error("slot not on screen");
        const size = Math.round(target.getBoundingClientRect().width);
        if (size !== known) m.preloadStampPress(stamp, tokensRef.current, size);
        if (reducedRef.current) await wait(40);
        overlays.current.press = true;
        setPress({ run: ++runId.current, slotId, stamp, target });
      } catch {
        // The moment could not load or the slot is not on screen: the stamp still arrives.
        collected(slotId, true);
        stampCollected();
        release("collect");
      }
    },
    [collected, dismissNotice, ensureAt, onPage, overlayGone, release, say, setBusy],
  );

  /* The data changes below land in the middle of an animation. They are transitions, so React
     renders the pages they touch in slices between frames instead of in one long task. */
  const onPressImpact = useCallback(
    (stamp: Stamp) => {
      collected(stamp.id);
      // The echo of the hit: the toast drops in and the button offers the next step while the
      // stamper is still lifting away.
      beat(200, () => {
        settle();
        say("discovery", strings.moments.stampEarnedTitle, t(strings.moments.stampEarnedBody, { title: stamp.title, island: stamp.island }));
        release("collect");
      });
    },
    [beat, collected, release, say, settle],
  );

  const onPressComplete = useCallback(
    (stamp: Stamp) => {
      // Makes sure the stamp is on the page before the overlay goes, even if the transition has not committed.
      collected(stamp.id, true);
      setPress(null);
      flushBeats();
      release("collect");
      overlayEnded("press");
    },
    [collected, flushBeats, overlayEnded, release],
  );

  /** Steps 2 and 3 play inside the slot itself. */
  const startInline = useCallback(
    async (kind: "donate" | "confirm") => {
      if (busyRef.current) return;
      const from = kind === "donate" ? "discovery" : "pending";
      if (findSlot(dataRef.current, STORY.slotId)?.stamp?.status !== from) return;
      closeStampRef.current();
      setBusy(kind);
      dismissNotice();
      try {
        // A tap made while the last moment is still handing over waits for it, then plays.
        await overlayGone();
        const stamp = findSlot(dataRef.current, STORY.slotId)?.stamp;
        if (!stamp || stamp.status !== from) {
          release(kind);
          return;
        }
        const [m] = await Promise.all([loadMoments(), ensureAt(PAGE_MAP.forSlot(STORY.slotId))]);
        setMoments((prev) => prev ?? m);
        if (reducedRef.current) await wait(40);
        overlays.current.inline = true;
        setInline({ run: ++runId.current, kind, slotId: STORY.slotId, stamp });
      } catch {
        storyStatus(kind === "donate" ? "pending" : "verified", true);
        release(kind);
      }
    },
    [dismissNotice, ensureAt, overlayGone, release, setBusy, storyStatus],
  );

  const startAward = useCallback(async () => {
    if (busyRef.current && busyRef.current !== "award") return;
    cancelLater(awardTimer.current);
    closeStampRef.current();
    setBusy("award");
    dismissNotice();
    try {
      await overlayGone();
      const m = await loadMoments();
      setMoments((prev) => prev ?? m);
      awardRun.current = { travel: null, landed: false, arrived: false };
      overlays.current.award = true;
      setBridge(null);
      // Mounting the dialog is a long render on a slow phone; as a transition it is cut into slices.
      startTransition(() => setAwardOpen(true));
    } catch {
      setBridge(null);
      apply(withProvincialEarned(dataRef.current, STORY.today), { urgent: true });
      release("award");
    }
  }, [apply, cancelLater, dismissNotice, overlayGone, release, setBusy]);

  const onDonateSwap = useCallback(() => {
    vibrate([8]);
    storyStatus("pending");
    const charity = findSlot(dataRef.current, STORY.slotId)?.stamp?.charity ?? "";
    beat(150, () => {
      settle();
      say("pending", strings.moments.pendingTitle, t(D.toast.pendingBody, { charity }), 8500);
      release("donate");
    });
  }, [beat, release, say, settle, storyStatus]);

  const onDonateDone = useCallback(() => {
    storyStatus("pending", true);
    setInline(null);
    flushBeats();
    release("donate");
    overlayEnded("inline");
  }, [flushBeats, overlayEnded, release, storyStatus]);

  const onUpgradeImpact = useCallback(() => {
    upgradeImpactAt.current = performance.now();
    // The book takes the seal, a touch lighter than it takes the stamper.
    if (!reducedRef.current) nudge(floatRef.current, 0.7);
    storyStatus("verified");
    const next = dataRef.current;
    const stamp = findSlot(next, STORY.slotId)?.stamp;
    beat(120, () =>
      say("verified", strings.moments.verifiedTitle, t(strings.moments.verifiedBody, { charity: stamp?.charity ?? "", island: stamp?.island ?? "" }), 3600),
    );
    if (provincialUnlocked(next) && !next.provincial.earned) {
      // STM-4: awarded automatically once the threshold is reached. The button counts the
      // Verified stamps while the seal settles and the toast is read, then the award opens.
      beat(250, () => {
        if (busyRef.current !== "confirm") return;
        settle();
        setBridge(getProgress(dataRef.current).verified);
        setBusy("award");
      });
      awardTimer.current = later(reducedRef.current ? 700 : 1900, () => void startAward());
    } else {
      beat(250, () => {
        settle();
        release("confirm");
      });
    }
  }, [beat, later, release, say, setBusy, settle, startAward, storyStatus]);

  const onUpgradeComplete = useCallback(() => {
    const wasPlaying = overlays.current.inline;
    // Unmounting the overlay re-renders the page under it: a transition, so the settle keeps its frames.
    storyStatus("verified");
    startTransition(() => setInline(null));
    flushBeats();
    release("confirm");
    overlayEnded("inline");
    // Skipped (the moment ended well before its seal would have landed): the award follows sooner.
    if (wasPlaying && !reducedRef.current && busyRef.current === "award" && performance.now() - upgradeImpactAt.current < 500) {
      cancelLater(awardTimer.current);
      awardTimer.current = later(900, () => void startAward());
    }
  }, [cancelLater, flushBeats, later, overlayEnded, release, startAward, storyStatus]);

  const awardTarget = useCallback((): HTMLElement | DOMRect | null => {
    const slot = floatRef.current?.querySelector<HTMLElement>(".ipb__pages [data-provincial-slot]");
    if (!slot) return null;
    const earned = slot.querySelector<HTMLElement>('.ip-stamp:not([data-status="empty"])');
    if (earned) return earned;
    // Not awarded yet: the stamp will be drawn at 80% of the ornate slot, centred in it.
    const r = slot.getBoundingClientRect();
    const size = r.width * 0.8;
    return new DOMRect(r.left + (r.width - size) / 2, r.top + (r.height - size) / 2, size, size);
  }, []);

  const onAwardAdd = useCallback(() => {
    const going = ensureAt(PAGE_MAP.provincial);
    if (awardRun.current) awardRun.current.travel = going;
    return going;
  }, [ensureAt]);

  const onAwardLanded = useCallback(() => {
    // A transition: this commit used to be one long frame exactly on the landing.
    if (!dataRef.current.provincial.earned) apply(withProvincialEarned(dataRef.current, STORY.today));
    const run = awardRun.current;
    if (!run || run.landed) return;
    run.landed = true;
    void (async () => {
      try {
        // After a skip the book is still turning: the button and the toast wait for the page.
        await run.travel;
        // The page is not showing (the phone was turned mid-flight, say): go there first.
        if (!onPage(PAGE_MAP.provincial)) await ensureAt(PAGE_MAP.provincial);
      } catch {
        /* the book could not be turned: still hand back */
      }
      run.arrived = true;
      beat(200, () => {
        settle();
        release("award");
      });
      beat(250, () => {
        const p = dataRef.current;
        say(
          "provincial",
          strings.moments.provincialTitle,
          t(strings.moments.provincialBody, { n: getProgress(p).verified, province: p.province }),
          6000,
        );
      });
    })();
  }, [apply, beat, ensureAt, onPage, release, say, settle]);

  const onAwardComplete = useCallback(() => {
    setAwardOpen(false);
    const run = awardRun.current;
    // Normally the beats have run by now. If the page has not arrived yet they are armed when it does.
    if (!run || run.arrived) {
      flushBeats();
      release("award");
    }
    overlayEnded("award");
  }, [flushBeats, overlayEnded, release]);

  const replay = useCallback(async () => {
    if (busyRef.current) return;
    // Whatever is still ringing (a chime, the award's sparkles, a page in the air) stops here.
    stopAllSounds();
    closeStampRef.current();
    dismissNotice();
    const b = book.current;
    const o = overlays.current;
    if ((b && b.getState() !== "closed") || o.press || o.inline || o.award) {
      setBusy("reset");
      await overlayGone();
      await navChain.current;
      if (b && b.getState() !== "closed") {
        b.close();
        await waitForState("closed", 2200);
      }
    }
    // Only now, with the book shut: face up, first page ready under the cover.
    b?.turnOver("front");
    b?.goTo(0);
    pageStore.set(0);
    dataRef.current = SAMPLE_PASSPORT;
    busyRef.current = null;
    say("neutral", D.toast.reset, D.toast.resetBody, 2600);
    // The pages are hidden under the cover, which is still settling: nothing here is urgent, and
    // the button changes once, with the data.
    startTransition(() => {
      setBusyState(null);
      setBridge(null);
      setPassport(SAMPLE_PASSPORT);
      setFresh([]);
    });
  }, [dismissNotice, overlayGone, pageStore, say, setBusy, waitForState]);

  /** A step in the bar was tapped: the sample data as it is at the start of that step. Data only. */
  const jump = useCallback(
    async (to: JumpStep) => {
      if (busyRef.current) return;
      // The story is put somewhere else: the last moment's sound does not carry over.
      stopAllSounds();
      closeStampRef.current();
      dismissNotice();
      const o = overlays.current;
      if (o.press || o.inline || o.award) {
        // The last moment is still handing over (half a second at most): hold the story, quietly.
        busyRef.current = "reset";
        await overlayGone();
        busyRef.current = null;
      }
      const status = to === "donate" ? "discovery" : to === "confirm" ? "pending" : "verified";
      const next = to === "collect" ? SAMPLE_PASSPORT : withStampStatus(SAMPLE_PASSPORT, STORY.slotId, status, STORY.today);
      setBridge(null);
      apply(next, { urgent: true, fresh: () => (to === "collect" ? [] : [STORY.slotId]) });
      void ensureAt(PAGE_MAP.forSlot(STORY.slotId));
    },
    [apply, dismissNotice, ensureAt, overlayGone],
  );

  const onAction = useCallback(() => {
    if (busyRef.current) return;
    closeStampRef.current();
    switch (storyStep(dataRef.current)) {
      case "collect":
        void collect(STORY.slotId);
        break;
      case "donate":
        void startInline("donate");
        break;
      case "confirm":
        void startInline("confirm");
        break;
      case "award":
        void startAward();
        break;
      default:
        void replay();
    }
  }, [collect, replay, startAward, startInline]);
  onActionRef.current = onAction;

  /* --------------------------- content --------------------------- */

  // Ink flecks stay beside the stamps pressed in this session. One function per slot and status,
  // so a page only re-renders when one of its own slots changes.
  const flecks = useRef(new Map<string, (px: number) => ReactNode>());
  const fleckFor = useCallback((stamp: Stamp) => {
    const key = `${stamp.id}:${stamp.status}`;
    let fn = flecks.current.get(key);
    if (!fn) {
      fn = (px: number) => <InkSpeckles stamp={stamp} size={px} />;
      flecks.current.set(key, fn);
    }
    return fn;
  }, []);

  const inlineRender = useMemo(() => {
    if (!inline || !moments) return undefined;
    const { StatusUpgrade } = moments;
    const { kind, run, stamp } = inline;
    if (kind === "donate") {
      return function renderDonate(px: number, detail: "full" | "auto") {
        return (
          <DonateTransition
            key={run}
            stamp={stamp}
            size={px}
            detail={detail}
            reduced={motionOverride}
            onSwap={onDonateSwap}
            onDone={onDonateDone}
          />
        );
      };
    }
    return function renderUpgrade(px: number, detail: "full" | "auto") {
      return (
        <StatusUpgrade
          key={run}
          ref={upgradeRef}
          stamp={stamp}
          size={px}
          detail={detail}
          label={false}
          autoPlay
          delay={0}
          reducedMotion={motionOverride}
          onImpact={onUpgradeImpact}
          onComplete={onUpgradeComplete}
        />
      );
    };
  }, [inline, moments, motionOverride, onDonateDone, onDonateSwap, onUpgradeComplete, onUpgradeImpact]);

  const slotOverrides = useMemo(() => {
    const overrides: Record<string, SlotOverride> = {};
    for (const id of fresh) {
      const stamp = findSlot(passport, id)?.stamp;
      if (stamp) overrides[id] = { after: fleckFor(stamp) };
    }
    for (const id of arrived) overrides[id] = { ...overrides[id], highlight: true };
    if (inline && inlineRender) overrides[inline.slotId] = { ...overrides[inline.slotId], render: inlineRender };
    return overrides;
  }, [fresh, arrived, passport, inline, inlineRender, fleckFor]);

  const onEmptySlotSelect = useCallback((slot: { id: string }) => void collect(slot.id), [collect]);
  /** The map hand-off: an island tapped on the Province page riffles the passport to its page. */
  const onIslandSelect = useCallback(
    (islandId: string) => {
      const page = PAGE_MAP.islands[islandId];
      if (busyRef.current || typeof page !== "number") return;
      const from = document.activeElement;
      const inBook = !!from && !!floatRef.current?.contains(from);
      void ensureAt(page).then(() => {
        // The row that was activated lies on a page that has been turned away. Keyboard focus
        // stays in the book (on the open pages, where the arrow keys turn them), not on <body>.
        const active = document.activeElement;
        if (inBook && (!active || active === document.body || active === from)) {
          floatRef.current?.querySelector<HTMLElement>(".ipb__pages")?.focus({ preventScroll: true });
        }
      });
    },
    [ensureAt],
  );

  const built = usePassportContent(passport, {
    slotOverrides,
    layout: wide ? "spread" : "single",
    pageWidth: 338,
    coverInteractive: coverIdle,
    coverGlobe: coverFace,
    onEmptySlotSelect,
    onIslandSelect,
  });
  closeStampRef.current = built.closeStamp;
  locateRef.current = built.locateIsland;

  const pageCount = built.pageMap.count;
  const pages = live ? built.pages : emptyPages(pageCount);

  /* ---------------------------- chrome ---------------------------- */

  const working = busy !== null;
  /** A moment is on the page, even if the button has already been handed back: no swipes under it. */
  const blocked = working || press !== null || inline !== null;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  let cta: string;
  if (busy === "collect") cta = opening && !press ? D.steps.collect.opening : D.steps.collect.busy;
  else if (busy === "donate" || busy === "confirm") cta = D.steps[busy].busy;
  else if (busy === "award") cta = bridge !== null ? t(D.award.bridge, { n: bridge, province: passport.province }) : D.award.busy;
  else if (busy === "reset") cta = D.done.busy;
  else if (step === "collect") cta = D.steps.collect.cta;
  else if (step === "donate") cta = D.steps.donate.cta;
  else if (step === "confirm") cta = D.steps.confirm.cta;
  else if (step === "award") cta = strings.actions.awardProvincial;
  else cta = D.done.cta;

  /*
   * The way into the traveler share flow (docs/agents/p3-traveler.md), once the story stamp is in
   * the passport. It carries the stamp's status and the art direction, so the flow starts from
   * exactly what is on the page. A plain link: leaving the page ends the story like any navigation.
   */
  const shareStatus = storySlot?.stamp?.status;
  const shareHref = shareStatus ? `/share/traveler?from=passport&status=${shareStatus}&style=${direction}` : null;
  const shareReady = shareStatus === "verified";

  let note: ReactNode;
  if (step === "collect") note = t(D.steps.collect.note, { title: storyStamp.title, island: storyStamp.island, promoter: storyStamp.promoter });
  else if (step === "donate") note = t(D.steps.donate.note, { charity: storyStamp.charity });
  else if (step === "confirm") note = t(D.steps.confirm.note, { charity: storyStamp.charity });
  else if (step === "award") note = t(D.award.note, { n: progress.verified, province: passport.province });
  else if (strings.app.bidder) {
    // Who made this, only once the bidder has filled it in (strings.app.bidder).
    const byline = t(D.byline, { bidder: strings.app.bidder });
    note = strings.app.contactHref ? <a href={strings.app.contactHref}>{byline}</a> : byline;
  } else if (shareHref) {
    note = (
      <Link href={shareHref} className="ipd-bar__share" data-share-entry="note">
        {D.share.note}
      </Link>
    );
  } else note = D.done.note;

  const open = bookState === "open";

  const blockKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") coverRef.current?.prepare();
    if (!blockedRef.current || !NAV_KEYS.has(e.key)) return;
    e.stopPropagation();
    if (e.key !== "Escape") e.preventDefault();
  };

  const needsWarmUp = !(live && moments);
  const touchCover = useCallback(() => {
    // The closed book is about to be opened by hand: the pages under the cover are put two
    // before the island the globe is showing, so the book opens with a short riffle to it.
    coverRef.current?.prepare();
    if (!needsWarmUp) return;
    // Not urgent: the first 150 ms of the cover's swing show nothing of the pages, and rendering
    // them inside the pointer handler used to hold the first frame back.
    startTransition(() => setLive(true));
    warm();
  }, [needsWarmUp, warm]);
  const openFromCta = useCallback(() => {
    startTransition(() => setLive(true));
    warm();
    coverRef.current?.open();
  }, [warm]);

  /** The "Close" word in the hint row. A story step that is playing keeps the book. */
  const closeFromHint = useCallback(() => {
    if (busyRef.current !== null) return;
    book.current?.close();
  }, []);

  const playFullMotion = useCallback(() => setFullMotion(true), []);

  const Press = moments?.StampPress;
  const Award = moments?.ProvincialAward;
  const provincialStamp = useMemo(
    () => ({ ...passport.provincial.stamp, date: STORY.today }),
    [passport.provincial.stamp],
  );

  return (
    <div className="ipd scene-bg" data-book={bookState} data-busy={busy ?? undefined} data-started={started ? "" : undefined}>
      {/* One row: the art-direction switcher sits in the bar (named chips on wide screens, swatches
          on phones), so the header leaves the height to the passport. */}
      <Header
        progress={progress}
        province={passport.province}
        appearance="none"
        actions={
          <>
            <ThemeSwitcher className="ipd-switch ipd-switch--full" />
            <ThemeSwitcher variant="compact" className="ipd-switch ipd-switch--compact" />
          </>
        }
      />

      <main className="ipd-main">
        <h1 className="ipd-sr">{strings.app.metaTitle}</h1>
        <div className="ipd-top">
          <p className="ipd-intro" data-hidden={notice ? "" : undefined}>
            <span className="sample-tag ipd-intro__tag">{D.eyebrow}</span>
            <span className="ipd-intro__text">{t(D.intro, { province: passport.province })}</span>
          </p>
          <Notice notice={notice} onDismiss={dismissNotice} reduced={motionOverride} />
        </div>

        <div
          ref={stageRef}
          className="ipd-stage"
          onKeyDownCapture={blockKeys}
          onPointerDownCapture={touchCover}
          onFocusCapture={live ? undefined : touchCover}
        >
          <div className="ipd-glow" aria-hidden="true" />
          <div ref={floatRef} className="ipd-float">
            <PassportBook
              ref={book}
              className="ipd-book"
              cover={built.cover}
              pages={pages}
              backCover={built.backCover}
              chrome="bare"
              reducedMotion={motionOverride}
              onFlip={onFlip}
              onFlipStart={onFlipStart}
              onOpenChange={cover.onOpenChange}
              onStateChange={onStateChange}
            />
          </div>
          <div className="ipd-ground" aria-hidden="true" />
          {blocked && (
            // While a moment plays on the page, the book does not take swipes. A tap skips the upgrade.
            <div className="ipd-block" onClick={() => upgradeRef.current?.skip()} aria-hidden="true" />
          )}
        </div>

        <Hint
          store={pageStore}
          passport={passport}
          root={floatRef}
          open={open}
          quiet={blocked}
          motionChoice={systemReduced && !fullMotion && !started}
          onFullMotion={playFullMotion}
          pulse={hydrated && !reduced}
          pageCount={pageCount}
          cover={cover.controller}
          onOpenCover={openFromCta}
          onCloseBook={closeFromHint}
        />

        <footer className="ipd-foot">
          <p>
            {strings.sample.notice} {strings.sample.noDonations}
          </p>
        </footer>
      </main>

      <ActionBar
        step={step}
        busy={working}
        cta={cta}
        note={note}
        reduced={motionOverride}
        onAction={onAction}
        onJump={(to) => void jump(to)}
        onReplay={step !== "collect" || fresh.length > 0 ? () => void replay() : undefined}
        onIntent={warm}
        // The engine's own mute state, saved by the engine: the one switch for every sound here.
        tools={
          <>
            {shareHref && (
              <Link
                href={shareHref}
                className="ipd-tool ipd-tool--share"
                data-ready={shareReady ? "" : undefined}
                data-share-entry="tool"
                aria-label={D.share.aria}
                title={D.share.aria}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 11.4V2.6M5.8 5.6 9 2.4l3.2 3.2" />
                  <path d="M3.6 9.4v4.4a1.6 1.6 0 0 0 1.6 1.6h7.6a1.6 1.6 0 0 0 1.6-1.6V9.4" />
                </svg>
                {shareReady && <span>{D.share.label}</span>}
              </Link>
            )}
            <StampPressSoundToggle className="ipd-tool ipd-tool--sound" />
          </>
        }
      />

      {built.sheet}

      {press && Press && (
        <Press
          key={press.run}
          stamp={press.stamp}
          target={press.target}
          surface={floatRef}
          announce={false}
          // No tap-anywhere skip: its full-screen layer swallowed taps meant for the button, the
          // header and the switcher, and cut the hero moment short. It lasts 1.3 s.
          skippable={false}
          reducedMotion={motionOverride}
          onImpact={() => onPressImpact(press.stamp)}
          onComplete={() => onPressComplete(press.stamp)}
        />
      )}

      {Award && (
        <Award
          open={awardOpen}
          stamp={provincialStamp}
          verifiedCount={progress.verified}
          target={awardTarget}
          // The book takes the landing hit, as it takes the stamper's.
          surface={floatRef}
          reducedMotion={motionOverride}
          onAdd={onAwardAdd}
          onLanded={onAwardLanded}
          onComplete={onAwardComplete}
        />
      )}

      {debug && <FpsMeter />}
    </div>
  );
}

export default Demo;
