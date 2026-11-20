/**
 * Procedural artwork for the passport content. Everything here is original and drawn in code:
 *
 *   emblemSvg()        the Island Passport mark (compass ring, three hills, a rising sun, waves)
 *   rosetteSvg()       guilloche rosette, the Classic watermark and the Provincial slot ornament
 *   bandSvg()          guilloche ribbon used as a rule (Classic)
 *   contourSvg()       bathymetric contour lines (Reef)
 *   waveRuleSvg()      a hand-drawn wave rule (Reef)
 *   rulerSvg()         millimetre ticks along the page edge (Journal)
 *   wreathSvg()        leaf wreath for the Provincial slot (Reef)
 *   registrationSvg()  dashed circle and crop marks for the Provincial slot (Journal)
 *
 * They are emitted as data-URI background images, not inline SVG DOM: the browser rasterises an
 * image once and reuses the bitmap, which keeps pages cheap to repaint while they flip (UX-2).
 * Colours are baked in from the direction tokens because a data URI cannot read CSS variables.
 */
import { DIRECTION_LIST, type DirectionTokens } from "@/lib/directions";

const TAU = Math.PI * 2;
const n1 = (v: number) => (Math.round(v * 10) / 10).toString();
const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

/**
 * SVG as a CSS url(). Only the characters that would end the URL or the CSS string are escaped
 * (the generators below use no single quotes), which keeps the CSS about a third the size of a
 * fully percent-encoded URI.
 */
export const svgDataUrl = (svg: string) =>
  `url("data:image/svg+xml,${svg
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .trim()
    .replace(/"/g, "'")
    .replace(/%/g, "%25")
    .replace(/#/g, "%23")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")}")`;

/* ------------------------------------------------------------------ */
/* Emblem                                                              */
/* ------------------------------------------------------------------ */

function wavePath(cx: number, y: number, halfWidth: number, step = 7, amp = 4.2): string {
  const count = Math.max(2, Math.floor((halfWidth * 2) / step));
  const x0 = cx - (count * step) / 2;
  let d = `M${n1(x0)} ${n1(y)}q${n1(step / 2)} ${n1(-amp)} ${step} 0`;
  for (let i = 1; i < count; i++) d += `t${step} 0`;
  return d;
}

function compassPoint(angleDeg: number, rBase: number, rTip: number, half: number): { solid: string; open: string } {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const px = Math.cos(a);
  const py = Math.sin(a);
  const tip = `${n1(100 + ux * rTip)} ${n1(100 + uy * rTip)}`;
  const mid = `${n1(100 + ux * rBase)} ${n1(100 + uy * rBase)}`;
  const left = `${n1(100 + ux * rBase - px * half)} ${n1(100 + uy * rBase - py * half)}`;
  const right = `${n1(100 + ux * rBase + px * half)} ${n1(100 + uy * rBase + py * half)}`;
  return { solid: `M${tip}L${left}L${mid}Z`, open: `M${tip}L${right}L${mid}Z` };
}

/**
 * The mark, in a 200 x 200 box. Painted in one flat colour so it can be used as a CSS mask
 * (foil on the cover) or as an image.
 */
export function emblemSvg(color = "#000"): string {
  let ticks = "";
  for (let i = 0; i < 64; i++) {
    const a = (i * TAU) / 64;
    const r1 = i % 8 === 0 ? 71.5 : i % 4 === 0 ? 74 : 76.5;
    ticks += `M${n1(100 + Math.sin(a) * r1)} ${n1(100 - Math.cos(a) * r1)}L${n1(100 + Math.sin(a) * 81)} ${n1(100 - Math.cos(a) * 81)}`;
  }

  const cardinals = [0, 90, 180, 270].map((deg) => compassPoint(deg, 66, deg === 0 ? 100 : 97, 8.5));
  const inter = [45, 135, 225, 315].map((deg) => compassPoint(deg, 66, 85, 5.5));
  const pointsSolid = [...cardinals, ...inter].map((p) => p.solid).join("");
  const pointsOpen = [...cardinals, ...inter].map((p) => p.open).join("");
  const pointsHull = [...cardinals, ...inter].map((p) => p.solid + p.open).join("");

  let rays = "";
  for (let deg = -150; deg <= -30; deg += 24) {
    const a = (deg * Math.PI) / 180;
    rays += `M${n1(100 + Math.cos(a) * 14)} ${n1(70 + Math.sin(a) * 14)}L${n1(100 + Math.cos(a) * 19.5)} ${n1(70 + Math.sin(a) * 19.5)}`;
  }

  const hills =
    `M53 115A16 17 0 0 1 85 115Z` + // left hill
    `M88.5 115A18.5 27 0 0 1 125.5 115Z` + // centre hill
    `M129 115A12 13.5 0 0 1 153 115Z`; // right hill

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <mask id="k" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
        <rect width="200" height="200" fill="#fff"/>
        <path d="${pointsHull}" fill="#000" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
      </mask>
      <clipPath id="c"><circle cx="100" cy="100" r="53.5"/></clipPath>
    </defs>
    <g fill="none" stroke="${color}">
      <g mask="url(#k)">
        <circle cx="100" cy="100" r="87" stroke-width="2"/>
        <circle cx="100" cy="100" r="83.6" stroke-width=".7"/>
        <path d="${ticks}" stroke-width="1"/>
        <circle cx="100" cy="100" r="68.4" stroke-width=".7"/>
      </g>
      <circle cx="100" cy="100" r="62" stroke-width="1"/>
      <circle cx="100" cy="100" r="57.6" stroke-width="2.6"/>
      <path d="${pointsOpen}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="${pointsSolid}" fill="${color}" stroke-width="1.1" stroke-linejoin="round"/>
      <g clip-path="url(#c)">
        <path d="${rays}" stroke-width="1.7" stroke-linecap="round"/>
        <circle cx="100" cy="70" r="8.6" fill="${color}" stroke="none"/>
        <path d="${hills}" fill="${color}" stroke="none"/>
        <path d="M44 119.5H156" stroke-width="1.5"/>
        <g stroke-width="2.3" stroke-linecap="round">
          <path d="${wavePath(100, 129.5, 43)}"/>
          <path d="${wavePath(100, 138.5, 35)}"/>
          <path d="${wavePath(100, 147.5, 22)}"/>
        </g>
      </g>
    </g>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Guilloche                                                           */
/* ------------------------------------------------------------------ */

/**
 * Lace rings are drawn in a box twice the nominal size (800 for a 400 design) with whole-number
 * coordinates: half the characters of one-decimal coordinates at the same precision.
 */
const LACE = 2;

function lacePath(radius: number, amp: number, lobes: number, c: number): string {
  const steps = lobes * 14;
  let d = "";
  for (let i = 0; i < steps; i++) {
    const a = (i * TAU) / steps;
    const r = radius + amp * Math.sin(lobes * a);
    d += `${i === 0 ? "M" : "L"}${Math.round(LACE * (c + r * Math.cos(a)))} ${Math.round(LACE * (c + r * Math.sin(a)))}`;
  }
  return `${d}Z`;
}

interface LaceRing {
  radius: number;
  amp: number;
  lobes: number;
  copies: number;
}

/** A lace ring: one sine-modulated circle, repeated with small rotations so the lines weave. */
function laceRing(ring: LaceRing, id: string, c: number): string {
  const step = 360 / (ring.lobes * ring.copies);
  let uses = "";
  for (let k = 1; k < ring.copies; k++) {
    uses += `<use href="#${id}" transform="rotate(${n2(step * k)} ${c * LACE} ${c * LACE})"/>`;
  }
  return `<path id="${id}" d="${lacePath(ring.radius, ring.amp, ring.lobes, c)}"/>${uses}`;
}

const ROSETTE_RINGS: LaceRing[] = [
  { radius: 168, amp: 24, lobes: 16, copies: 6 },
  { radius: 122, amp: 20, lobes: 12, copies: 6 },
  { radius: 80, amp: 17, lobes: 9, copies: 6 },
  { radius: 42, amp: 14, lobes: 6, copies: 5 },
];

/** Full rosette in a 400 x 400 box. `hollow` leaves the centre clear (for the Provincial slot). */
export function rosetteSvg(color: string, opacity: number, strokeWidth = 0.6, hollow = 0): string {
  const rings = ROSETTE_RINGS.filter((r) => r.radius - r.amp > hollow)
    .map((r, i) => laceRing(r, `r${i}`, 200))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
    <g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${strokeWidth * LACE}">
      ${rings}
      <circle cx="400" cy="400" r="392"/>
      <circle cx="400" cy="400" r="386"/>
    </g>
  </svg>`;
}

/** Ornate ring for the Provincial slot: two outer lace rings around a clear centre. */
export function ornateRingSvg(color: string, opacity: number): string {
  const rings = [
    { radius: 176, amp: 16, lobes: 24, copies: 5 },
    { radius: 150, amp: 9, lobes: 36, copies: 3 },
  ]
    .map((r, i) => laceRing(r, `o${i}`, 200))
    .join("");
  let beads = "";
  for (let i = 0; i < 48; i++) {
    const a = (i * TAU) / 48;
    beads += `<circle cx="${Math.round(400 + 274 * Math.cos(a))}" cy="${Math.round(400 + 274 * Math.sin(a))}" r="${i % 4 === 0 ? 4.2 : 2.2}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
    <g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.4">
      ${rings}
      <circle cx="400" cy="400" r="393"/>
      <circle cx="400" cy="400" r="260" stroke-width="1.8"/>
    </g>
    <g fill="${color}" fill-opacity="${Math.min(1, opacity * 1.3)}">${beads}</g>
  </svg>`;
}

/** Guilloche ribbon, tiles horizontally. 96 x 12. */
export function bandSvg(color: string, opacity: number): string {
  const w = 96;
  const h = 12;
  const steps = 32;
  const wave = (phase: number, amp: number, freq: number) => {
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const x = (w * i) / steps;
      const y = h / 2 + amp * Math.sin((TAU * freq * i) / steps + phase);
      d += `${i === 0 ? "M" : "L"}${n1(x)} ${n2(y)}`;
    }
    return d;
  };
  let paths = "";
  for (let i = 0; i < 4; i++) paths += `<path d="${wave((TAU * i) / 4, 4.6, 2)}"/>`;
  paths += `<path d="${wave(0, 2.2, 4)}" opacity=".7"/><path d="${wave(Math.PI, 2.2, 4)}" opacity=".7"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width=".55">${paths}</g>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Reef                                                                */
/* ------------------------------------------------------------------ */

/** Depth contours around two shoals, drawn for a 360 x 560 page. */
export function contourSvg(color: string, opacity: number): string {
  const blob = (cx: number, cy: number, r: number, k: number) => {
    const steps = 44;
    let d = "";
    for (let i = 0; i < steps; i++) {
      const a = (i * TAU) / steps;
      const wobble =
        1 +
        0.16 * Math.sin(2 * a + 0.6 + k * 0.21) +
        0.09 * Math.sin(3 * a + 1.9 - k * 0.17) +
        0.045 * Math.sin(5 * a + k * 0.5);
      d += `${i === 0 ? "M" : "L"}${Math.round(cx + r * wobble * Math.cos(a) * 1.18)} ${Math.round(cy + r * wobble * Math.sin(a) * 0.9)}`;
    }
    return `${d}Z`;
  };
  let paths = "";
  for (let i = 0; i < 9; i++) {
    const dash = i % 3 === 2 ? ` stroke-dasharray="1.5 4"` : "";
    paths += `<path d="${blob(318, 506, 26 + i * 25, i)}"${dash}/>`;
  }
  for (let i = 0; i < 4; i++) {
    const dash = i % 2 === 1 ? ` stroke-dasharray="1.5 4"` : "";
    paths += `<path d="${blob(18, 150, 18 + i * 21, i + 3)}"${dash}/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560" viewBox="0 0 360 560" preserveAspectRatio="xMaxYMax slice">
    <g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width=".9" stroke-linecap="round">${paths}</g>
  </svg>`;
}

/** Two offset wave lines, tiles horizontally. 28 x 9. */
export function waveRuleSvg(color: string, opacity: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="9" viewBox="0 0 28 9">
    <g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-linecap="round">
      <path d="M0 3q3.5 -3.2 7 0t7 0t7 0t7 0" stroke-width="1.15"/>
      <path d="M-7 7q3.5 -2.4 7 0t7 0t7 0t7 0t7 0" stroke-width=".7" stroke-opacity="${opacity * 0.6}"/>
    </g>
  </svg>`;
}

/** Leaf wreath for the Provincial slot: pairs of leaves along a vine. 400 x 400, clear centre. */
export function wreathSvg(leaf: string, accent: string, opacity: number): string {
  let leaves = "";
  const count = 30;
  const shape = "M0 0C6 -8 17 -9 27 0C17 9 6 8 0 0Z";
  for (let i = 0; i < count; i++) {
    const a = (i * 360) / count;
    const fill = i % 5 === 2 ? accent : leaf;
    // Each node on the vine carries one leaf leaning out and one leaning in.
    leaves += `<g transform="rotate(${n1(a)} 200 200) translate(200 32)">
      <path d="${shape}" transform="rotate(-38)" fill="${fill}"/>
      <path d="${shape}" transform="rotate(38) scale(.82)" fill="${i % 5 === 4 ? accent : leaf}"/>
    </g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <g opacity="${opacity}">
      <circle cx="200" cy="200" r="168" fill="none" stroke="${leaf}" stroke-width="1.4"/>
      ${leaves}
      <circle cx="200" cy="200" r="136" fill="none" stroke="${leaf}" stroke-width="1" stroke-dasharray=".1 6" stroke-linecap="round"/>
    </g>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

/** Ruler ticks, tiles horizontally. 50 x 9, a tick every 5 units. */
export function rulerSvg(color: string, opacity: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const len = i === 0 ? 9 : i === 5 ? 6.5 : 4;
    d += `M${i * 5 + 0.5} 0V${len}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="9" viewBox="0 0 50 9">
    <path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width=".8"/>
  </svg>`;
}

/** Registration target and crop marks for the Provincial slot. 400 x 400. */
export function registrationSvg(color: string, accent: string, opacity: number): string {
  let ticks = "";
  for (let i = 0; i < 72; i++) {
    const a = (i * TAU) / 72;
    const r1 = i % 6 === 0 ? 178 : 186;
    ticks += `M${n1(200 + r1 * Math.cos(a))} ${n1(200 + r1 * Math.sin(a))}L${n1(200 + 194 * Math.cos(a))} ${n1(200 + 194 * Math.sin(a))}`;
  }
  const corner = (x: number, y: number, sx: number, sy: number) =>
    `M${x} ${y + sy * 26}V${y}H${x + sx * 26}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <g fill="none" stroke="${color}" stroke-opacity="${opacity}">
      <path d="${ticks}" stroke-width="1"/>
      <circle cx="200" cy="200" r="170" stroke-width="1.2" stroke-dasharray="7 5"/>
      <circle cx="200" cy="200" r="138" stroke-width=".8"/>
      <path d="${corner(6, 6, 1, 1)}${corner(394, 6, -1, 1)}${corner(6, 394, 1, -1)}${corner(394, 394, -1, -1)}" stroke-width="1.4"/>
    </g>
    <g fill="none" stroke="${accent}" stroke-opacity="${Math.min(1, opacity * 1.5)}" stroke-width="1">
      <path d="M200 2V22M200 378V398M2 200H22M378 200H398"/>
    </g>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* CSS: one rule per direction, injected once (see ContentStyles)      */
/* ------------------------------------------------------------------ */

function directionRule(d: DirectionTokens): string {
  const line = d.paper.line;
  const vars: Record<string, string> = {};
  if (d.id === "classic") {
    vars["--ipp-watermark"] = svgDataUrl(rosetteSvg(line, 0.13));
    vars["--ipp-rule"] = svgDataUrl(bandSvg(line, 0.5));
    vars["--ipp-ornate"] = svgDataUrl(ornateRingSvg(d.foil.lo, 0.62));
  } else if (d.id === "reef") {
    vars["--ipp-watermark"] = svgDataUrl(contourSvg(line, 0.2));
    vars["--ipp-rule"] = svgDataUrl(waveRuleSvg(line, 0.75));
    vars["--ipp-ornate"] = svgDataUrl(wreathSvg(d.cover.base, d.ink.verified, 0.5));
  } else {
    vars["--ipp-watermark"] = "none";
    vars["--ipp-rule"] = svgDataUrl(rulerSvg(d.paper.ink, 0.42));
    vars["--ipp-ornate"] = svgDataUrl(registrationSvg(d.paper.ink, d.ink.pending, 0.5));
  }
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `[data-direction="${d.id}"]{${body}}`;
}

let cachedCss: string | null = null;

/** CSS that defines the pattern variables for every direction plus the emblem mask. */
export function contentPatternCss(): string {
  if (cachedCss === null) {
    cachedCss = [`:root{--ipp-emblem:${svgDataUrl(emblemSvg("#000"))};}`, ...DIRECTION_LIST.map(directionRule)].join("\n");
  }
  return cachedCss;
}
