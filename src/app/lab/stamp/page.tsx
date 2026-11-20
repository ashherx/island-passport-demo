"use client";

/**
 * /lab/stamp: the stamp system gallery (foundation).
 * Every stamp slot in every status plus the empty placeholder, for all three art directions,
 * together with the materials, inks and type each direction defines.
 */
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Stamp, VerifiedSeal } from "@/components/stamp";
import { DirectionScope, ThemeSwitcher } from "@/components/theme";
import { DIRECTION_LIST, type DirectionTokens } from "@/lib/directions";
import { DEMO_SCRIPT, SAMPLE_PASSPORT, SAMPLE_PROVINCIAL, stampForSlot } from "@/lib/sample-data";
import { strings, t } from "@/lib/strings";
import { STAMP_STATUSES, type StampSlot, type StampStatus } from "@/lib/types";

const L = strings.lab;
const HERO_SLOT = "balicasag-sea-turtle";
const SCALE_SLOT = "bohol-tarsier";
const REVEAL_SLOT = "banacon-mangroves";

function slotStamp(slot: StampSlot, status: StampStatus) {
  return stampForSlot(slot.id, status, slot.stamp?.date ?? DEMO_SCRIPT.today);
}

function Paper({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mat-paper relative overflow-hidden rounded-page shadow-[inset_0_0_0_1px_var(--paper-edge),0_1px_2px_rgba(0,0,0,.08),0_14px_28px_-18px_rgba(0,0,0,.45)] ${className}`}
    >
      {children}
      <div className="mat-page-dim absolute inset-0" aria-hidden="true" />
    </div>
  );
}

function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 mt-9 flex items-baseline justify-between gap-4">
      <h3 className="type-label text-fg">{title}</h3>
      {note && <p className="max-w-[60%] text-right text-[11px] leading-snug text-subtle">{note}</p>}
    </div>
  );
}

function StatusDot({ status }: { status: StampStatus }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2 rounded-full"
      style={{ background: `var(--status-${status})` }}
    />
  );
}

function Materials({ d }: { d: DirectionTokens }) {
  return (
    <div className="grid grid-cols-[1.05fr_1fr] gap-3">
      <div className="mat-cover relative aspect-[5/7] overflow-hidden rounded-passport shadow-passport">
        <div className="mat-sheen absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col items-center justify-between px-3 py-6 text-center">
          <span className={`type-label ${d.cover.material === "kraft" ? "" : "foil-text"}`}>{strings.country.name}</span>
          <div className="flex flex-col items-center gap-3">
            <VerifiedSeal size={58} withText={false} decorative />
            <span
              className={`font-display text-[26px] leading-[1.02] ${d.cover.material === "kraft" ? "" : "foil-text"}`}
            >
              {strings.passport.coverTitle.split(" ").map((word) => (
                <span key={word} className="block">
                  {word}
                </span>
              ))}
            </span>
          </div>
          <span className={`type-label ${d.cover.material === "kraft" ? "" : "foil-text"}`}>
            {strings.province.name}
          </span>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/35 via-black/5 to-transparent" />
      </div>
      <div className="flex flex-col gap-3">
        <Paper className="flex-1 p-3">
          <p className="type-label text-paper-muted">{L.paper}</p>
          <p className="font-display mt-1 text-[22px] leading-none text-paper-ink">{strings.province.name}</p>
          <div className="mt-3 flex gap-1.5">
            {(["discovery", "pending", "verified", "provincial"] as const).map((key) => (
              <span
                key={key}
                title={key}
                className="h-7 flex-1 rounded-[3px]"
                style={{ background: `var(--ink-${key})`, opacity: key === "pending" ? 0.7 : 0.92 }}
              />
            ))}
          </div>
          <p className="type-label mt-1.5 text-paper-muted">{L.inks}</p>
        </Paper>
        <div className="foil-fill relative h-12 overflow-hidden rounded-card shadow-[inset_0_1px_0_rgba(255,255,255,.5),inset_0_-1px_0_rgba(0,0,0,.25),0_6px_14px_-8px_rgba(0,0,0,.5)]">
          <span className="type-label absolute inset-0 grid place-items-center" style={{ color: "var(--foil-shadow)" }}>
            {L.foil}
          </span>
        </div>
      </div>
    </div>
  );
}

function TypeSpecimen() {
  const rows: [string, string, string][] = [
    [L.typeDisplay, "font-display text-[26px] leading-none", strings.app.name],
    [L.typeBody, "text-[15px] leading-snug", strings.app.tagline],
    [L.typeMono, "font-mono text-[12px] tracking-[0.08em]", SAMPLE_PASSPORT.holder.passportNo],
    [L.typeStamp, "font-stamp text-[14px] uppercase tracking-[0.12em]", L.pangram],
  ];
  return (
    <div className="divide-y divide-line rounded-card bg-elev px-4 shadow-[0_0_0_1px_var(--line)]">
      {rows.map(([label, cls, sample]) => (
        <div key={label} className="flex items-baseline gap-4 py-3">
          <span className="type-label w-14 shrink-0 text-subtle">{label}</span>
          <span className={`min-w-0 truncate text-fg ${cls}`} style={label === L.typeStamp ? { fontWeight: "var(--stamp-weight)" } : undefined}>
            {sample}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusLegend() {
  const slot = SAMPLE_PASSPORT.slots.find((s) => s.id === HERO_SLOT)!;
  return (
    <Paper className="divide-y divide-[color:var(--paper-edge)]">
      {STAMP_STATUSES.map((status) => (
        <div key={status} className="flex items-center gap-4 p-3">
          <Stamp stamp={slotStamp(slot, status)} size={148} />
          <div className="min-w-0">
            <p className="type-label flex items-center gap-1.5 text-paper-muted">
              <span className="inline-block size-2 rounded-full" style={{ background: `var(--ink-${status})` }} />
              {strings.status[status].label}
            </p>
            <p className="mt-1.5 text-[13px] leading-snug text-paper-ink">{strings.status[status].blurb}</p>
          </div>
        </div>
      ))}
    </Paper>
  );
}

function Collection() {
  const columns = [...STAMP_STATUSES.map((s) => strings.status[s].label), L.empty];
  return (
    <Paper className="px-2 pb-3 pt-2">
      <div className="grid grid-cols-4 gap-x-1 pb-1">
        {columns.map((label) => (
          <p key={label} className="type-label px-0.5 text-center !text-[8.5px] !tracking-[0.08em] text-paper-muted">
            {label}
          </p>
        ))}
      </div>
      {SAMPLE_PASSPORT.slots.map((slot) => (
        <div key={slot.id} className="grid grid-cols-4 justify-items-center gap-x-1 py-1">
          {STAMP_STATUSES.map((status) => (
            <Stamp key={status} stamp={slotStamp(slot, status)} size={82} />
          ))}
          <Stamp slot={slot} size={82} />
        </div>
      ))}
    </Paper>
  );
}

function Provincial() {
  const remaining = SAMPLE_PROVINCIAL.requiredVerified - 2;
  return (
    <Paper className="flex flex-col items-center gap-2 p-4">
      <Stamp stamp={SAMPLE_PROVINCIAL.stamp} size={236} />
      <div className="flex w-full items-center justify-around pt-2">
        <figure className="flex flex-col items-center gap-1">
          <Stamp
            stamp={SAMPLE_PROVINCIAL.stamp}
            variant="empty"
            size={132}
            emptyLabel={t(remaining === 1 ? strings.stamp.provincialLockedOne : strings.stamp.provincialLocked, { n: remaining })}
          />
          <figcaption className="type-label text-paper-muted">{L.locked}</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-1">
          <Stamp stamp={SAMPLE_PROVINCIAL.stamp} size={132} />
          <figcaption className="type-label text-paper-muted">{L.earned}</figcaption>
        </figure>
      </div>
    </Paper>
  );
}

function Scale() {
  const slot = SAMPLE_PASSPORT.slots.find((s) => s.id === SCALE_SLOT)!;
  return (
    <Paper className="flex flex-col items-center gap-3 p-4">
      <Stamp stamp={slotStamp(slot, "verified")} size={320} />
      <div className="flex items-end justify-center gap-4">
        <Stamp stamp={slotStamp(slot, "pending")} size={160} />
        <Stamp stamp={slotStamp(slot, "discovery")} size={80} />
      </div>
    </Paper>
  );
}

function InkReveal() {
  const slot = SAMPLE_PASSPORT.slots.find((s) => s.id === REVEAL_SLOT)!;
  const stamp = slotStamp(slot, "discovery");
  const progress = useMotionValue(1);
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);

  const press = () => {
    if (busy) return;
    if (reduced) {
      progress.set(1);
      return;
    }
    setBusy(true);
    progress.set(0);
    animate(progress, 1, { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }).then(() => setBusy(false));
  };

  return (
    <Paper className="p-3">
      <div className="grid grid-cols-4 justify-items-center gap-1">
        {[0.2, 0.45, 0.7, 1].map((p) => (
          <figure key={p} className="flex flex-col items-center">
            <Stamp stamp={stamp} size={82} inkProgress={p} decorative />
            <figcaption className="type-label text-paper-muted">{p.toFixed(2)}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--paper-edge)] pt-3">
        <Stamp stamp={stamp} size={150} inkProgress={progress} />
        <button
          type="button"
          onClick={press}
          disabled={busy}
          className="type-label rounded-chip bg-[color:var(--paper-ink)] px-5 py-3 text-[color:var(--paper)] transition-opacity disabled:opacity-50"
        >
          {L.press}
        </button>
      </div>
    </Paper>
  );
}

function DirectionSection({ d }: { d: DirectionTokens }) {
  return (
    <DirectionScope direction={d.id} className="scene-bg px-4 pb-14 pt-10">
      <section aria-labelledby={`dir-${d.id}`} className="mx-auto max-w-[430px]">
        <p className="type-label text-accent">{t(L.directionHeading, { name: d.name })}</p>
        <h2 id={`dir-${d.id}`} className="font-display mt-2 text-[40px] leading-[0.98] text-fg">
          {d.tagline}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
          {STAMP_STATUSES.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <StatusDot status={status} />
              {strings.status[status].label}
            </span>
          ))}
        </div>

        <SectionHeading title={L.materials} note={L.materialsNote} />
        <Materials d={d} />

        <SectionHeading title={L.type} />
        <TypeSpecimen />

        <SectionHeading title={L.statuses} note={L.statusesNote} />
        <StatusLegend />

        <SectionHeading title={L.provincial} note={L.provincialNote} />
        <Provincial />

        <SectionHeading title={L.scale} note={L.scaleNote} />
        <Scale />

        <SectionHeading title={L.inkReveal} note={L.inkRevealNote} />
        <InkReveal />

        <SectionHeading title={L.allStamps} note={L.allStampsNote} />
        <Collection />
      </section>
    </DirectionScope>
  );
}

export default function StampLabPage() {
  return (
    <main>
      <header className="sticky top-0 z-20 border-b border-line bg-[color:color-mix(in_srgb,var(--bg)_86%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[20px] leading-none text-fg">{L.stampTitle}</h1>
            <span className="sample-tag mt-1.5">{strings.sample.tag}</span>
          </div>
          <ThemeSwitcher variant="compact" />
        </div>
      </header>
      <div className="mx-auto max-w-[430px] px-4 pb-2 pt-6">
        <p className="text-[14px] leading-relaxed text-muted">{L.stampIntro}</p>
        <div className="mt-5">
          <ThemeSwitcher />
        </div>
      </div>
      {DIRECTION_LIST.map((d) => (
        <DirectionSection key={d.id} d={d} />
      ))}
      <footer className="mx-auto max-w-[430px] px-4 py-8 text-[12px] leading-relaxed text-subtle">
        <p>{strings.sample.notice}</p>
        <p>{strings.sample.noDonations}</p>
      </footer>
    </main>
  );
}
