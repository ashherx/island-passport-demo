import type { GlobeStatus } from "@/components/globe";
import type { StampStatus } from "@/lib/types";

/** One island the cover globe visits: an island of the passport that holds at least one stamp. */
export interface CoverStop {
  /** Island id. The passport and the globe use the same ids. */
  id: string;
  name: string;
  /** Zero-based page of the island in the book. */
  page: number;
  /** Stamps held on the island, and how many slots it has. */
  count: number;
  total: number;
  /** The best status among its stamps: verified, then pending, then discovery. */
  status: StampStatus;
  /** Slots that hold a stamp (highlighted when the book opens on the island). */
  slotIds: string[];
}

/**
 * boot     nothing has happened yet (the map is loading, or there is nothing to tour)
 * planet   resting on the whole globe, turning slowly
 * travel   the camera is on its way to the focus island
 * island   resting over the focus island
 * user     the visitor has the globe in hand; the tour waits
 * held     the passport is open (or the cover is out of sight): the globe is frozen
 */
export type CoverPhase = "boot" | "planet" | "travel" | "island" | "user" | "held";

export interface CoverGlobeState {
  stops: readonly CoverStop[];
  /** The island the lettering and the "Open to ..." affordance refer to. */
  focusId: string | null;
  /** What the lettering under the globe shows: the province line, or the focus island. */
  view: "planet" | "island";
  phase: CoverPhase;
  /** The visitor picked the focus island: the tour waits longer before moving on. */
  pinned: boolean;
  status: GlobeStatus;
  /** The passport is not closed: the live map is hidden under a still image of itself. */
  frozen: boolean;
  /** The still image (PNG data URL), once taken. */
  still: string | null;
  /** Reduced motion: the window is veiled while the camera cuts to the next view. */
  veil: boolean;
}
