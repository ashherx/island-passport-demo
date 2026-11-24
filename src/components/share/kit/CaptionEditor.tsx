"use client";

/**
 * <CaptionEditor />: suggested captions by tone, a textarea that grows, hashtag chips that
 * toggle, and a live character count for the caption as it will be posted (text plus hashtags).
 * Controlled: the parent owns the text and the list of hashtags that are switched on.
 */
import { useId, type ReactNode } from "react";
import { CAPTION_LIMIT } from "@/lib/share/sample";
import type { CaptionSuggestion } from "@/lib/share/types";
import { IconCheck, IconPlus } from "./icons";

/** The caption as posted: the text, a blank line, then the hashtags. */
export function composeCaption(text: string, hashtags: readonly string[] = []): string {
  const body = text.trim();
  const tags = hashtags.join(" ");
  return body && tags ? `${body}\n\n${tags}` : body || tags;
}

export interface CaptionEditorProps {
  /** Caption text, without the hashtags. */
  value: string;
  onChange: (value: string) => void;
  /** Every hashtag on offer, e.g. `hashtagSuggestions(islandId, partner.type)`. */
  hashtags: readonly string[];
  /** The ones switched on, e.g. start from `defaultHashtags(...)`. */
  selected: readonly string[];
  onSelectedChange: (selected: string[]) => void;
  /** Ready-made captions shown as tone chips, e.g. `captionSuggestions(owner, islandId)`. */
  suggestions?: readonly CaptionSuggestion[];
  /** Character limit for text plus hashtags. Default 2,200. */
  limit?: number;
  label?: ReactNode;
  placeholder?: string;
  className?: string;
}

export function CaptionEditor({
  value,
  onChange,
  hashtags,
  selected,
  onSelectedChange,
  suggestions = [],
  limit = CAPTION_LIMIT,
  label = "Caption",
  placeholder = "Say it in your own words",
  className = "",
}: CaptionEditorProps) {
  const id = useId();
  const count = composeCaption(value, selected).length;
  const level = count > limit ? "over" : count > limit * 0.9 ? "near" : "ok";
  const number = new Intl.NumberFormat("en-US");
  const activeTone = suggestions.find((s) => s.text === value)?.id;

  const toggle = (tag: string) =>
    // Keep the order the tags are offered in, whatever order they were tapped in.
    onSelectedChange(hashtags.filter((t) => (t === tag ? !selected.includes(t) : selected.includes(t))));

  return (
    <div className={`sk-cap ${className}`}>
      <div className="sk-cap-head">
        <label className="sk-field-label" htmlFor={`${id}-text`}>
          {label}
        </label>
        <span className="sk-cap-count" data-level={level} aria-hidden="true">
          {number.format(count)} / {number.format(limit)}
        </span>
        <span className="sk-sr" role="status">
          {level === "over" ? `Caption is ${number.format(count - limit)} characters over the limit` : level === "near" ? `${number.format(limit - count)} characters left` : ""}
        </span>
      </div>

      {suggestions.length ? (
        <ul className="sk-cap-tones" aria-label="Suggested captions">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button type="button" className="sk-chip" aria-pressed={activeTone === s.id} onClick={() => onChange(s.text)}>
                {s.tone}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="sk-cap-box">
        <div className="sk-cap-grow" data-value={value}>
          <textarea
            id={`${id}-text`}
            value={value}
            rows={3}
            placeholder={placeholder}
            aria-describedby={`${id}-tags-on`}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <p className="sk-cap-on" id={`${id}-tags-on`} aria-label={selected.length ? `Hashtags: ${selected.join(" ")}` : "No hashtags"}>
          {selected.join(" ")}
        </p>
      </div>

      {hashtags.length ? (
        <>
          <span className="sk-cap-sub" id={`${id}-tags`}>
            Hashtags
          </span>
          <ul className="sk-cap-tags" aria-labelledby={`${id}-tags`}>
            {hashtags.map((tag) => {
              const on = selected.includes(tag);
              return (
                <li key={tag}>
                  <button type="button" className="sk-chip" aria-pressed={on} onClick={() => toggle(tag)}>
                    {on ? <IconCheck size={14} strokeWidth={2.4} /> : <IconPlus size={14} />}
                    {tag}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
