/**
 * The passport as flat artwork: front cover (with a still globe), back cover ("Scan to help my
 * charity" and the QR code), the holder page, an island page and a stamp card, each in the
 * traveler's art direction. These are lightweight recreations of the real passport pages
 * (src/components/passport/content) for pictures and video; they are not the flip engine.
 *
 * Every function draws in "page units": a page is 360 wide (the unit the real pages use) and the
 * caller scales the context. A full page is PAGE.w x PAGE.h.
 */
import { projectToDisc } from "@/components/globe/camera";
import land from "@/components/globe/land.generated.json";
import { drawQr } from "@/components/share/kit/render";
import { strings } from "@/lib/strings";
import type { PhotoName } from "@/lib/islands/types";
import type { DirectionId, Island, PassportHolder, PassportProgress, Stamp, StampSlot, StampStatus } from "@/lib/types";
import { drawCover, foilStyle, roundRect, seeded, tracking, wrapLines, type ArtAssets, type Ctx } from "./core";
import { drawStamp } from "./stamp";

export const PAGE = { w: 360, h: 504 } as const;

const LAND = land as { q: number; rings: number[][] };
/** Where the still globe looks: the Philippines, a little north of centre. */
const GLOBE_CENTRE: [number, number] = [121, 7];
const BOHOL: [number, number] = [124.1, 9.85];

const GLOBE_LOOK: Record<DirectionId, { ocean: [string, string]; land: string; shore: string; dot: string; shade: string; shine: string }> = {
  classic: { ocean: ["#3a6cb8", "#1c3a78"], land: "#e2c47c", shore: "#f1dc9f", dot: "#fff3c9", shade: "rgba(4, 9, 26, 0.55)", shine: "rgba(255, 244, 214, 0.3)" },
  reef: { ocean: ["#a9ebe2", "#5cbfb5"], land: "#fff3d6", shore: "#ffffff", dot: "#f2553a", shade: "rgba(4, 52, 54, 0.32)", shine: "rgba(255, 255, 255, 0.55)" },
  journal: { ocean: ["#cfdfe0", "#a9c0c3"], land: "#e9d9ae", shore: "#8c8474", dot: "#a3421d", shade: "rgba(60, 46, 28, 0.3)", shine: "rgba(255, 255, 255, 0.2)" },
};

/* ------------------------------------------------------------------ */
/* Small type helpers                                                  */
/* ------------------------------------------------------------------ */

function micro(g: Ctx, assets: ArtAssets, text: string, x: number, y: number, size: number, align: CanvasTextAlign = "left", track = 0.18) {
  g.font = `500 ${size}px ${assets.fonts.mono}`;
  g.textAlign = align;
  g.textBaseline = "alphabetic";
  tracking(g, size * track);
  // Letter spacing trails the last glyph: pull right-aligned and centred text back by it.
  const shift = align === "right" ? size * track : align === "center" ? (size * track) / 2 : 0;
  g.fillText(text.toUpperCase(), x + shift, y);
  tracking(g, 0);
}

function displayFont(assets: ArtAssets, size: number, italic = false): string {
  const { type } = assets.tokens;
  return `${italic ? "italic " : ""}${italic ? 500 : type.displayWeight} ${size}px ${assets.fonts.display}`;
}

/* ------------------------------------------------------------------ */
/* Paper                                                               */
/* ------------------------------------------------------------------ */

/** A sheet of the direction's paper filling (0, 0, w, h): colour, security pattern, tooth, edge shade. */
export function drawPaper(g: Ctx, w: number, h: number, assets: ArtAssets, radius = 10) {
  const { paper } = assets.tokens;
  g.save();
  roundRect(g, 0, 0, w, h, radius);
  g.clip();
  g.fillStyle = paper.base;
  g.fillRect(0, 0, w, h);

  const p = paper.pattern;
  if (p.kind === "guilloche") {
    g.strokeStyle = paper.line;
    g.lineWidth = p.stroke;
    g.globalAlpha = p.opacity;
    const steps = 20;
    for (let y0 = -p.height / 2; y0 < h; y0 += p.height) {
      for (let i = 0; i < p.waves + 3; i++) {
        const main = i < p.waves;
        const phase = main ? (2 * Math.PI * i) / p.waves : (2 * Math.PI * (i - p.waves)) / 3;
        const amp = main ? p.height / 2 - 0.5 : p.height / 5;
        const freq = main ? 1 : 2;
        g.beginPath();
        for (let x = 0; x <= w + p.wavelength; x += p.wavelength / steps) {
          const y = y0 + p.height / 2 + amp * Math.sin((2 * Math.PI * freq * x) / p.wavelength + phase);
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  } else if (p.kind === "wash") {
    for (const b of p.washes) {
      const cx = (b.x / 100) * w;
      const cy = (b.y / 100) * h;
      const rx = (b.rx / 100) * w * 1.25;
      const ry = (b.ry / 100) * h * 1.25;
      g.save();
      g.translate(cx, cy);
      g.scale(1, ry / rx);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, b.color);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.globalAlpha = p.opacity * 1.5;
      g.fillStyle = grad;
      g.fillRect(-rx, -rx, rx * 2, rx * 2);
      g.restore();
    }
  } else {
    g.strokeStyle = paper.line;
    g.lineWidth = 0.5;
    for (let i = 0, x = 0; x <= w; x += p.cell, i++) {
      g.globalAlpha = i % p.major === 0 ? p.majorOpacity : p.opacity;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let i = 0, y = 0; y <= h; y += p.cell, i++) {
      g.globalAlpha = i % p.major === 0 ? p.majorOpacity : p.opacity;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  if (assets.paper) {
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = 0.55;
    drawCover(g, assets.paper, 0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // The page darkens toward its edges, as paper does under a lamp.
  const shade = g.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.78);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(60,40,10,0.13)");
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/** The gutter shadow of a right-hand page, laid over the paper beside the spine. */
export function drawGutter(g: Ctx, h: number, width = 34, strength = 0.2) {
  const grad = g.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, `rgba(30,20,5,${strength})`);
  grad.addColorStop(0.35, `rgba(30,20,5,${strength * 0.35})`);
  grad.addColorStop(1, "rgba(30,20,5,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, width, h);
}

interface PageChrome {
  left: string;
  right: string;
  passportNo: string;
  pageNo: string;
}

/** Header line, rule and footer that every inside page carries. */
function pageChrome(g: Ctx, w: number, h: number, assets: ArtAssets, chrome: PageChrome) {
  const { paper } = assets.tokens;
  g.fillStyle = paper.ink;
  micro(g, assets, chrome.left, 26, 36, 7.6);
  micro(g, assets, chrome.right, w - 26, 36, 7.6, "right");
  // The rule: a woven band on security paper, a plain line elsewhere.
  g.strokeStyle = paper.line;
  g.globalAlpha = 0.5;
  g.lineWidth = 0.6;
  if (paper.pattern.kind === "guilloche") {
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      for (let x = 26; x <= w - 26; x += 2) {
        const y = 46 + 2.2 * Math.sin((x / 7) * Math.PI + i * Math.PI);
        if (x === 26) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else {
    g.beginPath();
    g.moveTo(26, 46);
    g.lineTo(w - 26, 46);
    g.stroke();
  }
  g.globalAlpha = 1;

  g.fillStyle = paper.inkMuted;
  micro(g, assets, chrome.passportNo, 26, h - 22, 7.6, "left", 0.22);
  g.globalAlpha = 0.75;
  micro(g, assets, "Sample", w / 2, h - 22, 6, "center", 0.24);
  g.globalAlpha = 1;
  g.fillStyle = paper.ink;
  g.font = displayFont(assets, 13);
  g.textAlign = "right";
  g.fillText(chrome.pageNo, w - 26, h - 20);
}

/* ------------------------------------------------------------------ */
/* Globe                                                               */
/* ------------------------------------------------------------------ */

interface UnitLand {
  /** One closed shape per stretch of land on the near side. */
  fills: Path2D[];
  /** The coastlines alone, without the pieces of horizon that close the shapes. */
  shore: Path2D;
}

let unitLandCache: UnitLand | null = null;

/**
 * The world's land in a unit disc, seen from above the Philippines. Built once.
 *
 * Each coastline is cut where it goes over the horizon, and each visible stretch is closed along
 * the horizon by the shorter way round. (Sliding the hidden points onto the rim instead lets a
 * continent that wraps round the far side, like the Americas, smear across the whole disc.)
 */
function unitLand(): UnitLand {
  if (unitLandCache) return unitLandCache;
  const fills: Path2D[] = [];
  const shore = new Path2D();
  const q = LAND.q;
  for (const ring of LAND.rings) {
    const n = ring.length / 2;
    const points: { x: number; y: number; visible: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      const a: [number, number] = [ring[i * 2] / q, ring[i * 2 + 1] / q];
      const j = (i + 1) % n;
      const b: [number, number] = [ring[j * 2] / q, ring[j * 2 + 1] / q];
      // Long edges are straight in degrees but curved on the sphere: add points along them.
      const pieces = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 4));
      for (let s = 0; s < pieces; s++) {
        const t = s / pieces;
        points.push(projectToDisc([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], GLOBE_CENTRE, 0));
      }
    }
    const count = points.length;
    const hidden = points.findIndex((p) => !p.visible);
    if (hidden === -1) {
      const path = new Path2D();
      points.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
      path.closePath();
      fills.push(path);
      shore.addPath(path);
      continue;
    }
    if (!points.some((p) => p.visible)) continue;
    // Walk the ring from a hidden point, collecting each visible stretch with the rim points either side.
    let run: { x: number; y: number }[] | null = null;
    for (let k = 1; k <= count; k++) {
      const p = points[(hidden + k) % count];
      const before = points[(hidden + k - 1) % count];
      if (p.visible) {
        if (!run) run = [before];
        run.push(p);
      } else if (run) {
        run.push(p);
        const path = new Path2D();
        run.forEach((v, i) => (i === 0 ? path.moveTo(v.x, v.y) : path.lineTo(v.x, v.y)));
        run.slice(1, -1).forEach((v, i) => (i === 0 ? shore.moveTo(v.x, v.y) : shore.lineTo(v.x, v.y)));
        const from = Math.atan2(p.y, p.x);
        const to = Math.atan2(run[0].y, run[0].x);
        const sweep = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        path.arc(0, 0, 1, from, to, sweep < 0);
        path.closePath();
        fills.push(path);
        run = null;
      }
    }
  }
  unitLandCache = { fills, shore };
  return unitLandCache;
}

/** A still globe of radius `r` centred on (cx, cy), in the colours of the direction's cover globe. */
export function drawGlobe(g: Ctx, cx: number, cy: number, r: number, assets: ArtAssets) {
  const look = GLOBE_LOOK[assets.direction];
  g.save();
  g.translate(cx, cy);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.clip();
  const ocean = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  ocean.addColorStop(0, look.ocean[0]);
  ocean.addColorStop(1, look.ocean[1]);
  g.fillStyle = ocean;
  g.fillRect(-r, -r, r * 2, r * 2);

  g.save();
  g.scale(r, r);
  const world = unitLand();
  g.fillStyle = look.land;
  for (const shape of world.fills) g.fill(shape);
  g.strokeStyle = look.shore;
  g.lineWidth = 0.9 / r;
  g.lineJoin = "round";
  g.globalAlpha = 0.6;
  g.stroke(world.shore);
  g.restore();

  // The sample traveler's province.
  const dot = projectToDisc(BOHOL, GLOBE_CENTRE, 0);
  const halo = g.createRadialGradient(dot.x * r, dot.y * r, 0, dot.x * r, dot.y * r, r * 0.16);
  halo.addColorStop(0, "rgba(255,255,255,0.55)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = halo;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.fillStyle = look.dot;
  g.beginPath();
  g.arc(dot.x * r, dot.y * r, Math.max(1.4, r * 0.035), 0, Math.PI * 2);
  g.fill();

  // Rim shade and a soft highlight make the disc a ball.
  const shade = g.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.35, 0, 0, r);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, look.shade);
  g.fillStyle = shade;
  g.fillRect(-r, -r, r * 2, r * 2);
  const shine = g.createRadialGradient(-r * 0.42, -r * 0.5, 0, -r * 0.42, -r * 0.5, r * 0.75);
  shine.addColorStop(0, look.shine);
  shine.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = shine;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Covers                                                              */
/* ------------------------------------------------------------------ */

/** Cover board: texture, lighting, spine crease. `spine` is the side the binding is on. */
function coverBoard(g: Ctx, w: number, h: number, assets: ArtAssets, spine: "left" | "right") {
  const { cover, radius } = assets.tokens;
  const outer = parseFloat(radius.passport) || 14;
  g.save();
  g.beginPath();
  if (spine === "left") g.roundRect(0, 0, w, h, [4, outer, outer, 4]);
  else g.roundRect(0, 0, w, h, [outer, 4, 4, outer]);
  g.clip();
  const base = g.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, cover.base);
  base.addColorStop(1, cover.deep);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  if (assets.cover) drawCover(g, assets.cover, 0, 0, w, h, [50, 50], 1.5);
  // A light from the upper left.
  const sheen = g.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.3, "rgba(255,255,255,0.03)");
  sheen.addColorStop(0.46, "rgba(0,0,0,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.22)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, w, h);
  // The spine: a rounded shoulder and the crease the board folds on.
  const sx = spine === "left" ? 0 : w;
  const dir = spine === "left" ? 1 : -1;
  const shoulder = g.createLinearGradient(sx, 0, sx + dir * 24, 0);
  shoulder.addColorStop(0, "rgba(0,0,0,0.42)");
  shoulder.addColorStop(0.22, "rgba(255,255,255,0.1)");
  shoulder.addColorStop(0.6, "rgba(0,0,0,0.3)");
  shoulder.addColorStop(0.72, "rgba(255,255,255,0.07)");
  shoulder.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = shoulder;
  g.fillRect(Math.min(sx, sx + dir * 24), 0, 24, h);
  g.restore();
}

function coverFrame(g: Ctx, w: number, h: number, assets: ArtAssets, spine: "left" | "right") {
  const x = spine === "left" ? 30 : 20;
  g.strokeStyle = foilStyle(g, assets, 0, 0, w, h);
  if (assets.tokens.cover.material === "kraft") {
    g.globalAlpha = 0.5;
    g.lineWidth = 0.8;
    g.setLineDash([3, 3]);
    roundRect(g, x, 20, w - 50, h - 40, 4);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    return;
  }
  g.lineWidth = 1.5;
  roundRect(g, x, 20, w - 50, h - 40, 5);
  g.stroke();
  g.lineWidth = 0.6;
  roundRect(g, x + 4.5, 24.5, w - 59, h - 49, 3);
  g.stroke();
}

function foilText(g: Ctx, assets: ArtAssets, text: string, x: number, y: number, w: number) {
  // Debossed: a dark edge below, a light one above, then the foil.
  const kraft = assets.tokens.cover.material === "kraft";
  if (!kraft) {
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillText(text, x + 0.4, y + 0.8);
  }
  g.fillStyle = foilStyle(g, assets, x - w / 2, y - 30, x + w / 2, y + 10);
  g.fillText(text, x, y);
}

export interface CoverFrontOptions {
  province: string;
  country: string;
  /** Small line under the globe. */
  line?: string;
}

export function drawCoverFront(g: Ctx, assets: ArtAssets, options: CoverFrontOptions, w: number = PAGE.w, h: number = PAGE.h) {
  const { fonts, tokens, direction } = assets;
  coverBoard(g, w, h, assets, "left");
  coverFrame(g, w, h, assets, "left");
  const cx = w / 2 + 5;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  g.fillStyle = foilStyle(g, assets, 60, 0, w - 60, 0);
  micro(g, assets, `${options.province}  ·  ${options.country}`, cx, 64, 7.8, "center", 0.34);

  g.textAlign = "center";
  if (direction === "reef") {
    g.font = `${tokens.type.displayWeight} 46px ${fonts.display}`;
    foilText(g, assets, "Island", cx, 114, 220);
    foilText(g, assets, "Passport", cx, 158, 220);
  } else {
    const size = direction === "journal" ? 34 : 33;
    const track = direction === "journal" ? 0.06 : 0.17;
    g.font = direction === "journal" ? `800 ${size}px ${fonts.display}` : `${tokens.type.stampWeight} ${size}px ${fonts.stamp}`;
    tracking(g, size * track);
    foilText(g, assets, "ISLAND", cx + (size * track) / 2, 112, 240);
    foilText(g, assets, "PASSPORT", cx + (size * track) / 2, 152, 240);
    tracking(g, 0);
  }

  // The globe in its ring.
  const gy = 276;
  const gr = 80;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.45)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 5;
  g.fillStyle = "rgba(0,0,0,0.5)";
  g.beginPath();
  g.arc(cx, gy, gr + 4, 0, Math.PI * 2);
  g.fill();
  g.restore();
  drawGlobe(g, cx, gy, gr, assets);
  g.strokeStyle = foilStyle(g, assets, cx - gr, gy - gr, cx + gr, gy + gr);
  g.lineWidth = 3.4;
  g.beginPath();
  g.arc(cx, gy, gr + 2.4, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(cx, gy, gr + 13, 0, Math.PI * 2);
  g.stroke();
  // Ticks and four compass points round the ring.
  g.fillStyle = g.strokeStyle;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    g.lineWidth = long ? 0.9 : 0.5;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (gr + 6.5), gy + Math.sin(a) * (gr + 6.5));
    g.lineTo(cx + Math.cos(a) * (gr + (long ? 11 : 9.5)), gy + Math.sin(a) * (gr + (long ? 11 : 9.5)));
    g.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const s = i % 2 === 0 ? 6.5 : 4;
    g.save();
    g.translate(cx + Math.cos(a) * (gr + 13), gy + Math.sin(a) * (gr + 13));
    g.rotate(a);
    g.beginPath();
    g.moveTo(s, 0);
    g.lineTo(0, s * 0.42);
    g.lineTo(-s, 0);
    g.lineTo(0, -s * 0.42);
    g.closePath();
    g.fill();
    g.restore();
  }

  g.fillStyle = foilStyle(g, assets, 60, 0, w - 60, 0);
  micro(g, assets, options.line ?? "Environmental stamps", cx, 398, 7.2, "center", 0.3);
  g.textAlign = "center";
  if (direction === "reef") {
    g.font = `${tokens.type.displayWeight} 24px ${fonts.display}`;
    foilText(g, assets, options.province, cx, 428, 160);
  } else {
    g.font = direction === "journal" ? `700 19px ${fonts.display}` : `${tokens.type.stampWeight} 19px ${fonts.stamp}`;
    tracking(g, 19 * 0.34);
    foilText(g, assets, options.province.toUpperCase(), cx + (19 * 0.34) / 2, 427, 160);
    tracking(g, 0);
  }

  // Partners, discreetly, along the foot.
  g.globalAlpha = 0.72;
  g.fillStyle = foilStyle(g, assets, 60, 0, w - 60, 0);
  micro(g, assets, strings.coverGlobe.partnersLabel, cx, 458, 5.6, "center", 0.3);
  for (let i = -1; i <= 1; i++) {
    g.save();
    g.translate(cx + i * 22, 470);
    g.rotate(Math.PI / 4);
    g.strokeStyle = g.fillStyle;
    g.lineWidth = 0.8;
    g.strokeRect(-3.2, -3.2, 6.4, 6.4);
    g.restore();
  }
  g.globalAlpha = 1;
}

export interface CoverBackOptions {
  /** Two short lines above the code. */
  heading: [string, string];
  charity: string;
  /** Short link printed under the code. */
  link: string;
  qrValue: string;
  /** 0 to 1: how far the QR panel has "landed" (scale and fade), for the film. Default 1. */
  reveal?: number;
}

/** Where the QR panel sits on the back cover, in page units. */
export const BACK_QR = { x: 77, y: 164, size: 196 } as const;

export function drawCoverBack(g: Ctx, assets: ArtAssets, options: CoverBackOptions, w: number = PAGE.w, h: number = PAGE.h) {
  const { fonts, tokens, direction } = assets;
  coverBoard(g, w, h, assets, "right");
  coverFrame(g, w, h, assets, "right");
  const cx = w / 2 - 5;
  g.textBaseline = "alphabetic";

  g.fillStyle = foilStyle(g, assets, 60, 0, w - 60, 0);
  micro(g, assets, strings.app.name, cx, 62, 7.4, "center", 0.34);

  g.textAlign = "center";
  if (direction === "classic") {
    g.font = `600 31px ${fonts.display}`;
  } else if (direction === "reef") {
    g.font = `${tokens.type.displayWeight} 29px ${fonts.display}`;
  } else {
    g.font = `800 27px ${fonts.display}`;
  }
  foilText(g, assets, options.heading[0], cx, 104, 260);
  foilText(g, assets, options.heading[1], cx, 138, 260);

  // The code on a paper label, so it scans whatever the cover is made of.
  const reveal = options.reveal ?? 1;
  const { size } = BACK_QR;
  const px = BACK_QR.x;
  const py = BACK_QR.y;
  if (reveal > 0) {
    g.save();
    g.translate(cx, py + size / 2);
    const s = 0.82 + 0.18 * reveal;
    g.scale(s, s);
    g.globalAlpha = Math.min(1, reveal * 1.6);
    g.translate(-cx, -(py + size / 2));
    g.save();
    g.shadowColor = "rgba(0,0,0,0.42)";
    g.shadowBlur = 16;
    g.shadowOffsetY = 7;
    g.fillStyle = "#fffdf6";
    roundRect(g, px, py, size, size, 16);
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(18,41,58,0.12)";
    g.lineWidth = 0.8;
    roundRect(g, px + 5, py + 5, size - 10, size - 10, 12);
    g.stroke();
    drawQr(g, options.qrValue, px + 10, py + 10, size - 20);
    g.restore();
  }

  g.textAlign = "center";
  g.font = displayFont(assets, 19, direction !== "journal");
  foilText(g, assets, options.charity, cx, 394, 260);
  // The link in a hairline pill.
  g.font = `500 9.4px ${fonts.mono}`;
  const linkW = Math.min(w - 76, g.measureText(options.link).width + 26);
  g.strokeStyle = foilStyle(g, assets, cx - linkW / 2, 0, cx + linkW / 2, 0);
  g.lineWidth = 0.8;
  roundRect(g, cx - linkW / 2, 408, linkW, 22, 11);
  g.stroke();
  g.fillStyle = foilStyle(g, assets, cx - linkW / 2, 0, cx + linkW / 2, 0);
  g.fillText(options.link, cx, 422.6, linkW - 14);

  g.globalAlpha = 0.72;
  micro(g, assets, "Sample  ·  fictional charity", cx, 466, 5.6, "center", 0.3);
  g.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Inside pages                                                        */
/* ------------------------------------------------------------------ */

export interface HolderPageOptions {
  holder: PassportHolder;
  province: string;
  progress: PassportProgress;
}

/** First page under the cover: who holds the passport and how far they are. */
export function drawHolderPage(g: Ctx, assets: ArtAssets, { holder, province, progress }: HolderPageOptions, w: number = PAGE.w, h: number = PAGE.h) {
  const { paper, chrome } = assets.tokens;
  const status = chrome.light.status;
  drawPaper(g, w, h, assets, parseFloat(assets.tokens.radius.page) || 10);
  drawGutter(g, h);
  pageChrome(g, w, h, assets, { left: strings.app.name, right: `Province of ${province}`, passportNo: holder.passportNo, pageNo: "01" });

  g.fillStyle = paper.inkMuted;
  micro(g, assets, "Holder", 26, 84, 7.2);
  g.fillStyle = paper.ink;
  g.textAlign = "left";
  g.font = displayFont(assets, 40);
  g.fillText(holder.name, 25, 124);
  g.fillStyle = paper.inkMuted;
  micro(g, assets, `${holder.passportNo}   ·   since Feb 2027`, 26, 144, 7.4, "left", 0.16);

  // The progress ring, one arc per status.
  const cx = w / 2;
  const cy = 280;
  const r = 78;
  g.lineWidth = 11;
  g.strokeStyle = paper.shade;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = paper.edge;
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(cx, cy, r + 5.5, 0, Math.PI * 2);
  g.moveTo(cx + r - 5.5, cy);
  g.arc(cx, cy, r - 5.5, 0, Math.PI * 2);
  g.stroke();
  let from = -Math.PI / 2;
  const gap = 0.05;
  g.lineWidth = 11;
  g.lineCap = "butt";
  for (const key of ["verified", "pending", "discovery"] as StampStatus[]) {
    const share = progress[key] / progress.total;
    if (share <= 0) continue;
    const to = from + share * Math.PI * 2;
    g.strokeStyle = status[key];
    g.beginPath();
    g.arc(cx, cy, r, from + gap / 2, to - gap / 2);
    g.stroke();
    from = to;
  }
  g.fillStyle = paper.ink;
  g.textAlign = "center";
  g.font = displayFont(assets, 66);
  g.fillText(String(progress.collected), cx, cy + 14);
  g.fillStyle = paper.inkMuted;
  micro(g, assets, `of ${progress.total} ${province} stamps`, cx, cy + 36, 7, "center", 0.16);

  // Legend.
  const rows: [StampStatus, string][] = [
    ["verified", strings.status.verified.label],
    ["pending", strings.status.pending.label],
    ["discovery", strings.status.discovery.label],
  ];
  let x = 34;
  g.font = `600 9.2px ${assets.fonts.body}`;
  g.textAlign = "left";
  for (const [key, label] of rows) {
    const text = `${progress[key]} ${label}`;
    g.fillStyle = status[key];
    g.beginPath();
    g.arc(x, 408.5, 3.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = paper.ink;
    g.fillText(text, x + 7.5, 412);
    x += g.measureText(text).width + 22;
  }

  // Machine-readable lines, for the passport feel.
  g.fillStyle = paper.inkMuted;
  g.globalAlpha = 0.7;
  g.font = `500 8.6px ${assets.fonts.mono}`;
  tracking(g, 1.3);
  const surname = holder.name.split(" ").slice(-1)[0].toUpperCase();
  const given = holder.name.split(" ")[0].toUpperCase();
  g.fillText(`P<PHL${surname}<<${given}<<<<<<<<<<<<<<<<<<<`.slice(0, 34), 26, 446);
  g.fillText(`${holder.passportNo.replace(/[^A-Z0-9]/gi, "")}<<<BOHOL<<<<<<<<<<<<<<<<<<<<<`.slice(0, 34), 26, 460);
  tracking(g, 0);
  g.globalAlpha = 1;
}

export interface SlotPlace {
  x: number;
  y: number;
  size: number;
}

/** Where an island page puts its stamp slots, in page units (centre and width). */
export function islandSlotLayout(count: number): SlotPlace[] {
  if (count <= 1) return [{ x: 180, y: 318, size: 212 }];
  if (count === 2)
    return [
      { x: 106, y: 264, size: 158 },
      { x: 250, y: 372, size: 158 },
    ];
  return [
    { x: 92, y: 252, size: 128 },
    { x: 264, y: 266, size: 128 },
    { x: 178, y: 388, size: 128 },
  ];
}

export interface IslandPageOptions {
  island: Island;
  slots: StampSlot[];
  /** "ISLAND 3 / 5". */
  index: number;
  total: number;
  passportNo: string;
  pageNo: string;
  /** Leave the stamps off (the film inks them in after the page lands). Default false. */
  bare?: boolean;
  /** A small print of the island, tucked in at the top of the page (where the real page has its map). */
  photo?: { photo: PhotoName; focus: [number, number] };
}

function slotCaption(g: Ctx, assets: ArtAssets, slot: StampSlot, place: SlotPlace) {
  const { paper, chrome } = assets.tokens;
  const y = place.y + place.size / 2 + 9;
  g.fillStyle = paper.ink;
  micro(g, assets, slot.title, place.x, y, 6.6, "center", 0.16);
  g.textAlign = "center";
  g.font = `700 8.4px ${assets.fonts.body}`;
  if (slot.stamp) {
    g.fillStyle = chrome.light.status[slot.stamp.status];
    g.fillText(strings.status[slot.stamp.status].label, place.x, y + 11);
  } else {
    g.fillStyle = paper.inkMuted;
    g.fillText(strings.stamp.empty, place.x, y + 11);
  }
}

/** One stamp, drawn where its slot is. Used by the page and, animated, by the film. */
export function drawSlotStamp(g: Ctx, assets: ArtAssets, stamp: Stamp, place: SlotPlace, options: { alpha?: number; scale?: number; seal?: number } = {}) {
  drawStamp(g, stamp, assets, place.x, place.y, place.size * (options.scale ?? 1), { alpha: options.alpha, seal: options.seal });
}

export function drawIslandPage(g: Ctx, assets: ArtAssets, options: IslandPageOptions, w: number = PAGE.w, h: number = PAGE.h) {
  const { paper } = assets.tokens;
  const { island, slots } = options;
  drawPaper(g, w, h, assets, parseFloat(assets.tokens.radius.page) || 10);
  drawGutter(g, h);
  pageChrome(g, w, h, assets, {
    left: `Province of ${island.province}`,
    right: `Island ${options.index} / ${options.total}`,
    passportNo: options.passportNo,
    pageNo: options.pageNo,
  });

  g.fillStyle = paper.ink;
  g.textAlign = "left";
  // The name gives way to the print beside it.
  const nameRoom = options.photo ? w - 24 - 142 : w - 48;
  let nameSize = 48;
  for (; nameSize > 26; nameSize -= 2) {
    g.font = displayFont(assets, nameSize);
    if (g.measureText(island.name).width <= nameRoom) break;
  }
  g.fillText(island.name, 24, 98);
  const held = slots.filter((s) => s.stamp).length;
  g.fillStyle = paper.inkMuted;
  micro(g, assets, `${held} of ${slots.length} stamps`, 26, 118, 7.4);

  g.fillStyle = paper.ink;
  g.font = assets.direction === "journal" ? `500 11.5px ${assets.fonts.stamp}` : displayFont(assets, 14.5, true);
  wrapLines(g, island.blurb, w - 56)
    .slice(0, 2)
    .forEach((line, i) => g.fillText(line, 26, 152 + i * 18));

  const print = options.photo ? assets.photos[options.photo.photo] : null;
  if (print && options.photo) {
    const pw = 96;
    const ph = 70;
    g.save();
    g.translate(w - 28 - pw / 2, 96);
    g.rotate((3.5 * Math.PI) / 180);
    g.shadowColor = "rgba(40,28,8,0.3)";
    g.shadowBlur = 7;
    g.shadowOffsetY = 2.5;
    g.fillStyle = "#fffdf7";
    g.fillRect(-pw / 2 - 4, -ph / 2 - 4, pw + 8, ph + 8);
    g.shadowColor = "transparent";
    g.beginPath();
    g.rect(-pw / 2, -ph / 2, pw, ph);
    g.clip();
    drawCover(g, print, -pw / 2, -ph / 2, pw, ph, options.photo.focus);
    g.restore();
  }

  const places = islandSlotLayout(slots.length);
  slots.forEach((slot, i) => {
    const place = places[i];
    if (!place) return;
    if (!slot.stamp) {
      // An empty slot: a faint dotted ring.
      g.save();
      g.strokeStyle = assets.tokens.ink.empty;
      g.globalAlpha = 0.6;
      g.lineWidth = 1.1;
      g.setLineDash([1.5, 4]);
      g.lineCap = "round";
      g.beginPath();
      g.arc(place.x, place.y, place.size * 0.44, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    } else if (!options.bare) {
      drawSlotStamp(g, assets, slot.stamp, place);
    }
    slotCaption(g, assets, slot, place);
  });
}

/** The back of a turned page: plain paper with a mirrored gutter and a faint show-through. */
export function drawPageBack(g: Ctx, assets: ArtAssets, w: number = PAGE.w, h: number = PAGE.h) {
  drawPaper(g, w, h, assets, parseFloat(assets.tokens.radius.page) || 10);
  g.save();
  g.translate(w, 0);
  g.scale(-1, 1);
  drawGutter(g, h, 40, 0.24);
  g.restore();
  const random = seeded(77);
  g.strokeStyle = assets.tokens.paper.inkMuted;
  g.globalAlpha = 0.07;
  g.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    g.beginPath();
    g.arc(w * (0.35 + random() * 0.3), h * (0.5 + i * 0.22 + random() * 0.05), 52 + random() * 12, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** Inside of the front cover: endpaper in the cover's colour, with a woven line pattern. */
export function drawEndpaper(g: Ctx, assets: ArtAssets, w: number = PAGE.w, h: number = PAGE.h) {
  const { cover, paper } = assets.tokens;
  g.save();
  roundRect(g, 0, 0, w, h, 6);
  g.clip();
  g.fillStyle = paper.base;
  g.fillRect(0, 0, w, h);
  const tint = g.createLinearGradient(0, 0, w, h);
  tint.addColorStop(0, cover.base);
  tint.addColorStop(1, cover.deep);
  g.globalAlpha = cover.material === "kraft" ? 0.5 : 0.82;
  g.fillStyle = tint;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.22;
  g.strokeStyle = cover.material === "kraft" ? cover.ink : assets.tokens.foil.base;
  g.lineWidth = 0.7;
  for (let y = -20; y < h + 40; y += 16) {
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const yy = y + 7 * Math.sin((x / 40) * Math.PI + k * Math.PI);
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.translate(w, 0);
  g.scale(-1, 1);
  drawGutter(g, h, 44, 0.34);
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Cards for the posts                                                 */
/* ------------------------------------------------------------------ */

export interface StampCardOptions {
  stamp: Stamp;
  status: StampStatus;
  province: string;
  passportNo: string;
  /** "ISLAND 3 / 5". */
  islandLabel: string;
}

/**
 * A crop of a passport page with one stamp pressed large in the middle. `h` is free: the stamp
 * takes what the header, its caption and the footer leave.
 */
export function drawStampCard(g: Ctx, assets: ArtAssets, options: StampCardOptions, w: number, h: number) {
  const { paper, chrome } = assets.tokens;
  const { stamp, status } = options;
  drawPaper(g, w, h, assets, parseFloat(assets.tokens.radius.page) || 10);
  pageChrome(g, w, h, assets, {
    left: `Province of ${options.province}`,
    right: options.islandLabel,
    passportNo: options.passportNo,
    pageNo: stamp.date ? stamp.date.slice(8, 10) : "",
  });
  const top = 56;
  const bottom = h - 40;
  const captionH = 30;
  const size = Math.min(w - 84, bottom - top - captionH);
  const cy = top + (bottom - top - captionH) / 2;
  drawStamp(g, stamp, assets, w / 2, cy, size, { status, rotate: -4 });
  const y = cy + size / 2 + 13;
  g.fillStyle = paper.ink;
  micro(g, assets, stamp.title, w / 2, y, 8, "center", 0.18);
  g.textAlign = "center";
  g.font = `700 10.5px ${assets.fonts.body}`;
  g.fillStyle = chrome.light.status[status];
  g.fillText(strings.status[status].label, w / 2, y + 14);
}

export interface IslandCardOptions {
  island: Island;
  slots: StampSlot[];
  passportNo: string;
  islandLabel: string;
}

/** A crop of an island page: the island's name and its stamps side by side. */
export function drawIslandCard(g: Ctx, assets: ArtAssets, options: IslandCardOptions, w: number, h: number) {
  const { paper, chrome } = assets.tokens;
  const { island, slots } = options;
  drawPaper(g, w, h, assets, parseFloat(assets.tokens.radius.page) || 10);
  pageChrome(g, w, h, assets, { left: `Province of ${island.province}`, right: options.islandLabel, passportNo: options.passportNo, pageNo: "" });
  g.fillStyle = paper.ink;
  g.textAlign = "left";
  g.font = displayFont(assets, island.name.length > 10 ? 38 : 46);
  g.fillText(island.name, 24, 96);
  const held = slots.filter((s) => s.stamp);
  g.fillStyle = paper.inkMuted;
  micro(g, assets, `${held.length} of ${slots.length} stamps collected`, 26, 115, 7.4);

  const shown = slots.slice(0, 3);
  const top = 128;
  const bottom = h - 40;
  const captionH = 28;
  const gapX = 10;
  const size = Math.min((w - 44 - gapX * (shown.length - 1)) / shown.length, bottom - top - captionH, 190);
  const total = size * shown.length + gapX * (shown.length - 1);
  const cy = top + (bottom - top - captionH) / 2;
  shown.forEach((slot, i) => {
    const cx = (w - total) / 2 + size / 2 + i * (size + gapX);
    const lift = shown.length > 1 ? (i % 2 === 0 ? -4 : 6) : 0;
    if (slot.stamp) {
      drawStamp(g, slot.stamp, assets, cx, cy + lift, size);
    } else {
      g.save();
      g.strokeStyle = assets.tokens.ink.empty;
      g.globalAlpha = 0.6;
      g.lineWidth = 1.1;
      g.setLineDash([1.5, 4]);
      g.lineCap = "round";
      g.beginPath();
      g.arc(cx, cy + lift, size * 0.44, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    const y = cy + size / 2 + 14;
    g.fillStyle = paper.ink;
    micro(g, assets, slot.title, cx, y, 6.2, "center", 0.14);
    g.textAlign = "center";
    g.font = `700 8.2px ${assets.fonts.body}`;
    g.fillStyle = slot.stamp ? chrome.light.status[slot.stamp.status] : paper.inkMuted;
    g.fillText(slot.stamp ? strings.status[slot.stamp.status].label : strings.stamp.empty, cx, y + 10.5);
  });
}
