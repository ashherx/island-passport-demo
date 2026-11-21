/**
 * The island's aura: the wide, soft glow that blooms around an island when the camera lands.
 *
 * A wide blurred line drawn along a real coastline piles up into spikes wherever the coast has
 * detail finer than the line is wide (spits, inlets). So the aura does not follow the coast: it
 * follows the island's convex hull, rounded off and pushed out a little. That shape has only
 * gentle turns, and the glow reads as light around the island rather than a traced outline.
 * A narrow bright line on the true outline (style.ts) keeps the definition.
 *
 * The hulls are computed in the browser from the outlines the engine already loaded, so a new
 * island needs nothing extra.
 */
import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import { ATLAS, BLOOM_CORE_LAYER, BLOOM_LAYER } from "./style";

export const AURA_SOURCE = "da-aura";

type Point = [number, number];

interface AnyFeature {
  properties?: Record<string, unknown> | null;
  geometry?: { type: string; coordinates: unknown } | null;
}

/** Every position in a geometry's coordinates, whatever its nesting. */
function collect(coordinates: unknown, out: Point[]): void {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    out.push([coordinates[0], coordinates[1]]);
    return;
  }
  for (const part of coordinates) collect(part, out);
}

/** Andrew's monotone chain. Returns the hull counter-clockwise, without repeating the first point. */
function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Drop hull points closer together than `min`, so no segment is shorter than the glow is wide. */
function thin(ring: Point[], min: number): Point[] {
  const out: Point[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= min) out.push(p);
  }
  if (out.length > 3 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < min) out.pop();
  return out;
}

/** Chaikin corner cutting on a closed ring. */
function smooth(ring: Point[], passes: number): Point[] {
  let current = ring;
  for (let pass = 0; pass < passes; pass++) {
    const next: Point[] = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    current = next;
  }
  return current;
}

function auraOf(feature: AnyFeature): { type: "Feature"; properties: Record<string, unknown>; geometry: { type: "LineString"; coordinates: Point[] } } | null {
  const points: Point[] = [];
  collect(feature.geometry?.coordinates, points);
  if (points.length < 3) return null;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [x, y] of points) {
    if (x < west) west = x;
    if (x > east) east = x;
    if (y < south) south = y;
    if (y > north) north = y;
  }
  // Longitude degrees are shorter than latitude degrees away from the equator: work in a locally
  // square space so the hull is thinned and grown evenly.
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180) || 1;
  const size = Math.max((east - west) * k, north - south);
  const cx = (west + east) / 2;
  const cy = (south + north) / 2;
  const local = points.map<Point>(([x, y]) => [(x - cx) * k, y - cy]);
  let ring = thin(convexHull(local), size * 0.09);
  if (ring.length < 3) return null;
  // Push the hull out a little, so the light sits around the island, not on its shore.
  ring = ring.map<Point>(([x, y]) => {
    const d = Math.hypot(x, y) || 1;
    const grow = 1 + (size * 0.035) / d;
    return [x * grow, y * grow];
  });
  ring = smooth(ring, 3);
  const coordinates = ring.map<Point>(([x, y]) => [x / k + cx, y + cy]);
  coordinates.push(coordinates[0]);
  return { type: "Feature", properties: { id: feature.properties?.id ?? "", status: feature.properties?.status ?? "live" }, geometry: { type: "LineString", coordinates } };
}

const bloomLayer: LayerSpecification = {
  id: BLOOM_LAYER,
  type: "line",
  source: AURA_SOURCE,
  filter: ["==", ["get", "id"], ""],
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-color": ["case", ["==", ["get", "status"], "live"], ATLAS.turquoiseGlow, ATLAS.apricotGlow],
    "line-opacity": 0,
    "line-opacity-transition": { duration: 800, delay: 0 },
    "line-width": ["interpolate", ["linear"], ["zoom"], 4, 14, 9, 44, 14, 60],
    "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 12, 9, 36, 14, 48],
  },
};

/**
 * Add the aura source and its bloom layer to a loaded map. Safe to call again (a rebuilt map,
 * a restyle): it does nothing when the layer is already there. Resolves true once the layer exists.
 */
export async function installAura(map: MapLibreMap, outlineSourceId: string): Promise<boolean> {
  try {
    if (map.getLayer(BLOOM_LAYER)) return true;
    const source = map.getSource(outlineSourceId) as GeoJSONSource | undefined;
    if (!source || typeof source.getData !== "function") return false;
    const data = (await source.getData()) as { features?: AnyFeature[] } | null;
    const features = (data?.features ?? []).map(auraOf).filter((f): f is NonNullable<ReturnType<typeof auraOf>> => f !== null);
    if (!features.length) return false;
    // The map may have been restyled or removed while the data was on its way.
    if (map.getLayer(BLOOM_LAYER)) return true;
    if (!map.getSource(AURA_SOURCE)) {
      map.addSource(AURA_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features } as never, tolerance: 0 });
    }
    map.addLayer(bloomLayer, map.getLayer(BLOOM_CORE_LAYER) ? BLOOM_CORE_LAYER : undefined);
    return true;
  } catch {
    // No aura is a cosmetic loss only: the island still has its outline and narrow glow.
    return false;
  }
}
