/**
 * Shared plumbing for the traveler artwork: one 2D-canvas renderer draws the story card, the feed
 * card and every frame of the passport film, so what is previewed is exactly what is saved.
 *
 * Client only. Everything it loads is same-origin (public/photos, public/stamps, public/textures),
 * so the canvases are never tainted and can be exported.
 */
import { artUrl, textureUrl } from "@/lib/assets";
import { DIRECTIONS, type DirectionTokens } from "@/lib/directions";
import { photoSources } from "@/lib/islands/photos";
import type { PhotoName } from "@/lib/islands/types";
import type { DirectionId, StampArt } from "@/lib/types";

export type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Canvas and maths helpers                                            */
/* ------------------------------------------------------------------ */

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function ctxOf(canvas: HTMLCanvasElement): Ctx {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  return ctx;
}

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 before `from`, 1 after `to`, linear in between. */
export const span = (t: number, from: number, to: number) => clamp((t - from) / (to - from));

export const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  /** Soft overshoot, for things that land. */
  back: (t: number) => {
    const c = 1.55;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

/** Small seeded generator (mulberry32), so speckle and paper grain never change between frames. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Letter spacing where the browser has it (Chrome, Safari 17+, Firefox 115+); a no-op elsewhere. */
export function tracking(ctx: Ctx, px: number) {
  (ctx as Ctx & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

export function wrapLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 4 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

/** Draw an image so it covers the box, anchored at `focus` (0 to 100 each). */
export function drawCover(ctx: Ctx, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, focus: readonly [number, number] = [50, 50], zoom = 1) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) * (focus[0] / 100), y + (h - dh) * (focus[1] / 100), dw, dh);
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

const images = new Map<string, Promise<HTMLImageElement | null>>();

/** Load once, share afterwards. Resolves null when the file is missing, so a draw can go on without it. */
export function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  let pending = images.get(src);
  if (!pending) {
    pending = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    images.set(src, pending);
  }
  return pending;
}

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

export interface ArtFonts {
  /** Interface serif (Instrument Serif) and sans (DM Sans): headlines and panels around the passport. */
  serif: string;
  sans: string;
  /** The art direction's own faces: what is printed on the passport. */
  display: string;
  body: string;
  mono: string;
  stamp: string;
}

/** next/font exposes each face as a CSS variable with a hashed family name; read the real names. */
function resolveStack(stack: string): string {
  const html = getComputedStyle(document.documentElement);
  const kit = document.querySelector(".sk");
  const scoped = kit ? getComputedStyle(kit) : html;
  return stack.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_all, name: string, fallback?: string) => {
    const value = (scoped.getPropertyValue(name) || html.getPropertyValue(name)).trim();
    return value || fallback?.trim() || "serif";
  });
}

const fontLoads = new Map<string, Promise<unknown>>();

function loadFace(spec: string): Promise<unknown> {
  let pending = fontLoads.get(spec);
  if (!pending) {
    pending = document.fonts.load(spec, "AaBb 0123").catch(() => null);
    fontLoads.set(spec, pending);
  }
  return pending;
}

export async function loadFonts(tokens: DirectionTokens): Promise<ArtFonts> {
  const fonts: ArtFonts = {
    serif: resolveStack(`var(--da-serif), Georgia, serif`),
    sans: resolveStack(`var(--da-sans), system-ui, sans-serif`),
    display: resolveStack(tokens.fonts.display),
    body: resolveStack(tokens.fonts.body),
    mono: resolveStack(tokens.fonts.mono),
    stamp: resolveStack(tokens.fonts.stamp),
  };
  const w = tokens.type;
  await Promise.all([
    loadFace(`400 64px ${fonts.serif}`),
    loadFace(`italic 400 64px ${fonts.serif}`),
    loadFace(`500 32px ${fonts.sans}`),
    loadFace(`700 32px ${fonts.sans}`),
    loadFace(`${w.displayWeight} 64px ${fonts.display}`),
    loadFace(`italic 500 32px ${fonts.display}`),
    loadFace(`500 24px ${fonts.body}`),
    loadFace(`500 24px ${fonts.mono}`),
    loadFace(`${w.stampWeight} 32px ${fonts.stamp}`),
  ]);
  return fonts;
}

/* ------------------------------------------------------------------ */
/* The asset bundle a drawing needs                                    */
/* ------------------------------------------------------------------ */

export interface ArtAssets {
  direction: DirectionId;
  tokens: DirectionTokens;
  fonts: ArtFonts;
  cover: HTMLImageElement | null;
  paper: HTMLImageElement | null;
  masks: Partial<Record<StampArt, HTMLImageElement | null>>;
  photos: Partial<Record<PhotoName, HTMLImageElement | null>>;
}

export interface AssetRequest {
  direction: DirectionId;
  arts?: readonly StampArt[];
  photos?: readonly PhotoName[];
  /** Largest photo rendition to fetch. 1280 is enough for a 1080 px wide post. */
  photoWidth?: 640 | 1280 | 1672;
}

export async function loadAssets({ direction, arts = [], photos = [], photoWidth = 1280 }: AssetRequest): Promise<ArtAssets> {
  const tokens = DIRECTIONS[direction];
  const [fonts, cover, paper, masks, pictures] = await Promise.all([
    loadFonts(tokens),
    loadImage(textureUrl(tokens.cover.texture)),
    loadImage(textureUrl("tex-paper")),
    Promise.all(arts.map((art) => loadImage(artUrl(art)))),
    Promise.all(photos.map((name) => loadImage(photoSources(name, photoWidth)?.src))),
  ]);
  return {
    direction,
    tokens,
    fonts,
    cover,
    paper,
    masks: Object.fromEntries(arts.map((art, i) => [art, masks[i]])),
    photos: Object.fromEntries(photos.map((name, i) => [name, pictures[i]])),
  };
}

/** Foil for lettering on the cover: a metallic sweep on leather and linen, plain dark ink on kraft. */
export function foilStyle(ctx: Ctx, assets: ArtAssets, x0: number, y0: number, x1: number, y1: number): CanvasGradient | string {
  const { foil, cover } = assets.tokens;
  if (cover.material === "kraft") return cover.ink;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, foil.lo);
  g.addColorStop(0.22, foil.base);
  g.addColorStop(0.42, foil.hi);
  g.addColorStop(0.58, foil.base);
  g.addColorStop(0.8, foil.lo);
  g.addColorStop(1, foil.base);
  return g;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), type, quality));
}
