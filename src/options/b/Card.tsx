"use client";

/**
 * Option B island card: what is written on the postcard.
 *
 * `CardHead` is the top of every card (status stamp, name, place, the Map | Photos toggle).
 * `LiveCard` is the body for a participating island, with the client's sections in his order:
 * about and photos, tourism impact, endangered species, water quality and reef, conservation
 * projects, and the partners offering stamps. `SoonCard` is the lighter body for an island that
 * is not open yet. `CardActions` is the row of buttons pinned to the bottom of the card.
 *
 * Everything here is sample content and says so (PUB-7); amounts are examples, and nothing
 * suggests that money moves in the demo.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Photo } from "@/components/options-ui";
import {
  LIVE_ISLANDS,
  islandStrings,
  isLive,
  type ComingSoonIsland,
  type GlobeIsland,
  type IslandPhoto,
  type LiveIsland,
  type Metric,
  type StampPartner,
} from "@/lib/islands";
import { t } from "@/lib/strings";
import {
  IconBell,
  IconCheck,
  IconChevron,
  IconHeart,
  IconMap,
  IconPhotos,
  IconShare,
  IconWave,
  IucnBadge,
  StampMark,
  Tape,
  TrendChip,
} from "./bits";
import { bStrings } from "./strings";

export type CardView = "map" | "photos";

const S = islandStrings.card;

/** Hero first, then the gallery, without repeating a picture. */
export function photosOf(island: LiveIsland): IslandPhoto[] {
  const seen = new Set<string>();
  return [island.card.hero, ...island.card.photos].filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true)));
}

const placeOf = (island: GlobeIsland) => (island.region === island.country ? island.country : `${island.region}, ${island.country}`);

/* ------------------------------------------------------------------ head */

export interface CardHeadProps {
  island: GlobeIsland;
  headingId: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  view: CardView;
  onView(view: CardView): void;
}

export function CardHead({ island, headingId, headingRef, view, onView }: CardHeadProps) {
  const live = isLive(island);
  const offer = live ? island.card.partners[0]?.offer : null;

  const onToggleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = view === "map" ? "photos" : "map";
    onView(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-view="${next}"]`)?.focus();
  };

  return (
    <header className="ob-head" data-status={island.status}>
      <p className="ob-status" data-status={island.status}>
        <span>{islandStrings.status[island.status]}</span>
      </p>
      <h1 className="ob-name" id={headingId} ref={headingRef} tabIndex={-1}>
        {island.name}
      </h1>
      <p className="ob-place">
        <span className="ob-cc" aria-hidden="true">
          {island.countryCode}
        </span>
        {placeOf(island)}
      </p>
      <p className="ob-tagline">{island.tagline}</p>

      {offer ? (
        <StampMark className="ob-head-stamp" art={offer.art} shape={offer.shape} size={84} tilt={9} />
      ) : (
        <span className="ob-head-slot" aria-hidden="true">
          <span>{bStrings.soon.slot}</span>
        </span>
      )}

      {live ? (
        <div className="ob-view" role="radiogroup" aria-label={S.view.label} data-view={view} onKeyDown={onToggleKey}>
          <span className="ob-view-thumb" aria-hidden="true" />
          {(["map", "photos"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              className="ob-view-item"
              data-view={v}
              aria-checked={view === v}
              tabIndex={view === v ? 0 : -1}
              onClick={() => onView(v)}
            >
              {v === "map" ? <IconMap size={17} /> : <IconPhotos size={17} />}
              {S.view[v]}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------------ helpers */

/** True once the element has been on screen, so figures can draw themselves in. */
function useSeen<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver !== "function") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen]);
  return [ref, seen];
}

const share = (m: Pick<Metric, "value" | "max">) => (m.max ? Math.max(0, Math.min(1, m.value / m.max)) : null);

function Section({ id, title, kicker, children }: { id: string; title: string; kicker?: ReactNode; children: ReactNode }) {
  return (
    <section className="ob-sec" id={`ob-sec-${id}`} data-sec={id} aria-labelledby={`ob-sec-${id}-title`}>
      <div className="ob-sec-top">
        <h2 className="ob-sec-title" id={`ob-sec-${id}-title`}>
          {title}
        </h2>
        {kicker}
      </div>
      {children}
    </section>
  );
}

const SampleTag = ({ children = islandStrings.sample.data }: { children?: ReactNode }) => <span className="ob-sampletag">{children}</span>;

/* ------------------------------------------------------------------ sections */

function About({ island, onOpenPhoto }: { island: LiveIsland; onOpenPhoto(index: number): void }) {
  const { description } = island.card;
  const photos = photosOf(island);
  return (
    <Section id="about" title={S.sections.about}>
      <p className="ob-lede">{description.headline}</p>
      {description.body.map((p) => (
        <p className="ob-body" key={p.slice(0, 24)}>
          {p}
        </p>
      ))}

      <h3 className="ob-sub">{bStrings.about.photos}</h3>
      <ul className="ob-strip" aria-label={bStrings.about.photos}>
        {photos.map((p, i) => (
          <li key={p.name} className="ob-strip-item" style={{ ["--ob-r" as string]: `${[-2.4, 1.8, -1.2, 2.6, -1.8, 1.2, -2][i % 7]}deg` }}>
            <button type="button" className="ob-polaroid" onClick={() => onOpenPhoto(i)} aria-label={t(bStrings.about.openPhoto, { n: i + 1, caption: p.caption })}>
              {i % 3 === 0 ? <Tape tone={i % 2 ? "mint" : "sun"} className="ob-polaroid-tape" /> : null}
              <Photo name={p.name} alt="" aspect={1} sizes="140px" className="ob-polaroid-photo" />
              <span className="ob-polaroid-cap">{p.caption}</span>
            </button>
          </li>
        ))}
      </ul>

      <dl className="ob-facts">
        {description.facts.map((f) => (
          <div className="ob-fact" key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Tourism({ island }: { island: LiveIsland }) {
  const { tourism } = island.card;
  return (
    <Section id="tourism" title={S.sections.tourism} kicker={<SampleTag />}>
      <p className="ob-body">{tourism.summary}</p>
      <ul className="ob-stats">
        {tourism.stats.map((m, i) => (
          <li className="ob-stat" key={m.id} data-tone={["sun", "lagoon", "blush", "sage"][i % 4]}>
            <span className="ob-stat-value">{m.display}</span>
            <span className="ob-stat-label">{m.label}</span>
            {m.trend ? <TrendChip trend={m.trend} /> : null}
            {m.note ? <span className="ob-stat-note">{m.note}</span> : null}
          </li>
        ))}
      </ul>
      <div className="ob-twolists">
        <div className="ob-list" data-kind="pressures">
          <h3 className="ob-sub">
            <IconWave size={18} />
            {bStrings.tourism.pressures}
          </h3>
          <ul>
            {tourism.pressures.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="ob-list ob-note" data-kind="tips">
          <Tape tone="mint" className="ob-note-tape" />
          <h3 className="ob-sub">
            <IconHeart size={18} />
            {bStrings.tourism.tips}
          </h3>
          <ul>
            {tourism.tips.map((p) => (
              <li key={p}>
                <IconCheck size={16} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function SpeciesList({ island }: { island: LiveIsland }) {
  const { species } = island.card;
  return (
    <Section id="species" title={S.sections.species} kicker={species.length > 1 ? <span className="ob-kicker">{bStrings.species.swipe}</span> : null}>
      {/* A scrollable list has to be reachable by keyboard, hence the tabIndex. */}
      <ul className="ob-species" tabIndex={0} aria-label={S.sections.species}>
        {species.map((s, i) => (
          <li className="ob-animal" key={s.id} data-tone={["lagoon", "sun", "blush", "sage"][i % 4]}>
            <div className="ob-animal-art">
              {s.art ? <StampMark art={s.art} shape="circle" tone="ink" size={92} tilt={[-5, 4, -3, 6][i % 4]} /> : null}
            </div>
            <IucnBadge status={s.iucn} name={islandStrings.iucn[s.iucn]} />
            <h3 className="ob-animal-name">{s.name}</h3>
            <p className="ob-animal-sci">{s.scientific}</p>
            <p className="ob-animal-note">{s.note}</p>
          </li>
        ))}
      </ul>
      <p className="ob-fine">{islandStrings.iucnSource}</p>
    </Section>
  );
}

const ARC = Math.PI * 80;

function Reef({ island }: { island: LiveIsland }) {
  const { reef } = island.card;
  const [ref, seen] = useSeen<HTMLDivElement>();
  const v = reef.healthIndex.value / reef.healthIndex.max;
  return (
    <Section id="reef" title={S.sections.reef} kicker={<SampleTag />}>
      <div className="ob-gauge" ref={ref} data-seen={seen ? "" : undefined}>
        <svg viewBox="0 0 200 118" role="img" aria-label={`${S.reefIndex}: ${reef.healthIndex.value} ${t(bStrings.reef.outOf, { max: reef.healthIndex.max })}, ${reef.healthIndex.label}`}>
          <path className="ob-gauge-edge" d="M20 104A80 80 0 0 1 180 104" />
          <path className="ob-gauge-track" d="M20 104A80 80 0 0 1 180 104" />
          <path className="ob-gauge-fill" d="M20 104A80 80 0 0 1 180 104" style={{ strokeDasharray: `${ARC * v} ${ARC}`, ["--ob-arc" as string]: `${ARC * v}` }} />
          {[0.25, 0.5, 0.75].map((f) => {
            const a = Math.PI * (1 - f);
            return <line key={f} className="ob-gauge-tick" x1={100 + Math.cos(a) * 93} y1={104 - Math.sin(a) * 93} x2={100 + Math.cos(a) * 98} y2={104 - Math.sin(a) * 98} />;
          })}
          <text className="ob-gauge-num" x="100" y="94" textAnchor="middle">
            {reef.healthIndex.value}
          </text>
          <text className="ob-gauge-of" x="100" y="112" textAnchor="middle">
            {t(bStrings.reef.outOf, { max: reef.healthIndex.max })}
          </text>
        </svg>
        <div className="ob-gauge-side">
          <p className="ob-gauge-title">{S.reefIndex}</p>
          <p className="ob-gauge-label">{reef.healthIndex.label}</p>
          <TrendChip trend={reef.healthIndex.trend} words={islandStrings.trend} />
        </div>
      </div>
      <p className="ob-body">{reef.summary}</p>
      <ul className="ob-meters">
        {reef.metrics.map((m) => {
          const s = share(m);
          return (
            <li className="ob-meterrow" key={m.id}>
              <span className="ob-meter-label">{m.label}</span>
              <span className="ob-meter-value">
                {m.display}
                {m.trend ? <TrendChip trend={m.trend} /> : null}
              </span>
              {s !== null ? (
                <span className="ob-meter" aria-hidden="true">
                  <span className="ob-meter-fill" style={{ ["--ob-v" as string]: s }} />
                </span>
              ) : null}
              {m.note ? <span className="ob-meter-note">{m.note}</span> : null}
            </li>
          );
        })}
      </ul>
      <p className="ob-fine">
        {t(S.reefUpdated, { date: reef.updated })}. {islandStrings.sample.figures}
      </p>
    </Section>
  );
}

function Projects({ island }: { island: LiveIsland }) {
  const { projects } = island.card;
  return (
    <Section id="projects" title={S.sections.projects} kicker={<SampleTag />}>
      <ul className="ob-projects">
        {projects.map((p, i) => {
          const pct = p.progress ? Math.round((p.progress.value / p.progress.target) * 100) : null;
          return (
            <li className="ob-project" key={p.id}>
              {p.art ? <StampMark art={p.art} shape="circle" tone="sage" size={52} tilt={[-6, 5, -4][i % 3]} /> : null}
              <div className="ob-project-text">
                <h3 className="ob-project-title">{p.title}</h3>
                <p className="ob-project-by">{t(S.by, { organisation: p.organisation })}</p>
                <p className="ob-project-sum">{p.summary}</p>
                {p.progress && pct !== null ? (
                  <div className="ob-progress">
                    <span className="ob-progress-bar" aria-hidden="true">
                      <span className="ob-progress-fill" style={{ ["--ob-v" as string]: pct / 100 }} />
                    </span>
                    <span className="ob-progress-text">
                      <strong>{p.progress.display}</strong>
                      <span>{t(bStrings.projects.done, { pct })}</span>
                    </span>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const TONE: Record<StampPartner["offer"]["kind"], "stamp" | "lagoon" | "ink"> = {
  stamp: "stamp",
  "tourism-seal": "lagoon",
  "government-seal": "ink",
};

function Ticket({ partner, index }: { partner: StampPartner; index: number }) {
  const { offer } = partner;
  return (
    <li className="ob-ticket" data-kind={offer.kind}>
      <div className="ob-ticket-stub">
        <StampMark art={offer.art} shape={offer.shape} tone={TONE[offer.kind]} size={66} tilt={[-7, 5, -4, 8, -5, 6][index % 6]} />
        <p className="ob-price">
          <span className="ob-price-amount">{t(S.from, { amount: offer.threshold.display })}</span>
          <span className="ob-price-eg">{bStrings.partners.example}</span>
        </p>
      </div>
      <div className="ob-ticket-body">
        <p className="ob-ticket-kind">{islandStrings.offerKind[offer.kind]}</p>
        <h4 className="ob-ticket-title">{offer.title}</h4>
        <p className="ob-ticket-by">
          <span className="ob-ticket-partner">{partner.name}</span>
          <span className="ob-type" data-type={partner.type}>
            {islandStrings.partnerType[partner.type]}
          </span>
        </p>
        <p className="ob-ticket-purpose">{offer.purpose}</p>
        <p className="ob-ticket-charity">
          <IconHeart size={14} />
          {t(S.supports, { charity: offer.charity })}
        </p>
        <Link className="ob-ticket-go" href="/passport" aria-label={t(bStrings.partners.collectLabel, { title: offer.title, partner: partner.name })}>
          {bStrings.partners.collect}
          <IconChevron size={14} />
        </Link>
      </div>
    </li>
  );
}

function Partners({ island }: { island: LiveIsland }) {
  const { partners } = island.card;
  const stamps = partners.filter((p) => p.offer.kind === "stamp");
  const seals = partners.filter((p) => p.offer.kind !== "stamp");
  return (
    <Section id="partners" title={S.sections.partners}>
      <p className="ob-body">{S.partnersIntro}</p>
      <p className="ob-callout">
        <SampleTag>{islandStrings.sample.tag}</SampleTag>
        {islandStrings.sample.thresholds}
      </p>
      {stamps.length ? (
        <>
          <h3 className="ob-sub">{bStrings.partners.stamps}</h3>
          <ul className="ob-tickets">
            {stamps.map((p, i) => (
              <Ticket key={p.id} partner={p} index={i} />
            ))}
          </ul>
        </>
      ) : null}
      {seals.length ? (
        <>
          <h3 className="ob-sub">{bStrings.partners.seals}</h3>
          <ul className="ob-tickets">
            {seals.map((p, i) => (
              <Ticket key={p.id} partner={p} index={i + 3} />
            ))}
          </ul>
        </>
      ) : null}
      <p className="ob-fine">{islandStrings.sample.donationPlatform}</p>
    </Section>
  );
}

/* ------------------------------------------------------------------ bodies */

const TAB_IDS = ["about", "tourism", "species", "reef", "projects", "partners"] as const;
type TabId = (typeof TAB_IDS)[number];

export interface LiveCardProps {
  island: LiveIsland;
  /** The element that scrolls, for the section tabs. */
  scroller: RefObject<HTMLDivElement | null>;
  /** Called before the tabs scroll, so a half-open sheet can open fully first. */
  onNavigate(): void;
  onOpenPhoto(index: number): void;
}

export function LiveCard({ island, scroller, onNavigate, onOpenPhoto }: LiveCardProps) {
  const [active, setActive] = useState<TabId>("about");
  const tabs = useRef<HTMLDivElement>(null);

  // Follow the reading position: the tab of the section nearest the top of the card is marked.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = root.getBoundingClientRect().top + 96;
      let current: TabId = "about";
      for (const id of TAB_IDS) {
        const el = root.querySelector<HTMLElement>(`#ob-sec-${id}`);
        if (el && el.getBoundingClientRect().top <= top) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scroller, island.id]);

  // Keep the marked tab in view inside its own strip.
  useEffect(() => {
    const strip = tabs.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!strip || !tab) return;
    const left = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  const go = useCallback(
    (id: TabId) => {
      onNavigate();
      // Wait a frame: on a phone the sheet has to become scrollable first.
      window.setTimeout(() => {
        const root = scroller.current;
        const el = root?.querySelector<HTMLElement>(`#ob-sec-${id}`);
        if (!root || !el) return;
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 58;
        root.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
      }, 60);
    },
    [onNavigate, scroller],
  );

  return (
    <>
      <nav className="ob-tabs" aria-label={bStrings.sheet.sections} ref={tabs}>
        {TAB_IDS.map((id) => (
          <button key={id} type="button" className="ob-tab" data-tab={id} aria-current={active === id ? "true" : undefined} onClick={() => go(id)}>
            {bStrings.tabs[id]}
          </button>
        ))}
      </nav>
      <About island={island} onOpenPhoto={onOpenPhoto} />
      <Tourism island={island} />
      <SpeciesList island={island} />
      <Reef island={island} />
      <Projects island={island} />
      <Partners island={island} />
      <footer className="ob-cardfoot">
        <p>{islandStrings.sample.notice}</p>
        <Link className="ob-textlink" href="/passport">
          {S.cta.passport}
          <IconChevron size={14} />
        </Link>
      </footer>
    </>
  );
}

export function SoonCard({ island, onPick }: { island: ComingSoonIsland; onPick(id: string): void }) {
  return (
    <div className="ob-soon">
      <p className="ob-lede">{S.comingSoon}</p>
      <p className="ob-body">{island.teaser}</p>
      <h2 className="ob-sub">{bStrings.soon.meanwhile}</h2>
      <ul className="ob-picks ob-picks-card" aria-label={bStrings.picksLabel}>
        {LIVE_ISLANDS.map((i) => (
          <li key={i.id}>
            <button type="button" className="ob-pick" onClick={() => onPick(i.id)}>
              <span className="ob-pick-dot" aria-hidden="true" />
              {i.name}
            </button>
          </li>
        ))}
      </ul>
      <p className="ob-fine">{islandStrings.sample.notice}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ actions */

export function CardActions({ island }: { island: GlobeIsland }) {
  const [copied, setCopied] = useState(false);
  const [listed, setListed] = useState(false);
  const live = isLive(island);

  useEffect(() => {
    setListed(false);
    setCopied(false);
  }, [island.id]);

  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: t(bStrings.share.title, { name: island.name }), url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* The visitor closed the share sheet, or the clipboard is blocked. Nothing to do. */
    }
  }, [island.name]);

  return (
    <div className="ob-actions">
      <div className="ob-actions-row">
        {live ? (
          <Link className="ob-btn ob-btn-primary" href="/passport">
            <span className="ob-btn-stamp" aria-hidden="true" />
            {S.cta.collect}
          </Link>
        ) : (
          <button type="button" className="ob-btn ob-btn-primary" aria-pressed={listed} onClick={() => setListed((v) => !v)}>
            {listed ? <IconCheck size={18} /> : <IconBell size={18} />}
            {listed ? bStrings.soon.listed : S.cta.notify}
          </button>
        )}
        <button type="button" className="ob-btn ob-btn-ghost" onClick={() => void share()}>
          <IconShare size={18} />
          <span aria-live="polite">{copied ? bStrings.share.copied : S.cta.share}</span>
        </button>
      </div>
      <p className="ob-actions-note">{live ? islandStrings.sample.noDonations : listed ? bStrings.soon.listedNote : islandStrings.sample.notice}</p>
    </div>
  );
}
