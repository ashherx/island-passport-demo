"use client";

/**
 * <StatusUpgrade />: a "Donation pending" stamp becomes "Verified Supporter" in place (UX-3, STM-3).
 *
 * It is deliberately a different gesture from the first stamping moment. Nothing is stamped
 * again: the provisional mark is confirmed where it sits.
 *
 *   1. The clock badge's hands race forward while a solid line is drawn over the dashed outline.
 *   2. Verified ink soaks in as the pale pending ink drains away.
 *   3. The clock pops off and the gold-foil seal is pressed onto its corner: the paper gives,
 *      a ring of light and a few foil sparks escape, the phone ticks (where supported).
 *   4. A band of light crosses the foil and the status label rolls over to "Verified Supporter".
 *
 * About 2s. Tap the stamp or press Escape to skip. With reduced motion it is a short cross-fade.
 * See docs/agents/celebrations.md.
 */
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Stamp, VerifiedSeal, sealAnchor, stampTilt } from "@/components/stamp";
import { burstPath, circlePath } from "@/components/stamp/geometry";
import { useDirectionTokens } from "@/components/theme";
import { play as sfx, type SoundHandle } from "@/lib/sound";
import { formatDate, strings, t } from "@/lib/strings";
import type { Stamp as StampData } from "@/lib/types";
import { StatusChip } from "./celebrations/StatusChip";
import { HAPTICS, vibrate } from "./celebrations/haptics";
import { outlinePath } from "./celebrations/outline";
import { celebrationStrings } from "./celebrations/strings";
import "./celebrations/celebrations.css";

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type StatusUpgradePhase = "idle" | "playing" | "done";

export interface StatusUpgradeProps {
  /** The stamp being upgraded. Its own `status` is ignored: it is drawn pending, then verified. */
  stamp: StampData;
  /** Pixel size of the stamp box. Default 200. */
  size?: number;
  /** State on mount. Default "pending". */
  initial?: "pending" | "verified";
  /** Play once after mounting. */
  autoPlay?: boolean;
  /** Delay before autoPlay, in ms. Default 350. */
  delay?: number;
  /**
   * Morphing status label under the stamp. "paper" when it sits on a passport page,
   * "chrome" when it sits on the app background, false to leave it out. Default "paper".
   */
  label?: "paper" | "chrome" | false;
  /** Short vibration when the seal lands, where supported. Default true. */
  haptics?: boolean;
  /** Forwarded to <Stamp />. Default: the stamp's own deterministic tilt. */
  rotate?: number | false;
  /** Forwarded to <Stamp />. */
  blend?: "normal" | "multiply";
  /**
   * Forwarded to <Stamp /> (added by the integrator): pass what the page passes, so the stamp
   * does not change its level of detail when the upgrade takes over a slot.
   */
  detail?: "auto" | "compact" | "full" | "large";
  /** The seal lands (or the animation is skipped). Update counters and the progress ring here. */
  onImpact?(): void;
  /** The upgrade has finished and the component shows a plain verified <Stamp />. */
  onComplete?(): void;
  /**
   * Force reduced motion on or off (the host's own switch). Default: the device setting
   * (`prefers-reduced-motion`).
   */
  reducedMotion?: boolean;
  className?: string;
  style?: CSSProperties;
}

export interface StatusUpgradeHandle {
  /** Start the upgrade. No-op while playing. From "done" it restarts from pending. */
  play(): void;
  /** Jump to the verified end state and fire onImpact (if still due) and onComplete. */
  skip(): void;
  /** Back to pending without animating. */
  reset(): void;
}

/**
 * Timeline in seconds. `total` is when the overlays are removed: 0.63 s after the seal lands, by
 * which time every overlay (ring, sparks, emboss, the light band on the foil) has played out.
 */
export const STATUS_UPGRADE_TIMELINE = {
  draw: 0.06,
  drawDuration: 0.72,
  flood: 0.42,
  floodDuration: 0.8,
  clockOut: 0.82,
  seal: 1.02,
  sealDuration: 0.4,
  impact: 1.42,
  sweep: 1.48,
  sweepDuration: 0.46,
  /** Longest overlay after the impact (ring, sparks, emboss). */
  afterglow: 0.5,
  total: 2.05,
  reducedTotal: 0.34,
} as const;

const T = STATUS_UPGRADE_TIMELINE;
const PENDING_R = 25;
type Bezier = [number, number, number, number];
const PRESS_EASE: Bezier = [0.6, 0, 0.9, 0.3];
const SOFT_EASE: Bezier = [0.22, 1, 0.36, 1];

/* ------------------------------------------------------------------ */
/* Overlays shown only while playing                                   */
/* ------------------------------------------------------------------ */

interface OverlayProps {
  stamp: StampData;
  size: number;
  tilt: number;
  weight: number;
  detail?: "auto" | "compact" | "full" | "large";
  /** The seal has met the paper (end of its flight). */
  onLand?(): void;
}

/** Ink layer: the line drawn over the dashes, the wash, and the clock whose hands race. */
function InkOverlay({ stamp, size, weight, detail = "auto" }: OverlayProps) {
  const id = `ipc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const compact = detail === "auto" ? size < 120 : detail === "compact";
  const large = detail === "auto" ? size >= 220 : detail === "large";
  const d = outlinePath(stamp.shape);
  const anchor = sealAnchor(stamp.shape);
  const ax = anchor.x * 200;
  const ay = anchor.y * 200;
  const strokeW = (compact ? 4.6 : 3.2) * weight * 1.05;
  const k = PENDING_R / 25;
  const clock = large ? 8.6 * k : 12.5 * k;
  const drawTransition = { delay: T.draw, duration: T.drawDuration, ease: [0.45, 0.05, 0.25, 1] as Bezier };

  return (
    <svg className="ip-stamp__svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={d} />
        </clipPath>
        <radialGradient id={`${id}-wash`}>
          <stop offset="0" stopOpacity="0.9" style={{ stopColor: "var(--ink-verified)" }} />
          <stop offset="0.55" stopOpacity="0.7" style={{ stopColor: "var(--ink-verified)" }} />
          <stop offset="1" stopOpacity="0" style={{ stopColor: "var(--ink-verified)" }} />
        </radialGradient>
      </defs>

      {/* Wash: ink spreading under the frame as the confirmation soaks in. */}
      <g clipPath={`url(#${id}-clip)`} style={{ color: "var(--ink-verified)" }}>
        <motion.circle
          cx={100}
          cy={100}
          fill={`url(#${id}-wash)`}
          initial={{ r: 12, opacity: 0 }}
          animate={{ r: 128, opacity: [0, 0.3, 0.22, 0] }}
          transition={{
            r: { delay: T.flood - 0.08, duration: T.floodDuration, ease: SOFT_EASE },
            opacity: { delay: T.flood - 0.08, duration: T.floodDuration + 0.1, times: [0, 0.22, 0.6, 1], ease: "linear" },
          }}
        />
      </g>

      {/* The dashed outline is drawn solid, led by a wet bead of ink. */}
      <g fill="none" strokeLinejoin="round" style={{ color: "var(--ink-verified)" }}>
        <motion.path
          d={d}
          stroke="currentColor"
          strokeWidth={strokeW}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.97 }}
          animate={{ pathLength: 1, opacity: [0.97, 0.97, 0] }}
          transition={{
            pathLength: drawTransition,
            opacity: { delay: T.draw, duration: T.flood + T.floodDuration - T.draw, times: [0, 0.72, 1], ease: "linear" },
          }}
        />
        <motion.path
          d={d}
          stroke="currentColor"
          strokeWidth={strokeW * 1.9}
          strokeLinecap="round"
          initial={{ pathLength: 0.012, pathOffset: 0, opacity: 0 }}
          animate={{ pathOffset: 0.988, opacity: [0, 1, 1, 0] }}
          transition={{
            pathOffset: drawTransition,
            opacity: { delay: T.draw, duration: T.drawDuration, times: [0, 0.06, 0.9, 1], ease: "linear" },
          }}
        />
      </g>

      {/* The pending clock: hands race forward, then the badge pops off to make room for the seal. */}
      <g transform={`translate(${ax} ${ay})`} style={{ color: "var(--ink-pending)" }} opacity={0.8}>
        <motion.g
          className="ip-stamp__pendingmark"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: [1, 1.14, 0.3], opacity: [1, 1, 0] }}
          transition={{ delay: T.clockOut, duration: 0.26, times: [0, 0.38, 1], ease: "easeIn" }}
        >
          <circle r={PENDING_R} strokeWidth={2.2 * k} />
          {large ? (
            <>
              <path id={`${id}-pt`} d={circlePath(PENDING_R * 0.6)} stroke="none" />
              <text fontSize={PENDING_R * 0.215} stroke="none" textLength={2 * Math.PI * PENDING_R * 0.6 * 0.96} lengthAdjust="spacing">
                <textPath href={`#${id}-pt`} startOffset="0">
                  {`${strings.status.pending.tab.split(" ").join(" · ")} ·`}
                </textPath>
              </text>
            </>
          ) : (
            <circle r={PENDING_R * 0.8} strokeWidth={1.1 * k} strokeDasharray={`${0.1 * k} ${3.1 * k}`} />
          )}
          <circle r={clock} strokeWidth={2.2 * k} />
          {/* The invisible square keeps each hand's bounding box centred on the pivot. */}
          <motion.g
            initial={{ rotate: 0 }}
            animate={{ rotate: 1080 }}
            transition={{ duration: T.clockOut + 0.22, ease: [0.5, 0, 0.75, 0.6] }}
          >
            <rect x={-clock} y={-clock} width={clock * 2} height={clock * 2} stroke="none" />
            <path d={`M 0 ${-clock * 0.58} V 0`} strokeWidth={2.2 * k} />
          </motion.g>
          <motion.g
            initial={{ rotate: 0 }}
            animate={{ rotate: 270 }}
            transition={{ duration: T.clockOut + 0.22, ease: [0.5, 0, 0.75, 0.6] }}
          >
            <rect x={-clock} y={-clock} width={clock * 2} height={clock * 2} stroke="none" />
            <path d={`M 0 0 L ${clock * 0.42} ${clock * 0.26}`} strokeWidth={2.2 * k} />
          </motion.g>
        </motion.g>
      </g>
    </svg>
  );
}

const SPARKS = [
  { a: -152, d: 1.0, s: 9, delay: 0 },
  { a: -98, d: 1.18, s: 7, delay: 0.03 },
  { a: -38, d: 0.94, s: 10, delay: 0.01 },
  { a: 22, d: 1.1, s: 6, delay: 0.05 },
  { a: 84, d: 0.9, s: 8, delay: 0.02 },
  { a: 146, d: 1.12, s: 6, delay: 0.04 },
] as const;

/** Foil layer: the seal coming down, its shadow, the emboss, the ring of light and the sparks. */
function SealOverlay({ stamp, size, tilt, onLand }: OverlayProps) {
  const anchor = sealAnchor(stamp.shape);
  const sealSize = (64 / 200) * size; // VerifiedSeal draws r=28 in a 64-unit box; the stamp draws r=28 in 200
  const disc = anchor.r * 2 * size; // diameter of the foil burst
  const centre = (w: number): CSSProperties => ({ width: w, height: w, marginLeft: -w / 2, marginTop: -w / 2 });
  const flight = { delay: T.seal, duration: T.sealDuration, times: [0, 0.6, 1], ease: ["easeOut" as const, PRESS_EASE] };

  return (
    <div className="ipc-upgrade__anchor" style={{ left: anchor.x * size, top: anchor.y * size }} aria-hidden="true">
      {/* Emboss: the paper gives around the seal. */}
      <motion.div
        className="ipc-upgrade__dent"
        style={centre(disc * 1.34)}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: [0, 1, 0], scale: [0.94, 1, 1.05] }}
        transition={{ delay: T.impact - 0.02, duration: T.afterglow + 0.02, times: [0, 0.16, 1], ease: "easeOut" }}
      />
      {/* Shadow that tightens as the seal comes down. */}
      <motion.div
        className="ipc-upgrade__shadow"
        style={centre(disc * 1.15)}
        initial={{ opacity: 0, scale: 2.1, x: size * 0.12, y: size * 0.17 }}
        animate={{ opacity: [0, 0.42, 0], scale: [2.1, 1.35, 0.92], x: [size * 0.12, size * 0.035, 0], y: [size * 0.17, size * 0.05, 0] }}
        transition={{ ...flight, ease: ["easeOut" as const, "easeIn" as const] }}
      />
      {/* Ring of light at the moment of contact. */}
      <motion.div
        className="ipc-upgrade__ring"
        style={centre(disc)}
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: [0, 0.9, 0], scale: [1, 1.25, 2.15] }}
        transition={{ delay: T.impact, duration: T.afterglow, times: [0, 0.12, 1], ease: SOFT_EASE }}
      />
      {SPARKS.map((sp) => {
        const rad = (sp.a * Math.PI) / 180;
        const reach = disc * 0.5;
        const s = Math.max(5, (sp.s * size) / 200);
        return (
          <motion.span
            key={sp.a}
            style={{
              ...centre(s),
              background: "var(--foil-hi)",
              boxShadow: "0 0 0 0.5px var(--foil)",
              clipPath: "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)",
              WebkitClipPath: "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)",
            }}
            initial={{ opacity: 0, scale: 0, x: Math.cos(rad) * reach * 0.9, y: Math.sin(rad) * reach * 0.9, rotate: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.25, 0.2],
              x: Math.cos(rad) * reach * (1.7 + sp.d * 0.9),
              y: Math.sin(rad) * reach * (1.7 + sp.d * 0.9),
              rotate: 90,
            }}
            transition={{ delay: T.impact + sp.delay, duration: T.afterglow - 0.02, times: [0, 0.25, 1], ease: SOFT_EASE }}
          />
        );
      })}
      {/* The seal itself. */}
      <motion.div
        style={centre(sealSize)}
        initial={{ opacity: 0, scale: 2.5, x: size * 0.3, y: -size * 0.5, rotate: 32 }}
        animate={{
          opacity: [0, 1, 1],
          scale: [2.5, 1.5, 1],
          x: [size * 0.3, size * 0.05, 0],
          y: [-size * 0.5, -size * 0.1, 0],
          rotate: [32, 7, 0],
        }}
        transition={flight}
        onAnimationComplete={onLand}
      >
        <motion.div
          style={{ width: sealSize, height: sealSize, rotate: -tilt - 8 }}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 0.9, 1.03, 1] }}
          transition={{ delay: T.impact, duration: 0.4, times: [0, 0.2, 0.62, 1], ease: "easeOut" }}
        >
          <VerifiedSeal size={sealSize} withText={size >= 220} decorative />
          <svg
            className="ipc-sweep"
            data-run="once"
            width={sealSize}
            height={sealSize}
            viewBox="-32 -32 64 64"
            style={
              {
                position: "absolute",
                inset: 0,
                overflow: "visible",
                "--sweep-delay": `${T.sweep}s`,
                "--sweep-duration": `${T.sweepDuration}s`,
              } as CSSProperties
            }
          >
            <path d={burstPath(24, 28, 28 * 0.905)} fill="#fff" opacity="0.72" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const StatusUpgrade = forwardRef<StatusUpgradeHandle, StatusUpgradeProps>(function StatusUpgrade(
  {
    stamp,
    size = 200,
    initial = "pending",
    autoPlay = false,
    delay = 350,
    label = "paper",
    haptics = true,
    rotate,
    blend,
    detail,
    onImpact,
    onComplete,
    reducedMotion,
    className,
    style,
  },
  ref,
) {
  const tok = useDirectionTokens();
  const deviceReduced = useReducedMotion() ?? false;
  const reduced = reducedMotion ?? deviceReduced;
  const [phase, setPhase] = useState<StatusUpgradePhase>(initial === "verified" ? "done" : "idle");
  const [impacted, setImpacted] = useState(initial === "verified");
  const [simple, setSimple] = useState(false);
  const [playId, setPlayId] = useState(0);

  const ink = useMotionValue(initial === "verified" ? 1 : 0);
  const pendingOpacity = useMotionValue(1);
  const verifiedOpacity = useMotionValue(1);
  const boxScale = useMotionValue(1);
  const boxY = useMotionValue(0);

  const phaseRef = useRef(phase);
  const impactedRef = useRef(impacted);
  const timers = useRef<number[]>([]);
  const anims = useRef<AnimationPlaybackControls[]>([]);
  /** The chime of the play under way, so that a skip can take it back. */
  const chime = useRef<SoundHandle | null>(null);
  const callbacks = useRef({ onImpact, onComplete, haptics });
  callbacks.current = { onImpact, onComplete, haptics };

  const tilt = rotate === false ? 0 : typeof rotate === "number" ? rotate : stampTilt(stamp.id, stamp.kind);

  const clear = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    anims.current.forEach((a) => a.stop());
    anims.current = [];
  }, []);

  const goto = useCallback((next: StatusUpgradePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const impact = useCallback((withHaptics: readonly number[] | null) => {
    if (impactedRef.current) return;
    impactedRef.current = true;
    setImpacted(true);
    if (withHaptics && callbacks.current.haptics) vibrate(withHaptics);
    callbacks.current.onImpact?.();
  }, []);

  const finish = useCallback(() => {
    clear();
    ink.set(1);
    pendingOpacity.set(0);
    verifiedOpacity.set(1);
    boxScale.set(1);
    boxY.set(0);
    impact(null);
    const wasDone = phaseRef.current === "done";
    goto("done");
    if (!wasDone) callbacks.current.onComplete?.();
  }, [boxScale, boxY, clear, goto, impact, ink, pendingOpacity, verifiedOpacity]);

  const reset = useCallback(() => {
    clear();
    ink.set(0);
    pendingOpacity.set(1);
    verifiedOpacity.set(1);
    boxScale.set(1);
    boxY.set(0);
    impactedRef.current = false;
    setImpacted(false);
    chime.current?.stop();
    chime.current = null;
    goto("idle");
  }, [boxScale, boxY, clear, goto, ink, pendingOpacity, verifiedOpacity]);

  const play = useCallback(() => {
    if (phaseRef.current === "playing") return;
    reset();
    const at = (seconds: number, fn: () => void) => timers.current.push(window.setTimeout(fn, seconds * 1000));
    setPlayId((n) => n + 1);

    if (reduced) {
      // UX-5: no travel, no flashes. The verified stamp fades in over the pending one.
      setSimple(true);
      ink.set(1);
      verifiedOpacity.set(0);
      goto("playing");
      anims.current.push(
        animate(verifiedOpacity, 1, { duration: 0.26, ease: "linear" }),
        animate(pendingOpacity, 0, { duration: 0.26, ease: "linear" }),
      );
      at(0.12, () => {
        // No seal comes down, so no press: the chime alone, as the verified ink comes up.
        if (!impactedRef.current) chime.current = sfx.verified({ chimeOnly: true, volume: 0.8 });
        impact(HAPTICS.soft);
      });
      at(T.reducedTotal, finish);
      return;
    }

    setSimple(false);
    goto("playing");
    anims.current.push(
      animate(ink, 1, { delay: T.flood, duration: T.floodDuration, ease: [0.3, 0.1, 0.3, 1] }),
      animate(pendingOpacity, 0, { delay: T.flood + 0.04, duration: 0.5, ease: "easeInOut" }),
    );
    // The seal's own flight reports the landing (see `land`), so the callback, the vibration and
    // the dip of the page share a frame with the visible hit even when the overlays mounted late.
    // These timers only cover a flight that never reports.
    at(T.impact + 0.12, () => landRef.current());
    at(T.total + 0.3, finish);
  }, [finish, goto, impact, ink, pendingOpacity, reduced, reset, verifiedOpacity]);

  /** The seal meets the paper. Once per play. */
  const land = useCallback(() => {
    if (phaseRef.current !== "playing" || impactedRef.current) return;
    // The same call stack as the vibration and the dip of the page: the embossing press on the
    // contact frame, the chime rising out of it.
    chime.current = sfx.verified();
    impact(HAPTICS.sealPress);
    // The page takes the press: a small dip and settle.
    anims.current.push(
      animate(boxScale, [1, 0.972, 1.008, 1], { duration: 0.44, times: [0, 0.2, 0.62, 1], ease: "easeOut" }),
      animate(boxY, [0, 2.5, 0], { duration: 0.32, times: [0, 0.25, 1], ease: "easeOut" }),
    );
    timers.current.push(window.setTimeout(finish, (T.total - T.impact) * 1000));
  }, [boxScale, boxY, finish, impact]);
  const landRef = useRef(land);
  landRef.current = land;

  const skip = useCallback(() => {
    if (phaseRef.current === "done") return;
    // Skipped before the seal: nothing has sounded and nothing will (finish() is silent). Skipped
    // after it: the chime is let go with the rest of the moment.
    chime.current?.stop(0.16);
    chime.current = null;
    finish();
  }, [finish]);

  useImperativeHandle(ref, () => ({ play, skip, reset }), [play, skip, reset]);

  // Autoplay once.
  const autoPlayed = useRef(false);
  useEffect(() => {
    if (!autoPlay || autoPlayed.current || phaseRef.current !== "idle") return;
    const id = window.setTimeout(() => {
      autoPlayed.current = true;
      play();
    }, delay);
    return () => window.clearTimeout(id);
  }, [autoPlay, delay, play]);

  // Escape skips while playing.
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, skip]);

  useEffect(() => clear, [clear]);

  const status = impacted ? "verified" : "pending";
  const aria = t(strings.stamp.ariaStamp, {
    title: stamp.title,
    island: stamp.island,
    status: strings.status[status].label,
    date: formatDate(stamp.date),
  });
  const announce = impacted && phase !== "idle"
    ? `${strings.moments.verifiedTitle}. ${t(strings.moments.verifiedBody, { charity: stamp.charity, island: stamp.island })}`
    : phase === "playing"
      ? celebrationStrings.upgrade.skipHint
      : "";
  const overlay: OverlayProps = { stamp, size, tilt, weight: tok.impression.weight, detail };
  const onSealLand = useCallback(() => landRef.current(), []);

  return (
    <div className={["ipc-upgrade", className].filter(Boolean).join(" ")} style={style} data-phase={phase} data-status={status}>
      <motion.div
        className="ipc-upgrade__box"
        style={{ width: size, height: size, scale: boxScale, y: boxY, cursor: phase === "playing" ? "pointer" : undefined }}
        role="img"
        aria-label={aria}
        onClick={phase === "playing" ? skip : undefined}
      >
        {phase !== "done" && (
          <motion.div className="ipc-upgrade__layer" style={{ opacity: pendingOpacity }}>
            <Stamp stamp={stamp} status="pending" size={size} rotate={rotate} blend={blend} detail={detail} showSeal={phase === "idle" || simple} decorative />
          </motion.div>
        )}
        {/* Mounted from the start (invisible while ink is 0) so pressing play does not pay for it. */}
        <motion.div className="ipc-upgrade__layer" style={{ opacity: verifiedOpacity }}>
          <Stamp
            stamp={stamp}
            status="verified"
            size={size}
            rotate={rotate}
            blend={blend}
            detail={detail}
            showSeal={phase === "done" || simple}
            inkProgress={ink}
            decorative
          />
        </motion.div>
        {phase === "playing" && !simple && (
          <div key={playId} className="ipc-upgrade__tilt" style={{ transform: `rotate(${tilt}deg)` }}>
            <InkOverlay {...overlay} />
            <SealOverlay {...overlay} onLand={onSealLand} />
          </div>
        )}
      </motion.div>
      {label && <StatusChip status={status} surface={label} animated={phase !== "idle"} />}
      <span className="ipc-upgrade__sr" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
});

export default StatusUpgrade;
