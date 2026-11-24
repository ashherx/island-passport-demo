"use client";

/**
 * The traveler share flow (/share/traveler): what happens after a stamp.
 *
 *   1. Stamped   the moment itself: the fresh stamp, and the offer to share it
 *   2. Choose    my passport, this island page, or this stamp (each makes its own link)
 *   3. Design    a story card, a feed card or the passport film, in the traveler's art direction
 *   4. Share     caption, personal link and QR code, then the kit's share sheet
 *
 * The posts and the film are drawn by one canvas renderer (./art), so the preview is the file.
 * Every step can be opened directly: ?step=&share=&format=&style=&status=&island= (see the doc).
 * Notes: docs/agents/p3-traveler.md
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  CaptionEditor,
  IconArrow,
  IconBack,
  IconShare,
  LinkField,
  PostPreview,
  QrCode,
  ShareSheet,
  ShareShell,
  SkButton,
  StepHeader,
  authorOf,
  composeCaption,
  usePrefersReducedMotion,
  useShareTarget,
} from "@/components/share/kit";
import { useTheme } from "@/components/theme";
import { getProgress } from "@/lib/sample-data";
import { SAMPLE_TRAVELER, SHARE_DOMAIN, defaultHashtags, hashtagSuggestions, shareCopy, shareDisplayUrl, sharePath } from "@/lib/share";
import { strings, t } from "@/lib/strings";
import type { DirectionId, StampStatus } from "@/lib/types";
import { Celebrate } from "./Celebrate";
import { ChooseStep } from "./ChooseStep";
import { DesignControls, FilmConcept, FormatTabs } from "./DesignControls";
import { PassportFilm } from "./PassportFilm";
import { PostCanvas } from "./PostCanvas";
import { filmPoster, type Film, type FilmSpec } from "./art/film";
import { postBlob, type PostSpec } from "./art/post";
import { copy } from "./copy";
import { STATUSES, STEP_IDS, codeFor, featuredStamp, headlineSuggestions, heldIslands, travelerCaptions, travelerPassport, type ShareFormat, type ShareSubject, type TravelerStep } from "./data";
import "./traveler.css";


export interface TravelerFlowInitial {
  step?: TravelerStep;
  subject?: ShareSubject;
  format?: ShareFormat;
  direction?: DirectionId;
  status?: StampStatus;
  islandId?: string;
  /** The visitor came from the passport demo: the back arrow goes there. */
  fromPassport?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function TravelerFlow({ initial }: { initial: TravelerFlowInitial }) {
  const traveler = SAMPLE_TRAVELER;
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();

  const [step, setStep] = useState<TravelerStep>(initial.step ?? "stamped");
  const [subject, setSubject] = useState<ShareSubject>(initial.subject ?? "stamp");
  const [format, setFormat] = useState<ShareFormat>(initial.format ?? "story");
  const [direction, setDirection] = useState<DirectionId>(initial.direction ?? "classic");
  const [status, setStatus] = useState<StampStatus>(initial.status ?? "verified");
  const [islandChoice, setIslandChoice] = useState(initial.islandId ?? traveler.featuredStamp.islandId);
  /** What the traveler typed, per choice. Empty means "use the suggestion". */
  const [headlines, setHeadlines] = useState<Partial<Record<string, string>>>({});
  const [captionText, setCaptionText] = useState<Partial<Record<string, string>>>({});
  const [tags, setTags] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState(false);
  const [film, setFilm] = useState<Film | null>(null);
  const [shared, setShared] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  /** Two columns from 900px: the preview stays beside the controls instead of being summarised. */
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // The passport's own art direction is the traveler's choice: start from it unless the link says otherwise.
  const adopted = useRef(Boolean(initial.direction));
  useEffect(() => {
    if (adopted.current || !theme.ready) return;
    adopted.current = true;
    setDirection(theme.direction);
  }, [theme.ready, theme.direction]);

  const passport = useMemo(() => travelerPassport(status), [status]);
  const stamp = featuredStamp(passport);
  const progress = getProgress(passport);
  const islands = useMemo(() => heldIslands(passport), [passport]);
  // A stamp is shared with its own island; an island page can be any island with a stamp.
  const islandId = subject === "island" && islands.some((e) => e.island.id === islandChoice) ? islandChoice : stamp.islandId;
  const island = islands.find((e) => e.island.id === islandId) ?? islands[0];
  const code = codeFor(subject, islandId);
  const target = useShareTarget(code);
  const charity = subject === "island" ? (island.slots.find((s) => s.stamp)?.stamp?.charity ?? stamp.charity) : stamp.charity;

  const suggestions = useMemo(() => headlineSuggestions(subject, islandId, passport), [subject, islandId, passport]);
  const headlineKey = `${subject}:${islandId}:${status === "verified" ? "v" : "u"}`;
  const headline = headlines[headlineKey] ?? suggestions[0];
  const setHeadline = useCallback((value: string) => setHeadlines((all) => ({ ...all, [headlineKey]: value })), [headlineKey]);

  const captions = useMemo(() => travelerCaptions(subject, islandId, passport, charity), [subject, islandId, passport, charity]);
  /** What the traveler typed, kept per choice like the headline. */
  const caption = captionText[headlineKey] ?? captions[0].text;
  const setCaption = useCallback((value: string) => setCaptionText((all) => ({ ...all, [headlineKey]: value })), [headlineKey]);
  const hashtags = useMemo(() => hashtagSuggestions(islandId, "traveler"), [islandId]);
  const selectedTags = tags ?? defaultHashtags(islandId, "traveler");

  const postFormat = format === "feed" ? "feed" : "story";
  const postSpec: PostSpec = useMemo(
    () => ({ format: postFormat, subject, direction, status, islandId, headline, code, qrValue: target }),
    [postFormat, subject, direction, status, islandId, headline, code, target],
  );
  const filmSpec: FilmSpec = useMemo(() => ({ direction, status, code, qrValue: target, charity }), [direction, status, code, target, charity]);

  /* Navigation. The step lives in the address too, so any screen can be linked to. */
  const go = useCallback((next: TravelerStep) => {
    setStep(next);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start" }));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("step", step);
    params.set("share", subject);
    params.set("format", format);
    params.set("style", direction);
    params.set("status", status);
    if (subject === "island") params.set("island", islandId);
    else params.delete("island");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params}`);
  }, [step, subject, format, direction, status, islandId]);

  const steps = copy.steps;
  const index = STEP_IDS.indexOf(step);
  const back = index > 0 ? STEP_IDS[index - 1] : null;

  const author = authorOf(traveler, `${island.island.name}, ${passport.country}`);
  const postLabel = `${shareCopy.formats[postFormat]}: ${headline}. ${copy.subjects[subject].title}, with a QR code that says scan to help my charity, ${charity}.`;

  const preview = (width: number) =>
    format === "film" ? (
      <div className="skt-preview-film" style={{ width, maxWidth: "100%" }}>
        <p className="sk-post-label">
          {shareCopy.formats.short}
          <span className="skt-concept-tag">{copy.film.tag}</span>
        </p>
        <PassportFilm spec={filmSpec} onReady={setFilm} />
      </div>
    ) : (
      <PostPreview
        format={postFormat}
        width={width}
        author={author}
        caption={caption}
        hashtags={selectedTags}
        link={shareDisplayUrl(code)}
        lines={3}
        media={<PostCanvas spec={postSpec} label={postLabel} />}
      />
    );

  const image = useCallback(() => (format === "film" ? filmPoster(filmSpec) : postBlob(postSpec)), [format, filmSpec, postSpec]);

  const stepMotion = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.32, ease: EASE } };

  return (
    <ShareShell
      width="wide"
      className="skt"
      back={initial.fromPassport ? { href: "/passport", label: copy.backToPassport } : { href: "/share", label: copy.backToHub }}
      end={
        <span className="skt-who">
          <Avatar avatar={traveler.avatar} size={28} />
          <span>{traveler.name.split(" ")[0]}</span>
        </span>
      }
    >
      <div ref={top} className="skt-top" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} className="skt-step" data-step={step} {...stepMotion}>
          {step === "stamped" ? (
            <Celebrate
              stamp={stamp}
              status={status}
              direction={direction}
              passport={passport}
              stats={traveler.stats}
              onShare={() => go("choose")}
              laterHref={initial.fromPassport ? "/passport" : "/share"}
            />
          ) : (
            <>
              <StepHeader
                steps={[...steps]}
                current={step}
                onSelect={(id) => go(id as TravelerStep)}
                eyebrow={copy.head[step].eyebrow}
                title={copy.head[step].title}
                lead={step === "share" ? t(copy.head.share.lead, { charity }) : copy.head[step].lead}
              />

              {step === "choose" ? (
                <ChooseStep
                  subject={subject}
                  onSubject={setSubject}
                  islandId={islandId}
                  onIsland={setIslandChoice}
                  islands={islands}
                  direction={direction}
                  status={status}
                  passport={passport}
                />
              ) : null}

              {step === "design" ? (
                <div className="skt-design">
                  <FormatTabs format={format} onFormat={setFormat} />
                  <div className="skt-split-preview">{preview(wide ? 300 : 286)}</div>
                  <div className="skt-split-side">
                    <DesignControls
                      format={format}
                      headline={headline}
                      onHeadline={setHeadline}
                      suggestions={suggestions}
                      direction={direction}
                      onDirection={setDirection}
                      subject={subject}
                      islands={islands}
                      islandId={islandId}
                      onIsland={setIslandChoice}
                    />
                    {format === "film" ? <FilmConcept film={film} code={code} /> : null}
                  </div>
                </div>
              ) : null}

              {step === "share" ? (
                <div className="skt-split">
                  {wide ? <div className="skt-split-preview">{preview(264)}</div> : null}
                  <div className="skt-split-side">
                    {wide ? null : (
                      <div className="skt-summary sk-card">
                        <div className="skt-summary-thumb" data-format={format}>
                          {format === "film" ? <PassportFilm spec={filmSpec} onReady={setFilm} chapters={false} /> : <PostCanvas spec={postSpec} label={postLabel} scale={0.4} />}
                        </div>
                        <div className="skt-summary-text">
                          <span className="sk-eyebrow">{format === "film" ? `${copy.formats.film.name} · ${copy.formats.film.hint}` : `${copy.formats[format].name} · ${copy.subjects[subject].title}`}</span>
                          <b>{format === "film" ? copy.film.title : headline}</b>
                          <button type="button" className="skt-summary-edit" onClick={() => go("design")}>
                            {copy.share.edit}
                          </button>
                        </div>
                      </div>
                    )}
                    <section className="sk-card skt-panel" aria-labelledby="skt-link-h">
                      <div className="skt-link-row">
                        <QrCode value={target} size={wide ? 132 : 104} label={wide ? "Scan to help my charity" : false} name={wide ? charity : undefined} />
                        <div className="skt-link-text">
                          <h2 className="sk-h3" id="skt-link-h">
                            {copy.share.linkTitle}
                          </h2>
                          <p className="skt-link-full">
                            {SHARE_DOMAIN}/s/<b>{code}</b>
                          </p>
                          <p className="skt-stats" aria-label={copy.share.statsLabel}>
                            <span>
                              <b>{traveler.stats.linkVisits}</b> {copy.share.visits}
                            </span>
                            <span>
                              <b>{traveler.stats.friendsJoined}</b> {copy.share.joined}
                            </span>
                            <span>
                              <b>{traveler.stats.donationsGenerated.donors}</b> {copy.share.gave}
                            </span>
                            <i>{copy.share.sample}</i>
                          </p>
                        </div>
                      </div>
                      <LinkField code={code} label={false} hint={copy.share.linkHint} />
                      <p className="sk-note">{t(shareCopy.noDonations, { charity })}</p>
                      {status !== "verified" ? <p className="skt-pending" data-status={status}>{t(status === "pending" ? shareCopy.pending : copy.share.discovery, { charity: stamp.charity })}</p> : null}
                    </section>

                    <section className="sk-card skt-panel">
                      <CaptionEditor
                        value={caption}
                        onChange={setCaption}
                        suggestions={captions}
                        hashtags={hashtags}
                        selected={selectedTags}
                        onSelectedChange={setTags}
                      />
                    </section>

                    {format === "film" ? <FilmConcept film={film} code={code} compact /> : null}

                    <AnimatePresence>
                      {shared ? (
                        <motion.p className="skt-done" role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          {t(copy.share.done, { n: progress.collected })}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                    <SkButton variant="secondary" block href={sharePath(code)}>
                      {copy.share.seeLanding}
                      <IconArrow size={18} />
                    </SkButton>
                  </div>
                </div>
              ) : null}

              <div className="skt-actions">
                <div className="skt-actions-inner">
                  {back ? (
                    <SkButton variant="secondary" onClick={() => go(back)} aria-label={copy.back}>
                      <IconBack size={18} />
                      <span className="skt-actions-back">{copy.back}</span>
                    </SkButton>
                  ) : null}
                  {step === "share" ? (
                    <SkButton variant="primary" className="skt-go" onClick={() => setSheet(true)}>
                      <IconShare size={19} />
                      {copy.share.cta}
                    </SkButton>
                  ) : (
                    <SkButton variant="primary" className="skt-go" onClick={() => go(STEP_IDS[index + 1])}>
                      {step === "choose" ? t(copy.choose.cta, { what: copy.subjects[subject].short }) : copy.design.cta}
                      <IconArrow size={18} />
                    </SkButton>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <aside className="skt-demo" aria-label={copy.demo.label}>
        <span className="skt-demo-label">{copy.demo.label}</span>
        <span className="skt-demo-text">{copy.demo.status}</span>
        <span className="skt-demo-chips" role="group" aria-label={copy.demo.status}>
          {STATUSES.map((s) => (
            <button key={s} type="button" className="sk-chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {strings.status[s].label}
            </button>
          ))}
        </span>
      </aside>

      <ShareSheet
        open={sheet}
        onClose={() => setSheet(false)}
        code={code}
        caption={composeCaption(caption, selectedTags)}
        image={image}
        fileName={`island-passport-${code}-${format}.png`}
        title={copy.share.sheetTitle}
        summary={format === "film" ? copy.share.sheetFilm : headline}
        onAction={() => setShared(true)}
      />
    </ShareShell>
  );
}
