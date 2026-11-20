import { DEMO_SCRIPT } from "@/lib/sample-data";

/**
 * The scripted story of the home-page demo. One stamp is followed through all three statuses:
 * the empty "Spinner dolphins" slot on Pamilacan (the island's page is about those dolphins) is
 * collected (Discovery), the traveler taps Donate (Donation pending), and the charity confirms
 * (Verified Supporter). With the two stamps that are already Verified in the sample data, that
 * makes three, which is the threshold for the Provincial Stamp of Bohol (STM-4).
 */
export const STORY = {
  slotId: DEMO_SCRIPT.collectSlotId,
  /** Date printed on stamps earned during the demo. */
  today: DEMO_SCRIPT.today,
} as const;
