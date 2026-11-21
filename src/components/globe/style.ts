/**
 * Map style building blocks for the globe.
 *
 * Tiles: OpenFreeMap (free, no key), OpenMapTiles schema, global coverage (TEC-11).
 * Each option supplies its own style. It can write one from scratch, or start from `buildStyle`
 * with its own colours:
 *
 *   <Globe style={(base) => base.build({ ocean: "#bfe9ee", land: "#fdfbf1", ... }, { relief: 0.5 })} />
 *
 * The engine always provides three GeoJSON sources, whatever the style:
 *   ISLANDS_SOURCE        island outlines, as mapped  (Polygon / MultiPolygon)
 *   ISLAND_GLOW_SOURCE    the same outlines simplified and rounded, for wide blurred glow strokes
 *   ISLAND_POINTS_SOURCE  one point per island, at its visual centre
 * with these properties on every feature:
 *   id, name, country, status ("live" | "coming-soon"), rank (1 | 2),
 *   minZoom  zoom from which the island is marked at all (rank 2 islands appear in their region)
 *   dotZoom  zoom at which its outline is large enough to replace the dot
 * and these feature states, set by the engine:
 *   selected, hover, dimmed (true on every other island while one is selected)
 *
 * So any layer an option adds on those sources can react to selection and hover; `islandLayers`
 * is the default set (highlight, dim, glow, dots, labels) and shows the patterns.
 */
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  LayerSpecification,
  SkySpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { OptionPalette } from "@/lib/options";

export const TILES_URL = "https://tiles.openfreemap.org/planet";
export const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const RELIEF_TILES = "https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png";

export const BASE_SOURCE = "openmaptiles";
export const RELIEF_SOURCE = "relief";
export const ISLANDS_SOURCE = "islands";
export const ISLAND_POINTS_SOURCE = "island-points";
export const ISLAND_GLOW_SOURCE = "island-glow";

/** Fonts served by OpenFreeMap. Map labels can only use these, not the app's web fonts. */
export const FONTS = {
  regular: ["Noto Sans Regular"],
  bold: ["Noto Sans Bold"],
  italic: ["Noto Sans Italic"],
};

/** Ids of the default island layers, bottom to top. */
export const ISLAND_LAYER_IDS = {
  soonFill: "island-soon-fill",
  soonLine: "island-soon-line",
  liveFill: "island-live-fill",
  glowOuter: "island-glow-outer",
  glowInner: "island-glow-inner",
  liveLine: "island-live-line",
  dotHalo: "island-dot-halo",
  dot: "island-dot",
  label: "island-label",
} as const;

export interface GlobePalette {
  /** Sea. */
  ocean: string;
  /** Land with nothing on it. */
  land: string;
  /** Forest, grass and parks. */
  green: string;
  /** Glaciers and ice shelves. */
  ice: string;
  /** Beaches and bare sand. */
  sand: string;
  /** Hairline where sea meets land. */
  shore: string;
  /** Country borders. */
  border: string;
  /** Rivers and streams (usually the sea colour or a little darker). */
  river: string;
  road: string;
  roadMinor: string;
  building: string;
  /** Place names, and the colour around the letters that keeps them readable. */
  label: string;
  labelMuted: string;
  labelHalo: string;
  /** Sea and ocean names. */
  waterLabel: string;
}

export interface IslandColors {
  /** Participating islands: fill, outline, dot. */
  live: string;
  liveFill: string;
  /** "Coming soon" islands: dimmed. */
  soon: string;
  soonFill: string;
  /** The glow around the selected island. */
  glow: string;
  /** Ring around the dots, and the halo of island labels. */
  contrast: string;
  label: string;
}

export interface BuildStyleOptions {
  /**
   * How many place names the base map shows. Labels are the most expensive thing to draw on a
   * spinning globe, so "minimal" (oceans and large countries, then cities once zoomed in) is the
   * default. "none" leaves only the island labels.
   */
  labels?: "none" | "minimal" | "full";
  /** Opacity of the Natural Earth shaded relief under the land, 0 to 1. 0 (default) leaves it out. */
  relief?: number;
  /** Saturation of the relief, -1 (grey) to 1. Default -0.35. */
  reliefSaturation?: number;
  /** Roads once zoomed in. Default true. */
  roads?: boolean;
  /** Buildings from zoom 14. Default true. */
  buildings?: boolean;
  /** Island layers: colours for the default set, or false to add none (the option adds its own). */
  islands?: IslandColors | false;
  /** MapLibre's atmosphere glow around the globe, 0 to 1. Default 0: the engine draws a CSS halo. */
  atmosphere?: number;
  /** Extra layers, added last. */
  extraLayers?: LayerSpecification[];
}

/** A map palette derived from an option's starter palette. */
export function paletteFromOption(p: OptionPalette): GlobePalette {
  return {
    ocean: p.ocean,
    land: p.land,
    green: p.green,
    ice: "#ffffff",
    sand: p.land,
    shore: p.shore,
    border: p.inkMuted,
    river: p.oceanDeep,
    road: "#ffffff",
    roadMinor: "#ffffff",
    building: p.line,
    label: p.ink,
    labelMuted: p.inkMuted,
    labelHalo: p.land,
    waterLabel: p.inkMuted,
  };
}

export function islandColorsFromOption(p: OptionPalette): IslandColors {
  return {
    live: p.accent,
    liveFill: p.accent,
    soon: p.inkMuted,
    soonFill: p.inkMuted,
    glow: p.accent,
    contrast: "#ffffff",
    label: p.ink,
  };
}

const isPolygon: ExpressionSpecification = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const isLine: ExpressionSpecification = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const nameEn: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];

const selected: ExpressionSpecification = ["boolean", ["feature-state", "selected"], false];
const hovered: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
const dimmed: ExpressionSpecification = ["boolean", ["feature-state", "dimmed"], false];
const live: ExpressionSpecification = ["==", ["get", "status"], "live"];

/**
 * An opacity that depends on both zoom and a per-island zoom property. MapLibre only allows
 * ["zoom"] as the input of a top-level interpolate, so this samples the ramp at every half zoom.
 * `output(z)` returns the expression for zoom z.
 */
function perZoom(output: (zoom: number) => ExpressionSpecification): ExpressionSpecification {
  const stops: (number | ExpressionSpecification)[] = [];
  for (let z = 0; z <= 16; z += 0.5) stops.push(z, output(z));
  return ["interpolate", ["linear"], ["zoom"], ...stops] as ExpressionSpecification;
}

const clamp01 = (e: ExpressionSpecification): ExpressionSpecification => ["max", 0, ["min", 1, e]];
/** 0 below the island's minZoom, 1 from half a zoom above it. */
const appear = (z: number): ExpressionSpecification => clamp01(["*", 2, ["-", z, ["get", "minZoom"]]]);
/** 1 until the island's outline takes over from the dot, then 0. */
const dotFade = (z: number): ExpressionSpecification => clamp01(["-", ["+", ["get", "dotZoom"], 1], z]);

/**
 * The default island layers: participating islands highlighted, "coming soon" islands dimmed, a
 * glowing outline on the selected island (UX-1), a dot per island while it is too small to see,
 * and its name. Copy and change freely; the engine only cares about the two source names.
 */
export function islandLayers(c: IslandColors): LayerSpecification[] {
  const ids = ISLAND_LAYER_IDS;
  // The zoom ramp has to be the outermost expression, so every factor goes inside it.
  const dotOpacity = (strength: number) => perZoom((z) => ["*", appear(z), dotFade(z), ["case", dimmed, 0.45, 1], strength]);
  return [
    {
      id: ids.soonFill,
      type: "fill",
      source: ISLANDS_SOURCE,
      filter: ["!", live],
      paint: { "fill-color": c.soonFill, "fill-opacity": ["case", selected, 0.34, hovered, 0.3, 0.18] },
    },
    {
      id: ids.soonLine,
      type: "line",
      source: ISLANDS_SOURCE,
      filter: ["!", live],
      layout: { "line-join": "round" },
      paint: {
        "line-color": c.soon,
        "line-opacity": ["case", selected, 0.9, 0.5],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 10, 1.2],
        "line-dasharray": [2, 2],
      },
    },
    {
      id: ids.liveFill,
      type: "fill",
      source: ISLANDS_SOURCE,
      filter: live,
      paint: {
        "fill-color": c.liveFill,
        "fill-opacity": ["case", selected, 0.3, hovered, 0.42, dimmed, 0.14, 0.26],
      },
    },
    // Two blurred strokes make the glow: a wide soft one and a tighter bright one. They follow the
    // rounded outline (ISLAND_GLOW_SOURCE): along the real coastline a wide blurred stroke piles up
    // into dark spikes at every sharp corner.
    {
      id: ids.glowOuter,
      type: "line",
      source: ISLAND_GLOW_SOURCE,
      layout: { "line-join": "round" },
      paint: {
        "line-color": c.glow,
        "line-opacity": ["case", selected, 0.34, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 9, 9, 20, 13, 30],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 8, 9, 18, 13, 26],
      },
    },
    {
      id: ids.glowInner,
      type: "line",
      source: ISLAND_GLOW_SOURCE,
      layout: { "line-join": "round" },
      paint: {
        "line-color": c.glow,
        "line-opacity": ["case", selected, 0.5, hovered, 0.3, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 4, 9, 9, 13, 13],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 4, 9, 9, 13, 13],
      },
    },
    {
      id: ids.liveLine,
      type: "line",
      source: ISLANDS_SOURCE,
      filter: live,
      layout: { "line-join": "round" },
      paint: {
        "line-color": c.live,
        "line-opacity": ["case", dimmed, 0.55, 1],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, ["case", selected, 1.6, 0.9], 10, ["case", selected, 2.6, 1.6]],
      },
    },
    {
      id: ids.dotHalo,
      type: "circle",
      source: ISLAND_POINTS_SOURCE,
      paint: {
        "circle-color": ["case", live, c.live, c.soon],
        "circle-radius": ["case", selected, 15, hovered, 13, live, 11, 8],
        "circle-opacity": dotOpacity(0.2),
        "circle-pitch-alignment": "map",
      },
    },
    {
      id: ids.dot,
      type: "circle",
      source: ISLAND_POINTS_SOURCE,
      paint: {
        "circle-color": ["case", live, c.live, c.contrast],
        "circle-radius": ["case", live, 5, 3.5],
        "circle-stroke-color": ["case", live, c.contrast, c.soon],
        "circle-stroke-width": ["case", live, 2, 1.5],
        "circle-opacity": dotOpacity(1),
        "circle-stroke-opacity": dotOpacity(1),
      },
    },
    {
      id: ids.label,
      type: "symbol",
      source: ISLAND_POINTS_SOURCE,
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONTS.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, ["case", live, 12.5, 11], 8, ["case", live, 15, 13]],
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.95,
        "text-justify": "auto",
        "text-max-width": 8,
        "text-letter-spacing": 0.01,
        "text-padding": 4,
        // Lower keys are placed first: live islands win a collision with "coming soon" ones.
        "symbol-sort-key": ["+", ["case", live, 0, 10], ["get", "rank"]],
      },
      paint: {
        "text-color": ["case", live, c.label, c.soon],
        "text-halo-color": c.contrast,
        "text-halo-width": 1.6,
        "text-halo-blur": 0.4,
        "text-opacity": perZoom((z) => ["*", appear(z), ["case", dimmed, 0.6, 1]]),
      },
    },
  ];
}

function baseLayers(p: GlobePalette, o: Required<Pick<BuildStyleOptions, "labels" | "relief" | "reliefSaturation" | "roads" | "buildings">>): LayerSpecification[] {
  const layers: LayerSpecification[] = [{ id: "background", type: "background", paint: { "background-color": p.land } }];

  if (o.relief > 0) {
    layers.push({
      id: "relief",
      type: "raster",
      source: RELIEF_SOURCE,
      maxzoom: 9,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 0, o.relief, 5, o.relief, 8.5, 0],
        "raster-saturation": o.reliefSaturation,
        "raster-fade-duration": 200,
      },
    });
  }

  layers.push(
    {
      id: "landcover-green",
      type: "fill",
      source: BASE_SOURCE,
      "source-layer": "landcover",
      filter: ["all", isPolygon, ["match", ["get", "class"], ["wood", "grass", "wetland", "farmland"], true, false]],
      paint: {
        "fill-color": p.green,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.75, 9, 0.6, 13, 0.4],
        "fill-antialias": false,
      },
    },
    {
      id: "landcover-sand",
      type: "fill",
      source: BASE_SOURCE,
      "source-layer": "landcover",
      minzoom: 8,
      filter: ["all", isPolygon, ["==", ["get", "class"], "sand"]],
      paint: { "fill-color": p.sand, "fill-antialias": false },
    },
    {
      id: "landcover-ice",
      type: "fill",
      source: BASE_SOURCE,
      "source-layer": "landcover",
      filter: ["all", isPolygon, ["==", ["get", "class"], "ice"]],
      paint: { "fill-color": p.ice, "fill-opacity": 0.9, "fill-antialias": false },
    },
    {
      id: "park",
      type: "fill",
      source: BASE_SOURCE,
      "source-layer": "park",
      minzoom: 7,
      filter: isPolygon,
      paint: { "fill-color": p.green, "fill-opacity": 0.35, "fill-antialias": false },
    },
    {
      id: "water",
      type: "fill",
      source: BASE_SOURCE,
      "source-layer": "water",
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      paint: { "fill-color": p.ocean, "fill-outline-color": p.shore },
    },
    {
      id: "waterway",
      type: "line",
      source: BASE_SOURCE,
      "source-layer": "waterway",
      minzoom: 8,
      filter: isLine,
      paint: { "line-color": p.river, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 14, 1.6] },
    },
    {
      id: "boundary-country",
      type: "line",
      source: BASE_SOURCE,
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": p.border,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.22, 6, 0.4],
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.4, 6, 0.9, 12, 1.4],
      },
    },
  );

  if (o.roads) {
    layers.push(
      {
        id: "road-minor",
        type: "line",
        source: BASE_SOURCE,
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["all", isLine, ["match", ["get", "class"], ["minor", "service", "tertiary", "secondary"], true, false]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": p.roadMinor,
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.5, 16, 5],
        },
      },
      {
        id: "road-major",
        type: "line",
        source: BASE_SOURCE,
        "source-layer": "transportation",
        minzoom: 8,
        filter: ["all", isLine, ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": p.road,
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 0.5, 12, 1.8, 16, 8],
        },
      },
    );
  }

  if (o.buildings) {
    layers.push({
      id: "building",
      type: "fill",
      source: BASE_SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": p.building, "fill-opacity": 0.7, "fill-antialias": false },
    });
  }

  if (o.labels !== "none") {
    const halo = { "text-halo-color": p.labelHalo, "text-halo-width": 1.2, "text-halo-blur": 0.5 };
    const full = o.labels === "full";
    layers.push(
      {
        id: "label-water",
        type: "symbol",
        source: BASE_SOURCE,
        "source-layer": "water_name",
        filter: ["match", ["get", "class"], full ? ["ocean", "sea", "bay", "strait"] : ["ocean", "sea"], true, false],
        layout: {
          "text-field": nameEn,
          "text-font": FONTS.italic,
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 11, 6, 13],
          "text-letter-spacing": 0.12,
          "text-max-width": 6,
        },
        paint: { "text-color": p.waterLabel, "text-opacity": 0.8, "text-halo-color": p.ocean, "text-halo-width": 1 },
      },
      {
        id: "label-city",
        type: "symbol",
        source: BASE_SOURCE,
        "source-layer": "place",
        minzoom: full ? 4 : 6,
        filter: ["==", ["get", "class"], "city"],
        layout: {
          "text-field": nameEn,
          "text-font": FONTS.regular,
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10.5, 10, 14],
          "text-max-width": 7,
          "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
        },
        paint: { "text-color": p.label, ...halo },
      },
      {
        id: "label-town",
        type: "symbol",
        source: BASE_SOURCE,
        "source-layer": "place",
        minzoom: full ? 8 : 10,
        filter: ["match", ["get", "class"], full ? ["town", "village"] : ["town"], true, false],
        layout: {
          "text-field": nameEn,
          "text-font": FONTS.regular,
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10.5, 14, 13.5],
          "text-max-width": 7,
          "symbol-sort-key": ["coalesce", ["get", "rank"], 20],
        },
        paint: { "text-color": p.labelMuted, ...halo },
      },
      // Large countries from the start; smaller ones join as the camera comes closer.
      {
        id: "label-country-minor",
        type: "symbol",
        source: BASE_SOURCE,
        "source-layer": "place",
        minzoom: full ? 2 : 3.2,
        maxzoom: 8,
        filter: ["all", ["==", ["get", "class"], "country"], [">", ["coalesce", ["get", "rank"], 9], 1], ["<=", ["coalesce", ["get", "rank"], 9], full ? 9 : 3]],
        layout: {
          "text-field": nameEn,
          "text-font": FONTS.bold,
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9.5, 6, 13],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
          "text-max-width": 7,
          "symbol-sort-key": ["coalesce", ["get", "rank"], 9],
        },
        paint: { "text-color": p.labelMuted, "text-opacity": 0.85, ...halo },
      },
      {
        id: "label-country",
        type: "symbol",
        source: BASE_SOURCE,
        "source-layer": "place",
        maxzoom: 8,
        filter: ["all", ["==", ["get", "class"], "country"], ["<=", ["coalesce", ["get", "rank"], 9], 1]],
        layout: {
          "text-field": nameEn,
          "text-font": FONTS.bold,
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 5, 14],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
          "text-max-width": 7,
        },
        paint: { "text-color": p.labelMuted, "text-opacity": 0.9, ...halo },
      },
    );
  }

  return layers;
}

/**
 * A complete light style from a palette. Lean on purpose: few layers at globe altitude so the
 * spin holds its frame rate on a mid-range phone, more detail only once zoomed in.
 */
export function buildStyle(palette: GlobePalette, options: BuildStyleOptions = {}): StyleSpecification {
  const o = {
    labels: options.labels ?? "minimal",
    relief: options.relief ?? 0,
    reliefSaturation: options.reliefSaturation ?? -0.35,
    roads: options.roads ?? true,
    buildings: options.buildings ?? true,
  };
  const sky: SkySpecification = { "atmosphere-blend": options.atmosphere ?? 0 };
  const style: StyleSpecification = {
    version: 8,
    name: "Island Passport globe",
    projection: { type: "globe" },
    glyphs: GLYPHS_URL,
    sky,
    sources: {
      [BASE_SOURCE]: { type: "vector", url: TILES_URL },
    },
    layers: baseLayers(palette, o),
  };
  if (o.relief > 0) {
    style.sources[RELIEF_SOURCE] = { type: "raster", tiles: [RELIEF_TILES], tileSize: 256, maxzoom: 6 };
  }
  if (options.islands) style.layers.push(...islandLayers(options.islands));
  if (options.extraLayers) style.layers.push(...options.extraLayers);
  return style;
}

/** What a style function receives: `<Globe style={(base) => base.build(palette, options)} />`. */
export interface StyleBase {
  /** A complete style from a palette. Pass `islands` colours to include the default island layers. */
  build(palette: GlobePalette, options?: BuildStyleOptions): StyleSpecification;
  /** The default island layers on their own, to append to a hand-written style. */
  islandLayers(colors: IslandColors): LayerSpecification[];
  /** Map colours derived from an option's starter palette. */
  paletteFromOption(palette: OptionPalette): GlobePalette;
  islandColorsFromOption(palette: OptionPalette): IslandColors;
  /** Expressions for use in an option's own layers. */
  expr: {
    selected: ExpressionSpecification;
    hovered: ExpressionSpecification;
    dimmed: ExpressionSpecification;
    live: ExpressionSpecification;
    /** Opacity ramp that follows each island's own zoom thresholds. */
    perZoom(output: (zoom: number) => ExpressionSpecification): ExpressionSpecification;
    appear(zoom: number): ExpressionSpecification;
    dotFade(zoom: number): ExpressionSpecification;
  };
  sources: { base: string; relief: string; islands: string; islandGlow: string; islandPoints: string };
  fonts: typeof FONTS;
  urls: { tiles: string; glyphs: string; relief: string };
}

export const STYLE_BASE: StyleBase = {
  build: buildStyle,
  islandLayers,
  paletteFromOption,
  islandColorsFromOption,
  expr: { selected, hovered, dimmed, live, perZoom, appear, dotFade },
  sources: { base: BASE_SOURCE, relief: RELIEF_SOURCE, islands: ISLANDS_SOURCE, islandGlow: ISLAND_GLOW_SOURCE, islandPoints: ISLAND_POINTS_SOURCE },
  fonts: FONTS,
  urls: { tiles: TILES_URL, glyphs: GLYPHS_URL, relief: RELIEF_TILES },
};

export type StyleInput = StyleSpecification | ((base: StyleBase) => StyleSpecification);

export function resolveStyle(input: StyleInput): StyleSpecification {
  return typeof input === "function" ? input(STYLE_BASE) : input;
}

/** Narrowing helper so options can type their own data-driven values without importing MapLibre. */
export type DataDriven<T> = DataDrivenPropertyValueSpecification<T>;
