/**
 * Option A, "Daylight Atlas": the map style.
 *
 * A bright printed-atlas look on OpenFreeMap vector tiles (OpenMapTiles schema):
 *   - pale sky-blue sea that turns a little more lagoon-green as the camera comes down
 *   - warm cream land with a whisper of shaded relief and sage vegetation
 *   - a crisp white coastline with a soft band of shallow water around it
 *   - a faint white graticule, so the open ocean still reads as a turning globe
 *   - participating islands in saturated turquoise with a luminous halo; "coming soon" in apricot
 *
 * Written from scratch rather than through `base.build`, because the coastline, shallows and
 * graticule sit between the base layers. Layer count at globe altitude is kept low on purpose:
 * most layers have a minzoom, so the spinning globe draws about a dozen.
 */
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { StyleBase, StyleInput } from "@/components/globe";

/** Every colour the map uses. The CSS side mirrors the ones it needs in atlas.css. */
export const ATLAS = {
  ocean: "#bfe0f6",
  oceanNear: "#bfe6ef",
  oceanDeep: "#a9d2ee",
  shallows: "#eefaff",
  coast: "#ffffff",
  land: "#f9edd2",
  landWarm: "#f3e6cd",
  green: "#d7e5ba",
  sand: "#fbeecb",
  ice: "#ffffff",
  river: "#b5dbef",
  border: "#bfa987",
  road: "#ffffff",
  roadCasing: "#e6d8bd",
  building: "#eadcc4",
  label: "#4b5d6b",
  labelMuted: "#7a8894",
  labelHalo: "#fdf8ee",
  waterLabel: "#5f93b8",
  graticule: "#ffffff",
  turquoise: "#0fb5ae",
  turquoiseDeep: "#078a86",
  turquoiseGlow: "#5ff0e4",
  apricot: "#ee8a5c",
  apricotGlow: "#ffdcc6",
  apricotDeep: "#c9623a",
  white: "#ffffff",
  ink: "#12293a",
} as const;

export const GRATICULE_SOURCE = "da-graticule";

/** Zoom 2 covers a phone's globe; a desktop's larger globe is sharper with one more level. */
function reliefMaxZoom(): number {
  if (typeof window === "undefined") return 2;
  return Math.min(window.innerWidth, window.innerHeight) >= 700 ? 3 : 2;
}
/** Layer that blooms around the island the camera has just landed on (driven from Landing). */
/** The sea. */
export const WATER_LAYER = "water";
export const BLOOM_LAYER = "da-bloom";
export const BLOOM_CORE_LAYER = "da-bloom-core";

/** Meridians and parallels every 20 degrees, plus the equator, as one small GeoJSON source. */
interface GraticuleLine {
  type: "Feature";
  properties: { kind: "meridian" | "parallel" | "equator" };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

function graticule(): { type: "FeatureCollection"; features: GraticuleLine[] } {
  const features: GraticuleLine[] = [];
  for (let lng = -180; lng < 180; lng += 20) {
    const coordinates: [number, number][] = [];
    for (let lat = -80; lat <= 80; lat += 4) coordinates.push([lng, lat]);
    features.push({ type: "Feature", properties: { kind: "meridian" }, geometry: { type: "LineString", coordinates } });
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    const coordinates: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 4) coordinates.push([lng, lat]);
    features.push({ type: "Feature", properties: { kind: lat === 0 ? "equator" : "parallel" }, geometry: { type: "LineString", coordinates } });
  }
  return { type: "FeatureCollection", features };
}

const isPolygon: ExpressionSpecification = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const isLine: ExpressionSpecification = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const nameEn: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];

function baseLayers(base: StyleBase): LayerSpecification[] {
  const src = base.sources.base;
  const halo = { "text-halo-color": ATLAS.labelHalo, "text-halo-width": 1.3, "text-halo-blur": 0.4 };
  return [
    { id: "background", type: "background", paint: { "background-color": ATLAS.land } },
    {
      id: "relief",
      type: "raster",
      source: base.sources.relief,
      maxzoom: 12,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.46, 4.5, 0.42, 8, 0.36, 11.8, 0],
        "raster-saturation": 0.05,
        "raster-hue-rotate": -8,
        "raster-brightness-min": 0.34,
        "raster-contrast": 0.08,
        "raster-fade-duration": 200,
      },
    },
    {
      id: "landcover-green",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      filter: ["all", isPolygon, ["match", ["get", "class"], ["wood", "grass", "wetland", "farmland"], true, false]],
      paint: {
        "fill-color": ATLAS.green,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 7, 0.62, 12, 0.5],
        "fill-antialias": false,
      },
    },
    {
      id: "landcover-sand",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      minzoom: 8,
      filter: ["all", isPolygon, ["==", ["get", "class"], "sand"]],
      paint: { "fill-color": ATLAS.sand, "fill-antialias": false },
    },
    {
      id: "landcover-ice",
      type: "fill",
      source: src,
      "source-layer": "landcover",
      maxzoom: 7,
      filter: ["all", isPolygon, ["==", ["get", "class"], "ice"]],
      paint: { "fill-color": ATLAS.ice, "fill-opacity": 0.92, "fill-antialias": false },
    },
    {
      id: "park",
      type: "fill",
      source: src,
      "source-layer": "park",
      minzoom: 8,
      filter: isPolygon,
      paint: { "fill-color": ATLAS.green, "fill-opacity": 0.4, "fill-antialias": false },
    },
    {
      id: WATER_LAYER,
      type: "fill",
      source: src,
      "source-layer": "water",
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      paint: {
        // The sea warms from sky blue to lagoon as the camera comes down to an island.
        "fill-color": ["interpolate", ["linear"], ["zoom"], 0, ATLAS.ocean, 6, ATLAS.ocean, 11, ATLAS.oceanNear],
        "fill-antialias": true,
        "fill-outline-color": ATLAS.coast,
      },
    },
    // A soft pale band where the sea meets the land: shallow water on a printed chart.
    {
      id: "water-shallows",
      type: "line",
      source: src,
      "source-layer": "water",
      minzoom: 2.2,
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-join": "round" },
      paint: {
        "line-color": ATLAS.shallows,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 2.2, 0, 3.2, 0.55, 9, 0.7, 13, 0.6],
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 2, 6, 5, 10, 12, 14, 22],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 2, 2, 6, 4, 10, 9, 14, 16],
      },
    },
    {
      id: "water-coast",
      type: "line",
      source: src,
      "source-layer": "water",
      minzoom: 2.2,
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-join": "round" },
      paint: {
        "line-color": ATLAS.coast,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 2.2, 0, 3, 0.95],
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.5, 6, 0.9, 10, 1.3, 14, 1.8],
      },
    },
    {
      id: "waterway",
      type: "line",
      source: src,
      "source-layer": "waterway",
      minzoom: 8,
      filter: isLine,
      paint: { "line-color": ATLAS.river, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 14, 1.8] },
    },
    // Graticule: white on the sea, all but invisible on the cream land, gone once zoomed in.
    {
      id: "graticule",
      type: "line",
      source: GRATICULE_SOURCE,
      maxzoom: 5.5,
      paint: {
        "line-color": ATLAS.graticule,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 3.4, 0.42, 5.4, 0],
        "line-width": ["match", ["get", "kind"], "equator", 1.1, 0.7],
      },
    },
    {
      id: "boundary-country",
      type: "line",
      source: src,
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ATLAS.border,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.38, 6, 0.55],
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 6, 0.9, 12, 1.3],
        "line-dasharray": [2.5, 2],
      },
    },
    {
      id: "road-minor-casing",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 12.5,
      filter: ["all", isLine, ["match", ["get", "class"], ["minor", "service", "tertiary", "secondary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ATLAS.roadCasing, "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 1.2, 16, 7] },
    },
    {
      id: "road-major-casing",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 7.8,
      filter: ["all", isLine, ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ATLAS.roadCasing,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.8, 0, 8.8, 1],
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 1.4, 12, 3.2, 16, 10.5],
      },
    },
    {
      id: "road-minor",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 12.5,
      filter: ["all", isLine, ["match", ["get", "class"], ["minor", "service", "tertiary", "secondary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ATLAS.road, "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.5, 16, 5] },
    },
    {
      id: "road-major",
      type: "line",
      source: src,
      "source-layer": "transportation",
      minzoom: 7.8,
      filter: ["all", isLine, ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ATLAS.road,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.8, 0, 8.8, 1],
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 0.5, 12, 1.8, 16, 8],
      },
    },
    {
      id: "building",
      type: "fill",
      source: src,
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": ATLAS.building, "fill-opacity": 0.8, "fill-antialias": false },
    },
    /* Place names. Few at globe altitude: labels are the costliest thing on a turning globe. */
    {
      id: "label-water",
      type: "symbol",
      source: src,
      "source-layer": "water_name",
      filter: ["match", ["get", "class"], ["ocean", "sea"], true, false],
      layout: {
        "text-field": nameEn,
        "text-font": base.fonts.italic,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 11, 6, 13.5],
        "text-letter-spacing": 0.18,
        "text-max-width": 6,
        "text-line-height": 1.35,
      },
      paint: { "text-color": ATLAS.waterLabel, "text-opacity": 0.86, "text-halo-color": ATLAS.ocean, "text-halo-width": 1 },
    },
    {
      id: "label-village",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 11.5,
      filter: ["==", ["get", "class"], "village"],
      layout: {
        "text-field": nameEn,
        "text-font": base.fonts.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 12.5],
        "text-max-width": 7,
        "text-padding": 6,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 30],
      },
      paint: { "text-color": ATLAS.labelMuted, ...halo },
    },
    {
      id: "label-town",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 8.4,
      filter: ["match", ["get", "class"], ["town"], true, false],
      layout: {
        "text-field": nameEn,
        "text-font": base.fonts.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10.5, 14, 13.5],
        "text-max-width": 7,
        "text-padding": 10,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
      },
      paint: { "text-color": ATLAS.labelMuted, "text-opacity": ["interpolate", ["linear"], ["zoom"], 8.4, 0, 9, 1], ...halo },
    },
    {
      id: "label-city",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 6,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": nameEn,
        "text-font": base.fonts.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10.5, 10, 14],
        "text-max-width": 7,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
      },
      paint: { "text-color": ATLAS.label, ...halo },
    },
    {
      id: "label-country-minor",
      type: "symbol",
      source: src,
      "source-layer": "place",
      minzoom: 3.2,
      maxzoom: 8,
      filter: ["all", ["==", ["get", "class"], "country"], [">", ["coalesce", ["get", "rank"], 9], 1], ["<=", ["coalesce", ["get", "rank"], 9], 3]],
      layout: {
        "text-field": nameEn,
        "text-font": base.fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9.5, 6, 12.5],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.16,
        "text-max-width": 7,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 9],
      },
      paint: { "text-color": ATLAS.labelMuted, "text-opacity": 0.9, ...halo },
    },
    {
      id: "label-country",
      type: "symbol",
      source: src,
      "source-layer": "place",
      maxzoom: 8,
      filter: ["all", ["==", ["get", "class"], "country"], ["<=", ["coalesce", ["get", "rank"], 9], 1]],
      layout: {
        "text-field": nameEn,
        "text-font": base.fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 9.5, 5, 13],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.16,
        "text-max-width": 7,
      },
      paint: { "text-color": ATLAS.labelMuted, "text-opacity": 0.92, ...halo },
    },
  ];
}

/**
 * Island layers: fills, the halo, outlines, dots and names, plus the "bloom" pair that the
 * landing fades in when the camera lands (constant paint, so MapLibre can transition it).
 */
function islandLayers(base: StyleBase): LayerSpecification[] {
  const { selected, hovered, dimmed, live, perZoom, appear, dotFade } = base.expr;
  const { islands, islandGlow, islandPoints } = base.sources;
  const dotOpacity = (strength: number) => perZoom((z) => ["*", appear(z), dotFade(z), ["case", dimmed, 0.5, 1], strength]);
  return [
    {
      id: "island-soon-fill",
      type: "fill",
      source: islands,
      filter: ["!", live],
      paint: { "fill-color": ATLAS.apricot, "fill-opacity": ["case", selected, 0.12, hovered, 0.28, 0.18] },
    },
    {
      id: "island-soon-line",
      type: "line",
      source: islands,
      filter: ["!", live],
      layout: { "line-join": "round" },
      paint: {
        "line-color": ATLAS.apricotDeep,
        "line-opacity": ["case", selected, 0.95, 0.6],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 10, 1.4],
        "line-dasharray": [2, 1.6],
      },
    },
    {
      id: "island-live-fill",
      type: "fill",
      source: islands,
      filter: live,
      paint: {
        "fill-color": ATLAS.turquoise,
        // The open island lets its land show through; the others stay saturated.
        "fill-opacity": ["case", selected, 0.13, hovered, 0.46, dimmed, 0.22, 0.36],
      },
    },
    // The luminous halo: a wide white wash and a tighter turquoise one, on the rounded outline.
    // Every participating island wears a faint one; the selected island's is much stronger.
    {
      id: "island-halo-wash",
      type: "line",
      source: islandGlow,
      layout: { "line-join": "round" },
      paint: {
        "line-color": ATLAS.white,
        "line-opacity": ["case", selected, 0.75, hovered, 0.6, ["all", live, ["!", dimmed]], 0.42, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 6, 9, 12, 13, 16],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 5, 9, 10, 13, 13],
      },
    },
    {
      id: "island-halo",
      type: "line",
      source: islandGlow,
      layout: { "line-join": "round" },
      paint: {
        "line-color": ["case", live, ATLAS.turquoiseGlow, ATLAS.apricot],
        "line-opacity": ["case", selected, 0.7, hovered, 0.45, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 4, 9, 8, 13, 11],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 4, 9, 7, 13, 9],
      },
    },
    // The wide aura (BLOOM_LAYER) is added at run time on its own source: see aura.ts.
    // This is its bright core on the true outline. Constant paint, so MapLibre can fade it.
    {
      id: BLOOM_CORE_LAYER,
      type: "line",
      source: islandGlow,
      filter: ["==", ["get", "id"], ""],
      layout: { "line-join": "round" },
      paint: {
        "line-color": ATLAS.white,
        "line-opacity": 0,
        "line-opacity-transition": { duration: 900, delay: 0 },
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 3, 9, 7, 13, 10],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 3, 9, 6, 13, 8],
      },
    },
    {
      id: "island-live-line",
      type: "line",
      source: islands,
      filter: live,
      layout: { "line-join": "round" },
      paint: {
        "line-color": ["case", selected, ATLAS.turquoiseDeep, ATLAS.turquoise],
        "line-opacity": ["case", dimmed, 0.7, 1],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["case", selected, 1.6, 1], 10, ["case", selected, 2.6, 1.7]],
      },
    },
    {
      id: "island-dot-halo",
      type: "circle",
      source: islandPoints,
      paint: {
        "circle-color": ["case", live, ATLAS.turquoise, ATLAS.apricot],
        "circle-radius": ["case", selected, 16, hovered, 14, live, 12, 8],
        "circle-opacity": dotOpacity(0.22),
        "circle-blur": 0.35,
      },
    },
    {
      id: "island-dot",
      type: "circle",
      source: islandPoints,
      paint: {
        "circle-color": ["case", live, ATLAS.turquoise, ATLAS.white],
        "circle-radius": ["case", live, 5.2, 3.6],
        "circle-stroke-color": ["case", live, ATLAS.white, ATLAS.apricotDeep],
        "circle-stroke-width": ["case", live, 2.2, 1.6],
        "circle-opacity": dotOpacity(1),
        "circle-stroke-opacity": dotOpacity(1),
      },
    },
    {
      id: "island-label",
      type: "symbol",
      source: islandPoints,
      layout: {
        "text-field": ["get", "name"],
        "text-font": base.fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, ["case", live, 13, 11], 8, ["case", live, 15.5, 13]],
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 1,
        "text-justify": "auto",
        "text-max-width": 8,
        "text-letter-spacing": 0.01,
        "text-padding": 4,
        "symbol-sort-key": ["+", ["case", live, 0, 10], ["get", "rank"]],
      },
      paint: {
        "text-color": ["case", live, ATLAS.ink, ATLAS.label],
        "text-halo-color": ATLAS.white,
        "text-halo-width": 1.8,
        "text-halo-blur": 0.4,
        "text-opacity": perZoom((z) => ["*", appear(z), ["case", dimmed, 0.62, 1]]),
      },
    },
  ];
}

/** Id of the engine's island outline source, known once the style has been built. */
let outlineSource = "islands";
export const outlineSourceId = () => outlineSource;

/** The complete style. A stable module-level reference: a new one would restyle the map. */
export const atlasStyle: StyleInput = (base): StyleSpecification => {
  outlineSource = base.sources.islands;
  return buildStyle(base);
};

const buildStyle = (base: StyleBase): StyleSpecification => ({
  version: 8,
  name: "Island Passport: Daylight Atlas",
  projection: { type: "globe" },
  glyphs: base.urls.glyphs,
  // A thin band of daylight around the globe, gone by the time the planet fills the screen.
  sky: {
    "sky-color": "#cfe9fb",
    "horizon-color": "#ffffff",
    "fog-color": "#ffffff",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.9,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.12, 4.5, 0.1, 6.5, 0],
  },
  light: { anchor: "map", position: [1.4, 35, 62], color: "#ffffff", intensity: 0.2 },
  sources: {
    [base.sources.base]: { type: "vector", url: base.urls.tiles },
    // Relief tiles stop at the level the globe view itself uses. Deeper levels would be fetched,
    // decoded and uploaded one after another during the dive, which is the largest single cost of
    // the flight on a phone. Below the globe view the relief is only a soft tint, and the coarse
    // tiles give exactly that.
    [base.sources.relief]: { type: "raster", tiles: [base.urls.relief], tileSize: 256, maxzoom: reliefMaxZoom() },
    [GRATICULE_SOURCE]: { type: "geojson", data: graticule(), tolerance: 0.2 },
  },
  layers: [...baseLayers(base), ...islandLayers(base)],
});
