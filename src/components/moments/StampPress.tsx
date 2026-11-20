"use client";

/**
 * <StampPress />: the moment a stamp is earned (UX-3).
 *
 * Give it the stamp and the slot on the passport page. A stamper appears above the slot with its
 * inked face showing, swings over, slams down (squash, page nudge, vibration, optional thunk) and
 * lifts away to leave the impression, a few ink flecks and a glint on the wet ink. About 1.4 s,
 * skippable with a tap or Escape. With reduced motion the impression simply fades in.
 *
 * Everything is drawn in a fixed overlay portalled to <body>, so it is never clipped by a passport
 * page. The impression it draws is the same <Stamp /> the page will show, at the same size and
 * tilt. In the last quarter second the page's own stamp rises underneath and the overlay thins
 * away, so by onComplete the host can unmount this with nothing left to see change.
 *
 * Full API and integration recipe: docs/agents/stamp-press.md
 */
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Stamp, stampTilt } from "@/components/stamp";
import { useDirectionTokens } from "@/components/theme";
import { artUrl } from "@/lib/assets";
import type { DirectionTokens } from "@/lib/directions";
import { strings, t } from "@/lib/strings";
import type { Stamp as StampData, StampShape } from "@/lib/types";
import { IMPACT_PATTERN, nudge, playThunk, soundReady, vibrate } from "./stamp-press/feedback";
import { InkSpeckles } from "./stamp-press/InkSpeckles";
import { stamperMaterial } from "./stamp-press/materials";
import {
  drawStamper,
  loadTintedArt,
  mix,
  prepareStamper,
  resolveStampFont,
  stamperReach,
  stamperSpec,
  type StamperPaint,
} from "./stamp-press/stamper";
import { pressStrings } from "./stamp-press/strings";
import { PRESS, REDUCED_FADE, impressionFrame, stamperFrame } from "./stamp-press/timeline";

export { InkSpeckles, inkFlecks, type InkSpecklesProps } from "./stamp-press/InkSpeckles";
export { canVibrate, canPlaySound, primeSound, playThunk, vibrate, nudge, IMPACT_PATTERN } from "./stamp-press/feedback";
export { PRESS as STAMP_PRESS_TIMING } from "./stamp-press/timeline";
export { pressStrings } from "./stamp-press/strings";
export { StampPressSoundToggle, type StampPressSoundToggleProps } from "./stamp-press/SoundToggle";

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface PressRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where to stamp, in viewport coordinates: an element, a ref to one, a rect, or a function that
 * returns a rect. An element is followed while the page scrolls or resizes.
 */
export type PressTarget = Element | RefObject<Element | null> | PressRect | (() => PressRect | null) | null;

export interface StampPressProps {
  /** The stamp being earned, exactly as the page will show it afterwards. */
  stamp: StampData;
  /** The slot on the page. Pass the element that holds the (empty) stamp, or a rect. */
  target: PressTarget;
  /** Plays when this turns true (and on mount when it starts true). False renders nothing. Default true. */
  active?: boolean;
  /**
   * Pixel size of the impression. Default: the size of the `.ip-stamp` inside the target, or the
   * smaller side of the target. Must equal the size of the <Stamp /> the page shows afterwards.
   */
  size?: number;
  /** Rotation of the impression, as for <Stamp rotate>. Default: the stamp's own deterministic tilt. */
  rotate?: number | false;
  /**
   * "clean" draws the impression without the SVG ink filter while it animates (the page's own
   * stamp still takes over at the end). A fallback for very slow phones. Default "rough".
   */
  ink?: "rough" | "clean";
  /**
   * Element that takes the hit and is nudged on impact (the page or the whole book).
   * Default: the nearest ancestor of the target with `data-press-surface`, else nothing.
   */
  surface?: Element | RefObject<Element | null> | null;
  /**
   * Hide the target element (inline opacity) from impact until the hand-over, so the empty-slot
   * placeholder does not show through the fresh ink. Restored on unmount at the latest. Default true.
   */
  hideTarget?: boolean;
  /** Play the synthesized thunk. Muted by default; needs primeSound() from a gesture (the toggle does it). */
  sound?: boolean;
  /** Vibrate on impact where supported. Default true. */
  haptics?: boolean;
  /** A tap, Escape, Enter or Space fast-forwards to the end. Default true. */
  skippable?: boolean;
  /** Announce "Stamp collected" to screen readers. Default true. */
  announce?: boolean;
  /** Playback rate. 1 is real time (about 1.4 s), 0.25 is slow motion. */
  speed?: number;
  /** Stacking order of the overlay. Default 80. */
  zIndex?: number;
  /**
   * Fires once, about 50 ms after the rubber meets the paper (0.75 s in): late enough that the hit
   * itself is on screen before the host re-renders. Commit the stamp to your data here (the slot,
   * counters, the progress ring). The target is hidden at this point, so the page's own stamp can
   * appear in it unseen and take over at the end.
   */
  onImpact?(): void;
  /** Fires once when the impression has settled (about 1.4 s in), or right after a skip. Unmount here. */
  onComplete?(): void;
  /** Development aid: hold the moment at this time in seconds instead of playing it. */
  freezeAt?: number;
  /**
   * Force reduced motion on or off (the host's own switch). Default: the device setting
   * (`prefers-reduced-motion`).
   */
  reducedMotion?: boolean;
}

/** Colour of the wet ink on the die: the stamp's ink, lifted so it reads on dark rubber. */
const faceInk = (inkHex: string) => mix(inkHex, "#ffffff", 0.34);

const letteringFor = (stamp: Pick<StampData, "island">) => t(pressStrings.lettering, { province: stamp.island }).toUpperCase();

/**
 * Warm up the stamping moment for a stamp, so the first press starts complete and at once:
 * fetches and tints its artwork for the die face and, when `size` (the pixel size of the slot's
 * stamp) is given, bakes the engraved top of the tool. Call it when the slot comes into view or
 * on idle. Safe to call repeatedly; results are cached.
 */
export function preloadStampPress(
  stamp: Pick<StampData, "art" | "status" | "kind" | "shape" | "island">,
  tokens: DirectionTokens,
  size?: number,
): void {
  if (typeof window === "undefined") return;
  const inkHex = stamp.kind === "provincial" ? tokens.ink.provincial : tokens.ink[stamp.status];
  void loadTintedArt(artUrl(stamp.art), faceInk(inkHex));
  if (!size) return;
  const font = resolveStampFont(tokens.id);
  const bake = () =>
    prepareStamper(stamperSpec(size, stamp.shape), {
      material: stamperMaterial(tokens),
      ink: inkHex,
      pageInk: tokens.paper.ink,
      art: null,
      font,
      lettering: letteringFor(stamp),
    });
  // Wait for the lettering font, so a fallback face is never baked in.
  const fonts = document.fonts;
  if (font && fonts?.load) void fonts.load(`700 10px ${font}`).then(bake, bake);
  else bake();
}

/* ------------------------------------------------------------------ */
/* Target helpers                                                      */
/* ------------------------------------------------------------------ */

const isElement = (v: unknown): v is Element => typeof Element !== "undefined" && v instanceof Element;
const isRef = (v: unknown): v is RefObject<Element | null> => typeof v === "object" && v !== null && "current" in v;

function targetElement(target: PressTarget | StampPressProps["surface"]): Element | null {
  if (isElement(target)) return target;
  if (isRef(target)) return target.current;
  return null;
}

function targetRect(target: PressTarget): PressRect | null {
  const el = targetElement(target);
  if (el) {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  if (typeof target === "function") return target();
  if (target && !isRef(target) && !isElement(target)) return target;
  return null;
}

/** Strength of the page nudge at impact: 1.7 is about 6 px with the full 0.4 degree twist. */
const IMPACT_NUDGE = 1.7;

/** A collected stamp, as opposed to the dashed placeholder of an empty slot. */
const REAL_STAMP = '.ip-stamp:not([data-status="empty"])';

/** The glint is clipped to the outline of the impression: insets in percent of the stamp box. */
const ROUND_CLIP = { x: 3, y: 3, radius: "50%" };
const GLINT_CLIP: Partial<Record<StampShape, { x: number; y: number; radius: string }>> = {
  oval: { x: 1.5, y: 11.5, radius: "50%" },
  rounded: { x: 4, y: 14, radius: "9% / 11.5%" },
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function StampPress(props: StampPressProps) {
  const { active = true } = props;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!active || !mounted) return null;
  return createPortal(<PressOverlay {...props} />, document.body);
}

interface Layout {
  size: number;
  /** Offset of the stamp centre from the target's top-left corner. */
  cx: number;
  cy: number;
  /** Size of the slot's stamp as measured on mount (differs from `size` only when `size` is a prop). */
  natural: number;
}

/** Where the slot's stamp is right now. Null when there is nothing to stamp onto. */
function measureTarget(target: PressTarget): { rect: PressRect; natural: number; cx: number; cy: number } | null {
  const el = targetElement(target);
  if (el && !el.isConnected) return null;
  const rect = targetRect(target);
  if (!rect || !(rect.width > 0.5) || !(rect.height > 0.5) || !Number.isFinite(rect.left + rect.top)) return null;
  let natural = Math.min(rect.width, rect.height);
  let cx = rect.width / 2;
  let cy = rect.height / 2;
  const inner = el ? (el.matches(".ip-stamp") ? el : el.querySelector(".ip-stamp")) : null;
  if (inner) {
    const r = inner.getBoundingClientRect();
    if (r.width > 0.5 && r.height > 0.5) {
      natural = Math.min(r.width, r.height);
      cx = r.left - rect.left + r.width / 2;
      cy = r.top - rect.top + r.height / 2;
    }
  }
  return { rect, natural, cx, cy };
}

/** The slot may change by this fraction mid-press (the impact nudge scales it) before we give up. */
const SIZE_TOLERANCE = 0.03;

function PressOverlay({
  stamp,
  target,
  size: sizeProp,
  rotate,
  ink: inkQuality = "rough",
  surface,
  hideTarget = true,
  sound = false,
  haptics = true,
  skippable = true,
  announce = true,
  speed = 1,
  zIndex = 80,
  onImpact,
  onComplete,
  freezeAt,
  reducedMotion,
}: StampPressProps) {
  const tok = useDirectionTokens();
  const deviceReduced = useReducedMotion() ?? false;
  const reduced = reducedMotion ?? deviceReduced;
  const [layout, setLayout] = useState<Layout | null>(null);
  const [done, setDone] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const bleedRef = useRef<HTMLDivElement>(null);
  const glintRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<() => void>(() => undefined);

  const ink = useMotionValue(0);
  const fleck = useMotionValue(0);

  // Latest props for the long-lived effect, so a re-render never restarts the animation.
  const live = useRef({ target, surface, sound, haptics, hideTarget, onImpact, onComplete });
  live.current = { target, surface, sound, haptics, hideTarget, onImpact, onComplete };

  /* --- Measure the slot ------------------------------------------------ */
  useIsoLayoutEffect(() => {
    const m = measureTarget(target);
    const size = sizeProp ?? m?.natural ?? 0;
    if (!m || !(size > 0.5) || !Number.isFinite(size)) {
      // Nothing to stamp onto (the slot is not in the document, or has no size). Never leave the
      // host waiting.
      const id = window.setTimeout(() => {
        live.current.onImpact?.();
        live.current.onComplete?.();
      }, 0);
      return () => window.clearTimeout(id);
    }
    setLayout({ size: Math.round(size * 100) / 100, cx: m.cx, cy: m.cy, natural: m.natural });
    // The size is fixed per mount. The position is re-measured while the moment plays, and a slot
    // that changes size or disappears mid-press ends the moment (see `place`).
  }, []);

  /* --- Run the moment --------------------------------------------------- */
  useEffect(() => {
    if (!layout) return;
    const { size } = layout;
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box) return;

    const spec = stamperSpec(size, stamp.shape);
    const reach = stamperReach(spec);
    const canvasW = Math.ceil(reach.side * 2);
    const canvasH = Math.ceil(reach.up + reach.down);
    const inkHex = stamp.kind === "provincial" ? tok.ink.provincial : tok.ink[stamp.status];
    const paint: StamperPaint = {
      material: stamperMaterial(tok),
      ink: inkHex,
      pageInk: tok.paper.ink,
      art: null,
      font: null,
      lettering: letteringFor(stamp),
    };

    let ctx: CanvasRenderingContext2D | null = null;
    if (canvas && !reduced) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvasW * dpr);
      canvas.height = Math.round(canvasH * dpr);
      canvas.style.width = `${canvasW}px`;
      canvas.style.height = `${canvasH}px`;
      ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint.font = resolveStampFont(tok.id);
      // Bake the tool's top face now, while it is still invisible, not mid-swing.
      // A no-op when preloadStampPress() already did it.
      if (ctx) prepareStamper(spec, paint);
    }

    let cancelled = false;
    let now = 0;
    if (ctx) {
      // The artwork only shows while the face of the die is toward the viewer (the first 0.3 s).
      // If it is not cached and arrives later than that, skip the tinting instead of spending
      // main-thread time mid-swing. Hosts avoid the gap altogether with preloadStampPress().
      void loadTintedArt(artUrl(stamp.art), faceInk(inkHex), () => !cancelled && now < 0.24).then((art) => {
        if (cancelled || !art) return;
        paint.art = art;
        if (now < 0.3 && freezeAt == null) render(now);
        else if (freezeAt != null) render(Math.max(0, Math.min(PRESS.duration, freezeAt)));
      });
    }

    /*
     * Keep the overlay glued to the slot. The slot is re-measured every time: on each frame of
     * the moment (so the overlay rides the impact nudge with the page), when the slot resizes and
     * when the window or the visual viewport scrolls or resizes. If the slot has gone, has no
     * size, or is no longer the size this moment was built for (a rotation, a layout breakpoint),
     * the moment ends at once: the host still gets onImpact and onComplete, in that order.
     */
    let bailed = false;
    const place = () => {
      if (bailed || cancelled) return;
      const m = measureTarget(live.current.target);
      if (!m || Math.abs(m.natural - layout.natural) > layout.natural * SIZE_TOLERANCE) {
        bail();
        return;
      }
      // Snap to device pixels: the impression must land exactly on the page's own stamp, and a
      // layer translated by a fraction of a pixel is resampled soft.
      const dpr = window.devicePixelRatio || 1;
      const snap = (v: number) => Math.round(v * dpr) / dpr;
      const x = m.rect.left + m.cx;
      const y = m.rect.top + m.cy;
      box.style.transform = `translate3d(${snap(x - size / 2)}px, ${snap(y - size / 2)}px, 0)`;
      if (canvas) canvas.style.transform = `translate3d(${snap(x - canvasW / 2)}px, ${snap(y - reach.up)}px, 0)`;
    };
    const targetEl = targetElement(target);
    const observer = typeof ResizeObserver !== "undefined" && targetEl ? new ResizeObserver(() => place()) : null;
    if (observer && targetEl) observer.observe(targetEl);
    const viewport = window.visualViewport ?? null;
    window.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place);
    window.addEventListener("orientationchange", place);
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);

    /* Draw one frame of the moment. */
    const contactX = PRESS.contact.x * size;
    const contactY = PRESS.contact.y * size;
    let masked = false;
    function render(time: number) {
      now = time;
      const s = stamperFrame(time);
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvasW, canvasH);
        if (s.alpha > 0.001) {
          drawStamper(ctx, spec, paint, {
            x: canvasW / 2,
            // The entrance comes up from the lower right: the tool and its shadow share the offset.
            y: reach.up + s.drop * size,
            height: s.height * size,
            pitch: s.pitch,
            roll: s.roll,
            drift: s.drift * size,
            squash: s.squash,
            scale: s.scale,
            ring: s.ring,
          });
        }
        canvas.style.opacity = s.alpha.toFixed(3);
      }
      const f = impressionFrame(time);
      ink.set(f.ink);
      fleck.set(f.speckle);
      if (f.handIn > 0) handOver(f.handIn, f.handOut);
      const inkEl = inkRef.current;
      if (inkEl) {
        if (f.spread != null) {
          const r = f.spread * size;
          const mask = `radial-gradient(circle at ${contactX.toFixed(1)}px ${contactY.toFixed(1)}px, #000 ${Math.max(0, r - size * 0.26).toFixed(1)}px, transparent ${r.toFixed(1)}px)`;
          inkEl.style.setProperty("-webkit-mask-image", mask);
          inkEl.style.setProperty("mask-image", mask);
          masked = true;
        } else if (masked) {
          inkEl.style.removeProperty("-webkit-mask-image");
          inkEl.style.removeProperty("mask-image");
          masked = false;
        }
      }
      if (scaleRef.current) scaleRef.current.style.transform = `scale(${f.scale.toFixed(4)})`;
      if (bleedRef.current) bleedRef.current.style.opacity = f.bleed.toFixed(3);
      const glint = glintRef.current;
      if (glint) {
        glint.style.opacity = f.glintAlpha.toFixed(3);
        const bandEl = glint.firstElementChild as HTMLElement | null;
        if (bandEl) bandEl.style.transform = `translate3d(${((-0.5 + f.glintPos * 1.55) * size).toFixed(2)}px, 0, 0) skewX(-20deg)`;
      }
    }

    /* Things that happen once, when the rubber meets the paper. */
    let impacted = false;
    let hidden: { el: HTMLElement; opacity: string; transition: string } | null = null;
    const impact = (physical: boolean) => {
      if (impacted) return;
      impacted = true;
      const p = live.current;
      const el = targetElement(p.target);
      if (p.hideTarget && !bailed && el instanceof HTMLElement) {
        hidden = { el, opacity: el.style.opacity, transition: el.style.transition };
        el.style.transition = `opacity ${reduced ? 300 : 90}ms linear`;
        el.style.opacity = "0";
      }
      if (physical) {
        // The book takes the hit: about 6 px and a slight twist. The overlay is re-placed on the
        // slot every frame (see `place`), so the impression and the tool ride the nudge with it.
        const surfaceEl = targetElement(p.surface ?? null) ?? el?.closest("[data-press-surface]") ?? null;
        if (surfaceEl) nudge(surfaceEl, IMPACT_NUDGE);
        else nudge(box, IMPACT_NUDGE);
      }
      if (p.haptics && !bailed) vibrate(physical ? IMPACT_PATTERN : 12);
      if (p.sound && !bailed && soundReady()) playThunk();
      // The host usually re-renders in onImpact (counters, the slot). Let the hit itself reach the
      // screen first: the callback runs a few frames later, while the tool rests on the page.
      if (physical) pendingImpact = window.setTimeout(notifyImpact, 48);
      else p.onImpact?.();
    };

    /*
     * Hand over to the page's own stamp (see HAND_IN in timeline.ts). Only possible when the host
     * has put the real stamp into the hidden target by now, which it does by committing in
     * onImpact. Otherwise the overlay simply stays up until the host unmounts it.
     */
    let handing: boolean | null = null;
    const handOver = (pageStamp: number, overlay: number) => {
      const h = hidden as { el: HTMLElement; opacity: string; transition: string } | null;
      if (handing === null) {
        handing = !!h && (h.el.matches(REAL_STAMP) || h.el.querySelector(REAL_STAMP) !== null);
        if (handing && h) h.el.style.transition = "none";
      }
      if (!handing || !h) return;
      h.el.style.opacity = pageStamp >= 1 ? h.opacity : pageStamp.toFixed(3);
      box.style.opacity = overlay.toFixed(3);
    };
    let pendingImpact: number | null = null;
    const notifyImpact = () => {
      if (pendingImpact == null) return;
      window.clearTimeout(pendingImpact);
      pendingImpact = null;
      live.current.onImpact?.();
    };

    let finished = false;
    const finish = () => {
      if (finished || cancelled) return;
      finished = true;
      impact(false);
      notifyImpact();
      setDone(true);
      live.current.onComplete?.();
    };

    let controls: { stop(): void } | null = null;

    /* The slot went away or changed size: stop drawing over the wrong place and finish. */
    const restoreTarget = () => {
      const h = hidden as { el: HTMLElement; opacity: string; transition: string } | null;
      if (!h) return;
      hidden = null;
      h.el.style.transition = "none";
      h.el.style.opacity = h.opacity;
      const { el, transition } = h;
      requestAnimationFrame(() => {
        el.style.transition = transition;
      });
    };
    const bail = () => {
      if (bailed || cancelled) return;
      bailed = true;
      controls?.stop();
      box.style.opacity = "0";
      if (canvas) canvas.style.opacity = "0";
      restoreTarget();
      if (freezeAt != null) return;
      finish();
    };

    place();
    if (bailed) {
      return () => {
        cancelled = true;
        observer?.disconnect();
        window.removeEventListener("scroll", place, { capture: true });
        window.removeEventListener("resize", place);
        window.removeEventListener("orientationchange", place);
        viewport?.removeEventListener("resize", place);
        viewport?.removeEventListener("scroll", place);
      };
    }

    if (freezeAt != null) {
      // Development aid: hold one frame.
      if (freezeAt >= PRESS.impact) impact(false);
      if (reduced) {
        ink.set(1);
        fleck.set(1);
        box.style.opacity = "1";
      } else {
        render(Math.max(0, Math.min(PRESS.duration, freezeAt)));
      }
    } else if (reduced) {
      // Reduced motion: no tool, no nudge. The impression fades in where it belongs, then hands
      // over to the page's own stamp.
      ink.set(1);
      fleck.set(1);
      box.style.opacity = "0";
      impact(false);
      const fadeTo = (v: number) => {
        if (v <= 0.7) box.style.opacity = (v / 0.7).toFixed(3);
        else handOver(1, 1 - (v - 0.7) / 0.3);
      };
      controls = animate(0, 1, {
        duration: REDUCED_FADE / Math.max(0.05, speed),
        ease: "linear",
        onUpdate: (v) => {
          place();
          if (!bailed) fadeTo(v);
        },
        onComplete: () => {
          if (bailed) return;
          fadeTo(1);
          finish();
        },
      });
      skipRef.current = () => {
        controls?.stop();
        fadeTo(1);
        finish();
      };
    } else {
      const play = (from: number, seconds: number) =>
        animate(from, PRESS.duration, {
          duration: seconds,
          ease: "linear",
          onUpdate: (time) => {
            place();
            if (bailed) return;
            render(time);
            if (time >= PRESS.impact) impact(true);
          },
          onComplete: () => {
            if (bailed) return;
            render(PRESS.duration);
            finish();
          },
        });
      render(0);
      controls = play(0, PRESS.duration / Math.max(0.05, speed));
      let skipped = false;
      skipRef.current = () => {
        if (skipped || finished) return;
        skipped = true;
        controls?.stop();
        // Fast-forward rather than cut: the rest of the moment plays out in a blink.
        controls = play(now, Math.max(0.12, ((PRESS.duration - now) / PRESS.duration) * 0.26));
      };
    }

    return () => {
      cancelled = true;
      controls?.stop();
      if (pendingImpact != null) window.clearTimeout(pendingImpact);
      skipRef.current = () => undefined;
      observer?.disconnect();
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
      window.removeEventListener("orientationchange", place);
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
      // Restores the host's own opacity (and, a frame later, its transition).
      restoreTarget();
    };
    // The moment plays once per mount. Props it reads later come through `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, reduced]);

  /* --- Skip on tap or key ------------------------------------------------ */
  const playing = layout !== null && !done && freezeAt == null;
  useEffect(() => {
    if (!playing || !skippable) return;
    const started = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || performance.now() - started < 140) return;
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        skipRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, skippable]);

  const onSkipPointer = useCallback(() => skipRef.current(), []);

  if (!layout) return null;
  const { size } = layout;
  const blur = Math.max(1, size / 110);
  const layer: CSSProperties = { position: "absolute", left: 0, top: 0, width: size, height: size };
  const clip = GLINT_CLIP[stamp.shape] ?? ROUND_CLIP;
  const tilt = rotate === false ? 0 : typeof rotate === "number" ? rotate : stampTilt(stamp.id, stamp.kind);

  return (
    <div
      data-direction={tok.id}
      data-stamp-press={done ? "done" : "playing"}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex,
        overflow: "hidden",
        pointerEvents: "none",
        background: "none",
        contain: "layout style",
      }}
    >
      {/* The impression, exactly where the page's own stamp will sit. */}
      <div ref={boxRef} style={{ ...layer, willChange: "transform" }}>
        <div ref={scaleRef} style={{ ...layer, transformOrigin: "50% 50%" }}>
          {!reduced && (
            <div ref={bleedRef} style={{ ...layer, opacity: 0, filter: `blur(${blur.toFixed(2)}px)`, willChange: "opacity" }}>
              <Stamp stamp={stamp} size={size} rotate={rotate} ink="clean" showLabels={false} decorative />
            </div>
          )}
          <div ref={inkRef} style={layer}>
            <Stamp stamp={stamp} size={size} rotate={rotate} inkProgress={ink} ink={inkQuality} decorative />
          </div>
          {!reduced && (
            <div
              ref={glintRef}
              style={{
                position: "absolute",
                left: `${clip.x}%`,
                top: `${clip.y}%`,
                width: `${100 - clip.x * 2}%`,
                height: `${100 - clip.y * 2}%`,
                borderRadius: clip.radius,
                overflow: "hidden",
                opacity: 0,
                transform: `rotate(${tilt}deg)`,
                willChange: "opacity",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "-15%",
                  width: "34%",
                  height: "130%",
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.34) 38%, rgba(255,255,255,.7) 50%, rgba(255,255,255,.34) 62%, rgba(255,255,255,0) 100%)",
                  willChange: "transform",
                }}
              />
            </div>
          )}
        </div>
        <InkSpeckles stamp={stamp} size={size} progress={fleck} />
      </div>

      {/* The stamper. */}
      {!reduced && <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform, opacity" }} />}

      {/* Tap anywhere to skip. */}
      {playing && skippable && (
        <div onPointerDown={onSkipPointer} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "auto", touchAction: "manipulation" }} />
      )}

      {announce && (
        <p
          role="status"
          aria-live="polite"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}
        >
          {done
            ? `${strings.moments.stampEarnedTitle}. ${t(strings.moments.stampEarnedBody, { title: stamp.title, island: stamp.island })}`
            : skippable
              ? pressStrings.skipHint
              : ""}
        </p>
      )}
    </div>
  );
}

export default StampPress;
