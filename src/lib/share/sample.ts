/**
 * Sample data for the share flows. Every partner, handle, charity, figure and caption here is
 * FICTIONAL sample content (PUB-7): show the SAMPLE tag wherever it is printed.
 *
 * Product rules this data is written to respect:
 *   - No passwords: sign-in is a one-time code, with a magic link in the same email.
 *   - Island Passport never collects donations. A donation happens on the charity's own platform;
 *     the stamp is issued when the charity's confirmation reaches its private (tokenized) email
 *     address. Until then the stamp is "pending confirmation".
 *   - Any partner type can offer a stamp.
 *   - Thresholds ($5 stamp, about $50 tourism seal, about $100 government seal) are EXAMPLES.
 */
import { getIsland } from "@/lib/islands/data";
import { DEMO_SCRIPT, SAMPLE_PASSPORT, stampForSlot } from "@/lib/sample-data";
import type { Stamp, StampStatus } from "@/lib/types";
import type {
  CaptionSuggestion,
  IslandReel,
  ShareOwner,
  SharePartner,
  SharePartnerType,
  ShareTraveler,
} from "./types";

/* ------------------------------------------------------------------ */
/* Copy that has to be worded the same everywhere                      */
/* ------------------------------------------------------------------ */

export const shareCopy = {
  sampleTag: "Sample",
  sampleNotice: "Sample concept demo. Partners, handles, charities and figures are fictional.",
  /** Print next to every threshold figure. */
  exampleThreshold: "Example amount. Real thresholds are set with each organisation.",
  /** {charity} */
  noDonations: "Island Passport never collects donations. You give on {charity}'s own page.",
  /** {charity} */
  pending: "Pending confirmation. Your stamp is issued once {charity} confirms the donation.",
  noPasswords: "No password. We email a one-time code, with a sign-in link as a backup.",
  scanToSupport: "Scan to support",
  /** The suggested posting rhythm Dan described. */
  postsGoal: "Six posts a year keeps your seal progress moving.",
  formats: { feed: "Feed post", story: "Story", short: "Short video" },
  partnerTypes: {
    creator: "Creator",
    "travel-agency": "Travel agency",
    establishment: "Establishment",
    charity: "Charity",
    "tourism-board": "Tourism board",
  } satisfies Record<SharePartnerType, string>,
} as const;

/** Example thresholds, for a legend. Never print one without `shareCopy.exampleThreshold`. */
export const EXAMPLE_THRESHOLDS = [
  { kind: "stamp", label: "Island stamp", display: "$5" },
  { kind: "tourism-seal", label: "Tourism board seal", display: "about $50" },
  { kind: "government-seal", label: "Government seal", display: "about $100" },
] as const;

/* ------------------------------------------------------------------ */
/* Partners                                                            */
/* ------------------------------------------------------------------ */

const usd = (amount: number) => ({ amount, currency: "USD" as const, display: `$${amount}`, example: true as const });

export const SAMPLE_PARTNERS: SharePartner[] = [
  {
    kind: "partner",
    id: "mia-sample",
    code: "mia",
    type: "creator",
    name: "Mia Sample",
    handle: "@mia.sample",
    socialHandle: "@mia.sample",
    avatar: { initials: "MS", tint: ["#ffd9c2", "#ee8a5c"] },
    blurb: "Freediver sharing reef etiquette in sixty seconds.",
    islandIds: ["bohol", "panglao", "balicasag", "pamilacan"],
    offer: {
      kind: "stamp",
      title: "Sea turtle",
      art: "stamp-sea-turtle",
      shape: "scalloped",
      threshold: usd(5),
      charity: "Coral Trust",
      purpose: "Coral gardening on storm-damaged sections of the reef wall.",
      passportSlotId: "balicasag-sea-turtle",
    },
    stats: {
      donationsGenerated: { amount: 1840, display: "$1,840", donors: 212 },
      stampsIssued: 212,
      stampsPending: 9,
      linkVisits: 6420,
      postsThisYear: 4,
      postsGoal: 6,
    },
    hasWebsite: false,
  },
  {
    kind: "partner",
    id: "isla-trips",
    code: "islatrips",
    type: "travel-agency",
    name: "Isla Trips",
    handle: "Tagbilaran, Bohol",
    socialHandle: "@islatrips.sample",
    avatar: { initials: "IT", tint: ["#cfeefb", "#3d8fc4"] },
    blurb: "Small-group island days with licensed boats and local guides.",
    islandIds: ["bohol", "pamilacan", "balicasag", "banacon"],
    offer: {
      kind: "stamp",
      title: "River mangroves",
      art: "stamp-mangroves",
      shape: "oval",
      threshold: usd(5),
      charity: "Coral Trust",
      purpose: "Restoring nipa and mangrove along the river mouth.",
      passportSlotId: "bohol-river-mangroves",
    },
    stats: {
      donationsGenerated: { amount: 3275, display: "$3,275", donors: 388 },
      stampsIssued: 388,
      stampsPending: 14,
      linkVisits: 9105,
      postsThisYear: 3,
      postsGoal: 6,
    },
    hasWebsite: true,
  },
  {
    kind: "partner",
    id: "bohol-dive-co",
    code: "boholdive",
    type: "establishment",
    name: "Bohol Dive Co.",
    handle: "Alona Beach, Panglao",
    socialHandle: "@boholdive.sample",
    avatar: { initials: "BD", tint: ["#c9f3ee", "#0a827e"] },
    blurb: "Dive shop that ties up at buoys and briefs every guest.",
    islandIds: ["panglao", "balicasag", "bohol"],
    offer: {
      kind: "stamp",
      title: "Reef wall",
      art: "stamp-reef",
      shape: "octagon",
      threshold: usd(5),
      charity: "Coral Trust",
      purpose: "Mooring buoys so boats stop anchoring on the reef.",
      passportSlotId: "balicasag-reef",
    },
    stats: {
      donationsGenerated: { amount: 960, display: "$960", donors: 131 },
      stampsIssued: 131,
      stampsPending: 6,
      linkVisits: 2890,
      postsThisYear: 2,
      postsGoal: 6,
    },
    hasWebsite: true,
  },
  {
    kind: "partner",
    id: "coral-trust",
    code: "coraltrust",
    type: "charity",
    name: "Coral Trust",
    handle: "Reef conservation charity",
    socialHandle: "@coraltrust.sample",
    avatar: { initials: "CT", tint: ["#d6f5d9", "#3f9a6a"] },
    blurb: "Runs community reef patrols and coral gardens across Bohol.",
    islandIds: ["bohol", "balicasag", "panglao", "banacon"],
    offer: {
      kind: "stamp",
      title: "Double barrier reef",
      art: "stamp-reef",
      shape: "scalloped",
      threshold: usd(5),
      charity: "Coral Trust",
      purpose: "Community patrols for the no-take zones on the inner reef.",
      passportSlotId: "danajon-reef",
    },
    stats: {
      donationsGenerated: { amount: 12480, display: "$12,480", donors: 1304 },
      stampsIssued: 1304,
      stampsPending: 41,
      linkVisits: 18230,
      postsThisYear: 5,
      postsGoal: 6,
    },
    hasWebsite: true,
  },
  {
    kind: "partner",
    id: "visayas-tourism-board",
    code: "visayas",
    type: "tourism-board",
    name: "Visayas Tourism Board",
    handle: "Official tourism board",
    socialHandle: "@visayastourism.sample",
    avatar: { initials: "VT", tint: ["#fdeab8", "#c28a1c"] },
    blurb: "The region's official welcome, for supporters of its conservation fund.",
    islandIds: ["bohol", "panglao", "balicasag", "pamilacan", "banacon"],
    offer: {
      kind: "tourism-seal",
      title: "Tourism Board Seal",
      art: "stamp-provincial",
      shape: "seal",
      threshold: usd(50),
      charity: "Coral Trust",
      purpose: "Mooring buoys at the ten busiest dive sites.",
    },
    stats: {
      donationsGenerated: { amount: 8650, display: "$8,650", donors: 173 },
      stampsIssued: 173,
      stampsPending: 12,
      linkVisits: 24610,
      postsThisYear: 6,
      postsGoal: 6,
    },
    hasWebsite: true,
  },
];

/** The partner the hub and the partner flow open with. */
export const DEFAULT_PARTNER = SAMPLE_PARTNERS[0];

export function getPartner(idOrCode: string | null | undefined): SharePartner | null {
  if (!idOrCode) return null;
  return SAMPLE_PARTNERS.find((p) => p.id === idOrCode || p.code === idOrCode) ?? null;
}

/* ------------------------------------------------------------------ */
/* Traveler                                                            */
/* ------------------------------------------------------------------ */

const heldStamps: Stamp[] = SAMPLE_PASSPORT.slots.flatMap((slot) => (slot.stamp ? [slot.stamp] : []));

/**
 * The stamp the traveler flow starts from: the spinner dolphins of Pamilacan, the same stamp the
 * passport demo collects (DEMO_SCRIPT.collectSlotId). Pass a status to draw it at another stage.
 */
export function featuredStampAs(status: StampStatus): Stamp {
  return stampForSlot(DEMO_SCRIPT.collectSlotId, status, DEMO_SCRIPT.today);
}

const featured = featuredStampAs("pending");

/** The passport demo's sample traveler (Alex Rivera), with what the share flow needs on top. */
export const SAMPLE_TRAVELER: ShareTraveler = {
  kind: "traveler",
  id: "alex-rivera",
  code: "alex",
  name: SAMPLE_PASSPORT.holder.name,
  handle: SAMPLE_PASSPORT.holder.handle,
  socialHandle: "@alex.sample",
  avatar: { initials: "AR", tint: ["#d9edfb", "#3d8fc4"] },
  passport: SAMPLE_PASSPORT,
  stamps: [...heldStamps, featured],
  featuredStamp: featured,
  charity: featured.charity,
  islandIds: ["pamilacan", "bohol", "balicasag", "banacon"],
  stats: { linkVisits: 86, friendsJoined: 7, donationsGenerated: { amount: 45, display: "$45", donors: 5 } },
};

export const SAMPLE_OWNERS: ShareOwner[] = [...SAMPLE_PARTNERS, SAMPLE_TRAVELER];

/* ------------------------------------------------------------------ */
/* The six prepared island videos                                      */
/* ------------------------------------------------------------------ */

/**
 * Six reels for Bohol. Each is a sequence of photos from public/photos that <IslandReel> animates
 * (Ken Burns moves, crossfades, a line of text per scene, an end card with the QR code).
 * `seconds` add up to the running time before the end card.
 */
export const BOHOL_REELS: IslandReel[] = [
  {
    id: "bohol-sunrise",
    islandId: "bohol",
    number: 1,
    title: "Sunrise over the Chocolate Hills",
    summary: "Mist, 1,200 hills and the river below them.",
    theme: "Landscape",
    art: "stamp-chocolate-hills",
    endCardSeconds: 4,
    scenes: [
      { photo: "bohol-hero", line: "Before the island wakes", seconds: 3, move: "right", focus: [40, 50] },
      { photo: "bohol-chocolate-hills", line: "More than a thousand hills", seconds: 3, move: "in", focus: [55, 55] },
      { photo: "bohol-loboc-river", line: "A river through the jungle", seconds: 3, move: "left", focus: [50, 50] },
      { photo: "bohol-tarsier", line: "And someone small is watching", seconds: 3, move: "in", focus: [50, 40] },
    ],
  },
  {
    id: "bohol-tarsier",
    islandId: "bohol",
    number: 2,
    title: "Meet the tarsier",
    summary: "The palm-sized primate that only wakes at dusk.",
    theme: "Wildlife",
    art: "stamp-tarsier",
    endCardSeconds: 4,
    scenes: [
      { photo: "bohol-tarsier", line: "Palm-sized. Wide awake at dusk.", seconds: 3.5, move: "in", focus: [50, 40] },
      { photo: "bohol-loboc-river", line: "Its forest follows the river", seconds: 3, move: "right", focus: [50, 50] },
      { photo: "bohol-chocolate-hills", line: "Corridors between the hills", seconds: 3, move: "out", focus: [50, 55] },
      { photo: "bohol-conservation", line: "Kept open by people who live here", seconds: 3, move: "up", focus: [50, 45] },
    ],
  },
  {
    id: "bohol-reef-wall",
    islandId: "bohol",
    number: 3,
    title: "The reef wall at Balicasag",
    summary: "Turtles, hard coral and a drop into the blue.",
    theme: "Underwater",
    art: "stamp-sea-turtle",
    endCardSeconds: 4,
    scenes: [
      { photo: "bohol-balicasag-reef", line: "Green turtles graze the wall", seconds: 3.5, move: "left", focus: [55, 50] },
      { photo: "bohol-coral-closeup", line: "Hard coral, decades in the making", seconds: 3, move: "in", focus: [50, 50] },
      { photo: "bohol-reef-aerial", line: "A reef you can see from the air", seconds: 3, move: "out", focus: [50, 50] },
      { photo: "bohol-alona-beach", line: "Boats that tie up at buoys", seconds: 3, move: "right", focus: [45, 55] },
    ],
  },
  {
    id: "bohol-dolphins",
    islandId: "bohol",
    number: 4,
    title: "Dolphins at first light",
    summary: "Spinner dolphins off Pamilacan, watched from quiet boats.",
    theme: "Wildlife",
    art: "stamp-dolphins",
    endCardSeconds: 4,
    scenes: [
      { photo: "bohol-pamilacan-dolphins", line: "Spinner dolphins at sunrise", seconds: 3.5, move: "right", focus: [50, 50] },
      { photo: "bohol-alona-beach", line: "Out before the day boats", seconds: 3, move: "in", focus: [45, 55] },
      { photo: "bohol-reef-aerial", line: "Former whaling waters", seconds: 3, move: "left", focus: [50, 50] },
      { photo: "bohol-balicasag-reef", line: "Now a place to watch, quietly", seconds: 3, move: "out", focus: [55, 50] },
    ],
  },
  {
    id: "bohol-mangroves",
    islandId: "bohol",
    number: 5,
    title: "The forest planted by hand",
    summary: "Banacon's mangroves, grown seedling by seedling.",
    theme: "Conservation",
    art: "stamp-mangroves",
    endCardSeconds: 4,
    scenes: [
      { photo: "bohol-mangroves", line: "A forest standing in the sea", seconds: 3.5, move: "in", focus: [50, 50] },
      { photo: "bohol-conservation", line: "Planted one seedling at a time", seconds: 3, move: "right", focus: [50, 45] },
      { photo: "bohol-loboc-river", line: "Roots that hold the coast", seconds: 3, move: "up", focus: [50, 50] },
      { photo: "bohol-reef-aerial", line: "And shelter the reef beyond", seconds: 3, move: "out", focus: [50, 50] },
    ],
  },
  {
    id: "bohol-fifteen",
    islandId: "bohol",
    number: 6,
    title: "Bohol in fifteen seconds",
    summary: "Hills, reef, dolphins and mangroves, one after another.",
    theme: "Highlights",
    art: "stamp-reef",
    endCardSeconds: 4,
    scenes: [
      { photo: "bohol-hero", line: "Hills", seconds: 2.5, move: "in", focus: [45, 50] },
      { photo: "bohol-alona-beach", line: "Beaches", seconds: 2.5, move: "left", focus: [45, 55] },
      { photo: "bohol-balicasag-reef", line: "Turtles", seconds: 2.5, move: "right", focus: [55, 50] },
      { photo: "bohol-tarsier", line: "Tarsiers", seconds: 2.5, move: "in", focus: [50, 40] },
      { photo: "bohol-pamilacan-dolphins", line: "Dolphins", seconds: 2.5, move: "left", focus: [50, 50] },
      { photo: "bohol-mangroves", line: "Mangroves", seconds: 2.5, move: "out", focus: [50, 50] },
    ],
  },
];

/** Which prepared reel suits each island best. */
const FEATURED_REEL: Record<string, string> = {
  bohol: "bohol-sunrise",
  panglao: "bohol-reef-wall",
  balicasag: "bohol-reef-wall",
  pamilacan: "bohol-dolphins",
  banacon: "bohol-mangroves",
};

/**
 * The six reels for an island. The demo has footage for Bohol only, so Bohol and the small islands
 * that belong to it (parentId "bohol") all get the Bohol set, with the island's best match first.
 * Any other island returns an empty list.
 */
export function reelsForIsland(islandId: string): IslandReel[] {
  const island = getIsland(islandId);
  const inBohol = islandId === "bohol" || island?.parentId === "bohol";
  if (!inBohol) return [];
  const first = FEATURED_REEL[islandId];
  return [...BOHOL_REELS].sort((a, b) => Number(b.id === first) - Number(a.id === first) || a.number - b.number);
}

export function getReel(id: string | null | undefined): IslandReel | null {
  return BOHOL_REELS.find((r) => r.id === id) ?? null;
}

/** The reel to show when nothing has been picked yet. */
export function featuredReel(islandId: string): IslandReel {
  return getReel(FEATURED_REEL[islandId]) ?? BOHOL_REELS[0];
}

/** Seconds of photos, without the end card. */
export function reelSeconds(reel: IslandReel): number {
  return reel.scenes.reduce((sum, s) => sum + s.seconds, 0);
}

/** "0:12" */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Captions and hashtags                                               */
/* ------------------------------------------------------------------ */

/** A sentence or two about each island that a caption can open with. */
const ISLAND_LINES: Record<string, { hook: string; fact: string }> = {
  bohol: {
    hook: "Bohol at sunrise is something else.",
    fact: "More than a thousand limestone hills, and forests where tarsiers wake at dusk.",
  },
  panglao: {
    hook: "Panglao, from the waterline.",
    fact: "White sand, licensed boats and a reef that starts a few fin kicks from shore.",
  },
  balicasag: {
    hook: "The reef wall at Balicasag never gets old.",
    fact: "A tiny coral island where green turtles graze right along the drop-off.",
  },
  pamilacan: {
    hook: "Spinner dolphins at first light off Pamilacan.",
    fact: "Former whaling waters, now watched from quiet boats run by island families.",
  },
  banacon: {
    hook: "Banacon's mangroves were planted by hand.",
    fact: "One of the largest planted mangrove forests in Asia, grown over decades.",
  },
};

const ISLAND_TAGS: Record<string, string[]> = {
  bohol: ["#Bohol", "#ChocolateHills", "#Visayas", "#Philippines"],
  panglao: ["#Panglao", "#AlonaBeach", "#Bohol", "#Philippines"],
  balicasag: ["#Balicasag", "#SeaTurtles", "#Bohol", "#Philippines"],
  pamilacan: ["#Pamilacan", "#SpinnerDolphins", "#Bohol", "#Philippines"],
  banacon: ["#Banacon", "#Mangroves", "#Bohol", "#Philippines"],
};

const AUDIENCE_TAGS: Record<SharePartnerType | "traveler", string[]> = {
  creator: ["#TravelWithPurpose", "#SlowTravel"],
  "travel-agency": ["#ResponsibleTravel", "#IslandHopping"],
  establishment: ["#ReefSafe", "#DiveLocal"],
  charity: ["#ReefConservation", "#ProtectTheReef"],
  "tourism-board": ["#SustainableTourism", "#VisitResponsibly"],
  traveler: ["#PassportStamp", "#TravelForGood"],
};

export const BRAND_TAGS = ["#IslandPassport", "#CollectTheIslands"];

/** Hashtag suggestions: brand first, then the island's, then the ones for this kind of sharer. */
export function hashtagSuggestions(islandId: string, audience: SharePartnerType | "traveler"): string[] {
  return [...BRAND_TAGS, ...(ISLAND_TAGS[islandId] ?? ISLAND_TAGS.bohol), ...AUDIENCE_TAGS[audience]];
}

/** Hashtags switched on by default: the brand tag, the island and one for the audience. */
export function defaultHashtags(islandId: string, audience: SharePartnerType | "traveler"): string[] {
  const island = ISLAND_TAGS[islandId] ?? ISLAND_TAGS.bohol;
  return [BRAND_TAGS[0], island[0], island[1], AUDIENCE_TAGS[audience][0]];
}

/**
 * Ready-to-use captions for an owner and an island. Instagram and TikTok captions are not
 * tappable, so none of them relies on a link in the text: they point at the QR code in the
 * artwork and the link in the profile.
 */
export function captionSuggestions(owner: ShareOwner, islandId: string): CaptionSuggestion[] {
  const island = getIsland(islandId);
  const name = island?.name ?? "Bohol";
  const line = ISLAND_LINES[islandId] ?? ISLAND_LINES.bohol;

  if (owner.kind === "traveler") {
    const stamp = owner.featuredStamp;
    return [
      {
        id: "traveler-warm",
        tone: "Warm",
        text: `New stamp in my Island Passport: ${stamp.title}, ${stamp.island}. ${line.fact} Scan the code to collect yours and help ${owner.charity}.`,
      },
      {
        id: "traveler-short",
        tone: "Short",
        text: `${stamp.island}, stamped. Scan to collect yours and back ${owner.charity}.`,
      },
      {
        id: "traveler-why",
        tone: "The why",
        text: `I wanted my trip to leave something behind. This stamp supports ${owner.charity}: ${lowerFirst(stamp.purpose)} Scan the code if you want to help too.`,
      },
    ];
  }

  const { offer } = owner;
  const give = `${offer.threshold.display} to ${offer.charity}`;
  const byType: Record<SharePartnerType, CaptionSuggestion[]> = {
    creator: [
      {
        id: "creator-warm",
        tone: "Warm",
        text: `${line.hook} ${line.fact} I teamed up with ${offer.charity} so you can collect the ${offer.title} stamp for your Island Passport. Scan the code or use the link in my profile.`,
      },
      { id: "creator-short", tone: "Short", text: `${name}, but make it count. Scan to collect the ${offer.title} stamp.` },
      {
        id: "creator-facts",
        tone: "Facts first",
        text: `${line.fact} A gift of ${give} (example amount) earns the ${offer.title} stamp, and pays for this: ${lowerFirst(offer.purpose)}`,
      },
    ],
    "travel-agency": [
      {
        id: "agency-warm",
        tone: "Warm",
        text: `${line.hook} Every guest on our ${name} days can collect the ${offer.title} stamp and support ${offer.charity}. Scan the code to start your Island Passport.`,
      },
      { id: "agency-short", tone: "Short", text: `Travel ${name} and leave it better. Scan to collect your first stamp.` },
      {
        id: "agency-facts",
        tone: "Facts first",
        text: `${line.fact} Our trips support ${offer.charity}: ${lowerFirst(offer.purpose)} Scan the code to collect the stamp.`,
      },
    ],
    establishment: [
      {
        id: "establishment-warm",
        tone: "Warm",
        text: `${line.hook} Diving with us? Collect the ${offer.title} stamp for your Island Passport and help ${offer.charity} look after the reef you just saw.`,
      },
      { id: "establishment-short", tone: "Short", text: `Dive it. Stamp it. Protect it. Scan the code at the counter or right here.` },
      {
        id: "establishment-facts",
        tone: "Facts first",
        text: `${line.fact} ${offer.charity} uses every gift for this: ${lowerFirst(offer.purpose)} Scan to collect the ${offer.title} stamp.`,
      },
    ],
    charity: [
      {
        id: "charity-warm",
        tone: "Warm",
        text: `${line.hook} Give on our own donation page and we confirm your ${offer.title} stamp in your Island Passport. ${offer.purpose}`,
      },
      { id: "charity-short", tone: "Short", text: `Back the reef, earn the stamp. Scan to give directly to ${offer.charity}.` },
      {
        id: "charity-facts",
        tone: "Facts first",
        text: `${offer.purpose} A gift of ${offer.threshold.display} (example amount) on our page earns the ${offer.title} stamp once we confirm it.`,
      },
    ],
    "tourism-board": [
      {
        id: "board-warm",
        tone: "Warm",
        text: `${line.hook} Visitors who support the island's conservation fund can earn the official ${offer.title} in their Island Passport.`,
      },
      { id: "board-short", tone: "Short", text: `Welcome to ${name}. Scan to earn the official ${offer.title}.` },
      {
        id: "board-facts",
        tone: "Facts first",
        text: `${line.fact} The ${offer.title} recognises gifts of ${offer.threshold.display} or more (example amount) to ${offer.charity}.`,
      },
    ],
  };
  return byType[owner.type];
}

function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

/** The most common caption limit across the feeds the demo imitates. */
export const CAPTION_LIMIT = 2200;
