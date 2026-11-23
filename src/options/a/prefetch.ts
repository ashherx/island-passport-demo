/**
 * Warm the browser's HTTP cache with the vector tiles an island's dive will need.
 *
 * MapLibre only asks for a tile once the camera is over it, so on a long flight the last second
 * of the dive can show coarse, overzoomed land while the detailed tiles arrive. The flight's rise
 * and turn give us a second or two: asking for those tiles then means the map finds them in the
 * cache when it gets there. Tiles are immutable (cached for years), so this costs nothing twice.
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import type { GlobeIsland } from "@/lib/islands";

const warmed = new Set<string>();

const lngToX = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z;
function latToY(lat: number, z: number): number {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

function template(map: MapLibreMap): string | null {
  try {
    const sources = map.getStyle()?.sources ?? {};
    for (const id of Object.keys(sources)) {
      if (sources[id].type !== "vector") continue;
      const tiles = (map.getSource(id) as unknown as { tiles?: string[] } | undefined)?.tiles;
      if (tiles?.[0]) return tiles[0];
    }
  } catch {
    /* The style is not ready. */
  }
  return null;
}

/**
 * `tilted`: the camera lands looking across the island at an angle (LayoutModule.islandView). It
 * then sees a good deal of ground beyond the island, toward and away from itself, so at the two
 * levels nearest the landing the tiles on every side of the island's own are fetched as well.
 */
export function warmTiles(map: MapLibreMap | null, island: GlobeIsland, tilted = false): void {
  const key = tilted ? `${island.id}:tilted` : island.id;
  if (!map || warmed.has(key)) return;
  // Respect a visitor who asked their browser to save data.
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const url = template(map);
  if (!url) return;
  warmed.add(key);

  const [west, south, east, north] = island.bbox;
  const span = Math.max(east - west, (north - south) * 1.1, 0.004);
  // Zoom at which the island is about 300px wide on 512px tiles, capped at the tiles' own limit.
  const target = Math.max(3, Math.min(14, Math.floor(Math.log2((300 * 360) / (512 * span)))));
  const [lng, lat] = island.coordinates;
  const urls: string[] = [];
  for (let z = Math.max(2, target - 3); z <= Math.min(14, target + 1); z++) {
    const n = 2 ** z;
    const cx = lngToX(lng, z);
    const cy = latToY(lat, z);
    // The tile under the island and its nearest neighbours on each axis (all of them, near the
    // landing's own level, for a tilted landing).
    const around = tilted && z >= target;
    const xs = new Set(around ? [Math.floor(cx) - 1, Math.floor(cx), Math.floor(cx) + 1] : [Math.floor(cx), Math.floor(cx + (cx % 1 < 0.5 ? -1 : 1))]);
    const ys = new Set(around ? [Math.floor(cy) - 1, Math.floor(cy), Math.floor(cy) + 1] : [Math.floor(cy), Math.floor(cy + (cy % 1 < 0.5 ? -1 : 1))]);
    for (const x of xs) {
      for (const y of ys) {
        if (y < 0 || y >= n) continue;
        urls.push(url.replace("{z}", String(z)).replace("{x}", String(((x % n) + n) % n)).replace("{y}", String(y)));
      }
    }
  }
  for (const u of urls) {
    void fetch(u, { mode: "cors", credentials: "omit", priority: "low" } as RequestInit).catch(() => {
      /* Offline or blocked: the map will ask again itself. */
    });
  }
}
