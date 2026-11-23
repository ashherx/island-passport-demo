"use client";

/**
 * The island card as a bottom sheet (phones): three snap points (peek, half, full), dragged by
 * finger with momentum, moved with a soft spring.
 *
 *   - Below its largest snap the whole sheet is the drag handle; a swipe up opens it further.
 *   - At "full" the content scrolls. Pulling down while it is scrolled to the top drags the sheet.
 *   - A flick down from "peek" closes the card.
 *   - The grab bar is a real button for keyboard and switch users: it steps through the snaps.
 *
 * The sheet is `heights.full` tall and slides with a transform only, so dragging never lays out
 * the page. Touch events are used (not pointer events) because only a non-passive touchmove can
 * take a gesture away from native scrolling at the moment the content reaches its top.
 */
import { animate, motion, useMotionValue } from "motion/react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { aStrings } from "./strings";

export type Snap = "peek" | "half" | "full";

export interface SheetProps {
  /** Visible height of each snap, in px. `full` is also the sheet's own height. */
  heights: Record<Snap, number>;
  /** Snaps this card can rest at, smallest first. */
  snaps: readonly Snap[];
  snap: Snap;
  onSnap(snap: Snap): void;
  /** Dragged or flicked off the bottom. */
  onDismiss(): void;
  /** The card is closing: slide away. */
  leaving: boolean;
  /** Held below the screen (a layout that shows no card until the camera lands): out of reach of the keyboard too. */
  inert?: boolean;
  reducedMotion: boolean;
  labelledBy: string;
  children: ReactNode;
}

const SPRING = { type: "spring", stiffness: 190, damping: 24, mass: 0.9 } as const;

export function Sheet({ heights, snaps, snap, onSnap, onDismiss, leaving, inert = false, reducedMotion, labelledBy, children }: SheetProps) {
  const ref = useRef<HTMLElement>(null);
  const hidden = heights.full + 48;
  const y = useMotionValue(hidden);
  const largest = snaps[snaps.length - 1];
  const target = leaving ? hidden : heights.full - heights[snap];

  /** Latest values for the touch handlers, which are attached once. */
  const live = useRef({ heights, snaps, snap, largest, onSnap, onDismiss, reducedMotion });
  live.current = { heights, snaps, snap, largest, onSnap, onDismiss, reducedMotion };

  const settle = useCallback(
    (to: number, velocity = 0) => {
      if (live.current.reducedMotion) {
        y.set(to);
        return;
      }
      void animate(y, to, { ...SPRING, velocity });
    },
    [y],
  );

  const releaseVelocity = useRef(0);
  useEffect(() => {
    settle(target, releaseVelocity.current);
    releaseVelocity.current = 0;
  }, [target, settle]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /** 0 undecided, 1 dragging the sheet, 2 leave it to the browser. */
    let mode = 0;
    let startX = 0;
    let startY = 0;
    let base = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let scroller: HTMLElement | null = null;
    let inScroller = false;

    const begin = (clientX: number, clientY: number, targetEl: Element | null) => {
      mode = targetEl?.closest("[data-nodrag], input, textarea, select") ? 2 : 0;
      startX = clientX;
      startY = lastY = clientY;
      lastT = performance.now();
      velocity = 0;
      scroller = el.querySelector<HTMLElement>("[data-scroller]");
      inScroller = Boolean(scroller && targetEl && scroller.contains(targetEl));
    };

    const move = (clientX: number, clientY: number): boolean => {
      if (mode === 2) return false;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (mode === 0) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return false;
        const state = live.current;
        // A sideways swipe belongs to a scrolling row inside the card.
        if (Math.abs(dx) > Math.abs(dy)) {
          mode = 2;
          return false;
        }
        // Fully open: the content scrolls, unless it is at its top and the finger pulls down.
        if (state.snap === state.largest && state.largest === "full" && inScroller && scroller && (dy < 0 || scroller.scrollTop > 0)) {
          mode = 2;
          return false;
        }
        mode = 1;
        y.stop();
        base = y.get();
        startY = clientY;
        el.setAttribute("data-dragging", "");
        return true;
      }
      const state = live.current;
      const top = state.heights.full - state.heights[state.largest];
      let next = base + (clientY - startY);
      // Past the largest snap the sheet resists instead of stopping dead.
      if (next < top) next = top - (top - next) ** 0.72;
      y.set(next);
      const now = performance.now();
      if (now > lastT) velocity = 0.6 * velocity + 0.4 * (((clientY - lastY) / (now - lastT)) * 1000);
      lastY = clientY;
      lastT = now;
      return true;
    };

    const end = () => {
      if (mode !== 1) {
        mode = 0;
        return;
      }
      mode = 0;
      el.removeAttribute("data-dragging");
      const state = live.current;
      const projected = y.get() + velocity * 0.16;
      const peekY = state.heights.full - state.heights[state.snaps[0]];
      if (projected > peekY + Math.min(72, state.heights[state.snaps[0]] * 0.55)) {
        state.onDismiss();
        return;
      }
      let best = state.snaps[0];
      let bestDistance = Infinity;
      for (const s of state.snaps) {
        const distance = Math.abs(state.heights.full - state.heights[s] - projected);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = s;
        }
      }
      if (best === state.snap) settle(state.heights.full - state.heights[best], velocity);
      else {
        releaseVelocity.current = velocity;
        state.onSnap(best);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        mode = 2;
        return;
      }
      begin(e.touches[0].clientX, e.touches[0].clientY, e.target as Element | null);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };

    // A mouse can drag the sheet by its header (a narrow desktop window).
    const onMouseMove = (e: MouseEvent) => {
      if (move(e.clientX, e.clientY)) e.preventDefault();
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      end();
    };
    const onMouseDown = (e: MouseEvent) => {
      const targetEl = e.target as Element | null;
      if (e.button !== 0 || !targetEl?.closest("[data-drag]") || targetEl.closest("button, a")) return;
      begin(e.clientX, e.clientY, targetEl);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", onMouseDown);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [y, settle]);

  // Leaving "full": the content goes back to its top, ready for next time.
  useEffect(() => {
    if (snap === "full") return;
    const scroller = ref.current?.querySelector<HTMLElement>("[data-scroller]");
    if (scroller && scroller.scrollTop > 0) scroller.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [snap, reducedMotion]);

  const step = () => {
    const i = snaps.indexOf(snap);
    onSnap(i < snaps.length - 1 ? snaps[i + 1] : snaps[Math.max(0, i - 1)]);
  };

  return (
    <motion.section
      ref={ref}
      className="da-sheet"
      role="dialog"
      tabIndex={-1}
      aria-modal="false"
      aria-labelledby={labelledBy}
      data-snap={snap}
      data-largest={snap === largest ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      inert={inert ? true : undefined}
      style={{ y, height: heights.full }}
    >
      <button type="button" className="da-grab" data-drag="" onClick={step} aria-label={snap === largest ? aStrings.card.collapse : aStrings.card.expand}>
        <span aria-hidden="true" />
      </button>
      {children}
    </motion.section>
  );
}
