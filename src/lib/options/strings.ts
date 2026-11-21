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
  loading: "Loading the globe",
} as const;
