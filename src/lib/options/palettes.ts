/**
 * Starter palettes for the three options. Light only, on purpose: the client found the dark
 * treatment hard to read.
 *
 * These exist so the shared pieces look right before an option is designed. An option designer
 * is free to change their own entry here (ask the foundation owner) or, more simply, to restate
 * the `--o-*` variables on their landing's root element.
 */
import { OPTION_IDS, type OptionId, type OptionPalette } from "./types";

export const OPTION_PALETTES: Record<OptionId, OptionPalette> = {
  // A: lagoon. Cool, airy, sea-glass greens.
  a: {
    bg: "#f2fbfa",
    bgAlt: "#dff4f3",
    surface: "#ffffff",
    ink: "#0d2b33",
    inkMuted: "#44646b",
    line: "#cfe6e6",
    accent: "#0b7f7a",
    accentInk: "#ffffff",
    accentSoft: "#d6f1ee",
    second: "#e9824f",
    ocean: "#bfe9ee",
    oceanDeep: "#8fd3df",
    land: "#fdfbf1",
    green: "#cdeccd",
    shore: "#7cc7cf",
    halo: "#ffffff",
    themeColor: "#f2fbfa",
  },
  // B: sunwashed. Warm sand, coral and a soft seafoam sea.
  b: {
    bg: "#fff8ee",
    bgAlt: "#ffe9d2",
    surface: "#ffffff",
    ink: "#34221a",
    inkMuted: "#6f5648",
    line: "#f1dcc6",
    accent: "#c8472b",
    accentInk: "#ffffff",
    accentSoft: "#ffe2d6",
    second: "#1f8f8a",
    ocean: "#c9ece6",
    oceanDeep: "#9ddbd2",
    land: "#fff4dc",
    green: "#dfeec0",
    shore: "#f0a98c",
    halo: "#fff3df",
    themeColor: "#fff8ee",
  },
  // C: paper atlas. White paper, ink blue, a pale sky sea.
  c: {
    bg: "#f6f8fc",
    bgAlt: "#e6edfa",
    surface: "#ffffff",
    ink: "#111a33",
    inkMuted: "#4c5878",
    line: "#d8e0f0",
    accent: "#2b50d8",
    accentInk: "#ffffff",
    accentSoft: "#e1e8ff",
    second: "#e0683c",
    ocean: "#d7e6fb",
    oceanDeep: "#b3cdf5",
    land: "#ffffff",
    green: "#dcefdc",
    shore: "#8fb0ea",
    halo: "#ffffff",
    themeColor: "#f6f8fc",
  },
};

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** `--o-*` declarations for one palette, e.g. to put in a style attribute or a <style> block. */
export function paletteVars(palette: OptionPalette): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(palette)) vars[`--o-${kebab(key)}`] = value;
  return vars;
}

/** The stylesheet that publishes all three palettes under `[data-option]`. */
export function optionsCss(): string {
  return OPTION_IDS.map((id) => {
    const body = Object.entries(paletteVars(OPTION_PALETTES[id]))
      .map(([name, value]) => `${name}:${value}`)
      .join(";");
    return `[data-option="${id}"]{${body}}`;
  }).join("\n");
}
