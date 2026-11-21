/**
 * Option B map textures, drawn on a canvas at run time and handed to MapLibre with addImage.
 *
 * The style's fill patterns (watercolour wash on the sea, pencil hatching on the land, little
 * trees in the forest, stipple on the sand) and its one icon (a hand-drawn hill) come from here,
 * so the option ships no sprite sheet and nothing in public/. Each pattern tiles without a seam:
 * every mark is drawn nine times, once per neighbouring tile, and every pattern's size is a power
 * of two, so it also lines up across MapLibre's 512px map tiles. The marks are placed by a seeded
 * generator, so the map looks the same on every visit.
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import { MAP } from "./tokens";

/** Drawn at two device pixels per CSS pixel, which is what phones show. */
const RATIO = 2;

export const SPRITE = {
  wash: "ob-wash",
  hatch: "ob-hatch",
  trees: "ob-trees",
  stipple: "ob-stipple",
  hill: "ob-hill",
} as const;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

type Draw = (ctx: CanvasRenderingContext2D, size: number) => void;

function canvas(size: number, draw: Draw, height = size): ImageData | null {
  const el = document.createElement("canvas");
  el.width = size * RATIO;
  el.height = height * RATIO;
  const ctx = el.getContext("2d");
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(ctx, size);
  return ctx.getImageData(0, 0, el.width, el.height);
}

/** Run `mark` once for the tile and once for each of its eight neighbours, so edges match up. */
function tiled(ctx: CanvasRenderingContext2D, size: number, x: number, y: number, mark: () => void): void {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      mark();
      ctx.restore();
    }
  }
}

/** Watercolour: soft pools of lighter and deeper pigment, a little grain, a few ripple marks. */
const wash: Draw = (ctx, size) => {
  const r = seeded(11);
  for (let i = 0; i < 46; i++) {
    const radius = 26 + r() * 62;
    const light = r() > 0.42;
    const strength = light ? 0.2 + r() * 0.3 : 0.1 + r() * 0.16;
    const colour = light ? MAP.oceanLight : MAP.oceanDeep;
    tiled(ctx, size, r() * size, r() * size, () => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      g.addColorStop(0, rgba(colour, strength));
      g.addColorStop(0.55, rgba(colour, strength * 0.55));
      g.addColorStop(1, rgba(colour, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * (0.6 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // Granulation: pigment settling into the tooth of the paper.
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = rgba(r() > 0.5 ? MAP.oceanDeep : "#ffffff", 0.06 + r() * 0.1);
    ctx.fillRect(r() * size, r() * size, 0.6 + r() * 0.9, 0.6 + r() * 0.9);
  }
  // Ripples: the little double arcs an illustrator scatters over open water.
  ctx.strokeStyle = rgba(MAP.coast, 0.26);
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 11; i++) {
    const w = 5 + r() * 3;
    tiled(ctx, size, 14 + r() * (size - 28), 14 + r() * (size - 28), () => {
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(-w / 2, -3.2, 0, 0);
      ctx.quadraticCurveTo(w / 2, -3.2, w, 0);
      ctx.stroke();
    });
  }
};

/** Pencil hatching: short diagonal strokes of uneven length and pressure. */
const hatch: Draw = (ctx, size) => {
  const r = seeded(23);
  for (let i = 0; i < 44; i++) {
    const length = 5 + r() * 9;
    ctx.strokeStyle = rgba("#a57f4c", 0.1 + r() * 0.14);
    ctx.lineWidth = 0.6 + r() * 0.4;
    tiled(ctx, size, r() * size, r() * size, () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, -length * (0.85 + r() * 0.3));
      ctx.stroke();
    });
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = rgba("#a57f4c", 0.1 + r() * 0.12);
    ctx.fillRect(r() * size, r() * size, 0.8, 0.8);
  }
};

/** Forest: tiny trees, each a trunk and a round crown. */
const trees: Draw = (ctx, size) => {
  const r = seeded(37);
  const spots: [number, number][] = [
    [8, 10],
    [29, 6],
    [50, 12],
    [18, 24],
    [40, 28],
    [58, 34],
    [6, 40],
    [27, 46],
    [47, 52],
    [14, 58],
  ];
  for (const [x, y] of spots) {
    const s = 0.85 + r() * 0.4;
    tiled(ctx, size, x + r() * 3, y + r() * 3, () => {
      ctx.scale(s, s);
      ctx.strokeStyle = rgba(MAP.woodInk, 0.62);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, 3.6);
      ctx.lineTo(0, 0.6);
      ctx.stroke();
      ctx.fillStyle = rgba(MAP.woodInk, 0.2);
      ctx.beginPath();
      ctx.arc(0, -1.6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
};

/** Sand: an uneven scatter of dots. */
const stipple: Draw = (ctx, size) => {
  const r = seeded(51);
  for (let i = 0; i < 38; i++) {
    ctx.fillStyle = rgba("#c79a4e", 0.3 + r() * 0.3);
    tiled(ctx, size, r() * size, r() * size, () => {
      ctx.beginPath();
      ctx.arc(0, 0, 0.5 + r() * 0.45, 0, Math.PI * 2);
      ctx.fill();
    });
  }
};

/** A hill, drawn the way a child would: two humps and a few strokes of shade. */
const hill: Draw = (ctx) => {
  ctx.fillStyle = rgba(MAP.sage, 0.95);
  ctx.strokeStyle = rgba("#55683a", 0.95);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(1.5, 13.5);
  ctx.quadraticCurveTo(7, -1.5, 12.5, 9.5);
  ctx.quadraticCurveTo(16.5, 3, 20.5, 13.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(8.6, 6.4);
  ctx.lineTo(7.2, 10.2);
  ctx.moveTo(10.4, 8.4);
  ctx.lineTo(9.6, 11.2);
  ctx.moveTo(17, 8.6);
  ctx.lineTo(16.2, 11.2);
  ctx.stroke();
};

const BUILDERS: { id: string; size: number; height?: number; draw: Draw }[] = [
  { id: SPRITE.wash, size: 256, draw: wash },
  { id: SPRITE.hatch, size: 64, draw: hatch },
  { id: SPRITE.trees, size: 64, draw: trees },
  { id: SPRITE.stipple, size: 32, draw: stipple },
  { id: SPRITE.hill, size: 22, height: 15, draw: hill },
];

let cache: { id: string; image: ImageData }[] | null = null;

function images(): { id: string; image: ImageData }[] {
  if (cache) return cache;
  const built: { id: string; image: ImageData }[] = [];
  for (const b of BUILDERS) {
    const image = canvas(b.size, b.draw, b.height);
    if (image) built.push({ id: b.id, image });
  }
  cache = built;
  return built;
}

/**
 * Give the map its textures. Safe to call more than once and before the style has loaded. Also
 * answers "styleimagemissing", so a pattern asked for early (or after the map is rebuilt
 * following a lost WebGL context) is still supplied.
 */
export function installSprites(map: MapLibreMap): () => void {
  const add = (only?: string) => {
    for (const { id, image } of images()) {
      if (only && only !== id) continue;
      try {
        if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: RATIO });
      } catch {
        /* The style is being replaced; the missing-image handler below will be asked again. */
      }
    }
  };
  const onMissing = (event: { id: string }) => add(event.id);
  add();
  map.on("styleimagemissing", onMissing);
  return () => {
    map.off("styleimagemissing", onMissing);
  };
}
