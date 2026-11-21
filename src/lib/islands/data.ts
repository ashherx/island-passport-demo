/**
 * Sample islands for the globe landing (PUB-7: every figure, person and organisation here is
 * sample content written for the design demo, and is labelled as such on screen).
 *
 * Five islands are live, all in Bohol, Philippines: Bohol itself with the richest card, and four
 * small islands around it with lighter cards. Six more around the world are "coming soon" so the
 * spinning globe has somewhere to go.
 *
 * Where a place name is real, the description sticks to what is commonly known about it. Counts,
 * percentages, survey dates, thresholds, partners and charities are invented. Charity and promoter
 * names match the sample passport in src/lib/sample-data.ts, so the card and the passport tell the
 * same story.
 *
 * Thresholds ($5 for a stamp, about $50 for a tourism board seal, about $100 for a government
 * seal) are EXAMPLES. Donations happen on the charity's own platform; Island Passport never
 * collects money.
 *
 * Position, extent and area come from geo.generated.json, which scripts/fetch-coastlines.mjs
 * derives from the OpenStreetMap outline.
 */
import geo from "./geo.generated.json";
import type { BBox, ComingSoonIsland, GlobeIsland, IslandPhoto, LiveIsland, LngLat, Metric, PhotoName } from "./types";

interface GeoRecord {
  bbox: number[];
  center: number[];
  areaKm2: number;
}

const GEO = geo as Record<string, GeoRecord | undefined>;

/** Fallback positions, used only if the coastline script has not been run for an island. */
const FALLBACK: Record<string, { center: LngLat; span: number }> = {
  bohol: { center: [124.17, 9.85], span: 0.42 },
  panglao: { center: [123.8, 9.59], span: 0.08 },
  balicasag: { center: [123.683, 9.516], span: 0.006 },
  pamilacan: { center: [123.93, 9.49], span: 0.01 },
  banacon: { center: [124.18, 10.2], span: 0.012 },
  siargao: { center: [126.06, 9.86], span: 0.2 },
  palawan: { center: [118.74, 9.83], span: 1.6 },
  "koh-tao": { center: [99.84, 10.095], span: 0.04 },
  "gili-air": { center: [116.082, -8.358], span: 0.01 },
  moorea: { center: [-149.83, -17.535], span: 0.09 },
  bonaire: { center: [-68.27, 12.18], span: 0.2 },
};

function place(id: string): { coordinates: LngLat; bbox: BBox; areaKm2: number } {
  const g = GEO[id];
  if (g) {
    return {
      coordinates: [g.center[0], g.center[1]],
      bbox: [g.bbox[0], g.bbox[1], g.bbox[2], g.bbox[3]],
      areaKm2: g.areaKm2,
    };
  }
  const f = FALLBACK[id];
  const [x, y] = f.center;
  return { coordinates: f.center, bbox: [x - f.span, y - f.span, x + f.span, y + f.span], areaKm2: 0 };
}

const photo = (name: PhotoName, alt: string, caption: string): IslandPhoto => ({ name, alt, caption });

const pct = (id: string, label: string, value: number, extra: Partial<Metric> = {}): Metric => ({
  id,
  label,
  value,
  display: `${value}%`,
  unit: "%",
  max: 100,
  ...extra,
});

/* ------------------------------------------------------------------ Bohol */

const bohol: LiveIsland = {
  id: "bohol",
  name: "Bohol",
  aliases: ["Bohol Island", "Tagbilaran", "Chocolate Hills", "Loboc", "Carmen", "Anda"],
  country: "Philippines",
  countryCode: "PH",
  region: "Central Visayas",
  ...place("bohol"),
  rank: 1,
  tagline: "Cocoa-brown hills, night forests and a rare double reef",
  status: "live",
  card: {
    description: {
      headline: "An island of a thousand hills, ringed by reef",
      body: [
        "Bohol sits in the middle of the Visayas. Inland, more than a thousand grass-covered limestone hills turn cocoa-brown in the dry season, and the forests around them are home to the Philippine tarsier, a primate small enough to fit in a hand.",
        "Along the north coast lies Danajon Bank, one of only a handful of double barrier reefs in the world. To the south, small coral islands sit a short boat ride from shore. The whole island is a UNESCO Global Geopark.",
      ],
      facts: [
        { label: "Country", value: "Philippines" },
        { label: "Region", value: "Central Visayas" },
        { label: "Best months", value: "December to May" },
        { label: "Known for", value: "Chocolate Hills, tarsiers, reefs" },
      ],
    },
    hero: photo("bohol-hero", "The Chocolate Hills at sunrise, mist between the green cones", "Sunrise over the Chocolate Hills"),
    photos: [
      photo("bohol-chocolate-hills", "The Chocolate Hills rolling into the distance at golden hour", "Chocolate Hills, Carmen"),
      photo("bohol-tarsier", "A Philippine tarsier clinging to a mossy branch", "Philippine tarsier at dusk"),
      photo("bohol-loboc-river", "The green Loboc River winding through jungle", "Loboc River"),
      photo("bohol-reef-aerial", "The Danajon Bank double barrier reef from the air", "Danajon Bank, north coast"),
      photo("bohol-coral-closeup", "Hard corals and a giant clam on a healthy reef", "Giant clam on the inner reef"),
      photo("bohol-conservation", "Volunteers replanting mangrove seedlings from a small boat", "Mangrove planting day"),
    ],
    tourism: {
      summary:
        "Tourism is Bohol's largest employer after farming and fishing. Most visitors come for a few days and see the same handful of places, so the pressure lands on a small part of the island.",
      stats: [
        { id: "visitors", label: "Visitors a year", value: 1200000, display: "1.2M", trend: "up", note: "About nine visitors for every ten residents." },
        { id: "stay", label: "Average stay", value: 3.4, display: "3.4 nights", unit: "nights", trend: "steady" },
        pct("local-jobs", "Tourism jobs held by residents", 78, { trend: "up" }),
        pct("hotspot-share", "Visits to the top five sites", 64, {
          trend: "down",
          note: "Spreading visits out is a goal of the island's tourism plan.",
        }),
      ],
      pressures: [
        "Boat anchors and fins on shallow reef near the busiest dive sites",
        "Flash photography and handling at unlicensed tarsier stops",
        "Fresh water and waste on the small islands in peak season",
      ],
      tips: [
        "Choose operators that use mooring buoys and brief every guest",
        "Visit tarsiers only at sanctuaries that keep groups small and quiet",
        "Stay an extra night inland: it spreads income beyond the beach strip",
      ],
    },
    species: [
      {
        id: "tarsier",
        name: "Philippine tarsier",
        scientific: "Carlito syrichta",
        iucn: "NT",
        note: "One of the world's smallest primates. It hunts insects at night and is easily stressed by noise and touch.",
        art: "stamp-tarsier",
        photo: "bohol-tarsier",
      },
      {
        id: "hawksbill",
        name: "Hawksbill turtle",
        scientific: "Eretmochelys imbricata",
        iucn: "CR",
        note: "Feeds on sponges along the reef walls off the south coast. Nests on a few quiet beaches.",
        art: "stamp-sea-turtle",
        photo: "bohol-balicasag-reef",
      },
      {
        id: "whale-shark",
        name: "Whale shark",
        scientific: "Rhincodon typus",
        iucn: "EN",
        note: "Passes through the Bohol Sea on its seasonal route. The largest fish in the ocean.",
        art: "stamp-dolphins",
      },
      {
        id: "giant-clam",
        name: "Giant clam",
        scientific: "Tridacna gigas",
        iucn: "CR",
        note: "Once common on these reefs. Restocked by hand in several community sanctuaries.",
        art: "stamp-reef",
        photo: "bohol-coral-closeup",
      },
      {
        id: "dugong",
        name: "Dugong",
        scientific: "Dugong dugon",
        iucn: "VU",
        note: "A rare visitor to the seagrass meadows of the north coast, which is why those meadows are watched closely.",
        art: "stamp-mangroves",
      },
    ],
    reef: {
      healthIndex: { value: 68, max: 100, label: "Fair, recovering", trend: "up" },
      summary:
        "Reefs inside community sanctuaries are recovering well. Outside them, coral cover is lower and fishing pressure is high. Water is clearest from March to May.",
      metrics: [
        { id: "visibility", label: "Visibility", value: 22, display: "22 m", unit: "m", max: 40, trend: "steady" },
        pct("coral-cover", "Live coral cover", 41, { trend: "up", note: "Inside sanctuaries: 58%." }),
        { id: "water-temp", label: "Water temperature", value: 28.6, display: "28.6 °C", unit: "°C", max: 34, trend: "up", note: "Bleaching watch starts at 30 °C." },
        pct("no-take", "Reef inside no-take zones", 12, { trend: "up" }),
        { id: "water-quality", label: "Swimming water quality", value: 91, display: "91 / 100", max: 100, trend: "steady", note: "Share of beach samples that met the bathing standard." },
      ],
      updated: "January 2027",
      photo: "bohol-reef-aerial",
    },
    projects: [
      {
        id: "danajon-patrols",
        title: "Community patrols on Danajon Bank",
        organisation: "Bohol Reef Trust",
        partnerId: "bohol-reef-trust",
        summary: "Fishers from six villages take turns guarding the no-take zones on the inner reef, by day and by night.",
        progress: { value: 9, target: 14, unit: "sanctuaries patrolled", display: "9 of 14 sanctuaries patrolled" },
        photo: "bohol-reef-aerial",
        art: "stamp-reef",
      },
      {
        id: "tarsier-corridors",
        title: "Forest corridors for tarsiers",
        organisation: "Night Forest Tarsier Fund",
        partnerId: "lena-sample",
        summary: "Planting native trees between forest patches so tarsiers can move and feed without crossing open ground.",
        progress: { value: 12400, target: 20000, unit: "trees planted", display: "12,400 of 20,000 trees planted" },
        photo: "bohol-tarsier",
        art: "stamp-tarsier",
      },
      {
        id: "loboc-mangroves",
        title: "Mangroves at the river mouth",
        organisation: "Loboc River Mangrove Fund",
        summary: "Restoring nipa and mangrove along the Loboc River to hold the banks and shelter young fish.",
        progress: { value: 18, target: 30, unit: "hectares restored", display: "18 of 30 hectares restored" },
        photo: "bohol-conservation",
        art: "stamp-mangroves",
      },
    ],
    partners: [
      {
        id: "sam-sample",
        name: "Sam Sample",
        type: "creator",
        handle: "@sam.sample",
        blurb: "Slow-travel videos from the Visayas.",
        offer: {
          kind: "stamp",
          title: "Chocolate Hills",
          art: "stamp-chocolate-hills",
          shape: "rounded",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Carmen Hills Green Fund",
          purpose: "Replanting native trees on the slopes around the hills.",
          passportSlotId: "bohol-chocolate-hills",
        },
      },
      {
        id: "lena-sample",
        name: "Lena Sample",
        type: "creator",
        handle: "@lena.sample",
        blurb: "Wildlife photographer and night-walk guide.",
        offer: {
          kind: "stamp",
          title: "Tarsier",
          art: "stamp-tarsier",
          shape: "circle",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Night Forest Tarsier Fund",
          purpose: "Protecting forest corridors where tarsiers feed after dark.",
          passportSlotId: "bohol-tarsier",
        },
      },
      {
        id: "visayas-slow-travel",
        name: "Visayas Slow Travel",
        type: "travel-agency",
        handle: "Tagbilaran",
        blurb: "Small-group tours that stay two nights inland.",
        offer: {
          kind: "stamp",
          title: "River mangroves",
          art: "stamp-mangroves",
          shape: "oval",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Loboc River Mangrove Fund",
          purpose: "Restoring nipa and mangrove along the river mouth.",
          passportSlotId: "bohol-river-mangroves",
        },
      },
      {
        id: "bohol-reef-trust",
        name: "Bohol Reef Trust",
        type: "charity",
        blurb: "Runs the community reef patrols on Danajon Bank.",
        offer: {
          kind: "stamp",
          title: "Double barrier reef",
          art: "stamp-reef",
          shape: "scalloped",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Bohol Reef Trust",
          purpose: "Community patrols for the no-take zones on the inner reef.",
          passportSlotId: "danajon-reef",
        },
      },
      {
        id: "bohol-tourism-board",
        name: "Bohol Tourism Board (sample)",
        type: "tourism-board",
        blurb: "The island's official welcome, for supporters of its conservation fund.",
        offer: {
          kind: "tourism-seal",
          title: "Tourism Board Seal",
          art: "stamp-provincial",
          shape: "seal",
          threshold: { amount: 50, currency: "USD", display: "$50" },
          charity: "Bohol Reef Trust",
          purpose: "Mooring buoys at the ten busiest dive sites.",
        },
      },
      {
        id: "bohol-provincial-government",
        name: "Provincial Government (sample)",
        type: "government",
        blurb: "An official seal for visitors who back the island's long-term projects.",
        offer: {
          kind: "government-seal",
          title: "Provincial Seal",
          art: "stamp-provincial",
          shape: "seal",
          threshold: { amount: 100, currency: "USD", display: "$100" },
          charity: "Carmen Hills Green Fund",
          purpose: "Native tree nurseries run by schools across the province.",
        },
      },
    ],
  },
};

/* ---------------------------------------------------------------- Panglao */

const panglao: LiveIsland = {
  id: "panglao",
  name: "Panglao",
  aliases: ["Panglao Island", "Alona Beach", "Alona", "Dauis", "Doljo"],
  country: "Philippines",
  countryCode: "PH",
  region: "Bohol",
  ...place("panglao"),
  rank: 2,
  parentId: "bohol",
  tagline: "White sand, dive boats and house reefs a swim from shore",
  status: "live",
  card: {
    description: {
      headline: "Bohol's beach island",
      body: [
        "Panglao is joined to Bohol by two short bridges. Its south coast is a run of white-sand beaches, with coral starting a few metres from the waterline.",
        "It is where most visitors to Bohol sleep, and where most dive boats leave from, so it is also where careful tourism matters most.",
      ],
      facts: [
        { label: "Country", value: "Philippines" },
        { label: "Province", value: "Bohol" },
        { label: "Best months", value: "November to May" },
        { label: "Known for", value: "Alona Beach, house reefs" },
      ],
    },
    hero: photo("bohol-alona-beach", "Outrigger boats moored off a white-sand beach on Panglao", "Early morning, Alona Beach"),
    photos: [
      photo("bohol-alona-beach", "Outrigger boats moored off a white-sand beach on Panglao", "Early morning, Alona Beach"),
      photo("bohol-coral-closeup", "Hard corals and a giant clam on a healthy reef", "House reef, south coast"),
      photo("bohol-balicasag-reef", "A sea turtle gliding over a coral wall", "A day trip from the beach"),
    ],
    tourism: {
      summary: "Panglao hosts more than half of Bohol's overnight visitors on a small island with limited fresh water.",
      stats: [
        { id: "visitors", label: "Visitors a year", value: 690000, display: "690K", trend: "up" },
        { id: "boats", label: "Dive and tour boats a day", value: 140, display: "140", trend: "up", note: "In peak season." },
        pct("moorings", "Dive sites with mooring buoys", 55, { trend: "up" }),
      ],
      pressures: ["Anchors on shallow coral", "Waste water from the beach strip", "Sunscreen and fins on the house reefs"],
      tips: ["Ask your boat to tie up, not anchor", "Use reef-safe sunscreen", "Refill water bottles instead of buying plastic"],
    },
    species: [
      {
        id: "hawksbill",
        name: "Hawksbill turtle",
        scientific: "Eretmochelys imbricata",
        iucn: "CR",
        note: "Seen on the deeper house reefs early in the morning.",
        art: "stamp-sea-turtle",
      },
      {
        id: "giant-clam",
        name: "Giant clam",
        scientific: "Tridacna gigas",
        iucn: "CR",
        note: "A small restocked garden sits inside the Doljo sanctuary.",
        art: "stamp-reef",
        photo: "bohol-coral-closeup",
      },
    ],
    reef: {
      healthIndex: { value: 61, max: 100, label: "Fair", trend: "steady" },
      summary: "Coral is healthiest away from the busiest beach. Visibility drops after heavy rain.",
      metrics: [
        { id: "visibility", label: "Visibility", value: 18, display: "18 m", unit: "m", max: 40, trend: "steady" },
        pct("coral-cover", "Live coral cover", 36, { trend: "steady" }),
        { id: "water-temp", label: "Water temperature", value: 28.9, display: "28.9 °C", unit: "°C", max: 34, trend: "up" },
        { id: "water-quality", label: "Swimming water quality", value: 84, display: "84 / 100", max: 100, trend: "up" },
      ],
      updated: "January 2027",
      photo: "bohol-coral-closeup",
    },
    projects: [
      {
        id: "mooring-buoys",
        title: "Mooring buoys for dive sites",
        organisation: "Bohol Reef Trust",
        partnerId: "alona-blue-dive",
        summary: "Fixed buoys so boats tie up instead of dropping anchor on the reef.",
        progress: { value: 22, target: 40, unit: "buoys installed", display: "22 of 40 buoys installed" },
        photo: "bohol-alona-beach",
        art: "stamp-reef",
      },
      {
        id: "clam-garden",
        title: "Giant clam garden",
        organisation: "Bohol Reef Trust",
        summary: "Hatchery-raised clams placed in a guarded sanctuary and checked every month.",
        progress: { value: 310, target: 500, unit: "clams placed", display: "310 of 500 clams placed" },
        photo: "bohol-coral-closeup",
        art: "stamp-reef",
      },
    ],
    partners: [
      {
        id: "alona-blue-dive",
        name: "Alona Blue Dive Centre",
        type: "establishment",
        handle: "Alona Beach",
        blurb: "Dive shop that ties up at buoys and briefs every guest.",
        offer: {
          kind: "stamp",
          title: "Reef wall",
          art: "stamp-reef",
          shape: "octagon",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Bohol Reef Trust",
          purpose: "Mooring buoys so boats stop anchoring on the reef.",
          passportSlotId: "balicasag-reef",
        },
      },
      {
        id: "mia-sample",
        name: "Mia Sample",
        type: "creator",
        handle: "@mia.sample",
        blurb: "Freediver sharing reef etiquette in sixty seconds.",
        offer: {
          kind: "stamp",
          title: "Sea turtle",
          art: "stamp-sea-turtle",
          shape: "scalloped",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Bohol Reef Trust",
          purpose: "Coral gardening on storm-damaged reef.",
        },
      },
      {
        id: "visayas-slow-travel",
        name: "Visayas Slow Travel",
        type: "travel-agency",
        handle: "Tagbilaran",
        blurb: "Island-hopping days with licensed boats only.",
        offer: {
          kind: "stamp",
          title: "Giant clam garden",
          art: "stamp-reef",
          shape: "rounded",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Bohol Reef Trust",
          purpose: "Raising and placing giant clams in the Doljo sanctuary.",
        },
      },
      {
        id: "bohol-tourism-board",
        name: "Bohol Tourism Board (sample)",
        type: "tourism-board",
        blurb: "Official seal for supporters of the reef fund.",
        offer: {
          kind: "tourism-seal",
          title: "Tourism Board Seal",
          art: "stamp-provincial",
          shape: "seal",
          threshold: { amount: 50, currency: "USD", display: "$50" },
          charity: "Bohol Reef Trust",
          purpose: "Mooring buoys at the ten busiest dive sites.",
        },
      },
    ],
  },
};

/* -------------------------------------------------------------- Balicasag */

const balicasag: LiveIsland = {
  id: "balicasag",
  name: "Balicasag",
  aliases: ["Balicasag Island", "Balicasag marine sanctuary"],
  country: "Philippines",
  countryCode: "PH",
  region: "Bohol",
  ...place("balicasag"),
  rank: 2,
  parentId: "bohol",
  tagline: "A tiny coral island with a reef wall full of turtles",
  status: "live",
  view: { maxZoom: 14.6 },
  card: {
    description: {
      headline: "A marine sanctuary you can walk around in an hour",
      body: [
        "Balicasag is a flat disc of sand and coral about 600 metres across, a short boat ride from Panglao. The reef drops away in a wall just off the beach.",
        "Part of the reef has been a fish sanctuary since the 1980s, which is why the turtles and the schools of jacks are still here.",
      ],
      facts: [
        { label: "Country", value: "Philippines" },
        { label: "Province", value: "Bohol" },
        { label: "Getting there", value: "45 minutes by boat from Panglao" },
        { label: "Known for", value: "Sea turtles, reef wall" },
      ],
    },
    hero: photo("bohol-balicasag-reef", "A sea turtle gliding over the coral wall at Balicasag", "The reef wall, Balicasag"),
    photos: [
      photo("bohol-balicasag-reef", "A sea turtle gliding over the coral wall at Balicasag", "The reef wall, Balicasag"),
      photo("bohol-coral-closeup", "Hard corals and a giant clam on a healthy reef", "Inside the sanctuary"),
    ],
    tourism: {
      summary: "Nobody stays overnight, but hundreds of snorkellers arrive every morning. Daily visitor limits now apply.",
      stats: [
        { id: "day-visitors", label: "Day visitors allowed", value: 300, display: "300 a day", trend: "steady", note: "Divers and snorkellers combined." },
        { id: "residents", label: "Residents", value: 800, display: "About 800", trend: "steady" },
        pct("guide-income", "Guide fees that stay on the island", 70, { trend: "up" }),
      ],
      pressures: ["Crowding over the turtle feeding grounds", "Standing on coral in the shallows"],
      tips: ["Book a morning slot with an island guide", "Keep three metres from turtles and never touch"],
    },
    species: [
      {
        id: "hawksbill",
        name: "Hawksbill turtle",
        scientific: "Eretmochelys imbricata",
        iucn: "CR",
        note: "Feeds along the wall. Resident animals are known to the guides by name.",
        art: "stamp-sea-turtle",
        photo: "bohol-balicasag-reef",
      },
      {
        id: "humphead-wrasse",
        name: "Humphead wrasse",
        scientific: "Cheilinus undulatus",
        iucn: "EN",
        note: "A large, slow-growing reef fish that returns where fishing stops.",
        art: "stamp-reef",
      },
    ],
    reef: {
      healthIndex: { value: 79, max: 100, label: "Good", trend: "up" },
      summary: "One of the healthiest reefs in the province. The sanctuary side has more than twice the fish of the open side.",
      metrics: [
        { id: "visibility", label: "Visibility", value: 28, display: "28 m", unit: "m", max: 40, trend: "steady" },
        pct("coral-cover", "Live coral cover", 57, { trend: "up" }),
        { id: "water-temp", label: "Water temperature", value: 28.4, display: "28.4 °C", unit: "°C", max: 34, trend: "up" },
        { id: "turtles", label: "Turtles seen per dive", value: 4, display: "4", max: 8, trend: "up" },
      ],
      updated: "January 2027",
      photo: "bohol-balicasag-reef",
    },
    projects: [
      {
        id: "turtle-moorings",
        title: "Moorings over the turtle grounds",
        organisation: "Bohol Reef Trust",
        partnerId: "sam-sample",
        summary: "Buoys so boats stop anchoring on the seagrass where turtles feed.",
        progress: { value: 11, target: 16, unit: "buoys installed", display: "11 of 16 buoys installed" },
        photo: "bohol-balicasag-reef",
        art: "stamp-sea-turtle",
      },
      {
        id: "coral-gardening",
        title: "Coral gardening on the wall",
        organisation: "Bohol Reef Trust",
        partnerId: "mia-sample",
        summary: "Replanting broken coral on sections of the wall damaged by storms.",
        progress: { value: 1900, target: 3000, unit: "fragments planted", display: "1,900 of 3,000 fragments planted" },
        photo: "bohol-coral-closeup",
        art: "stamp-reef",
      },
    ],
    partners: [
      {
        id: "sam-sample",
        name: "Sam Sample",
        type: "creator",
        handle: "@sam.sample",
        blurb: "Slow-travel videos from the Visayas.",
        offer: {
          kind: "stamp",
          title: "Sea turtle",
          art: "stamp-sea-turtle",
          shape: "scalloped",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Bohol Reef Trust",
          purpose: "Mooring buoys so boats stop anchoring on turtle feeding grounds.",
          passportSlotId: "balicasag-sea-turtle",
        },
      },
      {
        id: "mia-sample",
        name: "Mia Sample",
        type: "creator",
        handle: "@mia.sample",
        blurb: "Freediver sharing reef etiquette in sixty seconds.",
        offer: {
          kind: "stamp",
          title: "Reef wall",
          art: "stamp-reef",
          shape: "octagon",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Bohol Reef Trust",
          purpose: "Coral gardening on storm-damaged sections of the reef wall.",
          passportSlotId: "balicasag-reef",
        },
      },
      {
        id: "alona-blue-dive",
        name: "Alona Blue Dive Centre",
        type: "establishment",
        handle: "Alona Beach",
        blurb: "Runs the morning boats with island guides on board.",
        offer: {
          kind: "stamp",
          title: "Sanctuary dive",
          art: "stamp-reef",
          shape: "circle",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Bohol Reef Trust",
          purpose: "Wages for the sanctuary's island wardens.",
        },
      },
      {
        id: "bohol-reef-trust",
        name: "Bohol Reef Trust",
        type: "charity",
        blurb: "Manages the moorings and trains the island guides.",
        offer: {
          kind: "stamp",
          title: "Sanctuary keeper",
          art: "stamp-sea-turtle",
          shape: "rounded",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Bohol Reef Trust",
          purpose: "Guide training and patrol fuel.",
        },
      },
    ],
  },
};

/* -------------------------------------------------------------- Pamilacan */

const pamilacan: LiveIsland = {
  id: "pamilacan",
  name: "Pamilacan",
  aliases: ["Pamilacan Island", "Baclayon"],
  country: "Philippines",
  countryCode: "PH",
  region: "Bohol",
  ...place("pamilacan"),
  rank: 2,
  parentId: "bohol",
  tagline: "Former whaling waters, now dolphins at sunrise",
  status: "live",
  view: { maxZoom: 14.2 },
  card: {
    description: {
      headline: "Where the hunters became the guides",
      body: [
        "For generations the families of Pamilacan hunted whales, manta rays and whale sharks in the deep water of the Bohol Sea. When the hunt was banned in the 1990s, the same boatmen began taking visitors out to watch instead.",
        "Spinner dolphins gather offshore at first light, and a quiet beach on the north side is still used by nesting turtles.",
      ],
      facts: [
        { label: "Country", value: "Philippines" },
        { label: "Province", value: "Bohol" },
        { label: "Best months", value: "March to June" },
        { label: "Known for", value: "Spinner dolphins" },
      ],
    },
    hero: photo("bohol-pamilacan-dolphins", "Spinner dolphins leaping near Pamilacan Island", "Spinner dolphins at sunrise"),
    photos: [
      photo("bohol-pamilacan-dolphins", "Spinner dolphins leaping near Pamilacan Island", "Spinner dolphins at sunrise"),
      photo("bohol-coral-closeup", "Hard corals on a healthy reef", "The island's fringing reef"),
    ],
    tourism: {
      summary: "Dolphin watching is the island's main income. It works because the boats are few, small and local.",
      stats: [
        { id: "boats", label: "Licensed watch boats", value: 34, display: "34", trend: "steady", note: "All owned on the island." },
        pct("sightings", "Trips that meet dolphins", 92, { trend: "steady" }),
        { id: "residents", label: "Residents", value: 1400, display: "About 1,400", trend: "steady" },
      ],
      pressures: ["Boats crowding or chasing a pod", "Engine noise in the resting area"],
      tips: ["Go with an island boat, at sunrise", "Ask the skipper to cut the engine and let the pod come to you"],
    },
    species: [
      {
        id: "spinner-dolphin",
        name: "Spinner dolphin",
        scientific: "Stenella longirostris",
        iucn: "LC",
        note: "Not threatened worldwide, but this pod rests in a small area that boats can easily disturb.",
        art: "stamp-dolphins",
        photo: "bohol-pamilacan-dolphins",
      },
      {
        id: "whale-shark",
        name: "Whale shark",
        scientific: "Rhincodon typus",
        iucn: "EN",
        note: "Once hunted here. Now protected, and seen offshore between March and June.",
        art: "stamp-dolphins",
      },
      {
        id: "hawksbill",
        name: "Hawksbill turtle",
        scientific: "Eretmochelys imbricata",
        iucn: "CR",
        note: "Nests on the north beach, where families guard the nests at night.",
        art: "stamp-sea-turtle",
      },
    ],
    reef: {
      healthIndex: { value: 72, max: 100, label: "Good", trend: "steady" },
      summary: "A healthy fringing reef inside the village sanctuary, with deep clear water just beyond it.",
      metrics: [
        { id: "visibility", label: "Visibility", value: 26, display: "26 m", unit: "m", max: 40, trend: "steady" },
        pct("coral-cover", "Live coral cover", 49, { trend: "up" }),
        { id: "water-temp", label: "Water temperature", value: 28.3, display: "28.3 °C", unit: "°C", max: 34, trend: "up" },
        { id: "nests", label: "Turtle nests guarded this season", value: 17, display: "17", max: 30, trend: "up" },
      ],
      updated: "January 2027",
      photo: "bohol-pamilacan-dolphins",
    },
    projects: [
      {
        id: "quiet-boats",
        title: "Quiet-boat training for guides",
        organisation: "Pamilacan Sea Life Fund",
        partnerId: "mia-sample",
        summary: "Teaching skippers how to approach a pod slowly, from the side, and when to switch the engine off.",
        progress: { value: 26, target: 34, unit: "skippers trained", display: "26 of 34 skippers trained" },
        photo: "bohol-pamilacan-dolphins",
        art: "stamp-dolphins",
      },
      {
        id: "nest-patrols",
        title: "Night patrols on the nesting beach",
        organisation: "Pamilacan Sea Life Fund",
        partnerId: "lena-sample",
        summary: "Island families watch over turtle nests until the hatchlings reach the sea.",
        progress: { value: 17, target: 25, unit: "nests guarded", display: "17 of 25 nests guarded" },
        art: "stamp-sea-turtle",
      },
    ],
    partners: [
      {
        id: "mia-sample",
        name: "Mia Sample",
        type: "creator",
        handle: "@mia.sample",
        blurb: "Freediver sharing reef etiquette in sixty seconds.",
        offer: {
          kind: "stamp",
          title: "Spinner dolphins",
          art: "stamp-dolphins",
          shape: "circle",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Pamilacan Sea Life Fund",
          purpose: "Quiet-boat training for local dolphin-watch guides.",
          passportSlotId: "pamilacan-dolphins",
        },
      },
      {
        id: "lena-sample",
        name: "Lena Sample",
        type: "creator",
        handle: "@lena.sample",
        blurb: "Wildlife photographer and night-walk guide.",
        offer: {
          kind: "stamp",
          title: "Turtle nesting beach",
          art: "stamp-sea-turtle",
          shape: "oval",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Pamilacan Sea Life Fund",
          purpose: "Night patrols that guard turtle nests until they hatch.",
          passportSlotId: "pamilacan-turtle-beach",
        },
      },
      {
        id: "pamilacan-boatmen",
        name: "Pamilacan Boatmen's Cooperative",
        type: "establishment",
        handle: "Pamilacan pier",
        blurb: "The island's own dolphin-watch boats.",
        offer: {
          kind: "stamp",
          title: "Sunrise watch",
          art: "stamp-dolphins",
          shape: "rounded",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Pamilacan Sea Life Fund",
          purpose: "Propeller guards for the watch boats.",
        },
      },
      {
        id: "pamilacan-sea-life-fund",
        name: "Pamilacan Sea Life Fund",
        type: "charity",
        blurb: "Runs the guide training and the nest patrols.",
        offer: {
          kind: "stamp",
          title: "Sea life keeper",
          art: "stamp-dolphins",
          shape: "octagon",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Pamilacan Sea Life Fund",
          purpose: "Torches, radios and fuel for the patrols.",
        },
      },
    ],
  },
};

/* ---------------------------------------------------------------- Banacon */

const banacon: LiveIsland = {
  id: "banacon",
  name: "Banacon",
  aliases: ["Banacon Island", "Getafe", "Jetafe", "Mangrove island"],
  country: "Philippines",
  countryCode: "PH",
  region: "Bohol",
  ...place("banacon"),
  rank: 2,
  parentId: "bohol",
  tagline: "A mangrove forest planted by hand over sixty years",
  status: "live",
  view: { maxZoom: 13.8 },
  card: {
    description: {
      headline: "The island that grew its own forest",
      body: [
        "Banacon is a low island on Danajon Bank, off Bohol's north coast. In the 1950s one resident began planting mangroves in the shallows to protect the village from storms. His neighbours joined in.",
        "Today the planted forest covers several hundred hectares, one of the largest of its kind in Asia, and you can paddle through it in a small boat.",
      ],
      facts: [
        { label: "Country", value: "Philippines" },
        { label: "Province", value: "Bohol" },
        { label: "Getting there", value: "30 minutes by boat from Getafe" },
        { label: "Known for", value: "Planted mangrove forest" },
      ],
    },
    hero: photo("bohol-mangroves", "Planted mangroves standing in clear water at Banacon", "The planted forest at high tide"),
    photos: [
      photo("bohol-mangroves", "Planted mangroves standing in clear water at Banacon", "The planted forest at high tide"),
      photo("bohol-conservation", "Volunteers replanting mangrove seedlings from a small boat", "Planting day"),
      photo("bohol-reef-aerial", "The Danajon Bank double barrier reef from the air", "Danajon Bank from above"),
    ],
    tourism: {
      summary: "Few visitors make it here yet. Those who do come with a local boatman and are asked to plant a seedling.",
      stats: [
        { id: "visitors", label: "Visitors a year", value: 4200, display: "4,200", trend: "up" },
        { id: "forest", label: "Planted mangrove forest", value: 425, display: "425 ha", unit: "ha", trend: "up" },
        pct("community-share", "Tour fees paid to island families", 85, { trend: "steady" }),
      ],
      pressures: ["Cutting for firewood and fish-pen poles", "Storm damage to young trees"],
      tips: ["Hire a paddle boat from the village", "Plant a seedling and log its tag number"],
    },
    species: [
      {
        id: "philippine-duck",
        name: "Philippine duck",
        scientific: "Anas luzonica",
        iucn: "VU",
        note: "Found only in the Philippines. Feeds in the forest's quiet channels.",
        art: "stamp-mangroves",
      },
      {
        id: "dugong",
        name: "Dugong",
        scientific: "Dugong dugon",
        iucn: "VU",
        note: "Grazes the seagrass beyond the mangroves. Sightings are rare and always reported.",
        art: "stamp-mangroves",
      },
    ],
    reef: {
      healthIndex: { value: 64, max: 100, label: "Fair, recovering", trend: "up" },
      summary: "Mangroves trap silt and shelter young fish, so the reef flats beside the forest are slowly improving. The water here is green and calm, not blue.",
      metrics: [
        { id: "visibility", label: "Visibility", value: 9, display: "9 m", unit: "m", max: 40, trend: "steady", note: "Normal for mangrove water." },
        pct("coral-cover", "Live coral cover", 33, { trend: "up" }),
        { id: "water-temp", label: "Water temperature", value: 29.1, display: "29.1 °C", unit: "°C", max: 34, trend: "up" },
        pct("seedling-survival", "Seedlings alive after a year", 71, { trend: "up" }),
      ],
      updated: "January 2027",
      photo: "bohol-mangroves",
    },
    projects: [
      {
        id: "family-planting",
        title: "Planting with island families",
        organisation: "Banacon Mangrove Keepers",
        partnerId: "tide-sample",
        summary: "Families plant and tend seedlings on the seaward edge, where the forest takes the force of storms.",
        progress: { value: 38000, target: 60000, unit: "seedlings planted", display: "38,000 of 60,000 seedlings planted" },
        photo: "bohol-conservation",
        art: "stamp-mangroves",
      },
      {
        id: "school-nursery",
        title: "The school nursery",
        organisation: "Banacon Mangrove Keepers",
        partnerId: "sam-sample",
        summary: "Pupils raise seedlings in the school yard and plant them out at the end of each term.",
        progress: { value: 4, target: 6, unit: "nursery beds built", display: "4 of 6 nursery beds built" },
        photo: "bohol-mangroves",
        art: "stamp-mangroves",
      },
    ],
    partners: [
      {
        id: "tide-sample",
        name: "Tide Sample",
        type: "creator",
        handle: "@tide.sample",
        blurb: "Kayak guide posting from the Danajon Bank.",
        offer: {
          kind: "stamp",
          title: "Mangrove forest",
          art: "stamp-mangroves",
          shape: "circle",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Banacon Mangrove Keepers",
          purpose: "Planting and tending mangrove seedlings with island families.",
          passportSlotId: "banacon-mangroves",
        },
      },
      {
        id: "sam-sample",
        name: "Sam Sample",
        type: "creator",
        handle: "@sam.sample",
        blurb: "Slow-travel videos from the Visayas.",
        offer: {
          kind: "stamp",
          title: "Mangrove nursery",
          art: "stamp-mangroves",
          shape: "rounded",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Banacon Mangrove Keepers",
          purpose: "A seedling nursery run by the island school.",
          passportSlotId: "banacon-nursery",
        },
      },
      {
        id: "banacon-mangrove-keepers",
        name: "Banacon Mangrove Keepers",
        type: "charity",
        blurb: "The islanders' own association, founded by the first planters' families.",
        offer: {
          kind: "stamp",
          title: "Forest keeper",
          art: "stamp-mangroves",
          shape: "octagon",
          threshold: { amount: 5, currency: "USD", display: "$5" },
          charity: "Banacon Mangrove Keepers",
          purpose: "Tools, tags and boats for planting days.",
        },
      },
      {
        id: "getafe-municipality",
        name: "Municipal Government (sample)",
        type: "government",
        blurb: "An official seal for supporters of the island's storm-protection belt.",
        offer: {
          kind: "government-seal",
          title: "Municipal Seal",
          art: "stamp-provincial",
          shape: "seal",
          threshold: { amount: 100, currency: "USD", display: "$100" },
          charity: "Banacon Mangrove Keepers",
          purpose: "Extending the seaward belt of mangroves by one kilometre.",
        },
      },
    ],
  },
};

/* ------------------------------------------------------------ Coming soon */

const comingSoon: ComingSoonIsland[] = [
  {
    id: "siargao",
    name: "Siargao",
    aliases: ["Siargao Island", "General Luna", "Cloud 9"],
    country: "Philippines",
    countryCode: "PH",
    region: "Surigao del Norte",
    ...place("siargao"),
    rank: 1,
    tagline: "Surf breaks and the country's largest mangrove reserve",
    status: "coming-soon",
    teaser: "Known for its surf, Siargao also shelters a vast mangrove forest at Del Carmen. Local partners are being signed up now.",
  },
  {
    id: "palawan",
    name: "El Nido, Palawan",
    aliases: ["Palawan", "El Nido", "Bacuit Bay", "Puerto Princesa"],
    country: "Philippines",
    countryCode: "PH",
    region: "Palawan",
    ...place("palawan"),
    // The outline is all of Palawan; the label and the camera go to El Nido at its northern tip.
    coordinates: [119.41, 11.18],
    bbox: [119.05, 10.8, 119.85, 11.45],
    rank: 1,
    tagline: "Limestone cliffs over lagoons the colour of glass",
    status: "coming-soon",
    teaser: "El Nido's lagoons and karst islands sit at the northern tip of Palawan. Stamps for its marine reserve are on the way.",
  },
  {
    id: "koh-tao",
    name: "Koh Tao",
    aliases: ["Ko Tao", "Turtle Island"],
    country: "Thailand",
    countryCode: "TH",
    region: "Surat Thani",
    ...place("koh-tao"),
    rank: 1,
    tagline: "A small dive island with a big reef-restoration scene",
    status: "coming-soon",
    teaser: "Koh Tao trains more divers than almost anywhere, and many stay to rebuild coral. Its first partners join next.",
  },
  {
    id: "gili-air",
    name: "Gili Air",
    aliases: ["Gili Islands", "Gili", "Lombok"],
    country: "Indonesia",
    countryCode: "ID",
    region: "West Nusa Tenggara",
    ...place("gili-air"),
    rank: 1,
    tagline: "No cars, clear water and turtles off the beach",
    status: "coming-soon",
    teaser: "On Gili Air you get around on foot or by bicycle, and turtles feed just off the east shore. Coming to the passport soon.",
  },
  {
    id: "moorea",
    name: "Moorea",
    aliases: ["Mo'orea", "French Polynesia", "Tahiti"],
    country: "French Polynesia",
    countryCode: "PF",
    region: "Society Islands",
    ...place("moorea"),
    rank: 1,
    tagline: "Green peaks inside a ring of lagoon",
    status: "coming-soon",
    teaser: "Moorea's lagoon is one of the most studied coral reefs in the Pacific. Its coral gardeners are next on the list.",
  },
  {
    id: "bonaire",
    name: "Bonaire",
    aliases: ["Kralendijk", "Dutch Caribbean", "Caribbean Netherlands"],
    country: "Caribbean Netherlands",
    countryCode: "BQ",
    region: "Leeward Antilles",
    ...place("bonaire"),
    rank: 1,
    tagline: "A whole coastline that is a marine park",
    status: "coming-soon",
    teaser: "Bonaire has protected its entire shoreline since 1979, and you can dive most of it from the beach. Opening soon.",
  },
];

/** All islands: live first (Bohol leading), then coming soon. */
export const ISLANDS: GlobeIsland[] = [bohol, panglao, balicasag, pamilacan, banacon, ...comingSoon];

export const LIVE_ISLANDS: LiveIsland[] = ISLANDS.filter((i): i is LiveIsland => i.status === "live");

export const COMING_SOON_ISLANDS: ComingSoonIsland[] = comingSoon;

const BY_ID = new Map(ISLANDS.map((island) => [island.id, island]));

export function getIsland(id: string | null | undefined): GlobeIsland | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** The island a visitor lands on first: the richest live island. */
export const FEATURED_ISLAND_ID = "bohol";

/** Where the globe faces before anything is selected: the live islands, a little off centre. */
export const HOME_VIEW: { center: LngLat } = { center: [118, 6] };

/** Ids in a sensible order for a tour of the live islands. */
export const TOUR_ORDER: string[] = ["bohol", "panglao", "balicasag", "pamilacan", "banacon"];
