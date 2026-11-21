/**
 * The share card (og:image and twitter:image): the Classic cover in miniature. 1200 x 630.
 * Navy ground, the cover emblem in gold, the name and what this is.
 */
import { ImageResponse } from "next/og";
import { emblemSvg, svgDataUrl } from "@/components/passport/content/patterns";
import { DIRECTIONS } from "@/lib/directions";
import { strings } from "@/lib/strings";

export const alt = strings.app.metaTitle;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** What the card says under the name. */
const KIND = strings.app.shareKind;

const cover = DIRECTIONS.classic.cover;
const foil = DIRECTIONS.classic.foil;

/** `url("data:...")` as produced for CSS, reduced to the bare data URL an <img> takes. */
const bareUrl = (cssUrl: string) => cssUrl.replace(/^url\((["']?)(.*)\1\)$/, "$2");

/**
 * Cinzel, the Classic cover's title face, cut down to the letters on the card. Any failure
 * (offline, a changed response) falls back to the renderer's built-in face.
 */
async function loadTitleFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Cinzel:wght@600&text=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(3000) },
    ).then((r) => (r.ok ? r.text() : ""));
    const src = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/)?.[1];
    if (!src) return null;
    const font = await fetch(src, { signal: AbortSignal.timeout(3000) });
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const name = strings.app.name.toUpperCase();
  const byline = strings.app.bidder ? `${KIND} by ${strings.app.bidder}` : KIND;
  // The byline is set in capitals too, and uses the same face where its letters were loaded.
  const titleFont = await loadTitleFont(name + byline.toUpperCase());
  const emblem = bareUrl(svgDataUrl(emblemSvg(foil.base)));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 30,
          background: `linear-gradient(135deg, ${cover.base} 0%, ${cover.deep} 100%)`,
          color: foil.base,
        }}
      >
        {/* The cover's foil frame: two hairlines. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            padding: 9,
            border: `2px solid ${foil.base}`,
            borderRadius: 22,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              padding: "0 70px",
              border: `1px solid ${foil.lo}`,
              borderRadius: 14,
            }}
          >
            <img src={emblem} width={330} height={330} alt="" />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 64 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontFamily: titleFont ? "Cinzel" : "serif",
                  fontSize: 92,
                  fontWeight: 600,
                  lineHeight: 1.08,
                  letterSpacing: titleFont ? 8 : 10,
                  color: foil.hi,
                }}
              >
                {name.split(" ").map((word) => (
                  <span key={word}>{word}</span>
                ))}
              </div>
              <div style={{ display: "flex", width: 120, height: 2, margin: "30px 0 26px", background: foil.base }} />
              <div style={{ display: "flex", fontSize: 30, letterSpacing: 7, textTransform: "uppercase" }}>{byline}</div>
              <div style={{ display: "flex", marginTop: 14, fontSize: 24, color: foil.lo }}>{strings.app.tagline}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: titleFont ? [{ name: "Cinzel", data: titleFont, weight: 600, style: "normal" }] : undefined,
    },
  );
}
