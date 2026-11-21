/**
 * Camera maths for the globe: how big the planet is on screen at a given zoom, what zoom frames an
 * island, and the flight path between two views. Pure functions, no MapLibre import, so the
 * static poster (drawn before MapLibre loads) uses exactly the same numbers as the live map.
 */
import type { BBox, LngLat } from "@/lib/islands";

/** MapLibre's default vertical field of view, in degrees, and its tile size. */
export const FOV_DEG = 36.87;
const TILE_SIZE = 512;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface CameraState {
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_PADDING: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

export function fullPadding(p?: Partial<Padding> | null): Padding {
  return { top: p?.top ?? 0, right: p?.right ?? 0, bottom: p?.bottom ?? 0, left: p?.left ?? 0 };
}

/** Distance from the camera to the map's centre point, in pixels, for a viewport of this height. */
export function cameraDistance(viewportHeight: number): number {
  return (0.5 * viewportHeight) / Math.tan(rad(FOV_DEG / 2));
}

/**
 * Radius of the planet in pixels. MapLibre scales the globe so that features at the centre of the
 * view are the same size as on a flat map at that zoom, hence the latitude term.
 */
export function globeRadius(zoom: number, latitude: number): number {
  return (TILE_SIZE * 2 ** zoom) / (2 * Math.PI) / Math.cos(rad(latitude));
}

/**
 * Radius of the planet's silhouette on screen. Smaller than `globeRadius` because the camera is
 * close enough for perspective: it sees less than half the sphere.
 */
export function limbRadius(radius: number, distance: number): number {
  return (distance * radius) / Math.sqrt(distance * distance + 2 * distance * radius);
}

/** Inverse of `limbRadius`: the planet radius that gives this silhouette. */
export function radiusForLimb(limb: number, distance: number): number {
  return (limb * limb) / distance + Math.sqrt(limb ** 4 / (distance * distance) + limb * limb);
}

/** Zoom at which the planet's silhouette has this radius on screen. */
export function zoomForLimb(limb: number, latitude: number, viewportHeight: number): number {
  const radius = radiusForLimb(limb, cameraDistance(viewportHeight));
  return Math.log2((radius * 2 * Math.PI * Math.cos(rad(latitude))) / TILE_SIZE);
}

/** Centre of the area left free by the padding, in pixels. */
export function viewCentre(width: number, height: number, padding: Padding): { x: number; y: number } {
  return { x: (padding.left + width - padding.right) / 2, y: (padding.top + height - padding.bottom) / 2 };
}

/** Silhouette radius for "the globe fills `size` of the free area's shorter side". */
export function homeLimb(width: number, height: number, padding: Padding, size: number): number {
  const w = Math.max(80, width - padding.left - padding.right);
  const h = Math.max(80, height - padding.top - padding.bottom);
  return (Math.min(w, h) * size) / 2;
}

const mercatorY = (lat: number) => 0.5 - Math.log(Math.tan(Math.PI / 4 + rad(clamp(lat, -85, 85)) / 2)) / (2 * Math.PI);

/**
 * Zoom and centre that frame a bounding box inside the free area. `fill` is how much of the free
 * area's width or height the box may take (0.72 leaves a comfortable margin around the island).
 */
export function fitBounds(
  bbox: BBox,
  width: number,
  height: number,
  padding: Padding,
  options: { fill?: number; minZoom?: number; maxZoom?: number } = {},
): { center: LngLat; zoom: number } {
  const { fill = 0.72, minZoom = 0, maxZoom = 15 } = options;
  const [west, south, east, north] = bbox;
  const w = Math.max(80, width - padding.left - padding.right) * fill;
  const h = Math.max(80, height - padding.top - padding.bottom) * fill;
  const dx = Math.max(1e-9, (east - west) / 360);
  const dy = Math.max(1e-9, mercatorY(south) - mercatorY(north));
  const zoom = Math.log2(Math.min(w / (TILE_SIZE * dx), h / (TILE_SIZE * dy)));
  return { center: [(west + east) / 2, (south + north) / 2], zoom: clamp(zoom, minZoom, maxZoom) };
}

/* ---------------------------------------------------------------- sphere */

type Vec3 = [number, number, number];

function toVector([lng, lat]: LngLat): Vec3 {
  const phi = rad(lat);
  const lam = rad(lng);
  return [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
}

function toLngLat([x, y, z]: Vec3): LngLat {
  return [deg(Math.atan2(y, x)), deg(Math.asin(clamp(z, -1, 1)))];
}

/** Great-circle angle between two points, in degrees. */
export function angularDistance(a: LngLat, b: LngLat): number {
  const u = toVector(a);
  const v = toVector(b);
  return deg(Math.acos(clamp(u[0] * v[0] + u[1] * v[1] + u[2] * v[2], -1, 1)));
}

/** Point a fraction `t` of the way along the great circle from `a` to `b`. */
export function interpolateLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  const u = toVector(a);
  const v = toVector(b);
  const omega = Math.acos(clamp(u[0] * v[0] + u[1] * v[1] + u[2] * v[2], -1, 1));
  if (omega < 1e-6) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // Almost opposite points have no single shortest path: go the long way round along the equator.
  if (Math.PI - omega < 1e-3) return [a[0] + shortestTurn(a[0], b[0]) * t, a[1] + (b[1] - a[1]) * t];
  const s = Math.sin(omega);
  const k0 = Math.sin((1 - t) * omega) / s;
  const k1 = Math.sin(t * omega) / s;
  return toLngLat([u[0] * k0 + v[0] * k1, u[1] * k0 + v[1] * k1, u[2] * k0 + v[2] * k1]);
}

/** Signed degrees to turn from `from` to `to` the short way round. */
export function shortestTurn(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/* ---------------------------------------------------------------- flight */

const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * "Apparent zoom": zoom corrected for latitude, so equal values mean an equally large planet on
 * screen. The flight interpolates this, not raw zoom, or the globe would swell and shrink as the
 * camera crosses latitudes.
 */
const apparent = (zoom: number, lat: number) => zoom - Math.log2(Math.cos(rad(clamp(lat, -85, 85))));
const rawZoom = (a: number, lat: number) => a + Math.log2(Math.cos(rad(clamp(lat, -85, 85))));

export interface FlightOptions {
  /** Zoom of the whole-globe view: the highest the camera rises. */
  globalZoom: number;
  /** Milliseconds. Default: derived from how far the camera has to turn and zoom. */
  duration?: number;
  /** Multiplier on the derived duration (0.5 is twice as fast). Default 1. */
  speed?: number;
  /** Always rise to the whole-globe view first, even for a short hop. Default false. */
  viaGlobe?: boolean;
}

export interface Flight {
  duration: number;
  /** Camera at progress `t`, 0 to 1. */
  at(t: number): CameraState;
  /** Progress at which the camera is highest (0 when it never rises). */
  apex: number;
}

/**
 * The choreography from one view to another, in one continuous move:
 *
 *   1. Rise and turn. If the target is far, ease out to an altitude from which the whole trip is
 *      in view (at most the whole-globe view) while the planet rotates toward the target along a
 *      great circle. A camera that is already high pulls back a touch on a long trip, so the
 *      planet visibly travels. A short hop barely rises at all.
 *   2. Dive. Ease in to the target zoom. The rotation finishes early in the dive, so the island
 *      is centred and stays put while the camera comes down on it.
 *
 * Rotation is tied to altitude: the closer the camera, the slower the turn, so the ground never
 * streaks past at close range. Rise and dive meet with zero zoom speed: the camera hangs for a
 * moment at the top while the rotation is fastest.
 */
export function planFlight(from: CameraState, to: CameraState, options: FlightOptions): Flight {
  const distance = angularDistance(from.center, to.center);
  const a0 = apparent(from.zoom, from.center[1]);
  const a1 = apparent(to.zoom, to.center[1]);
  const aGlobal = apparent(options.globalZoom, to.center[1]);
  // Altitude from which the trip spans about half the view.
  const aTrip = distance > 1e-4 ? Math.log2(180 / distance) : Infinity;
  let aTop = options.viaGlobe ? Math.min(a0, a1, aGlobal) : Math.min(a0, a1, Math.max(aGlobal, aTrip));
  // Already at the top and a long way to go: breathe out a little while turning.
  if (a0 - aTop < 0.3 && a1 - aTop > 1) aTop -= 0.32 * Math.min(1, distance / 45);

  const rise = a0 - aTop;
  const dive = a1 - aTop;
  const hasRise = rise > 0.02 || distance > 0.01;
  const hasDive = dive > 0.02;
  const riseMs = hasRise ? Math.min(2600, 350 + 16 * distance + 240 * rise) : 0;
  const diveMs = hasDive ? clamp(700 + 230 * dive, 700, 2800) : 0;
  const derived = clamp(riseMs + diveMs, 900, 5600);
  const duration = options.duration ?? derived * (options.speed ?? 1);
  const tRise = riseMs + diveMs > 0 ? riseMs / (riseMs + diveMs) : 0;

  const altitude = (t: number): number => {
    if (t < tRise) return a0 - rise * easeInOutSine(t / tRise);
    if (tRise >= 1) return aTop;
    return aTop + dive * easeInOutCubic((t - tRise) / (1 - tRise));
  };

  // Rotation progress: a bell over the rise and the first part of the dive, damped by how far
  // below the top the camera is. Integrated numerically into a lookup table.
  const turnEnd = hasDive ? tRise + (1 - tRise) * 0.34 : 1;
  const STEPS = 240;
  const table = new Float64Array(STEPS + 1);
  let sum = 0;
  for (let i = 1; i <= STEPS; i++) {
    const s = (i - 0.5) / STEPS;
    if (s < turnEnd) {
      const bell = Math.sin((Math.PI * s) / turnEnd) ** 1.2;
      sum += bell * 2 ** -Math.max(0, altitude(s) - aTop - 0.5);
    }
    table[i] = sum;
  }
  const turn = (t: number): number => {
    if (sum <= 0) return t;
    const x = clamp(t, 0, 1) * STEPS;
    const i = Math.min(STEPS - 1, Math.floor(x));
    return (table[i] + (table[i + 1] - table[i]) * (x - i)) / sum;
  };

  const bearingTurn = shortestTurn(from.bearing, to.bearing);

  return {
    duration,
    apex: tRise,
    at(t: number): CameraState {
      const p = clamp(t, 0, 1);
      if (p >= 1) return { center: to.center, zoom: to.zoom, bearing: to.bearing, pitch: to.pitch };
      const center = interpolateLngLat(from.center, to.center, turn(p));
      const e = easeInOutCubic(p);
      return {
        center,
        zoom: rawZoom(altitude(p), center[1]),
        bearing: from.bearing + bearingTurn * e,
        pitch: from.pitch + (to.pitch - from.pitch) * e,
      };
    },
  };
}

/* ---------------------------------------------------------------- poster */

/**
 * Project a point on the planet to the screen the way MapLibre's globe does, for the static
 * poster. Returns x and y in units of the silhouette radius (the visible disc is the unit circle),
 * and whether the point is on the near side.
 *
 * `rho` is planet radius / camera distance to the surface: it sets how strong the perspective is.
 */
export function projectToDisc(point: LngLat, centre: LngLat, rho: number): { x: number; y: number; visible: boolean } {
  const lam = rad(point[0] - centre[0]);
  const phi = rad(point[1]);
  const phi0 = rad(centre[1]);
  // Camera frame: x east, y north, z toward the camera.
  const x = Math.cos(phi) * Math.sin(lam);
  const y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam);
  const z = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
  // The horizon is where the line of sight is tangent to the sphere.
  const zLimb = rho / (1 + rho);
  const limb = 1 / Math.sqrt(1 + 2 * rho);
  if (z >= zLimb) {
    const k = 1 / (1 + rho - rho * z) / limb;
    return { x: x * k, y: -y * k, visible: true };
  }
  // Behind the horizon: slide the point onto the silhouette, so filled shapes close along the edge.
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: -y / len, visible: false };
}

/** `rho` for a given silhouette radius and viewport height (see `projectToDisc`). */
export function perspectiveRatio(limb: number, viewportHeight: number): number {
  const distance = cameraDistance(viewportHeight);
  return radiusForLimb(limb, distance) / distance;
}
