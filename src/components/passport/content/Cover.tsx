"use client";

/**
 * Front and back cover.
 *
 * Material comes from the direction (`mat-cover`: leather, linen or kraft; a photographed texture
 * takes over automatically once the manifest lists one). On top of it:
 *   - Classic and Reef: a debossed foil emblem, foil title and a foil or stitched frame.
 *   - Journal: a cloth spine tape, a printed label and the emblem rubber-stamped in dark ink.
 *
 * The cover reacts to light while the book is closed (see useCoverLight): on a desktop the foil
 * follows the pointer; on touch devices a pre-painted highlight follows device tilt (where the
 * browser offers it without a permission prompt) and a band of light crosses the cover now and
 * then, both as compositor-only transforms. With reduced motion the cover is static.
 *
 * The emblem is an original mark (compass ring, three hills, sun, waves). It is not a coat of
 * arms and the cover does not imitate a government passport.
 */
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
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

/** The idle glint plays at most this often. */
const GLINT_EVERY_MS = 6500;
/** Tilt: changes smaller than this are ignored, and the light moves at most 30 times a second. */
const TILT_STEP = 0.02;
const TILT_MIN_INTERVAL_MS = 33;

/**
 * Light on the cover. Two modes, picked once per mount:
 *
 *   Fine pointer with hover (desktop). The foil follows the pointer: `--tx` / `--ty` are written on
 *   the cover root every frame while the light is moving, and the foil gradients read them in
 *   background-position. That repaints the foil, which a desktop affords.
 *
 *   Everything else (phones, tablets). Compositor only: nothing is ever repainted. The foil
 *   gradients stay still. Device tilt slides the pre-painted specular highlight with a transform,
 *   and the idle glint is one pre-painted band of light (.ipp-cover__glint) that crosses the cover
 *   with a transform and opacity animation. No requestAnimationFrame loop runs at all.
 *
 * In both modes the light only reacts while the book around the cover is closed (the nearest
 * `.ipb` ancestor has data-state="closed"; a cover outside a book counts as closed). It stops the
 * moment the cover starts to swing, so the swing itself is never repainted. A press on the cover is
 * not a light input: it is the tap that opens the book.
 */
function useCoverLight(ref: RefObject<HTMLDivElement | null>, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const specular = el.querySelector<HTMLElement>(".ipp-cover__specular");
    const band = el.querySelector<HTMLElement>(".ipp-cover__glint");
    const book = el.closest<HTMLElement>(".ipb");
    const closed = () => !book || book.getAttribute("data-state") === "closed";

    let x = 0;
    let y = 0;
    let goalX = 0;
    let goalY = 0;
    let frame = 0;
    let lastInput = 0;
    let lastGlint = 0;
    let lastTilt = 0;
    let glintStart = 0;
    let bandRun: Animation | null = null;
    let visible = true;
    let baseBeta: number | null = null;
    let baseGamma: number | null = null;

    /* --- Fine pointer: the foil follows the light (repaints) --- */

    const tick = (now: number) => {
      frame = 0;
      if (!closed()) {
        glintStart = 0;
        return;
      }
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
      el.style.setProperty("--tx", x.toFixed(3));
      el.style.setProperty("--ty", y.toFixed(3));
      if (glintStart || Math.abs(goalX - x) > 0.003 || Math.abs(goalY - y) > 0.003) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame && closed()) frame = requestAnimationFrame(tick);
    };

    const onPointer = (e: PointerEvent) => {
      if (!closed()) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      glintStart = 0;
      lastInput = performance.now();
      goalX = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      goalY = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      wake();
    };
    const onLeave = () => {
      if (!closed()) return;
      goalX = 0;
      goalY = 0;
      wake();
    };

    /* --- Coarse pointer: transforms only --- */

    let specularLive = false;
    const moveSpecular = (nx: number, ny: number) => {
      if (!specular) return;
      if (!specularLive) {
        // Promoted to its own layer on the first real tilt, so phones that never report tilt pay nothing.
        specularLive = true;
        specular.style.willChange = "transform";
        specular.style.transition = "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
      }
      specular.style.transform = `translate3d(${(nx * 16).toFixed(2)}%, ${(ny * 12 - 16).toFixed(2)}%, 0)`;
    };

    const stopBand = () => {
      if (!bandRun) return;
      bandRun.cancel();
      bandRun = null;
    };
    const playBand = () => {
      if (!band || typeof band.animate !== "function") return;
      stopBand();
      try {
        const run = band.animate(
          [
            { transform: "translate3d(-130%, 0, 0) skewX(-14deg)", opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { opacity: 1, offset: 0.8 },
            { transform: "translate3d(215%, 0, 0) skewX(-14deg)", opacity: 0 },
          ],
          { duration: 1700, easing: "cubic-bezier(0.37, 0, 0.63, 1)" },
        );
        bandRun = run;
        run.onfinish = () => {
          if (bandRun === run) bandRun = null;
        };
      } catch {
        bandRun = null;
      }
    };

    /* --- Shared --- */

    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      if (baseBeta === null || baseGamma === null) {
        baseBeta = e.beta;
        baseGamma = e.gamma;
        return;
      }
      // Drift the rest position toward how the phone is held, so the light re-centres.
      baseBeta += (e.beta - baseBeta) * 0.02;
      baseGamma += (e.gamma - baseGamma) * 0.02;
      if (!closed()) return;
      const now = performance.now();
      if (now - lastTilt < TILT_MIN_INTERVAL_MS) return;
      const nx = clamp((e.gamma - baseGamma) / 18, -1, 1);
      const ny = clamp((e.beta - baseBeta) / 18, -1, 1);
      if (Math.abs(nx - goalX) < TILT_STEP && Math.abs(ny - goalY) < TILT_STEP) return;
      lastTilt = now;
      if (Math.abs(nx) > 0.08 || Math.abs(ny) > 0.08) {
        glintStart = 0;
        lastInput = now;
      }
      goalX = nx;
      goalY = ny;
      if (fine) wake();
      else moveSpecular(nx, ny);
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

    if (fine) {
      el.addEventListener("pointermove", onPointer, { passive: true });
      el.addEventListener("pointerleave", onLeave, { passive: true });
    } else {
      el.setAttribute("data-light", "composited");
    }

    // Idle glint: at most once every 6.5 s, only while the tab and the cover are visible, the book
    // is closed and nothing else has moved the light recently.
    const glint = () => {
      const now = performance.now();
      if (!visible || document.hidden || !closed()) return;
      if (glintStart || bandRun) return;
      if (lastGlint && now - lastGlint < GLINT_EVERY_MS) return;
      if (lastInput && now - lastInput < 3500) return;
      lastGlint = now;
      if (fine) {
        glintStart = now;
        wake();
      } else {
        playBand();
      }
    };
    const glintTimer = window.setInterval(glint, GLINT_EVERY_MS);
    const firstGlint = window.setTimeout(glint, 900);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1]?.isIntersecting ?? true;
      });
      io.observe(el);
    }

    // The book has started to open (or anything else but "closed"): stop at once.
    let stateWatch: MutationObserver | null = null;
    if (book && typeof MutationObserver !== "undefined") {
      stateWatch = new MutationObserver(() => {
        if (closed()) return;
        glintStart = 0;
        if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
        stopBand();
      });
      stateWatch.observe(book, { attributes: true, attributeFilter: ["data-state"] });
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearInterval(glintTimer);
      window.clearTimeout(firstGlint);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener(MOTION_GRANTED_EVENT, startTilt);
      el.removeEventListener("pointermove", onPointer);
      el.removeEventListener("pointerleave", onLeave);
      io?.disconnect();
      stateWatch?.disconnect();
      stopBand();
      el.removeAttribute("data-light");
      el.style.removeProperty("--tx");
      el.style.removeProperty("--ty");
      if (specular && specularLive) {
        specular.style.removeProperty("will-change");
        specular.style.removeProperty("transition");
        specular.style.removeProperty("transform");
      }
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
  /**
   * Front cover only. The live globe window with its lettering and partner strip (see
   * src/components/passport/cover-globe). It takes the place of the emblem and of the lines under
   * it; the title stays. Without it the cover is the printed one, exactly as before.
   */
  globe?: ReactNode;
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
  globe,
}: CoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tokens = useDirectionTokens();
  const material = tokens.cover.material;
  const printed = material === "kraft";
  const hasGlobe = globe != null;
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
        data-globe={hasGlobe ? "" : undefined}
        initialWidth={initialWidth}
        // With the globe the cover holds controls (the globe, its dots, the partner marks).
        role={hasGlobe ? "group" : "img"}
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
              <div className="ipp-label__line" data-line="no">
                <span>{cs.cover.labelNo}</span>
                <b>{passportNo}</b>
              </div>
            </div>
            {!hasGlobe && <Emblem variant="ink" className="ipp-cover__emblem" />}
            {!hasGlobe && <div className="ipp-cover__imprint">{strings.app.tagline}</div>}
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
              {!hasGlobe && (
                <>
                  <Emblem variant="foil" className="ipp-cover__emblem" />
                  <div className="ipp-cover__subtitle">
                    <i className="ipp-cover__orn foil-fill" />
                    <Foil>{cs.cover.subtitle}</Foil>
                    <i className="ipp-cover__orn foil-fill" />
                  </div>
                  <div className="ipp-cover__province type-display">
                    <Foil>{province}</Foil>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        {/* Always the child after the body, in every direction: switching direction must not
            remount the globe (it holds the page's one WebGL context). */}
        {hasGlobe ? <div className="ipp-cover__globe">{globe}</div> : null}
        <div className="ipp-cover__specular" aria-hidden="true" />
        <div className="mat-sheen ipp-cover__sheen" aria-hidden="true" />
        <div className="ipp-cover__bevel" aria-hidden="true" />
        {/* Last, so nothing of the cover has to be composited above it. Only shown on touch devices. */}
        <div className="ipp-cover__glint" aria-hidden="true" />
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
