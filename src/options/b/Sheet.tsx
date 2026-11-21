"use client";

/**
 * Option B card container: the postcard itself.
 *
 * On a phone it is a bottom sheet with three resting heights (peek, half, full). Drag it by the
 * strip of tape at its top, or anywhere on the card: at full height the content scrolls, and
 * pulling down from the top of the content takes the sheet with it. The buttons stay pinned to
 * the bottom of the screen, whatever the height. On a desktop it is a panel at the right.
 *
 * It arrives the way a postcard lands on a table: flipped up from flat, a little crooked, then
 * settling straight. With reduced motion it fades.
 *
 * It is a non-modal dialog: the map behind stays usable, focus moves to the island's name when
 * it opens (the caller does that), and Escape closes it (the caller does that too).
 */
import { animate, motion, useMotionValue, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { IconClose, Tape } from "./bits";
import { bStrings } from "./strings";

export type Snap = "peek" | "half" | "full";
const ORDER: Snap[] = ["peek", "half", "full"];

export interface SheetProps {
  open: boolean;
  wide: boolean;
  reduced: boolean;
  snap: Snap;
  onSnap(snap: Snap): void;
  /** Visible height of the sheet at each resting point, in px (phone layout). */
  heights: Record<Snap, number>;
  /** Height of the viewport, in px. */
  viewport: number;
  labelledBy: string;
  closeLabel: string;
  onClose(): void;
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** The pinned row of buttons. */
  actions: ReactNode;
  children: ReactNode;
}

const PANEL_AWAY = 600;

export function Sheet({ open, wide, reduced, snap, onSnap, heights, viewport, labelledBy, closeLabel, onClose, scrollerRef, actions, children }: SheetProps) {
  const away = wide ? PANEL_AWAY : viewport + 90;
  const rest = wide ? 0 : viewport - heights[snap];

  const offset = useMotionValue(away);
  const flip = useMotionValue(0);
  const tilt = useMotionValue(0);
  const opacity = useMotionValue(0);
  const actionsY = useMotionValue(160);

  const root = useRef<HTMLElement>(null);
  const was = useRef({ open: false, wide });
  const running = useRef<AnimationPlaybackControls[]>([]);
  const releaseVelocity = useRef(0);
  const dragging = useRef(false);

  const stop = () => {
    for (const c of running.current) c.stop();
    running.current = [];
  };

  /* ---------------------------------------------------------- entrance, exit, snapping */

  useEffect(() => {
    const before = was.current;
    was.current = { open, wide };
    stop();
    const run = (c: AnimationPlaybackControls) => running.current.push(c);

    if (!open) {
      if (reduced || !before.open) {
        offset.set(away);
        flip.set(0);
        tilt.set(0);
        opacity.set(0);
        actionsY.set(160);
        return;
      }
      // Leaving: slipped off the table, quickly.
      run(animate(offset, away, { duration: 0.36, ease: [0.5, 0, 0.84, 0.3] }));
      run(animate(tilt, wide ? 4 : -3, { duration: 0.3 }));
      run(animate(actionsY, 160, { duration: 0.26, ease: [0.5, 0, 0.84, 0.3] }));
      run(animate(opacity, 0, { duration: 0.12, delay: 0.3 }));
      return stop;
    }

    if (reduced) {
      offset.set(rest);
      flip.set(0);
      tilt.set(0);
      actionsY.set(0);
      run(animate(opacity, 1, { duration: 0.22 }));
      return stop;
    }

    opacity.set(1);
    if (!before.open || before.wide !== wide) {
      // Arriving: flipped up from flat and a little crooked, then it settles.
      offset.set(away);
      flip.set(wide ? -42 : 52);
      tilt.set(wide ? 6 : -5);
      run(animate(offset, rest, { type: "spring", stiffness: 170, damping: 18, mass: 0.9 }));
      run(animate(flip, 0, { type: "spring", stiffness: 120, damping: 14 }));
      run(animate(tilt, 0, { type: "spring", stiffness: 210, damping: 10, mass: 0.8 }));
      run(animate(actionsY, 0, { type: "spring", stiffness: 260, damping: 22, delay: 0.16 }));
    } else if (!dragging.current) {
      run(animate(offset, rest, { type: "spring", stiffness: 420, damping: 40, velocity: releaseVelocity.current }));
      run(animate(flip, 0, { duration: 0.2 }));
      run(animate(tilt, 0, { duration: 0.2 }));
      run(animate(actionsY, 0, { duration: 0.2 }));
      releaseVelocity.current = 0;
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- motion values are stable
  }, [open, wide, reduced, rest, away]);

  // Leaving full height: the content goes back to its top.
  useEffect(() => {
    if (!wide && snap !== "full") scrollerRef.current?.scrollTo({ top: 0 });
  }, [snap, wide, scrollerRef]);

  /* ----------------------------------------------------------------------- dragging */

  const settle = useCallback(
    (velocity: number) => {
      const at = offset.get();
      const projected = at + velocity * 0.16;
      const tops = ORDER.map((s) => viewport - heights[s]);
      // Flicked or pulled well below the lowest resting point: put the card away.
      if (projected > tops[0] + 110) {
        onClose();
        return;
      }
      let best = 0;
      for (let i = 1; i < tops.length; i++) if (Math.abs(tops[i] - projected) < Math.abs(tops[best] - projected)) best = i;
      const next = ORDER[best];
      releaseVelocity.current = velocity;
      if (next === snap) {
        stop();
        running.current.push(animate(offset, tops[best], { type: "spring", stiffness: 420, damping: 40, velocity }));
        releaseVelocity.current = 0;
      } else onSnap(next);
    },
    [heights, offset, onClose, onSnap, snap, viewport],
  );

  const moveTo = useCallback(
    (value: number) => {
      const top = viewport - heights.full;
      // Past full height the sheet resists, like stretched rubber.
      offset.set(value < top ? top - Math.sqrt(top - value) * 3 : value);
    },
    [heights.full, offset, viewport],
  );

  // Touch: the whole sheet is the handle, except where the content should scroll instead.
  useEffect(() => {
    const el = root.current;
    if (!el || wide || !open) return;
    let mode: "idle" | "pending" | "sheet" | "native" = "idle";
    let x0 = 0;
    let y0 = 0;
    let from = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      mode = "pending";
      x0 = touch.clientX;
      y0 = lastY = touch.clientY;
      lastT = e.timeStamp;
      from = offset.get();
      velocity = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (mode === "idle" || mode === "native") return;
      const touch = e.touches[0];
      const dx = touch.clientX - x0;
      const dy = touch.clientY - y0;
      if (mode === "pending") {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        const scroller = scrollerRef.current;
        const inScroller = Boolean(scroller && e.target instanceof Node && scroller.contains(e.target));
        if (Math.abs(dx) > Math.abs(dy)) mode = "native"; // a sideways swipe belongs to a carousel
        else if (snap === "full" && inScroller && ((scroller?.scrollTop ?? 0) > 0 || dy < 0)) mode = "native";
        else {
          mode = "sheet";
          dragging.current = true;
          stop();
        }
        if (mode === "native") return;
      }
      if (e.cancelable) e.preventDefault();
      moveTo(from + dy);
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = 0.6 * velocity + 0.4 * (((touch.clientY - lastY) / dt) * 1000);
      lastY = touch.clientY;
      lastT = e.timeStamp;
    };
    const onEnd = (e: TouchEvent) => {
      if (mode === "sheet") {
        dragging.current = false;
        // A finger that rested before lifting has no fling left in it.
        settle(e.timeStamp - lastT > 90 ? 0 : velocity);
      }
      mode = "idle";
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
      dragging.current = false;
    };
  }, [wide, open, snap, offset, moveTo, settle, scrollerRef]);

  // Mouse or trackpad on the phone layout (a narrow desktop window): the wheel resizes the sheet.
  useEffect(() => {
    const el = root.current;
    if (!el || wide || !open) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      const now = e.timeStamp;
      if (now - last < 380) return;
      const scrollTop = scrollerRef.current?.scrollTop ?? 0;
      if (snap !== "full" && e.deltaY > 4) {
        last = now;
        onSnap(snap === "peek" ? "half" : "full");
      } else if (e.deltaY < -4 && scrollTop <= 0 && snap !== "peek") {
        last = now;
        onSnap(snap === "full" ? "half" : "peek");
      }
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wide, open, snap, onSnap, scrollerRef]);

  // The tape is also a button, and a mouse can drag it.
  const press = useRef<{ y: number; from: number; moved: boolean; lastY: number; lastT: number; v: number } | null>(null);
  const onGrabDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { y: e.clientY, from: offset.get(), moved: false, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
  };
  const onGrabMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.abs(dy) < 5) return;
    if (!p.moved) {
      p.moved = true;
      dragging.current = true;
      stop();
    }
    moveTo(p.from + dy);
    const dt = e.timeStamp - p.lastT;
    if (dt > 0) p.v = 0.6 * p.v + 0.4 * (((e.clientY - p.lastY) / dt) * 1000);
    p.lastY = e.clientY;
    p.lastT = e.timeStamp;
  };
  const onGrabUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    press.current = null;
    if (!p?.moved) return;
    dragging.current = false;
    settle(e.timeStamp - p.lastT > 90 ? 0 : p.v);
    // The click that follows a drag should not also toggle the sheet.
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
  };
  const suppressClick = useRef(false);
  const onGrabClick = () => {
    if (suppressClick.current) return;
    onSnap(snap === "full" ? "half" : snap === "half" ? "full" : "half");
  };

  const scrollable = wide || snap === "full";

  return (
    <>
      <motion.section
        ref={root}
        className="ob-sheet"
        data-wide={wide ? "" : undefined}
        data-open={open ? "" : undefined}
        data-snap={wide ? undefined : snap}
        role="dialog"
        aria-modal="false"
        aria-labelledby={labelledBy}
        inert={!open}
        style={{
          ...(wide ? { x: offset, rotateY: flip } : { y: offset, rotateX: flip, height: heights.full }),
          rotateZ: tilt,
          opacity,
          transformPerspective: 1400,
        }}
      >
        {wide ? (
          <Tape tone="sun" className="ob-sheet-tape" />
        ) : (
          <button
            type="button"
            className="ob-grab"
            aria-label={snap === "full" ? bStrings.sheet.collapse : bStrings.sheet.expand}
            aria-expanded={snap === "full"}
            title={bStrings.sheet.handle}
            onClick={onGrabClick}
            onPointerDown={onGrabDown}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabUp}
            onPointerCancel={onGrabUp}
          >
            <Tape tone="sun" className="ob-sheet-tape" />
          </button>
        )}
        <button type="button" className="ob-close" onClick={onClose} aria-label={closeLabel}>
          <IconClose size={18} />
        </button>
        <div className="ob-scroll" ref={scrollerRef} data-scrollable={scrollable ? "" : undefined}>
          {children}
        </div>
        {wide ? <div className="ob-actionsbar">{actions}</div> : null}
      </motion.section>
      {wide ? null : (
        <motion.div className="ob-actionsbar" data-floating="" inert={!open} style={{ y: actionsY }}>
          {actions}
        </motion.div>
      )}
    </>
  );
}
