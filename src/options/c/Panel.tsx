"use client";

/**
 * Option C: the island card.
 *
 * One component, two shells:
 *   phone    a bottom sheet with three snap points (peek, half, full). Drag the grip or the card
 *            itself; once it is full the content scrolls, and pulling down from the top of the
 *            content brings it back to half. Dragging below the peek closes it.
 *   desktop  a panel in the left column, under the brand and the search.
 *
 * The parent mounts it when the camera has landed (inside <AnimatePresence>), so everything in
 * here can animate on mount: the sheet rises, the name comes up out of its mask, the key figures
 * count up. Focus moves to the island's name on open; the parent puts it back on close.
 */
import Link from "next/link";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ISLANDS, islandStrings, isLive, type GlobeIsland } from "@/lib/islands";
import { t } from "@/lib/strings";
import { LiveBody, SECTION_IDS, SoonBody, splitFigure, type SectionId } from "./sections";
import { cStrings } from "./strings";
import { ArrowIcon, CloseIcon, Count, Rise, Trend, pad2, prefersReducedMotion } from "./ui";

export type Snap = "peek" | "half" | "full";
export type CardView = "map" | "photos";

export interface SnapHeights {
  peek: number;
  half: number;
  full: number;
}

export interface PanelProps {
  island: GlobeIsland;
  wide: boolean;
  /** Visible height of the sheet at each snap point, in px (phone only). */
  heights: SnapHeights;
  snap: Snap;
  onSnap(snap: Snap): void;
  view: CardView;
  onView(view: CardView): void;
  onPhoto(index: number): void;
  onClose(): void;
  onOpenIsland(id: string): void;
  onShare(): void;
  /** True for a moment after the link was copied. */
  copied: boolean;
}

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING = { type: "spring", stiffness: 520, damping: 46, mass: 0.9 } as const;
const ORDER: Snap[] = ["full", "half", "peek"];

const TAB_LABELS: Record<SectionId, string> = cStrings.card.tabs;

export function Panel({ island, wide, heights, snap, onSnap, view, onView, onPhoto, onClose, onOpenIsland, onShare, copied }: PanelProps) {
  const live = isLive(island);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<SectionId>("about");
  const [notified, setNotified] = useState(false);
  const number = ISLANDS.findIndex((i) => i.id === island.id) + 1;

  /** The highest snap this card uses: a "coming soon" card is short and stops at half. */
  const top: Snap = live ? "full" : "half";
  const offsetOf = useCallback((s: Snap) => heights.full - heights[s], [heights]);
  const y = useMotionValue(heights.full + 40);
  // The action bar rides at the bottom of the screen whatever the sheet does, and leaves at peek.
  const ctaY = useTransform(y, (v) => -Math.max(0, v));
  const ctaOpacity = useTransform(y, (v) => Math.max(0, Math.min(1, (offsetOf("peek") - 24 - v) / 70)));

  /* ------------------------------------------------------ open and snaps */

  useEffect(() => {
    // The name is the first thing a screen reader should land on.
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (wide) return;
    const controls = animate(y, offsetOf(snap), prefersReducedMotion() ? { duration: 0 } : SPRING);
    return () => controls.stop();
  }, [wide, snap, offsetOf, y]);

  // Leaving the top snap: the content goes back to its start, so the header is what shows.
  useEffect(() => {
    if (!wide && snap !== top && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [wide, snap, top]);

  /* ----------------------------------------------------------- dragging */

  const drag = useRef<{ id: number; startY: number; startPos: number; lastY: number; lastT: number; velocity: number; moved: boolean; onGrip: boolean } | null>(null);

  const settle = useCallback(
    (velocity: number) => {
      const position = y.get();
      if (position > offsetOf("peek") + 56) {
        onClose();
        return;
      }
      const usable = ORDER.filter((s) => ORDER.indexOf(s) >= ORDER.indexOf(top));
      let next: Snap;
      if (Math.abs(velocity) > 0.45) {
        // A flick goes to the next snap in its direction.
        const ahead = usable.filter((s) => (velocity < 0 ? offsetOf(s) < position - 4 : offsetOf(s) > position + 4));
        next = ahead.length ? (velocity < 0 ? ahead[ahead.length - 1] : ahead[0]) : velocity < 0 ? usable[0] : usable[usable.length - 1];
      } else {
        next = usable.reduce((best, s) => (Math.abs(offsetOf(s) - position) < Math.abs(offsetOf(best) - position) ? s : best), usable[0]);
      }
      if (next === snap) animate(y, offsetOf(next), prefersReducedMotion() ? { duration: 0 } : SPRING);
      else onSnap(next);
    },
    [offsetOf, onClose, onSnap, snap, top, y],
  );

  const cycle = useCallback(() => onSnap(snap === top ? (top === "full" ? "half" : "peek") : snap === "peek" ? "half" : top), [onSnap, snap, top]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (wide || (event.pointerType === "mouse" && event.button !== 0)) return;
    const target = event.target as HTMLElement;
    const onGrip = Boolean(target.closest(".oc-grip"));
    if (!onGrip && target.closest("button, a, input, [data-no-drag]")) return;
    drag.current = { id: event.pointerId, startY: event.clientY, startPos: y.get(), lastY: event.clientY, lastT: event.timeStamp, velocity: 0, moved: false, onGrip };
    event.currentTarget.setPointerCapture(event.pointerId);
    y.stop();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < 5) return;
    d.moved = true;
    const dt = Math.max(1, event.timeStamp - d.lastT);
    d.velocity = d.velocity * 0.4 + ((event.clientY - d.lastY) / dt) * 0.6;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    const min = offsetOf(top);
    let next = d.startPos + dy;
    // Past the top snap the sheet resists; below the peek it follows the finger (to close).
    if (next < min) next = min - Math.sqrt(min - next) * 3;
    y.set(next);
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (d.moved) settle(event.type === "pointercancel" ? 0 : d.velocity);
    else if (d.onGrip) cycle();
  };

  const grab = wide ? {} : { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
  const scrolls = wide || snap === top;

  // At the top snap the content scrolls natively. Pulling down from its very top collapses the sheet.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || wide || snap !== top) return;
    let startY = 0;
    let pulling = false;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    const base = offsetOf(top);
    let ignore = false;
    const onStart = (event: TouchEvent) => {
      // The header is dragged with pointer events (see `grab`); leave it alone here.
      ignore = Boolean((event.target as HTMLElement).closest(".oc-card-head"));
      startY = lastY = event.touches[0].clientY;
      lastT = event.timeStamp;
      pulling = false;
      velocity = 0;
    };
    const onMove = (event: TouchEvent) => {
      if (ignore) return;
      const clientY = event.touches[0].clientY;
      const dy = clientY - startY;
      if (!pulling) {
        if (el.scrollTop <= 0 && dy > 8) pulling = true;
        else return;
      }
      if (event.cancelable) event.preventDefault();
      velocity = velocity * 0.4 + ((clientY - lastY) / Math.max(1, event.timeStamp - lastT)) * 0.6;
      lastY = clientY;
      lastT = event.timeStamp;
      y.set(base + Math.max(0, dy - 8));
    };
    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      settle(velocity);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [wide, snap, top, offsetOf, settle, y]);

  /* ------------------------------------------------------- section tabs */

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !live || typeof IntersectionObserver !== "function") return;
    const sections = [...root.querySelectorAll<HTMLElement>("[data-section]")];
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.section!;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = SECTION_IDS.find((id) => visible.has(id));
        if (first) setActiveTab(first);
      },
      { root, rootMargin: "-18% 0px -62% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [live, island.id]);

  const goToSection = (id: SectionId) => {
    const root = scrollRef.current;
    const section = root?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!root || !section) return;
    const scroll = () => section.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    setActiveTab(id);
    if (!wide && snap !== top) {
      onSnap(top);
      // Wait for the sheet to become scrollable.
      window.setTimeout(scroll, 60);
    } else scroll();
  };

  /* ------------------------------------------------------------- render */

  const place = island.region === island.country ? island.country : `${island.region}, ${island.country}`;
  const card = live ? island.card : null;
  const visitors = card ? (card.tourism.stats.find((m) => m.id === "visitors") ?? card.tourism.stats[0]) : null;
  const visitorFigure = visitors ? splitFigure(visitors.display) : null;

  return (
    <motion.section
      className="oc-card"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-wide={wide ? "" : undefined}
      data-snap={wide ? undefined : snap}
      data-live={live ? "" : undefined}
      data-scrolls={scrolls ? "" : undefined}
      style={wide ? undefined : { y, height: heights.full }}
      initial={wide ? { y: "104%" } : false}
      animate={wide ? { y: 0 } : undefined}
      exit={wide ? { y: "104%", transition: { duration: 0.34, ease: [0.5, 0, 0.75, 0] } } : { y: heights.full + 40, transition: { duration: 0.3, ease: [0.5, 0, 0.75, 0] } }}
      transition={{ duration: 0.62, ease: EASE_OUT }}
      onWheel={(event) => {
        // A wheel or trackpad over a half-open sheet opens it.
        if (!wide && snap !== top && event.deltaY > 6) onSnap(top);
      }}
      onFocusCapture={(event) => {
        // Keyboard focus that moves into content below the fold brings the whole card up.
        if (wide || snap === top) return;
        const target = event.target as HTMLElement;
        if (target.closest(".oc-card-body") && target.matches(":focus-visible")) onSnap(top);
      }}
    >
      {!wide ? (
        <button
          type="button"
          className="oc-grip"
          aria-label={snap === top ? cStrings.card.sheet.collapse : cStrings.card.sheet.expand}
          aria-expanded={snap === top}
          {...grab}
          // Pointer taps are handled by the drag code (the pointer is captured); this is the keyboard.
          onClick={(event) => {
            if (event.detail === 0) cycle();
          }}
        >
          <span />
        </button>
      ) : null}

      <button type="button" className="oc-icon-button oc-card-close" onClick={onClose} aria-label={islandStrings.globe.reset}>
        <CloseIcon />
      </button>

      <div ref={scrollRef} className="oc-card-scroll" style={!wide && top !== "full" ? { height: heights[top] } : undefined} {...(scrolls ? {} : grab)}>
        <header className="oc-card-head" {...(scrolls && !wide ? grab : {})}>
          <p className="oc-kicker">
            <Rise>
              <span className="oc-kicker-no">{t(cStrings.card.number, { n: pad2(number) })}</span>
              <span className="oc-kicker-place">{place}</span>
            </Rise>
          </p>
          <h2 className="oc-name" id={titleId} ref={titleRef} tabIndex={-1}>
            <Rise index={1}>{island.name}</Rise>
          </h2>
          <p className="oc-tagline">
            <Rise index={2}>{island.tagline}</Rise>
          </p>
          <div className="oc-card-bar" data-no-drag="">
            {live ? (
              <div className="oc-toggle" role="group" aria-label={islandStrings.card.view.label}>
                <button type="button" aria-pressed={view === "map"} onClick={() => onView("map")}>
                  {islandStrings.card.view.map}
                </button>
                <button type="button" aria-pressed={view === "photos"} onClick={() => onView("photos")}>
                  {islandStrings.card.view.photos}
                </button>
              </div>
            ) : null}
            <span className="oc-status" data-status={island.status}>
              <span className="oc-status-dot" aria-hidden="true" />
              {islandStrings.status[island.status]}
            </span>
          </div>
        </header>

        {card ? (
          <>
            <dl className="oc-keys">
              <div className="oc-key">
                <dt>{cStrings.card.stats.reef}</dt>
                <dd>
                  <Count className="oc-figure oc-figure-lg" display={String(card.reef.healthIndex.value)} delay={260} />
                  <span className="oc-key-unit">{cStrings.card.stats.reefOf}</span>
                  <Trend trend={card.reef.healthIndex.trend} label={false} />
                </dd>
              </div>
              <div className="oc-key">
                <dt>{cStrings.card.stats.species}</dt>
                <dd>
                  <Count className="oc-figure oc-figure-lg" display={pad2(card.species.length)} delay={340} />
                </dd>
              </div>
              {visitors && visitorFigure ? (
                <div className="oc-key">
                  <dt>{visitors.id === "visitors" ? cStrings.card.stats.visitors : visitors.label}</dt>
                  <dd>
                    <Count className="oc-figure oc-figure-lg" display={visitorFigure.figure} delay={420} />
                    {visitors.trend ? <Trend trend={visitors.trend} label={false} /> : null}
                  </dd>
                </div>
              ) : null}
            </dl>

            <nav className="oc-tabs" aria-label={cStrings.card.tabs.label} data-no-drag="">
              <ul>
                {SECTION_IDS.map((id, i) => (
                  <li key={id}>
                    <button type="button" aria-current={activeTab === id ? "true" : undefined} onClick={() => goToSection(id)}>
                      <span className="oc-tab-no" aria-hidden="true">
                        {pad2(i + 1)}
                      </span>
                      {TAB_LABELS[id]}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        ) : null}

        <div className="oc-card-body">
          {live ? (
            <LiveBody island={island} onPhoto={onPhoto} />
          ) : (
            <SoonBody island={island} notified={notified} onNotify={() => setNotified((value) => !value)} onOpenIsland={onOpenIsland} />
          )}
        </div>
      </div>

      {live ? (
        <motion.div className="oc-cta" style={wide ? undefined : { y: ctaY, opacity: ctaOpacity }} data-no-drag="">
          <Link className="oc-button oc-button-accent" href="/passport">
            {islandStrings.card.cta.collect}
            <ArrowIcon />
          </Link>
          <button type="button" className="oc-button oc-button-line" onClick={onShare}>
            <span role="status">{copied ? cStrings.card.linkCopied : islandStrings.card.cta.share}</span>
          </button>
          <p className="oc-cta-note">{islandStrings.sample.noDonations}</p>
        </motion.div>
      ) : null}
    </motion.section>
  );
}
