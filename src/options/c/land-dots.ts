/**
 * Option C: the continents as a field of evenly spaced dots.
 *
 * At globe altitude this option draws no land shapes at all: the land is a halftone of fine dots
 * on a pale sphere, and the crisp map only resolves as the camera comes down. The dots are worked
 * out in the browser from the coarse world outline the static poster already ships
 * (src/components/globe/land.generated.json, 18 KB), so they cost no extra download.
 *
 * Rows of constant latitude, `pitch` degrees apart; within a row the dots are `pitch / cos(lat)`
 * degrees of longitude apart, so their spacing on the sphere is the same everywhere (a plain
 * longitude grid would bunch up toward the poles). Alternate rows are offset by half a step.
 * Land is tested one row at a time: where the row's latitude crosses the outline it is cut into
 * spans (even-odd), and only dots inside a span are kept. A few thousand operations in all.
 */
import land from "@/components/globe/land.generated.json";

const LAND = land as { q: number; rings: number[][] };

export interface DotCollection {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: Record<string, never>; geometry: { type: "MultiPoint"; coordinates: [number, number][] } }[];
}

let cache: { pitch: number; data: DotCollection } | null = null;

/** Dots on land, as one GeoJSON MultiPoint per band of latitude (so tiles stay small). */
export function landDots(pitch = 1.15): DotCollection {
  if (cache && cache.pitch === pitch) return cache.data;
  const q = LAND.q;
  const bands = new Map<number, [number, number][]>();
  let row = 0;
  // Antarctica is left out: it sits under the globe in every view this option shows, and its
  // outline runs along the edge of the map where a row cannot be cut cleanly.
  for (let lat = -58 + pitch / 2; lat < 84; lat += pitch, row++) {
    const crossings: number[] = [];
    for (const ring of LAND.rings) {
      const n = ring.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const y1 = ring[i * 2 + 1] / q;
        const y2 = ring[j * 2 + 1] / q;
        if (y1 > lat === y2 > lat) continue;
        const x1 = ring[i * 2] / q;
        const x2 = ring[j * 2] / q;
        // An edge that wraps the antimeridian would cut across the whole row: skip it.
        if (Math.abs(x2 - x1) > 180) continue;
        crossings.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);
    const step = 360 / Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / pitch));
    const offset = row % 2 ? step / 2 : 0;
    const band = Math.floor((lat + 90) / 30);
    let points = bands.get(band);
    if (!points) bands.set(band, (points = []));
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = crossings[k];
      const to = crossings[k + 1];
      // A span narrower than a third of a step is a sliver of coast: no dot.
      if (to - from < step * 0.34) continue;
      const first = Math.ceil((from + 180 - offset) / step);
      for (let x = -180 + offset + first * step; x <= to; x += step) {
        points.push([Math.round(x * 100) / 100, Math.round(lat * 100) / 100]);
      }
    }
  }
  const data: DotCollection = {
    type: "FeatureCollection",
    features: [...bands.values()].map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates } })),
  };
  cache = { pitch, data };
  return data;
}
