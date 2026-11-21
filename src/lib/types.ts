/**
 * Shared types for the Island Passport demo.
 * Owned by the "foundation" agent. Other agents: import from here, do not redefine.
 */
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Stamps                                                              */
/* ------------------------------------------------------------------ */

/**
 * STM-1..3. One stamp moves through these in place.
 * - discovery: collected through a promoter campaign.
 * - pending:   traveler tapped Donate. Never presented as donated.
 * - verified:  the charity confirmed the donation ("Verified Supporter").
 */
export type StampStatus = "discovery" | "pending" | "verified";

export const STAMP_STATUSES: readonly StampStatus[] = ["discovery", "pending", "verified"] as const;

/** STM-4. "provincial" is the Regional Stamp, labelled "Provincial Stamp" in the Philippines. */
export type StampKind = "island" | "provincial";

/** Frame outline of the impression. "seal" is reserved for the Provincial Stamp. */
export type StampShape = "circle" | "rounded" | "oval" | "octagon" | "scalloped" | "seal";

/**
 * Artwork template base names (STM-5). Files live in public/stamps/<name>.svg (placeholder)
 * or public/stamps/<name>.png (generated ink mask). Resolve with artUrl() from "@/lib/assets".
 */
export type StampArt =
  | "stamp-chocolate-hills"
  | "stamp-tarsier"
  | "stamp-sea-turtle"
  | "stamp-dolphins"
  | "stamp-mangroves"
  | "stamp-reef"
  | "stamp-provincial";

export interface Stamp {
  id: string;
  /** Artwork template base name. */
  art: StampArt;
  /** Subject of the artwork, e.g. "Chocolate Hills". */
  title: string;
  /** Island display name, e.g. "Balicasag". */
  island: string;
  islandId: string;
  /** Promoter handle including the "@", e.g. "@mia.sample". Fictional sample data. */
  promoter: string;
  /** Charity display name. Fictional sample data. */
  charity: string;
  /** Conservation purpose shown in the stamp detail (PAS-4). */
  purpose: string;
  /** ISO date (YYYY-MM-DD) the stamp was collected or last changed status. */
  date: string;
  status: StampStatus;
  kind: StampKind;
  shape: StampShape;
}

/**
 * A place in the passport that a stamp can occupy. `stamp` is null until collected.
 * The slot carries enough of the template (art, shape, island) to draw the empty placeholder.
 */
export interface StampSlot {
  id: string;
  islandId: string;
  island: string;
  art: StampArt;
  title: string;
  shape: StampShape;
  kind: StampKind;
  stamp: Stamp | null;
}

export interface Island {
  id: string;
  name: string;
  province: string;
  /** One line about the place. */
  blurb: string;
  /** What the stamps on this island celebrate, e.g. ["Sea turtle", "Reef"]. */
  subjects: string[];
}

export interface ProvincialStampDef {
  id: string;
  art: StampArt;
  province: string;
  /** Verified stamps a traveler needs in the province (admin-set, STM-4a). */
  requiredVerified: number;
  /** False in the sample data: the demo awards it live. */
  earned: boolean;
  /** The stamp as it looks once awarded. Pass to <Stamp /> for the celebration. */
  stamp: Stamp;
}

export interface PassportHolder {
  name: string;
  handle: string;
  /** Decorative passport number printed on the cover page. */
  passportNo: string;
  memberSince: string;
}

export interface PassportData {
  id: string;
  /** PUB-7: everything in this demo is sample content. */
  sample: true;
  holder: PassportHolder;
  country: string;
  countryCode: string;
  province: string;
  islands: Island[];
  /** All stamp slots in the province, in passport order (grouped by island). */
  slots: StampSlot[];
  provincial: ProvincialStampDef;
}

export interface PassportProgress {
  /** Slots holding a stamp of any status. */
  collected: number;
  total: number;
  discovery: number;
  pending: number;
  verified: number;
  empty: number;
  /** collected / total, 0..1 */
  ratio: number;
  /** Verified stamps still needed for the Provincial Stamp (0 when reached). */
  toProvincial: number;
}

/* ------------------------------------------------------------------ */
/* Art direction and theme                                             */
/* ------------------------------------------------------------------ */

export type DirectionId = "classic" | "reef" | "journal";
export const DIRECTION_IDS: readonly DirectionId[] = ["classic", "reef", "journal"] as const;

export type ThemeMode = "light" | "dark";

/* ------------------------------------------------------------------ */
/* Shared component contract: the passport book                        */
/* ------------------------------------------------------------------ */

/**
 * Contract for the interactive passport (UX-2, PAS-3).
 * Page indexes are zero-based and refer to `pages` (the cover is not a page).
 */
export interface PassportBookProps {
  cover: ReactNode;
  pages: ReactNode[];
  backCover?: ReactNode;
  onFlip?(pageIndex: number): void;
  onOpenChange?(open: boolean): void;
  className?: string;
}

export interface PassportBookHandle {
  open(): void;
  close(): void;
  flipTo(page: number): void;
  next(): void;
  prev(): void;
}
