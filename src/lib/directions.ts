/**
 * Art directions: the single source of truth for every design token.
 *
 * `directionsCss()` turns these tokens into CSS custom properties. layout.tsx injects the result
 * in <head>, so the variables exist before first paint. Scope rules:
 *
 *   [data-direction="classic" | "reef" | "journal"]   on <html>, or on ANY element to scope a subtree
 *   [data-theme="light" | "dark"]                     on <html>
 *
 * Passport tokens (cover, paper, ink, foil, fonts) depend on the direction only: the passport is
 * a physical object and keeps its colours in dark mode. Chrome tokens (--bg, --fg, --accent ...)
 * and lighting tokens (--passport-shadow, --passport-sheen, --page-dim) depend on both.
 *
 * See docs/agents/foundation.md for the full variable list.
 */
import { textureUrl, type TextureName } from "./assets";
import type { DirectionId, StampStatus, ThemeMode } from "./types";

/* ------------------------------------------------------------------ */
/* Token types                                                         */
/* ------------------------------------------------------------------ */

export interface ChromeTokens {
  bg: string;
  bgElev: string;
  bgSunken: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  line: string;
  lineStrong: string;
  accent: string;
  /** Text colour on top of `accent`. */
  accentFg: string;
  accentSoft: string;
  focus: string;
  /** Background of the stage the passport sits on. */
  scene: string;
  /** Status colours that stay legible on the chrome background (chips, ring segments, legends). */
  status: Record<StampStatus, string>;
  /** Browser UI colour (meta theme-color). */
  themeColor: string;
}

export interface LightingTokens {
  /** box-shadow under the closed or open passport. */
  passportShadow: string;
  /** Gradient laid over the cover to fake a light source. */
  passportSheen: string;
  /** Flat tint laid over paper pages so cream does not glare on a dark stage. */
  pageDim: string;
  /** Soft glow behind the passport on the stage. */
  sceneGlow: string;
}

export type PaperPattern =
  | { kind: "guilloche"; wavelength: number; height: number; waves: number; stroke: number; opacity: number }
  | { kind: "wash"; washes: { x: number; y: number; rx: number; ry: number; color: string }[]; opacity: number }
  | { kind: "grid"; cell: number; major: number; opacity: number; majorOpacity: number };

export interface DirectionTokens {
  id: DirectionId;
  name: string;
  tagline: string;
  fonts: {
    /** Headings and the passport title. */
    display: string;
    /** Interface and body text. */
    body: string;
    /** Dates, serial numbers, machine-readable lines. */
    mono: string;
    /** Text set on the stamp frame. */
    stamp: string;
  };
  type: {
    displayWeight: number;
    displayTracking: string;
    /** font-variation-settings for display type (Fraunces softness, Archivo width). */
    displayVariation: string;
    stampWeight: number;
    /** Letter spacing of stamp text in em. */
    stampTracking: number;
    /** Multiplier on stamp text size, to even out the three stamp faces. */
    stampScale: number;
    /** Average advance width of a capital in the stamp face, in em. Used to fit text on the frame. */
    stampAdvance: number;
  };
  radius: { chip: string; card: string; passport: string; page: string };
  cover: {
    material: "leather" | "linen" | "kraft";
    texture: TextureName;
    base: string;
    deep: string;
    edge: string;
    /** Colour of type printed on the cover when not using the foil gradient. */
    ink: string;
  };
  foil: { base: string; hi: string; lo: string; shadow: string };
  paper: {
    base: string;
    shade: string;
    edge: string;
    ink: string;
    inkMuted: string;
    /** Colour of the printed security or ruling pattern. */
    line: string;
    pattern: PaperPattern;
  };
  ink: Record<StampStatus, string> & { provincial: string; empty: string };
  /** Character of the rubber-stamp impression, used by <Stamp />. */
  impression: {
    /** Edge wobble in stamp units (the stamp is 200 units wide). */
    rough: number;
    /** 0..1, share of ink lost to dry speckle. */
    speckle: number;
    /** Multiplier on frame stroke weight. */
    weight: number;
  };
  chrome: Record<ThemeMode, ChromeTokens>;
  lighting: Record<ThemeMode, LightingTokens>;
}

/* ------------------------------------------------------------------ */
/* Font stacks (the --nf-* variables are set by next/font in layout)   */
/* ------------------------------------------------------------------ */

const SERIF_FALLBACK = `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
const SANS_FALLBACK = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const MONO_FALLBACK = `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;

/* ------------------------------------------------------------------ */
/* The three directions                                                */
/* ------------------------------------------------------------------ */

const lightShadow = (rgb: string) =>
  `0 1px 1px rgba(${rgb},.12), 0 10px 20px -8px rgba(${rgb},.26), 0 38px 64px -28px rgba(${rgb},.42)`;
const darkShadow = (glow: string) =>
  `0 2px 2px rgba(0,0,0,.5), 0 18px 32px -10px rgba(0,0,0,.72), 0 54px 90px -34px rgba(0,0,0,.92), 0 0 110px -30px ${glow}`;

const LIGHT_SHEEN = `linear-gradient(118deg, rgba(255,255,255,.20) 0%, rgba(255,255,255,.04) 30%, rgba(255,255,255,0) 46%, rgba(0,0,0,.12) 100%)`;
const DARK_SHEEN = `linear-gradient(118deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.02) 26%, rgba(0,0,0,.06) 48%, rgba(0,0,0,.34) 100%)`;

export const DIRECTIONS: Record<DirectionId, DirectionTokens> = {
  classic: {
    id: "classic",
    name: "Classic",
    tagline: "Navy leather and gold foil",
    fonts: {
      display: `var(--nf-cormorant), ${SERIF_FALLBACK}`,
      body: `var(--nf-hanken), ${SANS_FALLBACK}`,
      mono: `var(--nf-plex-mono), ${MONO_FALLBACK}`,
      stamp: `var(--nf-cinzel), var(--nf-cormorant), ${SERIF_FALLBACK}`,
    },
    type: { displayWeight: 600, displayTracking: "0.01em", displayVariation: "normal", stampWeight: 700, stampTracking: 0.14, stampScale: 1, stampAdvance: 0.8 },
    radius: { chip: "999px", card: "18px", passport: "14px", page: "10px" },
    cover: {
      material: "leather",
      texture: "tex-cover-navy",
      base: "#16244a",
      deep: "#0b1430",
      edge: "#070d1e",
      ink: "#d9b666",
    },
    foil: { base: "#d2ab5a", hi: "#fbeab6", lo: "#96712b", shadow: "#5a4216" },
    paper: {
      base: "#f5eedb",
      shade: "#ebe1c8",
      edge: "#d8ccae",
      ink: "#1b2440",
      inkMuted: "#5d6585",
      line: "#3b5ba6",
      pattern: { kind: "guilloche", wavelength: 132, height: 44, waves: 6, stroke: 0.5, opacity: 0.11 },
    },
    ink: {
      discovery: "#27468f",
      pending: "#824610",
      verified: "#0e5a45",
      provincial: "#16244a",
      empty: "#978d74",
    },
    impression: { rough: 1.35, speckle: 0.32, weight: 1 },
    chrome: {
      light: {
        bg: "#f5f0e5",
        bgElev: "#fffdf7",
        bgSunken: "#ebe4d3",
        fg: "#141b2e",
        fgMuted: "#4a5369",
        fgSubtle: "#5c6479",
        line: "rgba(20,27,46,.11)",
        lineStrong: "rgba(20,27,46,.24)",
        accent: "#876417",
        accentFg: "#fffdf7",
        accentSoft: "rgba(190,150,60,.16)",
        focus: "#27468f",
        scene: "radial-gradient(120% 78% at 50% 0%, #fffbf1 0%, #f5f0e5 46%, #e7dec9 100%)",
        status: { discovery: "#27468f", pending: "#8a4b12", verified: "#0e5a45" },
        themeColor: "#f5f0e5",
      },
      dark: {
        bg: "#080d1b",
        bgElev: "#111a33",
        bgSunken: "#050912",
        fg: "#f3ebd9",
        fgMuted: "#aab2c8",
        fgSubtle: "#7a84a0",
        line: "rgba(243,235,217,.10)",
        lineStrong: "rgba(243,235,217,.22)",
        accent: "#dcb866",
        accentFg: "#141b2e",
        accentSoft: "rgba(220,184,102,.14)",
        focus: "#9db9ff",
        scene: "radial-gradient(120% 78% at 50% 0%, #18244a 0%, #0a1022 48%, #04070f 100%)",
        status: { discovery: "#8fb0ff", pending: "#e59a55", verified: "#5fcfa6" },
        themeColor: "#080d1b",
      },
    },
    lighting: {
      light: {
        passportShadow: lightShadow("16,22,44"),
        passportSheen: LIGHT_SHEEN,
        pageDim: "rgba(0,0,0,0)",
        sceneGlow: "radial-gradient(closest-side, rgba(210,171,90,.20), rgba(210,171,90,0))",
      },
      dark: {
        passportShadow: darkShadow("rgba(220,184,102,.30)"),
        passportSheen: DARK_SHEEN,
        pageDim: "rgba(8,13,27,.10)",
        sceneGlow: "radial-gradient(closest-side, rgba(220,184,102,.16), rgba(220,184,102,0))",
      },
    },
  },

  reef: {
    id: "reef",
    name: "Reef",
    tagline: "Sea-green linen, coral and sand",
    fonts: {
      display: `var(--nf-fraunces), ${SERIF_FALLBACK}`,
      body: `var(--nf-nunito), ${SANS_FALLBACK}`,
      mono: `var(--nf-plex-mono), ${MONO_FALLBACK}`,
      stamp: `var(--nf-nunito), ${SANS_FALLBACK}`,
    },
    type: { displayWeight: 600, displayTracking: "-0.01em", displayVariation: `"SOFT" 100, "opsz" 72`, stampWeight: 800, stampTracking: 0.1, stampScale: 0.96, stampAdvance: 0.72 },
    radius: { chip: "999px", card: "24px", passport: "20px", page: "14px" },
    cover: {
      material: "linen",
      texture: "tex-cover-teal",
      base: "#0f6562",
      deep: "#074245",
      edge: "#042c2f",
      ink: "#f0d8a8",
    },
    foil: { base: "#e7c688", hi: "#fff5db", lo: "#b28c4c", shadow: "#6a5123" },
    paper: {
      base: "#fcf9f2",
      shade: "#f3eee2",
      edge: "#e3ddcc",
      ink: "#12312f",
      inkMuted: "#56726e",
      line: "#2aa39a",
      pattern: {
        kind: "wash",
        opacity: 0.3,
        washes: [
          { x: 6, y: 4, rx: 40, ry: 17, color: "#57c8bd" },
          { x: 98, y: 24, rx: 22, ry: 20, color: "#f6c98b" },
          { x: 92, y: 97, rx: 40, ry: 15, color: "#ff9a80" },
          { x: 2, y: 86, rx: 22, ry: 18, color: "#8fd3e8" },
        ],
      },
    },
    ink: {
      discovery: "#0b6180",
      pending: "#755116",
      verified: "#17643f",
      provincial: "#0a3f4d",
      empty: "#93a39b",
    },
    impression: { rough: 1.6, speckle: 0.28, weight: 1.12 },
    chrome: {
      light: {
        bg: "#f0f8f5",
        bgElev: "#ffffff",
        bgSunken: "#e1efea",
        fg: "#0d2b2a",
        fgMuted: "#3f5f5c",
        fgSubtle: "#4f6f6b",
        line: "rgba(13,43,42,.10)",
        lineStrong: "rgba(13,43,42,.22)",
        accent: "#c63f28",
        accentFg: "#ffffff",
        accentSoft: "rgba(232,100,74,.13)",
        focus: "#0f7699",
        scene: "radial-gradient(120% 78% at 50% 0%, #ffffff 0%, #ecf7f3 44%, #d5ebe5 100%)",
        status: { discovery: "#0d6a8a", pending: "#7a5516", verified: "#186a46" },
        themeColor: "#f0f8f5",
      },
      dark: {
        bg: "#051b1c",
        bgElev: "#0b2b2c",
        bgSunken: "#031112",
        fg: "#e8f6f1",
        fgMuted: "#9ebfb9",
        fgSubtle: "#719894",
        line: "rgba(232,246,241,.10)",
        lineStrong: "rgba(232,246,241,.22)",
        accent: "#ff9076",
        accentFg: "#2a0f08",
        accentSoft: "rgba(255,144,118,.14)",
        focus: "#7fd8f2",
        scene: "radial-gradient(120% 78% at 50% 0%, #0f3f40 0%, #06201f 48%, #020d0e 100%)",
        status: { discovery: "#62cbe8", pending: "#dfc08a", verified: "#6fd3a4" },
        themeColor: "#051b1c",
      },
    },
    lighting: {
      light: {
        passportShadow: lightShadow("6,48,50"),
        passportSheen: LIGHT_SHEEN,
        pageDim: "rgba(0,0,0,0)",
        sceneGlow: "radial-gradient(closest-side, rgba(87,200,189,.26), rgba(87,200,189,0))",
      },
      dark: {
        passportShadow: darkShadow("rgba(87,200,189,.30)"),
        passportSheen: DARK_SHEEN,
        pageDim: "rgba(5,27,28,.10)",
        sceneGlow: "radial-gradient(closest-side, rgba(87,200,189,.18), rgba(87,200,189,0))",
      },
    },
  },

  journal: {
    id: "journal",
    name: "Journal",
    tagline: "Kraft field notebook, hand-inked",
    fonts: {
      display: `var(--nf-archivo), ${SANS_FALLBACK}`,
      body: `var(--nf-archivo), ${SANS_FALLBACK}`,
      mono: `var(--nf-plex-mono), ${MONO_FALLBACK}`,
      stamp: `var(--nf-special-elite), var(--nf-plex-mono), ${MONO_FALLBACK}`,
    },
    type: { displayWeight: 700, displayTracking: "-0.015em", displayVariation: `"wdth" 84`, stampWeight: 400, stampTracking: 0.11, stampScale: 0.98, stampAdvance: 0.62 },
    radius: { chip: "6px", card: "10px", passport: "8px", page: "5px" },
    cover: {
      material: "kraft",
      texture: "tex-cover-kraft",
      base: "#b6976b",
      deep: "#9c7f56",
      edge: "#7c6442",
      ink: "#2b2218",
    },
    foil: { base: "#b67c46", hi: "#f0cc9f", lo: "#7b4e24", shadow: "#482b12" },
    paper: {
      base: "#f7f3e8",
      shade: "#eee9da",
      edge: "#dcd5c1",
      ink: "#2a2620",
      inkMuted: "#6c6455",
      line: "#4d6f96",
      pattern: { kind: "grid", cell: 14, major: 5, opacity: 0.13, majorOpacity: 0.2 },
    },
    ink: {
      discovery: "#2d3e7c",
      pending: "#70540c",
      verified: "#2a5937",
      provincial: "#2a2520",
      empty: "#9a917c",
    },
    impression: { rough: 1.2, speckle: 0.26, weight: 1.08 },
    chrome: {
      light: {
        bg: "#efe8d9",
        bgElev: "#faf6ec",
        bgSunken: "#e2d9c6",
        fg: "#25211b",
        fgMuted: "#585044",
        fgSubtle: "#645c4d",
        line: "rgba(37,33,27,.12)",
        lineStrong: "rgba(37,33,27,.26)",
        accent: "#a3421d",
        accentFg: "#fff8ee",
        accentSoft: "rgba(168,69,31,.12)",
        focus: "#2d3e7c",
        scene: "radial-gradient(120% 78% at 50% 0%, #faf5ea 0%, #efe8d9 46%, #ded4be 100%)",
        status: { discovery: "#2d3e7c", pending: "#795b0d", verified: "#2a5937" },
        themeColor: "#efe8d9",
      },
      dark: {
        bg: "#161411",
        bgElev: "#221f1a",
        bgSunken: "#0e0d0b",
        fg: "#ece3d0",
        fgMuted: "#b2a892",
        fgSubtle: "#908877",
        line: "rgba(236,227,208,.10)",
        lineStrong: "rgba(236,227,208,.22)",
        accent: "#e88c5d",
        accentFg: "#20140c",
        accentSoft: "rgba(232,140,93,.14)",
        focus: "#a9b6f2",
        scene: "radial-gradient(120% 78% at 50% 0%, #2c2720 0%, #181613 50%, #0b0a08 100%)",
        status: { discovery: "#9dabea", pending: "#e0b450", verified: "#89c394" },
        themeColor: "#161411",
      },
    },
    lighting: {
      light: {
        passportShadow: lightShadow("44,34,20"),
        passportSheen: LIGHT_SHEEN,
        pageDim: "rgba(0,0,0,0)",
        sceneGlow: "radial-gradient(closest-side, rgba(182,151,107,.30), rgba(182,151,107,0))",
      },
      dark: {
        passportShadow: darkShadow("rgba(232,140,93,.22)"),
        passportSheen: DARK_SHEEN,
        pageDim: "rgba(22,20,17,.10)",
        sceneGlow: "radial-gradient(closest-side, rgba(232,140,93,.14), rgba(232,140,93,0))",
      },
    },
  },
};

export const DIRECTION_LIST: DirectionTokens[] = [DIRECTIONS.classic, DIRECTIONS.reef, DIRECTIONS.journal];
export const DEFAULT_DIRECTION: DirectionId = "classic";
export const DEFAULT_MODE: ThemeMode = "light";

export function getDirection(id: DirectionId): DirectionTokens {
  return DIRECTIONS[id] ?? DIRECTIONS[DEFAULT_DIRECTION];
}

export function isDirectionId(value: unknown): value is DirectionId {
  return value === "classic" || value === "reef" || value === "journal";
}

/* ------------------------------------------------------------------ */
/* Generated materials (used until real textures exist)                */
/* ------------------------------------------------------------------ */

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}")`;

/** Fine paper tooth: translucent dark specks, tiles seamlessly. */
function grainTile(opacity: number, frequency = 0.85, size = 220): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <filter id="g" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="3" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${(opacity * 2.4).toFixed(3)} ${(-opacity * 0.7).toFixed(3)}"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#g)"/>
  </svg>`);
}

/** Pebbled leather: a lit bump map in greys, blended over the cover colour with overlay. */
function leatherTile(): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <filter id="l" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="turbulence" baseFrequency="0.42" numOctaves="2" seed="11" stitchTiles="stitch" result="n"/>
      <feDiffuseLighting in="n" surfaceScale="2.1" diffuseConstant="0.92" lighting-color="#ffffff">
        <feDistantLight azimuth="235" elevation="52"/>
      </feDiffuseLighting>
    </filter>
    <rect width="100%" height="100%" filter="url(#l)"/>
  </svg>`);
}

/** Linen weave: fibre noise stretched along each thread direction. */
function linenTile(): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
    <filter id="h" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.62" numOctaves="2" seed="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.5 -0.56"/>
    </filter>
    <filter id="v" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.62 0.012" numOctaves="2" seed="9" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.56"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#h)" opacity=".5"/>
    <rect width="100%" height="100%" filter="url(#v)" opacity=".55"/>
  </svg>`);
}

/** Kraft board: an even tooth, soft mottling and a scatter of short pale and dark fibres. */
function kraftTile(): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
    <filter id="t" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="5" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.14  0 0 0 0 0.06  0 0 0 1.1 -0.36"/>
    </filter>
    <filter id="m" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="14" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.18  0 0 0 0 0.06  0 0 0 0.9 -0.34"/>
    </filter>
    <filter id="p" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.11 0.6" numOctaves="1" seed="21" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.94  0 0 0 0 0.8  0 0 0 9 -5.6"/>
    </filter>
    <filter id="d" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.5 0.06" numOctaves="1" seed="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.13  0 0 0 0 0.05  0 0 0 9 -5.8"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#m)"/>
    <rect width="100%" height="100%" filter="url(#t)" opacity=".8"/>
    <rect width="100%" height="100%" filter="url(#p)" opacity=".15"/>
    <rect width="100%" height="100%" filter="url(#d)" opacity=".2"/>
  </svg>`);
}

/** Security-paper guilloche: phase-shifted sine waves that weave into a lattice. Tiles both ways. */
function guillocheTile(p: Extract<PaperPattern, { kind: "guilloche" }>, color: string): string {
  const { wavelength: w, height: h, waves, stroke, opacity } = p;
  const steps = 24;
  const wave = (phase: number, amp: number, freq: number) => {
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const x = (w * i) / steps;
      const y = h / 2 + amp * Math.sin((2 * Math.PI * freq * i) / steps + phase);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(2)}`;
    }
    return d;
  };
  let paths = "";
  for (let i = 0; i < waves; i++) {
    const phase = (2 * Math.PI * i) / waves;
    paths += `<path d="${wave(phase, h / 2 - 0.5, 1)}"/>`;
  }
  for (let i = 0; i < 3; i++) {
    paths += `<path d="${wave((2 * Math.PI * i) / 3, h / 5, 2)}" opacity=".6"/>`;
  }
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <g fill="none" stroke="${color}" stroke-width="${stroke}" stroke-opacity="${opacity}">${paths}</g>
  </svg>`);
}

/** Watercolour washes: soft blobs with a torn, granulated edge. Stretched over the whole page. */
function washImage(p: Extract<PaperPattern, { kind: "wash" }>): string {
  const blobs = p.washes
    .map((b) => `<ellipse cx="${b.x * 4}" cy="${b.y * 6}" rx="${b.rx * 4}" ry="${b.ry * 6}" fill="${b.color}"/>`)
    .join("");
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600" preserveAspectRatio="none">
    <filter id="w" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="4" seed="8" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="130" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="9"/>
    </filter>
    <g filter="url(#w)" opacity="${p.opacity}">${blobs}</g>
  </svg>`);
}

interface Layer {
  image: string;
  size: string;
  repeat: string;
  blend: string;
}

const join = (layers: Layer[], key: keyof Layer) => layers.map((l) => l[key]).join(", ");

function coverLayers(d: DirectionTokens): Layer[] {
  const base: Layer = {
    image: `linear-gradient(155deg, ${d.cover.base} 0%, ${d.cover.deep} 100%)`,
    size: "100% 100%",
    repeat: "no-repeat",
    blend: "normal",
  };
  const photo = textureUrl(d.cover.texture);
  if (photo) {
    // A real photographed material (already in the cover colour) replaces the generated one.
    return [{ image: `url("${photo}")`, size: "cover", repeat: "no-repeat", blend: "normal" }];
  }
  if (d.cover.material === "leather") {
    return [{ image: leatherTile(), size: "300px 300px", repeat: "repeat", blend: "overlay" }, base];
  }
  if (d.cover.material === "linen") {
    return [{ image: linenTile(), size: "240px 240px", repeat: "repeat", blend: "soft-light" }, base];
  }
  return [{ image: kraftTile(), size: "320px 320px", repeat: "repeat", blend: "normal" }, base];
}

function paperLayers(d: DirectionTokens): Layer[] {
  const layers: Layer[] = [];
  const p = d.paper.pattern;
  if (p.kind === "guilloche") {
    layers.push({
      image: guillocheTile(p, d.paper.line),
      size: `${p.wavelength}px ${p.height}px`,
      repeat: "repeat",
      blend: "normal",
    });
  } else if (p.kind === "wash") {
    layers.push({ image: washImage(p), size: "100% 100%", repeat: "no-repeat", blend: "normal" });
  } else {
    const minor = hexToRgba(d.paper.line, p.opacity);
    const major = hexToRgba(d.paper.line, p.majorOpacity);
    const big = p.cell * p.major;
    layers.push(
      { image: `linear-gradient(to right, ${major} 1px, transparent 1px)`, size: `${big}px ${big}px`, repeat: "repeat", blend: "normal" },
      { image: `linear-gradient(to bottom, ${major} 1px, transparent 1px)`, size: `${big}px ${big}px`, repeat: "repeat", blend: "normal" },
      { image: `linear-gradient(to right, ${minor} 1px, transparent 1px)`, size: `${p.cell}px ${p.cell}px`, repeat: "repeat", blend: "normal" },
      { image: `linear-gradient(to bottom, ${minor} 1px, transparent 1px)`, size: `${p.cell}px ${p.cell}px`, repeat: "repeat", blend: "normal" },
    );
  }
  const photo = textureUrl("tex-paper");
  if (photo) {
    layers.push({ image: `url("${photo}")`, size: "512px 512px", repeat: "repeat", blend: "multiply" });
  } else {
    layers.push({ image: grainTile(0.055), size: "220px 220px", repeat: "repeat", blend: "normal" });
  }
  layers.push({
    image: `linear-gradient(180deg, ${d.paper.base} 0%, ${d.paper.shade} 100%)`,
    size: "100% 100%",
    repeat: "no-repeat",
    blend: "normal",
  });
  return layers;
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* ------------------------------------------------------------------ */
/* CSS generation                                                      */
/* ------------------------------------------------------------------ */

function block(selector: string, vars: Record<string, string | number>): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `${selector}{${body}}`;
}

function passportVars(d: DirectionTokens): Record<string, string | number> {
  const cover = coverLayers(d);
  const paper = paperLayers(d);
  const f = d.foil;
  return {
    "--ff-display": d.fonts.display,
    "--ff-body": d.fonts.body,
    "--ff-mono": d.fonts.mono,
    "--ff-stamp": d.fonts.stamp,
    "--display-weight": d.type.displayWeight,
    "--display-tracking": d.type.displayTracking,
    "--display-variation": d.type.displayVariation,
    "--stamp-weight": d.type.stampWeight,
    "--r-chip": d.radius.chip,
    "--r-card": d.radius.card,
    "--r-passport": d.radius.passport,
    "--r-page": d.radius.page,
    "--cover": d.cover.base,
    "--cover-deep": d.cover.deep,
    "--cover-edge": d.cover.edge,
    "--cover-ink": d.cover.ink,
    "--cover-image": join(cover, "image"),
    "--cover-size": join(cover, "size"),
    "--cover-repeat": join(cover, "repeat"),
    "--cover-blend": join(cover, "blend"),
    "--foil": f.base,
    "--foil-hi": f.hi,
    "--foil-lo": f.lo,
    "--foil-shadow": f.shadow,
    "--foil-gradient": `linear-gradient(118deg, ${f.lo} 0%, ${f.base} 18%, ${f.hi} 36%, ${f.base} 52%, ${f.lo} 70%, ${f.base} 86%, ${f.hi} 100%)`,
    "--paper": d.paper.base,
    "--paper-shade": d.paper.shade,
    "--paper-edge": d.paper.edge,
    "--paper-ink": d.paper.ink,
    "--paper-ink-muted": d.paper.inkMuted,
    "--paper-line": d.paper.line,
    "--paper-image": join(paper, "image"),
    "--paper-size": join(paper, "size"),
    "--paper-repeat": join(paper, "repeat"),
    "--paper-blend": join(paper, "blend"),
    "--ink-discovery": d.ink.discovery,
    "--ink-pending": d.ink.pending,
    "--ink-verified": d.ink.verified,
    "--ink-provincial": d.ink.provincial,
    "--ink-empty": d.ink.empty,
  };
}

function chromeVars(d: DirectionTokens, mode: ThemeMode): Record<string, string | number> {
  const c = d.chrome[mode];
  const l = d.lighting[mode];
  return {
    "--bg": c.bg,
    "--bg-elev": c.bgElev,
    "--bg-sunken": c.bgSunken,
    "--fg": c.fg,
    "--fg-muted": c.fgMuted,
    "--fg-subtle": c.fgSubtle,
    "--line": c.line,
    "--line-strong": c.lineStrong,
    "--accent": c.accent,
    "--accent-fg": c.accentFg,
    "--accent-soft": c.accentSoft,
    "--focus": c.focus,
    "--scene": c.scene,
    "--status-discovery": c.status.discovery,
    "--status-pending": c.status.pending,
    "--status-verified": c.status.verified,
    "--passport-shadow": l.passportShadow,
    "--passport-sheen": l.passportSheen,
    "--page-dim": l.pageDim,
    "--scene-glow": l.sceneGlow,
  };
}

/** All design tokens as CSS. Injected once in <head> by the root layout. */
export function directionsCss(): string {
  const out: string[] = [];
  for (const d of DIRECTION_LIST) {
    const sel = `[data-direction="${d.id}"]`;
    out.push(block(sel, { ...passportVars(d), ...chromeVars(d, "light") }));
  }
  // Dark rules come after every light rule so a nested direction scope inside a dark page wins.
  for (const d of DIRECTION_LIST) {
    const sel = `[data-direction="${d.id}"]`;
    out.push(block(`[data-theme="dark"] ${sel},${sel}[data-theme="dark"]`, chromeVars(d, "dark")));
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* Persistence keys and the no-flash boot script                       */
/* ------------------------------------------------------------------ */

export const STORAGE_KEYS = {
  direction: "ip.direction",
  mode: "ip.theme",
} as const;

/**
 * Runs in <head> before first paint: applies the stored direction and mode so there is no flash.
 * Plain ES5, wrapped in try/catch because storage throws in some in-app browsers.
 */
export const themeBootScript = `(function(){try{var e=document.documentElement,d=null,m=null;try{d=localStorage.getItem("${STORAGE_KEYS.direction}");m=localStorage.getItem("${STORAGE_KEYS.mode}")}catch(x){}if(d==="classic"||d==="reef"||d==="journal")e.setAttribute("data-direction",d);if(m!=="light"&&m!=="dark")m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";e.setAttribute("data-theme",m);e.style.colorScheme=m}catch(x){}})();`;
