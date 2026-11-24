/**
 * Renders a post to a PNG in the browser with a 2D canvas, for "Save image" and for the native
 * share sheet. The artwork always carries the QR code and the short link, because captions on the
 * big social apps are not tappable.
 *
 * Client only. Photos come from /public/photos (same origin, so the canvas is never tainted).
 */
import { photoSources } from "@/lib/islands/photos";
import type { PhotoName } from "@/lib/islands/types";
import { shareCopy } from "@/lib/share/sample";
import { shareDisplayUrl, shareUrl } from "@/lib/share/urls";
import { strings } from "@/lib/strings";
import { QR_MARGIN, qrGeometry, qrMatrix } from "./QrCode";

export interface PostImageSpec {
  /** "feed" = 1080 x 1350 (4:5). "story" = 1080 x 1920 (9:16), also right for a short video cover. */
  format: "feed" | "story";
  photo: PhotoName;
  /** Crop anchor, 0 to 100 each. Default the centre. */
  focus?: [number, number];
  /** Small italic line, e.g. "Bohol". */
  islandName: string;
  /** The headline over the photo, e.g. a reel's first line or "Spinner dolphins, stamped". */
  headline: string;
  /** Who is sharing, e.g. "with Mia Sample". */
  byline?: string;
  /** Share code: the link printed on the image and (by default) what the QR code encodes. */
  code: string;
  /** Kicker in the QR panel. Default "Scan to support". */
  support?: string;
  /** Serif name in the QR panel: the charity. */
  supportName?: string;
  /** What the QR code encodes. Default `shareUrl(code)`; pass `useShareTarget(code)` on a deployed demo. */
  qrValue?: string;
}

export const POST_IMAGE_SIZE = { feed: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } } as const;

const INK = "#12293a";
const SEA_DEEP = "#06706d";
const SEA_INK = "#0a827e";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** The font stacks next/font generated for the kit, read from the page (they carry hashed names). */
async function fonts(): Promise<{ serif: string; sans: string }> {
  const el = document.querySelector(".sk") ?? document.body;
  const cs = getComputedStyle(el);
  const serif = `${cs.getPropertyValue("--da-serif").trim() || "Georgia"}, Georgia, serif`;
  const sans = `${cs.getPropertyValue("--da-sans").trim() || "system-ui"}, system-ui, sans-serif`;
  try {
    await Promise.all([
      document.fonts.load(`400 80px ${serif}`),
      document.fonts.load(`italic 400 80px ${serif}`),
      document.fonts.load(`600 40px ${sans}`),
      document.fonts.load(`700 40px ${sans}`),
    ]);
  } catch {
    /* draw with the fallbacks */
  }
  return { serif, sans };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s,.;:]+$/, "")}…`;
    return kept;
  }
  return lines;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 4 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/** The same soft QR code as <QrCode variant="soft" />, with the globe mark in the middle. */
export function drawQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = INK) {
  const geo = qrGeometry(qrMatrix(value, true), true, true);
  const unit = size / (geo.size + QR_MARGIN * 2);
  ctx.save();
  ctx.translate(x + QR_MARGIN * unit, y + QR_MARGIN * unit);
  ctx.scale(unit, unit);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = 0.94;
  ctx.stroke(new Path2D(geo.runs));
  ctx.lineWidth = 1;
  for (const eye of geo.eyes) {
    roundRect(ctx, eye.x + 0.5, eye.y + 0.5, 6, 6, 1.9);
    ctx.stroke();
    roundRect(ctx, eye.x + 2, eye.y + 2, 3, 3, 1);
    ctx.fill();
  }
  const c = geo.size / 2;
  ctx.translate(c, c);
  ctx.fillStyle = "#e2f6f4";
  ctx.beginPath();
  ctx.arc(0, 0, geo.hole - 0.7, 0, Math.PI * 2);
  ctx.fill();
  const r = geo.hole - 1.2;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = SEA_DEEP;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.ellipse(0, 0, r * 0.42, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
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

/** Draw the post and return it as a PNG blob. */
export async function renderPostImage(spec: PostImageSpec): Promise<Blob> {
  const { width: W, height: H } = POST_IMAGE_SIZE[spec.format];
  const story = spec.format === "story";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const source = photoSources(spec.photo, 1672);
  const [{ serif, sans }, photo] = await Promise.all([fonts(), source ? loadImage(source.src).catch(() => null) : Promise.resolve(null)]);

  // Photo, cropped to cover.
  ctx.fillStyle = "#2b5a6e";
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    const scale = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    const w = photo.naturalWidth * scale;
    const h = photo.naturalHeight * scale;
    const [fx, fy] = spec.focus ?? [50, 50];
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, (W - w) * (fx / 100), (H - h) * (fy / 100), w, h);
  }

  // Shade for the text, top and bottom.
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.26);
  top.addColorStop(0, "rgba(8,26,38,0.46)");
  top.addColorStop(1, "rgba(8,26,38,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.26);
  const bottom = ctx.createLinearGradient(0, H, 0, H * 0.36);
  bottom.addColorStop(0, "rgba(8,26,38,0.82)");
  bottom.addColorStop(0.5, "rgba(8,26,38,0.4)");
  bottom.addColorStop(1, "rgba(8,26,38,0)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.36, W, H * 0.64);

  const pad = 64;
  const safeTop = story ? 190 : 0;
  const safeBottom = story ? 230 : 0;

  // Kicker.
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  drawMark(ctx, pad + 24, safeTop + pad + 24, 24, "#fff");
  ctx.font = `700 30px ${sans}`;
  ctx.letterSpacing = "5px";
  ctx.fillText(strings.app.name.toUpperCase(), pad + 66, safeTop + pad + 26);
  ctx.letterSpacing = "0px";

  // QR panel along the bottom.
  const panelH = 300;
  const panelY = H - safeBottom - pad - panelH;
  ctx.save();
  ctx.shadowColor = "rgba(8,26,38,0.35)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, pad, panelY, W - pad * 2, panelH, 56);
  ctx.fill();
  ctx.restore();
  const qr = panelH - 44;
  drawQr(ctx, spec.qrValue ?? shareUrl(spec.code), pad + 22, panelY + 22, qr);

  const tx = pad + 22 + qr + 34;
  const tw = W - pad - tx - 40;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SEA_INK;
  ctx.font = `700 26px ${sans}`;
  ctx.letterSpacing = "4px";
  ctx.fillText(fitText(ctx, (spec.support ?? shareCopy.scanToSupport).toUpperCase(), tw), tx, panelY + 84);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = INK;
  ctx.font = `400 68px ${serif}`;
  const nameLines = wrap(ctx, spec.supportName ?? spec.islandName, tw, 2);
  nameLines.forEach((line, i) => ctx.fillText(line, tx, panelY + 160 + i * 68));
  const linkY = panelY + panelH - 50;
  ctx.font = `700 32px ${sans}`;
  ctx.fillStyle = SEA_DEEP;
  ctx.fillText(fitText(ctx, shareDisplayUrl(spec.code), tw), tx, linkY);

  // Words over the photo, stacked up from the panel.
  let y = panelY - 56;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(8,26,38,0.45)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 3;
  if (spec.byline) {
    ctx.font = `600 38px ${sans}`;
    ctx.fillText(fitText(ctx, spec.byline, W - pad * 2), pad, y);
    y -= 44;
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(pad, y, W - pad * 2, 2);
    ctx.restore();
    y -= 44;
  }
  const headSize = 124;
  ctx.font = `400 ${headSize}px ${serif}`;
  const head = wrap(ctx, spec.headline, W - pad * 2, 3);
  for (let i = head.length - 1; i >= 0; i--) {
    ctx.fillText(head[i], pad, y);
    y -= headSize * 1.02;
  }
  y -= 4;
  ctx.font = `italic 400 62px ${serif}`;
  ctx.fillText(spec.islandName, pad, y);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/png"));
}

/** Start a download for a blob (or an object URL made from one). */
export function downloadBlob(blob: Blob | string, fileName: string) {
  const url = typeof blob === "string" ? blob : URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof blob !== "string") setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** True inside the embedded browsers of the big social apps, where saving and sharing files is unreliable. */
export function isInAppBrowser(userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat/i.test(userAgent);
}
