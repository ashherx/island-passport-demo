/**
 * Small text helpers and the list of sample links for the recipient page. Kept apart from
 * model.ts so client components can use them without importing the island data.
 */

/** "Coral Trust's", but "Banacon Mangrove Keepers'". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** Fills {charity} in one of the kit's fixed sentences, keeping the possessive right. */
export function withCharity(template: string, charity: string): string {
  return template.replace("{charity}'s", possessive(charity)).replace("{charity}", charity);
}

/** The sample links the demo controls and the preview panel offer. */
export const SAMPLE_LANDING_CODES: { code: string; label: string }[] = [
  { code: "alex-pamilacan", label: "Traveler" },
  { code: "mia-bohol", label: "Creator" },
  { code: "boholdive-panglao", label: "Dive shop" },
  { code: "islatrips-bohol", label: "Travel agency" },
  { code: "coraltrust-balicasag", label: "Charity" },
  { code: "visayas-bohol", label: "Tourism board" },
  { code: "nobody-banacon", label: "Unknown code" },
];
