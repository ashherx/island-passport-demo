/**
 * On-screen text that only Option B uses (TEC-12). Everything the three options share (section
 * titles, calls to action, sample notices) comes from `islandStrings` in "@/lib/islands".
 * Placeholders in {curly} names are filled by `t()` from "@/lib/strings".
 */
export const bStrings = {
  headline: "Every stamp helps an island.",
  /** The emphasised words of the headline, underlined with a highlighter stroke. */
  headlineMark: "helps an island",
  sub: "Collect island stamps. Support the charities protecting them.",
  searchPlaceholder: "Where to? Try Bohol",
  hint: "Spin the globe, then tap an island",
  picks: "Open now",
  picksLabel: "Islands open now",
  flying: "Flying to {name}",
  landed: "{name} is open",
  backToGlobe: "Back to the globe",

  sheet: {
    expand: "Show more of the card",
    collapse: "Show less of the card",
    handle: "Drag to resize the card",
    sections: "Card sections",
  },

  tabs: {
    about: "About",
    tourism: "Impact",
    species: "Wildlife",
    reef: "Reef",
    projects: "Projects",
    partners: "Stamps",
  },

  about: {
    photos: "Postcards from the island",
    openPhoto: "Open photo {n}: {caption}",
  },
  tourism: {
    pressures: "Under pressure",
    tips: "How you can help",
  },
  species: {
    swipe: "Swipe to meet them all",
  },
  reef: {
    outOf: "out of {max}",
  },
  projects: {
    done: "{pct}% there",
  },
  partners: {
    stamps: "Island stamps",
    seals: "Official seals",
    collect: "Collect",
    collectLabel: "Collect {title} from {partner}",
    by: "Offered by {partner}",
    example: "Example",
  },

  trend: { up: "Rising", down: "Falling", steady: "Steady" },

  photos: {
    label: "Photos of {name}",
    previous: "Previous photo",
    next: "Next photo",
    show: "Show photo {n}",
    back: "Back to the map",
  },

  share: {
    copied: "Link copied",
    title: "{name} · Island Passport",
  },

  soon: {
    slot: "Your stamp goes here",
    listed: "You're on the list",
    listedNote: "Sample only: nothing is sent or saved in this demo.",
    meanwhile: "Open now, a short hop away",
  },
} as const;
