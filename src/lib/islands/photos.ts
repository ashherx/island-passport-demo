/**
 * Photo slots for the island card.
 *
 * The user drops photos into assets-raw/photos/ and runs
 *     python3 -I scripts/process-photos.py assets-raw/photos public/photos
 * which writes WebP files at three widths to public/photos and rewrites photos.manifest.json next
 * to this file. Until a photo exists, <Photo> (src/components/options-ui) draws a placeholder from
 * the option palette and the line art named here, so nothing is ever a broken image.
 */
import type { StampArt } from "@/lib/types";
import manifest from "./photos.manifest.json";
import type { PhotoName } from "./types";

export interface PhotoSlot {
  /** Default alt text; a card can pass its own. */
  alt: string;
  /** Expected width / height of the raw file, used for the placeholder until the photo arrives. */
  aspect: number;
  /** Line drawing behind the placeholder gradient. */
  art: StampArt;
}

export const PHOTO_SLOTS: Record<PhotoName, PhotoSlot> = {
  "bohol-hero": { alt: "The Chocolate Hills at sunrise, mist between the green cones", aspect: 16 / 9, art: "stamp-chocolate-hills" },
  "bohol-chocolate-hills": { alt: "The Chocolate Hills rolling into the distance at golden hour", aspect: 16 / 9, art: "stamp-chocolate-hills" },
  "bohol-alona-beach": { alt: "Outrigger boats moored off a white-sand beach on Panglao", aspect: 4 / 5, art: "stamp-reef" },
  "bohol-balicasag-reef": { alt: "A sea turtle gliding over the coral wall at Balicasag", aspect: 4 / 5, art: "stamp-sea-turtle" },
  "bohol-tarsier": { alt: "A Philippine tarsier clinging to a mossy branch", aspect: 4 / 5, art: "stamp-tarsier" },
  "bohol-pamilacan-dolphins": { alt: "Spinner dolphins leaping near Pamilacan Island", aspect: 16 / 9, art: "stamp-dolphins" },
  "bohol-mangroves": { alt: "Planted mangroves standing in clear water at Banacon", aspect: 4 / 5, art: "stamp-mangroves" },
  "bohol-reef-aerial": { alt: "The Danajon Bank double barrier reef from the air", aspect: 16 / 9, art: "stamp-reef" },
  "bohol-coral-closeup": { alt: "Hard corals and a giant clam on a healthy reef", aspect: 1, art: "stamp-reef" },
  "bohol-conservation": { alt: "Volunteers replanting mangrove seedlings from a small boat", aspect: 4 / 5, art: "stamp-mangroves" },
  "bohol-loboc-river": { alt: "The green Loboc River winding through jungle", aspect: 16 / 9, art: "stamp-mangroves" },
};

export const PHOTO_NAMES = Object.keys(PHOTO_SLOTS) as PhotoName[];

/** What process-photos.py records for each photo it produced. */
export interface PhotoAsset {
  /** Pixel size of the largest rendition. */
  width: number;
  height: number;
  /** Renditions, narrowest first: file name in public/photos and its width. */
  sources: { file: string; width: number }[];
  /** Average colour, painted behind the photo while it loads. */
  color: string;
  /** Tiny blurred preview as a data URL. */
  blur: string;
}

const assets = (manifest as { photos?: Record<string, PhotoAsset> }).photos ?? {};

/** The processed photo, or null while the placeholder should be shown. */
export function photoAsset(name: PhotoName): PhotoAsset | null {
  return assets[name] ?? null;
}

export function hasPhoto(name: PhotoName): boolean {
  return Boolean(assets[name]);
}

/** `src` (largest rendition up to `maxWidth`) and `srcSet` for an <img>. */
export function photoSources(name: PhotoName, maxWidth = Infinity): { src: string; srcSet: string } | null {
  const asset = photoAsset(name);
  if (!asset || !asset.sources.length) return null;
  const usable = asset.sources.filter((s) => s.width <= maxWidth);
  const list = usable.length ? usable : [asset.sources[0]];
  return {
    src: `/photos/${list[list.length - 1].file}`,
    srcSet: list.map((s) => `/photos/${s.file} ${s.width}w`).join(", "),
  };
}

/** Width / height: the real photo's when it exists, else the slot's expected shape. */
export function photoAspect(name: PhotoName): number {
  const asset = photoAsset(name);
  return asset ? asset.width / asset.height : PHOTO_SLOTS[name].aspect;
}
