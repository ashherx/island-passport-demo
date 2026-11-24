"use client";

/**
 * The collect flow behind the recipient page's primary button.
 *
 *   sign in (email -> 6-digit code, or the sign-in link from the same email -> confirm)
 *   -> welcome (the stamp is saved as a discovery stamp)
 *   -> give (hand-off to the charity's own page; Island Passport never takes the money)
 *   -> pending confirmation (shown honestly)
 *   -> verified (once the charity's confirmation arrives)
 *
 * Everything is simulated: no email is sent, no page opens, no money moves. The step is kept on
 * the device, so leaving for the mail app and coming back reopens where the person left off
 * (Technical_Questions.md, sections 1 and 6: "the code screen must be resumable").
 */
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Avatar, IconArrow, IconCheck, IconClose, SampleTag, SkButton, skRootClass, usePrefersReducedMotion } from "@/components/share/kit";
import { Stamp } from "@/components/stamp";
import { shareCopy } from "@/lib/share";
import type { StampStatus } from "@/lib/types";
import { IconClock, IconExternal, IconGlobe, IconLock, IconMail, IconSeal } from "./icons";
import { PLATFORM_NAME, browserName, type InAppInfo } from "./inapp";
import type { LandingModel } from "./model";
import { possessive, withCharity } from "./text";

export type CollectStep = "email" | "code" | "confirm" | "welcome" | "give" | "pending" | "verified";

interface CollectState {
  step: CollectStep;
  email: string;
}

interface CollectContextValue {
  model: LandingModel;
  state: CollectState;
  /** False until the saved step has been read on the client. */
  ready: boolean;
  isOpen: boolean;
  open: () => void;
  reset: () => void;
}

const CollectContext = createContext<CollectContextValue | null>(null);

export function useCollect(): CollectContextValue {
  const value = useContext(CollectContext);
  if (!value) throw new Error("useCollect needs <CollectProvider>");
  return value;
}

/** The code the fake email carries. */
export const DEMO_CODE = "482916";
const SAMPLE_EMAIL = "you@example.com";
const STORE_KEY = "ip.share.collect.v1";
const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS: CollectStep[] = ["email", "code", "confirm", "welcome", "give", "pending", "verified"];

function readStore(): Record<string, CollectState> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, CollectState>) : {};
  } catch {
    return {};
  }
}

function writeStore(code: string, state: CollectState | null) {
  try {
    const all = readStore();
    if (state) all[code] = state;
    else delete all[code];
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    /* storage is blocked in some in-app browsers: the flow still works for this visit */
  }
}

/** Which stamp status the recipient holds at each step. */
export function statusAt(step: CollectStep): StampStatus | null {
  if (step === "verified") return "verified";
  if (step === "pending") return "pending";
  if (step === "welcome" || step === "give") return "discovery";
  return null;
}

export function CollectProvider({ model, inApp, children }: { model: LandingModel; inApp: InAppInfo | null; children: ReactNode }) {
  const [state, setState] = useState<CollectState>({ step: "email", email: "" });
  const [ready, setReady] = useState(false);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    const saved = readStore()[model.code];
    if (saved && STEPS.includes(saved.step)) setState({ step: saved.step, email: typeof saved.email === "string" ? saved.email : "" });
    setReady(true);
  }, [model.code]);

  const update = useCallback(
    (next: CollectState) => {
      setState(next);
      writeStore(model.code, next);
    },
    [model.code],
  );

  const value = useMemo<CollectContextValue>(
    () => ({
      model,
      state,
      ready,
      isOpen,
      open: () => setOpen(true),
      reset: () => {
        writeStore(model.code, null);
        setState({ step: "email", email: "" });
      },
    }),
    [model, state, ready, isOpen],
  );

  return (
    <CollectContext.Provider value={value}>
      {children}
      <CollectSheet open={isOpen} onClose={() => setOpen(false)} model={model} inApp={inApp} state={state} onState={update} />
    </CollectContext.Provider>
  );
}

/** Label of the primary button, which follows the saved step. */
function ctaLabel(model: LandingModel, step: CollectStep, short = false): string {
  const noun = model.offer.isSeal ? "seal" : "stamp";
  if (step === "verified") return `View your ${noun}`;
  if (step === "pending") return `Check your ${noun}`;
  if (step === "welcome" || step === "give") return short ? "Verify it" : `Give to ${model.offer.charity}`;
  if (step === "code" || step === "confirm") return "Enter your code";
  return short ? (model.offer.isSeal ? "Earn the seal" : "Collect it") : model.cta;
}

export function CollectButton({
  block,
  size,
  className,
  variant = "primary",
  short,
}: {
  block?: boolean;
  size?: "m" | "s";
  className?: string;
  variant?: "primary" | "ink";
  /** A two-word label for tight places (the sticky bar). */
  short?: boolean;
}) {
  const { model, state, open } = useCollect();
  return (
    <SkButton variant={variant} size={size} block={block} className={className} onClick={open} aria-haspopup="dialog">
      <span className="lp-cta-label">{ctaLabel(model, state.step, short)}</span>
      <IconArrow size={18} />
    </SkButton>
  );
}

/** One line under the hero button: what happens next, or where the visitor left off. */
export function CollectStatusLine() {
  const { model, state } = useCollect();
  const { charity } = model.offer;
  const text =
    state.step === "verified"
      ? `${charity} confirmed your donation. Your stamp is verified.`
      : state.step === "pending"
        ? withCharity(shareCopy.pending, charity)
        : state.step === "welcome" || state.step === "give"
          ? `Your stamp is saved. Give on ${model.offer.charitys} own page to verify it.`
          : state.step === "code" || state.step === "confirm"
            ? `We emailed a code to ${state.email || "you"}. Pick up where you left off.`
            : null;
  if (!text) {
    return (
      <ul className="lp-assure" aria-label="Good to know">
        <li>
          <IconMail size={16} /> Email code, no password
        </li>
        <li>
          <IconExternal size={16} /> You give on {model.offer.charitys} own page
        </li>
      </ul>
    );
  }
  return (
    <p className="lp-resume" data-step={state.step}>
      {state.step === "verified" ? <IconSeal size={17} /> : state.step === "pending" ? <IconClock size={17} /> : <IconCheck size={17} />}
      <span>{text}</span>
    </p>
  );
}

/** The offer card's stamp follows the visitor's own progress. */
export function ProgressStamp({ size = 116 }: { size?: number }) {
  const { model, state } = useCollect();
  const status = statusAt(state.step);
  return (
    <span className="lp-pstamp" data-status={status ?? "none"}>
      <LandingStamp model={model} status={status ?? (model.offer.isSeal ? "verified" : "discovery")} size={size} />
      {status ? (
        <span className="lp-pstamp-tag" data-status={status}>
          {status === "verified" ? "Yours · verified" : status === "pending" ? "Yours · pending" : "Yours · saved"}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The offer drawn as a stamp at a status. A seal has one look whatever the status, so an unissued
 * seal is drawn faded instead.
 */
export function LandingStamp({ model, status, size, className = "" }: { model: LandingModel; status: StampStatus; size: number; className?: string }) {
  const faded = model.offer.isSeal && status !== "verified";
  return (
    <span className={`lp-stamp ${className}`} data-faded={faded} style={{ width: size, height: size }}>
      <Stamp stamp={model.stamp} status={status} size={size} decorative />
    </span>
  );
}

/** Bar pinned to the bottom of a phone once the hero button has scrolled away. */
export function StickyCta() {
  const { model, isOpen } = useCollect();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const anchor = document.querySelector("[data-lp-cta-anchor]");
    if (!anchor || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(anchor);
    return () => io.disconnect();
  }, []);
  return (
    <div className="lp-sticky" data-show={show && !isOpen} inert={!(show && !isOpen)}>
      <div className="lp-sticky-in">
        <span className="lp-sticky-text">
          <b>{model.offer.title}</b>
          <span>
            {model.islandName} · helps {model.offer.charity}
          </span>
        </span>
        <CollectButton size="s" short />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The sheet                                                           */
/* ------------------------------------------------------------------ */

const PHASES = [
  { id: "signin", label: "Sign in", steps: ["email", "code", "confirm"] },
  { id: "give", label: "Give", steps: ["welcome", "give"] },
  { id: "stamp", label: "Stamp", steps: ["pending", "verified"] },
] as const;

const TITLES: Record<CollectStep, string> = {
  email: "Start your passport",
  code: "Enter your code",
  confirm: "Confirm it's you",
  welcome: "Welcome aboard",
  give: "One step to verify it",
  pending: "Pending confirmation",
  verified: "Verified Supporter",
};

interface SheetProps {
  open: boolean;
  onClose: () => void;
  model: LandingModel;
  inApp: InAppInfo | null;
  state: CollectState;
  onState: (next: CollectState) => void;
}

function CollectSheet({ open, onClose, model, inApp, state, onState }: SheetProps) {
  const reduced = usePrefersReducedMotion();
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState(true);
  useEffect(() => setMounted(true), []);

  // While open: lock the page behind, close on Esc, keep Tab inside, hand focus back afterwards.
  useEffect(() => {
    if (!open) return;
    setPhone(window.innerWidth < 640);
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const focusTimer = setTimeout(() => {
      if (!sheet.current?.contains(document.activeElement)) sheet.current?.focus({ preventScroll: true });
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheet.current) return;
      const items = sheet.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === sheet.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.overflow = overflow;
      before?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const go = useCallback((step: CollectStep, email = state.email) => onState({ step, email }), [onState, state.email]);

  const motionProps = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : phone
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.9 } }
      : { initial: { opacity: 0, y: 24, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 }, transition: { duration: 0.32, ease: EASE } };

  const stepMotion = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : { initial: { opacity: 0, x: 22 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 }, transition: { duration: 0.28, ease: EASE } };

  if (!mounted) return null;
  const phase = PHASES.findIndex((p) => (p.steps as readonly string[]).includes(state.step));

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className={`${skRootClass} sk-sheet-root lp-sheet-root`} data-accent={model.accent} key="collect-sheet">
          <motion.button type="button" className="sk-sheet-scrim" aria-label="Close" tabIndex={-1} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <motion.div ref={sheet} className="sk-sheet lp-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} {...motionProps}>
            <div className="sk-sheet-grip" aria-hidden="true" />
            <div className="lp-sheet-top">
              <ol className="lp-phases" aria-label="Progress">
                {PHASES.map((p, i) => (
                  <li key={p.id} data-state={i < phase || state.step === "verified" ? "done" : i === phase ? "current" : "todo"} aria-current={i === phase ? "step" : undefined}>
                    <span className="lp-phase-bar">
                      <span />
                    </span>
                    <span className="lp-phase-label">{p.label}</span>
                  </li>
                ))}
              </ol>
              <button type="button" className="sk-sheet-close" aria-label="Close" onClick={onClose}>
                <IconClose size={20} />
              </button>
            </div>
            <div className="sk-sheet-body lp-sheet-body">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={state.step} className="lp-step" data-step={state.step} {...stepMotion}>
                  <h2 className="lp-step-title" id={titleId}>
                    {TITLES[state.step]}
                  </h2>
                  {state.step === "email" ? <EmailStep model={model} inApp={inApp} email={state.email} onSend={(email) => go("code", email)} /> : null}
                  {state.step === "code" ? (
                    <CodeStep model={model} inApp={inApp} email={state.email} onVerified={() => go("welcome")} onLink={() => go("confirm")} onChangeEmail={() => go("email")} />
                  ) : null}
                  {state.step === "confirm" ? <ConfirmStep model={model} inApp={inApp} email={state.email} onConfirm={() => go("welcome")} onBack={() => go("code")} /> : null}
                  {state.step === "welcome" ? <WelcomeStep model={model} onGive={() => go("give")} onLater={onClose} /> : null}
                  {state.step === "give" ? <GiveStep model={model} email={state.email} onGiven={() => go("pending")} onBack={() => go("welcome")} /> : null}
                  {state.step === "pending" ? <PendingStep model={model} onConfirmed={() => go("verified")} onClose={onClose} /> : null}
                  {state.step === "verified" ? <VerifiedStep model={model} /> : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="lp-demo-note">
      <span className="lp-demo-tag">Demo</span>
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------ sign in */

function EmailStep({ model, inApp, email, onSend }: { model: LandingModel; inApp: InAppInfo | null; email: string; onSend: (email: string) => void }) {
  const [value, setValue] = useState(email);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const submit = (candidate: string) => {
    const clean = candidate.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
      setError("That does not look like an email address.");
      input.current?.focus();
      return;
    }
    setError("");
    setBusy(true);
    timer.current = setTimeout(() => onSend(clean), 650);
  };

  return (
    <form
      className="lp-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <p className="lp-step-lead">
        Your {model.offer.isSeal ? "seal" : "stamp"} needs a passport to live in. Tell us where to send a 6-digit code and it is yours.
      </p>
      <label className="lp-field">
        <span className="sk-field-label">Email</span>
        <span className="lp-input" data-error={Boolean(error)}>
          <IconMail size={20} />
          <input
            ref={input}
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={value}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "lp-email-error" : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
          />
        </span>
      </label>
      {error ? (
        <p className="lp-error" id="lp-email-error" role="alert">
          {error}
        </p>
      ) : null}
      <SkButton type="submit" block disabled={busy}>
        {busy ? <Spinner /> : null}
        {busy ? "Sending your code" : "Email me a code"}
      </SkButton>
      <p className="lp-fine">
        <IconLock size={16} />
        <span>{shareCopy.noPasswords}</span>
      </p>
      {inApp ? (
        <p className="lp-fine">
          <IconCheck size={16} />
          <span>Typing the code keeps you in this {PLATFORM_NAME[inApp.platform]} tab, so nothing is lost.</span>
        </p>
      ) : null}
      <DemoNote>
        Nothing is sent. Any address works, or{" "}
        <button
          type="button"
          className="lp-inline"
          onClick={() => {
            setValue(SAMPLE_EMAIL);
            submit(SAMPLE_EMAIL);
          }}
        >
          use {SAMPLE_EMAIL}
        </button>
        .
      </DemoNote>
    </form>
  );
}

function Spinner() {
  return <span className="lp-spin" aria-hidden="true" />;
}

function CodeStep({
  model,
  inApp,
  email,
  onVerified,
  onLink,
  onChangeEmail,
}: {
  model: LandingModel;
  inApp: InAppInfo | null;
  email: string;
  onVerified: () => void;
  onLink: () => void;
  onChangeEmail: () => void;
}) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "wrong" | "ok">("idle");
  const [mail, setMail] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  // The "email" arrives a moment after the step opens.
  useEffect(() => {
    const t = setTimeout(() => setMail(true), 1100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const check = useCallback(
    (value: string) => {
      setState("checking");
      later(() => {
        if (value === DEMO_CODE) {
          setState("ok");
          later(onVerified, 520);
        } else {
          setState("wrong");
          later(() => {
            setCode("");
            input.current?.focus();
          }, 900);
        }
      }, 620);
    },
    [later, onVerified],
  );

  const onChange = (raw: string) => {
    if (state === "checking" || state === "ok") return;
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (state === "wrong") setState("idle");
    if (digits.length === 6) check(digits);
  };

  // Types the code from the fake email, one digit at a time.
  const fill = () => {
    if (state === "checking" || state === "ok") return;
    setState("idle");
    setCode("");
    DEMO_CODE.split("").forEach((_, i) => later(() => setCode(DEMO_CODE.slice(0, i + 1)), 90 * (i + 1)));
    later(() => check(DEMO_CODE), 90 * 6 + 120);
  };

  const cells = Array.from({ length: 6 }, (_, i) => code[i] ?? "");
  const active = Math.min(code.length, 5);

  return (
    <div className="lp-form">
      <p className="lp-step-lead">
        We sent 6 digits to <b>{email || SAMPLE_EMAIL}</b>.{" "}
        <button type="button" className="lp-inline" onClick={onChangeEmail}>
          Change
        </button>
      </p>

      <AnimatePresence initial={false}>
        {mail ? (
          <motion.div
            className="lp-mail"
            initial={{ opacity: 0, y: -14, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <div className="lp-mail-in">
              <span className="lp-mail-ico">
                <IconMail size={18} />
              </span>
              <div className="lp-mail-text">
                <p className="lp-mail-from">
                  <b>Island Passport</b>
                  <span>now</span>
                  <span className="lp-demo-tag">Sample inbox</span>
                </p>
                <p className="lp-mail-subject">
                  Your code is{" "}
                  <b>
                    {DEMO_CODE.slice(0, 3)} {DEMO_CODE.slice(3)}
                  </b>
                </p>
                <p className="lp-mail-body">Valid for 10 minutes. The email also carries a sign-in link, as a backup.</p>
                <div className="lp-mail-acts">
                  <button type="button" className="sk-chip" data-on="true" onClick={fill}>
                    Use this code
                  </button>
                  <button type="button" className="sk-chip" onClick={onLink}>
                    Tap the link instead
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <label className="lp-otp" data-state={state} data-focused={focused}>
        <span className="sk-sr">6-digit code</span>
        <input
          ref={input}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          autoFocus
          aria-invalid={state === "wrong"}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <span className="lp-otp-cells" aria-hidden="true">
          {cells.map((digit, i) => (
            <span key={i} className="lp-otp-cell" data-filled={Boolean(digit)} data-active={focused && state === "idle" && i === active && code.length < 6}>
              {digit ? (
                <motion.span key={digit + i} initial={{ opacity: 0, y: 8, scale: 0.7 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18, ease: EASE }}>
                  {digit}
                </motion.span>
              ) : null}
            </span>
          ))}
        </span>
      </label>

      <p className="lp-otp-status" role="status" data-state={state}>
        {state === "checking" ? (
          <>
            <Spinner /> Checking
          </>
        ) : state === "ok" ? (
          <>
            <IconCheck size={17} strokeWidth={2.4} /> That&apos;s it
          </>
        ) : state === "wrong" ? (
          "That code does not match. Try the one in the sample email."
        ) : resendIn > 0 ? (
          `No email yet? You can ask for a new code in 0:${String(resendIn).padStart(2, "0")}`
        ) : (
          <button type="button" className="lp-inline" onClick={() => setResendIn(30)}>
            Send a new code
          </button>
        )}
      </p>

      <p className="lp-fine">
        <IconCheck size={16} />
        <span>
          {inApp
            ? `Stay in this tab while you fetch the code from your mail app. If ${PLATFORM_NAME[inApp.platform]} reloads the page, it reopens right here.`
            : "Leave to fetch the code and come back: this screen reopens where you left off."}
        </span>
      </p>
      <p className="sk-sr">Credit for this visit stays with {model.sharer?.name ?? "the island"}.</p>
    </div>
  );
}

function ConfirmStep({ model, inApp, email, onConfirm, onBack }: { model: LandingModel; inApp: InAppInfo | null; email: string; onConfirm: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <div className="lp-form">
      <p className="lp-step-lead">
        You tapped the sign-in link in the email. One more tap signs you in as <b>{email || SAMPLE_EMAIL}</b>.
      </p>
      <div className="lp-callout">
        <IconExternal size={18} />
        <p>
          {inApp
            ? `From an email this link opens in ${browserName(inApp.os)}, not in the ${PLATFORM_NAME[inApp.platform]} tab you started in. `
            : "From an email this link opens in your phone's default browser, which may not be the tab you started in. "}
          Your stamp{model.sharer ? ` and ${possessive(model.sharer.shortName)} credit` : ""} are kept with your account, so they follow you there.
        </p>
      </div>
      <SkButton
        block
        disabled={busy}
        onClick={() => {
          setBusy(true);
          timer.current = setTimeout(onConfirm, 600);
        }}
      >
        {busy ? <Spinner /> : null}
        {busy ? "Signing you in" : "Confirm sign-in"}
      </SkButton>
      <p className="lp-fine">
        <IconCheck size={16} />
        <span>The button is there on purpose: mail filters that open links automatically cannot use yours up.</span>
      </p>
      <button type="button" className="lp-inline lp-back" onClick={onBack}>
        Back to the code
      </button>
    </div>
  );
}

/* ---------------------------------------------------- welcome and give */

/** The stamp landing on a slip of passport paper. */
function PressedStamp({ model, status, size = 148, press }: { model: LandingModel; status: StampStatus; size?: number; press: boolean }) {
  const reduced = usePrefersReducedMotion();
  const ink = useMotionValue(press ? 0 : 1);
  useEffect(() => {
    if (!press) return;
    if (reduced) {
      ink.set(1);
      return;
    }
    const controls = animate(ink, 1, { duration: 0.55, delay: 0.28, ease: "easeOut" });
    return () => controls.stop();
  }, [ink, press, reduced]);
  const faded = model.offer.isSeal && status !== "verified";
  return (
    <div className="lp-paper" data-status={status}>
      <motion.span
        className="lp-stamp"
        data-faded={faded}
        style={{ width: size, height: size }}
        initial={press && !reduced ? { scale: 1.5, rotate: -9, opacity: 0 } : false}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 19, mass: 0.9, delay: 0.18 }}
      >
        <Stamp stamp={model.stamp} status={status} size={size} inkProgress={press ? ink : 1} decorative />
      </motion.span>
      {press && !reduced ? <motion.span className="lp-paper-ring" initial={{ scale: 0.5, opacity: 0.55 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }} /> : null}
    </div>
  );
}

function WelcomeStep({ model, onGive, onLater }: { model: LandingModel; onGive: () => void; onLater: () => void }) {
  const { offer, sharer } = model;
  return (
    <div className="lp-form">
      <PressedStamp model={model} status="discovery" press />
      <p className="lp-step-lead" data-center="true">
        Your passport is open, and the <b>{offer.title}</b> {offer.isSeal ? "has a place waiting in it" : "stamp is saved in it"}.
      </p>
      {sharer ? (
        <p className="lp-credit-pill">
          <Avatar avatar={sharer.avatar} size={26} />
          <span>
            Credited to <b>{sharer.name}</b>
          </span>
        </p>
      ) : null}
      <SkButton block onClick={onGive}>
        Make it a Verified Supporter {offer.isSeal ? "seal" : "stamp"}
        <IconArrow size={18} />
      </SkButton>
      <SkButton block variant="ghost" onClick={onLater}>
        Not now
      </SkButton>
    </div>
  );
}

function GiveStep({ model, email, onGiven, onBack }: { model: LandingModel; email: string; onGiven: () => void; onBack: () => void }) {
  const { offer } = model;
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <div className="lp-form">
      <p className="lp-step-lead">{withCharity(shareCopy.noDonations, offer.charity)}</p>
      <div className="lp-handoff" aria-hidden="true">
        <span className="lp-handoff-node">
          <IconGlobe size={18} />
          Island Passport
        </span>
        <span className="lp-handoff-line">
          <i />
        </span>
        <span className="lp-handoff-node" data-to="true">
          <IconExternal size={18} />
          {offer.charity}
        </span>
      </div>
      <dl className="lp-facts">
        <div>
          <dt>{offer.isSeal ? "Earns the seal from" : "Earns the stamp from"}</dt>
          <dd>
            <b>{offer.threshold}</b>
            <small>{shareCopy.exampleThreshold}</small>
          </dd>
        </div>
        <div>
          <dt>What it pays for</dt>
          <dd>{offer.purpose}</dd>
        </div>
        <div>
          <dt>Give with this email</dt>
          <dd>
            <b className="lp-mono">{email || SAMPLE_EMAIL}</b>
            <small>So {offer.charitys} confirmation can be matched to your passport.</small>
          </dd>
        </div>
      </dl>
      <SkButton
        block
        disabled={busy}
        onClick={() => {
          setBusy(true);
          timer.current = setTimeout(onGiven, 1100);
        }}
      >
        {busy ? <Spinner /> : null}
        {busy ? `Opening ${offer.charity}` : `Continue to ${offer.charity}`}
        {busy ? null : <IconExternal size={18} />}
      </SkButton>
      <DemoNote>No page opens and no money moves. The next screen is what you would come back to.</DemoNote>
      <button type="button" className="lp-inline lp-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

/* ------------------------------------------------ pending and verified */

function PendingStep({ model, onConfirmed, onClose }: { model: LandingModel; onConfirmed: () => void; onClose: () => void }) {
  const { offer } = model;
  return (
    <div className="lp-form">
      <PressedStamp model={model} status="pending" size={132} press={false} />
      <p className="lp-step-lead" data-center="true">
        {withCharity(shareCopy.pending, offer.charity).replace("Pending confirmation. ", "")}
      </p>
      <ol className="lp-track">
        <li data-state="done">
          <span className="lp-track-dot">
            <IconCheck size={14} strokeWidth={2.6} />
          </span>
          <span>
            <b>You gave on {offer.charitys} page</b>
            <small>They hold the donation. Island Passport never touches it.</small>
          </span>
        </li>
        <li data-state="current">
          <span className="lp-track-dot">
            <IconClock size={14} strokeWidth={2.2} />
          </span>
          <span>
            <b>Waiting for {offer.charity} to confirm</b>
            <small>Their confirmation reaches us by email, at an address only they use. Until then nothing here says &ldquo;donated&rdquo;.</small>
          </span>
        </li>
        <li data-state="todo">
          <span className="lp-track-dot">
            <IconSeal size={14} />
          </span>
          <span>
            <b>Verified Supporter {offer.isSeal ? "seal" : "stamp"} issued</b>
            <small>We email you the moment it happens.</small>
          </span>
        </li>
      </ol>
      <SkButton block variant="secondary" onClick={onConfirmed}>
        <span className="lp-demo-tag">Demo</span>
        Simulate the charity&apos;s confirmation
      </SkButton>
      <SkButton block variant="ghost" onClick={onClose}>
        Close and check back later
      </SkButton>
    </div>
  );
}

function VerifiedStep({ model }: { model: LandingModel }) {
  const { offer, sharer } = model;
  return (
    <div className="lp-form">
      <div className="lp-burst">
        <PressedStamp model={model} status="verified" press />
      </div>
      <p className="lp-step-lead" data-center="true">
        <b>{offer.charity}</b> confirmed your donation. Your {model.islandName} {offer.isSeal ? "seal" : "stamp"} is official
        {sharer ? `, and ${sharer.shortName} gets the credit for bringing you` : ""}.
      </p>
      <p className="lp-credit-pill" data-tone="gold">
        <IconSeal size={18} />
        <span>
          <b>{offer.charity}</b> <SampleTag />
        </span>
      </p>
      <SkButton block href="/passport">
        Open the passport demo
        <IconArrow size={18} />
      </SkButton>
      <SkButton block variant="secondary" href="/share/traveler">
        Share yours and bring a friend
      </SkButton>
      <Link className="lp-inline lp-back" href={`/?island=${model.islandId}`}>
        Explore the globe
      </Link>
    </div>
  );
}
