/**
 * Option B, "Illustrated Voyage": the map style.
 *
 * Written from scratch on the OpenMapTiles schema served by OpenFreeMap. It is meant to read as a
 * page from an illustrated atlas at every altitude:
 *
 *   globe     paper-coloured land tinted by Natural Earth relief (sage forest, sandy desert) with
 *             pencil hatching over it; a watercolour sea (flat wash, then a mottled pattern); an
 *             ink coastline with two ripple lines echoing it offshore; a faint graticule; and the
 *             dashed "voyage" that strings the islands together
 *   region    country borders as a dot-dash line, rivers, the first place names
 *   island    forest drawn as little trees, stippled beaches, roads as dashed trails, hills as
 *             small drawings, buildings as ink-edged blocks
 *
 * Island layers (on the three sources the engine injects) colour the participating islands in,
 * dim the rest while one is open, and carry the selection highlight: a highlighter stroke and a
 * soft bloom that index.tsx fades in when the camera lands (see BLOOM_LAYER).
 *
 * The patterns and the hill icon are drawn at run time (sprites.ts).
 */
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { StyleBase } from "@/components/globe";
import type { GlobeIsland, LngLat } from "@/lib/islands";
import { SPRITE } from "./sprites";
import { MAP } from "./tokens";

export const GRATICULE_SOURCE = "ob-graticule";
export const ROUTE_SOURCE = "ob-route";
/** Constant-opacity glow around one island, chosen by filter. Its opacity is animated on landing. */
export const BLOOM_LAYER = "ob-bloom";
export const BLOOM_OPACITY = 0.5;

const isPolygon: ExpressionSpecification = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const isLine: ExpressionSpecification = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const nameEn: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];

/* ------------------------------------------------------------------ extra sources */

type Line = { type: "Feature"; properties: Record<string, never>; geometry: { type: "LineString"; coordinates: number[][] } };
const line = (coordinates: number[][]): Line => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });

/** Meridians and parallels every 30 degrees, like the lines on a schoolroom globe. */
function graticule() {
  const features: Line[] = [];
  for (let lng = -180; lng < 180; lng += 30) {
    const points: number[][] = [];
    for (let lat = -80; lat <= 80; lat += 4) points.push([lng, lat]);
    features.push(line(points));
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const points: number[][] = [];
    for (let lng = -180; lng <= 180; lng += 4) points.push([lng, lat]);
    features.push(line(points));
  }
  return { type: "FeatureCollection" as const, features };
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Points along the great circle from a to b. Longitudes run on past 180 instead of jumping. */
function greatCircle(a: LngLat, b: LngLat, startLng: number): number[][] {
  const [l1, p1, l2, p2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  const steps = Math.max(2, Math.ceil(deg(d) / 2.5));
  const out: number[][] = [];
  let previous = startLng;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    let lng = deg(Math.atan2(y, x));
    while (lng - previous > 180) lng -= 360;
    while (lng - previous < -180) lng += 360;
    previous = lng;
    out.push([lng, deg(Math.atan2(z, Math.hypot(x, y)))]);
  }
  return out;
}

/** The order the voyage calls at the islands marked from globe altitude, west to east. */
const VOYAGE = ["gili-air", "koh-tao", "palawan", "bohol", "siargao", "moorea", "bonaire"];

function voyage(islands: readonly GlobeIsland[]) {
  const stops = VOYAGE.map((id) => islands.find((i) => i.id === id)).filter((i): i is GlobeIsland => Boolean(i));
  const coordinates: number[][] = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const from = coordinates.length ? coordinates[coordinates.length - 1][0] : stops[i].coordinates[0];
    const leg = greatCircle(stops[i].coordinates, stops[i + 1].coordinates, from);
    coordinates.push(...(coordinates.length ? leg.slice(1) : leg));
  }
  return { type: "FeatureCollection" as const, features: coordinates.length > 1 ? [line(coordinates)] : [] };
}

/* ------------------------------------------------------------------ base map */

function baseLayers(base: StyleBase): LayerSpecification[] {
  const src = base.sources.base;
  const font = base.fonts;
  const halo = { "text-halo-color": MAP.halo, "text-halo-width": 1.4, "text-halo-blur": 0.4 };

  return [
    { id: "ob-land", type: "background", paint: { "background-color": MAP.land } },
    // Natural Earth relief, washed out to watercolour: forests go sage, deserts stay sand.
    {
      id: "ob-relief",
      type: "raster",
      source: base.sources.relief,
      maxzoom: 9,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.72, 5, 0.66, 8.6, 0],
        "raster-saturation": 0.18,
        "raster-contrast": 0.08,
        "raster-brightness-min": 0.16,
        "raster-fade-duration": 200,
      },
    },
    // Pencil hatching over all the land (the sea is painted on top of it afterwards).
    {
      id: "ob-land-hatch",
      type: "background",
      paint: {
        "background-pattern": SPRITE.hatch,
        "background-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.75, 6, 0.9, 12, 0.7],
      },
    },
    {
      id: "ob-grass",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      filter: ["all", isPolygon, ["match", ["get", "class"], ["grass", "farmland", "wetland"], true, false]],
      paint: { "fill-color": MAP.sage, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.35, 10, 0.5], "fill-antialias": false },
    },
    {
      id: "ob-wood",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      filter: ["all", isPolygon, ["==", ["get", "class"], "wood"]],
      paint: { "fill-color": MAP.wood, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.45, 10, 0.62], "fill-antialias": false },
    },
    {
      id: "ob-wood-trees",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      minzoom: 8,
      filter: ["all", isPolygon, ["==", ["get", "class"], "wood"]],
      paint: { "fill-pattern": SPRITE.trees, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 9.2, 0.9] },
    },
    {
      id: "ob-park",
      type: "fill",
      source: src,
      "source-layer": "park",
      minzoom: 7,
      filter: isPolygon,
      paint: { "fill-color": MAP.sage, "fill-opacity": 0.32, "fill-antialias": false },
    },
    {
      id: "ob-sand",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      minzoom: 8,
      filter: ["all", isPolygon, ["==", ["get", "class"], "sand"]],
      paint: { "fill-color": MAP.sand, "fill-antialias": false },
    },
    {
      id: "ob-sand-stipple",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      minzoom: 10,
      filter: ["all", isPolygon, ["==", ["get", "class"], "sand"]],
      paint: { "fill-pattern": SPRITE.stipple },
    },
    {
      id: "ob-ice",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      filter: ["all", isPolygon, ["==", ["get", "class"], "ice"]],
      paint: { "fill-color": MAP.ice, "fill-opacity": 0.92, "fill-antialias": false },
    },

    // The sea: a flat wash, then the mottled watercolour pattern over it.
    {
      id: "ob-water",
      type: "fill",
      source: src,
      "source-layer": "water",
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      paint: { "fill-color": MAP.ocean },
    },
    {
      id: "ob-water-wash",
      type: "fill",
      source: src,
      "source-layer": "water",
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      paint: { "fill-pattern": SPRITE.wash, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.85, 8, 1] },
    },
    {
      id: "ob-graticule",
      type: "line",
      source: GRATICULE_SOURCE,
      maxzoom: 5,
      paint: {
        "line-color": MAP.coast,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.2, 4.5, 0],
        "line-width": 0.7,
        "line-dasharray": [1, 5],
      },
    },
    // Ripple lines that echo the coast a little way offshore, fainter as they go out.
    {
      id: "ob-coast-ripple-far",
      type: "line",
      source: src,
      "source-layer": "water",
      filter: ["all", isPolygon, ["==", ["get", "class"], "ocean"]],
      layout: { "line-join": "round" },
      paint: {
        "line-color": MAP.coast,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.12, 5, 0.2],
        "line-width": 0.7,
        "line-offset": ["interpolate", ["linear"], ["zoom"], 1, 3.6, 6, 5.6],
      },
    },
    {
      id: "ob-coast-ripple-near",
      type: "line",
      source: src,
      "source-layer": "water",
      filter: ["all", isPolygon, ["==", ["get", "class"], "ocean"]],
      layout: { "line-join": "round" },
      paint: {
        "line-color": MAP.coast,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.26, 5, 0.38],
        "line-width": 0.8,
        "line-offset": ["interpolate", ["linear"], ["zoom"], 1, 1.8, 6, 2.8],
      },
    },
    // The coastline itself, in ink, with a second uneven pass for the look of pen pressure.
    {
      id: "ob-coast",
      type: "line",
      source: src,
      "source-layer": "water",
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.coast,
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.7, 5, 0.95, 12, 1.3],
      },
    },
    {
      id: "ob-coast-press",
      type: "line",
      source: src,
      "source-layer": "water",
      minzoom: 3,
      filter: ["all", isPolygon, ["==", ["get", "class"], "ocean"]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.coast,
        "line-opacity": 0.55,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.3, 12, 2.2],
        "line-dasharray": [5, 4, 1.5, 6, 9, 5],
      },
    },
    {
      id: "ob-waterway",
      type: "line",
      source: src,
      "source-layer": "waterway",
      minzoom: 7,
      filter: isLine,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": MAP.river, "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 14, 2.2] },
    },
    // Borders: dot-dash, in the brown ink of an old atlas.
    {
      id: "ob-border",
      type: "line",
      source: src,
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.border,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.34, 6, 0.55],
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 6, 1.1, 12, 1.5],
        "line-dasharray": [4, 2.4, 0.4, 2.4],
      },
    },
    // The voyage: a dashed route that strings the islands together across the globe.
    {
      id: "ob-route",
      type: "line",
      source: ROUTE_SOURCE,
      maxzoom: 7,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": MAP.route,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.75, 4.5, 0.6, 6.5, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.3, 5, 1.8],
        "line-dasharray": [0.4, 2.6],
      },
    },

    // Roads as trails: a dashed minor path, a firmer main road.
    {
      id: "ob-road-minor",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 11.5,
      filter: ["all", isLine, ["match", ["get", "class"], ["minor", "service", "tertiary", "secondary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.roadMinor,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 0.9],
        "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 12, 0.7, 16, 3],
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "ob-road-major-case",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 8.5,
      filter: ["all", isLine, ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.halo,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 8.5, 0, 9.5, 0.9],
        "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 9, 2.2, 13, 4.4, 16, 9],
      },
    },
    {
      id: "ob-road-major",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 8.5,
      filter: ["all", isLine, ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.road,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 8.5, 0, 9.5, 0.85],
        "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 9, 0.9, 13, 1.7, 16, 4],
        "line-dasharray": [5, 1.6],
      },
    },
    {
      id: "ob-building",
      type: "fill",
      source: src,
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": MAP.building, "fill-outline-color": MAP.buildingInk, "fill-opacity": 0.85 },
    },

    // Hills and peaks as small drawings.
    {
      id: "ob-peak",
      type: "symbol",
      source: src,
      "source-layer": "mountain_peak",
      minzoom: 8,
      filter: ["<=", ["coalesce", ["get", "rank"], 9], 2],
      layout: {
        "icon-image": SPRITE.hill,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 12, 1.05],
        "icon-padding": 6,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 9],
      },
      paint: { "icon-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 8.8, 0.95] },
    },

    // Place names. Few at globe altitude: labels are the costliest thing on a spinning globe.
    {
      id: "ob-label-water",
      type: "symbol",
      source: src,
      "source-layer": "water_name",
      filter: ["match", ["get", "class"], ["ocean", "sea"], true, false],
      layout: {
        "text-field": nameEn,
        "text-font": font.italic,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 11.5, 6, 14],
        "text-letter-spacing": 0.14,
        "text-max-width": 6,
        "text-line-height": 1.25,
      },
      paint: { "text-color": MAP.waterLabel, "text-opacity": 0.85, "text-halo-color": MAP.oceanLight, "text-halo-width": 1.1, "text-halo-blur": 0.6 },
    },
    {
      id: "ob-label-town",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 9.5,
      filter: ["match", ["get", "class"], ["town", "village"], true, false],
      layout: {
        "text-field": nameEn,
        "text-font": font.italic,
        "text-size": ["interpolate", ["linear"], ["zoom"], 9.5, 10.5, 14, 13.5],
        "text-max-width": 7,
        "text-padding": 6,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
      },
      paint: { "text-color": MAP.labelSoft, ...halo },
    },
    {
      id: "ob-label-city",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 5.5,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": nameEn,
        "text-font": font.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10.5, 10, 14],
        "text-max-width": 7,
        "text-padding": 5,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
      },
      paint: { "text-color": MAP.label, ...halo },
    },
    {
      id: "ob-label-country-minor",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 3.2,
      maxzoom: 8,
      filter: ["all", ["==", ["get", "class"], "country"], [">", ["coalesce", ["get", "rank"], 9], 1], ["<=", ["coalesce", ["get", "rank"], 9], 3]],
      layout: {
        "text-field": nameEn,
        "text-font": font.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9.5, 6, 12.5],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.16,
        "text-max-width": 7,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 9],
      },
      paint: { "text-color": MAP.border, "text-opacity": 0.9, ...halo },
    },
    {
      id: "ob-label-country",
      type: "symbol",
      source: src,
      "source-layer": "place",
      maxzoom: 8,
      filter: ["all", ["==", ["get", "class"], "country"], ["<=", ["coalesce", ["get", "rank"], 9], 1]],
      layout: {
        "text-field": nameEn,
        "text-font": font.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 9.5, 5, 13],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.16,
        "text-max-width": 7,
      },
      paint: { "text-color": MAP.border, "text-opacity": 0.9, ...halo },
    },
  ];
}

/* ------------------------------------------------------------------ islands */

function islandLayers(base: StyleBase): LayerSpecification[] {
  const { selected, hovered, dimmed, live, perZoom, appear } = base.expr;
  const { islands, islandGlow, islandPoints } = base.sources;
  return [
    // "Coming soon": pencilled in, not yet coloured.
    {
      id: "ob-soon-fill",
      type: "fill",
      source: islands,
      filter: ["!", live],
      paint: { "fill-color": MAP.soonFill, "fill-opacity": ["case", selected, 0.75, hovered, 0.65, 0.4] },
    },
    {
      id: "ob-soon-line",
      type: "line",
      source: islands,
      filter: ["!", live],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.soonInk,
        "line-opacity": ["case", selected, 1, 0.75],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["case", selected, 1.4, 0.9], 10, ["case", selected, 2, 1.3]],
        "line-dasharray": [1.5, 2],
      },
    },
    // Participating islands are coloured in, sunflower yellow.
    {
      id: "ob-live-fill",
      type: "fill",
      source: islands,
      filter: live,
      paint: {
        "fill-color": MAP.liveFill,
        "fill-opacity": ["case", selected, 0.5, hovered, 0.78, dimmed, 0.26, 0.6],
      },
    },
    // The bloom: a soft warm glow around the open island. Opacity 0 until the camera lands.
    {
      id: BLOOM_LAYER,
      type: "line",
      source: islandGlow,
      filter: ["==", ["get", "id"], ""],
      layout: { "line-join": "round" },
      paint: {
        "line-color": MAP.glow,
        "line-opacity": 0,
        "line-opacity-transition": { duration: 900, delay: 0 },
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 12, 9, 26, 13, 36],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 10, 9, 22, 13, 30],
      },
    },
    // A highlighter stroke around the selected (or hovered) island.
    {
      id: "ob-highlighter",
      type: "line",
      source: islandGlow,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.highlighter,
        "line-opacity": ["case", selected, 0.82, hovered, 0.55, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 5, 9, 9, 13, 12],
        "line-blur": 1.5,
      },
    },
    {
      id: "ob-live-line",
      type: "line",
      source: islands,
      filter: live,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.liveInk,
        "line-opacity": ["case", dimmed, 0.5, 1],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["case", selected, 1.6, 1], 10, ["case", selected, 2.4, 1.5]],
      },
    },
    {
      id: "ob-live-line-press",
      type: "line",
      source: islands,
      filter: live,
      minzoom: 6,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": MAP.liveInk,
        "line-opacity": ["case", dimmed, 0.25, 0.6],
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2, 12, 3.4],
        "line-dasharray": [4, 3.5, 1.2, 5, 8, 4],
      },
    },
    // Names. The stamp badges are DOM markers (index.tsx); the label sits clear of them.
    {
      id: "ob-island-label",
      type: "symbol",
      source: islandPoints,
      layout: {
        "text-field": ["get", "name"],
        "text-font": base.fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, ["case", live, 13, 11], 8, ["case", live, 15.5, 13]],
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": ["interpolate", ["linear"], ["zoom"], 1, ["case", live, 1.75, 1.05], 9, ["case", live, 1.55, 1.05]],
        "text-justify": "auto",
        "text-max-width": 8,
        "text-letter-spacing": 0.02,
        "text-padding": 4,
        "symbol-sort-key": ["+", ["case", live, 0, 10], ["get", "rank"]],
      },
      paint: {
        "text-color": ["case", live, MAP.label, MAP.soonInk],
        "text-halo-color": MAP.halo,
        "text-halo-width": 1.8,
        "text-halo-blur": 0.3,
        "text-opacity": perZoom((z) => ["*", appear(z), ["case", dimmed, 0.55, 1]]),
      },
    },
  ];
}

/** The complete style. Call once and keep the result: a new object restyles the map. */
export function buildVoyageStyle(base: StyleBase, islands: readonly GlobeIsland[]): StyleSpecification {
  return {
    version: 8,
    name: "Island Passport: Illustrated Voyage",
    projection: { type: "globe" },
    glyphs: base.urls.glyphs,
    sky: { "atmosphere-blend": 0 },
    sources: {
      [base.sources.base]: { type: "vector", url: base.urls.tiles },
      [base.sources.relief]: { type: "raster", tiles: [base.urls.relief], tileSize: 256, maxzoom: 6 },
      [GRATICULE_SOURCE]: { type: "geojson", data: graticule() },
      [ROUTE_SOURCE]: { type: "geojson", data: voyage(islands) },
    },
    layers: [...baseLayers(base), ...islandLayers(base)],
  };
}
