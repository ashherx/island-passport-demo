/**
 * The traveler's generated post, drawn on a canvas: a story (1080 x 1920) or a feed post
 * (1080 x 1350). Island photo on top, the traveler's own headline, then what they chose to share
 * (the stamp large on a passport page, the island's page, or the passport itself) in their art
 * direction, and a panel with "Scan to help my charity", the QR code and the personal link.
 *
 * The preview on screen is this same canvas, so the saved PNG is exactly what was previewed.
 */
import { drawQr } from "@/components/share/kit/render";
import { getProgress } from "@/lib/sample-data";
import { SAMPLE_TRAVELER, shareDisplayUrl } from "@/lib/share";
import { strings } from "@/lib/strings";
import type { DirectionId, StampStatus } from "@/lib/types";
import { featuredStamp, heldIslands, photoFor, travelerPassport, type ShareSubject } from "../data";
import { canvasToBlob, ctxOf, drawCover, fitText, loadAssets, makeCanvas, roundRect, tracking, wrapLines, type ArtAssets, type Ctx } from "./core";
import { PAGE, drawCoverFront, drawIslandCard, drawIslandPage, drawStampCard } from "./passport";

export interface PostSpec {
  format: "story" | "feed";
  subject: ShareSubject;
  direction: DirectionId;
  /** Status of the stamp the flow started from. Decides what the artwork may claim. */
  status: StampStatus;
  /** Island of the island page (and of the photo). */
  islandId: string;
  headline: string;
  /** Share code printed as the link. */
  code: string;
  /** What the QR code encodes. */
  qrValue: string;
}

export const POST_SIZE = { story: { width: 1080, height: 1920 }, feed: { width: 1080, height: 1350 } } as const;

const INK = "#12293a";
const SUN_DEEP = "#ad4a25";
const SEA_DEEP = "#06706d";

interface Layout {
  W: number;
  H: number;
  pad: number;
  /** Room the story's own chrome covers, top and bottom. */
  safeT: number;
  safeB: number;
  photoH: number;
  headSize: number;
  /** Baseline of the last headline line. */
  headBottom: number;
  card: { cx: number; cy: number; w: number; h: number; rot: number };
  panelH: number;
}

const LAYOUT: Record<PostSpec["format"], Layout> = {
  story: { W: 1080, H: 1920, pad: 64, safeT: 190, safeB: 230, photoH: 1030, headSize: 100, headBottom: 606, card: { cx: 540, cy: 982, w: 690, h: 662, rot: -3.5 }, panelH: 270 },
  feed: { W: 1080, H: 1350, pad: 56, safeT: 0, safeB: 0, photoH: 730, headSize: 90, headBottom: 398, card: { cx: 540, cy: 728, w: 640, h: 530, rot: -3 }, panelH: 250 },
};

function brandMark(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.42, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Draw `paint` (in page units, 360 wide) on its own sheet, then lay the sheet down tilted with a shadow. */
function sheet(ctx: Ctx, cx: number, cy: number, w: number, h: number, rot: number, paint: (g: Ctx, uw: number, uh: number) => void, shadow = 0.34) {
  const scale = w / PAGE.w;
  const layer = makeCanvas(w, h);
  const g = ctxOf(layer);
  g.scale(scale, scale);
  paint(g, PAGE.w, h / scale);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.shadowColor = `rgba(14,34,48,${shadow})`;
  ctx.shadowBlur = w * 0.11;
  ctx.shadowOffsetY = w * 0.05;
  ctx.drawImage(layer, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function drawPost(ctx: Ctx, spec: PostSpec, assets: ArtAssets) {
  const L = LAYOUT[spec.format];
  const { W, H, pad } = L;
  const { fonts } = assets;
  const traveler = SAMPLE_TRAVELER;
  const passport = travelerPassport(spec.status);
  const stamp = featuredStamp(passport);
  const progress = getProgress(passport);
  const islands = heldIslands(passport);
  const entry = islands.find((e) => e.island.id === spec.islandId) ?? islands.find((e) => e.island.id === stamp.islandId) ?? islands[0];
  const picture = photoFor(spec.subject, entry.island.id);
  const photo = assets.photos[picture.photo];

  /* Ground: daylight below the photo. */
  const ground = ctx.createLinearGradient(0, L.photoH - 200, 0, H);
  ground.addColorStop(0, "#e3f3f6");
  ground.addColorStop(0.55, "#f4f4ec");
  ground.addColorStop(1, "#fdeede");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);

  /* Photo, then its lower edge dissolves into the ground. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, L.photoH);
  ctx.clip();
  ctx.fillStyle = "#2b5a6e";
  ctx.fillRect(0, 0, W, L.photoH);
  if (photo) drawCover(ctx, photo, 0, 0, W, L.photoH, picture.focus);
  const top = ctx.createLinearGradient(0, 0, 0, L.photoH * 0.72);
  top.addColorStop(0, "rgba(8,26,38,0.62)");
  top.addColorStop(0.55, "rgba(8,26,38,0.3)");
  top.addColorStop(1, "rgba(8,26,38,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, L.photoH);
  const fade = ctx.createLinearGradient(0, L.photoH - 300, 0, L.photoH);
  fade.addColorStop(0, "rgba(227,243,246,0)");
  fade.addColorStop(0.7, "rgba(227,243,246,0.82)");
  fade.addColorStop(1, "rgba(227,243,246,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, L.photoH - 300, W, 300);
  ctx.restore();

  /* Soft rings on the ground, like the lines of a chart. */
  ctx.save();
  ctx.strokeStyle = "rgba(6,112,109,0.07)";
  ctx.lineWidth = 2;
  for (let r = 320; r < 1500; r += 104) {
    ctx.beginPath();
    ctx.arc(W * 0.5, H + 420, r, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  /* Kicker: brand on the left, the traveler on the right. */
  const ky = L.safeT + (spec.format === "story" ? 56 : pad + 22);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  brandMark(ctx, pad + 22, ky, 22, "#fff");
  ctx.font = `700 28px ${fonts.sans}`;
  tracking(ctx, 5);
  ctx.fillText(strings.app.name.toUpperCase(), pad + 60, ky + 2);
  tracking(ctx, 0);
  ctx.textAlign = "right";
  ctx.font = `600 30px ${fonts.sans}`;
  ctx.fillText(traveler.socialHandle, W - pad, ky + 2);

  /* Headline, stacked up from just above the card. */
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(8,26,38,0.5)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 3;
  let size = L.headSize;
  let lines: string[] = [];
  for (; size >= L.headSize * 0.72; size -= 6) {
    ctx.font = `400 ${size}px ${fonts.serif}`;
    lines = wrapLines(ctx, spec.headline || " ", W - pad * 2);
    if (lines.length <= 3) break;
  }
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
    lines[2] = `${lines[2].replace(/[\s,.;:]+$/, "")}…`;
  }
  let y = L.headBottom;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], pad, y);
    y -= size * 1.02;
  }
  ctx.font = `italic 400 ${Math.round(size * 0.52)}px ${fonts.serif}`;
  const place = spec.subject === "passport" ? `${traveler.name}'s passport` : `${entry.island.name}, ${passport.province}`;
  ctx.fillText(place, pad + 2, y + size * 0.01);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  /* What is being shared. */
  const c = L.card;
  const islandLabel = `Island ${entry.index} / ${passport.islands.length}`;
  if (spec.subject === "stamp") {
    sheet(ctx, c.cx, c.cy, c.w, c.h, c.rot, (g, uw, uh) =>
      drawStampCard(g, assets, { stamp, status: spec.status, province: passport.province, passportNo: passport.holder.passportNo, islandLabel }, uw, uh),
    );
  } else if (spec.subject === "island") {
    sheet(ctx, c.cx, c.cy, c.w, c.h, c.rot, (g, uw, uh) =>
      drawIslandCard(g, assets, { island: entry.island, slots: entry.slots, passportNo: passport.holder.passportNo, islandLabel }, uw, uh),
    );
  } else {
    // The passport: a page of stamps peeking out from behind the cover.
    const ph = c.h * 1.04;
    const pw = ph * (PAGE.w / PAGE.h);
    const page = islands.find((e) => e.island.id === stamp.islandId) ?? entry;
    sheet(
      ctx,
      c.cx + pw * 0.4,
      c.cy + 4,
      pw,
      ph,
      7,
      (g) => drawIslandPage(g, assets, { island: page.island, slots: page.slots, index: page.index, total: passport.islands.length, passportNo: passport.holder.passportNo, pageNo: "05" }),
      0.26,
    );
    sheet(ctx, c.cx - pw * 0.34, c.cy, pw, ph, -5, (g) => drawCoverFront(g, assets, { province: passport.province, country: passport.country }), 0.4);
    // How far the passport has come, on a pill across the two.
    const label = `${progress.collected} of ${progress.total} ${passport.province} stamps`;
    ctx.font = `700 34px ${fonts.sans}`;
    const pillW = ctx.measureText(label).width + 86;
    const px = c.cx - pillW / 2 + 20;
    const py = c.cy + ph / 2 - 62;
    ctx.save();
    ctx.shadowColor = "rgba(14,34,48,0.3)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#fff";
    roundRect(ctx, px, py, pillW, 72, 36);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#ee8a5c";
    ctx.beginPath();
    ctx.arc(px + 38, py + 36, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, px + 62, py + 38);
    ctx.textBaseline = "alphabetic";
  }

  /* The QR panel. */
  const panelY = H - L.safeB - pad - L.panelH - (spec.format === "story" ? 34 : 0);
  ctx.save();
  ctx.shadowColor = "rgba(14,34,48,0.2)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, pad, panelY, W - pad * 2, L.panelH, 54);
  ctx.fill();
  ctx.restore();
  const qr = L.panelH - 40;
  drawQr(ctx, spec.qrValue, pad + 20, panelY + 20, qr);
  const tx = pad + 20 + qr + 30;
  const tw = W - pad - tx - 36;
  ctx.textAlign = "left";
  ctx.fillStyle = SUN_DEEP;
  ctx.font = `700 25px ${fonts.sans}`;
  tracking(ctx, 3.6);
  ctx.fillText(fitText(ctx, "SCAN TO HELP MY CHARITY", tw), tx, panelY + 70);
  tracking(ctx, 0);
  ctx.fillStyle = INK;
  const charity = spec.subject === "island" ? (entry.slots.find((s) => s.stamp)?.stamp?.charity ?? traveler.charity) : traveler.charity;
  let nameSize = 66;
  ctx.font = `400 ${nameSize}px ${fonts.serif}`;
  let nameLines = wrapLines(ctx, charity, tw);
  if (nameLines.length > 1) {
    nameSize = 52;
    ctx.font = `400 ${nameSize}px ${fonts.serif}`;
    nameLines = wrapLines(ctx, charity, tw).slice(0, 2);
  }
  const nameTop = panelY + (nameLines.length > 1 ? 126 : 146);
  nameLines.forEach((line, i) => ctx.fillText(fitText(ctx, line, tw), tx, nameTop + i * nameSize * 1.04));
  ctx.font = `700 30px ${fonts.sans}`;
  ctx.fillStyle = SEA_DEEP;
  ctx.fillText(fitText(ctx, shareDisplayUrl(spec.code), tw), tx, panelY + L.panelH - 40);
}

/** Everything a post needs, loaded and cached. */
export function loadPostAssets(spec: Pick<PostSpec, "direction" | "status" | "subject" | "islandId">): Promise<ArtAssets> {
  const passport = travelerPassport(spec.status);
  const arts = [...new Set(passport.slots.map((s) => s.art))];
  return loadAssets({ direction: spec.direction, arts, photos: [photoFor(spec.subject, spec.islandId).photo] });
}

/** Size the canvas for the format and draw the post on it. */
export async function renderPost(canvas: HTMLCanvasElement, spec: PostSpec): Promise<void> {
  const assets = await loadPostAssets(spec);
  const { width, height } = POST_SIZE[spec.format];
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = ctxOf(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawPost(ctx, spec, assets);
}

/** The post as a PNG, for "Save the image" and the phone's share sheet. */
export async function postBlob(spec: PostSpec): Promise<Blob> {
  const { width, height } = POST_SIZE[spec.format];
  const canvas = makeCanvas(width, height);
  await renderPost(canvas, spec);
  return canvasToBlob(canvas);
}
