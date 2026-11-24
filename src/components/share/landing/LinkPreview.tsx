/**
 * /s/<code>?preview=1: how the link looks before anyone taps it.
 *
 * Shows the real Open Graph card for the code (title, description and the image from
 * src/app/s/[code]/opengraph-image.tsx) inside three neutral frames: a chat thread, a social feed
 * post and a text message. The frames are generic on purpose: no platform's logo, icons or chrome.
 * The notes underneath are desk research (Technical_Questions.md, section 3), not device tests.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, IconArrow, SampleTag, ShareShell, SkButton } from "@/components/share/kit";
import { SHARE_DOMAIN, shareDisplayUrl, sharePath, type ShareAvatar } from "@/lib/share";
import type { LandingModel } from "./model";
import { SAMPLE_LANDING_CODES } from "./text";
import "./landing.css";

const ISLAND_AVATAR: ShareAvatar = { initials: "IP", tint: ["#c9f3ee", "#0a827e"] };

function Card({ model, variant }: { model: LandingModel; variant: "chat" | "feed" | "text" }) {
  return (
    <span className="lpv-card" data-variant={variant}>
      <span className="lpv-card-img">
        {/* eslint-disable-next-line @next/next/no-img-element -- the generated Open Graph image itself */}
        <img src={`${sharePath(model.code)}/opengraph-image`} alt={model.meta.imageAlt} width={1200} height={630} loading="lazy" decoding="async" />
      </span>
      <span className="lpv-card-text">
        {variant === "feed" ? <span className="lpv-card-domain">{SHARE_DOMAIN}</span> : null}
        <b>{model.meta.title}</b>
        {variant === "text" ? null : <span className="lpv-card-desc">{model.meta.description}</span>}
        {variant === "feed" ? null : <span className="lpv-card-domain">{SHARE_DOMAIN}</span>}
      </span>
    </span>
  );
}

function Frame({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <figure className="lpv-frame">
      <figcaption>
        <b>{label}</b>
        <span>{note}</span>
      </figcaption>
      <div className="lpv-screen">{children}</div>
    </figure>
  );
}

export function LinkPreview({ model }: { model: LandingModel }) {
  const who = model.sharer;
  const avatar = who?.avatar ?? ISLAND_AVATAR;
  const name = who?.name ?? "A friend";
  const first = who?.shortName ?? "A friend";
  const message =
    model.kind === "traveler"
      ? `Just got my ${model.islandName} stamp. You can collect one too, it helps ${model.offer.charity}.`
      : model.kind === "partner"
        ? `${model.islandName} has a ${model.offer.isSeal ? "seal" : "stamp"} now. Collect it and help ${model.offer.charity}.`
        : `Look at this: ${model.islandName} has its own passport stamp.`;

  return (
    <ShareShell width="wide" back={{ href: sharePath(model.code), label: "Back to the page" }}>
      <div className="lpv-top">
        <section className="lpv-head">
          <p className="sk-eyebrow">Link preview · {shareDisplayUrl(model.code)}</p>
          <h1 className="sk-title">
            How this link looks <em>when shared.</em>
          </h1>
          <p className="sk-lead">
            Before anyone taps, chat and social apps build a card from the page&apos;s title, description and picture. This is the real card for this link, shown in three neutral frames.
          </p>
          <div className="lpv-codes" aria-label="Sample links">
            {SAMPLE_LANDING_CODES.map((item) => (
              <Link key={item.code} className="sk-chip" data-on={item.code === model.code} href={`${sharePath(item.code)}?preview=1`} aria-current={item.code === model.code ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </div>
        </section>
        <figure className="lpv-big">
          <span className="lpv-big-img">
            {/* eslint-disable-next-line @next/next/no-img-element -- the generated Open Graph image itself */}
            <img src={`${sharePath(model.code)}/opengraph-image`} alt={model.meta.imageAlt} width={1200} height={630} />
          </span>
          <figcaption>The picture itself: 1200 × 630, generated for this link.</figcaption>
        </figure>
      </div>

      <div className="lpv-frames">
        <Frame label="Chat message" note="A link sent in a messaging app">
          <div className="lpv-chat">
            <div className="lpv-chat-head">
              <Avatar avatar={avatar} size={34} />
              <span>
                <b>{name}</b>
                <small>online</small>
              </span>
              <SampleTag />
            </div>
            <div className="lpv-chat-body">
              <span className="lpv-day">Today</span>
              <p className="lpv-bubble" data-side="in">
                {message}
              </p>
              <div className="lpv-bubble lpv-bubble-card" data-side="in">
                <Card model={model} variant="chat" />
                <span className="lpv-bubble-link">{shareDisplayUrl(model.code)}</span>
              </div>
              <span className="lpv-time">09:41</span>
            </div>
          </div>
        </Frame>

        <Frame label="Social feed post" note="A link pasted into a post">
          <div className="lpv-feed">
            <div className="lpv-feed-head">
              <Avatar avatar={avatar} size={38} />
              <span>
                <b>{name}</b>
                <small>Just now</small>
              </span>
              <SampleTag />
            </div>
            <p className="lpv-feed-text">{message}</p>
            <Card model={model} variant="feed" />
            <div className="lpv-feed-acts" aria-hidden="true">
              <span>Like</span>
              <span>Comment</span>
              <span>Share</span>
            </div>
          </div>
        </Frame>

        <Frame label="Text message" note="A link sent by SMS or a phone's own messages app">
          <div className="lpv-chat" data-tone="text">
            <div className="lpv-chat-head" data-center="true">
              <Avatar avatar={avatar} size={34} />
              <span>
                <b>{first}</b>
              </span>
            </div>
            <div className="lpv-chat-body">
              <span className="lpv-day">Text message · Today 09:41</span>
              <div className="lpv-bubble lpv-bubble-card" data-side="in" data-plain="true">
                <Card model={model} variant="text" />
              </div>
              <p className="lpv-bubble" data-side="in">
                {message}
              </p>
              <p className="lpv-bubble" data-side="out">
                Love it. Collecting mine now.
              </p>
              <span className="lpv-time" data-side="out">
                Delivered
              </span>
            </div>
          </div>
        </Frame>
      </div>

      <section className="lpv-meta" aria-labelledby="lpv-meta-title">
        <div className="sk-card lpv-table">
          <h2 className="sk-h3" id="lpv-meta-title">
            What the card is made of
          </h2>
          <dl>
            <div>
              <dt>Title</dt>
              <dd>{model.meta.title}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{model.meta.description}</dd>
            </div>
            <div>
              <dt>Picture</dt>
              <dd>
                1200 × 630 PNG, drawn per link: who shared, the island, the {model.offer.isSeal ? "seal" : "stamp"} and the charity.
                <small>{model.meta.imageAlt}</small>
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd className="lp-mono">{shareDisplayUrl(model.code)}</dd>
            </div>
          </dl>
        </div>

        <div className="lpv-notes">
          <h2 className="sk-h3">Good to know</h2>
          <ul>
            <li>
              <b>The picture never shows a stamp&apos;s status.</b>
              <span>Apps keep a card for days or weeks once it has been sent. A card that said &ldquo;pending&rdquo; would still say so after the charity confirms.</span>
            </li>
            <li>
              <b>The first share can arrive without its picture.</b>
              <span>Some apps fetch the image in the background, so partner and island links should be warmed up when they are published.</span>
            </li>
            <li>
              <b>Feed and short-video captions show no card at all.</b>
              <span>Links in captions are not tappable there. That is why the QR code and the short link are printed inside the post artwork.</span>
            </li>
          </ul>
          <p className="sk-note">From desk research, not yet tested on real devices. Each app draws the card its own way; these frames are neutral stand-ins.</p>
        </div>
      </section>

      <div className="lpv-go">
        <SkButton href={sharePath(model.code)}>
          Open the page itself
          <IconArrow size={18} />
        </SkButton>
        <SkButton variant="ghost" href="/share">
          All share flows
        </SkButton>
      </div>
    </ShareShell>
  );
}
