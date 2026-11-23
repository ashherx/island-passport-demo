/**
 * The card's lead photo, fetched ahead of the card.
 *
 * The card mounts when an island is chosen, and only then would its lead photo be asked for: at
 * the same moment as the map tiles of the whole flight and the rest of the card's pictures. On a
 * phone connection it lost that race, and the card landed with an empty photo area that filled in
 * a second or two later. So the photo is asked for as early as the visitor's intent shows (a chip
 * under the pointer or the finger, a search result highlighted, an island tapped), ahead of
 * everything else, in two sizes:
 *
 *   1. the narrowest rendition (about 35 KB): there when the card lands even on a poor
 *      connection, and what the card shows until the sharp one is in (Card.tsx, .da-hero-lo);
 *   2. the rendition the card's own <img> will pick, asked for with the same `srcset` and `sizes`,
 *      so the browser chooses the same file and the card finds it in the cache.
 *
 * Once the lead photo is in, the first photos of the gallery follow at low priority.
 */
import { isLive, photoAsset, photoSources, type GlobeIsland, type PhotoName } from "@/lib/islands";

/** `sizes` of the card's lead photo. The preload must ask the way the card does, or it warms the wrong file. */
export const HERO_SIZES = "(min-width: 900px) 420px, 94vw";

/** Photos of the gallery fetched after the lead photo (the Photos view opens on the lead photo and swipes to these). */
const AHEAD = 2;

type Priority = "high" | "low";

/** Kept so the browser does not drop a request whose image nobody holds; also what makes a second call free. */
const held = new Map<string, HTMLImageElement>();
const started = new Set<string>();

/** The narrowest rendition of a photo: the low-resolution stand-in. Null while the photo is a placeholder. */
export function lowSource(name: PhotoName): string | null {
  const file = photoAsset(name)?.sources[0]?.file;
  return file ? `/photos/${file}` : null;
}

function request(key: string, priority: Priority, apply: (img: HTMLImageElement) => void): Promise<void> {
  return new Promise((resolve) => {
    if (held.has(key)) {
      const img = held.get(key)!;
      if (img.complete) resolve();
      else {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      }
      return;
    }
    const img = new Image();
    held.set(key, img);
    img.decoding = "async";
    (img as HTMLImageElement & { fetchPriority?: Priority }).fetchPriority = priority;
    img.addEventListener("load", () => resolve(), { once: true });
    // Offline or blocked: the card asks again itself, and shows its placeholder meanwhile.
    img.addEventListener("error", () => resolve(), { once: true });
    apply(img);
  });
}

/** The narrow rendition and the one the card will pick. `small`: the narrow one is in. `both`: so is the other. */
function warmLead(name: PhotoName): { small: Promise<void>; both: Promise<void> } {
  const low = lowSource(name);
  const sources = photoSources(name);
  if (!low || !sources) return { small: Promise.resolve(), both: Promise.resolve() };
  const small = request(`${name}:low`, "high", (img) => {
    img.src = low;
  });
  const sharp = request(`${name}:lead`, "high", (img) => {
    img.sizes = HERO_SIZES;
    img.srcset = sources.srcSet;
    img.src = sources.src;
  });
  return { small, both: Promise.all([small, sharp]).then(() => undefined) };
}

/** Resolves when an island's lead photo is in, in both sizes (at once when there is none, or it was never asked for). */
export function leadReady(island: GlobeIsland | null | undefined): Promise<void> {
  if (typeof window === "undefined" || !isLive(island)) return Promise.resolve();
  const name = island.card.hero.name;
  if (!held.has(`${name}:lead`)) return Promise.resolve();
  return warmLead(name).both;
}

/**
 * Fetch an island's lead photo now. `depth` "lead": only that (intent: a chip under the pointer,
 * a highlighted search result). "all": the first photos of the gallery too, once the lead photo
 * is in (the island has been chosen). Safe to call as often as intent fires.
 *
 * Resolves when the narrow rendition is in (at once when there is nothing to fetch): whatever
 * else wants the connection, the map's tiles for one, can wait for that.
 */
export function warmPhotos(island: GlobeIsland | null | undefined, depth: "lead" | "all" = "lead"): Promise<void> {
  if (typeof window === "undefined" || !isLive(island)) return Promise.resolve();
  // Respect a visitor who asked their browser to save data: the card loads what it shows, no more.
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return Promise.resolve();
  const { hero, photos } = island.card;
  const { small, both } = warmLead(hero.name);
  if (depth === "all" && !started.has(island.id)) {
    started.add(island.id);
    const next = photos.filter((photo) => photo.name !== hero.name).slice(0, AHEAD);
    void both.then(() => {
      for (const photo of next) {
        const low = lowSource(photo.name);
        if (low) void request(`${photo.name}:low`, "low", (img) => (img.src = low));
      }
    });
  }
  return small;
}
