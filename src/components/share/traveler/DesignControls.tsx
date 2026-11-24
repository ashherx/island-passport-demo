"use client";

/**
 * Step 3 controls: the format (story, feed post, passport film), the traveler's own headline with
 * three ideas to start from, the island when an island page is shared, and the passport style.
 * <FilmConcept /> explains the film and offers to save it as a video where the browser can record.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { IconCheck, IconDownload, SkButton, downloadBlob, isInAppBrowser } from "@/components/share/kit";
import { DIRECTIONS } from "@/lib/directions";
import { strings, t } from "@/lib/strings";
import { DIRECTION_IDS, type DirectionId, type Island, type StampSlot } from "@/lib/types";
import { recordFilm, recordingSupport, type Film } from "./art/film";
import { copy } from "./copy";
import { FORMATS, HEADLINE_LIMIT, type ShareFormat, type ShareSubject } from "./data";

export interface DesignControlsProps {
  format: ShareFormat;
  headline: string;
  onHeadline: (headline: string) => void;
  suggestions: string[];
  direction: DirectionId;
  onDirection: (direction: DirectionId) => void;
  subject: ShareSubject;
  islands: { island: Island; slots: StampSlot[]; index: number }[];
  islandId: string;
  onIsland: (islandId: string) => void;
}

/** Story, feed post or the passport film. */
export function FormatTabs({ format, onFormat }: { format: ShareFormat; onFormat: (format: ShareFormat) => void }) {
  return (
    <div className="skt-seg" role="group" aria-label={copy.design.format}>
      {FORMATS.map((f) => (
        <button key={f} type="button" aria-pressed={format === f} data-format={f} onClick={() => onFormat(f)}>
          <b>{copy.formats[f].name}</b>
          <span>{copy.formats[f].hint}</span>
        </button>
      ))}
    </div>
  );
}

export function DesignControls({ format, headline, onHeadline, suggestions, direction, onDirection, subject, islands, islandId, onIsland }: DesignControlsProps) {
  const headlineId = useId();
  return (
    <div className="skt-controls">
      {format !== "film" ? (
        <section className="sk-card skt-panel">
          <div className="skt-field">
            <label className="sk-field-label" htmlFor={headlineId}>
              {copy.design.headline}
              <span className="skt-count" data-near={headline.length > HEADLINE_LIMIT - 8}>
                {headline.length} / {HEADLINE_LIMIT}
              </span>
            </label>
            <input
              id={headlineId}
              className="skt-input"
              value={headline}
              maxLength={HEADLINE_LIMIT}
              onChange={(e) => onHeadline(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
              aria-describedby={`${headlineId}-hint`}
            />
            <p className="sk-hint" id={`${headlineId}-hint`}>
              {copy.design.headlineHint}
            </p>
          </div>
          <div className="skt-ideas" role="group" aria-label={copy.design.ideas}>
            {suggestions.map((idea) => (
              <button key={idea} type="button" className="skt-idea" aria-pressed={idea === headline} onClick={() => onHeadline(idea)}>
                {idea}
              </button>
            ))}
          </div>
          {subject === "island" ? (
            <div className="skt-field">
              <span className="sk-field-label">{copy.design.island}</span>
              <div className="skt-chips" role="group" aria-label={copy.design.island}>
                {islands.map((entry) => (
                  <button key={entry.island.id} type="button" className="sk-chip" aria-pressed={entry.island.id === islandId} onClick={() => onIsland(entry.island.id)}>
                    {entry.island.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="sk-card skt-panel">
        <div className="skt-field">
          <span className="sk-field-label">{copy.design.style}</span>
          <div className="skt-styles" role="group" aria-label={copy.design.style}>
            {DIRECTION_IDS.map((id) => {
              const tokens = DIRECTIONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  className="skt-style"
                  aria-pressed={direction === id}
                  onClick={() => onDirection(id)}
                  style={{ "--cover": tokens.cover.base, "--cover-deep": tokens.cover.deep, "--foil": tokens.cover.material === "kraft" ? tokens.cover.ink : tokens.foil.base, "--paper": tokens.paper.base } as CSSProperties}
                >
                  <span className="skt-style-swatch" aria-hidden="true">
                    <i />
                  </span>
                  <span className="skt-style-name">{strings.theme.directions[id].name}</span>
                </button>
              );
            })}
          </div>
          <p className="sk-hint">{copy.design.styleHint}</p>
        </div>
      </section>
    </div>
  );
}

export interface FilmConceptProps {
  /** The film the preview is playing, once it is built. */
  film: Film | null;
  /** Share code, for the file name. */
  code: string;
  /** Only the save row and its note. */
  compact?: boolean;
}

/** What the passport film is, said plainly, and "Save video" where the browser can record a canvas. */
export function FilmConcept({ film, code, compact }: FilmConceptProps) {
  const [support, setSupport] = useState<ReturnType<typeof recordingSupport> | undefined>(undefined);
  const [state, setState] = useState<"idle" | "recording" | "saved" | "failed">("idle");
  const [percent, setPercent] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setSupport(recordingSupport());
    setInApp(isInAppBrowser());
  }, []);
  useEffect(() => () => abort.current?.abort(), []);
  // A different film (another style or status) is a different file.
  useEffect(() => setState((s) => (s === "recording" ? s : "idle")), [film]);

  const save = async () => {
    if (!film || !support || state === "recording") return;
    const controller = new AbortController();
    abort.current = controller;
    setState("recording");
    setPercent(0);
    try {
      const { blob, ext } = await recordFilm(film, (p) => setPercent(Math.round(p * 100)), controller.signal);
      downloadBlob(blob, `island-passport-film-${code}.${ext}`);
      setState("saved");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") setState("failed");
    }
  };

  const seconds = film ? Math.round(film.duration) : 13;
  return (
    <section className="sk-card skt-panel skt-concept" data-compact={compact}>
      {compact ? null : (
        <>
          <p className="skt-concept-tag">{copy.film.tag}</p>
          <h2 className="sk-h3">{copy.film.title}</h2>
          <p className="skt-concept-body">{copy.film.body}</p>
        </>
      )}
      {support ? (
        <>
          <SkButton variant="secondary" block onClick={save} disabled={!film || state === "recording"} aria-live="polite">
            {state === "saved" ? <IconCheck size={18} strokeWidth={2.4} /> : <IconDownload size={18} />}
            {state === "recording" ? t(copy.film.saving, { percent }) : state === "saved" ? `${t(copy.film.saved, { ext: support.ext })} · ${copy.film.again}` : `${copy.film.save} (.${support.ext})`}
            {state === "recording" ? <span className="skt-concept-bar" style={{ "--p": percent / 100 } as CSSProperties} aria-hidden="true" /> : null}
          </SkButton>
          <p className="sk-hint">
            {state === "failed" ? copy.film.failed : t(copy.film.saveHint, { seconds, ext: support.ext })}
            {inApp ? ` ${copy.film.inApp}` : ""}
          </p>
        </>
      ) : support === null ? (
        <p className="sk-hint">{copy.film.unsupported}</p>
      ) : null}
      <p className="sk-note">{copy.film.note}</p>
    </section>
  );
}
