/**
 * Sample data that only the partner flow needs, derived from the shared kit data in
 * src/lib/share. Everything here is FICTIONAL sample content: emails end in ".sample", figures
 * are invented, and every threshold is an example to be set with the organisations involved.
 */
import type { PostFormat } from "@/components/share/kit";
import { getIsland } from "@/lib/islands/data";
import type { PhotoName } from "@/lib/islands/types";
import { DEMO_SCRIPT } from "@/lib/sample-data";
import { BOHOL_REELS } from "@/lib/share";
import type { IslandReel, SharePartner, SharePartnerType } from "@/lib/share/types";
import type { Stamp as StampData } from "@/lib/types";

export type PartnerStep = "profile" | "choose" | "studio" | "share" | "plan";

export const PARTNER_STEPS: { id: PartnerStep; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "choose", label: "Choose" },
  { id: "studio", label: "Personalise" },
  { id: "share", label: "Share" },
  { id: "plan", label: "Six a year" },
];

/** What the post leads with. Same offer and charity either way, so the link lands on the same page. */
export type PostLead = "stamp" | "charity";

/** The footage behind a post: one of the six prepared videos, or a single photo. */
export type Footage = { kind: "reel"; id: string } | { kind: "photo"; name: PhotoName };

/** "Today" in the demo, shared with the passport demo's story. */
export const PARTNER_TODAY = DEMO_SCRIPT.today;

/** Sign-in addresses for the sample partners. ".sample" is not a real domain ending. */
export const SAMPLE_EMAILS: Record<string, string> = {
  "mia-sample": "mia@mia.sample",
  "isla-trips": "hello@islatrips.sample",
  "bohol-dive-co": "desk@boholdive.sample",
  "coral-trust": "team@coraltrust.sample",
  "visayas-tourism-board": "office@visayastourism.sample",
};

/** Height in px the website widget (/embed/<code>) is designed for; goes into the embed snippet. */
export const EMBED_HEIGHT = 440;

/** The one-time code the demo types in for you. */
export const SAMPLE_CODE = "419207";

/** First name (or short name) for a greeting. */
export function greetingName(partner: SharePartner): string {
  return partner.type === "creator" ? partner.name.split(" ")[0] : partner.name;
}

/** Website address shown in the embed preview's browser bar. Fictional. */
export function sampleSite(partner: SharePartner): string {
  return `${partner.socialHandle.replace(/^@/, "").replace(/\.sample$/, "")}.sample`;
}

/* ------------------------------------------------------------------ */
/* Islands                                                             */
/* ------------------------------------------------------------------ */

export interface PhotoChoice {
  name: PhotoName;
  /** Headline printed over the photo. */
  line: string;
  focus: [number, number];
}

/** Photos offered for a photo post, per island. The first is also the island's picker thumbnail. */
export const ISLAND_PHOTOS: Record<string, PhotoChoice[]> = {
  bohol: [
    { name: "bohol-hero", line: "An island of a thousand hills", focus: [42, 50] },
    { name: "bohol-tarsier", line: "Someone small is watching", focus: [50, 38] },
    { name: "bohol-loboc-river", line: "A river through the jungle", focus: [50, 50] },
    { name: "bohol-chocolate-hills", line: "Golden hour over the hills", focus: [55, 55] },
  ],
  panglao: [
    { name: "bohol-alona-beach", line: "White sand, quiet mornings", focus: [45, 55] },
    { name: "bohol-coral-closeup", line: "The reef starts at the shore", focus: [50, 50] },
    { name: "bohol-balicasag-reef", line: "A few fin kicks from the beach", focus: [55, 50] },
  ],
  balicasag: [
    { name: "bohol-balicasag-reef", line: "Turtles graze the reef wall", focus: [55, 50] },
    { name: "bohol-coral-closeup", line: "Coral, decades in the making", focus: [50, 50] },
    { name: "bohol-reef-aerial", line: "A reef you can see from the air", focus: [50, 50] },
  ],
  pamilacan: [
    { name: "bohol-pamilacan-dolphins", line: "Dolphins at first light", focus: [50, 50] },
    { name: "bohol-alona-beach", line: "Out before the day boats", focus: [45, 55] },
    { name: "bohol-reef-aerial", line: "Former whaling waters", focus: [50, 50] },
  ],
  banacon: [
    { name: "bohol-mangroves", line: "A forest planted by hand", focus: [50, 50] },
    { name: "bohol-conservation", line: "One seedling at a time", focus: [50, 45] },
    { name: "bohol-reef-aerial", line: "Shelter for the reef beyond", focus: [50, 50] },
  ],
};

export function photosForIsland(islandId: string): PhotoChoice[] {
  return ISLAND_PHOTOS[islandId] ?? ISLAND_PHOTOS.bohol;
}

/* ------------------------------------------------------------------ */
/* Personal lines                                                      */
/* ------------------------------------------------------------------ */

/** The limit for the short line printed inside the video. */
export const LINE_LIMIT = 48;
export const NAME_LIMIT = 28;

/** Ready-made short lines, per partner type. The first is the default. */
export const LINE_SUGGESTIONS: Record<SharePartnerType, string[]> = {
  creator: ["Come see it with me", "Save this for your trip", "My favourite hour here"],
  "travel-agency": ["Join our next island day", "Small groups, local guides", "Ask us about this trip"],
  establishment: ["Dive it with us", "We brief every guest", "Find us on Alona Beach"],
  charity: ["This is what we protect", "Every stamp funds the reef", "Your gift stays local"],
  "tourism-board": ["Welcome to the Visayas", "Visit responsibly", "The official conservation seal"],
};

/** "with Mia Sample" for a person, the plain name for an organisation. */
export function defaultByline(partner: SharePartner): string {
  return partner.type === "creator" ? `with ${partner.name}` : partner.name;
}

/* ------------------------------------------------------------------ */
/* Seals a partner earns                                               */
/* ------------------------------------------------------------------ */

/**
 * EXAMPLE thresholds for the seals a partner earns from donations their links generate for an
 * island. The brief gives no figures for these: they are placeholders, always printed with
 * `shareCopy.exampleThreshold`.
 */
export const PARTNER_SEAL_TIERS = [
  { id: "partner", label: "Partner seal", short: "Partner", amount: 500, display: "$500" },
  { id: "tourism", label: "Tourism board seal", short: "Tourism board", amount: 2500, display: "$2,500" },
  { id: "government", label: "Government seal", short: "Government", amount: 5000, display: "$5,000" },
] as const;

export interface SealProgress {
  /** 0 to 1 along a track where the three seals sit at 1/3, 2/3 and 1. */
  ratio: number;
  earned: number;
  /** The next seal to earn, or null when all three are earned. */
  next: (typeof PARTNER_SEAL_TIERS)[number] | null;
  /** Dollars still to go, formatted. */
  toGo: string;
}

export function sealProgress(amount: number): SealProgress {
  const tiers = PARTNER_SEAL_TIERS;
  let earned = 0;
  while (earned < tiers.length && amount >= tiers[earned].amount) earned++;
  const next = tiers[earned] ?? null;
  const from = earned === 0 ? 0 : tiers[earned - 1].amount;
  const within = next ? (amount - from) / (next.amount - from) : 0;
  const ratio = Math.min(1, (earned + within) / tiers.length);
  return { ratio, earned, next, toGo: next ? `$${(next.amount - amount).toLocaleString("en-US")}` : "$0" };
}

/* ------------------------------------------------------------------ */
/* Six posts a year                                                    */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const POSTED_DAYS = [14, 9, 21, 5, 17, 11];
const POSTED_FORMATS: PostFormat[] = ["short", "story", "feed", "short", "story", "short"];

export interface YearMonth {
  /** 0 to 11 within the partner's posting year. */
  index: number;
  year: number;
  /** 0 to 11. */
  month: number;
  label: string;
  /** True for the month the demo's "today" falls in. */
  current: boolean;
}

export interface PostSlot {
  /** 0 to 5. */
  index: number;
  reel: IslandReel;
  /** Position in the 12 months of the posting year (0, 2, 4, 6, 8, 10). */
  monthIndex: number;
  monthLabel: string;
  status: "posted" | "due" | "upcoming";
  /** "14 Jun" for posted slots. */
  postedOn?: string;
  format?: PostFormat;
  /** True for a post logged in this session. */
  fresh?: boolean;
}

export interface PostingYear {
  months: YearMonth[];
  slots: PostSlot[];
  posted: number;
  goal: number;
  /** The slot to make next, or null when all six are shared. */
  next: PostSlot | null;
  /** "Jun 2026 to May 2027" */
  span: string;
  /** Posts logged beyond the six. */
  bonus: number;
}

function addMonths(year: number, month: number, add: number): { year: number; month: number } {
  const total = year * 12 + month + add;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/**
 * The partner's posting year: six suggested posts two months apart, one prepared video each.
 * The year is laid out so the next post is due in the demo's current month (a partner who has
 * shared all six is one cycle ahead). `logged` counts posts logged in this session, with the
 * format they were shared in.
 */
export function postingYear(partner: SharePartner, logged: PostFormat[] = []): PostingYear {
  const [ty, tm, td] = PARTNER_TODAY.split("-").map(Number);
  const before = Math.min(partner.stats.postsThisYear, partner.stats.postsGoal);
  const goal = partner.stats.postsGoal;
  const total = before + logged.length;
  const posted = Math.min(total, goal);
  // Slot `before` (the next one when the flow opens) falls in the current month.
  const start = addMonths(ty, tm - 1, -2 * Math.min(before, goal - 1));

  const months: YearMonth[] = Array.from({ length: 12 }, (_, index) => {
    const m = addMonths(start.year, start.month, index);
    return { index, year: m.year, month: m.month, label: MONTHS[m.month], current: m.year === ty && m.month === tm - 1 };
  });

  const slots: PostSlot[] = BOHOL_REELS.slice(0, goal).map((reel, index) => {
    const month = months[index * 2];
    const fresh = index >= before && index < posted;
    const status: PostSlot["status"] = index < posted ? "posted" : index === posted ? "due" : "upcoming";
    return {
      index,
      reel,
      monthIndex: index * 2,
      monthLabel: `${month.label} ${month.year}`,
      status,
      postedOn: status === "posted" ? `${fresh ? td : POSTED_DAYS[index]} ${month.label}` : undefined,
      format: status === "posted" ? (fresh ? logged[index - before] : POSTED_FORMATS[index]) : undefined,
      fresh,
    };
  });

  const first = months[0];
  const last = months[11];
  return {
    months,
    slots,
    posted,
    goal,
    next: slots.find((s) => s.status === "due") ?? null,
    span: `${first.label} ${first.year} to ${last.label} ${last.year}`,
    bonus: Math.max(0, total - goal),
  };
}

/** A small invented trend line for a stat tile, steady per partner. 12 points, 0 to 1. */
export function sparkline(seed: number): number[] {
  let x = (seed * 9301 + 49297) % 233280;
  const next = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  let level = 0.22;
  return Array.from({ length: 12 }, (_, i) => {
    level = Math.min(1, Math.max(0.08, level + (next() - 0.34) * 0.2 + i * 0.006));
    return level;
  });
}

/* ------------------------------------------------------------------ */
/* Derived pieces                                                      */
/* ------------------------------------------------------------------ */

/** A photo as a one-scene video: a slow move, then the end card. Used for the short-video format. */
export function photoReel(choice: PhotoChoice, islandId: string, art: IslandReel["art"]): IslandReel {
  return {
    id: `photo-${choice.name}`,
    islandId,
    number: 0,
    title: choice.line,
    summary: "",
    theme: "Photo",
    art,
    endCardSeconds: 4,
    scenes: [{ photo: choice.name, line: choice.line, seconds: 6, move: "in", focus: choice.focus }],
  };
}

/** The partner's offer as a stamp the passport demo's <Stamp> can draw. */
export function offerStamp(partner: SharePartner, islandId: string): StampData {
  const { offer } = partner;
  return {
    id: `${partner.id}-${islandId}-offer`,
    art: offer.art,
    title: offer.title,
    island: getIsland(islandId)?.name ?? "Bohol",
    islandId,
    promoter: partner.socialHandle,
    charity: offer.charity,
    purpose: offer.purpose,
    date: PARTNER_TODAY,
    status: "verified",
    kind: offer.kind === "stamp" ? "island" : "provincial",
    shape: offer.shape,
  };
}
