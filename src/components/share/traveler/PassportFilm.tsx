"use client";

/**
 * The passport film, playing on a canvas in a neutral 9:16 frame, with a strip of chapters under
 * it (Cover, Opens, Islands, Closes, Scan). Tap the picture to pause, tap a chapter to jump there.
 * It loops, runs only while it is on screen, and under reduced motion it waits for a tap.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import { IconPause, IconPlay, usePrefersReducedMotion } from "@/components/share/kit";
import { ctxOf } from "./art/core";
import { FILM_SIZE, createFilm, type Film, type FilmSpec } from "./art/film";

export interface PassportFilmHandle {
  play(): void;
  pause(): void;
  /** Jump to a time in seconds and keep playing. */
  seek(seconds: number): void;
}

export interface PassportFilmProps {
  spec: FilmSpec;
  /** Start by itself. Default true (ignored under reduced motion). */
  autoPlay?: boolean;
  /** Show the chapter strip. Default true. */
  chapters?: boolean;
  /** The film is built (fonts and artwork loaded): hand it to whoever records or exports it. */
  onReady?: (film: Film) => void;
  className?: string;
  style?: CSSProperties;
}

export const PassportFilm = forwardRef<PassportFilmHandle, PassportFilmProps>(function PassportFilm(
  { spec, autoPlay = true, chapters = true, onReady, className = "", style },
  ref,
) {
  const reduced = usePrefersReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const time = useRef(0);
  const [film, setFilm] = useState<Film | null>(null);
  const [playing, setPlaying] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const key = JSON.stringify(spec);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const chapterRef = useRef(0);

  /** Paint the frame at time.current and move the chapter strip along. */
  const paint = useCallback((current: Film) => {
    const el = canvas.current;
    if (!el) return;
    current.draw(ctxOf(el), time.current);
    const marks = current.chapters;
    let now = 0;
    marks.forEach((mark, i) => {
      const end = marks[i + 1]?.at ?? current.duration;
      const p = Math.min(1, Math.max(0, (time.current - mark.at) / (end - mark.at)));
      const fill = fills.current[i];
      if (fill) fill.style.transform = `scaleX(${p.toFixed(4)})`;
      if (time.current >= mark.at) now = i;
    });
    if (now !== chapterRef.current) {
      chapterRef.current = now;
      setChapter(now);
    }
  }, []);

  // Build the film whenever what it shows changes.
  useEffect(() => {
    let live = true;
    setFilm(null);
    createFilm(JSON.parse(key) as FilmSpec)
      .then((made) => {
        if (!live) return;
        setFilm(made);
        onReadyRef.current?.(made);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]);

  // A new film starts from the top; under reduced motion it rests on the closed cover.
  useEffect(() => {
    if (!film) return;
    const still = reduced || !autoPlay;
    time.current = still ? 1.1 : 0;
    paint(film);
    setPlaying(!still);
  }, [film, reduced, autoPlay, paint]);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!film || !playing || !onScreen) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A tab that was in the background comes back with one long gap: do not jump ahead by it.
      time.current += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (time.current >= film.duration) time.current = 0;
      paint(film);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [film, playing, onScreen, paint]);

  const seek = useCallback(
    (seconds: number) => {
      if (!film) return;
      time.current = Math.min(Math.max(0, seconds), film.duration - 0.01);
      paint(film);
      setPlaying(true);
    },
    [film, paint],
  );

  useImperativeHandle(ref, () => ({ play: () => setPlaying(true), pause: () => setPlaying(false), seek }), [seek]);

  const marks = film?.chapters ?? [];

  return (
    <div ref={root} className={`skt-film ${className}`} style={style} data-ready={Boolean(film)} data-playing={playing}>
      <div className="skt-film-screen">
        <canvas
          ref={canvas}
          width={FILM_SIZE.width}
          height={FILM_SIZE.height}
          role="img"
          aria-label="Passport film: the passport opens, turns through the islands with their stamps, closes and turns over to a QR code that says scan to help my charity"
        />
        <button type="button" className="skt-film-tap" aria-label={playing ? "Pause the film" : "Play the film"} aria-pressed={playing} disabled={!film} onClick={() => setPlaying((v) => !v)}>
          <span className="skt-film-badge" aria-hidden="true">
            {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
          </span>
        </button>
        {!film ? <span className="skt-film-loading">Setting the type…</span> : null}
      </div>
      {chapters ? (
        <ol className="skt-film-chapters" aria-label="Chapters of the film">
          {marks.map((mark, i) => {
            const end = marks[i + 1]?.at ?? film?.duration ?? mark.at + 1;
            return (
              <li key={mark.id} style={{ flexGrow: end - mark.at }}>
                <button type="button" onClick={() => seek(mark.at)} aria-current={chapter === i ? "step" : undefined}>
                  <span className="skt-film-bar">
                    <span
                      className="skt-film-fill"
                      ref={(node) => {
                        fills.current[i] = node;
                      }}
                    />
                  </span>
                  <span className="skt-film-name">{mark.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
});
