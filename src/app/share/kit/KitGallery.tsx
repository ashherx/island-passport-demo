"use client";

/**
 * Every share-kit component on one page, wired to the sample data. Not part of the pitch flow:
 * it is the reference the flow pages are built against (docs/agents/p3-kit.md).
 */
import { useRef, useState } from "react";
import {
  CaptionEditor,
  IslandReel,
  LinkField,
  POST_FORMATS,
  PostPreview,
  QrCode,
  ShareSheet,
  ShareShell,
  SkButton,
  StepHeader,
  authorOf,
  composeCaption,
  useShareTarget,
  type IslandReelHandle,
  type PostFormat,
} from "@/components/share/kit";
import { getIsland } from "@/lib/islands/data";
import {
  SAMPLE_PARTNERS,
  captionSuggestions,
  defaultHashtags,
  formatDuration,
  hashtagSuggestions,
  reelSeconds,
  reelsForIsland,
  shareCode,
  shareCopy,
  shareDisplayUrl,
} from "@/lib/share";

const STEPS = [
  { id: "choose", label: "Choose" },
  { id: "personalise", label: "Personalise" },
  { id: "preview", label: "Preview" },
  { id: "share", label: "Share" },
];

const section: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, marginTop: 44 };

export function KitGallery() {
  const [partnerId, setPartnerId] = useState(SAMPLE_PARTNERS[0].id);
  const partner = SAMPLE_PARTNERS.find((p) => p.id === partnerId) ?? SAMPLE_PARTNERS[0];
  const islandId = partner.islandIds[0];
  const island = getIsland(islandId);
  const code = shareCode(partner, islandId);
  const reels = reelsForIsland(islandId);
  const [reelId, setReelId] = useState(reels[0].id);
  const reel = reels.find((r) => r.id === reelId) ?? reels[0];
  const suggestions = captionSuggestions(partner, islandId);
  const [caption, setCaption] = useState(suggestions[0].text);
  const [tags, setTags] = useState(() => defaultHashtags(islandId, partner.type));
  const [message, setMessage] = useState("Come see it with me");
  const [step, setStep] = useState("personalise");
  const [format, setFormat] = useState<PostFormat>("story");
  const [sheet, setSheet] = useState(false);
  const player = useRef<IslandReelHandle>(null);
  const target = useShareTarget(code);
  const support = `${shareCopy.scanToSupport} ${partner.offer.charity}`;

  const pick = (id: string) => {
    const next = SAMPLE_PARTNERS.find((p) => p.id === id) ?? SAMPLE_PARTNERS[0];
    setPartnerId(next.id);
    setCaption(captionSuggestions(next, next.islandIds[0])[0].text);
    setTags(defaultHashtags(next.islandIds[0], next.type));
    setReelId(reelsForIsland(next.islandIds[0])[0].id);
  };

  return (
    <ShareShell width="wide" back={{ href: "/share", label: "All share flows" }}>
      <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
        <p className="sk-eyebrow">Share kit</p>
        <h1 className="sk-title">
          The parts, <em>in one place.</em>
        </h1>
        <p className="sk-lead">Every component the share flows are built from, wired to the sample data.</p>
        <ul className="sk-cap-tones" aria-label="Sample partner">
          {SAMPLE_PARTNERS.map((p) => (
            <li key={p.id}>
              <button type="button" className="sk-chip" aria-pressed={p.id === partner.id} onClick={() => pick(p.id)}>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <section style={section}>
        <h2 className="sk-h3">StepHeader</h2>
        <div className="sk-card" style={{ padding: 20, maxWidth: 560 }}>
          <StepHeader
            steps={STEPS}
            current={step}
            onSelect={setStep}
            eyebrow={`${partner.name} · ${shareCopy.partnerTypes[partner.type]}`}
            title="Make it yours"
            lead="Add your name or a short line. The video does the rest."
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <SkButton variant="secondary" size="s" onClick={() => setStep(STEPS[Math.max(0, STEPS.findIndex((s) => s.id === step) - 1)].id)}>
              Back
            </SkButton>
            <SkButton size="s" onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, STEPS.findIndex((s) => s.id === step) + 1)].id)}>
              Next
            </SkButton>
          </div>
        </div>
      </section>

      <section style={section}>
        <h2 className="sk-h3">PostPreview with IslandReel</h2>
        <ul className="sk-cap-tones" aria-label="Island video">
          {reels.map((r) => (
            <li key={r.id}>
              <button type="button" className="sk-chip" aria-pressed={r.id === reel.id} onClick={() => setReelId(r.id)}>
                {r.number}. {r.theme} · {formatDuration(reelSeconds(r))}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start", justifyContent: "center" }}>
          {POST_FORMATS.map((f) => (
            <PostPreview
              key={f}
              format={f}
              width={264}
              author={authorOf(partner, `${island?.name}, Philippines`)}
              caption={caption}
              hashtags={tags}
              link={shareDisplayUrl(code)}
              media={
                <IslandReel
                  ref={f === "story" ? player : undefined}
                  reel={reel}
                  islandName={island?.name ?? "Bohol"}
                  code={code}
                  byline={`with ${partner.name}`}
                  avatar={partner.avatar}
                  message={message}
                  support={support}
                />
              }
            />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          <SkButton variant="secondary" size="s" onClick={() => player.current?.restart()}>
            Restart the story
          </SkButton>
          <SkButton variant="secondary" size="s" onClick={() => player.current?.showEnd()}>
            Show its end card
          </SkButton>
        </div>
        <label className="sk-link" style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
          <span className="sk-field-label">Your short line (shown in the video)</span>
          <span className="sk-link-row" style={{ paddingRight: 14 }}>
            <input value={message} maxLength={60} onChange={(e) => setMessage(e.target.value)} style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "none", fontSize: 16 }} />
          </span>
        </label>
      </section>

      <section style={section}>
        <h2 className="sk-h3">Posters (mode=&quot;poster&quot;, no timers)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 12 }}>
          {reels.map((r) => (
            <div key={r.id} style={{ borderRadius: 16, overflow: "hidden", boxShadow: "var(--sk-shadow-s)" }}>
              <IslandReel reel={r} islandName={island?.name ?? "Bohol"} code={code} mode="poster" aspect="9/16" sizes="160px" />
            </div>
          ))}
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "var(--sk-shadow-s)" }}>
            <IslandReel reel={reel} islandName={island?.name ?? "Bohol"} code={code} mode="poster" posterAt="end" aspect="9/16" support={support} />
          </div>
        </div>
      </section>

      <section style={{ ...section, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start", gap: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, minWidth: 0 }}>
          <h2 className="sk-h3">CaptionEditor</h2>
          <CaptionEditor
            value={caption}
            onChange={setCaption}
            suggestions={suggestions}
            hashtags={hashtagSuggestions(islandId, partner.type)}
            selected={tags}
            onSelectedChange={setTags}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, justifyItems: "start", minWidth: 0 }}>
          <h2 className="sk-h3">LinkField and QrCode</h2>
          <div style={{ width: "100%" }}>
            <LinkField code={code} hint="Your code travels in the link, so you get the credit." />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
            <QrCode value={target} name={partner.offer.charity} link={shareDisplayUrl(code)} />
            <QrCode value={target} variant="square" mark={false} frame="bare" size={120} label={false} />
          </div>
          <p className="sk-note">
            {partner.offer.title}: {partner.offer.threshold.display}. {shareCopy.exampleThreshold}
          </p>
        </div>
      </section>

      <section style={section}>
        <h2 className="sk-h3">ShareSheet</h2>
        <ul className="sk-cap-tones" aria-label="Image format">
          {(["feed", "story"] as const).map((f) => (
            <li key={f}>
              <button type="button" className="sk-chip" aria-pressed={(format === "feed" ? "feed" : "story") === f} onClick={() => setFormat(f)}>
                {shareCopy.formats[f]}
              </button>
            </li>
          ))}
        </ul>
        <div>
          <SkButton onClick={() => setSheet(true)}>Share this post</SkButton>
        </div>
        <ShareSheet
          open={sheet}
          onClose={() => setSheet(false)}
          code={code}
          caption={composeCaption(caption, tags)}
          summary={reel.title}
          embed={partner.hasWebsite}
          image={{
            format: format === "feed" ? "feed" : "story",
            photo: reel.scenes[0].photo,
            focus: reel.scenes[0].focus,
            islandName: island?.name ?? "Bohol",
            headline: reel.scenes[0].line,
            byline: `with ${partner.name}`,
            code,
            support: shareCopy.scanToSupport,
            supportName: partner.offer.charity,
            qrValue: target,
          }}
        />
      </section>
    </ShareShell>
  );
}
