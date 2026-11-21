/**
 * Option C "Modern Editorial": the map style.
 *
 * One idea carried through every zoom:
 *
 *   globe      a pale, flat sphere. No land shapes: the continents are a halftone of fine dots
 *              (land-dots.ts). The only colour is the participating islands, in ultramarine.
 *   region     between zoom 2.6 and 4.8 the dots swell and dissolve while the real map resolves
 *              underneath: white land, pale water, hairline coast, small-caps country names.
 *   island     a crisp monochrome map: thin grey roads, ferry lines, towns. The island itself is a
 *              solid ultramarine shape on the way down and thins to a tint with a sharp outline as
 *              the camera settles, so the detail inside it can be read.
 *
 * The style is written by hand on the OpenMapTiles schema (OpenFreeMap tiles); only the helper
 * expressions and source names come from the shared base. The dots sit *under* the water layer:
 * at globe altitude the sea is the same colour as the sphere, so it trims the coarse dot field to
 * the real coastline for free.
 */
import type { ExpressionSpecification, GeoJSONSourceSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { StyleBase } from "@/components/globe";
import { landDots } from "./land-dots";

/** Colours the map draws with. The CSS in option-c.css restates the same values as --oc-*. */
export const INK = {
  page: "#fbfbf9",
  sphere: "#eef0f2",
  land: "#ffffff",
  water: "#e3e9ef",
  shore: "#aab3be",
  dot: "#15161a",
  green: "#edf1e9",
  urban: "#f3f3f1",
  building: "#e6e6e3",
  road: "#b9bdc4",
  roadMinor: "#d5d8dd",
  ferry: "#8fa0b5",
  border: "#8b919b",
  label: "#111214",
  labelMuted: "#5a5f69",
  waterLabel: "#7d8ea3",
  accent: "#1f3cf0",
  accentDeep: "#1128b8",
  soon: "#111214",
} as const;

export const DOTS_SOURCE = "oc-land-dots";

/** Zooms between which the halftone hands over to the real map. */
const HALFTONE_OUT = 2.6;
const MAP_IN = 4.8;

type Expr = ExpressionSpecification;

const isPolygon: Expr = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const isLine: Expr = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const nameEn: Expr = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
const clamp01 = (e: Expr): Expr => ["max", 0, ["min", 1, e]];

/** Colour that is `from` on the globe and `to` once the map has resolved. */
const resolve = (from: string, to: string): Expr => ["interpolate", ["linear"], ["zoom"], HALFTONE_OUT, from, MAP_IN, to];
/** Opacity that fades a map-only layer in as the halftone leaves. */
const fadeIn = (strength = 1, from = HALFTONE_OUT + 0.6, to = MAP_IN + 0.4): Expr => ["interpolate", ["linear"], ["zoom"], from, 0, to, strength];

function baseLayers(base: StyleBase): LayerSpecification[] {
  const src = base.sources.base;
  const { regular, bold, italic } = base.fonts;
  const halo = { "text-halo-color": INK.land, "text-halo-width": 1.4, "text-halo-blur": 0.2 };

  return [
    { id: "background", type: "background", paint: { "background-color": resolve(INK.sphere, INK.land) } },

    /* ---- the halftone: land as dots, growing with the planet and gone by MAP_IN ---- */
    {
      id: "oc-land-dots",
      type: "circle",
      source: DOTS_SOURCE,
      maxzoom: MAP_IN + 0.4,
      paint: {
        "circle-color": INK.dot,
        // Radius doubles with every zoom level, so the pattern is fixed to the planet.
        "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, 0.36, 6, 0.36 * 64],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.78, HALFTONE_OUT, 0.74, 3.6, 0.34, MAP_IN, 0],
        "circle-pitch-alignment": "map",
        "circle-pitch-scale": "map",
      },
    },

    /* ---- land texture, only once the map has resolved ---- */
    {
      id: "landcover",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      minzoom: 5,
      filter: ["all", isPolygon, ["match", ["get", "class"], ["wood", "grass", "wetland"], true, false]],
      paint: { "fill-color": INK.green, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 7, 0.9, 13, 0.7], "fill-antialias": false },
    },
    {
      id: "landuse-urban",
      type: "fill",
      source: src,
      "source-layer": "landuse",
      minzoom: 9,
      filter: ["all", isPolygon, ["match", ["get", "class"], ["residential", "commercial", "industrial", "retail"], true, false]],
      paint: { "fill-color": INK.urban, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0, 10.5, 1], "fill-antialias": false },
    },
    {
      id: "sand",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      minzoom: 10,
      filter: ["all", isPolygon, ["==", ["get", "class"], "sand"]],
      paint: { "fill-color": "#f6f3ea", "fill-antialias": false },
    },

    /* ---- water: the sphere's own colour on the globe, pale blue-grey on the map ---- */
    {
      id: "water",
      type: "fill",
      source: src,
      "source-layer": "water",
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      paint: { "fill-color": resolve(INK.sphere, INK.water), "fill-outline-color": resolve(INK.sphere, INK.shore) },
    },
    {
      id: "waterway",
      type: "line",
      source: src,
      "source-layer": "waterway",
      minzoom: 8,
      filter: isLine,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": INK.shore, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.3, 14, 1.4] },
    },

    /* ---- lines: borders, ferries, roads ---- */
    {
      id: "boundary-country",
      type: "line",
      source: src,
      "source-layer": "boundary",
      minzoom: 3,
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": INK.border,
        "line-opacity": fadeIn(0.7),
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 8, 0.9, 12, 1.2],
      },
    },
    {
      id: "boundary-region",
      type: "line",
      source: src,
      "source-layer": "boundary",
      minzoom: 7,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": INK.border, "line-opacity": 0.45, "line-width": 0.6, "line-dasharray": [3, 3] },
    },
    {
      id: "ferry",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 8,
      filter: ["all", isLine, ["==", ["get", "class"], "ferry"]],
      paint: { "line-color": INK.ferry, "line-opacity": 0.8, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 13, 1], "line-dasharray": [1, 3] },
    },
    {
      id: "aeroway",
      type: "line",
      source: src,
      "source-layer": "aeroway",
      minzoom: 10,
      filter: ["all", isLine, ["==", ["get", "class"], "runway"]],
      paint: { "line-color": INK.road, "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 10, 1, 15, 14] },
    },
    {
      id: "road-minor",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 11.5,
      filter: ["all", isLine, ["match", ["get", "class"], ["minor", "service", "track", "path"], true, false], ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": INK.roadMinor,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 1],
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.4, 16, 3.2],
      },
    },
    {
      id: "road-mid",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 9,
      filter: ["all", isLine, ["match", ["get", "class"], ["secondary", "tertiary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": INK.road,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0, 10, 0.9],
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 9, 0.4, 13, 1.1, 16, 4.5],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 6.5,
      filter: ["all", isLine, ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#9da2ab",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 6.5, 0, 7.5, 1],
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 7, 0.45, 12, 1.4, 16, 6],
      },
    },
    {
      id: "building",
      type: "fill",
      source: src,
      "source-layer": "building",
      minzoom: 13.5,
      paint: { "fill-color": INK.building, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 14.5, 1], "fill-antialias": false },
    },

    /* ---- names: small caps for countries and seas, plain for towns ---- */
    {
      id: "label-water",
      type: "symbol",
      source: src,
      "source-layer": "water_name",
      minzoom: 3.2,
      filter: ["match", ["get", "class"], ["ocean", "sea", "bay", "strait"], true, false],
      layout: {
        "text-field": nameEn,
        "text-font": italic,
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10.5, 8, 12.5],
        "text-letter-spacing": 0.16,
        "text-max-width": 6,
      },
      paint: { "text-color": INK.waterLabel, "text-opacity": fadeIn(0.95), "text-halo-color": INK.water, "text-halo-width": 1 },
    },
    {
      id: "label-village",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 10.5,
      filter: ["match", ["get", "class"], ["village", "suburb", "hamlet"], true, false],
      layout: {
        "text-field": nameEn,
        "text-font": regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 10.5, 10, 15, 12.5],
        "text-max-width": 7,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 30],
      },
      paint: { "text-color": INK.labelMuted, ...halo },
    },
    {
      id: "label-town",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 7.5,
      filter: ["==", ["get", "class"], "town"],
      layout: {
        "text-field": nameEn,
        "text-font": regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 7.5, 10, 13, 13],
        "text-max-width": 7,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
      },
      paint: { "text-color": INK.labelMuted, ...halo },
    },
    {
      id: "label-city",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 4.4,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": nameEn,
        "text-font": bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 4.4, 10, 10, 13.5],
        "text-max-width": 7,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
      },
      paint: { "text-color": INK.label, "text-opacity": fadeIn(1, 4.4, 5.2), ...halo },
    },
    {
      id: "label-country",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 3,
      maxzoom: 8,
      filter: ["all", ["==", ["get", "class"], "country"], ["<=", ["coalesce", ["get", "rank"], 9], 4]],
      layout: {
        "text-field": nameEn,
        "text-font": bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9.5, 6, 12],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.18,
        "text-max-width": 7,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 9],
      },
      paint: { "text-color": INK.labelMuted, "text-opacity": fadeIn(0.95), ...halo },
    },
  ];
}

/**
 * The islands. Participating ones are the only colour on the map.
 * Feature states (selected, hover, dimmed) come from the engine.
 */
function islandLayers(base: StyleBase): LayerSpecification[] {
  const { selected, hovered, dimmed, live, perZoom, appear, dotFade } = base.expr;
  const { islands, islandGlow, islandPoints } = base.sources;
  const dotZoom: Expr = ["get", "dotZoom"];
  /** 1 while the island is a small shape on the way down, 0 once it fills the view. */
  const solid = (z: number): Expr => clamp01(["/", ["-", ["+", dotZoom, 2.7], z], 1.5]);
  const dotOpacity = (strength: number) => perZoom((z) => ["*", appear(z), dotFade(z), ["case", dimmed, 0.4, 1], strength]);

  return [
    {
      id: "oc-soon-fill",
      type: "fill",
      source: islands,
      filter: ["!", live],
      paint: { "fill-color": INK.soon, "fill-opacity": ["case", selected, 0.1, hovered, 0.12, 0.06] },
    },
    {
      id: "oc-soon-line",
      type: "line",
      source: islands,
      filter: ["!", live],
      layout: { "line-join": "round" },
      paint: {
        "line-color": INK.soon,
        "line-opacity": ["case", selected, 0.9, dimmed, 0.3, 0.55],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 10, 1.1],
        "line-dasharray": [2, 2.5],
      },
    },
    {
      id: "oc-live-fill",
      type: "fill",
      source: islands,
      filter: live,
      paint: {
        "fill-color": INK.accent,
        "fill-opacity": perZoom((z) => [
          "*",
          ["case", dimmed, 0.5, 1],
          ["+", ["case", hovered, 0.22, selected, 0.1, 0.13], ["*", 0.8, solid(z)]],
        ]),
      },
    },
    // The glow follows the rounded outline: on the real coast a wide blurred stroke spikes.
    {
      id: "oc-glow-outer",
      type: "line",
      source: islandGlow,
      layout: { "line-join": "round" },
      paint: {
        "line-color": INK.accent,
        "line-opacity": ["case", selected, 0.2, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 10, 9, 22, 13, 30],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 9, 9, 20, 13, 28],
      },
    },
    {
      id: "oc-glow-inner",
      type: "line",
      source: islandGlow,
      layout: { "line-join": "round" },
      paint: {
        "line-color": INK.accent,
        "line-opacity": ["case", selected, 0.32, hovered, 0.22, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 4, 9, 8, 13, 11],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 4, 9, 7, 13, 10],
      },
    },
    {
      id: "oc-live-line",
      type: "line",
      source: islands,
      filter: live,
      layout: { "line-join": "round" },
      paint: {
        "line-color": INK.accent,
        "line-opacity": ["case", dimmed, 0.6, 1],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["case", selected, 1.4, 0.8], 10, ["case", selected, 2.4, 1.4], 14, ["case", selected, 3, 1.8]],
      },
    },
    {
      id: "oc-dot-soon",
      type: "circle",
      source: islandPoints,
      filter: ["!", live],
      paint: {
        "circle-color": INK.land,
        "circle-radius": ["case", selected, 5, hovered, 5, 3.6],
        "circle-stroke-color": INK.soon,
        "circle-stroke-width": 1.5,
        "circle-opacity": dotOpacity(1),
        "circle-stroke-opacity": dotOpacity(1),
      },
    },
    {
      id: "oc-dot-live",
      type: "circle",
      source: islandPoints,
      filter: live,
      paint: {
        "circle-color": INK.accent,
        "circle-radius": ["case", selected, 7, hovered, 7, 5.5],
        "circle-stroke-color": INK.land,
        "circle-stroke-width": 2,
        "circle-opacity": dotOpacity(1),
        "circle-stroke-opacity": dotOpacity(1),
      },
    },
    {
      id: "oc-island-label",
      type: "symbol",
      source: islandPoints,
      layout: {
        "text-field": ["get", "name"],
        "text-font": base.fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, ["case", live, 11.5, 10], 8, ["case", live, 13.5, 12]],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.14,
        "text-variable-anchor": ["left", "right", "top", "bottom"],
        "text-radial-offset": 1,
        "text-justify": "auto",
        "text-max-width": 9,
        "text-padding": 3,
        "symbol-sort-key": ["+", ["case", live, 0, 10], ["get", "rank"]],
      },
      paint: {
        "text-color": ["case", live, INK.accentDeep, INK.label],
        "text-halo-color": INK.land,
        "text-halo-width": 1.8,
        "text-halo-blur": 0.2,
        // Named until the island fills the view; by then the card carries the name.
        "text-opacity": perZoom((z) => ["*", appear(z), ["case", dimmed, 0.55, 1], clamp01(["-", ["+", dotZoom, 2.6], z])]),
      },
    },
  ];
}

/** The whole style. Pass to <Globe style={optionCStyle} />: the reference is stable. */
export function optionCStyle(base: StyleBase): StyleSpecification {
  return {
    version: 8,
    name: "Island Passport: Option C, Modern Editorial",
    projection: { type: "globe" },
    glyphs: base.urls.glyphs,
    sky: { "atmosphere-blend": 0 },
    sources: {
      [base.sources.base]: { type: "vector", url: base.urls.tiles },
      [DOTS_SOURCE]: { type: "geojson", data: landDots() as unknown as GeoJSONSourceSpecification["data"], maxzoom: 4, buffer: 8, tolerance: 0 },
    },
    layers: [...baseLayers(base), ...islandLayers(base)],
  };
}
