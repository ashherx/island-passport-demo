/**
 * The recipient page: what someone sees after following a shared link (/s/<code>).
 *
 * Server component. The hero, the offer and the explanation are all in the first HTML, so the
 * first paint already says who shared, which island, which stamp and which charity. The pieces
 * that need the browser are small client islands: the collect sheet (CollectFlow), the in-app
 * browser helper, the attribution note and the demo controls.
 *
 * Three variants from one model (model.ts): a traveler's link, a partner's link, and the island's
 * own page when the code is unknown. Notes: docs/agents/p3-landing.md
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import { Avatar, BrandMark, IconArrow, SampleTag, skRootClass } from "@/components/share/kit";
import { Stamp } from "@/components/stamp";
import { photoAsset, photoSources } from "@/lib/islands/photos";
import { EXAMPLE_THRESHOLDS, shareCopy } from "@/lib/share";
import { strings } from "@/lib/strings";
import { Attribution } from "./Attribution";
import { CollectButton, CollectProvider, CollectStatusLine, LandingStamp, ProgressStamp, StickyCta } from "./CollectFlow";
import { DemoControls } from "./DemoControls";
import { InAppHelper } from "./InAppHelper";
import { IconClock, IconExternal, IconGlobe, IconMail, IconPin, IconSeal } from "./icons";
import type { InAppInfo } from "./inapp";
import type { LandingModel } from "./model";
import { possessive, withCharity } from "./text";
import "./landing.css";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export function Landing({ model, inApp }: { model: LandingModel; inApp: InAppInfo | null }) {
  const { offer, sharer } = model;
  const hero = photoSources(model.photo.name, 1280);
  const heroColor = photoAsset(model.photo.name)?.color ?? "#cfe6f2";
  const stampNoun = offer.isSeal ? "seal" : "stamp";
  const heroStamp = model.sharerStamp ?? model.stamp;
  const heroStampLabel = model.sharerStamp && sharer ? `${possessive(sharer.shortName)} stamp` : offer.isSeal ? "The seal" : "The stamp";

  return (
    <div className={`${skRootClass} lp`} data-accent={model.accent} data-kind={model.kind} data-inapp={inApp ? inApp.platform : undefined}>
      <CollectProvider model={model} inApp={inApp}>
        <InAppHelper info={inApp} code={model.code} />

        <header className="lp-bar">
          <Link className="sk-brand" href="/" aria-label={`${strings.app.name}: explore the globe`}>
            <BrandMark size={24} />
            <span className="sk-brand-name">{strings.app.name}</span>
          </Link>
          <SampleTag />
          <Link className="lp-bar-link" href="/">
            <IconGlobe size={17} />
            <span>Explore the globe</span>
          </Link>
        </header>

        <main className="lp-main">
          <section className="lp-hero" aria-labelledby="lp-title">
            <div className="lp-hero-media lp-rise" style={rise(0)}>
              <div className="lp-photo" style={{ backgroundColor: heroColor }}>
                {hero ? (
                  // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP renditions; next/image is not used in this demo
                  <img
                    src={hero.src}
                    srcSet={hero.srcSet}
                    sizes="(min-width: 960px) 560px, 100vw"
                    alt={model.photo.alt}
                    fetchPriority="high"
                    decoding="async"
                    style={{ objectPosition: `${model.photo.focus[0]}% ${model.photo.focus[1]}%` }}
                  />
                ) : null}
                <span className="lp-photo-shade" aria-hidden="true" />
                <span className="lp-place">
                  <IconPin size={15} />
                  {model.place}
                </span>
              </div>

              {sharer ? (
                <div className="lp-from">
                  <Avatar avatar={sharer.avatar} size={38} />
                  <span className="lp-from-text">
                    <b>{sharer.name}</b>
                    <span>
                      {sharer.typeLabel} · {sharer.handle}
                    </span>
                  </span>
                  <SampleTag />
                </div>
              ) : null}

              <div className="lp-hero-stamp" aria-hidden="true">
                <span className="lp-hero-stamp-paper">
                  {offer.isSeal ? <LandingStamp model={model} status="verified" size={116} /> : <Stamp stamp={heroStamp} size={116} decorative />}
                </span>
                <span className="lp-hero-stamp-label">{heroStampLabel}</span>
              </div>
            </div>

            <div className="lp-hero-text">
              <p className="sk-eyebrow lp-rise" style={rise(1)}>
                {model.eyebrow}
              </p>
              <h1 className="sk-title lp-title lp-rise" id="lp-title" style={rise(2)}>
                {model.headline.lead} <em>{model.headline.island}.</em>
              </h1>
              <p className="sk-lead lp-rise" style={rise(3)}>
                {model.kind === "island" ? (
                  <>
                    {model.islandTagline}. Collect the {offer.title} stamp and help <b>{offer.charity}</b>.
                  </>
                ) : (
                  <>
                    {offer.isSeal ? `Earn the ${offer.title}` : `Collect the ${offer.title} stamp`} for your own passport and help <b>{offer.charity}</b>.
                  </>
                )}
              </p>
              <p className="lp-what lp-rise" style={rise(3)}>
                <BrandMark size={20} />
                <span>{model.intro}</span>
              </p>
              <div className="lp-cta lp-rise" style={rise(4)} data-lp-cta-anchor>
                <CollectButton block />
                <CollectStatusLine />
              </div>
              <div className="lp-rise" style={rise(5)}>
                <Attribution model={model} />
              </div>
            </div>
          </section>

          <section className="lp-section lp-offer" aria-labelledby="lp-offer-title">
            <div className="lp-section-head">
              <p className="sk-eyebrow">The {stampNoun} you can collect</p>
            </div>
            <div className="sk-card lp-offer-card">
              <div className="lp-offer-top">
                <div className="lp-offer-stamp">
                  <ProgressStamp size={116} />
                </div>
                <div className="lp-offer-text">
                  <p className="lp-kind">
                    {offer.kindLabel} · {model.islandName}
                  </p>
                  <h2 className="sk-h2" id="lp-offer-title">
                    {offer.title}
                  </h2>
                  <p className="lp-charity">
                    <span>
                      Confirmed by <b>{offer.charity}</b>
                    </span>
                    <SampleTag />
                  </p>
                </div>
              </div>
              <p className="lp-purpose">
                <span className="lp-purpose-label">What your gift pays for</span>
                {offer.purpose}
              </p>
              <div className="lp-threshold">
                <p className="lp-threshold-main">
                  <span className="lp-amount">
                    <small>from</small>
                    {offer.threshold}
                  </span>
                  <span className="lp-threshold-note">
                    <b>Example amount</b>
                    given on {offer.charitys} own page. Real thresholds are set with each organisation.
                  </span>
                </p>
                <ul className="lp-legend" aria-label="Example thresholds">
                  {EXAMPLE_THRESHOLDS.map((row) => (
                    <li key={row.kind} data-current={row.label === offer.kindLabel}>
                      <span>{row.label}</span>
                      <b>{row.display}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="lp-section lp-how" aria-labelledby="lp-how-title">
            <div className="lp-section-head">
              <p className="sk-eyebrow">How it works</p>
              <h2 className="sk-h2" id="lp-how-title">
                Three steps, and the money never passes through us
              </h2>
            </div>
            <ol className="lp-steps">
              <li>
                <span className="lp-step-art" aria-hidden="true">
                  <LandingStamp model={model} status="discovery" size={76} />
                </span>
                <div>
                  <p className="lp-step-kicker">
                    <IconExternal size={15} /> Step 1
                  </p>
                  <h3 className="sk-h3">Give on {offer.charitys} own page</h3>
                  <p>{withCharity(shareCopy.noDonations, offer.charity).replace("You give", "You donate directly")}</p>
                </div>
              </li>
              <li>
                <span className="lp-step-art" aria-hidden="true">
                  <LandingStamp model={model} status="pending" size={76} />
                </span>
                <div>
                  <p className="lp-step-kicker" data-tone="pending">
                    <IconClock size={15} /> Step 2 · Pending
                  </p>
                  <h3 className="sk-h3">{offer.charity} confirms it</h3>
                  <p>Their confirmation reaches us by email. Until it does, your {stampNoun} is shown as pending: we never call it donated before the charity says so.</p>
                </div>
              </li>
              <li>
                <span className="lp-step-art" aria-hidden="true">
                  <LandingStamp model={model} status="verified" size={76} />
                </span>
                <div>
                  <p className="lp-step-kicker" data-tone="verified">
                    <IconSeal size={15} /> Step 3
                  </p>
                  <h3 className="sk-h3">Your {stampNoun} is issued</h3>
                  <p>It turns into a Verified Supporter {stampNoun} in your passport, ready to share with your own link.</p>
                </div>
              </li>
            </ol>
            <div className="lp-nopass">
              <div className="lp-nopass-code" aria-hidden="true">
                {"482916".split("").map((d, i) => (
                  <span key={i} style={rise(i)}>
                    {d}
                  </span>
                ))}
              </div>
              <div>
                <h3 className="sk-h3">
                  <IconMail size={18} /> No password, ever
                </h3>
                <p>Sign up with your email. We send a 6-digit code, with a sign-in link in the same email as a backup.</p>
              </div>
            </div>
          </section>

          {model.passport && sharer ? (
            <section className="lp-section lp-pass" aria-labelledby="lp-pass-title">
              <div className="lp-section-head">
                <p className="sk-eyebrow">{possessive(sharer.shortName)} passport so far</p>
                <h2 className="sk-h2" id="lp-pass-title">
                  {model.passport.stamps.length + 1} stamps across {model.passport.islands} islands
                </h2>
              </div>
              <div className="lp-pass-page">
                <div className="lp-pass-head">
                  <Avatar avatar={sharer.avatar} size={36} />
                  <span>
                    <b>{sharer.name}</b>
                    <span>
                      {sharer.handle} · Province of {model.passport.province}
                    </span>
                  </span>
                  <SampleTag />
                </div>
                <ul className="lp-pass-row" aria-label={`${possessive(sharer.shortName)} other stamps`}>
                  {model.passport.stamps.map((stamp) => (
                    <li key={stamp.id}>
                      <Stamp stamp={stamp} size={92} />
                    </li>
                  ))}
                </ul>
                <p className="lp-pass-foot">
                  <span>{sharer.proof}</span>
                  <Link href="/passport">
                    Open a sample passport <IconArrow size={16} />
                  </Link>
                </p>
              </div>
            </section>
          ) : null}

          {model.kind === "partner" && sharer ? (
            <section className="lp-section lp-partner" aria-labelledby="lp-partner-title">
              <div className="lp-section-head">
                <p className="sk-eyebrow">Who shared this</p>
              </div>
              <div className="sk-card lp-partner-card">
                <Avatar avatar={sharer.avatar} size={56} />
                <div className="lp-partner-text">
                  <h2 className="sk-h2" id="lp-partner-title">
                    {sharer.name}
                  </h2>
                  <p className="lp-partner-meta">
                    <span className="lp-type">{sharer.typeLabel}</span>
                    <span>{sharer.handle}</span>
                    <SampleTag />
                  </p>
                  <p className="lp-partner-blurb">{sharer.blurb}</p>
                  <p className="lp-partner-proof">
                    <IconSeal size={16} />
                    <span>{sharer.proof} (sample figure)</span>
                  </p>
                </div>
              </div>
              <p className="sk-note">Any kind of partner can offer a stamp: creators, travel agencies, local establishments, charities and tourism boards.</p>
            </section>
          ) : null}

          <section className="lp-section lp-island" aria-labelledby="lp-island-title">
            <div className="lp-island-text">
              <div className="lp-section-head">
                <p className="sk-eyebrow">About {model.islandName}</p>
                <h2 className="sk-h2" id="lp-island-title">
                  {model.islandHeadline}
                </h2>
                <p className="sk-lead">{model.islandBody}</p>
              </div>
              <dl className="lp-island-facts">
                {model.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <Link className="lp-globe-link" href={`/?island=${model.islandId}`}>
                <span className="lp-globe-ico">
                  <IconGlobe size={22} />
                </span>
                <span>
                  <b>Explore the globe</b>
                  <small>See {model.islandName} and the islands around it</small>
                </span>
                <IconArrow size={18} />
              </Link>
            </div>
            <ul className="lp-gallery" aria-label={`Photos of ${model.islandName}`}>
              {model.gallery.map((photo) => {
                const src = photoSources(photo.name, 640);
                return (
                  <li key={photo.name} style={{ backgroundColor: photoAsset(photo.name)?.color ?? "#cfe6f2" }}>
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP renditions; next/image is not used in this demo
                      <img src={src.src} alt={photo.alt} loading="lazy" decoding="async" />
                    ) : null}
                    <span>{photo.caption}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <DemoControls code={model.code} platform={inApp?.simulated ? inApp.platform : null} />
        </main>

        <footer className="lp-foot">{shareCopy.sampleNotice}</footer>
        <StickyCta />
      </CollectProvider>
    </div>
  );
}
