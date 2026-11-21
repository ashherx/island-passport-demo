"use client";

/**
 * Option C: the body of the island card, in the client's section order.
 *
 *   01 About the island (description, photographs, facts)
 *   02 Tourism impact
 *   03 Endangered species
 *   04 Water quality and reef
 *   05 Conservation projects
 *   06 Collect a stamp here (charities and partners, with example thresholds)
 *
 * Laid out like a magazine data page: numbered section heads over a rule, big tabular figures
 * that count up when they scroll into view, hairline meters, and short lines of text instead of
 * paragraphs wherever the data allows.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Photo } from "@/components/options-ui";
import { LIVE_ISLANDS, islandStrings, type ComingSoonIsland, type IslandPhoto, type IucnStatus, type LiveIsland, type Metric, type StampPartner } from "@/lib/islands";
import { t } from "@/lib/strings";
import { cStrings } from "./strings";
import { ArrowIcon, Count, Glyph, Meter, Trend, pad2 } from "./ui";

export const SECTION_IDS = ["about", "tourism", "species", "reef", "projects", "partners"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Hero first, then the gallery, without repeats. */
export function photosOf(island: LiveIsland): IslandPhoto[] {
  const seen = new Set<string>();
  return [island.card.hero, ...island.card.photos].filter((photo) => (seen.has(photo.name) ? false : (seen.add(photo.name), true)));
}

/** "300 a day" -> ["300", "a day"]; "1.2M" -> ["1.2M", ""]; "About 800" -> ["800", "about"]. */
export function splitFigure(display: string): { figure: string; unit: string } {
  const match = /^(\D*?)(\d[\d,.]*\s?(?:[KM%]|°C)?)(?![a-z])\s*(.*)$/i.exec(display);
  if (!match) return { figure: display, unit: "" };
  const [, before, figure, after] = match;
  return { figure: figure.trim(), unit: [before.trim().toLowerCase(), after.trim()].filter(Boolean).join(" ") };
}

function SectionHead({ id, title, aside }: { id: SectionId; title: string; aside?: ReactNode }) {
  return (
    <header className="oc-sec-head">
      <span className="oc-sec-no" aria-hidden="true">
        {pad2(SECTION_IDS.indexOf(id) + 1)}
      </span>
      <h3 className="oc-sec-title" id={`oc-sec-${id}`}>
        {title}
      </h3>
      {aside ? <span className="oc-sec-aside">{aside}</span> : null}
    </header>
  );
}

const SampleTag = ({ children = islandStrings.sample.data }: { children?: ReactNode }) => <span className="oc-tag">{children}</span>;

/* ------------------------------------------------------------------ parts */

function StatCell({ metric, index }: { metric: Metric; index: number }) {
  const { figure, unit } = splitFigure(metric.display);
  return (
    <div className="oc-stat">
      <dt className="oc-stat-label">
        {metric.label}
        {unit ? <span className="oc-stat-unit"> ({unit})</span> : null}
      </dt>
      <dd className="oc-stat-value">
        <Count className="oc-figure" display={figure} delay={index * 70} />
        {metric.trend ? <Trend trend={metric.trend} /> : null}
      </dd>
      {typeof metric.max === "number" ? <Meter value={metric.value} max={metric.max} /> : null}
      {metric.note ? <dd className="oc-stat-note">{metric.note}</dd> : null}
    </div>
  );
}

const IUCN_ORDER: IucnStatus[] = ["LC", "NT", "VU", "EN", "CR"];

function RedList({ status }: { status: IucnStatus }) {
  const level = IUCN_ORDER.indexOf(status);
  return (
    <div className="oc-iucn" data-status={status} title={islandStrings.iucnSource}>
      <span className="oc-iucn-code" aria-hidden="true">
        {status}
      </span>
      <span className="oc-iucn-scale" aria-hidden="true">
        {IUCN_ORDER.map((code, i) => (
          <span key={code} data-on={i <= level ? "" : undefined} data-at={i === level ? "" : undefined} />
        ))}
      </span>
      <span className="oc-iucn-name">{islandStrings.iucn[status]}</span>
    </div>
  );
}

function StampToken({ partner }: { partner: StampPartner }) {
  return (
    <span className="oc-token" data-shape={partner.offer.shape} data-kind={partner.offer.kind} aria-hidden="true">
      <Glyph art={partner.offer.art} />
    </span>
  );
}

/* --------------------------------------------------------------- sections */

export interface LiveBodyProps {
  island: LiveIsland;
  /** Open the photo view at a photo. */
  onPhoto(index: number): void;
}

export function LiveBody({ island, onPhoto }: LiveBodyProps) {
  const { card } = island;
  const s = islandStrings.card;
  const photos = photosOf(island);

  return (
    <>
      {/* 01 */}
      <section className="oc-sec" data-section="about" aria-labelledby="oc-sec-about">
        <SectionHead id="about" title={s.sections.about} />
        <p className="oc-lead">{card.description.headline}</p>
        {card.description.body.map((paragraph) => (
          <p key={paragraph} className="oc-body">
            {paragraph}
          </p>
        ))}

        <h4 className="oc-sub">
          {cStrings.card.photos}
          <span className="oc-sub-count">{pad2(photos.length)}</span>
        </h4>
        <ul className="oc-strip">
          {photos.map((photo, i) => (
            <li key={photo.name} className="oc-strip-item">
              <button type="button" className="oc-strip-button" onClick={() => onPhoto(i)} aria-label={t(cStrings.card.photoOpen, { n: i + 1, caption: photo.caption })}>
                <Photo name={photo.name} alt="" aspect={4 / 3} sizes="(min-width: 900px) 260px, 62vw" priority={i === 0} />
                <span className="oc-strip-caption">
                  <span className="oc-strip-no">{pad2(i + 1)}</span>
                  {photo.caption}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <h4 className="oc-sub">{cStrings.card.facts}</h4>
        <dl className="oc-facts">
          {card.description.facts.map((fact) => (
            <div key={fact.label} className="oc-fact">
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 02 */}
      <section className="oc-sec" data-section="tourism" aria-labelledby="oc-sec-tourism">
        <SectionHead id="tourism" title={s.sections.tourism} aside={<SampleTag />} />
        <p className="oc-body oc-body-first">{card.tourism.summary}</p>
        <dl className="oc-stats">
          {card.tourism.stats.map((metric, i) => (
            <StatCell key={metric.id} metric={metric} index={i} />
          ))}
        </dl>
        <div className="oc-lists">
          <div>
            <h4 className="oc-sub">{cStrings.card.pressures}</h4>
            <ol className="oc-list" data-kind="pressure">
              {card.tourism.pressures.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="oc-sub">{cStrings.card.tips}</h4>
            <ol className="oc-list" data-kind="tip">
              {card.tourism.tips.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 03 */}
      <section className="oc-sec" data-section="species" aria-labelledby="oc-sec-species">
        <SectionHead id="species" title={s.sections.species} aside={<span className="oc-sec-count">{pad2(card.species.length)}</span>} />
        <ul className="oc-species">
          {card.species.map((species) => (
            <li key={species.id} className="oc-species-row">
              <span className="oc-species-art">{species.art ? <Glyph art={species.art} /> : null}</span>
              <div className="oc-species-text">
                <p className="oc-species-name">{species.name}</p>
                <p className="oc-species-latin">{species.scientific}</p>
                <p className="oc-species-note">{species.note}</p>
              </div>
              <RedList status={species.iucn} />
            </li>
          ))}
        </ul>
        <p className="oc-foot">{islandStrings.iucnSource}</p>
      </section>

      {/* 04 */}
      <section className="oc-sec" data-section="reef" aria-labelledby="oc-sec-reef">
        <SectionHead id="reef" title={s.sections.reef} aside={<SampleTag>{t(s.reefUpdated, { date: card.reef.updated })}</SampleTag>} />
        <div className="oc-reef">
          <p className="oc-reef-label">{s.reefIndex}</p>
          <p className="oc-reef-score">
            <Count className="oc-figure oc-figure-xl" display={String(card.reef.healthIndex.value)} duration={1100} />
            <span className="oc-reef-of">{cStrings.card.stats.reefOf}</span>
          </p>
          <p className="oc-reef-state">
            {card.reef.healthIndex.label}
            <Trend trend={card.reef.healthIndex.trend} />
          </p>
          <div className="oc-scale" aria-hidden="true">
            <span className="oc-scale-fill" style={{ width: `${card.reef.healthIndex.value}%` }} />
            <span className="oc-scale-mark" style={{ left: `${card.reef.healthIndex.value}%` }} />
            <span className="oc-scale-ticks">
              {[0, 25, 50, 75, 100].map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </span>
          </div>
        </div>
        <p className="oc-body">{card.reef.summary}</p>
        <dl className="oc-table">
          {card.reef.metrics.map((metric) => (
            <div key={metric.id} className="oc-row">
              <dt className="oc-row-label">
                {metric.label}
                {metric.note ? <span className="oc-row-note">{metric.note}</span> : null}
              </dt>
              <dd className="oc-row-meter">{typeof metric.max === "number" ? <Meter value={metric.value} max={metric.max} /> : null}</dd>
              <dd className="oc-row-value">
                <Count display={metric.display} />
                {metric.trend ? <Trend trend={metric.trend} label={false} /> : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 05 */}
      <section className="oc-sec" data-section="projects" aria-labelledby="oc-sec-projects">
        <SectionHead id="projects" title={s.sections.projects} aside={<span className="oc-sec-count">{pad2(card.projects.length)}</span>} />
        <ul className="oc-projects">
          {card.projects.map((project) => {
            const percent = project.progress ? Math.round((project.progress.value / project.progress.target) * 100) : null;
            return (
              <li key={project.id} className="oc-project">
                <div className="oc-project-text">
                  <p className="oc-project-title">{project.title}</p>
                  <p className="oc-project-by">{t(s.by, { organisation: project.organisation })}</p>
                  <p className="oc-project-summary">{project.summary}</p>
                </div>
                {project.progress && percent !== null ? (
                  <div className="oc-progress">
                    <p className="oc-progress-figure">
                      <Count className="oc-figure" display={`${percent}%`} />
                    </p>
                    <Meter value={project.progress.value} max={project.progress.target} className="oc-meter-bold" />
                    <p className="oc-progress-text">{project.progress.display}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 06 */}
      <section className="oc-sec" data-section="partners" aria-labelledby="oc-sec-partners">
        <SectionHead id="partners" title={s.sections.partners} aside={<span className="oc-sec-count">{pad2(card.partners.length)}</span>} />
        <p className="oc-body oc-body-first">{s.partnersIntro}</p>
        <ul className="oc-partners">
          {card.partners.map((partner) => (
            <li key={partner.id}>
              <Link className="oc-partner" href="/passport" aria-label={`${t(cStrings.card.collectFrom, { title: partner.offer.title })}, ${partner.name}, ${t(s.from, { amount: partner.offer.threshold.display })}`}>
                <StampToken partner={partner} />
                <span className="oc-partner-text">
                  <span className="oc-partner-kind">
                    {islandStrings.partnerType[partner.type]}
                    {partner.offer.kind !== "stamp" ? <span className="oc-partner-seal">{islandStrings.offerKind[partner.offer.kind]}</span> : null}
                  </span>
                  <span className="oc-partner-title">{partner.offer.title}</span>
                  <span className="oc-partner-name">
                    {partner.name}
                    {partner.handle ? <span> · {partner.handle}</span> : null}
                  </span>
                  <span className="oc-partner-purpose">
                    {t(s.supports, { charity: partner.offer.charity })}. {partner.offer.purpose}
                  </span>
                </span>
                <span className="oc-partner-price">
                  <span className="oc-partner-from">{cStrings.card.exampleFrom}</span>
                  <span className="oc-figure oc-figure-sm">{partner.offer.threshold.display}</span>
                  <span className="oc-partner-go">
                    <ArrowIcon />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="oc-notes">
          <p>
            <strong>{cStrings.card.example}.</strong> {islandStrings.sample.thresholds}
          </p>
          <p>{islandStrings.sample.donationPlatform}</p>
        </div>
      </section>

      <footer className="oc-card-foot">
        <p>{islandStrings.sample.notice}</p>
        <Link className="oc-text-link" href="/passport">
          {s.cta.passport}
          <ArrowIcon direction="up-right" />
        </Link>
      </footer>
    </>
  );
}

/* ------------------------------------------------------------ coming soon */

export interface SoonBodyProps {
  island: ComingSoonIsland;
  notified: boolean;
  onNotify(): void;
  onOpenIsland(id: string): void;
}

export function SoonBody({ island, notified, onNotify, onOpenIsland }: SoonBodyProps) {
  return (
    <div className="oc-soon">
      <p className="oc-lead">{island.teaser}</p>
      <p className="oc-body">{cStrings.soon.body}</p>
      <button type="button" className="oc-button oc-button-ink" onClick={onNotify} aria-pressed={notified} data-done={notified ? "" : undefined}>
        {notified ? (
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
          </svg>
        ) : null}
        {notified ? cStrings.soon.notified : cStrings.soon.notify}
      </button>
      <p className="oc-foot" role="status">
        {notified ? cStrings.soon.notifiedNote : islandStrings.sample.notice}
      </p>

      <h4 className="oc-sub">{cStrings.soon.meanwhile}</h4>
      <ul className="oc-jump">
        {LIVE_ISLANDS.map((live, i) => (
          <li key={live.id}>
            <button type="button" className="oc-jump-item" onClick={() => onOpenIsland(live.id)}>
              <span className="oc-jump-no">{pad2(i + 1)}</span>
              <span className="oc-jump-name">{live.name}</span>
              <span className="oc-jump-meta">{live.tagline}</span>
              <ArrowIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
