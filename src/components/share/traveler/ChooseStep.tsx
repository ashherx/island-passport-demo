"use client";

/**
 * Step 2: what to share. Three choices, each shown as the story it would make, with the link it
 * creates. Sharing an island page also asks which island (any island the traveler holds a stamp on).
 */
import type { CSSProperties, KeyboardEvent } from "react";
import { IconCheck, IconLink } from "@/components/share/kit";
import { SHARE_DOMAIN, shareUrl } from "@/lib/share";
import type { DirectionId, Island, PassportData, StampSlot, StampStatus } from "@/lib/types";
import { PostCanvas } from "./PostCanvas";
import { copy } from "./copy";
import { SUBJECTS, codeFor, featuredStamp, headlineSuggestions, type ShareSubject } from "./data";

export interface ChooseStepProps {
  subject: ShareSubject;
  onSubject: (subject: ShareSubject) => void;
  islandId: string;
  onIsland: (islandId: string) => void;
  islands: { island: Island; slots: StampSlot[]; index: number }[];
  direction: DirectionId;
  status: StampStatus;
  passport: PassportData;
}

export function ChooseStep({ subject, onSubject, islandId, onIsland, islands, direction, status, passport }: ChooseStepProps) {
  const stamp = featuredStamp(passport);
  /** Arrow keys move the choice, as they do in a native radio group. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step || !(e.target instanceof HTMLElement) || e.target.getAttribute("role") !== "radio") return;
    e.preventDefault();
    const next = SUBJECTS[(SUBJECTS.indexOf(subject) + step + SUBJECTS.length) % SUBJECTS.length];
    onSubject(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-subject="${next}"]`)?.focus();
  };
  return (
    <div className="skt-choose" role="radiogroup" aria-label={copy.head.choose.title} onKeyDown={onKeyDown}>
      {SUBJECTS.map((option, i) => {
        const on = option === subject;
        // The island card previews the island that is picked; the others stay on the stamp's own island.
        const island = option === "island" && on ? islandId : stamp.islandId;
        const code = codeFor(option, island);
        const name = islands.find((e) => e.island.id === island)?.island.name ?? stamp.island;
        const detail = option === "stamp" ? `${stamp.title} · ${stamp.island}` : option === "island" ? name : `${passport.holder.name} · ${passport.province}`;
        return (
          <div key={option} className="skt-option sk-card" data-on={on} style={{ "--i": i } as CSSProperties}>
            <button type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-subject={option} className="skt-option-main" onClick={() => onSubject(option)}>
              <span className="skt-option-thumb" aria-hidden="true">
                <PostCanvas
                  scale={0.34}
                  label=""
                  spec={{ format: "story", subject: option, direction, status, islandId: island, headline: headlineSuggestions(option, island, passport)[0], code, qrValue: shareUrl(code) }}
                />
              </span>
              <span className="skt-option-text">
                <span className="skt-option-title">{copy.subjects[option].title}</span>
                <span className="skt-option-detail">{detail}</span>
                <span className="skt-option-blurb">
                  {copy.subjects[option].blurb} {copy.subjects[option].lands}
                </span>
                <span className="skt-option-link">
                  <IconLink size={14} />
                  <span>
                    {SHARE_DOMAIN}/s/<b>{code}</b>
                  </span>
                </span>
              </span>
              <span className="skt-option-check" aria-hidden="true">
                <IconCheck size={15} strokeWidth={2.6} />
              </span>
            </button>
            {option === "island" && on ? (
              <div className="skt-option-more">
                <span className="sk-field-label">{copy.choose.island}</span>
                <div className="skt-chips" role="group" aria-label={copy.choose.island}>
                  {islands.map((entry) => (
                    <button key={entry.island.id} type="button" className="sk-chip" aria-pressed={entry.island.id === islandId} onClick={() => onIsland(entry.island.id)}>
                      {entry.island.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
