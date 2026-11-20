"use client";

/**
 * /lab/sound: audition every sound in the demo (sound agent).
 * A button per sound and variant, the mute switch, a master volume slider and the whole story in
 * order. Everything goes through @/lib/sound, exactly as the demo will.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeSwitcher } from "@/components/theme";
import { intensityFromVelocity, play, setPlayOnSilentSwitch, useSound, type SoundHandle } from "@/lib/sound";
import { soundStrings } from "@/lib/sound/strings";
import { strings } from "@/lib/strings";

const L = soundStrings.lab;
const S = L.sounds;

function Group({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="type-label text-fg">{title}</h2>
        <p className="max-w-[62%] text-right text-[11px] leading-snug text-subtle">{note}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

function SoundButton({ label, onPlay, wide, primary }: { label: string; onPlay(): void; wide?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      style={{ touchAction: "manipulation" }}
      className={[
        "flex min-h-12 items-center gap-2.5 rounded-card px-3.5 py-2.5 text-left text-[13.5px] font-semibold leading-tight transition-transform duration-150 ease-out-soft active:scale-[0.97]",
        wide ? "col-span-2" : "",
        primary ? "bg-accent text-accent-fg" : "bg-elev text-fg shadow-[inset_0_0_0_1px_var(--line)]",
      ].join(" ")}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0 opacity-70">
        <path d="M2.5 1.4v9.2a.6.6 0 0 0 .92.5l7.2-4.6a.6.6 0 0 0 0-1L3.42.9a.6.6 0 0 0-.92.5z" fill="currentColor" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

export default function SoundLabPage() {
  const { muted, volume, unlocked, available, toggleMuted, setVolume } = useSound();
  // The saved choice is only known after mount: render the neutral state until then.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [speed, setSpeed] = useState(0.8);
  const [onSilent, setOnSilent] = useState(false);
  const [storyOn, setStoryOn] = useState(false);
  const timers = useRef<number[]>([]);
  const handles = useRef<SoundHandle[]>([]);

  const stopStory = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    handles.current.forEach((h) => h.stop(0.12));
    handles.current = [];
    setStoryOn(false);
  }, []);
  useEffect(() => stopStory, [stopStory]);

  /** Queue fn `seconds` from now. Timers are fine here: each sound is exact once it starts. */
  const at = useCallback((seconds: number, fn: () => SoundHandle | void) => {
    timers.current.push(
      window.setTimeout(() => {
        const h = fn();
        if (h) handles.current.push(h);
      }, seconds * 1000),
    );
  }, []);

  const playStory = useCallback(() => {
    stopStory();
    setStoryOn(true);
    // The demo's order and roughly its pace.
    at(0, () => play.tap());
    at(0.1, () => play.coverOpen());
    at(1.9, () => play.pageFlip({ duration: 0.78 }));
    at(3.1, () => play.pageFlip({ duration: 0.78 }));
    at(4.4, () => play.tap());
    at(4.5 + 0.7, () => play.stampPress());
    at(6.1, () => play.toast());
    at(7.6, () => play.tap());
    at(7.7 + 1.42, () => play.verified());
    at(10.4, () => play.toast());
    at(11.8, () => play.provincialReveal());
    at(14.4, () => play.tap());
    at(14.4 + 0.2, () => play.provincialLand());
    at(16.6, () => play.pageFlip({ duration: 0.78 }));
    at(18.1, () => play.coverClose());
    at(19.6, () => setStoryOn(false));
  }, [at, stopStory]);

  const riffleLikeEngine = useCallback(() => {
    // What flip-engine.ts does for riffleTo(): one onFlipStart per page, each flip shortened.
    const count = 5;
    const each = 0.92 * Math.max(0.3, Math.min(1, 1 / (count * 0.92)));
    for (let k = 0; k < count; k++) {
      at(k * each * 0.62, () => play.pageFlip({ duration: each, light: k < count - 1, intensity: 0.5 }));
    }
  }, [at]);

  const status = !mounted
    ? L.statusLocked
    : !available
      ? L.statusUnavailable
      : muted
        ? L.statusMuted
        : unlocked
          ? L.statusReady
          : L.statusLocked;
  const on = mounted && !muted;

  return (
    <main className="scene-bg min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-[color:color-mix(in_srgb,var(--bg)_86%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[20px] leading-none text-fg">{L.title}</h1>
            <span className="sample-tag mt-1.5">{strings.sample.tag}</span>
          </div>
          <ThemeSwitcher variant="compact" />
        </div>
      </header>

      <div className="mx-auto max-w-[430px] px-4 pb-16 pt-6">
        <p className="text-[14px] leading-relaxed text-muted">{L.intro}</p>

        <section className="mt-6 rounded-card bg-elev p-4 shadow-[inset_0_0_0_1px_var(--line)]" aria-label={L.controls}>
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={soundStrings.toggle.label}
              onClick={() => toggleMuted()}
              data-testid="sound-toggle"
              style={{ touchAction: "manipulation" }}
              className={[
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-chip px-4 text-[13.5px] font-semibold leading-none transition-colors",
                on ? "bg-accent text-accent-fg" : "text-muted shadow-[inset_0_0_0_1px_var(--line-strong)]",
              ].join(" ")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" fillOpacity={on ? 0.18 : 0} />
                {on ? (
                  <>
                    <path d="M15.4 9.2a4 4 0 0 1 0 5.6" />
                    <path d="M17.9 6.8a7.4 7.4 0 0 1 0 10.4" />
                  </>
                ) : (
                  <path d="M16 9.6l4.6 4.8M20.6 9.6L16 14.4" />
                )}
              </svg>
              <span>{on ? soundStrings.toggle.on : soundStrings.toggle.off}</span>
            </button>
            <p className="text-right text-[12px] leading-snug text-subtle" role="status" data-testid="sound-status">
              {status}
            </p>
          </div>

          <label className="mt-4 flex items-center gap-3">
            <span className="type-label shrink-0 text-muted">{L.volume}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={mounted ? volume : 0.8}
              onChange={(e) => setVolume(Number(e.target.value))}
              data-testid="sound-volume"
              className="h-6 min-w-0 flex-1 accent-[color:var(--accent)]"
            />
            <span className="w-9 text-right font-mono text-[12px] tabular-nums text-muted">{Math.round((mounted ? volume : 0.8) * 100)}</span>
          </label>

          <label className="mt-3 flex items-start gap-2.5 text-[12.5px] leading-snug text-muted">
            <input
              type="checkbox"
              checked={onSilent}
              onChange={(e) => {
                setOnSilent(e.target.checked);
                setPlayOnSilentSwitch(e.target.checked);
              }}
              className="mt-0.5 h-4 w-4 accent-[color:var(--accent)]"
            />
            <span>
              {L.silentSwitch}
              <span className="block text-[11px] text-subtle">{L.silentSwitchNote}</span>
            </span>
          </label>
        </section>

        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="type-label text-fg">{L.story}</h2>
            <p className="max-w-[62%] text-right text-[11px] leading-snug text-subtle">{L.storyNote}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SoundButton wide primary label={storyOn ? L.storyStop : L.storyPlay} onPlay={storyOn ? stopStory : playStory} />
          </div>
        </section>

        <Group title={L.groups.paper.title} note={L.groups.paper.note}>
          <SoundButton label={S.flip} onPlay={() => play.pageFlip()} />
          <SoundButton label={S.flipSlow} onPlay={() => play.pageFlip({ duration: 0.78 })} />
          <SoundButton label={S.flipSpread} onPlay={() => play.pageFlip({ duration: 0.92 })} />
          <SoundButton label={S.flipFast} onPlay={() => play.pageFlip({ duration: 0.26, intensity: 1 })} />
          <SoundButton label={S.flipGentle} onPlay={() => play.pageFlip({ duration: 0.42, intensity: 0.2 })} />
          <SoundButton label={S.flipLight} onPlay={() => play.pageFlip({ duration: 0.3, light: true })} />
          <SoundButton label={S.flipBack} onPlay={() => play.pageFlip({ duration: 0.24, light: true, intensity: 0.3 })} />
          <SoundButton label={S.riffle} onPlay={() => play.pageRiffle()} />
          <SoundButton label={S.riffleLong} onPlay={() => play.pageRiffle({ count: 9, duration: 1 })} />
          <SoundButton label={S.riffleEngine} onPlay={riffleLikeEngine} />
          <div className="col-span-2 mt-1 rounded-card bg-elev p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <label className="flex items-center gap-3">
              <span className="type-label shrink-0 text-muted">{L.dragSpeed}</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="h-6 min-w-0 flex-1 accent-[color:var(--accent)]"
              />
              <span className="w-[4.5rem] text-right font-mono text-[12px] tabular-nums text-muted">
                {speed.toFixed(2)} {L.dragSpeedUnit}
              </span>
            </label>
            <div className="mt-2.5 grid">
              <SoundButton
                label={L.dragFlip}
                onPlay={() =>
                  play.pageFlip({
                    // A faster release finishes the turn sooner, as in flip-engine.ts.
                    duration: Math.max(0.22, 0.6 - speed * 0.2),
                    intensity: intensityFromVelocity(speed),
                  })
                }
              />
            </div>
          </div>
        </Group>

        <Group title={L.groups.cover.title} note={L.groups.cover.note}>
          <SoundButton label={S.coverOpen} onPlay={() => play.coverOpen()} />
          <SoundButton label={S.coverClose} onPlay={() => play.coverClose()} />
          <SoundButton label={S.coverOpenQuiet} onPlay={() => play.coverOpen({ creak: 0 })} />
          <SoundButton label={S.thudOpen} onPlay={() => play.coverThud({ kind: "open" })} />
          <SoundButton label={S.thudClose} onPlay={() => play.coverThud({ kind: "close" })} />
        </Group>

        <Group title={L.groups.stamp.title} note={L.groups.stamp.note}>
          <SoundButton label={S.stamp} onPlay={() => play.stampPress()} />
          <SoundButton label={S.stampSoft} onPlay={() => play.stampPress({ intensity: 0.4 })} />
          <SoundButton label={S.stampNoLift} onPlay={() => play.stampPress({ lift: false })} />
        </Group>

        <Group title={L.groups.verified.title} note={L.groups.verified.note}>
          <SoundButton label={S.verified} onPlay={() => play.verified()} />
          <SoundButton label={S.verifiedTwo} onPlay={() => play.verified({ notes: 2 })} />
          <SoundButton label={S.chimeOnly} onPlay={() => play.verified({ chimeOnly: true })} />
        </Group>

        <Group title={L.groups.provincial.title} note={L.groups.provincial.note}>
          <SoundButton label={S.reveal} onPlay={() => play.provincialReveal()} />
          <SoundButton label={S.land} onPlay={() => play.provincialLand()} />
          <SoundButton
            wide
            label={S.award}
            onPlay={() => {
              play.provincialReveal();
              at(2.4, () => play.provincialLand());
            }}
          />
        </Group>

        <Group title={L.groups.ui.title} note={L.groups.ui.note}>
          <SoundButton label={S.tap} onPlay={() => play.tap()} />
          <SoundButton label={S.toast} onPlay={() => play.toast()} />
        </Group>

        <footer className="pt-10 text-[12px] leading-relaxed text-subtle">
          <p>{strings.sample.notice}</p>
        </footer>
      </div>
    </main>
  );
}
