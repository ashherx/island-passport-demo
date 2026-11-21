/**
 * Wording that only Option C uses (TEC-12). Everything the three options share (section titles,
 * CTA labels, sample notices, status names) comes from `islandStrings` in "@/lib/islands".
 * Placeholders use {curly} names and are filled by `t()` from "@/lib/strings".
 */
export const cStrings = {
  cover: {
    /** Two-tone headline: the first sentence in ink, the second in ultramarine. */
    lead: "Collect island stamps.",
    follow: "Back the people protecting them.",
    sub: "Every stamp is tied to a charity working on that island.",
    open: "Open now",
    soon: "Coming soon",
    islands: "Islands",
    countries: "Countries",
  },
  search: {
    placeholder: "Search an island",
    shortcut: "Press / to search",
    openTag: "Open",
    soonTag: "Soon",
  },
  index: {
    label: "Index",
    title: "Islands on the passport",
  },
  flight: {
    kicker: "En route",
    arrived: "Arrived at {name}",
  },
  card: {
    number: "No. {n}",
    stats: {
      reef: "Reef health",
      reefOf: "/ 100",
      species: "Species at risk",
      visitors: "Visitors a year",
      area: "Area",
      partners: "Stamps to collect",
    },
    tabs: {
      label: "Sections",
      about: "About",
      tourism: "Tourism",
      species: "Species",
      reef: "Reef",
      projects: "Projects",
      partners: "Stamps",
    },
    sheet: {
      expand: "Show the whole card",
      collapse: "Show the map",
      handle: "Card size",
    },
    facts: "At a glance",
    photos: "Photographs",
    photoOpen: "Open photo {n}: {caption}",
    pressures: "Under strain",
    tips: "What you can do",
    risk: "Red List",
    survey: "Survey",
    funded: "{percent}% there",
    example: "Example",
    exampleFrom: "From",
    collectFrom: "Collect {title}",
    linkCopied: "Link copied",
    shareTitle: "{name} on Island Passport",
    openPassport: "Open passport",
    readMore: "Read the full card",
  },
  stage: {
    label: "Photographs of {name}",
    previous: "Previous photo",
    next: "Next photo",
    backToMap: "Back to the map",
    counter: "{n} / {total}",
    show: "Show photo {n}",
  },
  soon: {
    kicker: "Coming soon",
    body: "Partners and charities for this island are being signed up. Its stamps will appear here when it opens.",
    notify: "Tell me when it opens",
    notified: "You are on the list",
    notifiedNote: "Demo only: nothing was sent and no details were collected.",
    meanwhile: "Open now",
  },
  coords: {
    label: "Globe centre",
  },
} as const;
