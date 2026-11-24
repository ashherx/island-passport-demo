/**
 * Types for the share flows (part 3 of the demo). Sample data: ./sample.ts. URL helpers: ./urls.ts.
 * Notes for the next agents: docs/agents/p3-kit.md
 *
 * Everything these types describe is fictional sample content (PUB-7).
 */
import type { PartnerType, PhotoName, StampOfferKind } from "@/lib/islands/types";
import type { PassportData, Stamp, StampArt, StampShape } from "@/lib/types";

/** The partner types the share flows show. Any of them can offer a stamp. */
export type SharePartnerType = Extract<PartnerType, "creator" | "travel-agency" | "establishment" | "charity" | "tourism-board">;

/** Who is sharing: a partner promoting an island, or a traveler sharing their own passport. */
export type ShareAudience = "partner" | "traveler";

/** Initials on a tinted disc. No photos of people anywhere in the demo. */
export interface ShareAvatar {
  initials: string;
  /** Two colours for the disc gradient, light to deep. */
  tint: [string, string];
}

/** The stamp (or seal) a partner offers to people who arrive through their link. */
export interface ShareOffer {
  kind: StampOfferKind;
  title: string;
  art: StampArt;
  shape: StampShape;
  /**
   * EXAMPLE figure only: real thresholds are set with each organisation. Always print
   * `threshold.display` next to `EXAMPLE_THRESHOLD_NOTE` (./sample.ts).
   */
  threshold: { amount: number; currency: "USD"; display: string; example: true };
  /** Receives the donation on its own platform and confirms it. Island Passport never holds money. */
  charity: string;
  /** What the donation pays for. */
  purpose: string;
  /** Matching slot in the sample passport (src/lib/sample-data.ts), when there is one. */
  passportSlotId?: string;
}

/** Sample dashboard figures for a partner. All invented. */
export interface SharePartnerStats {
  /** Donations confirmed by charities for people who arrived through this partner's links. */
  donationsGenerated: { amount: number; display: string; donors: number };
  stampsIssued: number;
  /** Stamps waiting for the charity's confirmation. */
  stampsPending: number;
  linkVisits: number;
  /** Posts shared this year against the suggested six. */
  postsThisYear: number;
  postsGoal: number;
}

export interface SharePartner {
  kind: "partner";
  id: string;
  /** Short affiliate code: lower-case letters and digits only, no hyphen. Goes in /s/<code>. */
  code: string;
  type: SharePartnerType;
  name: string;
  /** "@mia.sample" for creators, otherwise a short locator such as "Alona Beach, Panglao". */
  handle: string;
  /** Handle used on post previews (always starts with "@" and ends in ".sample"). */
  socialHandle: string;
  avatar: ShareAvatar;
  blurb: string;
  /** Islands the partner can promote, ids from src/lib/islands. The first is the default. */
  islandIds: string[];
  offer: ShareOffer;
  stats: SharePartnerStats;
  /** True for partners that would also place the embed on their own website. */
  hasWebsite: boolean;
}

export interface ShareTraveler {
  kind: "traveler";
  id: string;
  /** Short affiliate code, same rules as a partner's. */
  code: string;
  name: string;
  handle: string;
  socialHandle: string;
  avatar: ShareAvatar;
  /** The passport demo's sample passport (src/lib/sample-data.ts). */
  passport: PassportData;
  /** Stamps the traveler holds, in passport order. */
  stamps: Stamp[];
  /** The stamp the share flow starts from: the one just collected. */
  featuredStamp: Stamp;
  /** "Scan to help my charity": the charity behind the featured stamp. */
  charity: string;
  /** Islands with at least one stamp, ids from src/lib/islands where the island exists there. */
  islandIds: string[];
  /** Sample figures for "your link so far". */
  stats: { linkVisits: number; friendsJoined: number; donationsGenerated: { amount: number; display: string; donors: number } };
}

export type ShareOwner = SharePartner | ShareTraveler;

/** How a Ken Burns scene moves. "in" and "out" zoom; the rest pan across the photo. */
export type ReelMove = "in" | "out" | "left" | "right" | "up" | "down";

export interface ReelScene {
  photo: PhotoName;
  /** One short line shown over the scene. */
  line: string;
  /** Seconds on screen, including the crossfade into the next scene. */
  seconds: number;
  move: ReelMove;
  /** Where the crop is anchored when the photo is wider or taller than the frame, 0 to 100 each. */
  focus?: [number, number];
}

/** One of the six prepared island videos: a photo sequence the reel player animates. */
export interface IslandReel {
  id: string;
  islandId: string;
  /** 1 to 6, the order they are offered in. */
  number: number;
  title: string;
  /** One line for the picker. */
  summary: string;
  /** Theme chip in the picker, e.g. "Wildlife". */
  theme: string;
  scenes: ReelScene[];
  /** Seconds the end card (QR code and link) stays up. */
  endCardSeconds: number;
  /** Stamp line art printed on the end card. */
  art: StampArt;
}

export interface CaptionSuggestion {
  id: string;
  /** Tone chip, e.g. "Warm", "Short", "Facts first". */
  tone: string;
  text: string;
}

/** What a share code points at. */
export type ShareResolution =
  | { kind: "partner"; code: string; partner: SharePartner; islandId: string }
  | { kind: "traveler"; code: string; traveler: ShareTraveler; islandId: string };
