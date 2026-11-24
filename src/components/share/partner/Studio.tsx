"use client";

/**
 * Step 3: the content studio. Three phones (feed post, story, short video) sit side by side; the
 * one in the middle plays. Under them the partner picks the footage, adds their name and a short
 * line, and tunes the caption. The link and the QR code are in the artwork from the start.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import {
  CaptionEditor,
  IconCheck,
  IconReplay,
  POST_FORMATS,
  PostPreview,
  type IslandReelHandle,
  type PostFormat,
} from "@/components/share/kit";
import { featuredReel, formatDuration, hashtagSuggestions, reelSeconds, reelsForIsland, shareCopy, shareDisplayUrl } from "@/lib/share";
import { LINE_LIMIT, LINE_SUGGESTIONS, NAME_LIMIT, defaultByline, photosForIsland, type PostingYear } from "./data";
import { IconPen, IconPhoto, IconQr, IconVideo, Photo, Segmented } from "./parts";
import { PostMedia, type Draft, type Post } from "./post";

const FORMAT_OPTIONS = POST_FORMATS.map((id) => ({ id, label: shareCopy.formats[id] }));
const COUNT = POST_FORMATS.length;

/** Where a phone sits relative to the one in the middle: -1, 0 or 1. The row wraps round. */
const seat = (i: number, middle: number) => ((i - middle + COUNT + 1) % COUNT) - 1;

/* ------------------------------------------------------------------ */
/* The three phones                                                    */
/* ------------------------------------------------------------------ */

export function FormatStage({
  post,
  format,
  onFormat,
  player,
}: {
  post: Post;
  format: PostFormat;
  onFormat: (format: PostFormat) => void;
  player?: RefObject<IslandReelHandle | null>;
}) {
  const index = POST_FORMATS.indexOf(format);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const previous = useRef(index);
  // The phone that goes round the back (left edge to right edge or the reverse) fades out, jumps
  // and fades in, instead of sweeping across behind the others.
  const [wrap, setWrap] = useState<{ format: PostFormat; flip: boolean } | null>(null);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = index;
    if (before === index) return;
    const jumper = POST_FORMATS.find((_, i) => Math.abs(seat(i, index) - seat(i, before)) > 1);
    setWrap((w) => (jumper ? { format: jumper, flip: !w?.flip } : null));
  }, [index]);

  const onDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onUp = (e: PointerEvent) => {
    const from = start.current;
    start.current = null;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    swiped.current = true;
    onFormat(POST_FORMATS[(index + (dx < 0 ? 1 : -1) + COUNT) % COUNT]);
  };

  return (
    <div
      className="pf-stage"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => (start.current = null)}
      onClickCapture={(e) => {
        // A swipe that ends on the video must not also pause it.
        if (!swiped.current) return;
        swiped.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <span className="pf-stage-rings" aria-hidden="true" />
      {POST_FORMATS.map((f, i) => {
        const active = i === index;
        return (
          <div
            className="pf-stage-item"
            key={f}
            data-active={active}
            data-format={f}
            data-wrap={wrap?.format === f ? (wrap.flip ? "a" : "b") : undefined}
            style={{ "--d": seat(i, index) } as CSSProperties}
          >
            <div className="pf-stage-phone" aria-hidden={!active}>
              <PostPreview
                format={f}
                label={false}
                author={post.author}
                caption={post.draft.caption}
                hashtags={post.draft.tags}
                link={shareDisplayUrl(post.code)}
                media={<PostMedia ref={active ? player : undefined} post={post} format={f} live={active} sizes="(max-width: 480px) 60vw, 280px" />}
              />
            </div>
            {active ? null : <button type="button" className="pf-stage-pick" tabIndex={-1} aria-label={`Show the ${shareCopy.formats[f].toLowerCase()}`} onClick={() => onFormat(f)} />}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The studio                                                          */
/* ------------------------------------------------------------------ */

type Tool = "footage" | "touch" | "caption";

export function Studio({ post, year, patch }: { post: Post; year: PostingYear; patch: (change: Partial<Draft>) => void }) {
  const { partner, draft } = post;
  const [tool, setTool] = useState<Tool>("footage");
  const [atEnd, setAtEnd] = useState(false);
  const player = useRef<IslandReelHandle | null>(null);
  const reels = reelsForIsland(draft.islandId);
  const photos = photosForIsland(draft.islandId);
  const isPhoto = draft.footage.kind === "photo";
  const stillFormat = isPhoto && draft.format !== "short";
  const selectedReel = draft.footage.kind === "reel" ? (reels.find((r) => r.id === (draft.footage as { id: string }).id) ?? reels[0]) : null;
  const slotOf = (reelId: string) => year.slots.find((s) => s.reel.id === reelId);
  // Going to a photo and back returns to the video that was chosen before.
  const lastReel = useRef(selectedReel?.id ?? featuredReel(draft.islandId).id);
  useEffect(() => {
    if (selectedReel) lastReel.current = selectedReel.id;
  }, [selectedReel]);

  // New footage or another format starts from the first scene.
  useEffect(() => setAtEnd(false), [draft.footage, draft.format]);

  // Keep the chosen video or photo in view in the row of thumbnails.
  const picks = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const row = picks.current;
    const chosen = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chosen || row.scrollWidth <= row.clientWidth) return;
    const a = row.getBoundingClientRect();
    const b = chosen.getBoundingClientRect();
    row.scrollTo({ left: row.scrollLeft + (b.left - a.left) - (a.width - b.width) / 2, behavior: "smooth" });
  }, [draft.footage, tool]);

  const toggleEnd = () => {
    if (atEnd) player.current?.restart();
    else player.current?.showEnd();
    setAtEnd(!atEnd);
  };

  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "footage", label: "Footage", icon: <IconVideo size={17} /> },
    { id: "touch", label: "Your touch", icon: <IconPen size={17} /> },
    { id: "caption", label: "Caption", icon: <span className="pf-hash" aria-hidden="true">#</span> },
  ];

  return (
    <div className="pf-studio">
      <header className="pf-head pf-studio-head pf-rise" style={{ "--i": 0 } as CSSProperties}>
        <p className="sk-eyebrow">
          {post.islandName} · {partner.offer.title}
        </p>
        <h1 className="sk-h2 pf-h1">
          Make it <em>yours.</em>
        </h1>
        <p className="sk-lead">Pick the footage, add your name or a line. Your link and QR code are already inside.</p>
      </header>

      <div className="pf-studio-stage pf-rise" style={{ "--i": 1 } as CSSProperties}>
        <Segmented options={FORMAT_OPTIONS} value={draft.format} onChange={(format) => patch({ format })} label="Post format" />
        <FormatStage post={post} format={draft.format} onFormat={(format) => patch({ format })} player={player} />
        <div className="pf-stage-bar">
          {stillFormat ? (
            <span className="pf-built">
              <IconQr size={16} />
              QR code and link are on the picture
            </span>
          ) : (
            <>
              <button type="button" className="pf-mini" onClick={() => (player.current?.restart(), setAtEnd(false))}>
                <IconReplay size={16} />
                Replay
              </button>
              <button type="button" className="pf-mini" data-on={atEnd} aria-pressed={atEnd} onClick={toggleEnd}>
                <IconQr size={16} />
                {atEnd ? "Back to the video" : "See the QR end card"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="pf-tools pf-rise" style={{ "--i": 2 } as CSSProperties}>
        <div className="pf-tabs" role="group" aria-label="What to change">
          {tools.map((t) => (
            <button type="button" key={t.id} className="pf-tab" aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ---------------------------------------------------- footage */}
        <section className="sk-card pf-tool" data-open={tool === "footage"} aria-labelledby="pf-tool-footage">
          <div className="pf-tool-head">
            <h2 className="sk-h3" id="pf-tool-footage">
              Footage
            </h2>
            <Segmented
              size="s"
              label="Kind of footage"
              value={isPhoto ? "photo" : "reel"}
              onChange={(kind) => patch({ footage: kind === "photo" ? { kind: "photo", name: photos[0].name } : { kind: "reel", id: lastReel.current } })}
              options={[
                { id: "reel", label: "Six videos", icon: <IconVideo size={15} /> },
                { id: "photo", label: "Photo", icon: <IconPhoto size={15} /> },
              ]}
            />
          </div>

          {isPhoto ? (
            <>
              <ul className="pf-picks" data-kind="photo" ref={picks}>
                {photos.map((photo) => {
                  const on = draft.footage.kind === "photo" && draft.footage.name === photo.name;
                  return (
                    <li key={photo.name}>
                      <button type="button" className="pf-pick" aria-pressed={on} aria-label={photo.line} onClick={() => patch({ footage: { kind: "photo", name: photo.name } })}>
                        <Photo name={photo.name} focus={photo.focus} sizes="120px" eager />
                        {on ? (
                          <span className="pf-pick-on">
                            <IconCheck size={13} strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="pf-pick-detail">
                <b>{post.photo?.line}</b>
                <span>A single photo with your QR code on it. As a short video it gets a slow zoom and the end card.</span>
              </div>
            </>
          ) : (
            <>
              <ul className="pf-picks" data-kind="reel" ref={picks}>
                {reels.map((reel) => {
                  const on = selectedReel?.id === reel.id;
                  const slot = slotOf(reel.id);
                  return (
                    <li key={reel.id}>
                      <button
                        type="button"
                        className="pf-pick"
                        aria-pressed={on}
                        aria-label={`Video ${reel.number}: ${reel.title}${slot?.status === "posted" ? " (already posted)" : ""}`}
                        onClick={() => patch({ footage: { kind: "reel", id: reel.id } })}
                      >
                        <Photo name={reel.scenes[0].photo} focus={reel.scenes[0].focus} sizes="120px" eager />
                        <span className="pf-pick-shade" />
                        <span className="pf-pick-n">{reel.number}</span>
                        <span className="pf-pick-time">{formatDuration(reelSeconds(reel) + reel.endCardSeconds)}</span>
                        {slot?.status === "posted" ? (
                          <span className="pf-pick-posted">
                            <IconCheck size={11} strokeWidth={3.2} />
                            <i>Posted</i>
                          </span>
                        ) : slot?.status === "due" ? (
                          <span className="pf-pick-next">Next</span>
                        ) : null}
                        {on ? (
                          <span className="pf-pick-on">
                            <IconCheck size={13} strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {selectedReel ? (
                <div className="pf-pick-detail">
                  <b>
                    {selectedReel.number}. {selectedReel.title}
                  </b>
                  <span>{selectedReel.summary}</span>
                  <span className="pf-pick-meta">
                    <i>{selectedReel.theme}</i>
                    <i>{selectedReel.scenes.length} scenes</i>
                    {slotOf(selectedReel.id)?.status === "posted" ? <i data-tone="done">Posted {slotOf(selectedReel.id)?.postedOn}</i> : null}
                    {slotOf(selectedReel.id)?.status === "due" ? <i data-tone="next">Suggested next</i> : null}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* ------------------------------------------------- your touch */}
        <section className="sk-card pf-tool" data-open={tool === "touch"} aria-labelledby="pf-tool-touch">
          <div className="pf-tool-head">
            <h2 className="sk-h3" id="pf-tool-touch">
              Your touch
            </h2>
            <span className="sk-note">Printed inside the video</span>
          </div>

          <div className="pf-field">
            <div className="pf-field-row">
              <label className="sk-field-label" htmlFor="pf-name">
                Your name
              </label>
              <button type="button" className="pf-toggle" role="switch" aria-checked={draft.showName} aria-label="Show my name on the video" onClick={() => patch({ showName: !draft.showName })}>
                <i />
              </button>
            </div>
            <span className="pf-input" data-off={!draft.showName}>
              <input
                id="pf-name"
                value={draft.name}
                maxLength={NAME_LIMIT}
                disabled={!draft.showName}
                placeholder={defaultByline(partner)}
                autoComplete="off"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </span>
          </div>

          <div className="pf-field">
            <div className="pf-field-row">
              <label className="sk-field-label" htmlFor="pf-line">
                A short line of your own
              </label>
              <span className="pf-limit" data-near={draft.message.length > LINE_LIMIT - 8}>
                {draft.message.length} / {LINE_LIMIT}
              </span>
            </div>
            <span className="pf-input">
              <input
                id="pf-line"
                value={draft.message}
                maxLength={LINE_LIMIT}
                placeholder="Say it in a few words"
                autoComplete="off"
                onChange={(e) => patch({ message: e.target.value })}
              />
            </span>
            <ul className="pf-suggest" aria-label="Suggested lines">
              {LINE_SUGGESTIONS[partner.type].map((line) => (
                <li key={line}>
                  <button type="button" className="sk-chip" aria-pressed={draft.message === line} onClick={() => patch({ message: line })}>
                    {line}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="sk-chip" aria-pressed={draft.message === ""} onClick={() => patch({ message: "" })}>
                  No line
                </button>
              </li>
            </ul>
          </div>
          <p className="sk-hint">Same video, new line: that is how one island video becomes a different post each time.</p>
        </section>

        {/* ---------------------------------------------------- caption */}
        <section className="sk-card pf-tool" data-open={tool === "caption"} aria-labelledby="pf-tool-caption">
          <div className="pf-tool-head">
            <h2 className="sk-h3" id="pf-tool-caption">
              Caption and hashtags
            </h2>
          </div>
          <CaptionEditor
            label="Caption"
            value={draft.caption}
            onChange={(caption) => patch({ caption })}
            suggestions={post.suggestions}
            hashtags={hashtagSuggestions(draft.islandId, partner.type)}
            selected={draft.tags}
            onSelectedChange={(tags) => patch({ tags })}
          />
          <p className="sk-hint">Links in captions are not tappable on most social apps, so the captions point people to the QR code and your profile link.</p>
        </section>
      </div>
    </div>
  );
}
