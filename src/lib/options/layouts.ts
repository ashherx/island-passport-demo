/**
 * Layouts of the globe landing.
 *
 * A layout arranges the same landing (headline, search, island chips, globe, island card) in a
 * different way: where the globe sits, where the search goes, how the flight to an island feels.
 * It is a separate idea from a design option (types.ts): the option is the look, the layout is
 * the arrangement. Only option A ("Daylight Atlas") has layouts; its modules live in
 * src/options/a/layouts, one per layout. Handoff notes: docs/agents/v2-layouts.md
 *
 * To add a layout: add its id here (the boot script and the switcher follow), then register its
 * module in src/options/a/layouts/index.ts.
 */
export type LayoutId = "split" | "horizon" | "orb" | "fullbleed";

/** In the order the switcher shows them. Planned next: "carousel", "story". */
export const LAYOUT_IDS: readonly LayoutId[] = ["split", "horizon", "orb", "fullbleed"] as const;

export const DEFAULT_LAYOUT: LayoutId = "horizon";

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === "string" && (LAYOUT_IDS as readonly string[]).includes(value);
}

/** localStorage key and URL query name. `?layout=horizon&island=bohol` is a shareable link. */
export const LAYOUT_STORAGE_KEY = "ip.layout";
export const LAYOUT_QUERY = "layout";

/** `?themes=1` brings back the A · B · C design-option pill, which is otherwise hidden. */
export const THEMES_QUERY = "themes";
