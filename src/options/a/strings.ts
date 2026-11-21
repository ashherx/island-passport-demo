/**
 * On-screen text that belongs to option A only (TEC-12). Everything the three options share
 * (section titles, calls to action, sample notices) comes from `islandStrings` in @/lib/islands.
 * Placeholders use {curly} names and are filled by `t()` from "@/lib/strings".
 */
export const aStrings = {
  hero: {
    title: "Collect island stamps.",
    accent: "Support the charities protecting them.",
    body: "Spin the globe, choose an island and meet the people keeping it wild.",
  },
  search: {
    placeholder: "Where to? Try Bohol",
    open: "Open now",
    soon: "Coming soon",
  },
  rail: {
    label: "Islands",
    open: "Open now",
    soon: "Soon",
    soonLabel: "Coming soon",
  },
  flight: {
    flying: "Flying to {name}",
    arrived: "Arrived at {name}",
  },
  card: {
    nav: { about: "About", tourism: "Impact", species: "Wildlife", reef: "Reef", projects: "Projects", partners: "Stamps" },
    navLabel: "Sections of this island",
    region: "{region}, {country}",
    facts: "At a glance",
    gallery: "Photos",
    openPhoto: "Open photo: {caption}",
    pressures: "Under pressure",
    tips: "Tread lightly",
    iucnScale: "{status}, step {n} of 5 on the IUCN Red List scale",
    ladderTitle: "How a stamp is earned",
    ladderBody: "Give to a partner charity on its own site. When the charity confirms, the stamp lands in your passport.",
    seals: "Official seals",
    stamps: "Island stamps",
    example: "example",
    collectFrom: "Collect {title} from {name}",
    passportLink: "Open the sample passport",
    expand: "Show the full island card",
    collapse: "Show less of the card",
    grab: "Drag to resize the card",
    trend: { up: "rising", down: "falling", steady: "steady" },
  },
  glance: {
    reef: "Reef health {value}",
    species: "{n} species at risk",
    stamps: "{n} stamps",
  },
  soon: {
    heading: "On the map soon",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    notify: "Notify me",
    done: "Noted. This is a demo, so nothing was sent or saved.",
    explore: "Explore {name} meanwhile",
  },
  photos: {
    label: "Photos of {name}",
    previous: "Previous photo",
    next: "Next photo",
    count: "{n} / {total}",
    go: "Show photo {n}",
  },
  share: {
    copied: "Link copied",
    title: "{name} on Island Passport",
  },
} as const;
