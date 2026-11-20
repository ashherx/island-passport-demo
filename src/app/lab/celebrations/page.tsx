"use client";

/**
 * /lab/celebrations: the two moments after the first stamp (celebrations agent).
 *   A. StatusUpgrade   Donation pending becomes Verified Supporter (UX-3)
 *   B. ProvincialAward the Provincial Stamp celebration and its flight to the page (UX-4)
 * Each has a trigger and a replay button. Sample content throughout (PUB-7).
 */
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ProvincialAward } from "@/components/moments/ProvincialAward";
import { StatusUpgrade, type StatusUpgradeHandle } from "@/components/moments/StatusUpgrade";
import { celebrationStrings } from "@/components/moments/celebrations/strings";
import { Stamp } from "@/components/stamp";
import { ThemeSwitcher } from "@/components/theme";
import { DEMO_SCRIPT, SAMPLE_PASSPORT, getProgress, stampForSlot, withStampStatus } from "@/lib/sample-data";
import { strings } from "@/lib/strings";

const L = celebrationStrings.lab;
const UPGRADE_STAMP = stampForSlot(DEMO_SCRIPT.upgradeSlotId, "pending", "2026-02-13");
const PROVINCIAL = { ...SAMPLE_PASSPORT.provincial.stamp, date: DEMO_SCRIPT.today };
const VERIFIED_AFTER = getProgress(withStampStatus(SAMPLE_PASSPORT, DEMO_SCRIPT.upgradeSlotId, "verified")).verified;
const SLOT_SIZE = 212;

function Page({ label, title, aside, children }: { label: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="mat-paper relative overflow-hidden rounded-page shadow-[inset_0_0_0_1px_var(--paper-edge),0_1px_2px_rgba(0,0,0,.08),0_18px_34px_-20px_rgba(0,0,0,.5)]">
      <div className="relative flex items-end justify-between gap-3 border-b border-[color:var(--paper-edge)] px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="type-label text-paper-muted">{label}</p>
          <p className="font-display mt-1 truncate text-[26px] leading-none text-paper-ink">{title}</p>
        </div>
        {aside}
      </div>
      <div className="relative flex flex-col items-center px-4 pb-6 pt-6">{children}</div>
      <div className="mat-page-dim absolute inset-0" aria-hidden="true" />
    </div>
  );
}

function SectionHeading({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between gap-4">
      <h2 id={id} className="type-label text-fg">
        {title}
      </h2>
      <p className="max-w-[60%] text-right text-[11px] leading-snug text-subtle">{note}</p>
    </div>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-12 flex-1 items-center justify-center rounded-chip bg-accent px-5 text-[15px] font-semibold text-accent-fg shadow-[0_10px_22px_-12px_var(--accent)] transition-[transform,opacity] duration-200 ease-out-soft active:scale-[0.97] disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function ResetButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={strings.actions.reset}
      title={strings.actions.reset}
      {...props}
      className="inline-grid size-12 flex-none place-items-center rounded-chip text-fg shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[transform,opacity] duration-200 ease-out-soft active:scale-[0.94] disabled:opacity-35"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.2 9a5.8 5.8 0 1 0 1.9-4.3" />
        <path d="M2.8 2.6v3.3h3.3" />
      </svg>
    </button>
  );
}

function UpgradeDemo() {
  const ref = useRef<StatusUpgradeHandle>(null);
  const [state, setState] = useState<"idle" | "playing" | "done">("idle");

  const play = () => {
    setState("playing");
    ref.current?.play();
  };
  const reset = () => {
    ref.current?.reset();
    setState("idle");
  };

  return (
    <section aria-labelledby="lab-upgrade">
      <SectionHeading id="lab-upgrade" title={L.upgradeTitle} note={L.upgradeNote} />
      <Page label={L.pageIsland} title={UPGRADE_STAMP.island}>
        <StatusUpgrade ref={ref} stamp={UPGRADE_STAMP} size={236} label="paper" onComplete={() => setState("done")} />
        <p className="mt-4 max-w-[17rem] text-center text-[12.5px] leading-snug text-paper-muted">
          {UPGRADE_STAMP.charity}
          <span className="mx-1.5 opacity-50">·</span>
          {UPGRADE_STAMP.promoter}
        </p>
      </Page>
      <p className="mt-3 text-[13px] leading-snug text-muted">{L.upgradeHint}</p>
      <div className="mt-3 flex gap-2.5">
        <PrimaryButton onClick={state === "done" ? () => { reset(); window.setTimeout(play, 380); } : play} disabled={state === "playing"}>
          {state === "done" ? strings.actions.replay : strings.actions.confirmDonation}
        </PrimaryButton>
        <ResetButton onClick={reset} disabled={state === "idle"} />
      </div>
    </section>
  );
}

function AwardDemo() {
  const slotRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [earned, setEarned] = useState(false);

  const award = () => {
    setEarned(false);
    setOpen(true);
  };

  return (
    <section aria-labelledby="lab-award">
      <SectionHeading id="lab-award" title={L.awardTitle} note={L.awardNote} />
      <Page
        label={L.pageProvince}
        title={PROVINCIAL.island}
        aside={<span className="type-label pb-0.5 text-paper-muted">{earned ? strings.lab.earned : strings.lab.locked}</span>}
      >
        <div ref={slotRef} style={{ width: SLOT_SIZE, height: SLOT_SIZE }}>
          {earned ? (
            <Stamp stamp={PROVINCIAL} size={SLOT_SIZE} />
          ) : (
            <Stamp stamp={PROVINCIAL} variant="empty" size={SLOT_SIZE} emptyLabel={strings.stamp.provincial} />
          )}
        </div>
        <p className="mt-4 flex min-h-[2.2rem] max-w-[17rem] items-center text-center text-[12.5px] leading-snug text-paper-muted">
          {earned ? strings.progress.provincialReady : L.awardHint}
        </p>
      </Page>
      <div className="mt-4 flex gap-2.5">
        <PrimaryButton onClick={award} disabled={open}>
          {earned ? L.again : strings.actions.awardProvincial}
        </PrimaryButton>
        <ResetButton onClick={() => setEarned(false)} disabled={!earned || open} />
      </div>
      <ProvincialAward
        open={open}
        stamp={PROVINCIAL}
        verifiedCount={VERIFIED_AFTER}
        target={slotRef}
        onLanded={() => setEarned(true)}
        onComplete={() => setOpen(false)}
      />
    </section>
  );
}

export default function CelebrationsLabPage() {
  // Read after mount: the server cannot know the setting, and a mismatch would break hydration.
  const prefersReduced = useReducedMotion();
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(!!prefersReduced), [prefersReduced]);
  return (
    <main className="scene-bg min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-[color:color-mix(in_srgb,var(--bg)_86%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[20px] leading-none text-fg">{L.title}</h1>
            <span className="sample-tag mt-1.5">{strings.sample.tag}</span>
          </div>
          <ThemeSwitcher variant="compact" />
        </div>
      </header>
      <div className="mx-auto max-w-[430px] px-4 pb-16 pt-6">
        <p className="text-[14px] leading-relaxed text-muted">{L.intro}</p>
        {reduced && <p className="mt-2 text-[12px] leading-snug text-subtle">{L.reducedNote}</p>}
        <UpgradeDemo />
        <AwardDemo />
        <footer className="pt-10 text-[12px] leading-relaxed text-subtle">
          <p>{strings.sample.notice}</p>
          <p>{strings.sample.noDonations}</p>
        </footer>
      </div>
    </main>
  );
}
