import type { Metadata, Viewport } from "next";
import {
  Archivo,
  Cinzel,
  Cormorant_Garamond,
  Fraunces,
  Hanken_Grotesk,
  IBM_Plex_Mono,
  Nunito,
  Special_Elite,
} from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { textureUrl } from "@/lib/assets";
import { DEFAULT_DIRECTION, DEFAULT_MODE, DIRECTIONS, directionsCss, themeBootScript } from "@/lib/directions";
import { strings } from "@/lib/strings";
import "./globals.css";

/*
 * Fonts. Each family is exposed as a --nf-* variable; src/lib/directions.ts maps them to the
 * semantic --ff-display / --ff-body / --ff-mono / --ff-stamp variables per art direction.
 * Only the default direction's faces are preloaded (text plus the cover title). The rest are
 * fetched when a direction that uses them is shown (UX-7).
 */

// Classic
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--nf-cormorant",
  display: "swap",
});
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--nf-hanken", display: "swap" });
// Cinzel is the Classic cover title, on the first screen: preload it so it does not swap in late.
const cinzel = Cinzel({ subsets: ["latin"], variable: "--nf-cinzel", display: "swap", preload: true });

// Reef
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  variable: "--nf-fraunces",
  display: "swap",
  preload: false,
});
const nunito = Nunito({ subsets: ["latin"], variable: "--nf-nunito", display: "swap", preload: false });

// Journal
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--nf-archivo",
  display: "swap",
  preload: false,
});
const specialElite = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--nf-special-elite",
  display: "swap",
  preload: false,
});

// Shared
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--nf-plex-mono",
  display: "swap",
  preload: false,
});

const fontVariables = [cormorant, hanken, cinzel, fraunces, nunito, archivo, specialElite, plexMono]
  .map((f) => f.variable)
  .join(" ");

/** Absolute base for the share-card image. Set NEXT_PUBLIC_SITE_URL where the demo is hosted. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3100");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: strings.app.metaTitle,
  description: strings.app.metaDescription,
  applicationName: strings.app.name,
  // The image itself comes from src/app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    siteName: strings.app.name,
    title: strings.app.metaTitle,
    description: strings.app.metaDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: strings.app.metaTitle,
    description: strings.app.metaDescription,
  },
};

/*
 * No themeColor here on purpose. Next would render <meta name="theme-color"> through React, and
 * the colour has to follow the art direction and mode at runtime. One node that React owns and
 * script also touches ends in "Cannot read properties of null (reading 'removeChild')" on the next
 * navigation. The meta is created by the inline script below and only ever updated in place.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Browser-bar colour per direction and mode, e.g. { classic: { light: "#f5f0e5", dark: "#080d1b" } }. */
const THEME_COLORS = Object.fromEntries(
  Object.values(DIRECTIONS).map((d) => [d.id, { light: d.chrome.light.themeColor, dark: d.chrome.dark.themeColor }]),
);

/** Cover texture per direction: the largest paint on the first screen, but only known to CSS. */
const COVER_TEXTURES = Object.fromEntries(Object.values(DIRECTIONS).map((d) => [d.id, textureUrl(d.cover.texture)]));

/**
 * Runs right after the theme boot script, so data-direction and data-theme are final.
 * 1. Creates the one <meta name="theme-color" data-ip> before first paint (ThemeProvider updates it).
 * 2. On the home page, preloads the cover texture of the direction that will actually be shown.
 */
const headBootScript = `(function(){try{var e=document.documentElement,h=document.head,d=e.getAttribute("data-direction"),m=e.getAttribute("data-theme")==="dark"?"dark":"light",c=${JSON.stringify(
  THEME_COLORS,
)},t=${JSON.stringify(COVER_TEXTURES)},k=c[d]||c[${JSON.stringify(
  DEFAULT_DIRECTION,
)}],n=document.createElement("meta");n.name="theme-color";n.setAttribute("data-ip","");n.content=k[m];h.appendChild(n);if(location.pathname==="/"&&t[d]){var l=document.createElement("link");l.rel="preload";l.as="image";l.href=t[d];l.setAttribute("fetchpriority","high");h.appendChild(l)}}catch(x){}})();`;

/**
 * The page is painted well before it hydrates on a slow phone, and a tap in that gap used to be
 * lost. This remembers the first one on the story button or the closed passport in
 * window.__ipEarly ("cta" or "cover"); the demo replays and clears it in its first effect.
 * The listener removes itself once it has a tap, and does nothing once window.__ipHydrated is set.
 * The empty touchstart listener is what makes iOS Safari apply :active to the button under the
 * finger, so the pressed state (CSS only, in demo.css) shows before hydration too.
 */
const earlyTapScript = `(function(){function off(){document.removeEventListener("pointerdown",on,true)}function on(ev){if(window.__ipHydrated){off();return}var t=ev.target;if(!t||!t.closest)return;var v=t.closest(".ipd-cta")?"cta":t.closest(".ipp-cover")||t.closest(".ipb")?"cover":"";if(v){window.__ipEarly=v;off()}}document.addEventListener("pointerdown",on,true);document.addEventListener("touchstart",function(){},{passive:true})})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-direction={DEFAULT_DIRECTION}
      data-theme={DEFAULT_MODE}
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        {/* Design tokens for all three art directions, generated from src/lib/directions.ts. */}
        <style id="ip-tokens" dangerouslySetInnerHTML={{ __html: directionsCss() }} />
        {/* Applies the saved direction and colour mode before first paint. */}
        <script id="ip-theme-boot" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Browser-bar colour and the cover texture preload for that direction and mode. */}
        <script id="ip-head-boot" dangerouslySetInnerHTML={{ __html: headBootScript }} />
        {/* Keeps a tap made before hydration. */}
        <script id="ip-early-tap" dangerouslySetInnerHTML={{ __html: earlyTapScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
