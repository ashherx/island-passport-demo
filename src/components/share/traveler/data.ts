/**
 * What the traveler flow shares and the words it starts from. Everything here is sample content
 * built on the passport demo's own data (src/lib/sample-data.ts) and the share kit's sample
 * traveler (src/lib/share): Alex Rivera, who has just collected the spinner dolphins of Pamilacan.
 */
import type { PhotoName } from "@/lib/islands/types";
import { DEMO_SCRIPT, SAMPLE_PASSPORT, findSlot, getProgress, withStampStatus } from "@/lib/sample-data";
import { SAMPLE_TRAVELER, captionSuggestions, shareCode, type CaptionSuggestion } from "@/lib/share";
import type { DirectionId, Island, PassportData, Stamp, StampSlot, StampStatus } from "@/lib/types";

export type ShareSubject = "stamp" | "island" | "passport";
export type ShareFormat = "story" | "feed" | "film";
export type TravelerStep = "stamped" | "choose" | "design" | "share";

export const SUBJECTS: readonly ShareSubject[] = ["stamp", "island", "passport"] as const;
export const FORMATS: readonly ShareFormat[] = ["story", "feed", "film"] as const;
export const STATUSES: readonly StampStatus[] = ["discovery", "pending", "verified"] as const;
export const STEP_IDS: readonly TravelerStep[] = ["stamped", "choose", "design", "share"] as const;

export const isTravelerStep = (v: unknown): v is TravelerStep => STEP_IDS.includes(v as TravelerStep);
export const isSubject = (v: unknown): v is ShareSubject => SUBJECTS.includes(v as ShareSubject);
export const isFormat = (v: unknown): v is ShareFormat => FORMATS.includes(v as ShareFormat);
export const isStatus = (v: unknown): v is StampStatus => STATUSES.includes(v as StampStatus);
export const isDirection = (v: unknown): v is DirectionId => v === "classic" || v === "reef" || v === "journal";

/** The slot the passport demo's story collects: the stamp this flow starts from. */
export const FEATURED_SLOT = DEMO_SCRIPT.collectSlotId;

/** The sample passport with the featured stamp at `status`. */
export function travelerPassport(status: StampStatus): PassportData {
  return withStampStatus(SAMPLE_PASSPORT, FEATURED_SLOT, status, DEMO_SCRIPT.today);
}

export function featuredStamp(passport: PassportData): Stamp {
  const stamp = findSlot(passport, FEATURED_SLOT)?.stamp;
  if (!stamp) throw new Error("The featured stamp is missing from the sample passport");
  return stamp;
}

/** Islands the traveler holds at least one stamp on, in passport order. */
export function heldIslands(passport: PassportData): { island: Island; slots: StampSlot[]; index: number }[] {
  return passport.islands
    .map((island, i) => ({ island, slots: passport.slots.filter((s) => s.islandId === island.id), index: i + 1 }))
    .filter((entry) => entry.slots.some((s) => s.stamp));
}

/** The picture that stands for each island in the artwork, and where its subject is. */
export const ISLAND_PHOTO: Record<string, { photo: PhotoName; focus: [number, number] }> = {
  pamilacan: { photo: "bohol-pamilacan-dolphins", focus: [36, 60] },
  bohol: { photo: "bohol-chocolate-hills", focus: [64, 60] },
  balicasag: { photo: "bohol-balicasag-reef", focus: [66, 45] },
  banacon: { photo: "bohol-mangroves", focus: [40, 50] },
};
export const PASSPORT_PHOTO: { photo: PhotoName; focus: [number, number] } = { photo: "bohol-hero", focus: [72, 55] };

export function photoFor(subject: ShareSubject, islandId: string) {
  return subject === "passport" ? PASSPORT_PHOTO : (ISLAND_PHOTO[islandId] ?? ISLAND_PHOTO.pamilacan);
}

/**
 * The link each choice makes. The traveler's code travels in the link itself; the island is part
 * of it when an island or a stamp is shared (`alex-pamilacan`), and left out for the whole
 * passport (`alex`). Both resolve on /s/[code].
 */
export function codeFor(subject: ShareSubject, islandId: string): string {
  return subject === "passport" ? SAMPLE_TRAVELER.code : shareCode(SAMPLE_TRAVELER, islandId);
}

/** What each island's stamps protect, for headlines. */
const CAUSE: Record<string, { protect: string; worth: string }> = {
  pamilacan: { protect: "Pamilacan's dolphins", worth: "The dolphins of Pamilacan are worth a quiet boat" },
  bohol: { protect: "Bohol's hills and tarsiers", worth: "Bohol's hills are worth the early start" },
  balicasag: { protect: "Balicasag's reef wall", worth: "The reef wall at Balicasag is worth protecting" },
  banacon: { protect: "Banacon's mangroves", worth: "Banacon's mangroves were planted by hand" },
};

export const HEADLINE_LIMIT = 64;

/** Three headlines to start from. None claims a donation before the charity has confirmed it. */
export function headlineSuggestions(subject: ShareSubject, islandId: string, passport: PassportData): string[] {
  const stamp = featuredStamp(passport);
  const island = passport.islands.find((i) => i.id === islandId)?.name ?? stamp.island;
  const cause = CAUSE[islandId] ?? { protect: island, worth: `${island} is worth protecting` };
  const progress = getProgress(passport);
  if (subject === "passport") {
    return [
      `${progress.collected} stamps across ${passport.province}, and counting`,
      `My Island Passport is filling up`,
      `Every stamp here helps an island charity`,
    ];
  }
  if (subject === "island") {
    return [cause.worth, `${island} is in my Island Passport`, `Come and collect ${island} with me`];
  }
  if (stamp.status === "verified") {
    return [`I helped protect ${CAUSE[stamp.islandId]?.protect ?? stamp.island}`, `${stamp.island}, stamped and verified`, `A stamp that gives something back`];
  }
  return [`I just collected the ${stamp.title} stamp`, `${stamp.island}, stamped`, `New stamp in my Island Passport`];
}

/**
 * Captions to start from. A stamp uses the kit's traveler captions; an island page and the whole
 * passport get their own. None relies on a tappable link (captions are not tappable on the big
 * social apps): they point at the QR code in the picture. None claims a donation.
 */
export function travelerCaptions(subject: ShareSubject, islandId: string, passport: PassportData, charity: string): CaptionSuggestion[] {
  const stamp = featuredStamp(passport);
  if (subject === "stamp") return captionSuggestions({ ...SAMPLE_TRAVELER, featuredStamp: stamp, charity: stamp.charity }, stamp.islandId);
  const progress = getProgress(passport);
  if (subject === "island") {
    const island = passport.islands.find((i) => i.id === islandId);
    const name = island?.name ?? stamp.island;
    return [
      { id: "island-warm", tone: "Warm", text: `${name} is in my Island Passport. ${island?.blurb ?? ""} Scan the code to collect its stamps and help ${charity}.`.replace(/\s+/g, " ") },
      { id: "island-short", tone: "Short", text: `${name}, stamped. Scan to collect yours.` },
      { id: "island-why", tone: "The why", text: `I wanted my trip to leave something behind. Scan the code to see ${name} and help ${charity}, who look after it.` },
    ];
  }
  const islands = heldIslands(passport).length;
  return [
    {
      id: "passport-warm",
      tone: "Warm",
      text: `${progress.collected} stamps in my Island Passport so far, across ${islands} islands of ${passport.province}. Each one is tied to a local charity. Scan the code to start yours.`,
    },
    { id: "passport-short", tone: "Short", text: `My Island Passport: ${progress.collected} stamps and counting. Scan to start yours.` },
    { id: "passport-why", tone: "The why", text: `Every stamp in my passport is tied to an island charity. Scan the code to see it and help ${charity}.` },
  ];
}
