/**
 * On-screen text shared by the three options for the globe, the search box and the island card
 * (TEC-12). Options import from here so all three say the same thing; an option that needs
 * different wording keeps its own strings file next to its components.
 * Placeholders use {curly} names and are filled by `t()` from "@/lib/strings".
 */
import type { IucnStatus, IslandStatus, PartnerType, StampOfferKind, Trend } from "./types";

export const islandStrings = {
  /** PUB-7: sample content is always labelled. */
  sample: {
    tag: "Sample",
    data: "Sample data",
    photo: "Sample photo",
    notice: "Sample content for a design demo. Figures, people and organisations are illustrative.",
    figures: "Sample figures for the demo, not survey results.",
    thresholds: "Example amounts. Each organisation sets its own.",
    noDonations: "No donations are processed in this demo.",
    donationPlatform: "Donations are made on the charity's own platform. Island Passport never collects money.",
  },

  globe: {
    /** Accessible name of the map. */
    label: "Interactive globe of participating islands",
    loading: "Loading the globe",
    /** Shown instead of the map when the browser cannot draw it. */
    fallback: "The interactive globe is not available in this browser. Use the search box or the list of islands instead.",
    contextLost: "The map paused to save memory. Tap to bring it back.",
    retry: "Reload the map",
    attribution: "© OpenStreetMap contributors",
    attributionTiles: "OpenFreeMap",
    attributionLabel: "Map data credits",
    hint: "Drag to spin. Tap an island to open it.",
    reset: "Back to the globe",
    islandLabel: "{name}, {country}",
  },

  status: {
    live: "Open now",
    "coming-soon": "Coming soon",
  } satisfies Record<IslandStatus, string>,

  search: {
    label: "Search islands",
    placeholder: "Search an island",
    clear: "Clear search",
    empty: "No island matches \"{query}\"",
    /** Read out by screen readers when the list changes. */
    count: "{n} islands",
    countOne: "1 island",
    suggested: "Islands",
    go: "Fly to {name}",
  },

  card: {
    sections: {
      about: "About the island",
      tourism: "Tourism impact",
      species: "Endangered species",
      reef: "Water quality and reef",
      projects: "Conservation projects",
      partners: "Collect a stamp here",
    },
    view: { label: "View", map: "Map", photos: "Photos" },
    cta: {
      collect: "Collect a stamp",
      passport: "Open passport",
      share: "Share",
      close: "Close",
      notify: "Tell me when it opens",
    },
    reefIndex: "Reef health",
    reefUpdated: "Sample survey, {date}",
    partnersIntro: "Any of these partners can stamp your passport for this island.",
    from: "From {amount}",
    supports: "Supports {charity}",
    by: "Run by {organisation}",
    progress: "{value} of {target} {unit}",
    photoCount: "{n} of {total}",
    comingSoon: "This island is not open yet.",
  },

  partnerType: {
    creator: "Creator",
    "travel-agency": "Travel agency",
    establishment: "Local business",
    charity: "Charity",
    "tourism-board": "Tourism board",
    government: "Government",
    sponsor: "Sponsor",
  } satisfies Record<PartnerType, string>,

  offerKind: {
    stamp: "Island stamp",
    "tourism-seal": "Tourism board seal",
    "government-seal": "Government seal",
  } satisfies Record<StampOfferKind, string>,

  iucn: {
    LC: "Least Concern",
    NT: "Near Threatened",
    VU: "Vulnerable",
    EN: "Endangered",
    CR: "Critically Endangered",
  } satisfies Record<IucnStatus, string>,
  iucnSource: "IUCN Red List category",

  trend: {
    up: "Improving",
    down: "Declining",
    steady: "Steady",
  } satisfies Record<Trend, string>,
} as const;
