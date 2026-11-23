"use client";

/**
 * The island card's content, shared by the bottom sheet (phone) and the side panel (desktop).
 *
 * Sections follow the client's order: description and photos, tourism impact, endangered
 * species, water quality and reef, conservation projects, partners offering stamps. Everything
 * is sample content and says so (PUB-7); thresholds are labelled as examples and nothing here
 * takes a donation.
 */
import Link from "next/link";
import { createContext, memo, useCallback, useContext, useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from "react";
import { Photo, type PhotoProps } from "@/components/options-ui";
import {
  FEATURED_ISLAND_ID,
  getIsland,
  hasPhoto,
  islandStrings,
  photoAspect,
  photoAsset,
  isLive,
  type ComingSoonIsland,
  type GlobeIsland,
  type IslandPhoto,
  type LiveIsland,
  type Metric,
  type StampPartner,
} from "@/lib/islands";
import { t } from "@/lib/strings";
import { HERO_SIZES, lowSource } from "./photos";
import { aStrings } from "./strings";
import { Bar, IucnBadge, Ring, Seen, StampMark, TrendMark } from "./viz";

/** Where the lead photo is anchored when its frame crops it. */
const HERO_POSITION = "50% 60%";

export type CardView = "map" | "photos";

type SectionId = "about" | "tourism" | "species" | "reef" | "projects" | "partners";
const SECTION_IDS: SectionId[] = ["about", "tourism", "species", "reef", "projects", "partners"];

/** Hero first, then the gallery, without repeating a picture. */
export function galleryOf(island: LiveIsland): IslandPhoto[] {
  const seen = new Set<string>();
  return [island.card.hero, ...island.card.photos].filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true)));
}

export function placeOf(island: GlobeIsland): string {
  return island.region === island.country ? island.country : t(aStrings.card.region, { region: island.region, country: island.country });
}

/* ------------------------------------------------------------------ head */

export interface CardHeadProps {
  island: GlobeIsland;
  headingId: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  view: CardView;
  onView(view: CardView): void;
  onClose(): void;
  /** The camera is still on its way: show the travelling line instead of the status. */
  flying: boolean;
  /** The docked card (wide screens, layouts with the card along the bottom) can be made taller. */
  expanded?: boolean;
  onToggleExpanded?(): void;
}

/** Name, place, status, the Map | Photos toggle and the close button. Also the sheet's drag area. */
export function CardHead({ island, headingId, headingRef, view, onView, onClose, flying, expanded, onToggleExpanded }: CardHeadProps) {
  const live = isLive(island);
  return (
    <header className="da-head" data-drag="">
      <div className="da-head-row">
        <p className="da-status" data-status={island.status} data-flying={flying ? "" : undefined}>
          <span className="da-status-dot" aria-hidden="true" />
          {flying ? t(aStrings.flight.flying, { name: island.name }) : islandStrings.status[island.status]}
        </p>
        <div className="da-head-tools">
          {live ? (
            <div className="da-toggle" role="group" aria-label={islandStrings.card.view.label} data-view={view}>
              <span className="da-toggle-thumb" aria-hidden="true" />
              <button type="button" aria-pressed={view === "map"} onClick={() => onView("map")}>
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M1.8 4.2 6 2.6l4 1.6 4.2-1.6v9.2L10 13.4l-4-1.6-4.2 1.6zM6 2.6v9.2M10 4.2v9.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                {islandStrings.card.view.map}
              </button>
              <button type="button" aria-pressed={view === "photos"} onClick={() => onView("photos")}>
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <rect x="1.8" y="3" width="12.4" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="m2.4 11 3.4-3.4 2.6 2.6 1.8-1.8 3.4 3.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  <circle cx="10.4" cy="6.2" r="1" fill="currentColor" />
                </svg>
                {islandStrings.card.view.photos}
              </button>
            </div>
          ) : null}
          {onToggleExpanded ? (
            <button type="button" className="da-close da-grow" onClick={onToggleExpanded} aria-expanded={Boolean(expanded)} aria-label={expanded ? aStrings.card.collapse : aStrings.card.expand}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M4 9.800 8 5.800l4 4" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          <button type="button" className="da-close" onClick={onClose} aria-label={islandStrings.globe.reset}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <h2 id={headingId} ref={headingRef} className="da-name">
        {island.name}
      </h2>
      <p className="da-place">{placeOf(island)}</p>
    </header>
  );
}

/* ------------------------------------------------------------------ hero */

/**
 * The island's lead photo with three figures at a glance: the top of the card.
 *
 * Three layers, so the area is never empty. At the bottom the photo's own tint and blurred
 * preview, painted with the markup. Over it the sharp photo, which fades in when it has loaded.
 * On top the narrow rendition (.da-hero-lo, a few tens of KB that photos.ts fetches as soon as an
 * island is chosen): it is what the card lands with while the sharp photo is still on its way,
 * and it goes once the sharp one under it is opaque (atlas.css).
 */
export function CardHero({ island }: { island: LiveIsland }) {
  const { card } = island;
  const low = lowSource(card.hero.name);
  return (
    <div className="da-hero da-rise" data-empty={hasPhoto(card.hero.name) ? undefined : ""} style={{ "--i": 0 } as CSSProperties}>
      <Photo name={card.hero.name} alt={card.hero.alt} aspect="fill" sizes={HERO_SIZES} priority position={HERO_POSITION} />
      {low ? (
        // eslint-disable-next-line @next/next/no-img-element -- a pre-sized WebP from our own pipeline, shown under the same crop as the photo
        <img className="da-hero-lo" src={low} alt="" aria-hidden="true" decoding="async" fetchPriority="high" style={{ objectPosition: HERO_POSITION }} />
      ) : null}
      <ul className="da-glance" aria-label={aStrings.card.facts}>
        <li>
          <Ring value={card.reef.healthIndex.value} max={card.reef.healthIndex.max} size={18} stroke={3} label="" tone="light" />
          {t(aStrings.glance.reef, { value: card.reef.healthIndex.value })}
        </li>
        <li>{t(aStrings.glance.species, { n: card.species.length })}</li>
        <li>{t(aStrings.glance.stamps, { n: card.partners.length })}</li>
      </ul>
      <span className="da-hero-caption">{card.hero.caption}</span>
      <span className="da-hero-sample">{islandStrings.sample.photo}</span>
    </div>
  );
}

/* ------------------------------------------------- pictures in the body */

/**
 * The card's body is mounted during the flight, out of sight, and its pictures (the photo strip,
 * the wildlife and the projects) would start downloading then: half a dozen files racing the
 * card's lead photo and the map's tiles on a phone connection. They wait for the camera to land.
 * Until then each one is its own frame with the photo's tint and blurred preview, so nothing
 * moves when the picture arrives.
 */
const PicturesReady = createContext(true);

function BodyPhoto(props: PhotoProps) {
  const ready = useContext(PicturesReady);
  if (ready) return <Photo {...props} />;
  const asset = photoAsset(props.name);
  const fill = props.aspect === "fill";
  const frame: CSSProperties = {
    ...(fill ? null : { aspectRatio: String(props.aspect ?? photoAspect(props.name)) }),
    ...(asset ? { backgroundColor: asset.color, backgroundImage: `url(${asset.blur})` } : null),
    ...props.style,
  };
  return <span className={props.className ? `ipp ${props.className}` : "ipp"} data-fill={fill ? "" : undefined} aria-hidden="true" style={frame} />;
}

/* ------------------------------------------------------------- sections */

function Section({ id, title, kicker, children, index }: { id: string; title: string; kicker?: string; children: ReactNode; index: number }) {
  return (
    <Seen as="section" className="da-section" style={{ "--i": index } as CSSProperties}>
      <div id={id} className="da-section-anchor" data-section="" />
      <div className="da-section-head">
        <h3 className="da-section-title">{title}</h3>
        {kicker ? <span className="da-kicker">{kicker}</span> : null}
      </div>
      {children}
    </Seen>
  );
}

/** Small pictograms for the figures that are not a share of something. */
const PEOPLE = "M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM3.2 19c.5-3 2.8-4.8 5.8-4.8s5.3 1.8 5.8 4.8M15.8 5.3a3 3 0 0 1 0 5.6M17.6 14.6c1.800.6 3 2.100 3.300 4.400";
const BOAT = "M3.500 14.500h17l-2.200 4.300H5.700zM12 4v10.500M12 5.500l5.500 6.500H12M12 7.500 8 12h4";
const STAT_ICONS: Record<string, string> = {
  visitors: PEOPLE,
  "day-visitors": PEOPLE,
  residents: PEOPLE,
  boats: BOAT,
  stay: "M19.5 14.2A7.8 7.8 0 0 1 9.800 4.500a7.800 7.800 0 1 0 9.700 9.700ZM15.500 4.200v3.200M13.900 5.800h3.200",
  forest: "M12 20.500v-6M12 14.500c-3.600 0-6-2.300-6-5.300 0-3.100 2.700-5.700 6-5.700s6 2.600 6 5.700c0 3-2.400 5.300-6 5.300ZM12 11.500l2.400-2.300M12 13.200 9.800 11",
  default: "M4.500 19.500v-5M9.500 19.500v-9M14.500 19.500v-6.500M19.500 19.500v-12",
};

function StatTile({ metric }: { metric: Metric }) {
  const meter = metric.unit === "%" && metric.max ? metric : null;
  return (
    <li className="da-stat">
      <div className="da-stat-top">
        {meter ? (
          <Ring value={meter.value} max={meter.max} size={44} stroke={5} label={`${metric.label}: ${metric.display}`} />
        ) : (
          <span className="da-stat-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d={STAT_ICONS[metric.id] ?? STAT_ICONS.default} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {metric.trend ? <TrendMark trend={metric.trend} /> : null}
      </div>
      <p className="da-stat-value">{metric.display}</p>
      <p className="da-stat-label">{metric.label}</p>
      {metric.note ? <p className="da-stat-note">{metric.note}</p> : null}
    </li>
  );
}

function MetricRow({ metric }: { metric: Metric }) {
  return (
    <li className="da-metric">
      <div className="da-metric-line">
        <span className="da-metric-label">{metric.label}</span>
        <span className="da-metric-value">
          {metric.display}
          {metric.trend ? <TrendMark trend={metric.trend} /> : null}
        </span>
      </div>
      {metric.max ? <Bar value={metric.value} max={metric.max} /> : null}
      {metric.note ? <p className="da-metric-note">{metric.note}</p> : null}
    </li>
  );
}

function PartnerRow({ partner, index }: { partner: StampPartner; index: number }) {
  const { offer } = partner;
  return (
    <li className="da-partner" data-kind={offer.kind}>
      <Link className="da-partner-link" href="/passport" aria-label={t(aStrings.card.collectFrom, { title: offer.title, name: partner.name })}>
        <StampMark offer={offer} index={index} />
        <span className="da-partner-text">
          <span className="da-partner-type">{islandStrings.partnerType[partner.type]}</span>
          <span className="da-partner-name">{partner.name}</span>
          <span className="da-partner-offer">
            {offer.title} · {t(islandStrings.card.supports, { charity: offer.charity })}
          </span>
        </span>
        <span className="da-partner-price">
          <span className="da-partner-amount">{offer.threshold.display}</span>
          <span className="da-partner-eg">{aStrings.card.example}</span>
        </span>
      </Link>
    </li>
  );
}

/* ----------------------------------------------------------------- body */

export interface CardBodyProps {
  island: LiveIsland;
  /** The scrolling element, for the section tabs. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  onOpenPhoto(index: number): void;
  /** The card can scroll (full sheet, side panel). Otherwise a tab first asks for it to open. */
  expanded: boolean;
  onExpand(): void;
  /** The camera has landed: the body's pictures may load (see `BodyPhoto`). */
  pictures: boolean;
}

export const CardBody = memo(function CardBody({ island, scrollerRef, onOpenPhoto, expanded, onExpand, pictures }: CardBodyProps) {
  const { card } = island;
  const uid = useId();
  const sectionId = (id: SectionId) => `${uid}-${id}`;
  const [active, setActive] = useState<SectionId>("about");
  const gallery = galleryOf(island);
  const stamps = card.partners.filter((p) => p.offer.kind === "stamp");
  const seals = card.partners.filter((p) => p.offer.kind !== "stamp");

  // Scroll spy: the tab of the section nearest the top of the card is the current one.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scroller.getBoundingClientRect().top + 96;
      let current: SectionId = "about";
      for (const id of SECTION_IDS) {
        const el = document.getElementById(`${uid}-${id}`);
        if (el && el.getBoundingClientRect().top <= top) current = id;
      }
      // At the very end the last section may never reach the top: it still counts as current.
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4 && scroller.scrollTop > 0) current = "partners";
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scrollerRef, uid, island.id]);

  const scrollToSection = useCallback(
    (id: SectionId) => {
      const scroller = scrollerRef.current;
      const el = document.getElementById(`${uid}-${id}`);
      if (!scroller || !el) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const y = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 58;
      scroller.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
    },
    [scrollerRef, uid],
  );

  // A tab tapped while the sheet is half open: open the sheet first, then go to the section.
  const pending = useRef(0);
  useEffect(() => () => window.clearTimeout(pending.current), []);
  const go = useCallback(
    (id: SectionId) => {
      window.clearTimeout(pending.current);
      if (expanded) {
        scrollToSection(id);
        return;
      }
      onExpand();
      setActive(id);
      pending.current = window.setTimeout(() => scrollToSection(id), 460);
    },
    [expanded, onExpand, scrollToSection],
  );

  // Keep the current tab in view in its own scrolling row.
  const navRef = useRef<HTMLDivElement>(null);
  const navActive = useRef(active);
  useEffect(() => {
    // Not on mount: reading the layout of a card that was just inserted would force it early.
    if (navActive.current === active) return;
    navActive.current = active;
    const nav = navRef.current;
    const tab = nav?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!nav || !tab) return;
    const left = tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  // Once this island's pictures have been let in they stay (the card closing must not swap them
  // back for their placeholders on its way out).
  const [picturesFor, setPicturesFor] = useState<string | null>(pictures ? island.id : null);
  if (pictures && picturesFor !== island.id) setPicturesFor(island.id);

  return (
    <PicturesReady.Provider value={picturesFor === island.id}>
      <div className="da-body">
        <nav className="da-tabs" aria-label={aStrings.card.navLabel}>
          <div className="da-tabs-row" ref={navRef} data-hscroll="">
            {SECTION_IDS.map((id) => (
              <button key={id} type="button" className="da-tab" data-tab={id} aria-current={active === id ? "true" : undefined} onClick={() => go(id)}>
                {aStrings.card.nav[id]}
              </button>
            ))}
          </div>
        </nav>

        {/* 1. Description and photos */}
        <Section id={sectionId("about")} title={islandStrings.card.sections.about} index={0}>
          <p className="da-lede">{card.description.headline}</p>
          {card.description.body.map((paragraph, i) => (
            <p key={i} className="da-copy">
              {paragraph}
            </p>
          ))}
          <dl className="da-facts" aria-label={aStrings.card.facts}>
            {card.description.facts.map((fact) => (
              <div key={fact.label} className="da-fact">
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="da-strip" data-hscroll="" aria-label={aStrings.card.gallery}>
            {gallery.map((photo, i) => (
              <li key={photo.name}>
                <button type="button" className="da-strip-item" onClick={() => onOpenPhoto(i)} aria-label={t(aStrings.card.openPhoto, { caption: photo.caption })}>
                  <BodyPhoto name={photo.name} alt="" aspect={4 / 3} sizes="160px" />
                  <span className="da-strip-caption">{photo.caption}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {/* 2. Tourism impact */}
        <Section id={sectionId("tourism")} title={islandStrings.card.sections.tourism} kicker={islandStrings.sample.data} index={1}>
          <p className="da-copy">{card.tourism.summary}</p>
          <ul className="da-stats">
            {card.tourism.stats.map((metric) => (
              <StatTile key={metric.id} metric={metric} />
            ))}
          </ul>
          <div className="da-duo">
            <div className="da-list" data-tone="sun">
              <h4>{aStrings.card.pressures}</h4>
              <ul>
                {card.tourism.pressures.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="da-list" data-tone="sea">
              <h4>{aStrings.card.tips}</h4>
              <ul>
                {card.tourism.tips.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* 3. Endangered species */}
        <Section id={sectionId("species")} title={islandStrings.card.sections.species} index={2}>
          <ul className="da-species" data-hscroll="">
            {card.species.map((species) => (
              <li key={species.id} className="da-creature">
                <div className="da-creature-art">
                  {species.photo ? (
                    <BodyPhoto name={species.photo} alt="" aspect="fill" sizes="220px" />
                  ) : (
                    <span className="da-creature-blank" aria-hidden="true" />
                  )}
                  <span className="da-creature-code" data-iucn={species.iucn} aria-hidden="true">
                    {species.iucn}
                  </span>
                </div>
                <div className="da-creature-text">
                  <p className="da-creature-name">{species.name}</p>
                  <p className="da-creature-sci">{species.scientific}</p>
                  <IucnBadge status={species.iucn} />
                  <p className="da-creature-note">{species.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* 4. Water quality and reef */}
        <Section id={sectionId("reef")} title={islandStrings.card.sections.reef} kicker={t(islandStrings.card.reefUpdated, { date: card.reef.updated })} index={3}>
          <div className="da-reef">
            <Ring value={card.reef.healthIndex.value} max={card.reef.healthIndex.max} size={124} stroke={10} label={`${islandStrings.card.reefIndex}: ${card.reef.healthIndex.value} / ${card.reef.healthIndex.max}`}>
              <span className="da-reef-score">{card.reef.healthIndex.value}</span>
              <span className="da-reef-max">/ {card.reef.healthIndex.max}</span>
            </Ring>
            <div className="da-reef-text">
              <p className="da-reef-kicker">{islandStrings.card.reefIndex}</p>
              <p className="da-reef-label">{card.reef.healthIndex.label}</p>
              <p className="da-reef-trend">
                <TrendMark trend={card.reef.healthIndex.trend} />
                {islandStrings.trend[card.reef.healthIndex.trend]}
              </p>
            </div>
          </div>
          <p className="da-copy">{card.reef.summary}</p>
          <ul className="da-metrics">
            {card.reef.metrics.map((metric) => (
              <MetricRow key={metric.id} metric={metric} />
            ))}
          </ul>
          <p className="da-fine">{islandStrings.sample.figures}</p>
        </Section>

        {/* 5. Conservation projects */}
        <Section id={sectionId("projects")} title={islandStrings.card.sections.projects} index={4}>
          <ul className="da-projects">
            {card.projects.map((project) => (
              <li key={project.id} className="da-project">
                {project.photo ? (
                  <div className="da-project-photo">
                    <BodyPhoto name={project.photo} alt="" aspect="fill" sizes="96px" />
                  </div>
                ) : null}
                <div className="da-project-text">
                  <p className="da-project-title">{project.title}</p>
                  <p className="da-project-org">{t(islandStrings.card.by, { organisation: project.organisation })}</p>
                  <p className="da-project-summary">{project.summary}</p>
                  {project.progress ? (
                    <div className="da-progress">
                      <Bar value={project.progress.value} max={project.progress.target} />
                      <p className="da-progress-text">{project.progress.display}</p>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* 6. Charities and other partners offering stamps */}
        <Section id={sectionId("partners")} title={islandStrings.card.sections.partners} index={5}>
          <p className="da-copy">{islandStrings.card.partnersIntro}</p>
          <div className="da-ladder">
            <p className="da-ladder-title">{aStrings.card.ladderTitle}</p>
            <p className="da-ladder-body">{aStrings.card.ladderBody}</p>
            <ol className="da-ladder-steps">
              {(["stamp", "tourism-seal", "government-seal"] as const).map((kind, i) => {
                const sample = card.partners.find((p) => p.offer.kind === kind);
                if (!sample) return null;
                return (
                  <li key={kind} data-kind={kind} style={{ "--step": i } as CSSProperties}>
                    <span className="da-ladder-amount">{sample.offer.threshold.display}</span>
                    <span className="da-ladder-kind">{islandStrings.offerKind[kind]}</span>
                  </li>
                );
              })}
            </ol>
            <p className="da-fine">{islandStrings.sample.thresholds}</p>
          </div>

          <h4 className="da-subhead">{aStrings.card.stamps}</h4>
          <ul className="da-partners">
            {stamps.map((partner, i) => (
              <PartnerRow key={partner.id} partner={partner} index={i} />
            ))}
          </ul>
          {seals.length ? (
            <>
              <h4 className="da-subhead">{aStrings.card.seals}</h4>
              <ul className="da-partners">
                {seals.map((partner, i) => (
                  <PartnerRow key={partner.id} partner={partner} index={i + stamps.length} />
                ))}
              </ul>
            </>
          ) : null}

          <p className="da-assure">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M10 2.2 3.6 4.6v4.7c0 4 2.7 7.2 6.4 8.5 3.700-1.3 6.4-4.5 6.4-8.5V4.600z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="m7.200 10 2 2 3.600-3.900" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              {islandStrings.sample.donationPlatform} {islandStrings.sample.noDonations}
            </span>
          </p>
        </Section>

        <footer className="da-foot">
          <p>{islandStrings.sample.notice}</p>
          <Link href="/passport" className="da-foot-link">
            {aStrings.card.passportLink}
          </Link>
        </footer>
      </div>
    </PicturesReady.Provider>
  );
});

/* ---------------------------------------------------------- coming soon */

export function SoonBody({ island, onOpenIsland }: { island: ComingSoonIsland; onOpenIsland(id: string): void }) {
  const [done, setDone] = useState(false);
  const inputId = useId();
  const featured = getIsland(FEATURED_ISLAND_ID);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // A design demo: nothing is sent or stored.
    setDone(true);
  };
  return (
    <div className="da-soon">
      <p className="da-lede da-rise" style={{ "--i": 0 } as CSSProperties}>
        {island.tagline}
      </p>
      <p className="da-copy da-rise" style={{ "--i": 1 } as CSSProperties}>
        {island.teaser}
      </p>
      <div className="da-rise" style={{ "--i": 2 } as CSSProperties}>
        {done ? (
          <p className="da-soon-done" role="status">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="m6.500 10.200 2.400 2.400 4.600-4.900" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {aStrings.soon.done}
          </p>
        ) : (
          <form className="da-notify" onSubmit={submit}>
            <label className="da-sr" htmlFor={inputId}>
              {aStrings.soon.emailLabel}
            </label>
            <input id={inputId} type="email" inputMode="email" autoComplete="email" required placeholder={aStrings.soon.emailPlaceholder} />
            <button type="submit">{aStrings.soon.notify}</button>
          </form>
        )}
      </div>
      {featured ? (
        <button type="button" className="da-soon-explore da-rise" style={{ "--i": 3 } as CSSProperties} onClick={() => onOpenIsland(featured.id)}>
          <span className="da-soon-explore-dot" aria-hidden="true" />
          {t(aStrings.soon.explore, { name: featured.name })}
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 8h9M8.500 4.500 12 8l-3.500 3.500" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ CTA */

export function CardActions({ onShare, copied }: { onShare(): void; copied: boolean }) {
  return (
    <div className="da-actions">
      <Link className="da-cta" href="/passport">
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="10" cy="10" r="7.300" fill="none" stroke="currentColor" strokeWidth="1.500" strokeDasharray="2.200 1.800" />
          <path d="m7 10.200 2.100 2.100L13.200 8" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {islandStrings.card.cta.collect}
      </Link>
      <button type="button" className="da-share" onClick={onShare} data-copied={copied ? "" : undefined} aria-label={islandStrings.card.cta.share}>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M10 12.500V3.200M6.600 6.300 10 2.900l3.400 3.400M4.200 10.400v4.800c0 .9.700 1.600 1.600 1.600h8.400c.9 0 1.600-.7 1.600-1.600v-4.800" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{copied ? aStrings.share.copied : islandStrings.card.cta.share}</span>
      </button>
    </div>
  );
}
