"use client";

/**
 * /lab/pages: the passport content laid flat for review (pages agent).
 * Front cover, every inside page and the back cover at book size, in the active art direction,
 * with the header and progress ring on top. Tap a stamp for the detail sheet. The buttons step
 * through the demo story so the ring and the pages can be seen reacting.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Header, ProgressRing } from "@/components/chrome";
import { BackCover, FrontCover, contentStrings as cs, usePassportContent } from "@/components/passport/content";
import { DirectionScope } from "@/components/theme";
import { DIRECTION_LIST } from "@/lib/directions";
import {
  DEMO_SCRIPT,
  SAMPLE_PASSPORT,
  getProgress,
  provincialUnlocked,
  withProvincialEarned,
  withStampStatus,
} from "@/lib/sample-data";
import { strings, t } from "@/lib/strings";
import type { PassportData } from "@/lib/types";

const L = cs.lab;

function Sheet({ label, children, cover = false }: { label: string; children: ReactNode; cover?: boolean }) {
  return (
    <figure data-lab-sheet="" className="m-0 flex w-full flex-col items-center gap-3">
      <div
        className={
          cover
            ? "relative aspect-[360/560] w-full max-w-[360px] shadow-passport"
            : "relative aspect-[360/560] w-full max-w-[360px] overflow-hidden rounded-page shadow-[0_1px_2px_rgba(0,0,0,.1),0_18px_36px_-22px_rgba(0,0,0,.55)]"
        }
        style={cover ? { borderRadius: "4px var(--r-passport) var(--r-passport) 4px" } : undefined}
      >
        {children}
      </div>
      <figcaption className="type-label text-subtle">{label}</figcaption>
    </figure>
  );
}

function nextEmptySlot(passport: PassportData): string | null {
  const preferred = passport.slots.find((s) => s.id === DEMO_SCRIPT.collectSlotId && !s.stamp);
  return preferred?.id ?? passport.slots.find((s) => !s.stamp)?.id ?? null;
}

function nextPendingSlot(passport: PassportData): string | null {
  const preferred = passport.slots.find((s) => s.id === DEMO_SCRIPT.upgradeSlotId && s.stamp?.status === "pending");
  return preferred?.id ?? passport.slots.find((s) => s.stamp?.status === "pending")?.id ?? null;
}

const buttonClass =
  "min-h-11 rounded-chip border border-line-strong bg-elev px-4 text-[13px] font-semibold text-fg transition-transform duration-150 active:scale-[.97] disabled:opacity-40";

export default function PagesLab() {
  const [passport, setPassport] = useState<PassportData>(SAMPLE_PASSPORT);
  const [fresh, setFresh] = useState<string | null>(null);
  const progress = getProgress(passport);

  const slotOverrides = useMemo(() => (fresh ? { [fresh]: { highlight: true } } : undefined), [fresh]);
  const { cover, pages, backCover, sheet } = usePassportContent(passport, {
    slotOverrides,
    coverPageEdge: true,
    onEmptySlotSelect: (slot) => {
      setPassport((p) => withStampStatus(p, slot.id, "discovery"));
      setFresh(slot.id);
    },
  });

  const emptyId = nextEmptySlot(passport);
  const pendingId = nextPendingSlot(passport);
  const canAward = provincialUnlocked(passport) && !passport.provincial.earned;

  return (
    <div className="scene-bg min-h-dvh">
      <Header progress={progress} province={passport.province} />

      <main className="mx-auto max-w-[760px] px-4 pb-24 pt-7">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="type-display m-0 text-[30px] leading-none text-fg">{L.title}</h1>
          <span className="sample-tag">{strings.sample.tag}</span>
        </div>
        <p className="mb-5 max-w-[52ch] text-[14px] leading-relaxed text-muted">{L.intro}</p>

        <div className="mb-10 flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={!emptyId}
            onClick={() => {
              if (!emptyId) return;
              setPassport((p) => withStampStatus(p, emptyId, "discovery"));
              setFresh(emptyId);
            }}
          >
            {L.addStamp}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={!pendingId}
            onClick={() => {
              if (!pendingId) return;
              setPassport((p) => withStampStatus(p, pendingId, "verified"));
              setFresh(pendingId);
            }}
          >
            {L.confirm}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={!canAward}
            onClick={() => {
              setPassport((p) => withProvincialEarned(p));
              setFresh(passport.provincial.id);
            }}
          >
            {L.award}
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setPassport(SAMPLE_PASSPORT);
              setFresh(null);
            }}
          >
            {L.reset}
          </button>
        </div>

        <div className="grid grid-cols-1 justify-items-center gap-x-8 gap-y-12 sm:grid-cols-2">
          <Sheet label={L.cover} cover>
            {cover}
          </Sheet>
          {pages.map((page, i) => (
            <Sheet key={i} label={t(L.pageN, { n: i + 1 })}>
              {page}
            </Sheet>
          ))}
          <Sheet label={L.backCover} cover>
            {backCover}
          </Sheet>
        </div>

        <section className="mt-16">
          <h2 className="type-label m-0 text-fg">{L.ringHeading}</h2>
          <p className="mb-4 mt-1 text-[12px] text-subtle">{L.ringNote}</p>
          <div className="flex flex-wrap items-center gap-5">
            <ProgressRing
              collected={progress.collected}
              total={progress.total}
              province={passport.province}
              breakdown={{ verified: progress.verified, pending: progress.pending, discovery: progress.discovery }}
              size={96}
            />
            <ProgressRing collected={progress.collected} total={progress.total} province={passport.province} size={64} />
            <ProgressRing collected={progress.collected} total={progress.total} province={passport.province} label="none" />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="type-label m-0 text-fg">{L.allDirections}</h2>
          <p className="mb-5 mt-1 text-[12px] text-subtle">{L.allDirectionsNote}</p>
          <div className="grid grid-cols-3 gap-3">
            {DIRECTION_LIST.map((d) => (
              <DirectionScope key={d.id} direction={d.id} className="flex flex-col gap-3 bg-transparent">
                <div
                  className="relative aspect-[360/560] w-full shadow-passport"
                  style={{ borderRadius: "2px 8px 8px 2px", ["--ipp-cover-radius" as string]: "8px" }}
                >
                  <FrontCover
                    province={passport.province}
                    country={passport.country}
                    passportNo={passport.holder.passportNo}
                    holderName={passport.holder.name}
                    interactive={false}
                  />
                </div>
                <div
                  className="relative aspect-[360/560] w-full shadow-passport"
                  style={{ borderRadius: "8px 2px 2px 8px", ["--ipp-cover-radius" as string]: "8px" }}
                >
                  <BackCover />
                </div>
              </DirectionScope>
            ))}
          </div>
        </section>
      </main>

      {sheet}
    </div>
  );
}
