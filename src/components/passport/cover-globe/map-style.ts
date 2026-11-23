/**
 * The map inside the cover's window, one look per art direction. Each is tinted to belong to its
 * cover: an enamelled lapis-and-gold globe on the navy leather, a bright lagoon behind the reef
 * porthole, an ink-and-wash chart on the journal's paper.
 *
 * The sea has no outline: the tiles cut water polygons at their own edges, and an outline shows
 * those cuts as stray hairlines across the sea. Land and sea are told apart by colour alone.
 *
 * No place names: at this size they would be specks, and labels are the costliest thing on a
 * moving globe. The island's name is printed on the cover under the window instead.
 */
import type { LayerSpecification } from "maplibre-gl";
import { ISLAND_LAYER_IDS, type GlobePalette, type IslandColors, type StyleBase, type StyleInput } from "@/components/globe";
import type { DirectionId } from "@/lib/types";

export interface CoverMapLook {
  palette: GlobePalette;
  islands: IslandColors;
  relief: number;
  reliefSaturation: number;
  /** Colours of the static poster (shown before the map loads and without WebGL) and the window. */
  css: {
    ocean: string;
    land: string;
    shore: string;
    dot: string;
    /** What shows around the planet inside the window. */
    space: string;
    /** Rim shading and highlight that make the disc a ball. */
    shade: string;
    shine: string;
    halo: string;
  };
}

const flat = (ocean: string, land: string): Pick<GlobePalette, "road" | "roadMinor" | "building" | "label" | "labelMuted" | "labelHalo" | "waterLabel"> => ({
  road: land,
  roadMinor: land,
  building: land,
  label: land,
  labelMuted: land,
  labelHalo: ocean,
  waterLabel: ocean,
});

export const COVER_MAP_LOOKS: Record<DirectionId, CoverMapLook> = {
  /* Lapis sea, gilded land: reads as enamel set into the leather. */
  classic: {
    palette: {
      ocean: "#27508f",
      land: "#e2c47c",
      green: "#d3b467",
      ice: "#f6ecd2",
      sand: "#ecd394",
      shore: "#27508f",
      border: "#a98a45",
      river: "#27508f",
      ...flat("#27508f", "#e2c47c"),
    },
    islands: {
      live: "#fff3c9",
      liveFill: "#fff0bd",
      soon: "#8ea2c7",
      soonFill: "#8ea2c7",
      glow: "#ffe9a6",
      contrast: "#16244a",
      label: "#fff3c9",
    },
    relief: 0.34,
    reliefSaturation: -0.7,
    css: {
      ocean: "#27508f",
      land: "#e2c47c",
      shore: "#e9cf8f",
      dot: "#fff3c9",
      space: "radial-gradient(circle at 50% 46%, #142552 0%, #0a1330 62%, #060b1d 100%)",
      shade: "rgba(4, 9, 26, 0.5)",
      shine: "rgba(255, 244, 214, 0.26)",
      halo: "rgba(120, 160, 235, 0.22)",
    },
  },

  /* Shallow-water aqua and sand: the bright one. */
  reef: {
    palette: {
      ocean: "#8fdcd3",
      land: "#fff3d6",
      green: "#cfe9b4",
      ice: "#ffffff",
      sand: "#ffe9bd",
      shore: "#8fdcd3",
      border: "#d9c69c",
      river: "#8fdcd3",
      ...flat("#8fdcd3", "#fff3d6"),
    },
    islands: {
      live: "#f2553a",
      liveFill: "#ff7a5f",
      soon: "#5d9c98",
      soonFill: "#5d9c98",
      glow: "#ff6a4d",
      contrast: "#ffffff",
      label: "#c63f28",
    },
    relief: 0.42,
    reliefSaturation: -0.15,
    css: {
      ocean: "#8fdcd3",
      land: "#fff3d6",
      shore: "#ffffff",
      dot: "#f2553a",
      space: "radial-gradient(circle at 50% 44%, #0d5a58 0%, #07403f 60%, #042d2e 100%)",
      shade: "rgba(4, 52, 54, 0.3)",
      shine: "rgba(255, 255, 255, 0.5)",
      halo: "rgba(170, 240, 232, 0.35)",
    },
  },

  /* Ink and a pale wash on the notebook's own paper. */
  journal: {
    palette: {
      ocean: "#bdd1d3",
      land: "#e9d9ae",
      green: "#e2d6a8",
      ice: "#fbf8ef",
      sand: "#f1e2bf",
      shore: "#bdd1d3",
      border: "#8d7f68",
      river: "#c3d2d2",
      ...flat("#bdd1d3", "#e9d9ae"),
    },
    islands: {
      live: "#a3421d",
      liveFill: "#c9623a",
      soon: "#8d8676",
      soonFill: "#8d8676",
      glow: "#b8502a",
      contrast: "#f7f3e8",
      label: "#2a2620",
    },
    relief: 0.16,
    reliefSaturation: -1,
    css: {
      ocean: "#bdd1d3",
      land: "#e9d9ae",
      shore: "#8c8474",
      dot: "#a3421d",
      space: "#ece2c9",
      shade: "rgba(60, 46, 28, 0.3)",
      shine: "rgba(255, 255, 255, 0.12)",
      halo: "rgba(255, 255, 255, 0)",
    },
  },
};

const cache = new Map<DirectionId, StyleInput>();

/** Base-map layers that only add noise in a window this small (border and stream hairlines). */
const DROPPED = new Set(["boundary-country", "waterway"]);

/**
 * The engine's default island layers, retuned for a window about 150px across: smaller dots, a
 * tighter glow, and no name (the cover prints it under the window).
 */
function islandLayersFor(base: StyleBase, look: CoverMapLook): LayerSpecification[] {
  const ids = ISLAND_LAYER_IDS;
  const layers: LayerSpecification[] = [];
  for (const layer of base.islandLayers(look.islands)) {
    if (layer.id === ids.label) continue;
    if (layer.type === "circle" && layer.id === ids.dot) {
      layers.push({ ...layer, paint: { ...layer.paint, "circle-radius": 3.2, "circle-stroke-width": 1.3 } });
    } else if (layer.type === "circle" && layer.id === ids.dotHalo) {
      layers.push({ ...layer, paint: { ...layer.paint, "circle-radius": ["case", base.expr.selected, 10, 7.5] } });
    } else if (layer.type === "line" && layer.id === ids.glowOuter) {
      layers.push({
        ...layer,
        paint: {
          ...layer.paint,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 6, 9, 11, 13, 15],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 5, 9, 10, 13, 13],
        },
      });
    } else if (layer.type === "line" && layer.id === ids.glowInner) {
      layers.push({
        ...layer,
        paint: {
          ...layer.paint,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 9, 5.5, 13, 7],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 5, 3, 9, 5, 13, 6],
        },
      });
    } else layers.push(layer);
  }
  return layers;
}

/** A stable style function per direction (a new reference would restyle the map). */
export function coverMapStyle(direction: DirectionId): StyleInput {
  let style = cache.get(direction);
  if (!style) {
    const look = COVER_MAP_LOOKS[direction];
    style = (base) => {
      const built = base.build(look.palette, {
        labels: "none",
        relief: look.relief,
        reliefSaturation: look.reliefSaturation,
        roads: false,
        buildings: false,
        islands: false,
      });
      return { ...built, layers: [...built.layers.filter((layer) => !DROPPED.has(layer.id)), ...islandLayersFor(base, look)] };
    };
    cache.set(direction, style);
  }
  return style;
}
