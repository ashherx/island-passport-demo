/**
 * Sample passport for the demo (PUB-7: every person, promoter and charity here is fictional).
 *
 * Bohol has 12 stamp slots across 5 islands. Six are collected:
 *   2 Verified Supporter, 2 Donation pending, 2 Discovery, and 6 empty slots.
 * The ring therefore reads "6 of 12 Bohol stamps".
 *
 * The demo story this data is built for (see DEMO_SCRIPT):
 *   1. Collect "Spinner dolphins" on Pamilacan into its empty slot -> Discovery, 7 of 12
 *   2. Tap Donate on it                                            -> Donation pending
 *   3. The charity confirms it                                     -> 3 Verified
 *   4. Three Verified stamps reach the threshold                   -> Provincial Stamp awarded
 *
 * All dates fall in February 2027, inside the pilot window. Promoter handles end in ".sample" so
 * none can be mistaken for a real account.
 */
import type {
  Island,
  PassportData,
  PassportProgress,
  ProvincialStampDef,
  Stamp,
  StampArt,
  StampShape,
  StampSlot,
  StampStatus,
} from "./types";

export const SAMPLE_ISLANDS: Island[] = [
  {
    id: "bohol",
    name: "Bohol",
    province: "Bohol",
    blurb: "Limestone hills that turn cocoa-brown in the dry season, and forests where tarsiers wake at dusk.",
    subjects: ["Chocolate Hills", "Tarsier", "River mangroves"],
  },
  {
    id: "balicasag",
    name: "Balicasag",
    province: "Bohol",
    blurb: "A small coral island ringed by a reef wall where green turtles graze.",
    subjects: ["Sea turtle", "Reef wall"],
  },
  {
    id: "pamilacan",
    name: "Pamilacan",
    province: "Bohol",
    blurb: "Former whaling waters, now known for spinner dolphins at sunrise and a quiet beach where turtles nest.",
    subjects: ["Spinner dolphins", "Turtle nesting beach"],
  },
  {
    id: "banacon",
    name: "Banacon",
    province: "Bohol",
    blurb: "One of the largest planted mangrove forests in Asia, grown by hand over decades.",
    subjects: ["Mangrove forest", "Mangrove nursery"],
  },
  {
    id: "danajon",
    name: "Danajon Bank",
    province: "Bohol",
    blurb: "A rare double barrier reef and nursery for the fish of the central Visayas.",
    subjects: ["Double barrier reef", "Seagrass turtles", "Outer bank dolphins"],
  },
];

interface SlotSeed {
  id: string;
  islandId: string;
  art: StampArt;
  title: string;
  shape: StampShape;
  promoter: string;
  charity: string;
  purpose: string;
  /** Present when the sample traveler already holds this stamp. */
  held?: { status: StampStatus; date: string };
}

const SEEDS: SlotSeed[] = [
  // Bohol mainland
  {
    id: "bohol-chocolate-hills",
    islandId: "bohol",
    art: "stamp-chocolate-hills",
    title: "Chocolate Hills",
    shape: "rounded",
    promoter: "@sam.sample",
    charity: "Carmen Hills Green Fund",
    purpose: "Replanting native trees on the slopes around the hills.",
    held: { status: "verified", date: "2027-02-08" },
  },
  {
    id: "bohol-tarsier",
    islandId: "bohol",
    art: "stamp-tarsier",
    title: "Tarsier",
    shape: "circle",
    promoter: "@lena.sample",
    charity: "Night Forest Tarsier Fund",
    purpose: "Protecting forest corridors where tarsiers feed after dark.",
    held: { status: "pending", date: "2027-02-09" },
  },
  {
    id: "bohol-river-mangroves",
    islandId: "bohol",
    art: "stamp-mangroves",
    title: "River mangroves",
    shape: "oval",
    promoter: "@tide.sample",
    charity: "Loboc River Mangrove Fund",
    purpose: "Restoring nipa and mangrove along the river mouth.",
  },
  // Balicasag
  {
    id: "balicasag-sea-turtle",
    islandId: "balicasag",
    art: "stamp-sea-turtle",
    title: "Sea turtle",
    shape: "scalloped",
    promoter: "@sam.sample",
    charity: "Bohol Reef Trust",
    purpose: "Mooring buoys so boats stop anchoring on turtle feeding grounds.",
    held: { status: "verified", date: "2027-02-11" },
  },
  {
    id: "balicasag-reef",
    islandId: "balicasag",
    art: "stamp-reef",
    title: "Reef wall",
    shape: "octagon",
    promoter: "@mia.sample",
    charity: "Bohol Reef Trust",
    purpose: "Coral gardening on storm-damaged sections of the reef wall.",
    held: { status: "discovery", date: "2027-02-11" },
  },
  // Pamilacan. The dolphin slot is the one the demo story follows (see DEMO_SCRIPT): it starts
  // empty, and the island's page text is about the same dolphins.
  {
    id: "pamilacan-dolphins",
    islandId: "pamilacan",
    art: "stamp-dolphins",
    title: "Spinner dolphins",
    shape: "circle",
    promoter: "@mia.sample",
    charity: "Pamilacan Sea Life Fund",
    purpose: "Quiet-boat training for local dolphin-watch guides.",
  },
  {
    id: "pamilacan-turtle-beach",
    islandId: "pamilacan",
    art: "stamp-sea-turtle",
    title: "Turtle nesting beach",
    shape: "oval",
    promoter: "@lena.sample",
    charity: "Pamilacan Sea Life Fund",
    purpose: "Night patrols that guard turtle nests until they hatch.",
    held: { status: "pending", date: "2027-02-13" },
  },
  // Banacon
  {
    id: "banacon-mangroves",
    islandId: "banacon",
    art: "stamp-mangroves",
    title: "Mangrove forest",
    shape: "circle",
    promoter: "@tide.sample",
    charity: "Banacon Mangrove Keepers",
    purpose: "Planting and tending mangrove seedlings with island families.",
    held: { status: "discovery", date: "2027-02-15" },
  },
  {
    id: "banacon-nursery",
    islandId: "banacon",
    art: "stamp-mangroves",
    title: "Mangrove nursery",
    shape: "rounded",
    promoter: "@sam.sample",
    charity: "Banacon Mangrove Keepers",
    purpose: "A seedling nursery run by the island school.",
  },
  // Danajon Bank
  {
    id: "danajon-reef",
    islandId: "danajon",
    art: "stamp-reef",
    title: "Double barrier reef",
    shape: "scalloped",
    promoter: "@tide.sample",
    charity: "Bohol Reef Trust",
    purpose: "Community patrols for the no-take zones on the inner reef.",
  },
  {
    id: "danajon-seagrass",
    islandId: "danajon",
    art: "stamp-sea-turtle",
    title: "Seagrass turtles",
    shape: "octagon",
    promoter: "@mia.sample",
    charity: "Bohol Reef Trust",
    purpose: "Mapping and protecting seagrass meadows where turtles feed.",
  },
  {
    id: "danajon-dolphins",
    islandId: "danajon",
    art: "stamp-dolphins",
    title: "Outer bank dolphins",
    shape: "rounded",
    promoter: "@lena.sample",
    charity: "Danajon Bank Fishers Fund",
    purpose: "Quiet-engine boat grants for outer bank fishers.",
  },
];

const islandName = (id: string) => SAMPLE_ISLANDS.find((i) => i.id === id)?.name ?? id;

/** Slot seeds keep promoter, charity and purpose even when empty, so the demo can stamp any slot. */
const SEED_BY_ID = new Map(SEEDS.map((s) => [s.id, s]));

/** Build the stamp that a slot would hold at the given status and date. */
export function stampForSlot(slotId: string, status: StampStatus, date: string): Stamp {
  const seed = SEED_BY_ID.get(slotId);
  if (!seed) throw new Error(`Unknown stamp slot: ${slotId}`);
  return {
    id: seed.id,
    art: seed.art,
    title: seed.title,
    island: islandName(seed.islandId),
    islandId: seed.islandId,
    promoter: seed.promoter,
    charity: seed.charity,
    purpose: seed.purpose,
    date,
    status,
    kind: "island",
    shape: seed.shape,
  };
}

function buildSlots(): StampSlot[] {
  return SEEDS.map((seed) => ({
    id: seed.id,
    islandId: seed.islandId,
    island: islandName(seed.islandId),
    art: seed.art,
    title: seed.title,
    shape: seed.shape,
    kind: "island" as const,
    stamp: seed.held ? stampForSlot(seed.id, seed.held.status, seed.held.date) : null,
  }));
}

export const SAMPLE_PROVINCIAL: ProvincialStampDef = {
  id: "provincial-bohol",
  art: "stamp-provincial",
  province: "Bohol",
  requiredVerified: 3,
  earned: false,
  stamp: {
    id: "provincial-bohol",
    art: "stamp-provincial",
    title: "Provincial Stamp",
    island: "Bohol",
    islandId: "bohol",
    promoter: "",
    charity: "",
    purpose: "Awarded for three Verified Supporter stamps in the province of Bohol.",
    date: "2027-02-16",
    status: "verified",
    kind: "provincial",
    shape: "seal",
  },
};

export const SAMPLE_PASSPORT: PassportData = {
  id: "sample-passport",
  sample: true,
  holder: {
    name: "Alex Rivera",
    handle: "@alex.afield",
    passportNo: "IP-BOH-004217",
    memberSince: "2027-02-08",
  },
  country: "Philippines",
  countryCode: "PH",
  province: "Bohol",
  islands: SAMPLE_ISLANDS,
  slots: buildSlots(),
  provincial: SAMPLE_PROVINCIAL,
};

/** Suggested beats for the demo, so every agent animates the same stamps. */
export const DEMO_SCRIPT = {
  /**
   * Empty slot that receives a new Discovery stamp in the stamping moment: the spinner dolphins of
   * Pamilacan, which is what the island's own page talks about. The home-page story follows this
   * one stamp through all three statuses (see components/demo/story.ts).
   */
  collectSlotId: "pamilacan-dolphins",
  /** Pending stamp that upgrades to Verified Supporter in the labs. Brings Verified to 3 of 3. */
  upgradeSlotId: "pamilacan-turtle-beach",
  /** Date printed on stamps earned during the demo. */
  today: "2027-02-16",
} as const;

/* ------------------------------------------------------------------ */
/* Helpers (pure: they return new objects, never mutate)               */
/* ------------------------------------------------------------------ */

export function getProgress(passport: PassportData): PassportProgress {
  const counts = { discovery: 0, pending: 0, verified: 0 };
  for (const slot of passport.slots) if (slot.stamp) counts[slot.stamp.status] += 1;
  const collected = counts.discovery + counts.pending + counts.verified;
  const total = passport.slots.length;
  return {
    collected,
    total,
    ...counts,
    empty: total - collected,
    ratio: total ? collected / total : 0,
    toProvincial: Math.max(0, passport.provincial.requiredVerified - counts.verified),
  };
}

export function slotsByIsland(passport: PassportData): { island: Island; slots: StampSlot[] }[] {
  return passport.islands.map((island) => ({
    island,
    slots: passport.slots.filter((s) => s.islandId === island.id),
  }));
}

export function collectedStamps(passport: PassportData): Stamp[] {
  return passport.slots.flatMap((s) => (s.stamp ? [s.stamp] : []));
}

export function findSlot(passport: PassportData, slotId: string): StampSlot | undefined {
  return passport.slots.find((s) => s.id === slotId);
}

/** Set a slot to a status (collecting it if empty). Returns a new passport. */
export function withStampStatus(
  passport: PassportData,
  slotId: string,
  status: StampStatus,
  date: string = DEMO_SCRIPT.today,
): PassportData {
  return {
    ...passport,
    slots: passport.slots.map((slot) =>
      slot.id === slotId ? { ...slot, stamp: stampForSlot(slotId, status, slot.stamp?.date ?? date) } : slot,
    ),
  };
}

/** Mark the Provincial Stamp as awarded. Returns a new passport. */
export function withProvincialEarned(passport: PassportData, date: string = DEMO_SCRIPT.today): PassportData {
  return {
    ...passport,
    provincial: { ...passport.provincial, earned: true, stamp: { ...passport.provincial.stamp, date } },
  };
}

/** True once the traveler holds enough Verified stamps for the Provincial Stamp (STM-4a). */
export function provincialUnlocked(passport: PassportData): boolean {
  return getProgress(passport).verified >= passport.provincial.requiredVerified;
}
