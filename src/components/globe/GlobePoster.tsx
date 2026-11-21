"use client";

/**
 * The static globe: what the visitor sees before MapLibre has loaded (UX-7), while the WebGL
 * context is lost, and for good when the browser has no WebGL.
 *
 * It is an SVG of the world's land, projected with the same perspective as the live globe's home
 * view (see camera.ts) and sized by CSS alone, so the server-rendered HTML is already the right
 * size and in the right place on any screen, and the live map fades in exactly over it.
 * Colours come from CSS variables (--globe-ocean, --globe-land, --globe-shore, --globe-dot),
 * which default to the option palette.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { islandStrings, type GlobeIsland, type LngLat } from "@/lib/islands";
import { t } from "@/lib/strings";
import { homeLimb, perspectiveRatio, projectToDisc, type Padding } from "./camera";
import land from "./land.generated.json";

/** The size assumed on the server: a phone in portrait, where most visitors are. */
const ASSUMED = { width: 390, height: 844 };

const LAND = land as { q: number; rings: number[][] };

interface DiscPoint {
  x: number;
  /** North is up here; the SVG flips it. */
  y: number;
  visible: boolean;
}

/** A stretch of coastline on the near side, from where it rises over the horizon to where it sets. */
interface Run {
  points: DiscPoint[];
  /** Angles on the horizon circle where the run starts and ends, radians, counter-clockwise from east. */
  enter: number;
  exit: number;
  used: boolean;
}

/**
 * Land outline as an SVG path in a -1..1 box (the visible disc is the unit circle).
 *
 * Each ring is clipped against the horizon. Rings run counter-clockwise (land on the left), so
 * where a coastline sets below the horizon the shape continues along the horizon,
 * counter-clockwise, to the next place a coastline rises: the standard polygon clip against a
 * circle. Without it, a continent that wraps round the back of the planet fills the whole disc.
 */
function landPath(centre: LngLat, rho: number): string {
  const q = LAND.q;
  const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
  const project = (lng: number, lat: number): DiscPoint => {
    const p = projectToDisc([lng, lat], centre, rho);
    return { x: p.x, y: -p.y, visible: p.visible };
  };
  const TWO_PI = Math.PI * 2;
  const parts: string[] = [];

  const emit = (points: DiscPoint[]) => {
    let d = "";
    let lastX = NaN;
    let lastY = NaN;
    for (const p of points) {
      if (Math.abs(p.x - lastX) < 0.003 && Math.abs(p.y - lastY) < 0.003) continue;
      d += `${d ? "L" : "M"}${f(p.x)} ${f(-p.y)}`;
      lastX = p.x;
      lastY = p.y;
    }
    if (d) parts.push(d + "Z");
  };

  for (const ring of LAND.rings) {
    // Densify: long edges are straight in longitude and latitude but curved on the sphere.
    const coords: [number, number][] = [];
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const lng = ring[i * 2] / q;
      const lat = ring[i * 2 + 1] / q;
      const j = (i + 1) % n;
      const lng2 = ring[j * 2] / q;
      const lat2 = ring[j * 2 + 1] / q;
      coords.push([lng, lat]);
      const span = Math.max(Math.abs(lng2 - lng), Math.abs(lat2 - lat));
      if (span > 3) {
        const steps = Math.ceil(span / 3);
        for (let k = 1; k < steps; k++) coords.push([lng + ((lng2 - lng) * k) / steps, lat + ((lat2 - lat) * k) / steps]);
      }
    }
    const pts = coords.map(([lng, lat]) => project(lng, lat));
    const m = pts.length;
    const firstHidden = pts.findIndex((p) => !p.visible);
    if (firstHidden < 0) {
      emit(pts);
      continue;
    }
    if (!pts.some((p) => p.visible)) continue;

    /** Where the edge from a to b crosses the horizon, found by bisection. */
    const crossing = (a: number, b: number): DiscPoint => {
      let lo = 0;
      let hi = 1;
      const [lng1, lat1] = coords[a];
      const [lng2, lat2] = coords[b];
      const visibleAtStart = pts[a].visible;
      let best = pts[visibleAtStart ? a : b];
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        const p = project(lng1 + (lng2 - lng1) * mid, lat1 + (lat2 - lat1) * mid);
        if (p.visible === visibleAtStart) lo = mid;
        else hi = mid;
        if (p.visible) best = p;
      }
      // Snap to the circle.
      const len = Math.hypot(best.x, best.y) || 1;
      return { x: best.x / len, y: best.y / len, visible: true };
    };

    // Walk the ring from a hidden point, collecting the visible runs.
    const runs: Run[] = [];
    let current: DiscPoint[] | null = null;
    let enter = 0;
    for (let step = 1; step <= m; step++) {
      const a = (firstHidden + step - 1) % m;
      const b = (firstHidden + step) % m;
      if (!pts[a].visible && pts[b].visible) {
        const c = crossing(a, b);
        enter = Math.atan2(c.y, c.x);
        current = [c, pts[b]];
      } else if (pts[a].visible && pts[b].visible) {
        current?.push(pts[b]);
      } else if (pts[a].visible && !pts[b].visible && current) {
        const c = crossing(a, b);
        current.push(c);
        runs.push({ points: current, enter, exit: Math.atan2(c.y, c.x), used: false });
        current = null;
      }
    }

    // Stitch runs together along the horizon.
    for (const start of runs) {
      if (start.used) continue;
      const outline: DiscPoint[] = [];
      let run = start;
      for (let guard = 0; guard <= runs.length; guard++) {
        run.used = true;
        outline.push(...run.points);
        // The next run is the one that rises first, going counter-clockwise from where this one set.
        let next = start;
        let gap = Infinity;
        for (const candidate of runs) {
          if (candidate.used && candidate !== start) continue;
          const turn = (((candidate.enter - run.exit) % TWO_PI) + TWO_PI) % TWO_PI;
          if (turn < gap) {
            gap = turn;
            next = candidate;
          }
        }
        const arcSteps = Math.ceil(gap / 0.1);
        for (let k = 1; k < arcSteps; k++) {
          const angle = run.exit + (gap * k) / arcSteps;
          outline.push({ x: Math.cos(angle), y: Math.sin(angle), visible: true });
        }
        if (next === start) break;
        run = next;
      }
      emit(outline);
    }
  }
  return parts.join("");
}

export interface GlobePosterProps {
  hidden: boolean;
  islands: readonly GlobeIsland[];
  padding: Padding;
  globeSize: number;
  homeCenter: LngLat;
  staticImage?: string;
  /** True in fallback mode: the island dots are buttons. */
  interactive: boolean;
  selectedId: string | null;
  onSelect(island: GlobeIsland): void;
  label: string;
}

export function GlobePoster({ hidden, islands, padding, globeSize, homeCenter, staticImage, interactive, selectedId, onSelect, label }: GlobePosterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(ASSUMED);

  // The strength of the perspective depends on the real box; refine it once that is known.
  useLayoutEffect(() => {
    const stage = ref.current?.parentElement;
    if (!stage) return;
    const measure = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (width && height) setBox((b) => (b.width === width && b.height === height ? b : { width, height }));
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const limb = homeLimb(box.width, box.height, padding, globeSize);
  // Rounded so tiny size changes do not rebuild the path.
  const rho = Math.round(perspectiveRatio(limb, box.height) * 50) / 50;
  const [lng, lat] = homeCenter;
  const path = useMemo(() => (staticImage ? "" : landPath([lng, lat], rho)), [staticImage, lng, lat, rho]);

  const dots = useMemo(() => {
    if (staticImage) return [];
    return islands
      .filter((island) => island.rank === 1)
      .map((island) => ({ island, ...projectToDisc(island.coordinates, [lng, lat], rho) }))
      .filter((d) => d.visible);
  }, [islands, staticImage, lng, lat, rho]);

  return (
    <div ref={ref} className="ipg-poster" data-hidden={hidden ? "true" : "false"} role={interactive ? "group" : undefined} aria-label={interactive ? label : undefined} aria-hidden={interactive ? undefined : true}>
      {staticImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- a plain image: it must paint before any script runs
        <img className="ipg-poster-img" src={staticImage} alt="" decoding="async" />
      ) : (
        <svg className="ipg-poster-svg" viewBox="-1 -1 2 2" aria-hidden="true" focusable="false">
          <circle className="ipg-poster-ocean" r="1" />
          <path className="ipg-poster-land" d={path} />
          <circle className="ipg-poster-rim" r="1" />
        </svg>
      )}
      {dots.map(({ island, x, y }) => {
        const style = { left: `${(50 + x * 50).toFixed(2)}%`, top: `${(50 + y * 50).toFixed(2)}%` };
        const live = island.status === "live";
        return interactive ? (
          <button
            key={island.id}
            type="button"
            className="ipg-poster-dot"
            data-live={live}
            data-selected={island.id === selectedId}
            style={style}
            onClick={() => onSelect(island)}
            aria-label={t(islandStrings.globe.islandLabel, { name: island.name, country: island.country })}
          >
            <span className="ipg-poster-dot-name">{island.name}</span>
          </button>
        ) : (
          <span key={island.id} className="ipg-poster-dot" data-live={live} style={style} />
        );
      })}
    </div>
  );
}
