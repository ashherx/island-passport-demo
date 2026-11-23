import { getIsland } from "@/lib/islands";
import type { PassportData, StampStatus } from "@/lib/types";
import type { CoverStop } from "./types";

const RANK: Record<StampStatus, number> = { discovery: 0, pending: 1, verified: 2 };

/**
 * The islands the cover globe tours: every island of the passport that holds a stamp and that
 * the globe knows (it needs an outline to fly to). Order is the passport's page order.
 */
export function coverStops(passport: PassportData, pageOf: Record<string, number>): CoverStop[] {
  const stops: CoverStop[] = [];
  for (const island of passport.islands) {
    const slots = passport.slots.filter((s) => s.islandId === island.id);
    const held = slots.filter((s) => s.stamp);
    if (!held.length || !getIsland(island.id) || typeof pageOf[island.id] !== "number") continue;
    let status: StampStatus = "discovery";
    for (const slot of held) if (slot.stamp && RANK[slot.stamp.status] > RANK[status]) status = slot.stamp.status;
    stops.push({
      id: island.id,
      name: island.name,
      page: pageOf[island.id],
      count: held.length,
      total: slots.length,
      status,
      slotIds: held.map((s) => s.id),
    });
  }
  return stops;
}

export function sameStops(a: readonly CoverStop[], b: readonly CoverStop[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.id !== y.id || x.page !== y.page || x.count !== y.count || x.total !== y.total || x.status !== y.status) return false;
    if (x.slotIds.join() !== y.slotIds.join()) return false;
  }
  return true;
}
