"use client";

/**
 * Step 5: six posts a year. One prepared island video every two months: which ones are out,
 * which is due, and when the rest are suggested. A post logged in this session is "postmarked".
 */
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { IconArrow, IconCheck, usePrefersReducedMotion } from "@/components/share/kit";
import { shareCopy } from "@/lib/share";
import type { SharePartner } from "@/lib/share/types";
import type { PostSlot, PostingYear } from "./data";
import { EASE, IconCalendar, Photo } from "./parts";
import { SealTrack } from "./Profile";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

const R = 44;
const CIRC = 2 * Math.PI * R;
const GAP = 7;

function Ring({ year }: { year: PostingYear }) {
  const reduced = usePrefersReducedMotion();
  const arc = CIRC / year.goal - GAP;
  return (
    <div className="pf-ring">
      <svg viewBox="-56 -56 112 112" aria-hidden="true" focusable="false">
        {year.slots.map((slot) => {
          const rotate = -90 + (360 / year.goal) * slot.index + (GAP / CIRC) * 180;
          const posted = slot.status === "posted";
          return (
            <g key={slot.index} transform={`rotate(${rotate})`}>
              <circle r={R} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${arc} ${CIRC - arc}`} className="pf-ring-track" data-status={slot.status} />
              {posted ? (
                <motion.circle
                  r={R}
                  fill="none"
                  strokeWidth="9"
                  strokeLinecap="round"
                  className="pf-ring-fill"
                  data-fresh={slot.fresh}
                  initial={{ strokeDasharray: reduced ? `${arc} ${CIRC - arc}` : `0.01 ${CIRC}`, opacity: reduced ? 1 : 0 }}
                  animate={{ strokeDasharray: `${arc} ${CIRC - arc}`, opacity: 1 }}
                  transition={{ duration: reduced ? 0 : 0.55, ease: EASE, delay: reduced ? 0 : slot.fresh ? 0.75 : 0.15 + slot.index * 0.09 }}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="pf-ring-num">
        <b>{year.posted}</b>
        <span>of {year.goal}</span>
      </div>
    </div>
  );
}

function Postmark({ slot }: { slot: PostSlot }) {
  const reduced = usePrefersReducedMotion();
  const id = `pf-pm-${slot.index}`;
  return (
    <motion.span
      className="pf-postmark"
      data-fresh={slot.fresh}
      initial={slot.fresh && !reduced ? { opacity: 0, scale: 2.1, rotate: 8 } : false}
      animate={{ opacity: 1, scale: 1, rotate: -11 }}
      transition={slot.fresh ? { type: "spring", stiffness: 420, damping: 17, delay: 0.55 } : { duration: 0 }}
    >
      <svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
        <defs>
          <path id={`${id}-a`} d="M-33 0A33 33 0 0 1 33 0" />
          <path id={`${id}-b`} d="M-38 0A38 38 0 0 0 38 0" />
        </defs>
        <circle r="46" fill="rgba(255,255,255,0.9)" />
        <circle r="45" fill="none" stroke="currentColor" strokeWidth="2.6" />
        <circle r="27.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text fontSize="9.6" fontWeight="700" letterSpacing="3.4" fill="currentColor" textAnchor="middle">
          <textPath href={`#${id}-a`} startOffset="50%">
            POSTED
          </textPath>
        </text>
        <text fontSize="6.8" fontWeight="700" letterSpacing="2.2" fill="currentColor" textAnchor="middle">
          <textPath href={`#${id}-b`} startOffset="50%">
            {`VIDEO ${slot.index + 1} OF 6`}
          </textPath>
        </text>
        <text y="-1" fontSize="15" fontWeight="700" fill="currentColor" textAnchor="middle">
          {slot.postedOn?.split(" ")[0]}
        </text>
        <text y="11" fontSize="8.4" fontWeight="700" letterSpacing="1.6" fill="currentColor" textAnchor="middle">
          {slot.postedOn?.split(" ")[1]?.toUpperCase()}
        </text>
      </svg>
    </motion.span>
  );
}

export function YearPlan({
  partner,
  year,
  justLogged,
  onMake,
}: {
  partner: SharePartner;
  year: PostingYear;
  /** True right after a post was logged in this session. */
  justLogged: boolean;
  /** Start a new post from one of the six videos. */
  onMake: (reelId: string) => void;
}) {
  const next = year.next;
  const nextIsNow = next ? year.months[next.monthIndex].current : false;
  const slotAt = (monthIndex: number) => year.slots.find((s) => s.monthIndex === monthIndex);

  return (
    <div className="pf-plan">
      <header className="pf-head pf-rise" style={rise(0)}>
        <p className="sk-eyebrow">
          {partner.name} · {year.span}
        </p>
        <h1 className="sk-h2 pf-h1">
          Six posts <em>a year.</em>
        </h1>
        <p className="sk-lead">One island video every two months. Change the line, post again: that is the whole habit.</p>
      </header>

      <section className="sk-card pf-plan-hero pf-rise" style={rise(1)} aria-label="Your progress">
        <Ring year={year} />
        <div className="pf-plan-hero-text">
          {justLogged ? (
            <span className="pf-plan-logged">
              <IconCheck size={13} strokeWidth={3} />
              Post logged
            </span>
          ) : null}
          <h2 className="pf-plan-status">{year.posted === year.goal ? "All six are out." : `${year.posted} of ${year.goal} shared.`}</h2>
          <p className="sk-note">
            {next ? (
              <>
                Next: video {next.index + 1}, <b className="pf-strong">{next.reel.title}</b>, {nextIsNow ? "due this month" : `suggested for ${next.monthLabel}`}.
              </>
            ) : year.bonus ? (
              <>Plus {year.bonus} bonus {year.bonus === 1 ? "post" : "posts"}. Every extra share keeps the link working for you.</>
            ) : (
              <>Any video can go out again with a new line. A fresh six starts when this year ends.</>
            )}
          </p>
          <p className="pf-plan-goal">
            <IconCalendar size={16} />
            {shareCopy.postsGoal}
          </p>
        </div>

        <ol className="pf-months" aria-label="Your posting year, month by month">
          {year.months.map((month) => {
            const slot = slotAt(month.index);
            return (
              <li key={month.index} data-current={month.current} data-status={slot?.status ?? "none"}>
                <span className="pf-months-node">{slot?.status === "posted" ? <IconCheck size={11} strokeWidth={3.4} /> : slot ? slot.index + 1 : null}</span>
                <span className="pf-months-label">{month.label}</span>
                <span className="sk-sr">
                  {slot ? `: video ${slot.index + 1}, ${slot.status === "posted" ? "posted" : slot.status === "due" ? "next" : "suggested"}` : ""}
                  {month.current ? " (this month)" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <ol className="pf-slots">
        {year.slots.map((slot) => {
          const scene = slot.reel.scenes[0];
          const dueNow = slot.status === "due" && year.months[slot.monthIndex].current;
          return (
            <li key={slot.index} className="sk-card pf-slot pf-rise" style={rise(2 + slot.index * 0.5)} data-status={slot.status} data-fresh={slot.fresh}>
              <div className="pf-slot-media">
                <Photo name={scene.photo} focus={scene.focus} sizes="(max-width: 720px) 46vw, 180px" eager />
                <span className="pf-slot-n">{slot.index + 1}</span>
                {slot.status === "posted" ? <Postmark slot={slot} /> : null}
              </div>
              <div className="pf-slot-text">
                <b>{slot.reel.title}</b>
                {slot.status === "posted" ? (
                  <span className="pf-slot-meta" data-tone="done">
                    <IconCheck size={13} strokeWidth={3} />
                    {slot.postedOn}
                    {slot.format ? ` · ${shareCopy.formats[slot.format]}` : ""}
                  </span>
                ) : slot.status === "due" ? (
                  <>
                    <span className="pf-slot-meta" data-tone="next">
                      {dueNow ? "Due this month" : `Next, around ${slot.monthLabel}`}
                    </span>
                    <button type="button" className="pf-slot-go" onClick={() => onMake(slot.reel.id)}>
                      Make this post <IconArrow size={15} />
                    </button>
                  </>
                ) : (
                  <span className="pf-slot-meta">Suggested {slot.monthLabel}</span>
                )}
                {slot.status === "posted" ? (
                  <button type="button" className="pf-slot-again" onClick={() => onMake(slot.reel.id)}>
                    Post it again
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <section className="sk-card pf-panel pf-rise" style={rise(6)} aria-labelledby="pf-plan-seals">
        <div className="pf-panel-head">
          <div className="pf-panel-title">
            <h2 className="sk-h3" id="pf-plan-seals">
              Why six
            </h2>
            <span className="pf-example">Example thresholds</span>
          </div>
          <p className="sk-note">Every post sends people to your link. The donations they make on the charity&apos;s own page move your seals.</p>
        </div>
        <SealTrack partner={partner} compact />
        <p className="sk-hint pf-panel-foot">{shareCopy.exampleThreshold}</p>
      </section>
    </div>
  );
}
