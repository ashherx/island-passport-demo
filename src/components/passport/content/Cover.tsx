"use client";

/**
 * Front and back cover.
 *
 * Material comes from the direction (`mat-cover`: leather, linen or kraft; a photographed texture
 * takes over automatically once the manifest lists one). On top of it:
 *   - Classic and Reef: a debossed foil emblem, foil title and a foil or stitched frame.
 *   - Journal: a cloth spine tape, a printed label and the emblem rubber-stamped in dark ink.
 *
 * The foil reacts to light: `--tx` / `--ty` (-1..1) are written on the cover root by useCoverLight
 * from the pointer, from device tilt where the browser offers it without a permission prompt, and
 * from a slow idle glint. With reduced motion the foil is static.
 *
 * The emblem is an original mark (compass ring, three hills, sun, waves). It is not a coat of
 * arms and the cover does not imitate a government passport.
 */
import { useEffect, useRef, type RefObject } from "react";
import { useDirectionTokens } from "@/components/theme";
import { strings, t } from "@/lib/strings";
import { Frame } from "./PageFrame";
import { contentStrings as cs } from "./strings";

/* ------------------------------------------------------------------ */
/* Light                                                               */
/* ------------------------------------------------------------------ */

const MOTION_GRANTED_EVENT = "ipp:motion-granted";

interface OrientationCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

/**
 * iOS only hands out device orientation after a permission prompt, and a prompt must come from a
 * tap. The cover never asks by itself. If the product wants tilt on iOS, call this from a click
 * handler; covers already on screen start listening when it resolves true.
 */
export async function requestCoverMotion(): Promise<boolean> {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return false;
  const ctor = DeviceOrientationEvent as unknown as OrientationCtor;
  if (typeof ctor.requestPermission !== "function") return true;
  try {
    const result = await ctor.requestPermission();
    if (result === "granted") {
      window.dispatchEvent(new Event(MOTION_GRANTED_EVENT));
      return true;
    }
  } catch {
    /* Dismissed, or not called from a gesture. */
  }
  return false;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function useCoverLight(ref: RefObject<HTMLDivElement | null>, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let x = 0;
    let y = 0;
    let goalX = 0;
    let goalY = 0;
    let frame = 0;
    let lastInput = 0;
    let glintStart = 0;
    let visible = true;
    let baseBeta: number | null = null;
    let baseGamma: number | null = null;

    const write = () => {
      el.style.setProperty("--tx", x.toFixed(3));
      el.style.setProperty("--ty", y.toFixed(3));
    };

    const tick = (now: number) => {
      frame = 0;
      if (glintStart) {
        // One slow pass of light across the foil and back.
        const p = (now - glintStart) / 2400;
        if (p >= 1) {
          glintStart = 0;
          goalX = 0;
          goalY = 0;
        } else {
          const s = Math.sin(Math.PI * p);
          goalX = s * 0.95;
          goalY = s * 0.35;
        }
      }
      x += (goalX - x) * 0.14;
      y += (goalY - y) * 0.14;
      write();
      if (glintStart || Math.abs(goalX - x) > 0.003 || Math.abs(goalY - y) > 0.003) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      glintStart = 0;
      lastInput = performance.now();
      goalX = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      goalY = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      wake();
    };
    const onLeave = () => {
      goalX = 0;
      goalY = 0;
      wake();
    };

    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      if (baseBeta === null || baseGamma === null) {
        baseBeta = e.beta;
        baseGamma = e.gamma;
        return;
      }
      // Drift the rest position toward how the phone is held, so the foil re-centres.
      baseBeta += (e.beta - baseBeta) * 0.02;
      baseGamma += (e.gamma - baseGamma) * 0.02;
      const nx = clamp((e.gamma - baseGamma) / 18, -1, 1);
      const ny = clamp((e.beta - baseBeta) / 18, -1, 1);
      if (Math.abs(nx - goalX) < 0.02 && Math.abs(ny - goalY) < 0.02) return;
      if (Math.abs(nx) > 0.08 || Math.abs(ny) > 0.08) {
        glintStart = 0;
        lastInput = performance.now();
      }
      goalX = nx;
      goalY = ny;
      wake();
    };

    let tiltOn = false;
    const startTilt = () => {
      if (tiltOn || typeof DeviceOrientationEvent === "undefined") return;
      tiltOn = true;
      window.addEventListener("deviceorientation", onTilt, { passive: true });
    };
    const needsPrompt =
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as OrientationCtor).requestPermission === "function";
    if (!needsPrompt) startTilt();
    window.addEventListener(MOTION_GRANTED_EVENT, startTilt);

    el.addEventListener("pointermove", onPointer, { passive: true });
    el.addEventListener("pointerdown", onPointer, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });

    // Idle glint: only when nothing else has moved the light recently and the cover is on screen.
    const glint = window.setInterval(() => {
      if (!visible || document.hidden || glintStart) return;
      if (performance.now() - lastInput < 3500) return;
      glintStart = performance.now();
      wake();
    }, 6500);
    const firstGlint = window.setTimeout(() => {
      if (!visible || document.hidden || lastInput) return;
      glintStart = performance.now();
      wake();
    }, 900);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1]?.isIntersecting ?? true;
      });
      io.observe(el);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearInterval(glint);
      window.clearTimeout(firstGlint);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener(MOTION_GRANTED_EVENT, startTilt);
      el.removeEventListener("pointermove", onPointer);
      el.removeEventListener("pointerdown", onPointer);
      el.removeEventListener("pointerleave", onLeave);
      io?.disconnect();
      el.style.removeProperty("--tx");
      el.style.removeProperty("--ty");
    };
  }, [ref, enabled]);
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** Foil-stamped text: the foil sits in a shallow impression with a lit lower edge. */
function Foil({ children, className }: { children: string; className?: string }) {
  return (
    <span className={["ipp-foil", className].filter(Boolean).join(" ")} data-text={children}>
      <span className="ipp-foil__ink foil-text">{children}</span>
    </span>
  );
}

/** The emblem as three masked layers: impression shadow, lit edge, then foil or ink. */
function Emblem({ variant, className }: { variant: "foil" | "ink" | "blind"; className?: string }) {
  return (
    <span className={["ipp-emblem", className].filter(Boolean).join(" ")} data-variant={variant} aria-hidden="true">
      <i className="ipp-emblem__lo" />
      <i className="ipp-emblem__hi" />
      {variant !== "blind" && <i className={variant === "foil" ? "ipp-emblem__face foil-fill" : "ipp-emblem__face"} />}
    </span>
  );
}

export interface CoverProps {
  province: string;
  country: string;
  passportNo: string;
  holderName: string;
  /** Foil follows pointer, tilt and an idle glint. Default true. */
  interactive?: boolean;
  /** Draw the page block peeking out along the fore edge and foot (for a cover shown by itself). */
  pageEdge?: boolean;
  initialWidth?: number;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Front cover                                                         */
/* ------------------------------------------------------------------ */

export function FrontCover({
  province,
  country,
  passportNo,
  holderName,
  interactive = true,
  pageEdge = false,
  initialWidth,
  className,
}: CoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tokens = useDirectionTokens();
  const material = tokens.cover.material;
  const printed = material === "kraft";
  useCoverLight(ref, interactive);

  return (
    <div
      ref={ref}
      className={["ipp-cover-wrap", className].filter(Boolean).join(" ")}
      data-face="front"
      data-material={material}
      data-page-edge={pageEdge ? "" : undefined}
    >
      {pageEdge && <span className="ipp-cover__block" aria-hidden="true" />}
      <Frame
        className="ipp-cover"
        data-face="front"
        data-material={material}
        initialWidth={initialWidth}
        role="img"
        aria-label={t(cs.cover.aria, { province })}
      >
        <div className="ipp-cover__mat mat-cover" aria-hidden="true" />
        <div className="ipp-cover__spine" aria-hidden="true" />
        {printed ? (
          <div className="ipp-cover__body ipp-cover__body--print" aria-hidden="true">
            <div className="ipp-label">
              <div className="ipp-label__top">
                <span>{cs.cover.labelSeries}</span>
                <span>{strings.country.code}</span>
              </div>
              <div className="ipp-label__title type-display">
                <span>{cs.cover.titleLine1}</span>
                <span>{cs.cover.titleLine2}</span>
              </div>
              <div className="ipp-label__sub">{cs.cover.subtitle}</div>
              <div className="ipp-label__line">
                <span>{cs.cover.labelProvince}</span>
                <b>{province}</b>
              </div>
              <div className="ipp-label__line">
                <span>{cs.cover.labelTraveler}</span>
                <b>{holderName}</b>
              </div>
              <div className="ipp-label__line">
                <span>{cs.cover.labelNo}</span>
                <b>{passportNo}</b>
              </div>
            </div>
            <Emblem variant="ink" className="ipp-cover__emblem" />
            <div className="ipp-cover__imprint">{strings.app.tagline}</div>
          </div>
        ) : (
          <>
            <div className="ipp-cover__frame foil-fill" aria-hidden="true" />
            <div className="ipp-cover__frame ipp-cover__frame--inner foil-fill" aria-hidden="true" />
            <div className="ipp-cover__body" aria-hidden="true">
              <div className="ipp-cover__eyebrow">
                <Foil>{t(cs.cover.eyebrow, { province, country })}</Foil>
              </div>
              <div className="ipp-cover__title type-display">
                <Foil>{cs.cover.titleLine1}</Foil>
                <Foil>{cs.cover.titleLine2}</Foil>
              </div>
              <Emblem variant="foil" className="ipp-cover__emblem" />
              <div className="ipp-cover__subtitle">
                <i className="ipp-cover__orn foil-fill" />
                <Foil>{cs.cover.subtitle}</Foil>
                <i className="ipp-cover__orn foil-fill" />
              </div>
              <div className="ipp-cover__province type-display">
                <Foil>{province}</Foil>
              </div>
            </div>
          </>
        )}
        <div className="ipp-cover__specular" aria-hidden="true" />
        <div className="mat-sheen ipp-cover__sheen" aria-hidden="true" />
        <div className="ipp-cover__bevel" aria-hidden="true" />
      </Frame>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Back cover                                                          */
/* ------------------------------------------------------------------ */

export function BackCover({
  pageEdge = false,
  initialWidth,
  className,
}: Pick<CoverProps, "pageEdge" | "initialWidth" | "className">) {
  const tokens = useDirectionTokens();
  const material = tokens.cover.material;
  const printed = material === "kraft";
  // One sentence per line, so the tagline never breaks mid-phrase.
  const taglineLines = (strings.app.tagline.match(/[^.!?]+[.!?]?/g) ?? [strings.app.tagline]).map((s) => s.trim());
  return (
    <div
      className={["ipp-cover-wrap", className].filter(Boolean).join(" ")}
      data-face="back"
      data-material={material}
      data-page-edge={pageEdge ? "" : undefined}
    >
      {pageEdge && <span className="ipp-cover__block" aria-hidden="true" />}
      <Frame
        className="ipp-cover"
        data-face="back"
        data-material={material}
        initialWidth={initialWidth}
        role="img"
        aria-label={cs.cover.backAria}
      >
        <div className="ipp-cover__mat mat-cover" aria-hidden="true" />
        <div className="ipp-cover__spine" aria-hidden="true" />
        <div className="ipp-cover__body ipp-cover__body--back" aria-hidden="true">
          <Emblem variant={printed ? "ink" : "blind"} className="ipp-cover__emblem" />
          <div className="ipp-cover__backline">
            {taglineLines.map((line) =>
              printed ? (
                <span key={line} className="ipp-cover__printed">
                  {line}
                </span>
              ) : (
                <Foil key={line}>{line}</Foil>
              ),
            )}
          </div>
          <div className="ipp-cover__credit">{cs.cover.backCredit}</div>
          <div className="ipp-cover__notice">
            <span className="ipp-cover__sample">{strings.sample.tag}</span>
            <span>{strings.sample.notice}</span>
          </div>
        </div>
        <div className="mat-sheen ipp-cover__sheen" aria-hidden="true" />
        <div className="ipp-cover__bevel" aria-hidden="true" />
      </Frame>
    </div>
  );
}
