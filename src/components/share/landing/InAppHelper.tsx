"use client";

/**
 * "Open in your browser": the gentle helper shown when the page is inside a social app's embedded
 * browser. It never blocks: the whole page works underneath, the helper folds away, and staying
 * put is offered as a fine choice (the 6-digit code works in the same tab).
 *
 * Detection happens on the server from the user agent (inapp.ts), so the helper is in the first
 * paint. `?inapp=instagram|tiktok|facebook` forces it for the demo; in that case a neutral mock of
 * an in-app browser bar is drawn on top so it is obvious what is being simulated.
 */
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconCheck, IconClose, IconCopy, IconDots, useCopy, usePrefersReducedMotion } from "@/components/share/kit";
import { liveShareUrl, shareDisplayUrl, sharePath } from "@/lib/share";
import { IconChevron, IconCompass, IconLock } from "./icons";
import { IN_APP_REASONS, PLATFORM_NAME, browserName, openInBrowserSteps, type InAppInfo } from "./inapp";

const DISMISS_KEY = "ip.share.inapp.dismissed";
const EASE = [0.22, 1, 0.36, 1] as const;

export function InAppHelper({ info, code }: { info: InAppInfo | null; code: string }) {
  const reduced = usePrefersReducedMotion();
  const { copied, failed, copy } = useCopy(2200);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (info && !info.simulated && sessionStorage.getItem(DISMISS_KEY) === info.platform) setDismissed(true);
    } catch {
      /* storage may be blocked */
    }
  }, [info]);

  if (!info) return null;
  const app = PLATFORM_NAME[info.platform];
  const browser = browserName(info.os);
  const steps = openInBrowserSteps(info.platform, info.os);
  const display = shareDisplayUrl(code);

  const dismiss = () => {
    setDismissed(true);
    setOpen(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, info.platform);
    } catch {
      /* fine */
    }
  };

  const reveal = () => {
    setDismissed(false);
    setOpen(true);
  };

  return (
    <>
      {info.simulated ? (
        <div className="lp-sim" role="group" aria-label={`Simulated ${app} in-app browser bar`}>
          <Link className="lp-sim-btn" href={sharePath(code)} aria-label="Leave the simulated in-app browser" scroll={false}>
            <IconClose size={20} />
          </Link>
          <span className="lp-sim-url">
            <IconLock size={13} />
            <span>{display}</span>
          </span>
          <button type="button" className="lp-sim-btn" aria-label="Browser menu: how to open this page in your browser" aria-expanded={open && !dismissed} onClick={() => (open && !dismissed ? setOpen(false) : reveal())}>
            <IconDots size={20} />
          </button>
          <span className="lp-sim-tag">{app} in-app browser · simulated</span>
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {dismissed ? null : (
          <motion.aside
            className="lp-inapp"
            aria-label={`Open in ${browser}`}
            data-open={open}
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className="lp-inapp-card">
              <div className="lp-inapp-row">
                <span className="lp-inapp-ico">
                  <IconCompass size={20} />
                </span>
                <p className="lp-inapp-text">
                  <b>You&apos;re in {app}&apos;s browser</b>
                  <span>It all works here. {browser === "your browser" ? "Your own browser" : browser} is smoother for sign-in links and saving.</span>
                </p>
                <button type="button" className="lp-inapp-x" aria-label="Stay here and hide this" onClick={dismiss}>
                  <IconClose size={18} />
                </button>
              </div>
              <div className="lp-inapp-acts">
                <button type="button" className="sk-chip" data-on="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                  How to open in {browser}
                  <IconChevron size={16} className="lp-inapp-chev" />
                </button>
                <button type="button" className="sk-chip" onClick={() => copy(liveShareUrl(code, window.location.origin))}>
                  {copied ? <IconCheck size={16} strokeWidth={2.4} /> : <IconCopy size={16} />}
                  {copied ? "Link copied" : "Copy link"}
                </button>
              </div>
              <span className="sk-sr" role="status">
                {copied ? "Link copied" : failed ? "Could not copy. Press and hold the link to copy it." : ""}
              </span>
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div className="lp-inapp-more" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0.01 : 0.34, ease: EASE }}>
                    <div className="lp-inapp-more-in">
                      <ol className="lp-inapp-steps">
                        <li>
                          <span>1</span>
                          {steps.menu}
                        </li>
                        <li>
                          <span>2</span>
                          {steps.choose}
                        </li>
                        <li data-alt="true">
                          <span>or</span>
                          <p>
                            Copy the link and paste it into {browser}: <b className="lp-mono">{display}</b>
                          </p>
                        </li>
                      </ol>
                      <ul className="lp-inapp-why">
                        {IN_APP_REASONS.map((reason) => (
                          <li key={reason.id}>
                            <b>{reason.title}</b>
                            <span>{reason.text}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="sk-note">
                        Menu wording varies by app version. Prefer to stay? That&apos;s fine: the 6-digit code signs you in right in this tab, and whoever shared this link keeps the credit either way.
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
