"use client";

/**
 * <ShareSheet />: the last step of both flows.
 *
 * A website cannot post straight into a story or a short-video app, so the sheet is honest about
 * it. Where the phone offers its own share sheet (Web Share API) that is the first button; under
 * it are the three steps that always work: save the image, copy the caption, open your app and
 * post. Then the link, and for partners with a website the embed code.
 *
 * A bottom sheet on phones, a centred dialog from 640px. Esc, the scrim and the close button all
 * dismiss it; focus is kept inside and handed back on close.
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { embedSnippet, shareDisplayUrl, shareUrl } from "@/lib/share/urls";
import { copyText, usePrefersReducedMotion } from "./hooks";
import { IconCheck, IconClose, IconCode, IconCopy, IconDownload, IconLink, IconShare, IconText } from "./icons";
import { SkButton, skRootClass } from "./primitives";
import { POST_IMAGE_SIZE, downloadBlob, isInAppBrowser, renderPostImage, type PostImageSpec } from "./render";

export type ShareAction = "native" | "image" | "caption" | "link" | "embed";

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  /** Share code, e.g. "mia-bohol": the link that is copied, shared and printed. */
  code: string;
  /** The caption as posted, hashtags included (`composeCaption(text, tags)`). */
  caption: string;
  /**
   * The picture to save and share: a spec for the built-in renderer, or a function that returns a
   * PNG blob (for artwork a flow draws itself). Leave out for a link-only share.
   */
  image?: PostImageSpec | (() => Promise<Blob>) | null;
  /** Download name. Default "island-passport-<code>.png". */
  fileName?: string;
  /** Sheet heading. Default "Share your post". */
  title?: string;
  /** Bold line next to the thumbnail, e.g. the reel's title. */
  summary?: ReactNode;
  /** Show "Embed on your website". true uses `embedSnippet(code)`; or pass your own snippet. */
  embed?: boolean | string;
  /** Called after each action succeeds (count a post toward the six, show a toast). */
  onAction?: (action: ShareAction) => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function ShareSheet({ open, onClose, code, caption, image, fileName, title = "Share your post", summary, embed, onAction }: ShareSheetProps) {
  const reduced = usePrefersReducedMotion();
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Partial<Record<ShareAction, boolean>>>({});
  const [embedOpen, setEmbedOpen] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [phone, setPhone] = useState(true);
  const [status, setStatus] = useState("");

  const url = shareUrl(code);
  const name = fileName ?? `island-passport-${code}.png`;
  const snippet = typeof embed === "string" ? embed : embed ? embedSnippet(code) : null;
  const imageKey = image ? (typeof image === "function" ? "custom" : JSON.stringify(image)) : "";
  const imageRef = useRef(image);
  imageRef.current = image;

  useEffect(() => {
    setMounted(true);
    setCanNative(typeof navigator.share === "function");
    setInApp(isInAppBrowser());
  }, []);

  // Draw the picture when the sheet opens (and again if the post changed while it was closed).
  useEffect(() => {
    const source = imageRef.current;
    if (!open || !source) return;
    let live = true;
    let made: string | null = null;
    setBusy(true);
    (typeof source === "function" ? source() : renderPostImage(source))
      .then((result) => {
        if (!live) return;
        made = URL.createObjectURL(result);
        setBlob(result);
        setBlobUrl(made);
      })
      .catch(() => live && setStatus("The picture could not be drawn. You can still share the link."))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
      setBlob(null);
      setBlobUrl(null);
    };
  }, [open, imageKey]);

  // While open: lock the page behind, close on Esc, keep Tab inside, hand focus back afterwards.
  useEffect(() => {
    if (!open) return;
    setDone({});
    setEmbedOpen(false);
    setStatus("");
    setPhone(window.innerWidth < 640);
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const focusTimer = setTimeout(() => sheet.current?.focus({ preventScroll: true }), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheet.current) return;
      const items = sheet.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === sheet.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.overflow = overflow;
      before?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const mark = useCallback(
    (action: ShareAction, message: string) => {
      setDone((d) => ({ ...d, [action]: true }));
      setStatus(message);
      onAction?.(action);
    },
    [onAction],
  );

  const shareNative = async () => {
    const file = blob ? new File([blob], name, { type: "image/png" }) : null;
    const withFile = file && navigator.canShare?.({ files: [file] }) ? { files: [file] } : {};
    try {
      await navigator.share({ title: "Island Passport", text: caption, url, ...withFile });
      mark("native", "Shared");
    } catch (error) {
      // Closing the system sheet is not an error worth reporting.
      if ((error as DOMException)?.name !== "AbortError") setStatus("Sharing is not available here. Use the steps below.");
    }
  };

  const copy = async (action: ShareAction, text: string, message: string) => {
    if (await copyText(text)) mark(action, message);
    else setStatus("Could not copy here. Press and hold the text to copy it.");
  };

  const size = image && typeof image !== "function" ? POST_IMAGE_SIZE[image.format] : null;
  const motionProps = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : phone
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.9 } }
      : { initial: { opacity: 0, y: 24, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 }, transition: { duration: 0.32, ease: EASE } };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className={`${skRootClass} sk-sheet-root`} key="share-sheet">
          <motion.button
            type="button"
            className="sk-sheet-scrim"
            aria-label="Close"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div ref={sheet} className="sk-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} {...motionProps}>
            <div className="sk-sheet-grip" aria-hidden="true" />
            <div className="sk-sheet-head">
              <h2 className="sk-sheet-title" id={titleId}>
                {title}
              </h2>
              <button type="button" className="sk-sheet-close" aria-label="Close" onClick={onClose}>
                <IconClose size={20} />
              </button>
            </div>

            <div className="sk-sheet-body">
              {image ? (
                <div className="sk-sheet-preview">
                  <div className="sk-sheet-thumb" data-busy={busy} style={size ? { aspectRatio: `${size.width} / ${size.height}` } : { minHeight: 105 }}>
                    {blobUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- an object URL for the PNG drawn in the page
                      <img src={blobUrl} alt="Your post as it will be saved" />
                    ) : null}
                  </div>
                  <div className="sk-sheet-preview-text">
                    <b>{summary ?? "Your post is ready"}</b>
                    <span>{shareDisplayUrl(code)}</span>
                    <span>{size ? `PNG, ${size.width} × ${size.height}, QR code included` : "PNG, QR code included"}</span>
                  </div>
                </div>
              ) : null}

              {canNative ? (
                <SkButton variant="primary" block onClick={shareNative} disabled={Boolean(image) && busy}>
                  <IconShare size={19} />
                  Share with…
                </SkButton>
              ) : null}

              <p className="sk-sheet-sub">{canNative ? "Or post it yourself" : "Post it in three steps"}</p>
              <ol className="sk-sheet-list">
                {image ? (
                  <li>
                    <button
                      type="button"
                      className="sk-sheet-act"
                      data-done={done.image}
                      disabled={!blobUrl}
                      onClick={() => {
                        if (!blobUrl) return;
                        downloadBlob(blobUrl, name);
                        mark("image", "Image saved");
                      }}
                    >
                      <span className="sk-sheet-ico">{done.image ? <IconCheck strokeWidth={2.4} /> : <span className="sk-sheet-num">1</span>}</span>
                      <span className="sk-sheet-act-text">
                        <b>Save the image</b>
                        <span>{done.image && inApp ? "Not in your photos? Press and hold the picture above." : "The QR code and your link are in the artwork."}</span>
                      </span>
                      <IconDownload />
                    </button>
                  </li>
                ) : null}
                <li>
                  <button type="button" className="sk-sheet-act" data-done={done.caption} onClick={() => copy("caption", caption, "Caption copied")}>
                    <span className="sk-sheet-ico">{done.caption ? <IconCheck strokeWidth={2.4} /> : <span className="sk-sheet-num">{image ? 2 : 1}</span>}</span>
                    <span className="sk-sheet-act-text">
                      <b>{done.caption ? "Caption copied" : "Copy the caption"}</b>
                      <span>Text and hashtags, ready to paste.</span>
                    </span>
                    <IconText />
                  </button>
                </li>
                <li>
                  <div className="sk-sheet-act" style={{ cursor: "default" }}>
                    <span className="sk-sheet-ico">
                      <span className="sk-sheet-num">{image ? 3 : 2}</span>
                    </span>
                    <span className="sk-sheet-act-text">
                      <b>Open your app and post</b>
                      <span>Paste the caption. In a story, add a link sticker with your link.</span>
                    </span>
                  </div>
                </li>
              </ol>

              {inApp ? (
                <p className="sk-hint">
                  You are inside an app&apos;s own browser, where saving can be blocked. If it is, press and hold the picture, or open this page in your
                  phone&apos;s browser from the menu.
                </p>
              ) : null}

              <p className="sk-sheet-sub">Your link</p>
              <ul className="sk-sheet-list">
                <li>
                  <button type="button" className="sk-sheet-act" data-done={done.link} onClick={() => copy("link", url, "Link copied")}>
                    <span className="sk-sheet-ico">{done.link ? <IconCheck strokeWidth={2.4} /> : <IconLink />}</span>
                    <span className="sk-sheet-act-text">
                      <b>{done.link ? "Link copied" : "Copy link"}</b>
                      <span>{shareDisplayUrl(code)}</span>
                    </span>
                    <IconCopy />
                  </button>
                </li>
                {snippet ? (
                  <li>
                    <button type="button" className="sk-sheet-act" aria-expanded={embedOpen} onClick={() => setEmbedOpen((v) => !v)}>
                      <span className="sk-sheet-ico">
                        <IconCode />
                      </span>
                      <span className="sk-sheet-act-text">
                        <b>Embed on your website</b>
                        <span>A small widget with one button. Your code travels in the link.</span>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {embedOpen ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
                          style={{ overflow: "hidden" }}
                        >
                          <div className="sk-sheet-embed">
                            <pre className="sk-code" tabIndex={0} aria-label="Embed code">
                              {snippet}
                            </pre>
                            <SkButton variant="secondary" size="s" onClick={() => copy("embed", snippet, "Embed code copied")}>
                              {done.embed ? <IconCheck size={16} strokeWidth={2.4} /> : <IconCopy size={16} />}
                              {done.embed ? "Code copied" : "Copy code"}
                            </SkButton>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </li>
                ) : null}
              </ul>
              <span className="sk-sr" role="status">
                {status}
              </span>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
