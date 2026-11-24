/**
 * The link preview picture for a shared link (og:image and twitter:image), 1200 x 630, one per code.
 *
 * Left: the island photo. Right: who shared, the island, the stamp to collect and the charity, on
 * the light "Daylight Atlas" palette. A paper slip with the stamp artwork straddles the seam.
 *
 * It never shows a stamp's status: chat apps keep a preview for days or weeks, so a card that said
 * "pending" would still say so after the charity confirmed (Technical_Questions.md, section 3).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { ImageResponse } from "next/og";
import { buildLanding, type LandingModel } from "@/components/share/landing/model";
import { photoAsset } from "@/lib/islands/photos";
import { shareDisplayUrl } from "@/lib/share";
import { strings } from "@/lib/strings";

export const alt = "A shared Island Passport link: an island, the stamp to collect and the charity it helps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#12293a";
const MUTED = "#4f6271";
const CREAM = "#fbf6ec";
const PAPER = "#fffdf7";
const ACCENT = { sea: { deep: "#06706d", soft: "#e2f6f4" }, sun: { deep: "#ad4a25", soft: "#fdeee3" } } as const;

/**
 * A file from public/ as a data URL. Read from disk; if the file is not on this machine's disk
 * (a serverless function without the public folder), fetched from the site itself.
 */
async function dataUrl(file: string, type: string, origin: string | null): Promise<string | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", file));
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    /* fall through to the network */
  }
  if (!origin) return null;
  try {
    const res = await fetch(`${origin}/${file}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** A Google font cut down to the letters on the card. Any failure falls back to the built-in face. */
async function loadFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(3000) }).then((r) => (r.ok ? r.text() : ""));
    const src = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/)?.[1];
    if (!src) return null;
    const font = await fetch(src, { signal: AbortSignal.timeout(3000) });
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const PHOTO = { width: 560, height: 630 };

/**
 * The renderer cannot decode WebP, so the card uses the JPEG renditions in public/og
 * (scripts/og-photos.py). It also has no object-position, so the crop is placed by hand: the
 * photo is scaled to cover the panel and shifted to keep the model's focus point in view.
 */
function photoBox(model: LandingModel): { width: number; height: number; left: number; top: number } {
  const asset = photoAsset(model.photo.name);
  const aspect = asset ? asset.width / asset.height : 16 / 9;
  const [fx, fy] = model.photo.focus;
  if (aspect > PHOTO.width / PHOTO.height) {
    const width = Math.round(PHOTO.height * aspect);
    return { width, height: PHOTO.height, left: -Math.round(((width - PHOTO.width) * fx) / 100), top: 0 };
  }
  const height = Math.round(PHOTO.width / aspect);
  return { width: PHOTO.width, height, left: 0, top: -Math.round(((height - PHOTO.height) * fy) / 100) };
}

export default async function OpengraphImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const model = buildLanding(code);
  const accent = ACCENT[model.accent];
  const { offer, sharer } = model;
  const link = shareDisplayUrl(model.code);
  const collect = offer.isSeal ? `Earn the ${offer.title}` : `Collect the ${offer.title} stamp`;
  const helps = `Helps ${offer.charity}`;
  const by = sharer ? `Shared by ${sharer.name}` : model.place;
  const serifText = `${model.headline.lead}${model.headline.island}.${strings.app.name}`;
  const sansText = `${collect}${helps}${by}${model.place}${link}${sharer?.avatar.initials ?? ""}SAMPLE${offer.kindLabel.toUpperCase()}`;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const origin = host ? `${headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}` : null;
  const box = photoBox(model);
  const [photo, art, serif, serifItalic, sans, sansBold] = await Promise.all([
    dataUrl(`og/${model.photo.name}.jpg`, "image/jpeg", origin),
    dataUrl(`stamps/${offer.art}.png`, "image/png", origin),
    loadFont("Instrument+Serif", serifText),
    loadFont("Instrument+Serif:ital@1", serifText),
    loadFont("DM+Sans:wght@500", sansText),
    loadFont("DM+Sans:wght@700", sansText),
  ]);
  const serifFace = serif ? "Instrument Serif" : "serif";
  const sansFace = sans ? "DM Sans" : "sans-serif";
  const headlineSize = model.headline.lead.length > 22 ? 62 : model.headline.lead.length > 14 ? 74 : 88;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, color: INK, fontFamily: sansFace }}>
        {/* The island */}
        <div style={{ position: "relative", display: "flex", width: PHOTO.width, height: "100%", overflow: "hidden", background: photoAsset(model.photo.name)?.color ?? "#9cc7dc" }}>
          {photo ? <img src={photo} alt="" width={box.width} height={box.height} style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height }} /> : null}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 200, display: "flex", background: "linear-gradient(180deg, rgba(18,41,58,0) 0%, rgba(18,41,58,0.62) 100%)" }} />
          <div style={{ position: "absolute", left: 40, bottom: 34, display: "flex", color: "#fff", fontSize: 26, fontWeight: 700 }}>{model.place}</div>
        </div>

        {/* The words */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "44px 56px 42px 132px",
            background: `linear-gradient(160deg, ${accent.soft} 0%, ${CREAM} 46%, ${CREAM} 100%)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="40" height="40" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14.2" fill="none" stroke="#06706d" strokeWidth="1.3" strokeDasharray="1.6 2.3" />
              <circle cx="16" cy="16" r="9.4" fill="#cdeeeb" stroke="#06706d" strokeWidth="1.3" />
              <path d="M6.6 16h18.8M16 6.6c3.4 2.7 3.4 16.1 0 18.8M16 6.6c-3.400 2.700-3.400 16.100 0 18.800" fill="none" stroke="#06706d" strokeWidth="1.1" />
            </svg>
            <div style={{ display: "flex", marginLeft: 12, fontFamily: serifFace, fontSize: 34 }}>{strings.app.name}</div>
            <div
              style={{
                display: "flex",
                marginLeft: 16,
                padding: "5px 12px 4px",
                border: "1.5px solid rgba(18,41,58,0.22)",
                borderRadius: 999,
                color: MUTED,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 2,
              }}
            >
              SAMPLE
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: serifFace, fontSize: headlineSize, lineHeight: 1 }}>{model.headline.lead}</div>
            <div style={{ display: "flex", fontFamily: serifFace, fontStyle: "italic", fontSize: Math.round(headlineSize * 1.18), lineHeight: 1.02, color: accent.deep }}>{model.headline.island}.</div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 30, fontWeight: 700 }}>{collect}</div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 26, color: MUTED }}>{helps}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            {sharer ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 58,
                  height: 58,
                  flexShrink: 0,
                  marginRight: 16,
                  borderRadius: 999,
                  border: "3px solid #fff",
                  background: `linear-gradient(140deg, ${sharer.avatar.tint[0]}, ${sharer.avatar.tint[1]})`,
                  color: "#fff",
                  fontSize: 21,
                  fontWeight: 700,
                }}
              >
                {sharer.avatar.initials}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 23, fontWeight: 700 }}>{by}</div>
              <div style={{ display: "flex", marginTop: 2, fontSize: 21, color: "#06706d" }}>{link}</div>
            </div>
          </div>
        </div>

        {/* The stamp, on a slip of passport paper across the seam */}
        <div
          style={{
            position: "absolute",
            left: 446,
            top: 150,
            width: 232,
            height: 268,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 30,
            background: PAPER,
            border: "1.5px solid rgba(183,134,42,0.22)",
            boxShadow: "0 30px 60px -18px rgba(18,41,58,0.55)",
            transform: "rotate(-6deg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 188, height: 188, borderRadius: 999, border: `5px solid ${accent.deep}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 164, height: 164, borderRadius: 999, border: `2px dashed ${accent.deep}` }}>
              {art ? <img src={art} alt="" width={128} height={128} style={{ opacity: 0.86 }} /> : null}
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 15, fontWeight: 700, letterSpacing: 2.4, color: accent.deep }}>{offer.kindLabel.toUpperCase()}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(serif ? [{ name: "Instrument Serif", data: serif, weight: 400 as const, style: "normal" as const }] : []),
        ...(serifItalic ? [{ name: "Instrument Serif", data: serifItalic, weight: 400 as const, style: "italic" as const }] : []),
        ...(sans ? [{ name: "DM Sans", data: sans, weight: 500 as const, style: "normal" as const }] : []),
        ...(sansBold ? [{ name: "DM Sans", data: sansBold, weight: 700 as const, style: "normal" as const }] : []),
      ],
    },
  );
}
