"use client";

/**
 * Top header: the Island Passport wordmark, the collection progress ring (always visible, UX-1b)
 * and the appearance controls (three art directions plus light/dark).
 *
 *   <Header progress={getProgress(passport)} province={passport.province} />
 *
 * The appearance row is a demo control, so it sits on its own line under the bar and can be
 * turned off with appearance="none".
 */
import type { ReactNode } from "react";
import { contentStrings as cs } from "@/components/passport/content/strings";
import { ThemeSwitcher, useDirectionId } from "@/components/theme";
import { strings } from "@/lib/strings";
import type { PassportProgress } from "@/lib/types";
import { ProgressRing } from "./ProgressRing";
import "./chrome.css";

/** The emblem reduced to what survives at 24px: ring, three hills, sun, one wave. */
export function EmblemGlyph({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={["ipc-glyph", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M16 0.4V3.4M16 28.6V31.6M0.4 16H3.4M28.6 16H31.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="9.6" r="2.3" fill="currentColor" />
      <path d="M6.6 19A3.9 4.4 0 0 1 14.4 19ZM12.4 19A4.6 7 0 0 1 21.6 19ZM19.6 19A3 3.5 0 0 1 25.6 19Z" fill="currentColor" />
      <path
        d="M8.2 23.2q1.95 -1.9 3.9 0t3.9 0t3.9 0t3.9 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ href, className }: { href?: string; className?: string }) {
  const inner = (
    <>
      <EmblemGlyph className="ipc-wordmark__glyph" />
      <span className="ipc-wordmark__text">{strings.app.name}</span>
    </>
  );
  const classes = ["ipc-wordmark", className].filter(Boolean).join(" ");
  return href ? (
    <a className={classes} href={href} aria-label={cs.header.home}>
      {inner}
    </a>
  ) : (
    <span className={classes}>{inner}</span>
  );
}

export interface HeaderProps {
  progress: PassportProgress;
  /** Province the ring counts, e.g. "Bohol". */
  province: string;
  /** Stick to the top of the viewport. Default true. */
  sticky?: boolean;
  /** "row" (default) shows the art-direction switcher under the bar; "none" hides it. */
  appearance?: "row" | "none";
  /** Colour the ring arc by status instead of one accent colour. Default true. */
  ringBreakdown?: boolean;
  /** Makes the ring a button (e.g. to open My Stats). */
  onProgressClick?(): void;
  /** Link target of the wordmark. Without it the wordmark is plain text. */
  homeHref?: string;
  /** Extra controls at the right end of the bar. */
  actions?: ReactNode;
  className?: string;
}

export function Header({
  progress,
  province,
  sticky = true,
  appearance = "row",
  ringBreakdown = true,
  onProgressClick,
  homeHref,
  actions,
  className,
}: HeaderProps) {
  const dir = useDirectionId();
  return (
    <header
      className={["ipc-header", className].filter(Boolean).join(" ")}
      data-sticky={sticky ? "" : undefined}
      data-dir={dir}
    >
      <div className="ipc-header__bar">
        <Wordmark href={homeHref} />
        <div className="ipc-header__end">
          <ProgressRing
            collected={progress.collected}
            total={progress.total}
            province={province}
            breakdown={
              ringBreakdown
                ? { verified: progress.verified, pending: progress.pending, discovery: progress.discovery }
                : undefined
            }
            onClick={onProgressClick}
          />
          {actions}
        </div>
      </div>
      {appearance === "row" && (
        <div className="ipc-header__appearance">
          <span className="ipc-header__appearance-label">{cs.header.appearance}</span>
          <ThemeSwitcher className="ipc-header__switch ipc-header__switch--full" />
          <ThemeSwitcher variant="compact" className="ipc-header__switch ipc-header__switch--compact" />
        </div>
      )}
    </header>
  );
}
