/**
 * Camera sums option A needs outside the engine: the zoom an island is framed at, worked out the
 * way the engine does it (src/components/globe/engine.ts, islandCamera), so a layout can hand the
 * engine an exact target and the shell knows how close a dive is to its end.
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import { fitBounds, zoomForLimb, type Padding } from "@/components/globe";
import { cameraDistance, globeRadius, homeLimb, limbRadius } from "@/components/globe/camera";
import type { GlobeIsland } from "@/lib/islands";

/**
 * Zoom that frames `island` inside the area `padding` leaves free.
 * `islandSize` and `homeLatitude` are the globe size and home latitude in force once the island
 * is open: the engine never frames closer to the whole-globe view than 1.5 zoom levels.
 */
export function islandZoom(map: MapLibreMap, island: GlobeIsland, padding: Padding, islandSize: number, homeLatitude: number): number {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth || 390;
  const height = canvas.clientHeight || 844;
  const freeW = Math.max(80, width - padding.left - padding.right);
  const freeH = Math.max(80, height - padding.top - padding.bottom);
  const wholeGlobe = zoomForLimb((Math.min(freeW, freeH) * islandSize) / 2, homeLatitude, height);
  return fitBounds(island.bbox, width, height, padding, { minZoom: wholeGlobe + 1.5, maxZoom: island.view?.maxZoom ?? 13.6 }).zoom;
}

export const lerpPadding = (a: Padding, b: Padding, t: number): Padding => ({
  top: a.top + (b.top - a.top) * t,
  right: a.right + (b.right - a.right) * t,
  bottom: a.bottom + (b.bottom - a.bottom) * t,
  left: a.left + (b.left - a.left) * t,
});

/**
 * The engine moves the map's padding from a flight's start to its end with an ease-in-out
 * quadratic of the flight's progress. Reading the padding back therefore gives the progress,
 * with no clock of our own. Returns null when the padding does not change enough to tell.
 */
export function flightProgress(now: Padding, from: Padding, to: Padding): number | null {
  let side: keyof Padding = "top";
  for (const key of ["right", "bottom", "left"] as const) {
    if (Math.abs(to[key] - from[key]) > Math.abs(to[side] - from[side])) side = key;
  }
  const span = to[side] - from[side];
  if (Math.abs(span) < 2) return null;
  const eased = Math.max(0, Math.min(1, (now[side] - from[side]) / span));
  return eased < 0.5 ? Math.sqrt(eased / 2) : 1 - Math.sqrt((1 - eased) / 2);
}

const cosLat = (latitude: number) => Math.cos((Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180);

/**
 * "Apparent zoom": zoom corrected for latitude, so equal values mean an equally large planet on
 * screen. It is what the engine's flights interpolate (camera.ts in the globe engine).
 */
export const apparentZoom = (zoom: number, latitude: number) => zoom - Math.log2(cosLat(latitude));
export const rawZoom = (apparent: number, latitude: number) => apparent + Math.log2(cosLat(latitude));

/** Radius of the planet's silhouette on screen, in px, at this zoom (what the engine publishes as --globe-r). */
export function silhouetteRadius(map: MapLibreMap, zoom = map.getZoom(), latitude = map.getCenter().lat): number {
  const height = map.getCanvas().clientHeight || 844;
  return limbRadius(globeRadius(zoom, latitude), cameraDistance(height));
}

/** The zoom of the landing's whole-globe view, the way the engine works it out (homeCamera). */
export function homeZoom(map: MapLibreMap, padding: Padding, globeSize: number, latitude: number): number {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth || 390;
  const height = canvas.clientHeight || 844;
  return zoomForLimb(homeLimb(width, height, padding, globeSize), latitude, height);
}

/**
 * The engine dives to an island with an ease-in-out cubic of time. Given the share of the dive's
 * height it has covered, this is how far through the dive it is in time (both 0 to 1).
 */
export function diveTime(share: number): number {
  const p = Math.max(0, Math.min(1, share));
  return p < 0.5 ? Math.cbrt(p / 4) : 1 - Math.cbrt(2 * (1 - p)) / 2;
}
