/** Island data, search and photo slots for the globe landing. See docs/agents/v2-foundation.md. */
export {
  COMING_SOON_ISLANDS,
  FEATURED_ISLAND_ID,
  HOME_VIEW,
  ISLANDS,
  LIVE_ISLANDS,
  TOUR_ORDER,
  getIsland,
} from "./data";
export { PHOTO_NAMES, PHOTO_SLOTS, hasPhoto, photoAspect, photoAsset, photoSources, type PhotoAsset, type PhotoSlot } from "./photos";
export { highlightParts, normalise, searchIslands, type IslandSearchResult, type SearchField, type SearchOptions } from "./search";
export { islandStrings } from "./strings";
export { useIslandSearch, type IslandSearchState, type UseIslandSearchOptions } from "./useIslandSearch";
export { isLive } from "./types";
export type {
  BBox,
  ComingSoonIsland,
  ConservationProject,
  GlobeIsland,
  IslandCard,
  IslandFact,
  IslandPhoto,
  IslandStatus,
  IucnStatus,
  LiveIsland,
  LngLat,
  Metric,
  PartnerType,
  PhotoName,
  ReefInfo,
  Species,
  StampOffer,
  StampOfferKind,
  StampPartner,
  TourismImpact,
  Trend,
} from "./types";
