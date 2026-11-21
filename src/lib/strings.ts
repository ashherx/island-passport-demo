/**
 * Every piece of on-screen text in the demo lives here (TEC-12).
 * Components import `strings` (or `t`) and never hard-code copy.
 * Placeholders use {curly} names and are filled by `t()`.
 */
import type { DirectionId, StampStatus } from "./types";

/**
 * Who made the prototype. Left empty on purpose: the real name and contact link must come from the
 * bidder. While `BIDDER` is empty nothing about it is shown anywhere.
 */
const BIDDER: string = "";
const CONTACT_HREF: string = "";

export const strings = {
  app: {
    name: "Island Passport",
    tagline: "Collect the islands. Protect the islands.",
    /** Shown in the done state of the demo and in the page title, only when filled in. */
    bidder: BIDDER,
    /** Optional link (mailto: or https:) behind the bidder line. */
    contactHref: CONTACT_HREF,
    metaTitle: BIDDER ? `Island Passport motion prototype by ${BIDDER}` : "Island Passport: motion demo",
    metaDescription:
      "An interactive passport, the stamping moment and the Verified Supporter upgrade. Sample content for a design proposal.",
    /** Under the name on the share card (opengraph-image.tsx). */
    shareKind: "Motion prototype",
  },

  /** PUB-7: sample content is always labelled. */
  sample: {
    tag: "Sample",
    notice: "Sample content for a design demo. People, promoters and charities are fictional.",
    noDonations: "No donations are processed in this demo.",
  },

  country: {
    name: "Philippines",
    code: "PH",
    republic: "Republic of the Philippines",
    /** STM-4: the Regional Stamp label is set per country. */
    regionalStampLabel: "Provincial Stamp",
    regionLabel: "Province",
  },

  province: {
    name: "Bohol",
    of: "Province of {province}",
  },

  status: {
    discovery: {
      label: "Discovery",
      long: "Discovery stamp",
      onStamp: "Discovery",
      blurb: "Collected through a promoter's campaign.",
    },
    pending: {
      label: "Donation pending",
      long: "Donation pending",
      onStamp: "Pending",
      tab: "Donation pending",
      blurb: "You tapped Donate. Waiting for the charity to confirm.",
    },
    verified: {
      label: "Verified Supporter",
      long: "Verified Supporter",
      onStamp: "Verified",
      seal: "Verified Supporter",
      blurb: "The charity confirmed the donation.",
    },
  } satisfies Record<StampStatus, Record<string, string>>,

  stamp: {
    empty: "Not yet collected",
    emptyShort: "Not yet",
    locked: "Locked",
    provincial: "Provincial Stamp",
    /** Around the ring of the Provincial Stamp. Not "Province of": the stamp is not a government seal. */
    provincialOf: "{province} · Island Passport",
    provincialLocked: "{n} more Verified to unlock",
    provincialLockedOne: "1 more Verified to unlock",
    ariaStamp: "{title} stamp, {island}. Status: {status}. {date}.",
    ariaStampNoDate: "{title} stamp, {island}. Status: {status}.",
    ariaEmpty: "{title}, {island}. Not yet collected.",
    ariaProvincial: "Provincial Stamp, {province}. Awarded {date}.",
    ariaProvincialLocked: "Provincial Stamp, {province}. Not yet awarded.",
    ariaSeal: "Verified Supporter seal",
  },

  stampDetail: {
    heading: "Stamp details",
    island: "Island",
    promoter: "Promoter",
    charity: "Charity",
    purpose: "Conservation purpose",
    date: "Date",
    status: "Status",
    close: "Close",
  },

  passport: {
    title: "Passport",
    coverTitle: "Island Passport",
    coverCountry: "Philippines",
    coverProvince: "Bohol",
    holder: "Traveler",
    passportNo: "Passport no.",
    memberSince: "Member since",
    open: "Open passport",
    close: "Close passport",
    tapToOpen: "Tap to open",
    swipeHint: "Swipe to turn the page",
    nextPage: "Next page",
    prevPage: "Previous page",
    pageOf: "Page {page} of {total}",
    ariaBook: "Interactive passport. Use the left and right arrow keys to turn pages.",
    islandsHeading: "Islands of {province}",
    stampsOnIsland: "{n} of {total} stamps",
    provincialPage: "Provincial Stamp",
    /** Starts with IP<BOH, not the ICAO prefix of a real passport (P<PHL). */
    mrzLine: "IP<BOH{surname}<<{given}<<<<<<<<<<<<<<<<<<<<",
  },

  progress: {
    ring: "{n} of {total} {province} stamps",
    ringShort: "{n}/{total}",
    ariaRing: "Collection progress: {n} of {total} {province} stamps.",
    byStatus: "{verified} verified, {pending} pending, {discovery} discovery",
    toProvincial: "{n} more Verified Supporter stamps to earn the Provincial Stamp",
    toProvincialOne: "1 more Verified Supporter stamp to earn the Provincial Stamp",
    provincialReady: "Provincial Stamp earned",
  },

  actions: {
    collect: "Collect stamp",
    donate: "Donate",
    confirmDonation: "Simulate charity confirmation",
    awardProvincial: "Award Provincial Stamp",
    replay: "Replay",
    reset: "Reset demo",
    share: "Share",
    continue: "Continue",
    done: "Done",
    viewInPassport: "View in passport",
  },

  moments: {
    stampEarnedTitle: "Stamp collected",
    stampEarnedBody: "{title}, {island}. A Discovery stamp is now in your passport.",
    pendingTitle: "Donation pending",
    pendingBody: "Your stamp upgrades only if {charity} confirms a donation.",
    verifiedTitle: "Verified Supporter",
    verifiedBody: "{charity} confirmed your support for {island}.",
    provincialTitle: "Provincial Stamp awarded",
    provincialBody: "You hold {n} Verified Supporter stamps in {province}.",
  },

  theme: {
    switcherLabel: "Appearance",
    directionLabel: "Art direction",
    modeLabel: "Color mode",
    light: "Light",
    dark: "Dark",
    toLight: "Switch to light mode",
    toDark: "Switch to dark mode",
    directions: {
      classic: { name: "Classic", hint: "Navy leather and gold foil" },
      reef: { name: "Reef", hint: "Sea-green linen, coral and sand" },
      journal: { name: "Journal", hint: "Kraft field notebook, hand-inked" },
    } satisfies Record<DirectionId, { name: string; hint: string }>,
  },

  lab: {
    stampTitle: "Stamp system",
    stampIntro:
      "Every stamp artwork in every status, plus the empty slot, across the three art directions. Artwork is placeholder line art until final illustrations arrive.",
    statuses: "The three statuses",
    statusesNote: "One stamp, three unmistakable states (STM-7).",
    allStamps: "Bohol collection",
    allStampsNote: "Each artwork shown as Discovery, Donation pending, Verified Supporter and empty.",
    provincial: "Provincial Stamp",
    provincialNote: "Larger, double ring, foil. Locked until three stamps are Verified.",
    scale: "Scale",
    scaleNote: "The same stamp from 80px to 320px.",
    inkReveal: "Ink reveal",
    inkRevealNote: "inkProgress from 0 to 1, as the press animation drives it.",
    materials: "Materials",
    materialsNote: "Cover, paper and foil, drawn in CSS until photographed textures arrive.",
    cover: "Cover",
    paper: "Paper",
    foil: "Foil",
    inks: "Inks",
    type: "Type",
    typeDisplay: "Display",
    typeBody: "Body",
    typeMono: "Mono",
    typeStamp: "Stamp",
    pangram: "Balicasag, Pamilacan, Banacon",
    onPage: "On the page",
    onPageNote: "Stamps as they sit in the passport.",
    empty: "Empty",
    earned: "Earned",
    locked: "Locked",
    press: "Press",
    directionHeading: "{name} direction",
  },

  /** Passport content (cover, pages, detail sheet) and the header. Was content/strings.ts. */
  content: {
    cover: {
      titleLine1: "Island",
      titleLine2: "Passport",
      subtitle: "Environmental Stamps",
      /** Small line above the title. */
      eyebrow: "{province} · {country}",
      /** Journal direction: the printed label on the kraft cover. */
      labelSeries: "Field notebook",
      labelProvince: "Province",
      labelNo: "No.",
      labelTraveler: "Traveler",
      aria: "Island Passport. Environmental Stamps, {province}. Front cover.",
      backAria: "Island Passport. Back cover.",
      backCredit:
        "Every stamp points to a vetted conservation charity. Donations go directly to the charity. A keepsake of conservation support. Not a travel document or a government seal.",
    },

    holder: {
      heading: "Traveler",
      aria: "Traveler page",
      name: "Name",
      handle: "Handle",
      issued: "Issued",
      province: "Home collection",
      stamps: "Stamps",
      stampsValue: "{n} of {total}",
      signature: "Traveler's signature",
      pledge: "I travel lightly, collect gently and leave each island better than I found it.",
      pledgeLabel: "Traveler's pledge",
      /** Second machine-readable line. Playful on purpose; padded to 44 characters with "<". */
      mrzLine2: "{no}<<{n}OF{total}<<PROTECT<THE<ISLANDS",
      specimen: "Sample",
      monogramAria: "Monogram of {name}",
    },

    province: {
      aria: "Province of {province}: islands and stamp key",
      summary: "{islands} islands · {stamps} stamps",
      islandsLabel: "Islands",
      mapNote: "Stylized chart, not to scale",
      mapAria: "Stylized chart of {province} with {n} islands marked",
      keyLabel: "Stamp key",
      pageShort: "p. {page}",
      rowAria: "{island}: {n} of {total} stamps, page {page}",
    },

    island: {
      aria: "{island}, {province}",
      label: "Island",
      indexOf: "{n} / {total}",
      priority: "Conservation priority",
      approx: "approx.",
      locatorAria: "{island} on the chart of {province}",
      slotOpen: "Open details: {title}, {status}",
      slotEmpty: "{title}: not yet collected",
      slotEmptyAction: "{title}: not yet collected. Collect this stamp.",
    },

    provincial: {
      aria: "Provincial Stamp page",
      heading: "Provincial Stamp",
      rule: "Awarded automatically when you hold {n} Verified Supporter stamps in {province}.",
      progress: "{n} of {total} Verified Supporter stamps",
      slotCaption: "Reserved for the Provincial Stamp of {province}",
      earnedCaption: "Awarded {date}",
      pipAria: "{n} of {total} Verified Supporter stamps towards the Provincial Stamp",
      open: "Open details: Provincial Stamp",
    },

    page: {
      aria: "Page {page} of {total}: {title}",
      microtext: "ISLAND PASSPORT · {province} · COLLECT THE ISLANDS · PROTECT THE ISLANDS · ",
    },

    sheet: {
      aria: "Stamp details: {title}",
      dragHint: "Drag down to close",
      provincialIsland: "Province",
      awarded: "Awarded",
      reason: "Awarded for",
      statusProvincial: "Provincial Stamp",
    },

    header: {
      home: "Island Passport, home",
      /** Printed beside the dial, which shows the count: "6" + "of 12" / "Bohol stamps". */
      ringOf: "of {total}",
      ringBottom: "{province} stamps",
      appearance: "Art direction",
    },

    lab: {
      title: "Passport pages",
      intro:
        "Cover, inside pages and back cover laid flat for review. Tap any stamp for its detail sheet. The same pages go into the page-flip book.",
      cover: "Front cover",
      backCover: "Back cover",
      pageN: "Page {n}",
      ringHeading: "Progress ring",
      ringNote: "Springs forward when a stamp is added.",
      addStamp: "Add a stamp",
      reset: "Reset",
      confirm: "Confirm a donation",
      award: "Award Provincial Stamp",
      allDirections: "All three directions",
      allDirectionsNote: "The same content in each art direction.",
      bookSize: "Shown at book size (about 360 by 560).",
    },
  },

  /** Status upgrade and Provincial Stamp award. Was moments/celebrations/strings.ts. */
  celebrations: {
    upgrade: {
      /** Announced to assistive tech while the animation runs. */
      skipHint: "Tap the stamp to skip the animation",
    },
    award: {
      cta: "Add to passport",
      skip: "Skip",
      skipAria: "Skip the celebration and add the stamp",
      added: "Provincial Stamp added to your passport.",
    },
    lab: {
      title: "Celebrations",
      intro:
        "Two moments after the first stamp: a pending stamp becoming Verified Supporter, and the Provincial Stamp award. Both can be skipped and both respect reduced motion.",
      upgradeTitle: "Status upgrade",
      upgradeNote: "Donation pending becomes Verified Supporter (UX-3).",
      upgradeHint: "The charity confirms. The same stamp upgrades in place.",
      awardTitle: "Provincial Stamp award",
      awardNote: "A short celebration, then the stamp lands on its page (UX-4).",
      awardHint: "Three Verified Supporter stamps in the province unlock it.",
      pageIsland: "Island",
      pageProvince: "Province",
      again: "Play again",
      reducedNote: "Reduced motion is on: both moments use a simple fade.",
    },
  },

  /** The stamping moment. Was moments/stamp-press/strings.ts. */
  press: {
    /** Read by screen readers when the press starts; the moment itself is decorative. */
    skipHint: "Stamping. Tap or press Escape to skip.",
    sound: {
      label: "Sound",
      on: "Sound on",
      off: "Sound off",
    },
    /** Engraved around the stamper's mount. {province} is filled in. */
    lettering: "Island Passport ✦ {province} ✦ ",

    lab: {
      title: "Stamping moment",
      intro:
        "Earning a stamp: the stamper swings over the page, slams down, and lifts to leave a fresh Discovery impression. Tap anywhere to skip.",
      pageLabel: "Passport page",
      choose: "Stamp to collect",
      slowMotion: "Slow motion",
      haptics: "Vibration",
      hapticsOn: "Supported on this device",
      hapticsOff: "Not available in this browser",
      reducedMotion: "Reduced motion is on: the impression fades in without movement.",
      collected: "Collected",
      stageNote: "The page shakes, the phone buzzes and the ink is still wet.",
    },
  },

  /** Lab page of the custom flip engine (/lab/flip-custom). Was engine-custom/strings.ts. */
  flipCustomLab: {
    title: "Custom flip engine",
    intro:
      "A passport book built from scratch with Motion and CSS 3D: hinged-strip paper bend, drag to turn with a fling, and a weighted cover.",
    open: "Open",
    close: "Close",
    closed: "Closed",
    first: "First page",
    last: "Last page",
    peek: "Hint",
    fps: "FPS",
    fpsNow: "{fps} fps",
    fpsWorst: "· max {ms} ms",
    fpsIdle: "turn a page",
    layout: "Layout",
    layoutAuto: "Auto",
    layoutSingle: "Single",
    layoutSpread: "Spread",
    reducedOn: "Reduced motion is on: pages cross-fade.",
    holderHeading: "Traveler",
    holderName: "Name",
    notesHeading: "Field notes",
    notesBody: "Space for the next province.",
    backNote: "Printed on paper that remembers the sea.",
    pageNo: "{n}",
    stampsHere: "{n} of {total} collected",
    loading: "Loading passport",
  },

  /** Lab page of the StPageFlip engine (/lab/flip-lib). */
  flipLibLab: {
    title: "Passport book",
    engine: "StPageFlip engine",
    intro:
      "Tap the cover, or take it by the edge and pull. Then swipe, drag a corner, tap the page edge or use the arrow keys.",
    spread: "Layout",
    spreadAuto: "Auto",
    spreadSingle: "Single",
    spreadDouble: "Spread",
    first: "First",
    last: "Last",
    hint: "Peek",
    turnOver: "Turn over",
    states: { closed: "Closed", opening: "Opening", open: "Open", closing: "Closing" },
    notes: "Notes",
    backLine: "This passport is a keepsake of conservation support. It is not a travel document.",
    endpaper: "Ex libris",
  },

  /** The composed demo on the home page (src/components/demo). */
  demo: {
    eyebrow: "Sample concept demo",
    intro: "Passport, page-flip, stamping, upgrade and award. The map fly-to is outside this demo.",
    hintOpen: "Tap the passport to open it",
    hintSwipe: "Swipe to turn",
    hintStamp: "Tap a stamp",
    hintEmpty: "Tap an empty slot",
    hintBack: "Tap to turn it back over",
    pageOf: "{page} / {total}",
    /** Two pages lie open (the desktop spread). */
    pagesOf: "{from}-{to} / {total}",
    bookRegion: "Passport",
    storyLabel: "Demo story",
    stepOf: "Step {n} of {total}",
    /** The stepper items are buttons: each sets the sample data to the start of that step. */
    jumpTo: "Jump to step: {short}",
    steps: {
      collect: {
        short: "Collect",
        cta: "Collect a stamp",
        note: "{title}, {island}. Shared by {promoter}.",
        /** While the book opens and turns to the page, before the stamper appears. */
        opening: "Opening your passport",
        busy: "Stamping",
      },
      donate: {
        short: "Donate",
        cta: "Donate",
        note: "Opens the charity's own page. Nothing is charged here.",
        busy: "Marking as pending",
      },
      confirm: {
        short: "Confirm",
        cta: "Simulate: charity confirms",
        /** Two lines at most at 390 px: the bar clamps the note there. */
        note: "Later: the traveler donates on the charity's page with the same email and does nothing else. The charity confirms.",
        busy: "Confirming",
      },
    },
    award: {
      note: "{n} Verified Supporter stamps in {province} unlock it.",
      /** On the button between the Verified seal landing and the award opening. {n} is the Verified count. */
      bridge: "{n} of {n} Verified in {province}",
      busy: "Awarding the Provincial Stamp",
    },
    done: {
      title: "Story complete",
      note: "Turn the pages, tap a stamp, switch the art direction.",
      cta: "Replay demo",
      /** On the button while the book closes for a replay. */
      busy: "Closing the passport",
    },
    replay: "Replay demo",
    replayShort: "Restart",
    skip: "Skip the animation",
    toast: {
      /** Two lines at most on a 390 px phone. The Donate note under the button says whose page opens. */
      pendingBody: "Nothing is charged here. The stamp upgrades only when {charity} confirms.",
      reset: "Demo reset",
      resetBody: "The passport is back where it started.",
      dismiss: "Dismiss",
    },
    footer: "Motion demo for a design proposal.",
    /** Bar note in the done state, only when strings.app.bidder is filled in. */
    byline: "Motion prototype by {bidder} for the Island Passport RFP",
    fps: "{fps} fps",
    fpsWorst: "worst {ms} ms",
    reducedOn: "Reduced motion is on: gentle fades only.",
    /** Beside reducedOn, before the book is first opened: play the demo with its full motion once. */
    playFull: "Play full motion",
  },
} as const;

export type Strings = typeof strings;

/** Fill {placeholders} in a template. Unknown names are left as-is. */
export function t(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

export interface StampDateParts {
  day: string;
  month: string;
  year: string;
}

/** Split an ISO date (YYYY-MM-DD) without touching the Date object, so it never shifts by timezone. */
export function stampDateParts(iso: string): StampDateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return { day: "--", month: "---", year: "----" };
  return { day: m[3], month: MONTHS[Math.min(11, Math.max(0, Number(m[2]) - 1))], year: m[1] };
}

/** "2027-03-14" becomes "14 MAR 2027", the way an entry stamp prints it. */
export function formatStampDate(iso: string): string {
  const p = stampDateParts(iso);
  return `${p.day} ${p.month} ${p.year}`;
}

/** Sentence-case date for interface text: "14 Mar 2027". */
export function formatDate(iso: string): string {
  const p = stampDateParts(iso);
  return `${Number(p.day) || p.day} ${p.month.charAt(0)}${p.month.slice(1).toLowerCase()} ${p.year}`;
}

export function statusLabel(status: StampStatus): string {
  return strings.status[status].label;
}
