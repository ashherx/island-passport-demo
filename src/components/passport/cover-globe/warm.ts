/**
 * Warm the browser's HTTP cache with the vector tiles an island's dive will need, so the land is
 * already sharp when the camera gets there. Adapted from src/options/a/prefetch.ts (copied, not
 * imported: the options are not part of the passport).
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

export function warmTiles(map: MapLibreMap | null, island: GlobeIsland | null): void {
  if (!map || !island || warmed.has(island.id)) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const url = template(map);
  if (!url) return;
  warmed.add(island.id);

  const [west, south, east, north] = island.bbox;
  const span = Math.max(east - west, (north - south) * 1.1, 0.004);
  // The cover's window is small: the zoom at which the island is about 130px wide on 512px tiles.
  const target = Math.max(3, Math.min(14, Math.floor(Math.log2((130 * 360) / (512 * span)))));
  const [lng, lat] = island.coordinates;
  for (let z = Math.max(2, target - 3); z <= Math.min(14, target + 1); z++) {
    const n = 2 ** z;
    const cx = lngToX(lng, z);
    const cy = latToY(lat, z);
    const xs = new Set([Math.floor(cx), Math.floor(cx + (cx % 1 < 0.5 ? -1 : 1))]);
    const ys = new Set([Math.floor(cy), Math.floor(cy + (cy % 1 < 0.5 ? -1 : 1))]);
    for (const x of xs) {
      for (const y of ys) {
        if (y < 0 || y >= n) continue;
        const tile = url.replace("{z}", String(z)).replace("{x}", String(((x % n) + n) % n)).replace("{y}", String(y));
        void fetch(tile, { mode: "cors", credentials: "omit", priority: "low" } as RequestInit).catch(() => {
          /* Offline or blocked: the map will ask again itself. */
        });
      }
    }
  }
}
