"use client";

/**
 * The partner share flow (/share/partner), start to finish:
 *
 *   sign in (one-time code, no password)
 *     -> profile        who they are, what their links have done, seals, six posts a year
 *     -> choose         island, lead with the stamp or the charity, format
 *     -> personalise    the content studio: footage, name, short line, caption, three formats
 *     -> share          share sheet, image, caption, link, QR code; or the website widget
 *     -> six a year     the posting calendar, with the post just logged
 *
 * All state lives here; each step is a component in this folder. Notes: docs/agents/p3-partner.md
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, IconArrow, IconBack, IconCheck, POST_FORMATS, ShareShell, StepHeader, usePrefersReducedMotion, type PostFormat } from "@/components/share/kit";
import { DEFAULT_PARTNER, SAMPLE_PARTNERS, getPartner, shareCopy } from "@/lib/share";
import type { SharePartner } from "@/lib/share/types";
import { Choose } from "./Choose";
import { PARTNER_STEPS, postingYear, type PartnerStep } from "./data";
import { EASE, IconCalendar, IconSpark } from "./parts";
import { buildPost, newDraft, retarget, type Draft } from "./post";
import { Profile } from "./Profile";
import { ShareStep, type ShareTab } from "./ShareStep";
import { SignIn } from "./SignIn";
import { Studio } from "./Studio";
import { YearPlan } from "./YearPlan";
import "./partner.css";

export interface PartnerFlowProps {
  /** Deep-link values from the query string: ?as=<partner code>&step=<step>&format=<format>&tab=site */
  initial?: { as?: string; step?: string; format?: string; tab?: string };
}

const isStep = (value: string | undefined): value is PartnerStep => PARTNER_STEPS.some((s) => s.id === value);
const isFormat = (value: string | undefined): value is PostFormat => POST_FORMATS.includes(value as PostFormat);

function startDraft(partner: SharePartner, logged: PostFormat[], format?: PostFormat): Draft {
  const draft = newDraft(partner, postingYear(partner, logged).next?.reel.id);
  return format ? { ...draft, format } : draft;
}

export function PartnerFlow({ initial = {} }: PartnerFlowProps) {
  const reduced = usePrefersReducedMotion();
  const firstPartner = getPartner(initial.as) ?? DEFAULT_PARTNER;
  const [partnerId, setPartnerId] = useState(firstPartner.id);
  const partner = SAMPLE_PARTNERS.find((p) => p.id === partnerId) ?? DEFAULT_PARTNER;

  const [signedIn, setSignedIn] = useState(isStep(initial.step));
  const [step, setStep] = useState<PartnerStep>(isStep(initial.step) ? initial.step : "profile");
  const [dir, setDir] = useState(1);
  const [logs, setLogs] = useState<Record<string, PostFormat[]>>({});
  const [draft, setDraft] = useState<Draft>(() => startDraft(firstPartner, [], isFormat(initial.format) ? initial.format : undefined));
  const [tab, setTab] = useState<ShareTab>(initial.tab === "site" ? "site" : "post");
  const [justLogged, setJustLogged] = useState(false);
  const [shared, setShared] = useState(false);

  const logged = logs[partner.id];
  const year = useMemo(() => postingYear(partner, logged), [partner, logged]);
  const post = useMemo(() => buildPost(partner, draft), [partner, draft]);
  const patch = useCallback((change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change })), []);

  const go = (next: PartnerStep) => {
    const order = (id: PartnerStep) => PARTNER_STEPS.findIndex((s) => s.id === id);
    setDir(order(next) >= order(step) ? 1 : -1);
    setStep(next);
  };

  const switchPartner = (id: string) => {
    const next = SAMPLE_PARTNERS.find((p) => p.id === id);
    if (!next || next.id === partner.id) return;
    setPartnerId(next.id);
    setDraft(startDraft(next, logs[next.id] ?? []));
    setShared(false);
    setJustLogged(false);
  };

  // The plan step forgets "just logged" once the partner moves on.
  useEffect(() => {
    if (step !== "plan") setJustLogged(false);
    if (step !== "share") setShared(false);
  }, [step]);

  // Keep the address in step with the flow, so any screen can be linked to.
  useEffect(() => {
    const params = new URLSearchParams();
    if (partner.id !== DEFAULT_PARTNER.id || signedIn) params.set("as", partner.code);
    if (signedIn) params.set("step", step);
    if (signedIn && step === "share" && tab === "site") params.set("tab", "site");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [partner, signedIn, step, tab]);

  const logPost = () => {
    setLogs((all) => ({ ...all, [partner.id]: [...(all[partner.id] ?? []), draft.format] }));
    setJustLogged(true);
    go("plan");
  };

  const makePost = (reelId: string) => {
    setDraft((d) => ({ ...d, footage: { kind: "reel", id: reelId } }));
    setTab("post");
    go("studio");
  };

  const top = useRef<HTMLDivElement>(null);
  const toTop = () => {
    const el = top.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  /* ---------------------------------------------------------------- dock */

  const dock: { back?: { label: string; to: PartnerStep }; primary: { label: string; icon?: React.ReactNode; onClick: () => void }; aside?: { label: string; icon: React.ReactNode; onClick: () => void } } =
    step === "profile"
      ? {
          primary: { label: "Create a post", icon: <IconSpark size={18} />, onClick: () => go("choose") },
          aside: { label: "Six a year", icon: <IconCalendar size={18} />, onClick: () => go("plan") },
        }
      : step === "choose"
        ? { back: { label: "Back to your profile", to: "profile" }, primary: { label: "Open the studio", onClick: () => go("studio") } }
        : step === "studio"
          ? { back: { label: "Back to the choices", to: "choose" }, primary: { label: "Preview and share", onClick: () => go("share") } }
          : step === "share"
            ? {
                back: { label: "Back to the studio", to: "studio" },
                primary: { label: shared ? "Posted it? Log it" : "I posted it", icon: <IconCheck size={18} strokeWidth={2.6} />, onClick: logPost },
              }
            : {
                back: { label: "Back to your profile", to: "profile" },
                primary: {
                  label: year.next ? `Make post ${year.next.index + 1}` : "Make another post",
                  icon: <IconSpark size={18} />,
                  onClick: () => makePost(year.next?.reel.id ?? year.slots[0].reel.id),
                },
              };

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduced ? 0 : d * 40 }),
    center: { opacity: 1, x: 0, transition: { duration: reduced ? 0.15 : 0.42, ease: EASE } },
    exit: (d: number) => ({ opacity: 0, x: reduced ? 0 : d * -28, transition: { duration: reduced ? 0.1 : 0.18, ease: "easeIn" as const } }),
  };

  const screen = signedIn ? step : "gate";

  return (
    <ShareShell
      width="wide"
      footer={false}
      back={{ href: "/share", label: "All share flows" }}
      className="pf-shell"
      end={
        signedIn ? (
          <span className="pf-me">
            <span className="pf-me-name">{partner.name}</span>
            <Avatar avatar={partner.avatar} size={30} />
          </span>
        ) : null
      }
    >
      <div className="pf-flow" data-screen={screen} ref={top}>
        {signedIn ? <StepHeader className="pf-progress" steps={PARTNER_STEPS} current={step} onSelect={(id) => go(id as PartnerStep)} /> : null}

        <AnimatePresence mode="wait" custom={dir} initial={false} onExitComplete={toTop}>
          <motion.div key={`${screen}`} className="pf-screen" data-screen={screen} custom={dir} variants={variants} initial="enter" animate="center" exit="exit">
            {!signedIn ? (
              <SignIn
                partner={partner}
                onPartner={switchPartner}
                onSignedIn={() => {
                  setDir(1);
                  setSignedIn(true);
                }}
              />
            ) : step === "profile" ? (
              <Profile partner={partner} year={year} onPartner={switchPartner} onPlan={() => go("plan")} />
            ) : step === "choose" ? (
              <Choose
                partner={partner}
                draft={draft}
                onIsland={(islandId) => setDraft((d) => retarget(partner, d, { islandId }))}
                onLead={(lead) => setDraft((d) => retarget(partner, d, { lead }))}
                onFormat={(format) => patch({ format })}
              />
            ) : step === "studio" ? (
              <Studio post={post} year={year} patch={patch} />
            ) : step === "share" ? (
              <ShareStep post={post} tab={tab} onTab={setTab} patch={patch} onShared={() => setShared(true)} />
            ) : (
              <YearPlan partner={partner} year={year} justLogged={justLogged} onMake={makePost} />
            )}
          </motion.div>
        </AnimatePresence>

        <p className="pf-foot">{shareCopy.sampleNotice}</p>
      </div>

      <AnimatePresence>
        {signedIn ? (
          <motion.div
            className="pf-dock"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 300, damping: 30, delay: 0.25 }}
          >
            <div className="pf-dock-inner" role="group" aria-label="Flow navigation">
              {dock.back ? (
                <button type="button" className="pf-dock-back" aria-label={dock.back.label} onClick={() => go(dock.back!.to)}>
                  <IconBack size={22} />
                </button>
              ) : null}
              {dock.aside ? (
                <button type="button" className="pf-dock-aside" onClick={dock.aside.onClick}>
                  {dock.aside.icon}
                  {dock.aside.label}
                </button>
              ) : null}
              <button type="button" className="sk-btn pf-dock-go" data-variant="primary" onClick={dock.primary.onClick}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={dock.primary.label}
                    className="pf-dock-label"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -14 }}
                    transition={{ duration: 0.24, ease: EASE }}
                  >
                    {dock.primary.icon}
                    {dock.primary.label}
                    {dock.primary.icon ? null : <IconArrow size={18} />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ShareShell>
  );
}
