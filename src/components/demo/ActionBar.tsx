"use client";

/**
 * The floating action bar: one thumb-reachable button that walks the scripted story
 * (collect, donate, charity confirms, then the Provincial Stamp), with the three steps above it.
 * Each step is drawn in its status colour, so the bar doubles as a legend for STM-7.
 *
 * The steps are buttons too: tapping one puts the sample data at the start of that step, so a
 * single moment can be watched again without replaying the whole story.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { play } from "@/lib/sound";
import { strings, t } from "@/lib/strings";

const D = strings.demo;

export type StoryStep = "collect" | "donate" | "confirm" | "award" | "done";
export const STORY_STEPS = ["collect", "donate", "confirm"] as const;
/** A step the stepper can jump to. */
export type JumpStep = (typeof STORY_STEPS)[number] | "award";

export interface ActionBarProps {
  step: StoryStep;
  /** A moment is playing: the button shows what is happening and does not respond. */
  busy: boolean;
  /** Label of the main button. */
  cta: string;
  /** One line under the button. */
  note: ReactNode;
  onAction(): void;
  /** A step in the stepper was tapped: set the story to the start of that step. */
  onJump?(step: JumpStep): void;
  /** Overrides the device's reduced-motion setting. */
  reduced?: boolean;
  /** Shown once the story has started. */
  onReplay?(): void;
  /** Warm the moments when a finger or pointer comes near. */
  onIntent?(): void;
  /** Extra controls at the end of the top row (the sound switch). */
  tools?: ReactNode;
}

function Check() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
      <path d="M2.4 6.4l2.5 2.4 4.7-5.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Outline of a 12-point seal, 24 units wide. */
const ROSETTE = (() => {
  const points: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? 10.6 : 8.8;
    const a = (Math.PI * 2 * i) / 24 - Math.PI / 2;
    points.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

/** The reward at the end of the line: a small seal for the Provincial Stamp. */
function Rosette({ earned }: { earned: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="ipd-steps__rosette" data-earned={earned ? "" : undefined}>
      <path d={ROSETTE} fill="currentColor" fillOpacity={earned ? 1 : 0.12} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path
        d="M12 7.2l1.4 3 3.2.4-2.4 2.2.6 3.2-2.8-1.6-2.8 1.6.6-3.2-2.4-2.2 3.2-.4z"
        fill={earned ? "var(--accent-fg)" : "currentColor"}
        fillOpacity={earned ? 1 : 0.55}
      />
    </svg>
  );
}

/** Minimal reset for the stepper buttons; demo.css styles `.ipd-steps__btn` beyond this. */
const STEP_BUTTON: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "inherit",
  minWidth: 0,
  margin: 0,
  padding: 0,
  border: 0,
  background: "none",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

const LABEL_EASE = [0.22, 1, 0.36, 1] as const;

export function ActionBar({
  step,
  busy,
  cta,
  note,
  onAction,
  onJump,
  onReplay,
  onIntent,
  tools,
  reduced: reducedProp,
}: ActionBarProps) {
  const deviceReduced = useReducedMotion() ?? false;
  const reduced = reducedProp ?? deviceReduced;
  const current = step === "award" || step === "done" ? STORY_STEPS.length : STORY_STEPS.indexOf(step);
  const stepNumber = Math.min(current + 1, STORY_STEPS.length);

  /*
   * The label is keyed on what it shows. While a moment plays that is the busy text itself, so the
   * data commit in the middle of the moment (which changes `step`) never replays the swap; at rest
   * it is the step on offer.
   */
  const labelKey = busy ? `busy:${cta}` : `idle:${step}`;
  const idleKey = `idle:${step}`;
  // One pass of light when a new step is offered, never on first paint.
  const firstIdleKey = useRef(idleKey);
  const offerSheen = !busy && !reduced && idleKey !== firstIdleKey.current;
  if (busy) firstIdleKey.current = "";

  /**
   * A button of the bar was pressed: run it, with a felt tick under the thumb. Not while a moment
   * plays (the bar does not respond then, so it does not click either). The tick comes after the
   * handler on purpose: Replay and the stepper silence everything that is still sounding first.
   */
  const pressed = (run: () => void) => {
    run();
    if (!busy) play.tap();
  };

  const stepButton = (key: JumpStep, short: string, children: ReactNode) =>
    onJump ? (
      <button
        type="button"
        className="ipd-steps__btn"
        style={busy ? { ...STEP_BUTTON, cursor: "default" } : STEP_BUTTON}
        aria-label={t(D.jumpTo, { short })}
        disabled={busy}
        onClick={() => pressed(() => onJump(key))}
      >
        {children}
      </button>
    ) : (
      children
    );

  return (
    <div className="ipd-bar" role="region" aria-label={D.storyLabel} data-step={step} data-busy={busy ? "" : undefined}>
      <div className="ipd-bar__card">
        <div className="ipd-bar__top">
          <ol className="ipd-steps" aria-label={t(D.stepOf, { n: stepNumber, total: STORY_STEPS.length })}>
            {STORY_STEPS.map((key, i) => {
              const state = i < current ? "done" : i === current ? "current" : "todo";
              return (
                <li key={key} className="ipd-steps__item" data-step={key} data-state={state} aria-current={state === "current" ? "step" : undefined}>
                  {stepButton(
                    key,
                    D.steps[key].short,
                    <>
                      <span className="ipd-steps__dot">{state === "done" ? <Check /> : i + 1}</span>
                      <span className="ipd-steps__label">{D.steps[key].short}</span>
                    </>,
                  )}
                </li>
              );
            })}
            <li className="ipd-steps__item ipd-steps__item--reward" data-state={step === "done" ? "done" : step === "award" ? "current" : "todo"}>
              {stepButton(
                "award",
                strings.country.regionalStampLabel,
                <>
                  <Rosette earned={step === "done"} />
                  <span className="ipd-sr">{strings.country.regionalStampLabel}</span>
                </>,
              )}
            </li>
          </ol>
          <div className="ipd-bar__tools">
            {tools}
            {onReplay && (
              <button type="button" className="ipd-tool" onClick={() => pressed(onReplay)} aria-label={D.replay} title={D.replay} aria-disabled={busy || undefined}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.2 9a5.8 5.8 0 1 0 1.9-4.3" />
                  <path d="M2.8 2.6v3.3h3.3" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className="ipd-cta"
          onClick={() => pressed(onAction)}
          onPointerEnter={onIntent}
          onFocus={onIntent}
          aria-disabled={busy || undefined}
          data-step={step}
        >
          <span key={`gloss:${idleKey}`} className="ipd-cta__sheen" aria-hidden="true" />
          {offerSheen && (
            <motion.span
              key={`offer:${idleKey}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: "42%",
                pointerEvents: "none",
                background:
                  "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.26) 50%, rgba(255,255,255,0) 100%)",
              }}
              initial={{ x: "-110%" }}
              animate={{ x: "250%" }}
              transition={{ delay: 0.12, duration: 0.7, ease: LABEL_EASE }}
            />
          )}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={labelKey}
              className="ipd-cta__label"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: LABEL_EASE }}
            >
              {cta}
              {busy ? (
                <span className="ipd-cta__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <svg className="ipd-cta__arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {step === "done" ? (
                    <>
                      <path d="M3.2 9a5.8 5.8 0 1 0 1.9-4.3" />
                      <path d="M2.8 2.6v3.3h3.3" />
                    </>
                  ) : (
                    <path d="M4 9h10M10 5l4 4-4 4" />
                  )}
                </svg>
              )}
            </motion.span>
          </AnimatePresence>
        </button>

        <p className="ipd-bar__note" aria-live="polite">
          {note}
        </p>
      </div>
    </div>
  );
}

export default ActionBar;
