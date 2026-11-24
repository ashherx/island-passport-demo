/**
 * What the recipient page shows for a share code, worked out once on the server.
 *
 * `/s/<owner>-<island>` resolves to a traveler or a partner (src/lib/share/urls.ts). Anything else
 * falls back to the island named at the end of the code, and to the featured island when even
 * that is unknown, so a mistyped or expired link still lands somewhere useful.
 *
 * Everything in the model is plain data: the page, the collect sheet (client), the link preview
 * and the Open Graph image all read the same object. Notes: docs/agents/p3-landing.md
 */
import { FEATURED_ISLAND_ID, getIsland } from "@/lib/islands/data";
import { isLive, type IslandPhoto, type LiveIsland, type PhotoName } from "@/lib/islands/types";
import { DEMO_SCRIPT, stampForSlot } from "@/lib/sample-data";
import { resolveShareCode, shareCopy, type ShareAvatar, type SharePartnerType } from "@/lib/share";
import type { Stamp, StampArt, StampShape } from "@/lib/types";
import { possessive } from "./text";

export type LandingKind = "traveler" | "partner" | "island";

export interface LandingSharer {
  name: string;
  /** How the headline and the buttons refer to them: "Alex", "Bohol Dive Co.". */
  shortName: string;
  /** "@mia.sample" or a short locator. */
  handle: string;
  /** "Traveler", "Creator", "Establishment"... */
  typeLabel: string;
  avatar: ShareAvatar;
  blurb?: string;
  /** One sample figure of social proof, already worded. */
  proof?: string;
}

export interface LandingOffer {
  /** "Spinner dolphins" or "Tourism Board Seal". */
  title: string;
  /** "Island stamp", "Tourism board seal". */
  kindLabel: string;
  isSeal: boolean;
  art: StampArt;
  shape: StampShape;
  /** EXAMPLE figure. Always printed beside `shareCopy.exampleThreshold`. */
  threshold: string;
  charity: string;
  /** "Coral Trust's", "Banacon Mangrove Keepers'". */
  charitys: string;
  purpose: string;
}

export interface LandingModel {
  /** Canonical code when it resolved; the cleaned raw code otherwise. */
  code: string;
  /** False when nobody could be credited (unknown code). */
  credited: boolean;
  kind: LandingKind;
  /** Kit convention: sea for partners, sun for travelers. */
  accent: "sea" | "sun";
  islandId: string;
  islandName: string;
  /** "Bohol, Philippines" */
  place: string;
  islandTagline: string;
  islandHeadline: string;
  islandBody: string;
  facts: { label: string; value: string }[];
  photo: { name: PhotoName; alt: string; focus: [number, number] };
  gallery: IslandPhoto[];
  sharer: LandingSharer | null;
  /** Small caps line above the headline. */
  eyebrow: string;
  /** "Alex supports" + island name set in italics. */
  headline: { lead: string; island: string };
  /** One line on what Island Passport is. */
  intro: string;
  /** Label of the primary button. */
  cta: string;
  offer: LandingOffer;
  /** The stamp a recipient collects, as it looks once saved (status "discovery"). */
  stamp: Stamp;
  /** The sharer's own copy of it, at the status they really hold (travelers only). */
  sharerStamp: Stamp | null;
  /** The sharer's other stamps, for the passport glimpse (travelers only). */
  passport: { stamps: Stamp[]; islands: number; province: string } | null;
  meta: { title: string; description: string; imageAlt: string };
}

/** What the product is, in one line. Used on the page and in the link preview. */
export const INTRO_LINE = "Island Passport is the digital passport you fill by backing the islands you love: give to a local charity, collect its stamp.";

const KIND_LABEL = { stamp: "Island stamp", "tourism-seal": "Tourism board seal", "government-seal": "Government seal" } as const;

/** Where the hero crop is anchored for each photo (x%, y%), so the subject survives a tall phone crop. */
const FOCUS: Partial<Record<PhotoName, [number, number]>> = {
  "bohol-hero": [42, 55],
  "bohol-alona-beach": [45, 60],
  "bohol-balicasag-reef": [55, 50],
  "bohol-pamilacan-dolphins": [58, 58],
  "bohol-mangroves": [50, 55],
};

/** How each partner type introduces the island. */
const PARTNER_LEAD: Record<SharePartnerType, (shortName: string) => string> = {
  creator: (n) => `${n} invites you to`,
  "travel-agency": (n) => `${n} recommends`,
  establishment: (n) => `${n} recommends`,
  charity: (n) => `${n} is protecting`,
  "tourism-board": () => "Welcome to",
};

function liveIsland(id: string | null | undefined): LiveIsland | null {
  const island = getIsland(id);
  return isLive(island) ? island : null;
}

/** Last "-segment" of a code that names a live island, e.g. "someone-panglao" -> Panglao. */
function islandFromRawCode(raw: string): LiveIsland | null {
  const parts = raw.split("-").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const found = liveIsland(parts[i]);
    if (found) return found;
  }
  return null;
}

function cleanCode(raw: string): string {
  return decodeURIComponent(raw).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48);
}

export function buildLanding(rawCode: string): LandingModel {
  let raw = "";
  try {
    raw = cleanCode(rawCode);
  } catch {
    raw = "";
  }
  const shared = resolveShareCode(raw);
  const island = liveIsland(shared?.islandId) ?? islandFromRawCode(raw) ?? (liveIsland(FEATURED_ISLAND_ID) as LiveIsland);
  const hero = island.card.hero;
  const base = {
    islandId: island.id,
    islandName: island.name,
    place: `${island.name}, ${island.country}`,
    islandTagline: island.tagline,
    islandHeadline: island.card.description.headline,
    islandBody: island.card.description.body[0] ?? "",
    facts: island.card.description.facts.filter((f) => f.label !== "Country").slice(0, 3),
    photo: { name: hero.name, alt: hero.alt, focus: FOCUS[hero.name] ?? ([50, 50] as [number, number]) },
    gallery: island.card.photos.filter((p) => p.name !== hero.name).concat(island.card.photos.filter((p) => p.name === hero.name)).slice(0, 4),
    intro: INTRO_LINE,
  };

  if (shared?.kind === "traveler") {
    const t = shared.traveler;
    const first = t.name.split(" ")[0];
    const own = t.stamps.filter((s) => s.islandId === island.id).sort((a, b) => Number(b.id === t.featuredStamp.id) - Number(a.id === t.featuredStamp.id))[0] ?? t.featuredStamp;
    const offer: LandingOffer = {
      title: own.title,
      kindLabel: KIND_LABEL.stamp,
      isSeal: false,
      art: own.art,
      shape: own.shape,
      threshold: "$5",
      charity: own.charity,
      charitys: possessive(own.charity),
      purpose: own.purpose,
    };
    const islandName = own.island;
    return {
      ...base,
      islandName,
      place: `${islandName}, ${island.country}`,
      code: shared.code,
      credited: true,
      kind: "traveler",
      accent: "sun",
      sharer: {
        name: t.name,
        shortName: first,
        handle: t.socialHandle,
        typeLabel: "Traveler",
        avatar: t.avatar,
        proof: `${t.stats.friendsJoined} friends have joined through ${possessive(first)} link`,
      },
      eyebrow: `${first} shared a stamp with you`,
      headline: { lead: `${first} supports`, island: islandName },
      cta: `Collect a ${islandName} stamp`,
      offer,
      stamp: { ...own, status: "discovery", date: DEMO_SCRIPT.today },
      sharerStamp: own,
      passport: { stamps: t.stamps.filter((s) => s.id !== own.id), islands: new Set(t.stamps.map((s) => s.islandId)).size, province: t.passport.province },
      meta: {
        title: `${first} supports ${islandName} · Island Passport`,
        description: `Collect the ${own.title} stamp and help ${own.charity}. You give on the charity's own page, and you never need a password.`,
        imageAlt: `${first} supports ${islandName}: collect the ${own.title} stamp with Island Passport`,
      },
    };
  }

  if (shared?.kind === "partner") {
    const p = shared.partner;
    const shortName = p.type === "creator" ? p.name.split(" ")[0] : p.name;
    const o = p.offer;
    const isSeal = o.kind !== "stamp";
    const offer: LandingOffer = {
      title: o.title,
      kindLabel: KIND_LABEL[o.kind],
      isSeal,
      art: o.art,
      shape: o.shape,
      threshold: o.threshold.display,
      charity: o.charity,
      charitys: possessive(o.charity),
      purpose: o.purpose,
    };
    const stamp: Stamp = {
      id: `${p.id}-${island.id}`,
      art: o.art,
      title: o.title,
      island: island.name,
      islandId: island.id,
      promoter: p.socialHandle,
      charity: o.charity,
      purpose: o.purpose,
      date: DEMO_SCRIPT.today,
      status: "discovery",
      kind: o.shape === "seal" ? "provincial" : "island",
      shape: o.shape,
    };
    const lead = PARTNER_LEAD[p.type](shortName);
    return {
      ...base,
      code: shared.code,
      credited: true,
      kind: "partner",
      accent: "sea",
      sharer: {
        name: p.name,
        shortName,
        handle: p.handle,
        typeLabel: shareCopy.partnerTypes[p.type],
        avatar: p.avatar,
        blurb: p.blurb,
        proof: `${p.stats.stampsIssued.toLocaleString("en-US")} stamps issued through ${possessive(shortName)} links`,
      },
      eyebrow: p.type === "tourism-board" ? `From the ${p.name}` : `${p.name} · ${shareCopy.partnerTypes[p.type]}`,
      headline: { lead, island: island.name },
      cta: isSeal ? `Earn the ${o.title}` : `Collect a ${island.name} stamp`,
      offer,
      stamp,
      sharerStamp: null,
      passport: null,
      meta: {
        title: `${lead} ${island.name} · Island Passport`,
        description: `${isSeal ? "Earn" : "Collect"} the ${o.title}${isSeal ? "" : " stamp"} and help ${o.charity}. You give on the charity's own page, and you never need a password.`,
        imageAlt: `${lead} ${island.name}: ${isSeal ? "earn" : "collect"} the ${o.title} with Island Passport`,
      },
    };
  }

  // Unknown code: nobody to credit, so this is simply the island's own page.
  const first = island.card.partners.find((x) => x.offer.kind === "stamp") ?? island.card.partners[0];
  const o = first.offer;
  const stamp: Stamp = o.passportSlotId
    ? { ...stampForSlot(o.passportSlotId, "discovery", DEMO_SCRIPT.today), island: island.name, islandId: island.id }
    : {
        id: `island-${island.id}`,
        art: o.art,
        title: o.title,
        island: island.name,
        islandId: island.id,
        promoter: "",
        charity: o.charity,
        purpose: o.purpose,
        date: DEMO_SCRIPT.today,
        status: "discovery",
        kind: "island",
        shape: o.shape,
      };
  return {
    ...base,
    code: raw || island.id,
    credited: false,
    kind: "island",
    accent: "sea",
    sharer: null,
    eyebrow: base.place,
    headline: { lead: "Collect", island: island.name },
    cta: `Collect a ${island.name} stamp`,
    offer: { title: o.title, kindLabel: KIND_LABEL[o.kind], isSeal: false, art: o.art, shape: o.shape, threshold: o.threshold.display, charity: o.charity, charitys: possessive(o.charity), purpose: o.purpose },
    stamp,
    sharerStamp: null,
    passport: null,
    meta: {
      title: `${island.name} · Island Passport`,
      description: `${island.tagline}. Collect the ${o.title} stamp and help ${o.charity}, on the charity's own page.`,
      imageAlt: `${island.name}: collect the ${o.title} stamp with Island Passport`,
    },
  };
}
