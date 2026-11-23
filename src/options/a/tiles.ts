/**
 * Keeping the dive sharp.
 *
 * MapLibre asks for a tile only once the camera is over it, so a fast dive runs ahead of its
 * tiles: for a moment the island is drawn from a coarse parent tile (blocky, low-detail land)
 * before the detailed ones arrive. Three things reduce that, for every layout:
 *
 *   1. prefetch.ts warms the HTTP cache with the destination's tiles before the flight starts.
 *   2. `keepTilesWhileZooming`: by default MapLibre cancels the tiles of the zoom level it has
 *      just left. On a dive that throws away the nearly-finished in-between levels and leaves
 *      only the coarsest ones to stretch. Keeping them lets the land sharpen step by step.
 *   3. `whenSharp`: if the camera still arrives before the tiles of the final view, the landing
 *      waits (never long) for them before the island glows and the card rises, and a thin veil
 *      of haze (.da-veil in atlas.css) covers the island meanwhile. When the tiles are already
 *      in, which is the usual case, nothing is held and no veil shows.
 *
 * And on the way home, for a layout whose landing shows the whole planet from far off:
 *
 *   4. `installBackdrop` / `setBackdrop`: pulling out fast, the camera uncovers parts of the
 *      planet whose tiles are not loaded yet, and until they are those parts are drawn as bare
 *      land with no sea (hard-edged pale squares on the globe, at the very moment the world
 *      shrinks back into a ball). The backdrop is a second, tiny source: the same tiles, but only
 *      the whole-world ones (zoom 0 and 1, five tiles in all, which the landing has fetched
 *      already), kept loaded for wherever the camera is. During a flight home its sea is drawn
 *      under the map's own, so an area that is still loading shows coarse sea and land instead.
 *      It is off again as soon as the map is sharp. A landing under zoom 2 draws from those same
 *      tiles, so nothing changes when it goes.
 */
import type { DataDrivenPropertyValueSpecification, FilterSpecification, Map as MapLibreMap } from "maplibre-gl";

export function keepTilesWhileZooming(map: MapLibreMap): void {
  try {
    map.cancelPendingTileRequestsWhileZooming = false;
  } catch {
    /* An older MapLibre without the switch: nothing to do. */
  }
}

/**
 * Resolves when every tile of the current view has loaded, or after `maxMs`, whichever is first.
 * Returns a function that cancels the wait (the promise then never resolves).
 */
export function whenSharp(map: MapLibreMap, maxMs: number, done: () => void): () => void {
  let finished = false;
  let timer = 0;
  const loaded = () => {
    try {
      return map.areTilesLoaded();
    } catch {
      return true;
    }
  };
  const stop = () => {
    finished = true;
    window.clearTimeout(timer);
    map.off("idle", check);
    map.off("sourcedata", check);
  };
  function check() {
    if (finished || !loaded()) return;
    stop();
    done();
  }
  if (loaded()) {
    finished = true;
    done();
    return () => {};
  }
  map.on("idle", check);
  map.on("sourcedata", check);
  timer = window.setTimeout(() => {
    if (finished) return;
    stop();
    done();
  }, maxMs);
  return stop;
}

const BACKDROP_SOURCE = "da-backdrop";
const BACKDROP_LAYER = "da-backdrop-water";
/** The whole-world backdrop keeps its plain ids; a finer one (see `installBackdrop`) carries its level. */
const backdropIds = (level: number) => (level <= 1 ? { source: BACKDROP_SOURCE, layer: BACKDROP_LAYER } : { source: `${BACKDROP_SOURCE}-${level}`, layer: `${BACKDROP_LAYER}-${level}` });
/** Levels a backdrop has been added for, per map. */
const installed = new WeakMap<MapLibreMap, Set<number>>();

/**
 * Add the backdrop (see the note at the top), invisible until `setBackdrop` shows it.
 * `baseSource` is the map's vector source and `waterLayer` its sea: the backdrop copies that
 * layer's colour and filter and sits right under it. Safe to call again; false when the map is
 * not ready for it yet.
 *
 * `level` is the deepest zoom level of the tiles it is drawn from. 1 (the default) is the whole
 * world in five tiles, always loaded: right for a landing under zoom 2, which the map itself
 * draws from those tiles. A landing that is closer in passes the level its own view is drawn
 * from (3, say): the backdrop then has the same coastline as the landing, its tiles are the ones
 * the landing fetched, and they stay in the backdrop's own small cache while the camera is away
 * on an island, where the map's own cache has long since dropped them. It is only drawn up to a
 * little past that level (`setBackdrop`): further in, its coarse sea would cover real land.
 */
export function installBackdrop(map: MapLibreMap, baseSource: string, waterLayer: string, level = 1): boolean {
  const { source, layer } = backdropIds(level);
  try {
    if (map.getLayer(layer)) return true;
    const tiles = (map.getSource(baseSource) as unknown as { tiles?: string[] } | undefined)?.tiles;
    if (!tiles?.length || !map.getLayer(waterLayer)) return false;
    if (!map.getSource(source)) map.addSource(source, { type: "vector", tiles, minzoom: 0, maxzoom: level });
    const filter = map.getFilter(waterLayer) as FilterSpecification | null | undefined;
    map.addLayer(
      {
        id: layer,
        type: "fill",
        source,
        "source-layer": "water",
        ...(filter ? { filter } : null),
        paint: {
          "fill-color": (map.getPaintProperty(waterLayer, "fill-color") as DataDrivenPropertyValueSpecification<string> | undefined) ?? "#bfe0f6",
          "fill-antialias": false,
          // Not hidden, only clear: the source stays in use, so its tiles stay loaded.
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: 0, delay: 0 },
        },
      },
      waterLayer,
    );
    const levels = installed.get(map) ?? new Set<number>();
    levels.add(level);
    installed.set(map, levels);
    return true;
  } catch {
    return false;
  }
}

/** Show the backdrop of this level (and no other), or none. */
export function setBackdrop(map: MapLibreMap, on: boolean, level = 1): void {
  try {
    const levels = installed.get(map) ?? new Set<number>([1]);
    for (const each of levels) {
      const { layer } = backdropIds(each);
      if (!map.getLayer(layer)) continue;
      const shown = on && each === level;
      // A finer backdrop fades out a little past its own level: closer in, its sea is coarser
      // than the land the map has drawn over it.
      const opacity: DataDrivenPropertyValueSpecification<number> = !shown ? 0 : each <= 1 ? 1 : ["interpolate", ["linear"], ["zoom"], each + 2.4, 1, each + 3.2, 0];
      map.setPaintProperty(layer, "fill-opacity", opacity);
    }
  } catch {
    /* The style was replaced. Nothing to show or hide. */
  }
}
