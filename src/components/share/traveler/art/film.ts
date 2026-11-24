/**
 * The passport film (a concept, see docs/agents/p3-traveler.md): a 9:16 sequence drawn frame by
 * frame on a 2D canvas. The passport lies closed with the globe on its cover, opens, turns through
 * the islands the traveler holds stamps for (each stamp inks in as its page lands), closes, turns
 * over, and the back cover shows "Scan to help my charity" with the traveler's QR code.
 *
 * It is a pure function of time: `film.draw(ctx, seconds)` paints one frame. The player calls it
 * from requestAnimationFrame and the recorder calls the same function while a MediaRecorder
 * captures the canvas, so the saved video is the preview.
 *
 * The book is a static recreation (art/passport.ts), not the flip engine. Page turns are faked in
 * 2D: each leaf is cut into vertical strips that are placed and scaled with a simple perspective.
 */
import { getProgress } from "@/lib/sample-data";
import { SAMPLE_TRAVELER, shareDisplayUrl } from "@/lib/share";
import { strings } from "@/lib/strings";
import type { DirectionId, StampStatus } from "@/lib/types";
import { FEATURED_SLOT, ISLAND_PHOTO, heldIslands, travelerPassport } from "../data";
import { clamp, ctxOf, ease, lerp, loadAssets, makeCanvas, roundRect, span, tracking, type ArtAssets, type Ctx } from "./core";
import { BACK_QR, PAGE, drawCoverBack, drawCoverFront, drawEndpaper, drawHolderPage, drawIslandPage, drawPageBack, drawSlotStamp, islandSlotLayout } from "./passport";

export interface FilmSpec {
  direction: DirectionId;
  /** Status of the stamp the flow started from. */
  status: StampStatus;
  /** Share code: the link printed at the end. */
  code: string;
  /** What the QR code on the back cover encodes. */
  qrValue: string;
  /** "Scan to help my charity": whose name is printed under the code. Default the traveler's charity. */
  charity?: string;
}

export const FILM_SIZE = { width: 720, height: 1280 } as const;

export interface FilmChapter {
  id: "cover" | "open" | "islands" | "close" | "scan";
  label: string;
  /** Seconds from the start. */
  at: number;
}

export interface Film {
  /** Seconds. */
  duration: number;
  chapters: FilmChapter[];
  /** A good still: the back cover with the QR code. */
  posterAt: number;
  draw(ctx: Ctx, seconds: number): void;
}

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */

const W = FILM_SIZE.width;
const H = FILM_SIZE.height;
/** The closed book. */
const BW = 520;
const BH = 728;
const CX = W / 2;
const CY = 650;
/** Pages are a little smaller than the boards. */
const INSET = 7;
const PW = BW - INSET;
const PH = BH - INSET * 2;
/** Where the spine sits while the book lies open: the turned pages run off the left of the frame. */
const SPINE_OPEN = 112;
const SPINE_CLOSED = CX - BW / 2;
/** Camera distance for the fake perspective, in px. */
const DEPTH = 2300;
/** Textures are drawn larger than they are shown, so a leaf stays sharp while it swings. */
const TEX = 1.4;
const STRIPS = 44;

const INK = "#12293a";
const MUTED = "#4f6271";
const SEA_DEEP = "#06706d";
const SUN = "#ee8a5c";
const SUN_DEEP = "#ad4a25";

function texture(w: number, h: number, paint: (g: Ctx, uw: number, uh: number) => void): HTMLCanvasElement {
  const canvas = makeCanvas(w * TEX, h * TEX);
  const g = ctxOf(canvas);
  const scale = (w * TEX) / PAGE.w;
  g.scale(scale, scale);
  paint(g, PAGE.w, (h * TEX) / scale);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* Leaves                                                              */
/* ------------------------------------------------------------------ */

let leafLayer: HTMLCanvasElement | null = null;

interface LeafOptions {
  /** Texture seen while the leaf faces the viewer, and the one on its other side. */
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  /** Width and height of the leaf on stage, px. */
  w: number;
  h: number;
  /** 0 = lying on the right, PI = turned over to the left. */
  theta: number;
  /** "spine": hinged on its left edge at x. "centre": turning about its own middle at x. */
  pivot: "spine" | "centre";
  x: number;
  /** Vertical centre. */
  y: number;
  /** How far paper bends while it turns (0 = a rigid board). */
  curl?: number;
  scale?: number;
}

/** Draw one leaf in perspective. Returns the stage x of its free edge (for the shadow it casts). */
function drawLeaf(ctx: Ctx, o: LeafOptions): number {
  if (!leafLayer) leafLayer = makeCanvas(W, H);
  const layer = leafLayer;
  const g = ctxOf(layer);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);

  const scale = o.scale ?? 1;
  const w = o.w * scale;
  const h = o.h * scale;
  const curl = (o.curl ?? 0) * Math.sin(o.theta);
  const xs: number[] = [];
  const ps: number[] = [];
  const angles: number[] = [];
  let X = o.pivot === "spine" ? o.x : o.x - (w / 2) * Math.cos(o.theta);
  let Z = o.pivot === "spine" ? 0 : -(w / 2) * Math.sin(o.theta);
  for (let i = 0; i <= STRIPS; i++) {
    const u = i / STRIPS;
    // The free edge leads and the part by the spine lags, so the sheet bows as it goes over.
    const a = clamp(o.theta + curl * (u - 0.5), 0, Math.PI);
    const p = DEPTH / (DEPTH - Z);
    xs.push(CX + (X - CX) * p);
    ps.push(p);
    angles.push(a);
    X += (w / STRIPS) * Math.cos(a);
    Z += (w / STRIPS) * Math.sin(a);
  }

  for (let i = 0; i < STRIPS; i++) {
    const a = (angles[i] + angles[i + 1]) / 2;
    const facing = Math.cos(a) >= 0;
    const tex = facing ? o.front : o.back;
    const left = Math.min(xs[i], xs[i + 1]);
    const width = Math.abs(xs[i + 1] - xs[i]);
    if (width < 0.04) continue;
    const p = (ps[i] + ps[i + 1]) / 2;
    const dh = h * p;
    const u = facing ? i / STRIPS : 1 - (i + 1) / STRIPS;
    g.drawImage(tex, u * tex.width, 0, tex.width / STRIPS, tex.height, left - 0.35, o.y - dh / 2, width + 0.7, dh);
  }

  // Shade the leaf by how far it is tipped away from the light, in one pass over its own pixels.
  const from = Math.min(...xs);
  const to = Math.max(...xs);
  if (to - from > 1) {
    const shade = g.createLinearGradient(xs[0], 0, xs[STRIPS], 0);
    for (let k = 0; k <= 8; k++) {
      const i = Math.round((k / 8) * STRIPS);
      const a = angles[i];
      const facing = Math.cos(a) >= 0;
      const dark = (facing ? 0.4 : 0.26) * Math.pow(Math.sin(a), 1.3);
      shade.addColorStop(k / 8, `rgba(14,20,38,${dark.toFixed(3)})`);
    }
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = shade;
    g.fillRect(from - 1, 0, to - from + 2, H);
    g.globalCompositeOperation = "source-over";
  }
  ctx.drawImage(layer, 0, 0);
  return xs[STRIPS];
}

/** The soft shadow a lifted leaf throws on what lies under it. */
function castShadow(ctx: Ctx, spineX: number, edgeX: number, theta: number, top: number, height: number) {
  const strength = 0.3 * Math.sin(theta);
  if (strength < 0.01) return;
  const dir = edgeX >= spineX ? 1 : -1;
  const reach = edgeX + dir * (26 + 60 * Math.sin(theta));
  const grad = ctx.createLinearGradient(spineX, 0, reach, 0);
  grad.addColorStop(0, `rgba(14,20,38,${(strength * 0.55).toFixed(3)})`);
  grad.addColorStop(Math.min(0.92, Math.abs(edgeX - spineX) / Math.max(1, Math.abs(reach - spineX))), `rgba(14,20,38,${strength.toFixed(3)})`);
  grad.addColorStop(1, "rgba(14,20,38,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(Math.min(spineX, reach), top, Math.abs(reach - spineX), height);
}

/* ------------------------------------------------------------------ */
/* The film                                                            */
/* ------------------------------------------------------------------ */

interface PageBeat {
  /** When this page is the one lying open. */
  shown: number;
  /** When it starts to turn away (Infinity for the last page). */
  flip: number;
}

const FLIP = 0.58;

export async function createFilm(spec: FilmSpec): Promise<Film> {
  const passport = travelerPassport(spec.status);
  const progress = getProgress(passport);
  const islands = heldIslands(passport);
  const traveler = SAMPLE_TRAVELER;
  const arts = [...new Set(passport.slots.map((s) => s.art))];
  const photos = islands.flatMap((e) => (ISLAND_PHOTO[e.island.id] ? [ISLAND_PHOTO[e.island.id].photo] : []));
  const assets: ArtAssets = await loadAssets({ direction: spec.direction, arts, photos, photoWidth: 640 });
  const { fonts } = assets;
  const link = shareDisplayUrl(spec.code);
  const total = passport.islands.length;

  /* Textures. */
  const coverTex = texture(BW, BH, (g, uw, uh) => drawCoverFront(g, assets, { province: passport.province, country: passport.country }, uw, uh));
  const endpaperTex = texture(BW, BH, (g, uw, uh) => drawEndpaper(g, assets, uw, uh));
  const backOptions = { heading: ["Scan to help", "my charity"] as [string, string], charity: spec.charity ?? traveler.charity, link, qrValue: spec.qrValue };
  const backBare = texture(BW, BH, (g, uw, uh) => drawCoverBack(g, assets, { ...backOptions, reveal: 0 }, uw, uh));
  const backFull = texture(BW, BH, (g, uw, uh) => drawCoverBack(g, assets, backOptions, uw, uh));
  const pageBackTex = texture(PW, PH, (g, uw, uh) => drawPageBack(g, assets, uw, uh));
  const holderTex = texture(PW, PH, (g, uw, uh) => drawHolderPage(g, assets, { holder: passport.holder, province: passport.province, progress }, uw, uh));
  const islandPage = (i: number, bare: boolean) =>
    texture(PW, PH, (g, uw, uh) =>
      drawIslandPage(
        g,
        assets,
        { island: islands[i].island, slots: islands[i].slots, index: islands[i].index, total, passportNo: passport.holder.passportNo, pageNo: String(islands[i].index * 2 + 1).padStart(2, "0"), bare, photo: ISLAND_PHOTO[islands[i].island.id] },
        uw,
        uh,
      ),
    );
  const islandFull = islands.map((_, i) => islandPage(i, false));
  const islandBare = islands.map((_, i) => islandPage(i, true));
  /** Pages in the order they are seen: the holder page, then one per island. */
  const fullPages = [holderTex, ...islandFull];
  const barePages = [holderTex, ...islandBare];
  const featuredPage = 1 + islands.findIndex((e) => e.slots.some((s) => s.id === FEATURED_SLOT));

  /* Timeline. */
  const tOpen = 1.5;
  const tPages = tOpen + 0.95;
  const beats: PageBeat[] = [];
  let t = tPages;
  fullPages.forEach((_, i) => {
    const last = i === fullPages.length - 1;
    const hold = i === 0 ? 0.55 : i === featuredPage ? 1.25 : 0.72;
    beats.push({ shown: t, flip: last ? Infinity : t + hold });
    t += hold + (last ? 0 : FLIP);
  });
  const tClose = t;
  const tTurn = tClose + 0.9;
  const tScan = tTurn + 0.95;
  const tFade = tScan + 3.1;
  const duration = tFade + 0.45;
  const chapters: FilmChapter[] = [
    { id: "cover", label: "Cover", at: 0 },
    { id: "open", label: "Open", at: tOpen },
    { id: "islands", label: "Islands", at: beats[1]?.shown ?? tPages },
    { id: "close", label: "Close", at: tClose },
    { id: "scan", label: "Scan", at: tScan },
  ];

  /* Pieces of the scene. */

  const background = makeCanvas(W, H);
  {
    const g = ctxOf(background);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#dceffa");
    sky.addColorStop(0.42, "#eef7f8");
    sky.addColorStop(1, "#fdeedd");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(CX, CY, 60, CX, CY, 620);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.5, "rgba(255,255,255,0.35)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    const sea = g.createRadialGradient(W, 0, 0, W, 0, 620);
    sea.addColorStop(0, "rgba(95,240,228,0.2)");
    sea.addColorStop(1, "rgba(95,240,228,0)");
    g.fillStyle = sea;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(6,112,109,0.06)";
    g.lineWidth = 1.5;
    for (let r = 300; r < 1100; r += 70) {
      g.beginPath();
      g.arc(CX, CY, r, 0, Math.PI * 2);
      g.stroke();
    }
  }

  const groundShadow = (ctx: Ctx, cx: number, width: number, strength = 1) => {
    ctx.save();
    ctx.translate(cx, CY + BH / 2 + 22);
    ctx.scale(1, 0.085);
    const r = width * 0.62;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, `rgba(16,36,52,${0.34 * strength})`);
    grad.addColorStop(0.6, `rgba(16,36,52,${0.14 * strength})`);
    grad.addColorStop(1, "rgba(16,36,52,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    // And a soft pool of shade right under the book.
    // Only the blur is wanted, not the shape that casts it: the shape is drawn off the stage and
    // its shadow is thrown back onto it.
    const away = W * 3;
    ctx.save();
    ctx.shadowColor = `rgba(16,36,52,${0.3 * strength})`;
    ctx.shadowBlur = 46;
    ctx.shadowOffsetX = away;
    ctx.shadowOffsetY = 22;
    ctx.fillStyle = "#000";
    roundRect(ctx, cx - width / 2 + 14 - away, CY - BH / 2 + 30, width - 28, BH - 50, 16);
    ctx.fill();
    ctx.restore();
  };

  const flat = (ctx: Ctx, tex: HTMLCanvasElement, x: number, w: number, h: number) => ctx.drawImage(tex, x, CY - h / 2, w, h);

  /** The right-hand side of the open book: back board, the block of pages, the page on top. */
  const rightStack = (ctx: Ctx, spineX: number, top: HTMLCanvasElement) => {
    ctx.fillStyle = assets.tokens.cover.deep;
    ctx.beginPath();
    ctx.roundRect(spineX - 3, CY - BH / 2, BW + 3, BH, [3, 14, 14, 3]);
    ctx.fill();
    ctx.fillStyle = assets.tokens.paper.edge;
    for (let i = 2; i >= 1; i--) {
      ctx.globalAlpha = 0.9;
      roundRect(ctx, spineX, CY - PH / 2 + i * 1.6, PW + i * 1.6, PH, 8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    flat(ctx, top, spineX, PW, PH);
  };

  /** The left-hand side: the inside of the front cover, and the backs of the pages turned so far. */
  const leftStack = (ctx: Ctx, spineX: number, turned: number) => {
    flat(ctx, endpaperTex, spineX - BW, BW, BH);
    if (turned > 0) flat(ctx, pageBackTex, spineX - PW, PW, PH);
    const gutter = ctx.createLinearGradient(spineX - 26, 0, spineX + 4, 0);
    gutter.addColorStop(0, "rgba(14,20,38,0)");
    gutter.addColorStop(1, "rgba(14,20,38,0.26)");
    ctx.fillStyle = gutter;
    ctx.fillRect(spineX - 26, CY - BH / 2, 30, BH);
  };

  /** Stamps inking in on the page that has just landed. `since` = seconds since it landed. */
  const inkStamps = (ctx: Ctx, pageIndex: number, spineX: number, since: number) => {
    if (pageIndex === 0) return;
    const entry = islands[pageIndex - 1];
    const places = islandSlotLayout(entry.slots.length);
    const k = PW / PAGE.w;
    ctx.save();
    ctx.translate(spineX, CY - PH / 2);
    ctx.scale(k, k);
    let order = 0;
    entry.slots.forEach((slot, i) => {
      if (!slot.stamp || !places[i]) return;
      const featured = slot.id === FEATURED_SLOT;
      const start = 0.06 + order * 0.2 + (featured ? 0.12 : 0);
      order++;
      const p = span(since, start, start + 0.3);
      if (p <= 0) return;
      const e = ease.out(p);
      if (featured && p < 1) {
        // The new stamp lands harder: a ring of the traveler's colour goes out from it.
        ctx.strokeStyle = SUN;
        ctx.globalAlpha = (1 - p) * 0.7;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(places[i].x, places[i].y, places[i].size * (0.5 + 0.35 * e), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const sealAt = span(since, start + 0.26, start + 0.56);
      drawSlotStamp(ctx, assets, slot.stamp, places[i], { alpha: e, scale: lerp(featured ? 1.5 : 1.28, 1, e), seal: sealAt > 0 ? ease.back(sealAt) : 0 });
    });
    ctx.restore();
  };

  const centred = (ctx: Ctx, text: string, y: number, font: string, color: string, alpha: number, track = 0) => {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    tracking(ctx, track);
    ctx.fillText(text, CX + track / 2, y);
    tracking(ctx, 0);
    ctx.restore();
  };

  const pill = (ctx: Ctx, text: string, y: number, alpha: number, dot: string | null, rise = 0) => {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(0, rise);
    ctx.font = `600 27px ${fonts.sans}`;
    const tw = ctx.measureText(text).width;
    const w = tw + (dot ? 78 : 56);
    ctx.shadowColor = "rgba(16,36,52,0.16)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, CX - w / 2, y - 30, w, 60, 30);
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (dot) {
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(CX - w / 2 + 32, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, CX - w / 2 + (dot ? 52 : 28), y + 1.5);
    ctx.restore();
  };

  const stampWord = (n: number) => (n === 1 ? "1 stamp" : `${n} stamps`);

  function draw(ctx: Ctx, seconds: number) {
    const time = clamp(seconds, 0, duration);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(background, 0, 0);

    const top = CY - BH / 2;

    if (time < tOpen) {
      /* Closed, face up. */
      const enter = ease.out(span(time, 0, 0.6));
      const drift = Math.sin(time * 1.6) * 3;
      ctx.save();
      ctx.globalAlpha = enter;
      ctx.translate(0, (1 - enter) * 34 + drift);
      groundShadow(ctx, CX, BW, enter);
      flat(ctx, coverTex, SPINE_CLOSED, BW, BH);
      // One pass of light across the foil.
      const g = span(time, 0.55, 1.35);
      if (g > 0 && g < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(SPINE_CLOSED, top, BW, BH, [4, 16, 16, 4]);
        ctx.clip();
        ctx.globalCompositeOperation = "lighter";
        const x = SPINE_CLOSED - 220 + (BW + 440) * ease.inOut(g);
        const band = ctx.createLinearGradient(x - 110, 0, x + 110, 0);
        band.addColorStop(0, "rgba(255,255,255,0)");
        band.addColorStop(0.5, "rgba(255,246,220,0.2)");
        band.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = band;
        ctx.transform(1, 0, -0.3, 1, 180, 0);
        ctx.fillRect(x - 110, top - 40, 220, BH + 80);
        ctx.restore();
      }
      ctx.restore();
    } else if (time < tPages) {
      /* The cover swings open and the book slides right to make room. */
      const e = ease.inOut(span(time, tOpen, tPages));
      const spineX = lerp(SPINE_CLOSED, SPINE_OPEN, e);
      const theta = e * Math.PI;
      groundShadow(ctx, lerp(CX, spineX, e), lerp(BW, BW * 1.7, e));
      rightStack(ctx, spineX, barePages[0]);
      const edge = spineX + BW * Math.cos(theta);
      castShadow(ctx, spineX, edge, theta, top, BH);
      drawLeaf(ctx, { front: coverTex, back: endpaperTex, w: BW, h: BH, theta, pivot: "spine", x: spineX, y: CY });
    } else if (time < tClose) {
      /* Turning through the pages. */
      let index = 0;
      for (let i = 0; i < beats.length; i++) if (time >= beats[i].shown) index = i;
      const beat = beats[index];
      const turning = time >= beat.flip;
      groundShadow(ctx, SPINE_OPEN, BW * 1.7);
      leftStack(ctx, SPINE_OPEN, index);
      if (!turning) {
        const since = time - beat.shown;
        // The stamps press in, and the page takes each hit.
        const thump = index > 0 ? Math.max(0, 1 - Math.abs(since - 0.2) / 0.12) * 1.6 : 0;
        ctx.save();
        ctx.translate(0, thump);
        rightStack(ctx, SPINE_OPEN, barePages[index]);
        inkStamps(ctx, index, SPINE_OPEN, since);
        ctx.restore();
      } else {
        const e = ease.inOut(span(time, beat.flip, beat.flip + FLIP));
        const theta = e * Math.PI;
        rightStack(ctx, SPINE_OPEN, barePages[index + 1] ?? barePages[index]);
        const edge = SPINE_OPEN + PW * Math.cos(theta);
        castShadow(ctx, SPINE_OPEN, edge, theta, CY - PH / 2, PH);
        drawLeaf(ctx, { front: fullPages[index], back: pageBackTex, w: PW, h: PH, theta, pivot: "spine", x: SPINE_OPEN, y: CY, curl: 0.95 });
      }
    } else if (time < tTurn) {
      /* The cover comes back over and the book slides to the middle again. */
      const e = ease.inOut(span(time, tClose, tTurn));
      const spineX = lerp(SPINE_OPEN, SPINE_CLOSED, e);
      const theta = (1 - e) * Math.PI;
      groundShadow(ctx, lerp(SPINE_OPEN + BW * 0.15, CX, e), lerp(BW * 1.3, BW, e));
      rightStack(ctx, spineX, fullPages[fullPages.length - 1]);
      const edge = spineX + BW * Math.cos(theta);
      castShadow(ctx, spineX, edge, theta, top, BH);
      drawLeaf(ctx, { front: coverTex, back: pageBackTex, w: BW, h: BH, theta, pivot: "spine", x: spineX, y: CY });
    } else if (time < tScan) {
      /* The closed passport turns over. */
      const e = ease.inOut(span(time, tTurn, tScan));
      const lift = Math.sin(e * Math.PI);
      groundShadow(ctx, CX, BW * (1 - 0.45 * lift), 1 - 0.35 * lift);
      drawLeaf(ctx, { front: coverTex, back: backBare, w: BW, h: BH, theta: e * Math.PI, pivot: "centre", x: CX, y: CY - lift * 16, scale: 1 + 0.05 * lift });
    } else {
      /* Back cover: the code lands on it. */
      const since = time - tScan;
      const drift = Math.sin(since * 1.5) * 2.5;
      ctx.save();
      ctx.translate(0, drift);
      groundShadow(ctx, CX, BW);
      flat(ctx, backBare, SPINE_CLOSED, BW, BH);
      const reveal = span(since, 0.12, 0.62);
      if (reveal > 0) {
        // The label with the code, cut from the finished back cover and pressed on.
        const k = BW / PAGE.w;
        const margin = 30;
        const sx = BACK_QR.x - margin;
        const sy = BACK_QR.y - margin;
        const size = BACK_QR.size + margin * 2;
        const cx = SPINE_CLOSED + (sx + size / 2) * k;
        const cy = top + (sy + size / 2) * k;
        const s = lerp(1.22, 1, ease.back(reveal));
        const texK = backFull.width / PAGE.w;
        ctx.save();
        ctx.globalAlpha = Math.min(1, reveal * 2.2);
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.drawImage(backFull, sx * texK, sy * texK, size * texK, size * texK, (-size * k) / 2, (-size * k) / 2, size * k, size * k);
        ctx.restore();
      }
      // Corner brackets that breathe, the way a scanner frames a code.
      const pulse = span(since, 0.8, 1.2);
      if (pulse > 0) {
        const k = BW / PAGE.w;
        const breathe = 1 + 0.018 * Math.sin((since - 0.8) * 3.4);
        const half = ((BACK_QR.size / 2 + 12) * k) * breathe;
        const cx = SPINE_CLOSED + (BACK_QR.x + BACK_QR.size / 2) * k;
        const cy = top + (BACK_QR.y + BACK_QR.size / 2) * k;
        ctx.save();
        ctx.globalAlpha = pulse * 0.95;
        ctx.strokeStyle = SUN;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const arm = 30;
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          ctx.beginPath();
          ctx.moveTo(cx + dx * half, cy + dy * (half - arm));
          ctx.arcTo(cx + dx * half, cy + dy * half, cx + dx * (half - arm), cy + dy * half, 12);
          ctx.lineTo(cx + dx * (half - arm), cy + dy * half);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    }

    /* Words. */
    const kick = ease.out(span(time, 0.1, 0.6));
    ctx.save();
    ctx.globalAlpha = kick;
    ctx.strokeStyle = SEA_DEEP;
    ctx.lineWidth = 2.6;
    const mark = { x: CX - 132, y: 92, r: 14 };
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, mark.r, 0, Math.PI * 2);
    ctx.moveTo(mark.x - mark.r, mark.y);
    ctx.lineTo(mark.x + mark.r, mark.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(mark.x, mark.y, mark.r * 0.42, mark.r, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `700 19px ${fonts.sans}`;
    ctx.fillStyle = SEA_DEEP;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    tracking(ctx, 4.4);
    ctx.fillText(strings.app.name.toUpperCase(), mark.x + 28, mark.y + 1.5);
    tracking(ctx, 0);
    ctx.restore();

    const headFont = `400 62px ${fonts.serif}`;
    const subFont = `500 25px ${fonts.sans}`;
    const first = traveler.name.split(" ")[0];
    const aCover = Math.min(ease.out(span(time, 0.2, 0.75)), 1 - span(time, tPages + 0.1, tPages + 0.45));
    centred(ctx, "My Island Passport", 178, headFont, INK, aCover);
    centred(ctx, `${first} · ${traveler.socialHandle}`, 220, subFont, MUTED, aCover);
    const aPages = Math.min(span(time, tPages + 0.4, tPages + 0.8), 1 - span(time, tTurn + 0.1, tTurn + 0.45));
    centred(ctx, `${stampWord(progress.collected)}, ${islands.length} islands`, 178, headFont, INK, aPages);
    centred(ctx, `Every stamp supports an island charity`, 220, subFont, MUTED, aPages);
    const aScan = span(time, tScan - 0.15, tScan + 0.3);
    centred(ctx, "Help the islands I love", 178, headFont, INK, aScan);
    centred(ctx, `Scan the code on the back of my passport`, 220, subFont, MUTED, aScan);

    // Bottom line: who, then where the pages are, then the link.
    const py = 1112;
    pill(ctx, `${stampWord(progress.collected)} across ${passport.province}`, py, Math.min(ease.out(span(time, 0.5, 1)), 1 - span(time, beats[1].shown - 0.4, beats[1].shown - 0.15)), SUN);
    for (let i = 1; i < beats.length; i++) {
      const entry = islands[i - 1];
      const held = entry.slots.filter((s) => s.stamp).length;
      const until = i === beats.length - 1 ? tClose + 0.25 : beats[i + 1].shown - 0.25;
      const a = Math.min(span(time, beats[i].shown - 0.12, beats[i].shown + 0.16), 1 - span(time, until, until + 0.2));
      const isNew = i === featuredPage;
      pill(ctx, `${entry.island.name} · ${isNew ? "new stamp" : stampWord(held)}`, py, a, isNew ? SUN : SEA_DEEP, (1 - ease.out(span(time, beats[i].shown - 0.12, beats[i].shown + 0.2))) * 10);
    }
    const aLink = ease.out(span(time, tScan + 0.6, tScan + 1.05));
    pill(ctx, link, py, aLink, null, (1 - aLink) * 12);
    centred(ctx, "SAMPLE CONCEPT · FICTIONAL CHARITY", 1218, `600 15px ${fonts.sans}`, SUN_DEEP, 0.75 * kick, 2.4);

    /* Out, so the loop starts clean. */
    const out = span(time, tFade, duration);
    if (out > 0) {
      ctx.save();
      ctx.globalAlpha = ease.inOut(out);
      ctx.drawImage(background, 0, 0);
      ctx.restore();
    }
  }

  return { duration, chapters, posterAt: tScan + 2.2, draw };
}

/* ------------------------------------------------------------------ */
/* Saving it as a video (a bonus where the browser can)                */
/* ------------------------------------------------------------------ */

const VIDEO_TYPES = [
  { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
  { mime: "video/webm;codecs=vp9", ext: "webm" },
  { mime: "video/webm;codecs=vp8", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
] as const;

/** The container this browser can record a canvas into, or null when it cannot. */
export function recordingSupport(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  if (typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  for (const type of VIDEO_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(type.mime)) return type;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

export interface Recording {
  blob: Blob;
  ext: "mp4" | "webm";
}

/**
 * Play the film once into a hidden canvas and record it. It runs in real time, so it takes as long
 * as the film. Rejects when the browser cannot record a canvas.
 */
export function recordFilm(film: Film, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<Recording> {
  const support = recordingSupport();
  if (!support) return Promise.reject(new Error("This browser cannot record a canvas"));
  return new Promise((resolve, reject) => {
    const canvas = makeCanvas(W, H);
    const ctx = ctxOf(canvas);
    film.draw(ctx, 0);
    // Frames are handed over one by one as they are drawn where the browser allows it, so the video
    // has exactly the frames that were painted; otherwise the stream samples the canvas itself.
    let stream = canvas.captureStream(0);
    let track = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
    if (!track || typeof track.requestFrame !== "function") {
      stream = canvas.captureStream(30);
      track = undefined;
    }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: support.mime, videoBitsPerSecond: 6_000_000 });
    } catch (error) {
      reject(error);
      return;
    }
    const chunks: Blob[] = [];
    let frame = 0;
    let failed: unknown = null;
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onerror = (e) => {
      failed = (e as unknown as { error?: unknown }).error ?? new Error("Recording failed");
    };
    recorder.onstop = () => {
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((track) => track.stop());
      if (signal?.aborted) reject(new DOMException("Recording cancelled", "AbortError"));
      else if (failed || !chunks.length) reject(failed ?? new Error("Nothing was recorded"));
      else resolve({ blob: new Blob(chunks, { type: support.mime.split(";")[0] }), ext: support.ext });
    };
    signal?.addEventListener("abort", () => recorder.state !== "inactive" && recorder.stop(), { once: true });
    recorder.start(250);
    const started = performance.now();
    // The last frame is held a moment so the code is on screen when a player stops on it.
    const end = film.duration - 0.5;
    const tick = () => {
      const seconds = (performance.now() - started) / 1000;
      film.draw(ctx, Math.min(seconds, end));
      track?.requestFrame?.();
      onProgress?.(Math.min(1, seconds / (end + 0.4)));
      if (seconds >= end + 0.4) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });
}

/** One frame of the film as a PNG (the back cover with the code): the still that goes with the video. */
export async function filmPoster(spec: FilmSpec): Promise<Blob> {
  const film = await createFilm(spec);
  const canvas = makeCanvas(W, H);
  film.draw(ctxOf(canvas), film.posterAt);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/png"));
}
