/**
 * Option B, "Illustrated Voyage": the colours, shared by the map style (which cannot read CSS
 * variables) and the stylesheet (b.css restates them as --ob-* on the landing's root).
 *
 * A warm paper page, an indigo ink line, a watercolour sea, sage and sand land, and three sticker
 * colours (vermilion stamp ink, sunflower highlighter, lagoon teal). Text colours are checked
 * against the paper for WCAG AA (TEC-9): ink 12.4:1, inkSoft 5.8:1, stamp 4.6:1, lagoon 5.3:1.
 */
export const INK = {
  paper: "#fff8ec",
  paperDeep: "#f8ecd4",
  card: "#fffdf7",
  ink: "#27304a",
  inkSoft: "#59607a",
  rule: "#e6d8bb",

  /** Vermilion stamp ink: buttons, live islands, the stamp impressions. */
  stamp: "#c9442a",
  stampSoft: "#fbe0d5",
  /** Sunflower: highlighter strokes, washi tape, the selected island. */
  sun: "#f6c445",
  sunSoft: "#fdefc4",
  /** Lagoon teal: links, water figures, secondary stickers. */
  lagoon: "#17746f",
  lagoonSoft: "#d3efe8",
  /** Sage: land figures, conservation. */
  sage: "#5c7a3d",
  sageSoft: "#e3edcf",
  blush: "#f3b9a6",
} as const;

/** Map colours. */
export const MAP = {
  ocean: "#bfe6df",
  oceanLight: "#e4f6f1",
  oceanDeep: "#8fcfca",
  /** The ink the coast and its ripple lines are drawn in. */
  coast: "#2f7480",
  land: "#fbf0d3",
  landShade: "#efdfb8",
  sage: "#c4d7a4",
  wood: "#aecb92",
  woodInk: "#6f9457",
  sand: "#f7e2a8",
  ice: "#ffffff",
  river: "#6dbdc4",
  road: "#c9643f",
  roadMinor: "#d9a27f",
  building: "#edd3ad",
  buildingInk: "#b98f66",
  border: "#b06a4c",
  label: "#27304a",
  labelSoft: "#5b5f73",
  waterLabel: "#2f7480",
  halo: "#fff8ec",
  /** Islands. */
  liveFill: "#ffd76a",
  liveInk: "#27304a",
  soonFill: "#f1e3c2",
  soonInk: "#7b7f92",
  glow: "#f6a23c",
  highlighter: "#ffd447",
  route: "#c9442a",
} as const;
