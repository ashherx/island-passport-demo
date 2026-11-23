/**
 * The cover globe's director. No React in here.
 *
 * It owns the tour of the traveler's islands (planet, dive, rest, pull back, next), the pauses
 * (the visitor touched the globe, the cover is out of sight, the passport is open) and the still
 * image that stands in for the live map whenever the cover moves. The React pieces subscribe to
 * its state; the globe itself is driven through the public handle of <Globe> only.
 *
 * The tour, for stops A B C:
 *
 *   planet (turning)  ->  dive to A, rest  ->  pull back over the region, dive to B, rest
 *   ->  pull back, dive to C, rest  ->  rise to the planet, turn  ->  A again
 *
 * The lettering under the globe follows `focusId` and `view`: it names the island from the moment
 * the camera sets off for it, and goes back to the province line on the planet.
 *
 * Reduced motion: no flights and no spin. The window is veiled for a moment, the camera cuts, the
 * veil lifts, and each view is held longer.
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import type { GlobeHandle, GlobeStatus } from "@/components/globe";
import { getIsland } from "@/lib/islands";
import { sameStops } from "./stops";
import type { CoverGlobeState, CoverStop } from "./types";
import { warmTiles } from "./warm";

/** Every duration of the tour, in one place (milliseconds unless named otherwise). */
export const TOUR = {
  /** First rest on the planet after the map appears. */
  firstRestMs: 1500,
  /** Rest on the whole planet between rounds, turning. */
  planetRestMs: 2600,
  /** Degrees per second the planet turns while it rests. */
  spinDps: 15,
  /** Rest over an island. */
  islandDwellMs: 3400,
  /** Rest over an island the visitor picked. */
  pinnedDwellMs: 11000,
  /** Zoom of the pull-back between two islands of the same region. */
  regionZoom: 6.7,
  /** Pause at the top of the pull-back. */
  hopPauseMs: 260,
  /** Multipliers on the engine's own flight durations. */
  diveSpeed: 0.86,
  hopSpeed: 0.8,
  riseSpeed: 0.8,
  /** How long the globe is left alone after the visitor lets go of it. */
  userIdleMs: 6000,
  /** Reduced motion: the veil's fade, and how long each view is held. */
  veilMs: 340,
  reducedDwellMs: 5200,
  /** No WebGL: only the lettering moves on. */
  fallbackDwellMs: 4600,
  /** Below this zoom the stops of one province are a single dot on the globe. */
  apartZoom: 4.5,
  /** Longest wait for tiles before a still image is taken. */
  stillWaitMs: 2200,
} as const;

type Entry = "planet" | "dive" | "hop" | "arrived";

/**
 * Share of the window an island's outline may fill. The window is a circle, so less than the
 * engine's default; and an islet a few hundred metres across is shown smaller still, with sea
 * around it, or it would be a featureless disc.
 */
function fillFor(id: string): number {
  const area = getIsland(id)?.areaKm2 ?? 0;
  return area > 0 && area < 8 ? 0.46 : 0.62;
}

const INITIAL: CoverGlobeState = {
  stops: [],
  focusId: null,
  view: "planet",
  phase: "boot",
  pinned: false,
  status: "poster",
  frozen: false,
  still: null,
  veil: false,
};

export class CoverGlobeController {
  private state: CoverGlobeState = INITIAL;
  private listeners = new Set<() => void>();
  private globe: GlobeHandle | null = null;
  private configured: MapLibreMap | null = null;

  /** Bumped to end whatever sequence is running. */
  private epoch = 0;
  /** The epoch of the sequence that is running, or 0. */
  private running = 0;
  private timers = new Map<number, () => void>();
  private resumeTimer = 0;

  private visible = true;
  private reduced = false;
  private enabled = true;
  private destroyed = false;
  /** The camera is in the whole-planet view (as far as this controller knows). */
  private atPlanet = true;
  /** Island the camera is resting over, or null. */
  private atIsland: string | null = null;
  private firstRest = true;
  /** mapReady() has finished setting the live map up. */
  private settled = false;
  private stillRun = 0;
  /** The island the still image shows (null: whatever the camera had when the cover first moved). */
  private stillOf: string | null = null;
  /** A still image is on its way that needs only the map's next frame. */
  private stillSoon = false;
  /** The map whose frames are being held back, if any (see holdFrames). */
  private held: MapLibreMap | null = null;

  /* ------------------------------------------------------------ store */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): CoverGlobeState => this.state;

  private set(patch: Partial<CoverGlobeState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof CoverGlobeState)[]) {
      if (this.state[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  focusStop(): CoverStop | null {
    return this.state.stops.find((s) => s.id === this.state.focusId) ?? null;
  }

  private indexOf(id: string | null): number {
    return Math.max(0, this.state.stops.findIndex((s) => s.id === id));
  }

  /* ------------------------------------------------------- wiring in */

  attach(globe: GlobeHandle | null): void {
    if (!globe) this.releaseFrames();
    this.globe = globe;
    if (!globe) {
      this.configured = null;
      this.settled = false;
    }
  }

  /** The live map is on screen: a few settings the cover needs, through MapLibre's public API. */
  mapReady(map: MapLibreMap): void {
    if (this.configured === map) return;
    this.configured = map;
    try {
      // The window is small: the whole planet only fits in it below the engine's minimum zoom.
      map.setMinZoom(-1.5);
      // Keep the in-between tiles of a dive, so the land sharpens step by step.
      map.cancelPendingTileRequestsWhileZooming = false;
    } catch {
      /* An older MapLibre: the globe is cropped slightly by the frame instead. */
    }
    map.on("moveend", (event: { originalEvent?: unknown }) => {
      // The end of a drag or a pinch: the idle time before the tour resumes counts from here.
      if (event.originalEvent && this.state.phase === "user") this.resumeAfter(TOUR.userIdleMs);
    });
    for (const stop of this.state.stops) warmTiles(map, getIsland(stop.id));
    // Re-frame the planet for the new minimum zoom, and only then let the tour begin: a flight
    // started before this cut would be ended by it.
    this.atPlanet = false;
    const settled = () => {
      if (this.configured !== map) return;
      this.atPlanet = true;
      this.settled = true;
      this.sync();
    };
    const globe = this.globe;
    if (globe) void globe.resetView({ animate: false }).then(settled, settled);
    else settled();
  }

  /**
   * A double tap zooms "around the tapped point", which MapLibre cannot do on a globe (it warns
   * and eases about the centre instead), and in a window this small it is only ever an accident
   * between two taps on neighbouring islands. The engine switches every gesture back on whenever
   * the map becomes interactive again, so the face calls this after each of those times.
   */
  tuneGestures(): void {
    try {
      this.globe?.map()?.doubleClickZoom.disable();
    } catch {
      /* no map */
    }
  }

  setStatus(status: GlobeStatus): void {
    if (status === this.state.status) return;
    const was = this.state.status;
    this.set({ status });
    if (status === "lost") {
      this.halt();
      return;
    }
    if (was === "lost" && status === "ready") this.atPlanet = false;
    // The first "ready" is followed at once by mapReady(), which starts the tour itself.
    if (status === "ready" && !this.settled) return;
    this.sync();
  }

  setStops(stops: CoverStop[]): void {
    if (sameStops(this.state.stops, stops)) return;
    const focusId = stops.some((s) => s.id === this.state.focusId) ? this.state.focusId : (stops[0]?.id ?? null);
    this.set({ stops, focusId });
    const map = this.configured;
    if (map) for (const stop of stops) warmTiles(map, getIsland(stop.id));
    this.sync();
  }

  /** The cover is on screen and the tab is showing. */
  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    if (!visible) this.halt();
    this.sync();
  }

  setReducedMotion(reduced: boolean): void {
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    if (this.running) {
      this.halt();
      this.sync();
    }
  }

  /** False parks the tour (the lab's pause switch). */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (!enabled) this.halt();
    this.sync();
  }

  destroy(): void {
    this.destroyed = true;
    this.stillRun++;
    this.releaseFrames();
    this.halt();
  }

  /** Undo destroy(): React's Strict Mode runs every effect's cleanup once before the real mount. */
  revive(): void {
    if (!this.destroyed) return;
    this.destroyed = false;
    this.sync();
  }

  /* ------------------------------------------------------ sequencing */

  private canRun(ignorePause = false): boolean {
    const s = this.state;
    return (
      !this.destroyed &&
      (this.enabled || ignorePause) &&
      this.visible &&
      !s.frozen &&
      s.stops.length > 0 &&
      ((s.status === "ready" && this.settled) || s.status === "fallback")
    );
  }

  /** End the running sequence and anything it was waiting for. */
  private halt(): void {
    this.epoch++;
    this.running = 0;
    window.clearTimeout(this.resumeTimer);
    this.resumeTimer = 0;
    const waiting = [...this.timers.entries()];
    this.timers.clear();
    for (const [id, cancel] of waiting) {
      window.clearTimeout(id);
      cancel();
    }
    this.globe?.stop();
    if (this.state.veil) this.set({ veil: false });
  }

  /** Start the tour if nothing stands in its way and it is not already running. */
  private sync(): void {
    if (this.running || this.resumeTimer) return;
    const s = this.state;
    if (!this.canRun()) {
      // The tour is switched off, but an island was picked: go there once and stay.
      if (!this.enabled && this.canRun(true) && s.pinned && s.focusId && this.atIsland !== s.focusId) {
        void this.tour(this.indexOf(s.focusId), "dive", true);
      }
      return;
    }
    if (s.phase === "boot") {
      // An island picked before the map was ready (?island= in the lab, or an early tap on a dot) is where the tour starts.
      if (s.pinned && s.focusId) void this.tour(this.indexOf(s.focusId), "dive");
      else void this.tour(0, "planet");
    }
    else if (s.view === "island" && s.focusId) void this.tour(this.indexOf(s.focusId), this.atIsland === s.focusId ? "arrived" : "dive");
    else void this.tour(this.indexOf(s.focusId), "planet");
  }

  private resumeAfter(ms: number): void {
    window.clearTimeout(this.resumeTimer);
    this.resumeTimer = window.setTimeout(() => {
      this.resumeTimer = 0;
      if (!this.canRun() || this.running) return;
      // Left where the visitor put it: carry on with the island after the one last shown.
      const s = this.state;
      const next = s.view === "island" ? this.indexOf(s.focusId) + 1 : this.indexOf(s.focusId);
      void this.tour(next, "dive");
    }, ms);
  }

  private sleep(ms: number, alive: () => boolean): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        resolve(alive());
      }, ms);
      this.timers.set(id, () => resolve(false));
    });
  }

  /** Turn the resting planet for a while, easing in and out. */
  private spin(ms: number, alive: () => boolean): Promise<boolean> {
    const map = this.globe?.map();
    if (!map || this.reduced) return this.sleep(ms, alive);
    return new Promise<boolean>((resolve) => {
      const start = performance.now();
      let last = start;
      const step = (now: number) => {
        if (!alive()) {
          resolve(false);
          return;
        }
        const t = (now - start) / ms;
        if (t >= 1) {
          resolve(true);
          return;
        }
        const edge = Math.max(0, Math.min(1, t / 0.3, (1 - t) / 0.3));
        const ease = edge * edge * (3 - 2 * edge);
        const dt = Math.min(64, now - last);
        last = now;
        const centre = map.getCenter();
        map.jumpTo({ center: [centre.lng - (TOUR.spinDps * ease * dt) / 1000, centre.lat] });
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** One camera move: a flight, or with reduced motion a cut behind the veil. */
  private async move(alive: () => boolean, fly: (globe: GlobeHandle, animate: boolean) => Promise<boolean>): Promise<boolean> {
    const globe = this.globe;
    if (!globe || this.state.status !== "ready") return alive();
    if (!this.reduced) return (await fly(globe, true)) && alive();
    this.set({ veil: true });
    if (!(await this.sleep(TOUR.veilMs, alive))) return false;
    await fly(globe, false);
    if (!(await this.sleep(60, alive))) return false;
    this.set({ veil: false });
    return alive();
  }

  /** `once`: go to the first stop and stay there (a pick made while the tour is switched off). */
  private async tour(startIndex: number, entry: Entry, once = false): Promise<void> {
    this.halt();
    const run = ++this.epoch;
    this.running = run;
    const alive = () => run === this.epoch && !this.destroyed;
    let index = startIndex;
    let mode: Entry = entry;
    const live = this.state.status === "ready";

    while (alive()) {
      const stops = this.state.stops;
      if (!stops.length) break;
      index = ((index % stops.length) + stops.length) % stops.length;
      const stop = stops[index];

      if (mode === "planet") {
        this.set({ view: "planet", phase: "planet", focusId: stop.id, pinned: false });
        this.atIsland = null;
        if (live && !this.atPlanet) {
          if (!(await this.move(alive, (g, animate) => g.resetView({ speed: TOUR.riseSpeed, animate })))) break;
          this.atPlanet = true;
        }
        const rest = this.reduced ? TOUR.reducedDwellMs : !live ? TOUR.fallbackDwellMs : this.firstRest ? TOUR.firstRestMs : TOUR.planetRestMs;
        this.firstRest = false;
        if (!(await this.spin(rest, alive))) break;
        mode = "dive";
      }

      if (mode !== "arrived") {
        this.set({ view: "island", phase: live ? "travel" : "island", focusId: stop.id });
        this.atPlanet = false;
        this.atIsland = null;
        if (mode === "hop" && !this.reduced) {
          // Pull back until the neighbouring islands are in view, already centred on the next one.
          if (!(await this.move(alive, (g) => g.flyToIsland(stop.id, { zoom: TOUR.regionZoom, speed: TOUR.hopSpeed })))) break;
          if (!(await this.sleep(TOUR.hopPauseMs, alive))) break;
        }
        if (!(await this.move(alive, (g, animate) => g.flyToIsland(stop.id, { speed: TOUR.diveSpeed, fill: fillFor(stop.id), animate })))) break;
        this.atIsland = stop.id;
      }

      this.set({ view: "island", phase: "island", focusId: stop.id });
      if (once) {
        this.running = 0;
        return;
      }
      const dwell = this.state.pinned ? TOUR.pinnedDwellMs : this.reduced ? TOUR.reducedDwellMs : live ? TOUR.islandDwellMs : TOUR.fallbackDwellMs;
      if (!(await this.sleep(dwell, alive))) break;
      if (this.state.pinned) this.set({ pinned: false });

      index += 1;
      mode = index >= stops.length ? "planet" : "hop";
    }

    if (this.running === run) {
      // Ended without being stopped by us: a flight was interrupted from outside (a resize, say).
      this.running = 0;
      if (alive()) this.resumeAfter(1200);
    }
  }

  /* ------------------------------------------------------ the visitor */

  /** The visitor touched, dragged or scrolled the globe: the tour stands down for a while. */
  userInteracted(): void {
    if (this.state.frozen || this.destroyed) return;
    this.halt();
    this.atPlanet = false;
    this.atIsland = null;
    this.set({ phase: "user" });
    this.resumeAfter(TOUR.userIdleMs);
  }

  /** The visitor picked an island (a tap on the globe, or one of the dots under it). */
  select(id: string): void {
    if (this.destroyed || this.state.frozen) return;
    const index = this.state.stops.findIndex((s) => s.id === id);
    if (index < 0) return;
    this.halt();
    this.set({ focusId: id, view: "island", pinned: true });
    if (!this.canRun(true)) return;
    void this.tour(index, this.atIsland === id ? "arrived" : "dive", !this.enabled);
  }

  /**
   * A tap on the globe itself. From far out the stops are one dot (they are a few kilometres
   * apart), and which of them the tap "hit" is chance: there it means the first stop.
   */
  selectOnMap(id: string): void {
    let zoom = Infinity;
    try {
      zoom = this.globe?.map()?.getZoom() ?? Infinity;
    } catch {
      /* no map */
    }
    const first = this.state.stops[0]?.id;
    this.select(zoom < TOUR.apartZoom && first ? first : id);
  }

  /* ------------------------------------------------- the open passport */

  /**
   * The passport is no longer closed. The tour stops, and a still image of the globe takes the
   * live map's place, so nothing renders in WebGL while the cover swings and pages turn.
   */
  freeze(): void {
    if (this.state.frozen || this.destroyed) return;
    const focus = this.focusStop();
    this.halt();
    // From here on the lettering names the island the book opens on.
    this.set({ frozen: true, phase: "held", view: focus ? "island" : this.state.view });
    void this.takeStill("now", this.atIsland);
  }

  /** The passport is closed again: the live map comes back and the tour resumes on the focus island. */
  unfreeze(): void {
    if (!this.state.frozen || this.destroyed) return;
    this.stillRun++;
    this.stillSoon = false;
    this.stillOf = null;
    this.releaseFrames();
    try {
      this.globe?.map()?.triggerRepaint();
    } catch {
      /* no map */
    }
    this.set({ frozen: false, still: null });
    this.sync();
  }

  /**
   * While the passport is open, a page is about to turn: the hidden map stops drawing at once,
   * whatever it was in the middle of. (It is brought up to date when the book is at rest again.)
   */
  bookMoving(): void {
    if (!this.state.frozen || this.destroyed) return;
    // The still taken as the cover started to move is one frame away: let that frame through.
    if (this.stillSoon) return;
    this.stillRun++;
    this.holdFrames();
  }

  /**
   * The cover is about to swing shut. `id` is the island of the page it is closing over, when
   * that is one of the stops (a reader can close before the map has followed the last page turn).
   * If the still image does not show that island yet, the camera is cut there and the still is
   * renewed with the map's very next frame, so the cover never comes back on an earlier island.
   * Then the map stops drawing until the book lies closed.
   */
  bookClosing(id: string | null = null): void {
    if (!this.state.frozen || this.destroyed) return;
    const target = id !== null && this.state.stops.some((s) => s.id === id) ? id : this.state.focusId;
    if (target !== null && (target !== this.state.focusId || this.state.view !== "island")) {
      this.set({ focusId: target, view: "island", pinned: false });
    }
    const globe = this.globe;
    if (target === null || !globe || this.state.status !== "ready" || this.stillOf === target) {
      this.bookMoving();
      return;
    }
    if (this.atIsland !== target) {
      this.stillRun++;
      this.stillSoon = false;
      this.releaseFrames();
      this.atPlanet = false;
      this.atIsland = target;
      void globe.flyToIsland(target, { animate: false, fill: fillFor(target) });
    }
    void this.takeStill("now", target);
  }

  /** The map has been given another look (the art direction changed): a still image of the old one is stale. */
  restyled(): void {
    if (!this.state.frozen || this.destroyed) return;
    void this.takeStill("idle", this.atIsland);
  }

  /**
   * While the passport is open: bring the hidden globe to this island (a cut, no flight) and
   * renew the still image, so that closing the passport finds the cover on the page it was
   * closed from. Call it when the book is at rest, never mid-flip.
   */
  async showIsland(id: string): Promise<void> {
    if (this.destroyed) return;
    if (!this.state.stops.some((s) => s.id === id)) return;
    if (!this.state.frozen) {
      this.select(id);
      return;
    }
    this.set({ focusId: id, view: "island", pinned: false });
    if (this.stillOf === id) return;
    const globe = this.globe;
    if (!globe || this.state.status !== "ready") return;
    const run = ++this.stillRun;
    this.stillSoon = false;
    this.releaseFrames();
    const cut = this.atIsland !== id;
    if (cut) {
      this.atPlanet = false;
      this.atIsland = null;
      await globe.flyToIsland(id, { animate: false, fill: fillFor(id) });
      if (this.destroyed || !this.state.frozen || this.state.focusId !== id) return;
      this.atIsland = id;
      // A page started to turn (or another request came) while the camera was being cut.
      if (run !== this.stillRun) return;
    }
    // After a cut the map has not yet asked for the new view's tiles: wait until it has them.
    await this.takeStill(cut ? "idle" : "tiles", id);
  }

  /* ------------------------------------------------ frames held back */

  /**
   * While the passport is open nothing may draw in WebGL: a page turning over a map that is still
   * fetching tiles and fading them in would share its frames with it. MapLibre has no pause, but
   * every frame it draws is asked for through `map.triggerRepaint()`, so while frames are held
   * that method is shadowed on the instance by one that does nothing. Releasing removes the
   * shadow and asks for one frame, which picks up everything that changed in the meantime.
   */
  private holdFrames(): void {
    if (this.held) return;
    const map = this.globe?.map();
    if (!map || this.state.status !== "ready") return;
    try {
      (map as { triggerRepaint: () => void }).triggerRepaint = () => {};
      this.held = map;
    } catch {
      /* A frozen object: the map keeps drawing, as it did before this existed. */
    }
  }

  private releaseFrames(): void {
    const map = this.held;
    if (!map) return;
    this.held = null;
    try {
      delete (map as { triggerRepaint?: () => void }).triggerRepaint;
      map.triggerRepaint();
    } catch {
      /* The map was removed. */
    }
  }

  /**
   * Take a still image of the map and hold its frames back from then on.
   * `wait`: "now" takes the next frame as it is; "tiles" waits for the view's tiles (if any are
   * missing); "idle" waits for the map's next idle frame whatever its state (after a restyle).
   * `of`: the island the camera is over, or null.
   */
  private async takeStill(wait: "now" | "tiles" | "idle", of: string | null): Promise<void> {
    const globe = this.globe;
    if (!globe || this.state.status !== "ready") return;
    const run = ++this.stillRun;
    this.stillSoon = false;
    this.releaseFrames();
    const map = globe.map();
    if (wait !== "now" && map) {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          map.off("idle", finish);
          resolve();
        };
        const timer = window.setTimeout(finish, TOUR.stillWaitMs);
        let loaded = false;
        if (wait === "tiles") {
          try {
            loaded = map.areTilesLoaded() && !map.isMoving();
          } catch {
            loaded = true;
          }
        }
        if (loaded) finish();
        else map.on("idle", finish);
      });
    }
    if (run !== this.stillRun || !this.state.frozen) return;
    this.stillSoon = true;
    try {
      const still = await globe.snapshot({ type: "image/png", maxSize: 720 });
      if (run === this.stillRun && this.state.frozen) {
        this.stillOf = of;
        this.set({ still });
        this.holdFrames();
      }
    } catch {
      /* The map went away: the live canvas simply stays where it is. */
    } finally {
      if (run === this.stillRun) this.stillSoon = false;
    }
  }
}
