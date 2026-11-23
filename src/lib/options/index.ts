/** Option system (design options A, B, C for the globe landing). See docs/agents/v2-foundation.md. */
export { OptionProvider, useOption, useOptionMaybe, type OptionContextValue, type OptionProviderProps } from "./OptionProvider";
export { OPTION_PALETTES, optionsCss, paletteVars } from "./palettes";
export { optionBootScript } from "./boot";
export { optionStrings } from "./strings";
export {
  DEFAULT_OPTION,
  ISLAND_QUERY,
  OPTION_IDS,
  OPTION_QUERY,
  OPTION_STORAGE_KEY,
  isOptionId,
  type OptionId,
  type OptionPalette,
} from "./types";
export { DEFAULT_LAYOUT, LAYOUT_IDS, LAYOUT_QUERY, LAYOUT_STORAGE_KEY, THEMES_QUERY, isLayoutId, type LayoutId } from "./layouts";
