"use client";

/**
 * Step 4: share. "Post it" hands over the finished post (share sheet, image, caption, link, QR
 * code). "On your website" shows the same offer as a small widget inside a live iframe, with the
 * code to paste.
 *
 * Kept honest with Technical_Questions.md: a website cannot post into a story or a short-video
 * app, so sharing is "share sheet when the phone has one, otherwise save, copy, post"; the saved
 * file is a still image; the widget is display only and opens Island Passport in a full tab.
 */
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import {
  IconArrow,
  IconCheck,
  IconCode,
  IconCopy,
  IconDownload,
  IconShare,
  LinkField,
  POST_FORMATS,
  PostPreview,
  QrCode,
  ShareSheet,
  SkButton,
  composeCaption,
  downloadBlob,
  drawQr,
  renderPostImage,
  useCopy,
  usePrefersReducedMotion,
  useShareTarget,
  type PostFormat,
  type ShareAction,
} from "@/components/share/kit";
import { embedSnippet, shareCopy, shareDisplayUrl, sharePath } from "@/lib/share";
import { strings } from "@/lib/strings";
import { EMBED_HEIGHT, sampleSite } from "./data";
import { EASE, IconGlobeWeb, IconQr, Segmented } from "./parts";
import { PostMedia, imageSpec, type Draft, type Post } from "./post";

const FORMAT_OPTIONS = POST_FORMATS.map((id) => ({ id, label: shareCopy.formats[id] }));

export type ShareTab = "post" | "site";

/** A print-ready QR card: white, the code, who it supports and the short link. */
async function renderQrCard(value: string, kicker: string, name: string, link: string): Promise<Blob> {
  const W = 900;
  const H = 1120;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const cs = getComputedStyle(document.querySelector(".sk") ?? document.body);
  const serif = `${cs.getPropertyValue("--da-serif").trim() || "Georgia"}, Georgia, serif`;
  const sans = `${cs.getPropertyValue("--da-sans").trim() || "system-ui"}, system-ui, sans-serif`;
  try {
    await Promise.all([document.fonts.load(`400 80px ${serif}`), document.fonts.load(`700 30px ${sans}`)]);
  } catch {
    /* draw with the fallbacks */
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#0a827e";
  ctx.font = `700 30px ${sans}`;
  ctx.letterSpacing = "6px";
  ctx.fillText(kicker.toUpperCase(), W / 2, 104);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#12293a";
  ctx.font = `400 84px ${serif}`;
  ctx.fillText(name, W / 2, 196);
  drawQr(ctx, value, 110, 250, 680);
  ctx.fillStyle = "#06706d";
  ctx.font = `700 36px ${sans}`;
  ctx.fillText(link, W / 2, 1010);
  ctx.fillStyle = "#4f6271";
  ctx.font = `500 24px ${sans}`;
  ctx.fillText(`${strings.app.name} · ${shareCopy.sampleTag.toUpperCase()}`, W / 2, 1064);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/png"));
}

function DoneLabel({ done, idle, ok }: { done: boolean; idle: React.ReactNode; ok: React.ReactNode }) {
  return <>{done ? ok : idle}</>;
}

export function ShareStep({
  post,
  tab,
  onTab,
  patch,
  onShared,
}: {
  post: Post;
  tab: ShareTab;
  onTab: (tab: ShareTab) => void;
  patch: (change: Partial<Draft>) => void;
  /** Called when something was actually shared or saved (the flow offers to log the post). */
  onShared: () => void;
}) {
  const { partner, draft, code } = post;
  const reduced = usePrefersReducedMotion();
  const target = useShareTarget(code);
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState<"image" | "qr" | null>(null);
  const [busy, setBusy] = useState(false);
  const caption = useCopy();
  const embed = useCopy();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posted = composeCaption(draft.caption, draft.tags);
  const spec = imageSpec(post, draft.format, target);
  const snippet = embedSnippet(code, EMBED_HEIGHT);
  const site = sampleSite(partner);
  const qrName = draft.lead === "charity" ? partner.offer.charity : partner.offer.kind === "stamp" ? `${partner.offer.title} stamp` : partner.offer.title;
  const qrKicker = draft.lead === "charity" ? shareCopy.scanToSupport : partner.offer.kind === "stamp" ? "Scan to collect" : "Scan to earn";

  const flash = (what: "image" | "qr") => {
    setSaved(what);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(null), 1800);
  };

  const saveImage = async () => {
    setBusy(true);
    try {
      downloadBlob(await renderPostImage(spec), `island-passport-${code}-${draft.format}.png`);
      flash("image");
      onShared();
    } catch {
      /* the share sheet reports drawing problems; nothing to do here */
    } finally {
      setBusy(false);
    }
  };

  const saveQr = async () => {
    try {
      downloadBlob(await renderQrCard(target, qrKicker, qrName, shareDisplayUrl(code)), `island-passport-${code}-qr.png`);
      flash("qr");
    } catch {
      /* ignore */
    }
  };

  const onAction = (action: ShareAction) => {
    if (action === "native" || action === "image") onShared();
  };

  const swap = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.32, ease: EASE } };

  return (
    <div className="pf-share">
      <header className="pf-head pf-rise" style={{ "--i": 0 } as CSSProperties}>
        <p className="sk-eyebrow">
          {post.islandName} · {post.title}
        </p>
        <h1 className="sk-h2 pf-h1">
          Ready to <em>share.</em>
        </h1>
        <p className="sk-lead">One post, your link and your QR code. Post it on social, or put it on your own website.</p>
      </header>

      <div className="pf-rise" style={{ "--i": 1 } as CSSProperties}>
        <Segmented
          className="pf-share-tabs"
          label="Where it goes"
          value={tab}
          onChange={onTab}
          options={[
            { id: "post", label: "Post it", icon: <IconShare size={17} /> },
            { id: "site", label: "On your website", icon: <IconGlobeWeb size={17} /> },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === "post" ? (
          <motion.div key="post" className="pf-share-grid" {...swap}>
            <div className="pf-share-preview">
              <Segmented size="s" options={FORMAT_OPTIONS} value={draft.format} onChange={(format: PostFormat) => patch({ format })} label="Post format" />
              <div className="pf-share-phone" data-format={draft.format}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={draft.format}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(6px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(6px)" }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <PostPreview
                      format={draft.format}
                      label={false}
                      author={post.author}
                      caption={draft.caption}
                      hashtags={draft.tags}
                      link={shareDisplayUrl(code)}
                      media={<PostMedia post={post} format={draft.format} sizes="(max-width: 480px) 60vw, 280px" />}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="pf-share-kit">
              <section className="sk-card pf-kit pf-kit-main" aria-label="Share the post">
                <SkButton block onClick={() => setSheet(true)}>
                  <IconShare size={19} />
                  Share this post
                </SkButton>
                <div className="pf-kit-row">
                  <SkButton variant="secondary" size="s" onClick={saveImage} disabled={busy}>
                    {saved === "image" ? <IconCheck size={16} strokeWidth={2.6} /> : <IconDownload size={16} />}
                    <DoneLabel done={saved === "image"} idle="Save image" ok="Saved" />
                  </SkButton>
                  <SkButton variant="secondary" size="s" onClick={() => caption.copy(posted)}>
                    {caption.copied ? <IconCheck size={16} strokeWidth={2.6} /> : <IconCopy size={16} />}
                    <DoneLabel done={caption.copied} idle="Copy caption" ok="Copied" />
                  </SkButton>
                </div>
                <p className="sk-hint">
                  A website cannot post into a story or a short video for you. Share opens your phone&apos;s own share sheet when it has one; otherwise it is save, copy,
                  post.
                </p>
                <span className="sk-sr" role="status">
                  {saved === "image" ? "Image saved" : saved === "qr" ? "QR code saved" : caption.copied ? "Caption copied" : ""}
                </span>
              </section>

              <section className="sk-card pf-kit" aria-label="Your link and QR code">
                <LinkField code={code} label={`Your link for ${post.islandName}`} newTab hint="Your code is part of the address, so the credit survives a hop out of a social app's browser." />
                <div className="pf-kit-qr">
                  <QrCode value={target} size={104} label={qrKicker} name={qrName} />
                  <div className="pf-kit-qr-text">
                    <b>Your QR code</b>
                    <span>It is already inside the video&apos;s end card and on every saved image. Save it by itself for a counter card, a flyer or a slide.</span>
                    <SkButton variant="secondary" size="s" onClick={saveQr}>
                      {saved === "qr" ? <IconCheck size={16} strokeWidth={2.6} /> : <IconQr size={16} />}
                      <DoneLabel done={saved === "qr"} idle="Save QR code" ok="Saved" />
                    </SkButton>
                  </div>
                </div>
              </section>

              <section className="sk-card pf-kit" aria-label="Caption">
                <div className="pf-kit-cap-head">
                  <span className="sk-field-label">Caption and hashtags</span>
                  <button type="button" className="pf-mini" onClick={() => caption.copy(posted)}>
                    {caption.copied ? <IconCheck size={15} strokeWidth={2.6} /> : <IconCopy size={15} />}
                    {caption.copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="pf-kit-cap">
                  {draft.caption}
                  {draft.tags.length ? <i>{draft.tags.join(" ")}</i> : null}
                </p>
              </section>

              <p className="sk-note pf-kit-note">
                In this demo &ldquo;Save image&rdquo; gives you the cover as a PNG. How the six videos are delivered as files is one of the open technical questions.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="site" className="pf-site" {...swap}>
            <div className="pf-browser" aria-label="Preview of the widget on your website">
              <div className="pf-browser-bar">
                <span className="pf-browser-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="pf-browser-url">
                  {site}
                  <i>/visit</i>
                </span>
                <span className="sk-sample">Sample site</span>
              </div>
              <div className="pf-browser-page">
                <div className="pf-fake" aria-hidden="true">
                  <span className="pf-fake-nav">
                    <b>{partner.name}</b>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="pf-fake-h" />
                  <span className="pf-fake-h" data-w="70" />
                  <span className="pf-fake-p" />
                  <span className="pf-fake-p" />
                  <span className="pf-fake-p" data-w="60" />
                  <span className="pf-fake-btn" />
                  <span className="pf-fake-img" />
                </div>
                <div className="pf-frame">
                  <span className="pf-frame-tag">
                    <IconCode size={13} />
                    Your widget, live
                  </span>
                  <iframe key={code} src={`/embed/${code}`} title={`${strings.app.name} widget for ${post.islandName}`} loading="lazy" height={EMBED_HEIGHT} />
                </div>
              </div>
            </div>

            <div className="pf-site-side">
              <section className="sk-card pf-kit" aria-label="Embed code">
                <div className="pf-kit-cap-head">
                  <span className="sk-field-label">Paste this where the widget should appear</span>
                </div>
                <pre className="sk-code pf-site-code" tabIndex={0} aria-label="Embed code">
                  {snippet}
                </pre>
                <SkButton variant="primary" block onClick={() => embed.copy(snippet)}>
                  {embed.copied ? <IconCheck size={18} strokeWidth={2.6} /> : <IconCopy size={18} />}
                  {embed.copied ? "Embed code copied" : "Copy embed code"}
                </SkButton>
                <span className="sk-sr" role="status">
                  {embed.copied ? "Embed code copied" : ""}
                </span>
              </section>

              <ul className="pf-facts">
                <li>
                  <b>Display only</b>
                  <span>One button, which opens Island Passport in a full tab. Nobody signs in or gives inside the frame.</span>
                </li>
                <li>
                  <b>Your code is in the link</b>
                  <span>Credit does not depend on cookies, which most browsers block inside an embedded frame.</span>
                </li>
                <li>
                  <b>Still to test</b>
                  <span>Some website builders restrict embedded frames. We check yours before you rely on it.</span>
                </li>
              </ul>
              {partner.hasWebsite ? null : <p className="sk-note">No website? The same code works on a link-in-profile page or a blog, or skip this part.</p>}
              <SkButton variant="ghost" size="s" href={sharePath(code)}>
                See where the button leads <IconArrow size={16} />
              </SkButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareSheet
        open={sheet}
        onClose={() => setSheet(false)}
        code={code}
        caption={posted}
        summary={post.title}
        embed={snippet}
        image={spec}
        fileName={`island-passport-${code}-${draft.format}.png`}
        onAction={onAction}
      />
    </div>
  );
}
