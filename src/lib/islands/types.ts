/**
 * Island data for the globe landing and the island card.
 *
 * Nothing here is tied to one country (TEC-11): country, region, currency and map area are all
 * fields. Adding an island is a data change: a record in data.ts, an entry in osm-sources.json and
 * one run of scripts/fetch-coastlines.mjs for its outline.
 *
 * Every number and organisation in the demo data is sample content (PUB-7).
 */
import type { StampArt, StampShape } from "@/lib/types";

/** [longitude, latitude] in degrees, the order MapLibre and GeoJSON use. */
export type LngLat = [number, number];

/** [west, south, east, north] in degrees. */
export type BBox = [number, number, number, number];

/** `live`: participating, has a full card. `coming-soon`: shown dimmed on the globe, teaser only. */
export type IslandStatus = "live" | "coming-soon";

/** Photo slots the user fills (see scripts/process-photos.py). */
export type PhotoName =
  | "bohol-hero"
  | "bohol-chocolate-hills"
  | "bohol-alona-beach"
  | "bohol-balicasag-reef"
  | "bohol-tarsier"
  | "bohol-pamilacan-dolphins"
  | "bohol-mangroves"
  | "bohol-reef-aerial"
  | "bohol-coral-closeup"
  | "bohol-conservation"
  | "bohol-loboc-river";

export interface IslandPhoto {
  name: PhotoName;
  /** Describes the picture for screen readers. */
  alt: string;
  /** Short line shown under or over the picture. */
  caption: string;
}

export type Trend = "up" | "down" | "steady";

/** One figure with its label, already formatted for display. */
export interface Metric {
  id: string;
  label: string;
  /** Raw number, for charts and meters. */
  value: number;
  /** Ready to print, e.g. "24 m" or "1.2M". */
  display: string;
  unit?: string;
  /** Upper end of a meter, when the figure reads well as one (e.g. 100 for a percentage). */
  max?: number;
  trend?: Trend;
  /** One plain sentence of context. */
  note?: string;
}

/** IUCN Red List categories, least to most threatened. */
export type IucnStatus = "LC" | "NT" | "VU" | "EN" | "CR";

export interface Species {
  id: string;
  name: string;
  scientific: string;
  iucn: IucnStatus;
  /** Why it matters here. */
  note: string;
  /** Line illustration from public/stamps that suits it, when there is one. */
  art?: StampArt;
  photo?: PhotoName;
}

export interface ReefInfo {
  /** A single sample score, 0 to 100, that sums up the reef for a first-time visitor. */
  healthIndex: { value: number; max: 100; label: string; trend: Trend };
  summary: string;
  /** Visibility, live coral cover, water temperature and similar. */
  metrics: Metric[];
  /** When the sample survey is dated, already formatted. */
  updated: string;
  photo?: PhotoName;
}

export interface TourismImpact {
  summary: string;
  stats: Metric[];
  /** What visitor numbers put under strain. */
  pressures: string[];
  /** What a visitor can do about it. */
  tips: string[];
}

export interface ConservationProject {
  id: string;
  title: string;
  /** The organisation running it. A partner id from the same island when it offers a stamp. */
  organisation: string;
  partnerId?: string;
  summary: string;
  /** Progress toward a target, e.g. 12,400 of 20,000 seedlings. */
  progress?: { value: number; target: number; unit: string; display: string };
  photo?: PhotoName;
  art?: StampArt;
}

/** Any of these can offer a stamp. */
export type PartnerType =
  | "creator"
  | "travel-agency"
  | "establishment"
  | "charity"
  | "tourism-board"
  | "government"
  | "sponsor";

/** `stamp`: an ordinary island stamp. The two seals are official marks with higher thresholds. */
export type StampOfferKind = "stamp" | "tourism-seal" | "government-seal";

export interface StampOffer {
  kind: StampOfferKind;
  title: string;
  art: StampArt;
  shape: StampShape;
  /**
   * Donation that earns it. EXAMPLE figures only: the real thresholds are set with each
   * organisation. Island Passport never collects the money; it goes to `charity` on the
   * charity's own platform.
   */
  threshold: { amount: number; currency: string; display: string };
  /** The charity that receives the donation and confirms it. */
  charity: string;
  /** What the donation pays for. */
  purpose: string;
  /** Matching slot in the sample passport (src/lib/sample-data.ts), when there is one. */
  passportSlotId?: string;
}

export interface StampPartner {
  id: string;
  name: string;
  type: PartnerType;
  /** Social handle or short locator, e.g. "@mia.sample" or "Alona Beach". */
  handle?: string;
  blurb: string;
  offer: StampOffer;
}

export interface IslandFact {
  label: string;
  value: string;
}

/** Everything the island card shows, in the client's section order. */
export interface IslandCard {
  /** Island description and photos. */
  description: { headline: string; body: string[]; facts: IslandFact[] };
  hero: IslandPhoto;
  photos: IslandPhoto[];
  tourism: TourismImpact;
  species: Species[];
  reef: ReefInfo;
  projects: ConservationProject[];
  partners: StampPartner[];
}

interface IslandBase {
  id: string;
  name: string;
  /** Other names people search for. */
  aliases: string[];
  country: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  /** Province, state or island group. */
  region: string;
  /** Where the label and the marker sit: the visual centre of the outline. */
  coordinates: LngLat;
  /** Extent of the outline; the camera frames this when the island is selected. */
  bbox: BBox;
  areaKm2: number;
  /** 1: marked from globe altitude. 2: appears once the camera is over its region. */
  rank: 1 | 2;
  /** The larger island this one belongs with (the four small Bohol islands point to "bohol"). */
  parentId?: string;
  /** One line under the name. */
  tagline: string;
  /** Camera overrides for the dive. */
  view?: { maxZoom?: number; bearing?: number; pitch?: number };
}

export interface LiveIsland extends IslandBase {
  status: "live";
  card: IslandCard;
}

export interface ComingSoonIsland extends IslandBase {
  status: "coming-soon";
  /** Two sentences for the "coming soon" teaser. */
  teaser: string;
}

/** An island on the globe. (The passport has its own, smaller `Island` type in src/lib/types.ts.) */
export type GlobeIsland = LiveIsland | ComingSoonIsland;

export function isLive(island: GlobeIsland | null | undefined): island is LiveIsland {
  return island?.status === "live";
}
