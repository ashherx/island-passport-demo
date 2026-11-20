/**
 * Passport content: cover art, page designs and the stamp detail sheet.
 * See docs/agents/pages.md.
 */
export {
  buildPassportPages,
  getPassportPageMap,
  usePassportContent,
  type UsePassportContentResult,
} from "./buildPassportPages";
export type { BuildPassportOptions, PassportContent, PassportPageMap, SlotOverride } from "./types";
export { FrontCover, BackCover, requestCoverMotion, type CoverProps } from "./Cover";
export { HolderPage, ProvincePage, ProvincialPage } from "./Pages";
export { IslandPage, SlotView, type IslandPageProps, type SlotViewProps } from "./IslandPage";
export { StampDetailSheet, type StampDetailSheetProps } from "./StampDetailSheet";
export { Frame, Page, usePageMetrics, usePageScale, useStampPx, PAGE_UNITS, PAGE_UNITS_HIGH, type PageMetrics } from "./PageFrame";
export { ProvinceChartArt, getChart, getPlace } from "./chart";
export { emblemSvg, svgDataUrl } from "./patterns";
export { contentStrings } from "./strings";
