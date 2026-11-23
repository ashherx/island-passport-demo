/**
 * The frames around the cover's globe window, as SVG masks (black artwork on transparent). The
 * cover paints them the way it paints its emblem: an impression shadow, a lit edge and the foil
 * or ink on top, all through the same mask. Geometry is in a 200 x 200 box with the window's
 * edge at radius WINDOW_R.
 */

/** Radius of the globe window in the 200-unit frame box. */
export const WINDOW_R = 76;

const n1 = (v: number) => (Math.round(v * 10) / 10).toString();
const polar = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [100 + Math.sin(a) * r, 100 - Math.cos(a) * r];
};
const pt = (deg: number, r: number) => {
  const [x, y] = polar(deg, r);
  return `${n1(x)} ${n1(y)}`;
};

export function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}")`;
}

/** A compass point: a slim kite, its left half solid and its right half open. */
function kite(deg: number, inner: number, tip: number, shoulder: number, halfWidthDeg: number) {
  const a = pt(deg, tip);
  const l = pt(deg - halfWidthDeg, shoulder);
  const r = pt(deg + halfWidthDeg, shoulder);
  const b = pt(deg, inner);
  return { solid: `M${a}L${l}L${b}Z`, open: `M${a}L${r}L${b}Z`, hull: `M${a}L${l}L${b}L${r}Z` };
}

/**
 * Classic: a foil compass ring. Bevel ring at the window's edge, a band of degree ticks, two
 * outer rings and eight compass points, the family of the passport's emblem.
 */
export function classicRingSvg(color = "#000"): string {
  let ticks = "";
  for (let i = 0; i < 72; i++) {
    const deg = i * 5;
    const from = i % 9 === 0 ? 82.9 : i % 3 === 0 ? 84.1 : 85.2;
    ticks += `M${pt(deg, from)}L${pt(deg, 88.4)}`;
  }
  const points = [
    ...[0, 90, 180, 270].map((deg) => kite(deg, 83.4, deg === 0 ? 100 : 98.6, 90.4, 2.5)),
    ...[45, 135, 225, 315].map((deg) => kite(deg, 85.4, 95.4, 90.4, 1.6)),
  ];
  const hull = points.map((p) => p.hull).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <mask id="k" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
        <rect width="200" height="200" fill="#fff"/>
        <path d="${hull}" fill="#000" stroke="#000" stroke-width="3.4" stroke-linejoin="round"/>
      </mask>
    </defs>
    <g fill="none" stroke="${color}">
      <circle cx="100" cy="100" r="${WINDOW_R + 1.5}" stroke-width="3"/>
      <g mask="url(#k)">
        <circle cx="100" cy="100" r="80.9" stroke-width=".7"/>
        <path d="${ticks}" stroke-width=".8"/>
        <circle cx="100" cy="100" r="90.4" stroke-width="1.7"/>
        <circle cx="100" cy="100" r="93.3" stroke-width=".6"/>
      </g>
      <path d="${points.map((p) => p.open).join("")}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="${points.map((p) => p.solid).join("")}" fill="${color}" stroke-width=".9" stroke-linejoin="round"/>
    </g>
  </svg>`;
}

/**
 * Journal: a compass rose rubber-stamped in ink. Double ring, degree ticks, a bold north arrow
 * and three plain points; a displacement filter and a few dry specks roughen the impression.
 */
export function journalRoseSvg(color = "#000"): string {
  let ticks = "";
  for (let i = 0; i < 72; i++) {
    const deg = i * 5;
    if (i % 18 === 0) continue; // room for the cardinal marks
    const from = i % 9 === 0 ? 83.6 : i % 3 === 0 ? 85 : 86.2;
    ticks += `M${pt(deg, from)}L${pt(deg, 90)}`;
  }
  const arrow = (deg: number, tip: number, base: number, half: number) => `M${pt(deg, tip)}L${pt(deg - half, base)}L${pt(deg + half, base)}Z`;
  const north = arrow(0, 100, 85.4, 4.6);
  const others = [90, 180, 270].map((deg) => arrow(deg, 97.4, 87.4, 2.9)).join("");
  let dots = "";
  for (const deg of [45, 135, 225, 315]) {
    const [x, y] = polar(deg, 95.6);
    dots += `<circle cx="${n1(x)}" cy="${n1(y)}" r="1.5" fill="${color}" stroke="none"/>`;
  }
  // Dry specks: places where the rubber did not take ink. Fixed positions, so every render matches.
  let specks = "";
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 46; i++) {
    const [x, y] = polar(rand() * 360, 78 + rand() * 21);
    specks += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(0.35 + rand() * 0.9)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <filter id="r" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="4" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <mask id="s" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
        <rect width="200" height="200" fill="#fff"/>
        <g fill="#000">${specks}</g>
      </mask>
    </defs>
    <g filter="url(#r)" mask="url(#s)" fill="none" stroke="${color}">
      <circle cx="100" cy="100" r="${WINDOW_R + 1.6}" stroke-width="3.2"/>
      <circle cx="100" cy="100" r="81.6" stroke-width=".8"/>
      <path d="${ticks}" stroke-width="1"/>
      <circle cx="100" cy="100" r="91.6" stroke-width="1.5"/>
      <path d="${north}${others}" fill="${color}" stroke-width=".8" stroke-linejoin="round"/>
      ${dots}
    </g>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Partner marks                                                       */
/* ------------------------------------------------------------------ */

/**
 * Three invented marks for the sample partners (48 x 48). Abstract on purpose: none of them is
 * the logo of a real organisation.
 */
export const PARTNER_MARKS: Record<string, string> = {
  /* Two sails over a hull line. */
  vtb: `<path d="M25.5 6C31 15 33.2 25 32 33.6H25.5Z" fill="#000"/><path d="M21.6 11C16.6 18.6 13.8 26.6 13.6 33.6H21.6Z" fill="#000"/><path d="M8 38.4Q24 45.6 40 38.4" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round"/>`,
  /* A branch of coral. */
  coral: `<g fill="none" stroke="#000" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"><path d="M24 42.5V25.5"/><path d="M24 31L15 21.5V12"/><path d="M15 21.5L8.6 18.4"/><path d="M24 25.5L32.4 17V8.5"/><path d="M32.4 17L39.4 15"/><path d="M24 36L33 31.6"/></g>`,
  /* A diamond with a wave and a rising bubble. */
  dive: `<path d="M24 4.6L43.4 24L24 43.4L4.6 24Z" fill="none" stroke="#000" stroke-width="2.7" stroke-linejoin="round"/><path d="M13.4 27.4Q18.7 22.4 24 27.4T34.6 27.4" fill="none" stroke="#000" stroke-width="2.7" stroke-linecap="round"/><circle cx="27.6" cy="17" r="2.5" fill="#000"/>`,
};

export function partnerMarkUrl(id: string): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${PARTNER_MARKS[id] ?? ""}</svg>`);
}

let cached: { classic: string; journal: string } | null = null;

/** The ring masks as CSS url() values, built once. */
export function frameMasks(): { classic: string; journal: string } {
  if (!cached) cached = { classic: svgUrl(classicRingSvg()), journal: svgUrl(journalRoseSvg()) };
  return cached;
}


