"use client";

/**
 * <IslandReel />: turns one of the prepared photo sequences into a short animated "video".
 *
 * Each scene is a photo with a slow Ken Burns move that crossfades into the next, with a line of
 * text that rises in word by word; the partner's name (and an optional personal line) sits under
 * it the whole way through; the last beat is an end card with the QR code and the short link.
 * Nothing is encoded: it is DOM and CSS, so it plays instantly and stays sharp at any size.
 *
 * It fills its parent by default (drop it into <PostPreview media={...} />, which also tells it
 * how much room the frame's chrome needs). Pass `aspect` to make it stand on its own.
 * Under reduced motion it does not autoplay and the photos stay still; pressing play steps
 * through the scenes with plain fades.
 */
import { AnimatePresence, motion } from "motion/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { artUrl } from "@/lib/assets";
import { photoAsset, photoSources } from "@/lib/islands/photos";
import { shareCopy } from "@/lib/share/sample";
import type { IslandReel as IslandReelData, ShareAvatar } from "@/lib/share/types";
import { shareDisplayUrl } from "@/lib/share/urls";
import { strings } from "@/lib/strings";
import { usePrefersReducedMotion, useShareTarget } from "./hooks";
import { BrandMark, IconPlay, IconReplay } from "./icons";
import { Avatar } from "./primitives";
import { QrCode } from "./QrCode";

export interface IslandReelHandle {
  play: () => void;
  pause: () => void;
  /** Back to the first scene, playing. */
  restart: () => void;
  /** Jump to the end card and hold there. */
  showEnd: () => void;
}

export interface IslandReelProps {
  reel: IslandReelData;
  /** Printed small over every scene and in the end card title, e.g. "Bohol". */
  islandName: string;
  /** Share code for the end card's QR code and link, e.g. "mia-bohol". */
  code: string;
  /** Who is sharing, under the scene text: "with Mia Sample", "Isla Trips". */
  byline?: string;
  /** Initials disc next to the byline. */
  avatar?: ShareAvatar;
  /** The sharer's own short line, shown in quotes above the byline. Keep it under about 60 characters. */
  message?: string;
  /** End card heading. Default: Collect the <em>{islandName}</em> stamp. */
  endTitle?: ReactNode;
  /** Line under the end card's QR code, e.g. "Scan to support Coral Trust". Default "Scan to support". */
  support?: string;
  /** Start playing when it scrolls into view. Default true (always false under reduced motion). */
  autoPlay?: boolean;
  /** Start again after the end card. Default true. */
  loop?: boolean;
  /** "player" animates. "poster" draws one still frame with no timers: use it for grids of thumbnails. */
  mode?: "player" | "poster";
  /** The still frame for "poster": a scene index, or "end" for the end card. Default 0. */
  posterAt?: number | "end";
  /** Progress segments along the top. Default true in "player". */
  segments?: boolean;
  /** Tap anywhere to pause and resume. Default true in "player". */
  controls?: boolean;
  /** Give the reel its own shape instead of filling the parent. */
  aspect?: "9/16" | "4/5" | "1/1";
  /** `sizes` for the photos. Default suits a phone-sized mockup. */
  sizes?: string;
  onSceneChange?: (index: number, isEndCard: boolean) => void;
  /** Called when the end card finishes (each time round when looping). */
  onEnded?: () => void;
  className?: string;
  style?: CSSProperties;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export const IslandReel = forwardRef<IslandReelHandle, IslandReelProps>(function IslandReel(
  {
    reel,
    islandName,
    code,
    byline,
    avatar,
    message,
    endTitle,
    support = shareCopy.scanToSupport,
    autoPlay = true,
    loop = true,
    mode = "player",
    posterAt = 0,
    segments,
    controls,
    aspect,
    sizes = "(max-width: 480px) 92vw, 420px",
    onSceneChange,
    onEnded,
    className = "",
    style,
  },
  ref,
) {
  const poster = mode === "poster";
  const reduced = usePrefersReducedMotion();
  const count = reel.scenes.length;
  const posterIndex = posterAt === "end" ? count : Math.min(Math.max(0, posterAt), count - 1);

  /** Start time of each scene, then of the end card, then the total. */
  const marks = useMemo(() => {
    const out = [0];
    for (const scene of reel.scenes) out.push(out[out.length - 1] + scene.seconds);
    out.push(out[out.length - 1] + reel.endCardSeconds);
    return out;
  }, [reel]);
  const total = marks[marks.length - 1];

  const [index, setIndex] = useState(poster ? posterIndex : 0);
  const [playing, setPlaying] = useState(autoPlay && !poster);
  const [inView, setInView] = useState(false);
  /** Bumped on every loop and restart, so text and the end card animate in afresh. */
  const [cycle, setCycle] = useState(0);
  const [ended, setEnded] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const fills = useRef<(HTMLElement | null)[]>([]);
  const elapsed = useRef(0);
  const indexRef = useRef(index);
  const callbacks = useRef({ onSceneChange, onEnded });
  callbacks.current = { onSceneChange, onEnded };

  const target = useShareTarget(code);
  const isEnd = index >= count;

  const paint = useCallback(() => {
    for (let i = 0; i < fills.current.length; i++) {
      const el = fills.current[i];
      if (!el) continue;
      const p = Math.min(1, Math.max(0, (elapsed.current - marks[i]) / (marks[i + 1] - marks[i])));
      el.style.transform = `scaleX(${p.toFixed(4)})`;
    }
  }, [marks]);

  const goTo = useCallback(
    (next: number) => {
      indexRef.current = next;
      setIndex(next);
      callbacks.current.onSceneChange?.(next, next >= count);
    },
    [count],
  );

  // A different reel or code starts from the top.
  useEffect(() => {
    if (poster) return;
    elapsed.current = 0;
    indexRef.current = 0;
    setIndex(0);
    setEnded(false);
    setCycle((c) => c + 1);
    paint();
  }, [reel.id, poster, paint]);

  useEffect(() => {
    if (poster) setIndex(posterIndex);
  }, [poster, posterIndex]);

  // Reduced motion: never start by itself.
  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  // Only run the clock while the reel is on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || poster) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [poster]);

  const running = playing && inView && !poster;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A long gap (a background tab) counts as one frame, so the reel resumes where it was.
      elapsed.current += Math.min(now - last, 100) / 1000;
      last = now;
      if (elapsed.current >= total) {
        callbacks.current.onEnded?.();
        if (!loop) {
          elapsed.current = total;
          paint();
          setEnded(true);
          setPlaying(false);
          return;
        }
        elapsed.current = 0;
        setCycle((c) => c + 1);
      }
      let next = 0;
      while (next < count && elapsed.current >= marks[next + 1]) next++;
      if (next !== indexRef.current) goTo(next);
      paint();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, total, loop, count, marks, goTo, paint]);

  const restart = useCallback(() => {
    elapsed.current = 0;
    setEnded(false);
    setCycle((c) => c + 1);
    goTo(0);
    paint();
    setPlaying(true);
  }, [goTo, paint]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => (ended ? restart() : setPlaying(true)),
      pause: () => setPlaying(false),
      restart,
      showEnd: () => {
        elapsed.current = marks[count];
        setEnded(false);
        setPlaying(false);
        goTo(count);
        paint();
      },
    }),
    [ended, restart, marks, count, goTo, paint],
  );

  const showSegments = (segments ?? true) && !poster;
  const showControls = (controls ?? true) && !poster;
  const animateText = !poster && !reduced;
  const scene = reel.scenes[Math.min(index, count - 1)];
  const words = scene.line.split(" ");

  return (
    <div
      ref={root}
      className={`sk-reel ${className}`}
      role="group"
      aria-label={`${reel.title}: short video preview`}
      data-aspect={aspect}
      data-end={isEnd}
      data-playing={running}
      data-motion={!poster && !reduced}
      style={style}
    >
      {reel.scenes.map((s, i) => {
        if (poster && i !== Math.min(posterIndex, count - 1)) return null;
        const src = photoSources(s.photo, 1280);
        const state = i === index ? "active" : i === index - 1 ? "leaving" : "idle";
        return (
          <div
            key={s.photo + i}
            className="sk-reel-scene"
            data-state={poster ? "active" : state}
            style={{ background: photoAsset(s.photo)?.color, "--kb": `sk-kb-${s.move}`, "--kb-time": `${s.seconds + 1}s` } as CSSProperties}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP renditions with a srcSet; next/image is not used in this demo
              <img
                src={src.src}
                srcSet={src.srcSet}
                sizes={sizes}
                alt=""
                draggable={false}
                decoding="async"
                loading={i === 0 || poster ? "eager" : "lazy"}
                style={{ objectPosition: s.focus ? `${s.focus[0]}% ${s.focus[1]}%` : undefined }}
              />
            ) : null}
          </div>
        );
      })}
      <div className="sk-reel-shade" />

      {showSegments ? (
        <div className="sk-reel-segs" aria-hidden="true">
          {marks.slice(0, -1).map((start, i) => (
            <span className="sk-reel-seg" key={i} style={{ "--w": marks[i + 1] - start } as CSSProperties}>
              <i
                ref={(el) => {
                  fills.current[i] = el;
                }}
              />
            </span>
          ))}
        </div>
      ) : null}

      <div className="sk-reel-text" aria-hidden={isEnd}>
        <div className="sk-reel-kicker">
          <BrandMark />
          <span>{strings.app.name}</span>
          <span>{reel.theme}</span>
        </div>
        <div className="sk-reel-lower">
          <p className="sk-reel-island">{islandName}</p>
          {animateText ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`${cycle}-${Math.min(index, count - 1)}`}
                className="sk-reel-line"
                initial="hidden"
                animate="shown"
                exit="gone"
                variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.07 } }, gone: { opacity: 0, transition: { duration: 0.25 } } }}
              >
                {words.map((word, i) => (
                  <motion.span
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: "0.5em", filter: "blur(6px)" },
                      shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
                    }}
                  >
                    {word}
                    {i < words.length - 1 ? " " : ""}
                  </motion.span>
                ))}
              </motion.p>
            </AnimatePresence>
          ) : (
            <p className="sk-reel-line">{scene.line}</p>
          )}
          {byline || message ? (
            <div className="sk-reel-by">
              {avatar ? <Avatar avatar={avatar} className="sk-post-avatar" /> : null}
              <div className="sk-reel-by-text">
                {message ? <q>{message}</q> : null}
                {byline ? <span>{byline}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isEnd ? (
          <motion.div
            key={`end-${cycle}`}
            className="sk-reel-end"
            initial={poster ? false : "hidden"}
            animate="shown"
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            variants={{
              hidden: { opacity: 0 },
              shown: { opacity: 1, transition: { duration: reduced ? 0.2 : 0.5, staggerChildren: reduced ? 0 : 0.09, delayChildren: reduced ? 0 : 0.12 } },
            }}
          >
            <span className="sk-reel-end-art" style={{ "--art": `url(${artUrl(reel.art)})` } as CSSProperties} />
            <EndItem reduced={reduced} className="sk-reel-end-kicker">
              <BrandMark />
              {strings.app.name}
            </EndItem>
            <EndItem reduced={reduced}>
              <h3 className="sk-reel-end-title">
                {endTitle ?? (
                  <>
                    Collect the <em>{islandName}</em> stamp
                  </>
                )}
              </h3>
            </EndItem>
            <motion.div
              className="sk-reel-end-qr"
              variants={
                reduced
                  ? { hidden: { opacity: 0 }, shown: { opacity: 1 } }
                  : { hidden: { opacity: 0, scale: 0.8, rotate: -4 }, shown: { opacity: 1, scale: 1, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 18 } } }
              }
            >
              <QrCode value={target} frame="bare" label={false} animate={false} title={`QR code for ${shareDisplayUrl(code)}`} />
            </motion.div>
            <EndItem reduced={reduced}>
              <p className="sk-reel-end-support">{support}</p>
            </EndItem>
            <EndItem reduced={reduced} className="sk-reel-end-link">
              {shareDisplayUrl(code)}
            </EndItem>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showControls ? (
        <button
          type="button"
          className="sk-reel-tap"
          aria-label={ended ? "Replay video" : playing ? "Pause video" : "Play video"}
          onClick={() => (ended ? restart() : setPlaying((p) => !p))}
        >
          <AnimatePresence>
            {!playing ? (
              <motion.span
                className="sk-reel-badge"
                initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 1.25 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {ended ? <IconReplay /> : <IconPlay />}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </button>
      ) : null}
    </div>
  );
});

function EndItem({ children, reduced, className }: { children: ReactNode; reduced: boolean; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 14 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}
