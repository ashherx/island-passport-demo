"use client";

/**
 * <LinkField />: the affiliate link with a Copy button that confirms itself.
 *
 * What is printed and copied is the fictional product URL (islandpassport.app/s/<code>); tapping
 * the link itself follows the in-demo route /s/<code>, so the recipient page really opens.
 */
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SHARE_DOMAIN, sharePath, shareUrl } from "@/lib/share/urls";
import { useCopy, usePrefersReducedMotion } from "./hooks";
import { IconCheck, IconCopy, IconLink } from "./icons";

export interface LinkFieldProps {
  /** Share code, e.g. "mia-bohol" (`shareCode(owner, islandId)`). */
  code: string;
  /** Label above the field. Default "Your link". Pass false for none. */
  label?: ReactNode | false;
  /** Small print under the field, e.g. "Your code travels in the link, so you get the credit." */
  hint?: ReactNode;
  /** Open the recipient page in a new tab instead of this one. Default false. */
  newTab?: boolean;
  /** Called after a successful copy, with the copied URL. */
  onCopied?: (url: string) => void;
  className?: string;
}

export function LinkField({ code, label = "Your link", hint, newTab = false, onCopied, className = "" }: LinkFieldProps) {
  const { copied, failed, copy } = useCopy();
  const reduced = usePrefersReducedMotion();
  const url = shareUrl(code);
  const swap = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

  return (
    <div className={`sk-link ${className}`} data-copied={copied}>
      {label ? <span className="sk-field-label">{label}</span> : null}
      <div className="sk-link-row">
        <IconLink className="sk-link-icon" size={20} />
        <Link
          className="sk-link-url"
          href={sharePath(code)}
          target={newTab ? "_blank" : undefined}
          aria-label={`Open ${SHARE_DOMAIN}/s/${code}: what people see when they follow your link`}
        >
          {SHARE_DOMAIN}/s/<b>{code}</b>
        </Link>
        <button
          type="button"
          className="sk-copy"
          data-copied={copied}
          onClick={async () => {
            if (await copy(url)) onCopied?.(url);
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={copied ? "done" : "copy"} {...swap} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              {copied ? <IconCheck size={17} strokeWidth={2.4} /> : <IconCopy size={17} />}
              {copied ? "Copied" : "Copy"}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <span className="sk-sr" role="status">
        {copied ? "Link copied" : failed ? "Could not copy. Press and hold the link to copy it." : ""}
      </span>
      {failed ? <p className="sk-hint">Could not copy here. Press and hold the link to copy it.</p> : hint ? <p className="sk-hint">{hint}</p> : null}
    </div>
  );
}
