/**
 * Design options A, B and C for the globe landing.
 *
 * An "option" is a complete visual proposal for the same screen (globe, island zoom, island card).
 * It is a separate concept from the passport's art directions (classic, reef, journal in
 * src/lib/directions.ts): directions restyle the passport, options are three landings the client
 * picks between. Options are light only.
 */
export type OptionId = "a" | "b" | "c";

export const OPTION_IDS: readonly OptionId[] = ["a", "b", "c"] as const;

export const DEFAULT_OPTION: OptionId = "a";

export function isOptionId(value: unknown): value is OptionId {
  return value === "a" || value === "b" || value === "c";
}

/** localStorage key and URL query names. `?option=b&island=panglao` is a shareable link. */
export const OPTION_STORAGE_KEY = "ip.option";
export const OPTION_QUERY = "option";
export const ISLAND_QUERY = "island";

/**
 * Colours every shared piece reads (switcher, search, photo placeholder, globe poster).
 * They are published as CSS variables, `--o-<name>`, under `[data-option="x"]`.
 * An option may restate any of them on its own root element.
 */
export interface OptionPalette {
  /** Page background behind the globe. */
  bg: string;
  /** Second background stop, for a soft gradient behind the globe. */
  bgAlt: string;
  /** Cards, sheets, the search field. */
  surface: string;
  /** Body text. At least 7:1 on `bg` and `surface`. */
  ink: string;
  /** Secondary text. At least 4.5:1 on `bg` and `surface`. */
  inkMuted: string;
  /** Hairlines and borders. */
  line: string;
  /** Buttons, links, the selected island. At least 4.5:1 against `accentInk`. */
  accent: string;
  /** Text on `accent`. */
  accentInk: string;
  /** A tint of the accent for chips and hovers. */
  accentSoft: string;
  /** Second accent, for "coming soon" and decorative marks. */
  second: string;
  /** Globe: sea, land, vegetation tint, coastline and the atmosphere around the globe. */
  ocean: string;
  oceanDeep: string;
  land: string;
  green: string;
  shore: string;
  halo: string;
  /** Browser bar colour while this option is on screen. */
  themeColor: string;
}
