/** On-screen text for the option system and the globe landing shell (TEC-12). */
export const optionStrings = {
  meta: {
    title: "Island Passport: explore the islands",
    description:
      "Spin the globe, find an island and see who is protecting it. Sample content for a design proposal.",
  },
  switcher: {
    /** Accessible name of the A · B · C control. */
    label: "Design option",
    option: "Option {id}",
    /** Read out when the option changes. */
    announce: "Showing design option {id}",
    hint: "Press 1, 2 or 3 to switch",
  },
  names: { a: "A", b: "B", c: "C" },
  layouts: {
    /** Accessible name of the layout switcher, and its visible caption. */
    label: "Layout",
    /** Short names: the pill itself, where space is tight. */
    names: { split: "Split", horizon: "Horizon", orb: "Orb", fullbleed: "Full-bleed" },
    /** Full names: the list a phone opens, and what a screen reader hears. */
    fullNames: { split: "Split", horizon: "Horizon", orb: "Centred orb", fullbleed: "Full-bleed" },
    /** Read out when the layout changes. */
    announce: "Showing the {name} layout",
    /** The collapsed switcher on a phone: opens the list of layouts. */
    choose: "Layout: {name}. Change layout",
  },
  loading: "Loading the globe",
} as const;
