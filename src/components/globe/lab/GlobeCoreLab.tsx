"use client";

/**
 * The engine lab (/lab/globe-core). Developer tooling, not a product screen: its few labels are
 * kept here in `L` rather than in the shared strings.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe, type GlobeHandle, type GlobeStatus, type StyleInput } from "@/components/globe";
import { IslandSearch } from "@/components/options-ui/IslandSearch";
import { OptionSwitcher } from "@/components/options-ui/OptionSwitcher";
import { ISLANDS, TOUR_ORDER } from "@/lib/islands";
import { useOption } from "@/lib/options";
import "./globe-core-lab.css";

const L = {
  title: "Globe engine",
  blurb: "MapLibre GL globe, OpenFreeMap tiles. Plain light style from the option's starter palette.",
  fly: "Fly to",
  camera: "Camera",
  reset: "Reset view",
  tour: "Tour live islands",
  stop: "Stop",
  snapshot: "Snapshot",
  viaGlobe: "Via globe",
  toggles: "Toggles",
  spin: "Spin",
  padding: "Padding (card)",
  relief: "Relief",
  labels: "Labels",
  markers: "DOM markers",
  lose: "Lose WebGL context",
  restore: "Restore context",
  readout: "Read-out",
  fps: "fps",
  worst: "worst frame",
  spinFps: "spin",
  flightFps: "last flight",
  none: "none",
};

/** Frame-rate sampler: the last second, plus averages while spinning and for the last flight. */
function useFrameStats(rootRef: React.RefObject<HTMLElement | null>, out: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let windowStart = last;
    let frames = 0;
    let worst = 0;
    const spin = { frames: 0, time: 0, worst: 0 };
    let flight = { frames: 0, time: 0, worst: 0 };
    let lastFlight = "";
    let wasFlying = false;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames++;
      if (dt > worst) worst = dt;
      const globe = rootRef.current?.querySelector(".ipg");
      const flying = globe?.hasAttribute("data-flying") ?? false;
      const rotating = globe?.hasAttribute("data-rotating") ?? false;
      if (flying) {
        if (!wasFlying) flight = { frames: 0, time: 0, worst: 0 };
        flight.frames++;
        flight.time += dt;
        if (dt > flight.worst) flight.worst = dt;
      } else if (wasFlying && flight.time > 0) {
        lastFlight = `${Math.round((flight.frames * 1000) / flight.time)} ${L.fps}, ${L.worst} ${Math.round(flight.worst)} ms`;
      }
      wasFlying = flying;
      if (rotating && !flying) {
        spin.frames++;
        spin.time += dt;
        if (dt > spin.worst) spin.worst = dt;
      }
      if (now - windowStart >= 1000) {
        const fps = Math.round((frames * 1000) / (now - windowStart));
        const spinText = spin.time > 500 ? `${Math.round((spin.frames * 1000) / spin.time)} ${L.fps}, ${L.worst} ${Math.round(spin.worst)} ms` : L.none;
        if (out.current) {
          out.current.textContent = `${fps} ${L.fps} · ${L.worst} ${Math.round(worst)} ms\n${L.spinFps}: ${spinText}\n${L.flightFps}: ${lastFlight || L.none}`;
          out.current.toggleAttribute("data-slow", worst > 34);
        }
        (window as unknown as { __globeFps?: unknown }).__globeFps = { fps, worst, spin: { ...spin }, lastFlight };
        windowStart = now;
        frames = 0;
        worst = 0;
        spin.frames = 0;
        spin.time = 0;
        spin.worst = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rootRef, out]);
}

export function GlobeCoreLab() {
  const { palette, selectedIslandId, selectIsland } = useOption();
  const globe = useRef<GlobeHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const fpsOut = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState<GlobeStatus>("poster");
  const [spin, setSpin] = useState(true);
  const [card, setCard] = useState(false);
  const [relief, setRelief] = useState(true);
  const [labels, setLabels] = useState<"none" | "minimal" | "full">("minimal");
  const [markers, setMarkers] = useState(true);
  const [viaGlobe, setViaGlobe] = useState(false);
  const [log, setLog] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [wide, setWide] = useState(false);

  useFrameStats(root, fpsOut);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const style = useMemo<StyleInput>(
    () => (base) =>
      base.build(base.paletteFromOption(palette), {
        labels,
        relief: relief ? 0.5 : 0,
        islands: base.islandColorsFromOption(palette),
      }),
    [palette, labels, relief],
  );

  const padding = useMemo(() => (card ? (wide ? { left: 340 } : { bottom: 220 }) : undefined), [card, wide]);

  const fly = useCallback(
    (id: string) => {
      selectIsland(id);
      const started = performance.now();
      void globe.current?.flyToIsland(id, { viaGlobe }).then((arrived) => {
        setLog(`flyToIsland("${id}") -> ${arrived} in ${Math.round(performance.now() - started)} ms`);
      });
    },
    [selectIsland, viaGlobe],
  );

  const reset = useCallback(() => {
    selectIsland(null);
    const started = performance.now();
    void globe.current?.resetView().then((done) => setLog(`resetView() -> ${done} in ${Math.round(performance.now() - started)} ms`));
  }, [selectIsland]);

  const tour = useCallback(() => {
    selectIsland(null);
    setLog("tour running");
    void globe.current
      ?.tour(TOUR_ORDER, { dwellMs: 1600, viaGlobe, onStep: (id) => setLog(`tour -> ${id}`) })
      .then((done) => setLog(`tour() -> ${done}`));
  }, [selectIsland, viaGlobe]);

  const snapshot = useCallback(() => {
    void globe.current
      ?.snapshot({ maxSize: 900 })
      .then((url) => {
        setShot(url);
        setLog(`snapshot() -> ${Math.round(url.length / 1024)} KB data URL`);
      })
      .catch((error: Error) => setLog(`snapshot() failed: ${error.message}`));
  }, []);

  const loseContext = useCallback((restore: boolean) => {
    const canvas = globe.current?.map()?.getCanvas();
    const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    const ext = (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context");
    const holder = window as unknown as { __lose?: WEBGL_lose_context | null };
    if (!restore) {
      holder.__lose = ext;
      ext?.loseContext();
    } else {
      holder.__lose?.restoreContext();
    }
  }, []);

  return (
    <div ref={root} className="gcl">
      <div className="gcl-stage">
        <Globe
          ref={globe}
          style={style}
          selectedId={selectedIslandId}
          onSelect={fly}
          autoRotate={spin ? 8 : 0}
          padding={padding}
          onStatusChange={setStatus}
          // For the scratch test scripts: lets them project a coordinate to a click position.
          onReady={(map) => {
            (window as unknown as { __ipgMap?: unknown }).__ipgMap = map;
          }}
          renderMarker={markers ? (island, state) => (state.live ? <span className="gcl-marker" data-selected={state.selected} /> : null) : undefined}
        />
        {card ? <div className="gcl-card" aria-hidden="true" /> : null}
      </div>

      <div className="gcl-panel">
        <h1 className="gcl-title">{L.title}</h1>
        <p className="gcl-blurb">{L.blurb}</p>

        <IslandSearch className="gcl-search" onSelect={(island) => fly(island.id)} />

        <h2 className="gcl-h">{L.fly}</h2>
        <div className="gcl-row">
          {ISLANDS.map((island) => (
            <button key={island.id} type="button" className="gcl-btn" data-status={island.status} aria-pressed={selectedIslandId === island.id} onClick={() => fly(island.id)}>
              {island.name}
            </button>
          ))}
        </div>

        <h2 className="gcl-h">{L.camera}</h2>
        <div className="gcl-row">
          <button type="button" className="gcl-btn" data-kind="primary" onClick={reset}>
            {L.reset}
          </button>
          <button type="button" className="gcl-btn" onClick={tour}>
            {L.tour}
          </button>
          <button type="button" className="gcl-btn" onClick={() => globe.current?.stop()}>
            {L.stop}
          </button>
          <button type="button" className="gcl-btn" onClick={snapshot}>
            {L.snapshot}
          </button>
        </div>

        <h2 className="gcl-h">{L.toggles}</h2>
        <div className="gcl-row">
          <label className="gcl-check">
            <input type="checkbox" checked={spin} onChange={(e) => setSpin(e.target.checked)} /> {L.spin}
          </label>
          <label className="gcl-check">
            <input type="checkbox" checked={card} onChange={(e) => setCard(e.target.checked)} /> {L.padding}
          </label>
          <label className="gcl-check">
            <input type="checkbox" checked={viaGlobe} onChange={(e) => setViaGlobe(e.target.checked)} /> {L.viaGlobe}
          </label>
          <label className="gcl-check">
            <input type="checkbox" checked={relief} onChange={(e) => setRelief(e.target.checked)} /> {L.relief}
          </label>
          <label className="gcl-check">
            <input type="checkbox" checked={markers} onChange={(e) => setMarkers(e.target.checked)} /> {L.markers}
          </label>
          <label className="gcl-check">
            {L.labels}{" "}
            <select value={labels} onChange={(e) => setLabels(e.target.value as typeof labels)}>
              <option value="none">none</option>
              <option value="minimal">minimal</option>
              <option value="full">full</option>
            </select>
          </label>
        </div>
        <div className="gcl-row">
          <button type="button" className="gcl-btn" onClick={() => loseContext(false)}>
            {L.lose}
          </button>
          <button type="button" className="gcl-btn" onClick={() => loseContext(true)}>
            {L.restore}
          </button>
        </div>

        <h2 className="gcl-h">{L.readout}</h2>
        <pre ref={fpsOut} className="gcl-fps" data-testid="fps" />
        <p className="gcl-log" data-testid="status">
          status: {status} · selected: {selectedIslandId ?? L.none}
        </p>
        <p className="gcl-log" data-testid="log">
          {log}
        </p>
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL produced on this page
          <img className="gcl-shot" src={shot} alt="Snapshot of the current globe view" data-testid="shot" />
        ) : null}
      </div>
      <OptionSwitcher />
    </div>
  );
}
