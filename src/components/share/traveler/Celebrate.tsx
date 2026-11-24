"use client";

/**
 * Step 1, the moment after a stamp: the fresh stamp pressed onto a page of the traveler's own
 * passport, a scatter of ink and foil, and a sheet that offers to share it. The wording follows
 * the stamp's status, so nothing is claimed before the charity has confirmed it.
 */
import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useMemo, type CSSProperties } from "react";
import { IconShare, SkButton, usePrefersReducedMotion } from "@/components/share/kit";
import { Stamp } from "@/components/stamp";
import { rand } from "@/components/stamp/geometry";
import { DirectionScope } from "@/components/theme";
import { getProgress } from "@/lib/sample-data";
import type { ShareTraveler } from "@/lib/share";
import { strings, t } from "@/lib/strings";
import type { DirectionId, PassportData, Stamp as StampData, StampStatus } from "@/lib/types";
import { copy } from "./copy";

export interface CelebrateProps {
  stamp: StampData;
  status: StampStatus;
  direction: DirectionId;
  passport: PassportData;
  stats: ShareTraveler["stats"];
  onShare: () => void;
  /** Where "Not now" goes. */
  laterHref: string;
}

const C = copy.celebrate;
const FLECK_COLORS = ["var(--sk-sun)", "var(--sk-sea)", "#d2ab5a", "var(--skt-status)", "#f6c98b", "var(--sk-sky-deep)"];

export function Celebrate({ stamp, status, direction, passport, stats, onShare, laterHref }: CelebrateProps) {
  const reduced = usePrefersReducedMotion();
  const ink = useMotionValue(0);
  const progress = getProgress(passport);
  const islandIndex = passport.islands.findIndex((i) => i.id === stamp.islandId) + 1;
  const pressKey = `${status}:${direction}`;

  // The stamp is pressed again whenever its status or the passport's look changes.
  useEffect(() => {
    if (reduced) {
      ink.set(1);
      return;
    }
    ink.set(0);
    const run = animate(ink, 1, { duration: 0.5, delay: 0.5, ease: [0.3, 0.7, 0.4, 1] });
    return () => run.stop();
  }, [ink, reduced, pressKey]);

  const flecks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2 + rand(`a${i}`, "fleck") * 0.5;
        const reach = 132 + rand(`r${i}`, "fleck") * 62;
        return {
          x: Math.cos(angle) * reach,
          y: Math.sin(angle) * reach * 0.86,
          size: 5 + Math.round(rand(`s${i}`, "fleck") * 7),
          turn: Math.round(rand(`t${i}`, "fleck") * 180),
          color: FLECK_COLORS[i % FLECK_COLORS.length],
          shape: i % 3,
          delay: 0.62 + rand(`d${i}`, "fleck") * 0.16,
        };
      }),
    [],
  );

  const spring = { type: "spring" as const, stiffness: 520, damping: 22, mass: 0.9 };

  return (
    <section className="skt-cel" data-status={status} aria-labelledby="skt-cel-title">
      <div className="skt-cel-stage" aria-hidden="true">
        <div className="skt-cel-rays" />
        <DirectionScope direction={direction} className="skt-cel-scope">
          <motion.div
            key={`page:${direction}`}
            className="skt-cel-page mat-paper"
            initial={reduced ? false : { opacity: 0, y: 46, rotate: -11 }}
            animate={{ opacity: 1, y: 0, rotate: -4 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="skt-cel-page-row">
              <span>Province of {passport.province}</span>
              <span>
                {islandIndex} / {passport.islands.length}
              </span>
            </div>
            <motion.div
              key={pressKey}
              className="skt-cel-stamp"
              initial={reduced ? false : { scale: 1.75, opacity: 0, rotate: -16 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ ...spring, delay: 0.42 }}
            >
              <Stamp stamp={stamp} status={status} size={184} blend="multiply" inkProgress={ink} decorative />
            </motion.div>
            <div className="skt-cel-page-row" data-foot="true">
              <span>{passport.holder.passportNo}</span>
              <span>Sample</span>
            </div>
          </motion.div>
        </DirectionScope>
        <div key={`flecks:${pressKey}`} className="skt-cel-flecks">
          {flecks.map((f, i) => (
            <i
              key={i}
              data-shape={f.shape}
              style={{ "--x": `${f.x.toFixed(1)}px`, "--y": `${f.y.toFixed(1)}px`, "--s": `${f.size}px`, "--t": `${f.turn}deg`, "--c": f.color, "--d": `${f.delay.toFixed(2)}s` } as CSSProperties}
            />
          ))}
        </div>
        <motion.span
          className="skt-cel-chip"
          initial={reduced ? false : { opacity: 0, scale: 0.6, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...spring, delay: 0.9 }}
        >
          {C.chip}
        </motion.span>
      </div>

      <motion.div
        className="skt-cel-sheet"
        initial={reduced ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="skt-cel-grip" aria-hidden="true" />
        <p className="skt-status">
          <i aria-hidden="true" />
          {strings.status[status].label}
          <span>{t(C.passportLine, { n: progress.collected, total: progress.total, province: passport.province })}</span>
        </p>
        <h1 className="sk-title" id="skt-cel-title">
          {t(C.title, { title: stamp.title })} <em>{C.titleEm}</em>
        </h1>
        <p className="sk-lead">{t(C.lead[status], { charity: stamp.charity, island: stamp.island })}</p>

        <ul className="skt-cel-stats" aria-label={C.statsLabel}>
          <li>
            <b>{stats.linkVisits}</b>
            <span>{C.visits}</span>
          </li>
          <li>
            <b>{stats.friendsJoined}</b>
            <span>{C.joined}</span>
          </li>
          <li>
            <b>{stats.donationsGenerated.donors}</b>
            <span>{C.gave}</span>
          </li>
        </ul>
        <p className="skt-cel-stats-note">{C.statsLabel}</p>

        <div className="skt-cel-actions">
          <SkButton variant="primary" block className="skt-go" onClick={onShare}>
            <IconShare size={19} />
            {C.cta}
          </SkButton>
          <SkButton variant="ghost" block href={laterHref}>
            {C.later}
          </SkButton>
        </div>
        <p className="sk-note skt-cel-promise">{C.promise}</p>
      </motion.div>
    </section>
  );
}
