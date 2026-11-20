"use client";

/**
 * Status label that morphs from "Donation pending" to "Verified Supporter" (UX-3, STM-7).
 * Pure CSS: flip `status` and the dashed hollow chip fills with ink from the left, the clock
 * turns into a foil check and the words roll over. No layout animates (both labels share one
 * grid cell, so the chip is always as wide as the longer one).
 */
import type { CSSProperties } from "react";
import { strings } from "@/lib/strings";
import "./celebrations.css";

export interface StatusChipProps {
  status: "pending" | "verified";
  /**
   * What the chip sits on. "paper" uses the stamp inks (legible on passport pages),
   * "chrome" uses the --status-* colours (legible on the app background in light and dark).
   */
  surface?: "paper" | "chrome";
  /** False renders the end state without transitions. Default true. */
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function StatusChip({ status, surface = "paper", animated = true, className, style }: StatusChipProps) {
  return (
    <span
      className={["ipc-chip", className].filter(Boolean).join(" ")}
      style={style}
      data-status={status}
      data-surface={surface}
      data-animated={animated ? "" : undefined}
    >
      <span className="ipc-chip__fill" aria-hidden="true" />
      <span className="ipc-chip__sheen" aria-hidden="true" />
      <span className="ipc-chip__icon" aria-hidden="true">
        <svg className="ipc-chip__clock" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 4.6 V8 L10.3 9.4" />
        </svg>
        <span className="ipc-chip__seal foil-fill">
          <svg viewBox="0 0 16 16" fill="none" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.4 8.3 L7 10.8 L11.7 5.4" />
          </svg>
        </span>
      </span>
      <span className="ipc-chip__labels">
        <span className="ipc-chip__label" data-for="pending" aria-hidden={status !== "pending"}>
          {strings.status.pending.label}
        </span>
        <span className="ipc-chip__label" data-for="verified" aria-hidden={status !== "verified"}>
          {strings.status.verified.label}
        </span>
      </span>
    </span>
  );
}
