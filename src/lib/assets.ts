/**
 * Asset manifest: resolves artwork and texture names to URLs.
 *
 * Stamp art
 *   Placeholder line art:  public/stamps/<name>.svg   (always present, hand-drawn)
 *   Generated ink masks:   public/stamps/<name>.png   (present once the user supplies art)
 *
 * Textures
 *   public/textures/<name>.webp (or .jpg). Until they exist, materials are drawn with CSS/SVG
 *   (see src/lib/directions.ts).
 *
 * How the switch happens
 *   `python3 -I scripts/process-stamps.py assets-raw public/stamps` converts the raw images and
 *   rewrites src/lib/assets.manifest.json with what it produced. This module reads that file, so
 *   the app picks up the new art on the next hot reload. To switch by hand, add the base name to
 *   "stamps" or add `"tex-paper": "tex-paper.webp"` to "textures" in the manifest.
 */
import manifest from "./assets.manifest.json";
import type { StampArt } from "./types";

export const STAMP_ART: readonly StampArt[] = [
  "stamp-chocolate-hills",
  "stamp-tarsier",
  "stamp-sea-turtle",
  "stamp-dolphins",
  "stamp-mangroves",
  "stamp-reef",
  "stamp-provincial",
] as const;

export type TextureName = "tex-cover-navy" | "tex-cover-teal" | "tex-cover-kraft" | "tex-paper";

export const TEXTURE_NAMES: readonly TextureName[] = [
  "tex-cover-navy",
  "tex-cover-teal",
  "tex-cover-kraft",
  "tex-paper",
] as const;

const generatedStamps = new Set<string>((manifest as { stamps?: string[] }).stamps ?? []);
const generatedTextures: Record<string, string | undefined> =
  (manifest as { textures?: Record<string, string> }).textures ?? {};

/** True when a generated PNG ink mask exists for this artwork. */
export function hasGeneratedArt(name: StampArt): boolean {
  return generatedStamps.has(name);
}

/** URL of the artwork mask: the generated PNG when present, else the placeholder SVG. */
export function artUrl(name: StampArt): string {
  return `/stamps/${name}.${hasGeneratedArt(name) ? "png" : "svg"}`;
}

/** URL of a generated texture, or null while the CSS/SVG material should be used. */
export function textureUrl(name: TextureName): string | null {
  const file = generatedTextures[name];
  return file ? `/textures/${file}` : null;
}

/** Every artwork URL, for preloading before the stamping moment (UX-7). */
export function allArtUrls(): string[] {
  return STAMP_ART.map(artUrl);
}
