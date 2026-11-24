/**
 * The passport stamp on a 2D canvas: a static recreation of <Stamp /> (src/components/stamp) for
 * artwork that has to be saved as a picture or recorded as video. Same geometry, the same three
 * statuses (Discovery outline, Donation pending dashed with a clock, Verified Supporter solid band
 * with the foil seal), the same direction inks and lettering.
 *
 * The ink is drawn once per stamp, status and size into a sprite (speckled like a dry pad), then
 * multiplied onto the paper so the page shows through it.
 */
import { C, burstPath, fitFont, hash, polygonPath, scallopPath, sparklePath } from "@/components/stamp/geometry";
import { formatStampDate, stampDateParts } from "@/lib/strings";
import type { Stamp, StampShape, StampStatus } from "@/lib/types";
import { ctxOf, makeCanvas, seeded, type ArtAssets, type Ctx } from "./core";

const SEAL_R = 28;
const PENDING_R = 25;
/** Margin round the 200-unit box, so thick outlines and the seal are never clipped. */
const BLEED = 10;
const BOX = 200 + BLEED * 2;

function badgeAnchor(shape: StampShape): { x: number; y: number } {
  switch (shape) {
    case "oval":
      return { x: 170, y: 155 };
    case "rounded":
      return { x: 171, y: 153 };
    case "seal":
      return { x: 166, y: 166 };
    default:
      return { x: 165.5, y: 165.5 };
  }
}

function ringBand(shape: StampShape) {
  switch (shape) {
    case "scalloped":
      return { ox: 85, oy: 85, ix: 62.5, iy: 62.5 };
    case "octagon":
      return { ox: 83.5, oy: 83.5, ix: 61.5, iy: 61.5 };
    case "oval":
      return { ox: 95.5, oy: 75.5, ix: 73, iy: 53 };
    default:
      return { ox: 91.5, oy: 91.5, ix: 64, iy: 64 };
  }
}

function outline(shape: StampShape): Path2D {
  switch (shape) {
    case "scalloped":
      return new Path2D(scallopPath(26, 90.4, 0.8));
    case "octagon":
      return new Path2D(polygonPath(8, 97));
    case "oval": {
      const p = new Path2D();
      p.ellipse(C, C, 97, 77, 0, 0, Math.PI * 2);
      return p;
    }
    default: {
      const p = new Path2D();
      p.arc(C, C, 93, 0, Math.PI * 2);
      return p;
    }
  }
}

function ellipse(g: Ctx, rx: number, ry: number) {
  g.beginPath();
  g.ellipse(C, C, rx, ry, 0, 0, Math.PI * 2);
}

/**
 * Lettering along the top or the bottom of an ellipse, centred, the way <textPath> sets it: over
 * the top the glyphs stand outside the curve, under the bottom they stand inside it.
 */
function arcText(g: Ctx, text: string, rx: number, ry: number, size: number, trackEm: number, side: "top" | "bottom") {
  const steps = 240;
  const point = (u: number) => {
    const a = side === "top" ? Math.PI + u * Math.PI : Math.PI - u * Math.PI;
    return { x: C + rx * Math.cos(a), y: C + ry * Math.sin(a) };
  };
  // Arc length along the half ellipse.
  const lengths = [0];
  let prev = point(0);
  for (let i = 1; i <= steps; i++) {
    const p = point(i / steps);
    lengths.push(lengths[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const total = lengths[steps];
  const at = (s: number) => {
    const target = Math.min(Math.max(s, 0), total);
    let i = 1;
    while (i < steps && lengths[i] < target) i++;
    const seg = lengths[i] - lengths[i - 1] || 1;
    return (i - 1 + (target - lengths[i - 1]) / seg) / steps;
  };
  const chars = [...text];
  const track = trackEm * size;
  const widths = chars.map((ch) => g.measureText(ch).width);
  const run = widths.reduce((sum, w) => sum + w, 0) + track * (chars.length - 1);
  let s = (total - run) / 2;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  chars.forEach((ch, i) => {
    const u = at(s + widths[i] / 2);
    const p = point(u);
    const q = point(Math.min(1, u + 0.004));
    const o = point(Math.max(0, u - 0.004));
    g.save();
    g.translate(p.x, p.y);
    g.rotate(Math.atan2(q.y - o.y, q.x - o.x));
    g.fillText(ch, 0, 0);
    g.restore();
    s += widths[i] + track;
  });
}

function spaced(g: Ctx, text: string, x: number, y: number, size: number, trackEm: number, align: "left" | "center" = "center") {
  const chars = [...text];
  const track = trackEm * size;
  const widths = chars.map((ch) => g.measureText(ch).width);
  const run = widths.reduce((sum, w) => sum + w, 0) + track * (chars.length - 1);
  let cx = align === "center" ? x - run / 2 : x;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  chars.forEach((ch, i) => {
    g.fillText(ch, cx, y);
    cx += widths[i] + track;
  });
}

/** The artwork mask tinted with the ink colour. */
const tinted = new Map<string, HTMLCanvasElement>();

function tintedArt(mask: HTMLImageElement, key: string, ink: string): HTMLCanvasElement {
  const id = `${key}:${ink}`;
  let canvas = tinted.get(id);
  if (!canvas) {
    canvas = makeCanvas(mask.naturalWidth || 512, mask.naturalHeight || 512);
    const g = ctxOf(canvas);
    g.drawImage(mask, 0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = ink;
    g.fillRect(0, 0, canvas.width, canvas.height);
    tinted.set(id, canvas);
  }
  return canvas;
}

function drawRing(g: Ctx, stamp: Stamp, status: StampStatus, assets: ArtAssets): { cx: number; cy: number; size: number } {
  const { tokens, fonts } = assets;
  const w = tokens.impression.weight;
  const { stampTracking: track, stampAdvance: adv, stampScale: scale, stampWeight } = tokens.type;
  const shape = stamp.shape;
  const band = ringBand(shape);
  const mx = (band.ox + band.ix) / 2;
  const my = (band.oy + band.iy) / 2;
  const bw = band.ox - band.ix;
  const halfArc = Math.PI * Math.sqrt((mx * mx + my * my) / 2);
  const anchor = badgeAnchor(shape);
  const path = outline(shape);

  const island = stamp.island.toUpperCase();
  const islandSize = fitFont(island, halfArc * 0.7, bw * 0.6 * scale, adv, track);
  const islandCap = islandSize * 0.7;
  const promoter = stamp.promoter.toUpperCase();
  const promoterSize = fitFont(promoter, halfArc * 0.325, bw * 0.37 * scale, adv, track * 0.5);
  const promoterCap = promoterSize * 0.7;

  const lettering = () => {
    g.font = `${stampWeight} ${islandSize}px ${fonts.stamp}`;
    arcText(g, island, mx - islandCap / 2, my - islandCap / 2, islandSize, track, "top");
    if (promoter) {
      g.font = `${stampWeight} ${promoterSize}px ${fonts.stamp}`;
      arcText(g, promoter, mx + promoterCap / 2, my + promoterCap / 2, promoterSize, track * 0.5, "bottom");
    }
    g.fill(new Path2D(sparklePath(C - mx, C, bw * 0.17)));
    g.fill(new Path2D(sparklePath(C + mx, C, bw * 0.17)));
  };

  if (status === "verified") {
    g.lineWidth = 3.2 * w * 1.05;
    g.stroke(path);
    g.lineWidth = bw;
    ellipse(g, mx, my);
    g.stroke();
    g.globalAlpha = 0.1;
    ellipse(g, band.ix - 1, band.iy - 1);
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 1.1 * w;
    ellipse(g, band.ix - 4.2, band.iy - 4.2);
    g.stroke();
    // The lettering is the paper showing through the solid band.
    g.globalCompositeOperation = "destination-out";
    lettering();
    g.globalCompositeOperation = "source-over";
  } else if (status === "pending") {
    g.lineWidth = 3 * w;
    g.setLineDash([8, 5.2]);
    g.stroke(path);
    g.lineWidth = 2.1 * w;
    g.lineCap = "round";
    g.setLineDash([0.1, 4.8]);
    ellipse(g, band.ix, band.iy);
    g.stroke();
    g.setLineDash([]);
    g.lineCap = "butt";
    lettering();
    // A gap in the frame where the clock badge sits.
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(anchor.x, anchor.y, PENDING_R + 4.5, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  } else {
    g.lineWidth = 3.2 * w;
    g.stroke(path);
    if (shape === "scalloped" || shape === "octagon") {
      g.lineWidth = 1.1 * w;
      ellipse(g, band.ox, band.oy);
      g.stroke();
    }
    g.lineWidth = 1.25 * w;
    ellipse(g, band.ix, band.iy);
    g.stroke();
    lettering();
  }

  const inner = Math.min(band.ix, band.iy);
  const dateSize = Math.max(8.2, inner * 0.142);
  g.font = `500 ${dateSize}px ${fonts.mono}`;
  spaced(g, formatStampDate(stamp.date), C, C + inner * 0.735, dateSize, 0.09);
  return { cx: C, cy: C - inner * 0.15, size: inner * 1.27 };
}

/** The rounded rectangle is laid out like an entry visa: header band, artwork, date block, footer. */
function drawRounded(g: Ctx, stamp: Stamp, status: StampStatus, assets: ArtAssets): { cx: number; cy: number; size: number } {
  const { tokens, fonts } = assets;
  const w = tokens.impression.weight;
  const { stampTracking: track, stampAdvance: adv, stampScale: scale, stampWeight } = tokens.type;
  const verified = status === "verified";
  const pending = status === "pending";
  const anchor = badgeAnchor("rounded");
  const headerY = 61;
  const footerY = 145;
  const island = stamp.island.toUpperCase();
  const islandSize = fitFont(island, 150, 15.5 * scale, adv, track);
  const islandY = (28 + headerY) / 2 + islandSize * 0.36 + 1;
  const promoter = stamp.promoter.toUpperCase();
  const promoterSize = fitFont(promoter, 112, 9.6 * scale, adv, track * 0.5);
  const date = stampDateParts(stamp.date);

  const frame = new Path2D();
  frame.roundRect(8, 28, 184, 144, 16);
  const header = () => {
    g.font = `${stampWeight} ${islandSize}px ${fonts.stamp}`;
    spaced(g, island, C, islandY, islandSize, track);
  };
  const rule = (d: string, width: number, dotted: boolean) => {
    g.lineWidth = width;
    if (dotted) {
      g.lineCap = "round";
      g.setLineDash([0.1, 4.6]);
    }
    g.stroke(new Path2D(d));
    g.setLineDash([]);
    g.lineCap = "butt";
  };

  g.lineWidth = (pending ? 3 : 3.2) * w;
  if (pending) g.setLineDash([8, 5.2]);
  g.stroke(frame);
  g.setLineDash([]);

  if (verified) {
    g.fill(new Path2D(`M 8 ${headerY} V 44 A 16 16 0 0 1 24 28 H 176 A 16 16 0 0 1 192 44 V ${headerY} Z`));
    g.globalAlpha = 0.1;
    g.beginPath();
    g.roundRect(14, headerY + 5, 172, footerY - headerY - 9, 5);
    g.fill();
    g.globalAlpha = 1;
    rule(`M 8 ${footerY} H 192`, 2.2 * w, false);
    g.globalCompositeOperation = "destination-out";
    header();
    g.globalCompositeOperation = "source-over";
  } else {
    const thin = (pending ? 2.1 : 1.25) * w;
    const inner = new Path2D();
    inner.roundRect(13.6, 33.6, 172.8, 132.8, 11);
    g.lineWidth = thin;
    if (pending) {
      g.lineCap = "round";
      g.setLineDash([0.1, 4.6]);
    }
    g.stroke(inner);
    g.setLineDash([]);
    g.lineCap = "butt";
    rule(`M 13.6 ${headerY} H 186.4`, thin * 1.2, pending);
    rule(`M 13.6 ${footerY} H 186.4`, thin, pending);
    header();
  }

  g.font = `500 10.5px ${fonts.mono}`;
  spaced(g, date.month, 143, 81, 10.5, 0.22);
  spaced(g, date.year, 143, 129, 10.5, 0.22);
  g.font = `${stampWeight} ${33 * scale}px ${fonts.stamp}`;
  spaced(g, date.day, 143, 113, 33 * scale, 0.02);
  g.lineWidth = 0.9 * w;
  g.stroke(new Path2D("M 122 86.5 H 164 M 122 118 H 164"));
  if (promoter) {
    g.font = `${stampWeight} ${promoterSize}px ${fonts.stamp}`;
    spaced(g, promoter, 22, footerY + 14.6, promoterSize, track * 0.5, "left");
  }

  if (pending) {
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(anchor.x, anchor.y, PENDING_R + 4.5, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  }
  return { cx: 61, cy: (headerY + footerY) / 2, size: 76 };
}

const sprites = new Map<string, HTMLCanvasElement>();

/** Everything printed in ink, upright, in a (200 + bleed) unit box scaled to `px` per 200 units. */
function inkSprite(stamp: Stamp, status: StampStatus, assets: ArtAssets, px: number): HTMLCanvasElement {
  const key = `${assets.direction}:${stamp.id}:${stamp.date}:${status}:${px}`;
  const cached = sprites.get(key);
  if (cached) return cached;

  const k = px / 200;
  const canvas = makeCanvas(BOX * k, BOX * k);
  const g = ctxOf(canvas);
  g.scale(k, k);
  g.translate(BLEED, BLEED);
  const ink = assets.tokens.ink[status];
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineJoin = "round";

  const art = stamp.shape === "rounded" ? drawRounded(g, stamp, status, assets) : drawRing(g, stamp, status, assets);
  const mask = assets.masks[stamp.art];
  if (mask) {
    g.globalAlpha = status === "pending" ? 0.92 : 1;
    g.drawImage(tintedArt(mask, stamp.art, ink), art.cx - art.size / 2, art.cy - art.size / 2, art.size, art.size);
    g.globalAlpha = 1;
  }

  if (status === "pending") {
    // The clock badge: a solid disc of ink with the clock showing through as paper.
    const a = badgeAnchor(stamp.shape);
    g.beginPath();
    g.arc(a.x, a.y, PENDING_R, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    g.lineWidth = 2.9;
    g.lineCap = "round";
    g.beginPath();
    g.arc(a.x, a.y, 13, 0, Math.PI * 2);
    g.moveTo(a.x, a.y - 13 * 0.56);
    g.lineTo(a.x, a.y);
    g.lineTo(a.x + 13 * 0.4, a.y + 13 * 0.25);
    g.stroke();
    g.globalCompositeOperation = "source-over";
    g.lineCap = "butt";
  }

  // A dry pad: pinholes and a few bare patches where the rubber did not take.
  const random = seeded(hash(`${stamp.id}:${status}`));
  const speckle = assets.tokens.impression.speckle;
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = "#000";
  const dots = Math.round(900 * speckle);
  for (let i = 0; i < dots; i++) {
    const r = 0.25 + random() * random() * 1.25;
    g.globalAlpha = 0.5 + random() * 0.5;
    g.beginPath();
    g.arc(random() * 200, random() * 200, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 5; i++) {
    const x = random() * 200;
    const y = random() * 200;
    const grad = g.createRadialGradient(x, y, 0, x, y, 14 + random() * 16);
    grad.addColorStop(0, `rgba(0,0,0,${0.22 + random() * 0.2})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 1;
    g.fillStyle = grad;
    g.fillRect(x - 32, y - 32, 64, 64);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";

  sprites.set(key, canvas);
  return canvas;
}

/** The gold-foil Verified Supporter seal, drawn around the origin with radius `r`. */
export function drawFoilSeal(ctx: Ctx, r: number, assets: ArtAssets) {
  const { foil } = assets.tokens;
  const gradient = (flip: boolean) => {
    const g = flip ? ctx.createLinearGradient(r * 0.8, r, -r * 0.8, -r) : ctx.createLinearGradient(-r * 0.8, -r, r * 0.8, r);
    g.addColorStop(0, foil.lo);
    g.addColorStop(0.22, foil.base);
    g.addColorStop(0.42, foil.hi);
    g.addColorStop(0.58, foil.base);
    g.addColorStop(0.8, foil.lo);
    g.addColorStop(1, foil.base);
    return g;
  };
  const k = r / 28;
  const burst = new Path2D(burstPath(24, r, r * 0.905));
  ctx.save();
  ctx.save();
  ctx.translate(0.6 * k, 1.5 * k);
  ctx.globalAlpha *= 0.42;
  ctx.fillStyle = foil.shadow;
  ctx.fill(burst);
  ctx.restore();
  ctx.fillStyle = gradient(false);
  ctx.fill(burst);
  ctx.strokeStyle = foil.hi;
  ctx.lineWidth = 0.5 * k;
  ctx.stroke(burst);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.79, 0, Math.PI * 2);
  ctx.fillStyle = gradient(true);
  ctx.fill();
  ctx.strokeStyle = foil.shadow;
  ctx.globalAlpha *= 0.55;
  ctx.lineWidth = 0.6 * k;
  ctx.stroke();
  ctx.globalAlpha /= 0.55;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.655, 0, Math.PI * 2);
  ctx.strokeStyle = foil.hi;
  ctx.lineWidth = 0.55 * k;
  ctx.stroke();
  // The check.
  ctx.strokeStyle = foil.shadow;
  ctx.lineWidth = 3.4 * k;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.02);
  ctx.lineTo(-r * 0.07, r * 0.25);
  ctx.lineTo(r * 0.33, -r * 0.24);
  ctx.stroke();
  ctx.restore();
}

/** Resting tilt of a stamp in degrees: deterministic from its id, like the passport's. */
export function stampTilt(id: string): number {
  return (((hash(`tilt:${id}`) % 100000) / 100000) * 2 - 1) * 5.5;
}

export interface StampDrawOptions {
  /** Draw it as if it had this status. Default the stamp's own. */
  status?: StampStatus;
  /** Degrees. Default the stamp's resting tilt; false = upright. */
  rotate?: number | false;
  /** 0 to 1. */
  alpha?: number;
  /** Scale of the foil seal, for animating it landing after the ink. Default 1. */
  seal?: number;
  /** "multiply" soaks the ink into the paper underneath (the default); "normal" for dark backgrounds. */
  blend?: "multiply" | "normal";
}

/** Draw a stamp `size` px wide centred on (cx, cy). */
export function drawStamp(ctx: Ctx, stamp: Stamp, assets: ArtAssets, cx: number, cy: number, size: number, options: StampDrawOptions = {}) {
  const status = options.status ?? stamp.status;
  const alpha = options.alpha ?? 1;
  if (alpha <= 0 || size <= 0) return;
  // Sprites are made at a few sizes only, so an animated scale does not fill the cache.
  const px = Math.min(1200, Math.max(120, Math.ceil(size / 80) * 80));
  const sprite = inkSprite(stamp, status, assets, px);
  const tilt = options.rotate === false ? 0 : (options.rotate ?? stampTilt(stamp.id));
  const k = size / 200;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (options.blend !== "normal") ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(sprite, -(BOX / 2) * k, -(BOX / 2) * k, BOX * k, BOX * k);
  ctx.restore();
  const seal = options.seal ?? 1;
  if (status === "verified" && seal > 0) {
    const a = badgeAnchor(stamp.shape);
    ctx.translate((a.x - C) * k, (a.y - C) * k);
    ctx.scale(seal, seal);
    ctx.globalAlpha *= Math.min(1, alpha * 1.4);
    drawFoilSeal(ctx, SEAL_R * k, assets);
  }
  ctx.restore();
}
