"use client";

/**
 * The partner's profile: who they are, what their links have done, the seals those donations are
 * earning (against EXAMPLE thresholds) and how the six posts a year are going.
 */
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { Avatar, IconArrow, IconCheck, LinkField, SampleTag, usePrefersReducedMotion } from "@/components/share/kit";
import { getIsland } from "@/lib/islands/data";
import { shareCode, shareCopy } from "@/lib/share";
import type { SharePartner } from "@/lib/share/types";
import { ISLAND_PHOTOS, PARTNER_SEAL_TIERS, sealProgress, sparkline, type PostingYear } from "./data";
import { CountUp, EASE, IconShield, Photo, SealMedal } from "./parts";
import { PartnerSwitch } from "./SignIn";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

function Spark({ seed }: { seed: number }) {
  const points = sparkline(seed);
  const w = 120;
  const h = 34;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 3 - p * (h - 8)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const last = xy[xy.length - 1];
  return (
    <svg className="pf-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={`${line}L${w} ${h}L0 ${h}Z`} fill="currentColor" opacity="0.12" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0] - 1.5} cy={last[1]} r="2.6" fill="currentColor" />
    </svg>
  );
}

export function SealTrack({ partner, compact }: { partner: SharePartner; compact?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const amount = partner.stats.donationsGenerated.amount;
  const progress = sealProgress(amount);
  const glyphs = ["check", "star", "crest"] as const;
  // The seals sit at 1/6, 3/6 and 5/6 of the width and the rail ends at the last one.
  const tiers = progress.ratio * PARTNER_SEAL_TIERS.length;
  const fill = (tiers <= 1 ? tiers / 6 : 1 / 6 + (tiers - 1) / 3) / (5 / 6);
  return (
    <div className="pf-seals" data-compact={compact}>
      <div className="pf-seals-track">
        <span className="pf-seals-rail">
          <motion.span
            className="pf-seals-fill"
            key={partner.id}
            initial={{ scaleX: reduced ? fill : 0 }}
            animate={{ scaleX: fill }}
            transition={{ duration: reduced ? 0 : 1.2, ease: EASE, delay: reduced ? 0 : 0.25 }}
          />
        </span>
        <ol className="pf-seals-stops">
          {PARTNER_SEAL_TIERS.map((tier, i) => {
            const earned = i < progress.earned;
            return (
              <li key={tier.id} data-earned={earned} data-next={progress.next?.id === tier.id}>
                <motion.span
                  className="pf-seals-medal"
                  key={`${partner.id}-${earned}`}
                  initial={earned && !reduced ? { scale: 0.4, rotate: -30, opacity: 0 } : false}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.45 + i * 0.22 }}
                >
                  <SealMedal earned={earned} glyph={glyphs[i]} size={compact ? 38 : 46} />
                </motion.span>
                <b>{tier.short}</b>
                <span>
                  {tier.display} <i>example</i>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function PostDots({ year, size = "m" }: { year: PostingYear; size?: "m" | "s" }) {
  return (
    <ol className="pf-dots" data-size={size} aria-label={`${year.posted} of ${year.goal} posts shared`}>
      {year.slots.map((slot) => (
        <li key={slot.index} data-status={slot.status}>
          <Photo name={slot.reel.scenes[0].photo} focus={slot.reel.scenes[0].focus} sizes="64px" />
          <span className="pf-dots-n">{slot.status === "posted" ? <IconCheck size={13} strokeWidth={3} /> : slot.index + 1}</span>
        </li>
      ))}
    </ol>
  );
}

export function Profile({
  partner,
  year,
  onPartner,
  onPlan,
}: {
  partner: SharePartner;
  year: PostingYear;
  onPartner: (id: string) => void;
  onPlan: () => void;
}) {
  const { stats, offer } = partner;
  const islandId = partner.islandIds[0];
  const island = getIsland(islandId);
  const banner = ISLAND_PHOTOS[islandId]?.[0] ?? ISLAND_PHOTOS.bohol[0];
  const progress = sealProgress(stats.donationsGenerated.amount);
  const seed = partner.code.length * 7 + stats.stampsIssued;
  const islands = partner.islandIds.map((id) => getIsland(id)?.name ?? id);

  return (
    <div className="pf-profile">
      <div className="pf-rise" style={rise(0)}>
        <PartnerSwitch partner={partner} onPartner={onPartner} label="Viewing as" />
      </div>

      <div className="pf-profile-a">
      <header className="sk-card pf-id pf-rise" style={rise(1)}>
        <div className="pf-id-banner">
          <Photo key={banner.name} name={banner.name} focus={banner.focus} width={1280} sizes="(max-width: 720px) 100vw, 720px" eager />
          <span className="pf-id-place">
            {island?.name ?? "Bohol"}, {island?.country ?? "Philippines"}
          </span>
        </div>
        <div className="pf-id-body">
          <Avatar avatar={partner.avatar} className="pf-id-avatar" />
          <div className="pf-id-top">
            <span className="pf-type">{shareCopy.partnerTypes[partner.type]}</span>
            <SampleTag>Sample partner</SampleTag>
          </div>
          <h1 className="pf-id-name">{partner.name}</h1>
          <p className="pf-id-handle">{partner.handle}</p>
          <p className="pf-id-blurb">{partner.blurb}</p>
          <ul className="pf-id-islands" aria-label="Islands you promote">
            {islands.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="pf-id-signed">
            <IconShield size={16} />
            Signed in with a one-time code. No password on this account.
          </p>
        </div>
      </header>

      <div className="pf-profile-link pf-rise" style={rise(6)}>
        <LinkField code={shareCode(partner, islandId)} label={`Your link for ${island?.name ?? "Bohol"}`} hint="Your code travels in the link, so the credit stays with you. Tap the link to see what people land on." />
      </div>
      </div>

      <div className="pf-profile-b">
      <section className="pf-stats pf-rise" style={rise(2)} aria-label="What your links have done">
        <div className="sk-card pf-stat" data-tone="sea">
          <span className="pf-stat-label">Scans and link visits</span>
          <b className="pf-stat-num">
            <CountUp value={stats.linkVisits} />
          </b>
          <Spark seed={seed} />
        </div>
        <div className="sk-card pf-stat">
          <span className="pf-stat-label">Travelers who gave</span>
          <b className="pf-stat-num">
            <CountUp value={stats.donationsGenerated.donors} />
          </b>
          <span className="pf-stat-sub">arrived through your links</span>
        </div>
        <div className="sk-card pf-stat" data-tone="gold">
          <span className="pf-stat-label">Donations generated</span>
          <b className="pf-stat-num">
            <CountUp value={stats.donationsGenerated.amount} prefix="$" />
          </b>
          <span className="pf-stat-sub">given on {offer.charity}&apos;s own page</span>
        </div>
        <div className="sk-card pf-stat">
          <span className="pf-stat-label">Stamps issued</span>
          <b className="pf-stat-num">
            <CountUp value={stats.stampsIssued} />
          </b>
          <span className="pf-stat-sub">
            <span className="pf-pending">
              <i />
              {stats.stampsPending} pending confirmation
            </span>
          </span>
        </div>
      </section>

      <p className="sk-note pf-honest pf-rise" style={rise(3)}>
        {shareCopy.noDonations.replace("{charity}", offer.charity)} A stamp is issued once the charity&apos;s confirmation arrives; until then it shows as pending.
      </p>

      <section className="sk-card pf-panel pf-rise" style={rise(4)} aria-labelledby="pf-seals-h">
        <div className="pf-panel-head">
          <div className="pf-panel-title">
            <h2 className="sk-h3" id="pf-seals-h">
              Seals you are earning
            </h2>
            <span className="pf-example">Example thresholds</span>
          </div>
          <p className="sk-note">
              {progress.next ? (
                <>
                  <b className="pf-strong">{progress.toGo}</b> more in donations for {island?.name ?? "Bohol"} earns the {progress.next.label.toLowerCase()}.
                </>
              ) : (
                <>All three seals earned for {island?.name ?? "Bohol"}.</>
              )}
          </p>
        </div>
        <SealTrack partner={partner} />
        <p className="sk-hint pf-panel-foot">{shareCopy.exampleThreshold}</p>
      </section>

      <button type="button" className="sk-card pf-panel pf-six pf-rise" style={rise(5)} onClick={onPlan}>
        <div className="pf-panel-head">
          <div className="pf-panel-title">
            <h2 className="sk-h3">Six posts a year</h2>
            <span className="pf-six-go" aria-hidden="true">
              <IconArrow size={18} />
            </span>
          </div>
          <p className="sk-note">
              <b className="pf-strong">
                {year.posted} of {year.goal}
              </b>{" "}
              shared.{" "}
              {year.next ? (
                <>
                  Next up: video {year.next.index + 1}, {year.months[year.next.monthIndex].current ? "due this month" : `around ${year.next.monthLabel}`}.
                </>
              ) : (
                <>Every video is out. Nicely done.</>
              )}
          </p>
        </div>
        <PostDots year={year} />
      </button>

      </div>
    </div>
  );
}
