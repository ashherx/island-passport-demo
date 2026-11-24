import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, IconArrow, IconLink, IslandReel, PostPreview, QrCode, ShareShell, authorOf } from "@/components/share/kit";
import { Stamp } from "@/components/stamp";
import { getIsland } from "@/lib/islands/data";
import { photoSources } from "@/lib/islands/photos";
import {
  DEFAULT_PARTNER,
  SAMPLE_PARTNER_CODE,
  SAMPLE_TRAVELER,
  SAMPLE_TRAVELER_CODE,
  SHARE_DOMAIN,
  captionSuggestions,
  defaultHashtags,
  featuredReel,
  resolveShareCode,
  shareCopy,
  shareDisplayUrl,
  sharePath,
  shareUrl,
} from "@/lib/share";
import "./hub.css";

/**
 * /share: the entry to part 3 of the demo. It names the two share flows in a line each, links to
 * them, and links to what a recipient sees for a sample traveler link and a sample partner link.
 * Kit reference: docs/agents/p3-kit.md
 */
export const metadata: Metadata = { title: "Share flows · Island Passport (sample)" };

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function ShareHubPage() {
  const partner = DEFAULT_PARTNER;
  const traveler = SAMPLE_TRAVELER;
  const partnerIsland = getIsland(resolveShareCode(SAMPLE_PARTNER_CODE)?.islandId)?.name ?? "Bohol";
  const travelerIslandId = resolveShareCode(SAMPLE_TRAVELER_CODE)?.islandId ?? "pamilacan";
  const reel = featuredReel("bohol");
  const stamp = traveler.featuredStamp;
  const travelerPhoto = photoSources("bohol-pamilacan-dolphins", 640);

  return (
    <ShareShell width="wide">
      <section className="skh-hero">
        <p className="sk-eyebrow skh-rise" style={stagger(0)}>
          Sharing flows · sample concept demo
        </p>
        <h1 className="sk-title skh-rise" style={stagger(1)}>
          Every stamp starts with <em>a share.</em>
        </h1>
        <p className="sk-lead skh-rise" style={stagger(2)}>
          Partners and travelers each get a ready-made post, their own link and a QR code. Pick a flow to walk through it, then see what lands on the other side.
        </p>
      </section>

      <div className="skh-flows">
        <Link className="sk-card skh-flow skh-rise" data-flow="partner" href="/share/partner" style={stagger(3)}>
          <div className="skh-stage" aria-hidden="true">
            <div className="skh-phone">
              <PostPreview
                format="story"
                label={false}
                author={authorOf(partner)}
                link={shareDisplayUrl(SAMPLE_PARTNER_CODE)}
                media={
                  <IslandReel
                    reel={reel}
                    islandName={partnerIsland}
                    code={SAMPLE_PARTNER_CODE}
                    byline={`with ${partner.name}`}
                    support={`${shareCopy.scanToSupport} ${partner.offer.charity}`}
                    controls={false}
                    sizes="240px"
                  />
                }
              />
            </div>
            <div className="skh-float">
              <QrCode value={shareUrl(SAMPLE_PARTNER_CODE)} size={92} name={partner.offer.charity} />
            </div>
            <span className="skh-link-chip">
              <IconLink size={15} />
              <span>
                {SHARE_DOMAIN}/s/<b>{SAMPLE_PARTNER_CODE}</b>
              </span>
            </span>
          </div>
          <div className="skh-text">
            <p className="sk-eyebrow">Flow 1 · Partners</p>
            <h2 className="sk-h2">Promote an island</h2>
            <p className="sk-lead">Pick one of six island videos, add your name, and share it with your own link and QR code.</p>
            <ul className="skh-who" aria-label="Who this is for">
              {Object.values(shareCopy.partnerTypes).map((type) => (
                <li key={type}>{type}</li>
              ))}
            </ul>
            <span className="skh-go">
              Open the partner flow <IconArrow size={18} />
            </span>
          </div>
        </Link>

        <Link className="sk-card skh-flow skh-rise" data-flow="traveler" href="/share/traveler" style={stagger(4)}>
          <div className="skh-stage" aria-hidden="true">
            <div className="skh-phone">
              <PostPreview
                format="feed"
                label={false}
                author={authorOf(traveler, `${stamp.island}, Philippines`)}
                caption={captionSuggestions(traveler, travelerIslandId)[1].text}
                hashtags={defaultHashtags(travelerIslandId, "traveler").slice(0, 2)}
                lines={2}
                media={
                  travelerPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP rendition; next/image is not used in this demo
                    <img src={travelerPhoto.src} alt="" style={{ objectPosition: "50% 50%" }} />
                  ) : null
                }
              />
            </div>
            <div className="skh-stamp">
              <Stamp stamp={stamp} status="verified" size={104} decorative />
              <span>New stamp</span>
            </div>
            <span className="skh-link-chip">
              <IconLink size={15} />
              <span>
                {SHARE_DOMAIN}/s/<b>{SAMPLE_TRAVELER_CODE}</b>
              </span>
            </span>
          </div>
          <div className="skh-text">
            <p className="sk-eyebrow">Flow 2 · Travelers</p>
            <h2 className="sk-h2">Share your stamp</h2>
            <p className="sk-lead">Just collected a stamp? Share your passport with your own link, and bring friends along to help your charity.</p>
            <ul className="skh-who" aria-label="What gets shared">
              <li>Passport</li>
              <li>Island page</li>
              <li>Scan to help my charity</li>
            </ul>
            <span className="skh-go">
              Open the traveler flow <IconArrow size={18} />
            </span>
          </div>
        </Link>
      </div>

      <section className="skh-section" aria-labelledby="skh-recipient">
        <div className="skh-section-head">
          <p className="sk-eyebrow">The other side</p>
          <h2 className="sk-h2" id="skh-recipient">
            What the recipient sees
          </h2>
          <p className="sk-lead">Follow a sample link exactly as a friend or follower would, from a post, a story or a scanned QR code.</p>
        </div>
        <div className="skh-landings">
          <Link className="sk-card skh-landing" href={sharePath(SAMPLE_TRAVELER_CODE)}>
            <Avatar avatar={traveler.avatar} size={46} />
            <span className="skh-landing-text">
              <b>A link from a traveler</b>
              <span>
                {traveler.name} · {SHARE_DOMAIN}/s/<b>{SAMPLE_TRAVELER_CODE}</b>
              </span>
            </span>
            <IconArrow className="skh-landing-go" />
          </Link>
          <Link className="sk-card skh-landing" href={sharePath(SAMPLE_PARTNER_CODE)}>
            <Avatar avatar={partner.avatar} size={46} />
            <span className="skh-landing-text">
              <b>A link from a partner</b>
              <span>
                {partner.handle} · {SHARE_DOMAIN}/s/<b>{SAMPLE_PARTNER_CODE}</b>
              </span>
            </span>
            <IconArrow className="skh-landing-go" />
          </Link>
        </div>
      </section>

      <section className="skh-section" aria-labelledby="skh-rules">
        <div className="skh-section-head">
          <h2 className="sk-h3" id="skh-rules">
            What both flows keep to
          </h2>
        </div>
        <ul className="skh-rules">
          <li>
            <b>No passwords</b>
            <span>Sign-in is a one-time code by email, with a link as a backup.</span>
          </li>
          <li>
            <b>Donations stay with the charity</b>
            <span>People give on the charity&apos;s own page. A stamp shows as pending until the charity confirms it.</span>
          </li>
          <li>
            <b>Credit travels in the link</b>
            <span>The sharer&apos;s code is part of the address, so it survives a hop out of a social app&apos;s browser.</span>
          </li>
        </ul>
        <p className="sk-note">Donation amounts shown anywhere in these flows are examples. Real thresholds are set with each organisation.</p>
      </section>
    </ShareShell>
  );
}
