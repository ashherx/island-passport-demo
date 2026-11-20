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
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Header } from "@/components/chrome";
import { vibrate } from "@/components/moments/celebrations/haptics";
import { InkSpeckles } from "@/components/moments/stamp-press/InkSpeckles";
import { StampPressSoundToggle } from "@/components/moments/stamp-press/SoundToggle";
import type { StatusUpgradeHandle } from "@/components/moments/StatusUpgrade";
import { getPassportPageMap, usePassportContent, type SlotOverride } from "@/components/passport/content";
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
import { strings, t } from "@/lib/strings";
import type { PassportData, Stamp } from "@/lib/types";
import { ActionBar, type StoryStep } from "./ActionBar";
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

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

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
  open: boolean;
  quiet: boolean;
  /** Reduced motion is on and the book has not been opened yet: say so once. */
  reducedNote: boolean;
  pulse: boolean;
  pageCount: number;
}

function Hint({ store, passport, open, quiet, reducedNote, pulse, pageCount }: HintProps) {
  const page = useSyncExternalStore(store.subscribe, store.get, () => 0);
  let hint: string;
  if (reducedNote) hint = D.reducedOn;
  else if (!open) hint = D.hintOpen;
  else {
    // What the page lying open invites: turning on, a stamp to tap, or an empty slot to stamp.
    const islandId = Object.keys(PAGE_MAP.islands).find((id) => PAGE_MAP.islands[id] === page);
    const slots = islandId ? passport.slots.filter((slot) => slot.islandId === islandId) : [];
    if (slots.some((slot) => !slot.stamp)) hint = D.hintEmpty;
    else if (slots.length > 0 || (page === PAGE_MAP.provincial && passport.provincial.earned)) hint = D.hintStamp;
    else hint = D.hintSwipe;
  }
  return (
    <p className="ipd-hint" aria-hidden={quiet || undefined} data-quiet={quiet ? "" : undefined}>
      <span key={hint} className="ipd-hint__text">
        {!open && pulse && <i className="ipd-hint__pulse" aria-hidden="true" />}
        {hint}
      </span>
      {open && <span className="ipd-hint__page">{t(D.pageOf, { page: page + 1, total: pageCount })}</span>}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function Demo() {
  const { tokens } = useTheme();
  const reduced = usePrefersReducedMotion();

  const [passport, setPassport] = useState<PassportData>(SAMPLE_PASSPORT);
  const [bookState, setBookState] = useState<BookState>("closed");
  /** The cover's foil follows the pointer only while the book lies closed. Changed at rest, never mid-swing. */
  const [coverIdle, setCoverIdle] = useState(true);
  const [busy, setBusyState] = useState<Busy>(null);
  const [press, setPress] = useState<PressRun | null>(null);
  const [inline, setInline] = useState<InlineRun | null>(null);
  const [awardOpen, setAwardOpen] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [sound, setSound] = useState(false);
  const [moments, setMoments] = useState<Moments | null>(null);
  /** Inside pages are rendered (after idle, or as soon as the cover is touched). */
  const [live, setLive] = useState(false);
  const [wide, setWide] = useState(false);
  const [started, setStarted] = useState(false);
  const [debug, setDebug] = useState(false);

  const [pageStore] = useState(createPageStore);
  const book = useRef<PassportBookLibHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const upgradeRef = useRef<StatusUpgradeHandle>(null);

  const passportRef = useRef(passport);
  passportRef.current = passport;
  const busyRef = useRef<Busy>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const runId = useRef(0);
  const noticeId = useRef(0);
  const timers = useRef<number[]>([]);
  const closeStampRef = useRef<() => void>(() => {});
  const flipWaiter = useRef<{ page: number; resolve(): void } | null>(null);
  const stateWaiter = useRef<{ state: BookState; resolve(): void } | null>(null);

  const setBusy = useCallback((next: Busy) => {
    busyRef.current = next;
    setBusyState(next);
  }, []);

  const say = useCallback((tone: NoticeTone, title: string, body: string, duration?: number) => {
    setNotice({ id: ++noticeId.current, tone, title, body, duration });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const later = useCallback((ms: number, run: () => void) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      run();
    }, ms);
    timers.current.push(id);
  }, []);

  /* --------------------------- loading --------------------------- */

  const warm = useCallback(() => {
    void loadMoments().then(
      (m) => setMoments((prev) => prev ?? m),
      () => {},
    );
  }, []);

  useEffect(() => {
    const cancelPages = whenIdle(() => startTransition(() => setLive(true)), 900);
    const cancelMoments = whenIdle(warm, 2500);
    const debugging = /[?&]debug\b/.test(window.location.search);
    setDebug(debugging);
    // For checking on a device and for the test scripts: the book handle, only with ?debug.
    if (debugging) (window as unknown as { __ipBook?: () => PassportBookLibHandle | null }).__ipBook = () => book.current;
    return () => {
      cancelPages();
      cancelMoments();
    };
  }, [warm]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
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

  // The die face of the stamper is tinted ahead of time, so the first press starts complete.
  useEffect(() => {
    if (!moments) return;
    moments.preloadStampPress(stampForSlot(STORY.slotId, "discovery", STORY.today), tokens);
  }, [moments, tokens]);

  /* ----------------------- book navigation ----------------------- */

  const isSpread = useCallback(() => floatRef.current?.querySelector(".ipb")?.getAttribute("data-mode") === "double", []);

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

  /** Open the book if needed and turn to `target`. Resolves when the page has landed and is at rest. */
  const ensureAt = useCallback(
    async (target: number) => {
      const b = book.current;
      if (!b || target < 0) return;
      setLive(true);
      if (b.getState() !== "open") {
        b.open();
        await waitForState("open", 3600);
        await wait(reducedRef.current ? 80 : 240);
      }
      const here = b.getPage();
      const same = here === target || (isSpread() && Math.floor(here / 2) === Math.floor(target / 2));
      if (same) {
        await wait(60);
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
      // A landed page is handed back to the reader a moment after the flip ends.
      await wait(reducedRef.current ? 60 : 150);
    },
    [isSpread, waitForState],
  );

  const onFlip = useCallback(
    (index: number) => {
      pageStore.set(index);
      const w = flipWaiter.current;
      if (w && (w.page === index || (isSpread() && Math.floor(w.page / 2) === Math.floor(index / 2)))) w.resolve();
    },
    [isSpread, pageStore],
  );

  const onStateChange = useCallback((state: BookState) => {
    // Not urgent: the book has already put itself in the new state. Keeps the first frame of the swing free.
    startTransition(() => {
      setBookState(state);
      if (state !== "closed") setStarted(true);
      if (state === "open") setCoverIdle(false);
      else if (state === "closed") setCoverIdle(true);
    });
    if (stateWaiter.current?.state === state) stateWaiter.current.resolve();
  }, []);

  /* --------------------------- the story --------------------------- */

  const progress = getProgress(passport);
  const step = storyStep(passport);
  const storySlot = findSlot(passport, STORY.slotId);
  const storyStamp = useMemo(
    () => storySlot?.stamp ?? stampForSlot(STORY.slotId, "discovery", STORY.today),
    [storySlot],
  );

  /** Step 1, and also any empty slot the reader taps: the stamp is pressed onto the page. */
  const collect = useCallback(
    async (slotId: string) => {
      if (busyRef.current) return;
      const slot = findSlot(passportRef.current, slotId);
      if (!slot || slot.stamp) return;
      setBusy("collect");
      dismissNotice();
      const stamp = stampForSlot(slotId, "discovery", STORY.today);
      const commit = () => {
        setPassport((p) => withStampStatus(p, slotId, "discovery", STORY.today));
        setFresh((list) => (list.includes(slotId) ? list : [...list, slotId]));
      };
      try {
        const [m] = await Promise.all([loadMoments(), ensureAt(PAGE_MAP.forSlot(slotId))]);
        setMoments((prev) => prev ?? m);
        const target = slotBox(floatRef.current, slotId);
        if (!target) throw new Error("slot not on screen");
        m.preloadStampPress(stamp, tokensRef.current, Math.round(target.getBoundingClientRect().width));
        await wait(reducedRef.current ? 40 : 200);
        setPress({ run: ++runId.current, slotId, stamp, target });
      } catch {
        // The moment could not load or the slot is not on screen: the stamp still arrives.
        commit();
        say("discovery", strings.moments.stampEarnedTitle, t(strings.moments.stampEarnedBody, { title: stamp.title, island: stamp.island }));
        setBusy(null);
      }
    },
    [dismissNotice, ensureAt, say, setBusy],
  );

  /* The data changes below land in the middle of an animation. They are transitions, so React
     renders the pages they touch in slices between frames instead of in one long task. */
  const onPressImpact = useCallback((slotId: string) => {
    startTransition(() => {
      setPassport((p) => withStampStatus(p, slotId, "discovery", STORY.today));
      setFresh((list) => (list.includes(slotId) ? list : [...list, slotId]));
    });
  }, []);

  const onPressComplete = useCallback(
    (stamp: Stamp) => {
      // Idempotent: makes sure the stamp is in the data even if the transition above has not committed.
      setPassport((p) => (findSlot(p, stamp.id)?.stamp ? p : withStampStatus(p, stamp.id, "discovery", STORY.today)));
      setPress(null);
      say("discovery", strings.moments.stampEarnedTitle, t(strings.moments.stampEarnedBody, { title: stamp.title, island: stamp.island }));
      setBusy(null);
    },
    [say, setBusy],
  );

  /** Steps 2 and 3 play inside the slot itself. */
  const startInline = useCallback(
    async (kind: "donate" | "confirm") => {
      if (busyRef.current) return;
      const stamp = findSlot(passportRef.current, STORY.slotId)?.stamp;
      if (!stamp || stamp.status !== (kind === "donate" ? "discovery" : "pending")) return;
      setBusy(kind);
      dismissNotice();
      try {
        const [m] = await Promise.all([loadMoments(), ensureAt(PAGE_MAP.forSlot(STORY.slotId))]);
        setMoments((prev) => prev ?? m);
        await wait(reducedRef.current ? 40 : 160);
        setInline({ run: ++runId.current, kind, slotId: STORY.slotId, stamp });
      } catch {
        setPassport((p) => withStampStatus(p, STORY.slotId, kind === "donate" ? "pending" : "verified"));
        setBusy(null);
      }
    },
    [dismissNotice, ensureAt, setBusy],
  );

  const startAward = useCallback(() => {
    if (busyRef.current && busyRef.current !== "award") return;
    setBusy("award");
    dismissNotice();
    void loadMoments().then(
      (m) => {
        setMoments((prev) => prev ?? m);
        setAwardOpen(true);
      },
      () => {
        setPassport((p) => withProvincialEarned(p, STORY.today));
        setBusy(null);
      },
    );
  }, [dismissNotice, setBusy]);

  const onDonateSwap = useCallback(() => {
    vibrate([8]);
    startTransition(() => setPassport((p) => withStampStatus(p, STORY.slotId, "pending")));
  }, []);

  const onDonateDone = useCallback(() => {
    const stamp = findSlot(passportRef.current, STORY.slotId)?.stamp;
    setPassport((p) => (findSlot(p, STORY.slotId)?.stamp?.status === "pending" ? p : withStampStatus(p, STORY.slotId, "pending")));
    setInline(null);
    say("pending", strings.moments.pendingTitle, t(D.toast.pendingBody, { charity: stamp?.charity ?? "" }), 8500);
    setBusy(null);
  }, [say, setBusy]);

  const onUpgradeImpact = useCallback(() => {
    startTransition(() => setPassport((p) => withStampStatus(p, STORY.slotId, "verified")));
  }, []);

  const onUpgradeComplete = useCallback(() => {
    setPassport((p) => (findSlot(p, STORY.slotId)?.stamp?.status === "verified" ? p : withStampStatus(p, STORY.slotId, "verified")));
    setInline(null);
    // onImpact always fires first, but the state update it made may not have rendered yet.
    const next = withStampStatus(passportRef.current, STORY.slotId, "verified");
    const stamp = findSlot(next, STORY.slotId)?.stamp;
    say("verified", strings.moments.verifiedTitle, t(strings.moments.verifiedBody, { charity: stamp?.charity ?? "", island: stamp?.island ?? "" }), 3600);
    if (provincialUnlocked(next) && !next.provincial.earned) {
      // STM-4: awarded automatically once the threshold is reached.
      setBusy("award");
      later(reducedRef.current ? 500 : 1150, startAward);
    } else setBusy(null);
  }, [later, say, setBusy, startAward]);

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

  const onAwardAdd = useCallback(() => ensureAt(PAGE_MAP.provincial), [ensureAt]);
  const onAwardLanded = useCallback(() => setPassport((p) => withProvincialEarned(p, STORY.today)), []);
  const onAwardComplete = useCallback(() => {
    setAwardOpen(false);
    const p = passportRef.current;
    say(
      "provincial",
      strings.moments.provincialTitle,
      t(strings.moments.provincialBody, { n: getProgress(p).verified, province: p.province }),
      6000,
    );
    setBusy(null);
  }, [say, setBusy]);

  const replay = useCallback(async () => {
    if (busyRef.current) return;
    setBusy("reset");
    dismissNotice();
    closeStampRef.current();
    const b = book.current;
    if (b && b.getState() !== "closed") {
      b.close();
      await waitForState("closed", 2200);
    }
    b?.turnOver("front");
    b?.goTo(0);
    pageStore.set(0);
    setPassport(SAMPLE_PASSPORT);
    setFresh([]);
    say("neutral", D.toast.reset, D.toast.resetBody, 2600);
    setBusy(null);
  }, [dismissNotice, pageStore, say, setBusy, waitForState]);

  const onAction = useCallback(() => {
    if (busyRef.current) return;
    switch (storyStep(passportRef.current)) {
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
        startAward();
        break;
      default:
        void replay();
    }
  }, [collect, replay, startAward, startInline]);

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
        return <DonateTransition key={run} stamp={stamp} size={px} detail={detail} onSwap={onDonateSwap} onDone={onDonateDone} />;
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
          delay={140}
          onImpact={onUpgradeImpact}
          onComplete={onUpgradeComplete}
        />
      );
    };
  }, [inline, moments, onDonateDone, onDonateSwap, onUpgradeComplete, onUpgradeImpact]);

  const slotOverrides = useMemo(() => {
    const overrides: Record<string, SlotOverride> = {};
    for (const id of fresh) {
      const stamp = findSlot(passport, id)?.stamp;
      if (stamp) overrides[id] = { after: fleckFor(stamp) };
    }
    if (inline && inlineRender) overrides[inline.slotId] = { ...overrides[inline.slotId], render: inlineRender };
    return overrides;
  }, [fresh, passport, inline, inlineRender, fleckFor]);

  const onEmptySlotSelect = useCallback((slot: { id: string }) => void collect(slot.id), [collect]);

  const built = usePassportContent(passport, {
    slotOverrides,
    layout: wide ? "spread" : "single",
    pageWidth: 338,
    coverInteractive: coverIdle,
    onEmptySlotSelect,
  });
  closeStampRef.current = built.closeStamp;

  const pageCount = built.pageMap.count;
  const pages = live ? built.pages : emptyPages(pageCount);

  /* ---------------------------- chrome ---------------------------- */

  const working = busy !== null;
  let cta: string;
  let note: string;
  if (busy === "collect" || busy === "donate" || busy === "confirm") {
    cta = D.steps[busy].busy;
  } else if (busy === "award") cta = D.award.busy;
  else if (step === "collect") cta = D.steps.collect.cta;
  else if (step === "donate") cta = D.steps.donate.cta;
  else if (step === "confirm") cta = D.steps.confirm.cta;
  else if (step === "award") cta = strings.actions.awardProvincial;
  else cta = D.done.cta;

  if (step === "collect") note = t(D.steps.collect.note, { title: storyStamp.title, island: storyStamp.island, promoter: storyStamp.promoter });
  else if (step === "donate") note = t(D.steps.donate.note, { charity: storyStamp.charity });
  else if (step === "confirm") note = t(D.steps.confirm.note, { charity: storyStamp.charity });
  else if (step === "award") note = t(D.award.note, { n: progress.verified, province: passport.province });
  else note = D.done.note;

  const open = bookState === "open";

  const blockKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!busyRef.current || !NAV_KEYS.has(e.key)) return;
    e.stopPropagation();
    if (e.key !== "Escape") e.preventDefault();
  };

  const touchCover = useCallback(() => {
    setLive(true);
    warm();
  }, [warm]);

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
          <Notice notice={notice} onDismiss={dismissNotice} />
        </div>

        <div
          ref={stageRef}
          className="ipd-stage"
          onKeyDownCapture={blockKeys}
          onPointerDownCapture={live && moments ? undefined : touchCover}
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
              onFlip={onFlip}
              onFlipStart={pageStore.set}
              onStateChange={onStateChange}
            />
          </div>
          <div className="ipd-ground" aria-hidden="true" />
          {working && !press && !awardOpen && (
            // While a moment plays in the page, the book does not take swipes. A tap skips it.
            <div className="ipd-block" onClick={() => upgradeRef.current?.skip()} aria-hidden="true" />
          )}
        </div>

        <Hint
          store={pageStore}
          passport={passport}
          open={open}
          quiet={working}
          reducedNote={reduced && !started}
          pulse={!reduced}
          pageCount={pageCount}
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
        onAction={onAction}
        onReplay={step !== "collect" || fresh.length > 0 ? () => void replay() : undefined}
        onIntent={warm}
        tools={<StampPressSoundToggle sound={sound} onSoundToggle={setSound} className="ipd-tool ipd-tool--sound" />}
      />

      {built.sheet}

      {press && Press && (
        <Press
          key={press.run}
          stamp={press.stamp}
          target={press.target}
          surface={floatRef}
          sound={sound}
          announce={false}
          onImpact={() => onPressImpact(press.slotId)}
          onComplete={() => onPressComplete(press.stamp)}
        />
      )}

      {Award && (
        <Award
          open={awardOpen}
          stamp={provincialStamp}
          verifiedCount={progress.verified}
          target={awardTarget}
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
