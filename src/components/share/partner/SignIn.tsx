"use client";

/**
 * Arriving at the partner profile. No password anywhere: the partner asks for a one-time code,
 * and the same email carries a sign-in link as a backup (Technical_Questions.md, section 6,
 * option B). In the demo one tap plays the whole thing: the email lands, the code types itself.
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Avatar, IconArrow, IconCheck, IconLink, SampleTag, SkButton, usePrefersReducedMotion } from "@/components/share/kit";
import { SAMPLE_PARTNERS, shareCopy } from "@/lib/share";
import type { SharePartner } from "@/lib/share/types";
import { strings } from "@/lib/strings";
import { SAMPLE_CODE, SAMPLE_EMAILS, greetingName } from "./data";
import { EASE, IconMail, IconQr, IconVideo } from "./parts";

/** The row of sample partners, one per partner type. */
export function PartnerSwitch({ partner, onPartner, label = "Sample partner" }: { partner: SharePartner; onPartner: (id: string) => void; label?: string }) {
  const row = useRef<HTMLUListElement>(null);

  // On a phone the row scrolls sideways: keep the chosen partner in view.
  useEffect(() => {
    const list = row.current;
    const chosen = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !chosen || list.scrollWidth <= list.clientWidth) return;
    const a = list.getBoundingClientRect();
    const b = chosen.getBoundingClientRect();
    list.scrollTo({ left: list.scrollLeft + (b.left - a.left) - (a.width - b.width) / 2, behavior: "smooth" });
  }, [partner.id]);

  return (
    <div className="pf-switch">
      <span className="pf-switch-label">{label}</span>
      <ul className="pf-switch-row" aria-label="Sample partner type" ref={row}>
        {SAMPLE_PARTNERS.map((p) => (
          <li key={p.id}>
            <button type="button" className="pf-switch-btn" aria-pressed={p.id === partner.id} onClick={() => onPartner(p.id)}>
              <Avatar avatar={p.avatar} size={22} />
              {shareCopy.partnerTypes[p.type]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Phase = "email" | "code" | "done";

export function SignIn({ partner, onPartner, onSignedIn }: { partner: SharePartner; onPartner: (id: string) => void; onSignedIn: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("email");
  const [mail, setMail] = useState(false);
  const [typed, setTyped] = useState(0);
  const email = SAMPLE_EMAILS[partner.id] ?? "partner@island.sample";
  const done = useRef(onSignedIn);
  done.current = onSignedIn;

  // A different partner starts again from the email step.
  useEffect(() => {
    setPhase("email");
    setMail(false);
    setTyped(0);
  }, [partner.id]);

  // The demo plays the round trip: the email arrives, the code is typed, the profile opens.
  useEffect(() => {
    if (phase !== "code") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    at(450, () => setMail(true));
    for (let i = 1; i <= SAMPLE_CODE.length; i++) at(1150 + i * 130, () => setTyped(i));
    at(1150 + SAMPLE_CODE.length * 130 + 380, () => setPhase("done"));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => done.current(), 900);
    return () => clearTimeout(timer);
  }, [phase]);

  const swap = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.34, ease: EASE } };

  return (
    <div className="pf-gate">
        <AnimatePresence>
        {mail ? (
          <motion.div
            className="pf-mail"
            role="status"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 26 }}
          >
            <span className="pf-mail-ico">
              <IconMail size={18} />
            </span>
            <span className="pf-mail-text">
              <b>
                {strings.app.name} <i>now</i>
              </b>
              <span>
                Your code is{" "}
                <strong>
                  {SAMPLE_CODE.slice(0, 3)} {SAMPLE_CODE.slice(3)}
                </strong>
                . Or tap the sign-in link.
              </span>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pf-gate-head">
        <p className="sk-eyebrow pf-rise" style={{ "--i": 0 } as React.CSSProperties}>
          Flow 1 · Partners
        </p>
        <h1 className="sk-title pf-rise" style={{ "--i": 1 } as React.CSSProperties}>
          Welcome back,{" "}
          <AnimatePresence mode="wait" initial={false}>
            <motion.em key={partner.id} className="pf-gate-name" {...swap}>
              {greetingName(partner)}.
            </motion.em>
          </AnimatePresence>
        </h1>
        <p className="sk-lead pf-rise" style={{ "--i": 2 } as React.CSSProperties}>
          Your profile, six island videos and your own link are waiting. Any kind of partner can offer a stamp: pick one to see their side.
        </p>
      </div>

      <div className="pf-rise" style={{ "--i": 3 } as React.CSSProperties}>
        <PartnerSwitch partner={partner} onPartner={onPartner} />
      </div>

      <section className="sk-card pf-gate-card pf-rise" style={{ "--i": 4 } as React.CSSProperties} aria-label="Sign in">
        <div className="pf-gate-who">
          <Avatar avatar={partner.avatar} size={52} />
          <div className="pf-gate-who-text">
            <b>{partner.name}</b>
            <span>
              {shareCopy.partnerTypes[partner.type]} · {partner.handle}
            </span>
          </div>
          <SampleTag />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {phase === "email" ? (
            <motion.div key="email" className="pf-gate-body" {...swap}>
              <label className="pf-field">
                <span className="sk-field-label">Email</span>
                <span className="pf-input" data-readonly="true">
                  <IconMail size={19} />
                  <input value={email} readOnly aria-readonly="true" inputMode="email" />
                </span>
              </label>
              <SkButton block onClick={() => setPhase("code")}>
                Email me a one-time code <IconArrow size={18} />
              </SkButton>
              <p className="pf-gate-note">
                <span className="pf-nopass">No password</span>
                We email a 6-digit code, with a sign-in link in the same email as a backup.
              </p>
            </motion.div>
          ) : (
            <motion.div key="code" className="pf-gate-body" {...swap}>
              <div className="pf-code-head">
                <b>
                  {phase === "done" ? "You are in" : "Enter the 6-digit code"}
                  <AnimatePresence>
                    {phase === "done" ? (
                      <motion.span
                        className="pf-code-ok"
                        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={reduced ? { duration: 0.1 } : { type: "spring", stiffness: 420, damping: 18 }}
                      >
                        <IconCheck size={15} strokeWidth={3} />
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </b>
                <span>
                  Sent to <em>{email}</em>
                </span>
              </div>
              <div className="pf-code" data-done={phase === "done"} role="img" aria-label={phase === "done" ? "Code accepted" : "The demo is typing the sample code"}>
                {SAMPLE_CODE.split("").map((digit, i) => (
                  <span className="pf-code-box" key={i} data-filled={i < typed} data-next={i === typed && phase === "code"}>
                    <AnimatePresence>
                      {i < typed ? (
                        <motion.span
                          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.6 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={reduced ? { duration: 0.1 } : { type: "spring", stiffness: 520, damping: 24 }}
                        >
                          {digit}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </span>
                ))}
              </div>
              <p className="pf-gate-note">
                <IconLink size={15} />
                <span>{phase === "done" ? "Opening your profile." : "The demo types the sample code for you. In real use, the link in the same email works too."}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <ul className="pf-gate-inside pf-rise" style={{ "--i": 5 } as React.CSSProperties} aria-label="What is inside">
        <li>
          <IconVideo size={18} />
          Six videos
        </li>
        <li>
          <IconLink size={18} />
          Your link
        </li>
        <li>
          <IconQr size={18} />
          Your QR code
        </li>
      </ul>
    </div>
  );
}
