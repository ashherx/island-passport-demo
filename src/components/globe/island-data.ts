/**
 * Island geometry for the map: loads the outlines fetched from OpenStreetMap
 * (public/geo/islands.geojson, see scripts/fetch-coastlines.mjs) and stamps the properties the
 * style layers read onto every feature, taken from the island data, not from the file. So an
 * island's status, name or rank can change in the data without re-running the script (TEC-11).
 */
import type { GlobeIsland } from "@/lib/islands";

/* Minimal GeoJSON shapes: all this module needs, without depending on a types package. */
interface Polygon {
  type: "Polygon";
  coordinates: number[][][];
}
interface MultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}
interface Point {
  type: "Point";
  coordinates: [number, number];
}
interface Feature<G, P> {
  type: "Feature";
  id?: string;
  properties: P;
  geometry: G;
}
interface FeatureCollection<G, P> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}

export const OUTLINES_URL = "/geo/islands.geojson";

/** Properties on every island feature, in both sources. */
export interface IslandFeatureProps {
  id: string;
  name: string;
  country: string;
  status: GlobeIsland["status"];
  rank: number;
  /** Zoom from which the island is marked at all. */
  minZoom: number;
  /** Zoom at which the outline is large enough to replace the dot. */
  dotZoom: number;
}

export interface IslandCollections {
  outlines: FeatureCollection<Polygon | MultiPolygon, IslandFeatureProps>;
  /** The outlines again, simplified and rounded: what the wide, blurred glow strokes follow. */
  glow: FeatureCollection<Polygon | MultiPolygon, IslandFeatureProps>;
  points: FeatureCollection<Point, IslandFeatureProps>;
}

export const EMPTY_COLLECTION: IslandCollections = {
  outlines: { type: "FeatureCollection", features: [] },
  glow: { type: "FeatureCollection", features: [] },
  points: { type: "FeatureCollection", features: [] },
};

type Outlines = Map<string, Polygon | MultiPolygon>;

let pending: Promise<Outlines> | null = null;

/** Outlines by island id. Fetched once per page; an empty map if the file cannot be loaded. */
export function loadIslandGeometry(): Promise<Outlines> {
  pending ??= fetch(OUTLINES_URL)
    .then((res) => (res.ok ? (res.json() as Promise<FeatureCollection<Polygon | MultiPolygon, { id?: string }>>) : null))
    .then((collection) => {
      const outlines: Outlines = new Map();
      for (const feature of collection?.features ?? []) {
        if (feature.properties?.id) outlines.set(feature.properties.id, feature.geometry);
      }
      return outlines;
    })
    .catch(() => {
      // Offline or blocked: the globe still works with dots and labels, just without outlines.
      pending = null;
      return new Map() as Outlines;
    });
  return pending;
}

/** Rank 2 islands are marked once the camera is over their region. */
const RANK_2_MIN_ZOOM = 6.8;
/** An outline replaces its dot once its longer side is about this many pixels. */
const OUTLINE_VISIBLE_PX = 30;

export function featureProps(island: GlobeIsland): IslandFeatureProps {
  const [west, south, east, north] = island.bbox;
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
  const span = Math.max((east - west) / 360, mercator(north) - mercator(south), 1e-7);
  return {
    id: island.id,
    name: island.name,
    country: island.country,
    status: island.status,
    rank: island.rank,
    minZoom: island.rank === 1 ? 0 : RANK_2_MIN_ZOOM,
    dotZoom: Math.round(Math.log2(OUTLINE_VISIBLE_PX / (512 * span)) * 10) / 10,
  };
}

/** Douglas-Peucker on a closed ring; x is scaled by `kx` so the tolerance is even in both axes. */
function simplifyRing(ring: number[][], tolerance: number, kx: number): number[][] {
  const n = ring.length;
  if (n < 6) return ring;
  let far = 1;
  let farD = -1;
  for (let i = 1; i < n - 1; i++) {
    const d = ((ring[i][0] - ring[0][0]) * kx) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const keep = new Uint8Array(n);
  keep[0] = keep[far] = keep[n - 1] = 1;
  const stack: [number, number][] = [
    [0, far],
    [far, n - 1],
  ];
  const tol2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = ring[a][0] * kx;
    const ay = ring[a][1];
    const dx = ring[b][0] * kx - ax;
    const dy = ring[b][1] - ay;
    const len2 = dx * dx + dy * dy || 1e-18;
    let worst = -1;
    let worstD = tol2;
    for (let i = a + 1; i < b; i++) {
      const px = ring[i][0] * kx - ax;
      const py = ring[i][1] - ay;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
      const d = (px - t * dx) ** 2 + (py - t * dy) ** 2;
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

/** One pass of Chaikin corner cutting on a closed ring: every corner becomes two gentler ones. */
function roundRing(ring: number[][]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
  }
  out.push(out[0]);
  return out;
}

/**
 * A soft version of an outline for the glow. A wide blurred stroke along a detailed coastline
 * piles up into dark spikes at every sharp corner; along a simplified, rounded one it is smooth.
 * The crisp outline on top still follows the real coast.
 */
function softOutline(geometry: Polygon | MultiPolygon, island: GlobeIsland): Polygon | MultiPolygon {
  const [west, south, east, north] = island.bbox;
  const kx = Math.cos((((south + north) / 2) * Math.PI) / 180);
  // The outline's own extent, not the camera bbox (they differ for an island framed on one corner).
  let w = Infinity, e = -Infinity, sMin = Infinity, nMax = -Infinity;
  const rings = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < sMin) sMin = y;
      if (y > nMax) nMax = y;
    }
  }
  const size = Number.isFinite(w) ? Math.hypot((e - w) * kx, nMax - sMin) : Math.hypot((east - west) * kx, north - south);
  const soften = (ring: number[][]) => roundRing(roundRing(roundRing(simplifyRing(ring, size / 80, kx))));
  return geometry.type === "Polygon"
    ? { type: "Polygon", coordinates: [soften(geometry.coordinates[0])] }
    : { type: "MultiPolygon", coordinates: geometry.coordinates.map((polygon) => [soften(polygon[0])]) };
}

export function buildIslandData(islands: readonly GlobeIsland[], outlines: Outlines): IslandCollections {
  const polygonFeatures: Feature<Polygon | MultiPolygon, IslandFeatureProps>[] = [];
  const glowFeatures: Feature<Polygon | MultiPolygon, IslandFeatureProps>[] = [];
  const pointFeatures: Feature<Point, IslandFeatureProps>[] = [];
  for (const island of islands) {
    const properties = featureProps(island);
    const geometry = outlines.get(island.id);
    if (geometry) {
      polygonFeatures.push({ type: "Feature", id: island.id, properties, geometry });
      glowFeatures.push({ type: "Feature", id: island.id, properties, geometry: softOutline(geometry, island) });
    }
    pointFeatures.push({
      type: "Feature",
      id: island.id,
      properties,
      geometry: { type: "Point", coordinates: [island.coordinates[0], island.coordinates[1]] },
    });
  }
  return {
    outlines: { type: "FeatureCollection", features: polygonFeatures },
    glow: { type: "FeatureCollection", features: glowFeatures },
    points: { type: "FeatureCollection", features: pointFeatures },
  };
}
