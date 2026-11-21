"use client";

/**
 * One island per page (PAS-3): name, locator on the province chart, the conservation priority and
 * the island's stamp slots. Collected stamps show in their status; empty slots are dashed.
 *
 * Slots are scattered the way stamps land in a real passport, from fixed layouts per slot count,
 * so nothing shifts when a stamp is added. Each slot is a <button> when it can be tapped: StPageFlip
 * forwards clicks on buttons instead of starting a page turn.
 */
import { memo, type CSSProperties } from "react";
import { Stamp } from "@/components/stamp";
import { strings, statusLabel, t } from "@/lib/strings";
import type { Island, Stamp as StampData, StampSlot } from "@/lib/types";
import { CompassMark, ProvinceChartArt, getChart, type ChartMarker } from "./chart";
import { Page, usePageMetrics, useStampPx, type PageChromeProps } from "./PageFrame";
import { contentStrings as cs } from "./strings";
import type { SlotOverride } from "./types";

export const u = (n: number) => `calc(var(--u) * ${n})`;

/**
 * Level of detail from the size the stamp is drawn at on screen, not from design units: on a
 * narrow phone a slot is 84px or less, where the promoter handle and the date cannot be read.
 * Below 120 CSS px the compact stamp (island name and artwork only, heavier lines) is used.
 * The stamp-press overlay draws <Stamp detail="auto"> at the same size and picks the same level.
 */
export const stampDetail = (px: number): "compact" | "full" => (px < 120 ? "compact" : "full");

/* ------------------------------------------------------------------ */
/* Slot                                                                */
/* ------------------------------------------------------------------ */

export interface SlotViewProps {
  slot: StampSlot;
  /** Stamp size in design units. */
  units: number;
  override?: SlotOverride;
  onSelect?(slot: StampSlot, stamp: StampData): void;
  onEmptySelect?(slot: StampSlot): void;
  style?: CSSProperties;
  className?: string;
}

export function SlotView({ slot, units, override, onSelect, onEmptySelect, style, className }: SlotViewProps) {
  const px = useStampPx(units);
  const detail = stampDetail(px);
  const stamp = override?.hidden ? null : slot.stamp;
  const status = stamp ? (override?.status ?? stamp.status) : null;
  const interactive = stamp ? Boolean(onSelect) : Boolean(onEmptySelect);

  const content = (
    <>
      <span className="ipp-slot__stamp" style={{ width: u(units), height: u(units) }}>
        {override?.render ? (
          override.render(px, detail)
        ) : stamp ? (
          <Stamp
            stamp={stamp}
            status={override?.status}
            size={px}
            detail={detail}
            inkProgress={override?.inkProgress}
            showSeal={override?.showSeal}
            decorative={interactive}
          />
        ) : (
          <Stamp slot={slot} size={px} detail={detail} decorative={interactive} />
        )}
        {override?.after?.(px)}
      </span>
      <span className="ipp-slot__caption">
        <span className="ipp-slot__title">{slot.title}</span>
        {status && (
          <span className="ipp-slot__status" data-status={status}>
            {statusLabel(status)}
          </span>
        )}
      </span>
    </>
  );

  const shared = {
    className: ["ipp-slot", className].filter(Boolean).join(" "),
    style,
    "data-slot-id": slot.id,
    "data-slot-status": status ?? "empty",
    "data-shape": slot.shape,
    "data-highlight": override?.highlight ? "" : undefined,
  };

  if (!interactive) return <div {...shared}>{content}</div>;

  const label = stamp
    ? t(cs.island.slotOpen, { title: slot.title, status: statusLabel(status ?? stamp.status) })
    : t(cs.island.slotEmptyAction, { title: slot.title });
  return (
    <button
      type="button"
      {...shared}
      aria-label={label}
      aria-haspopup={stamp ? "dialog" : undefined}
      onClick={() => (stamp ? onSelect?.(slot, stamp) : onEmptySelect?.(slot))}
    >
      {content}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Scatter layouts                                                     */
/* ------------------------------------------------------------------ */

interface Scatter {
  /** Stamp size in units. */
  size: number;
  /** Height of the field in units. */
  height: number;
  /** Top-left of each slot in units, inside a field 312 units wide. */
  at: [number, number][];
}

const FIELD_WIDTH = 312;
/** Caption under a stamp, in units. */
const CAPTION = 24;
/** Everything on an island page that is not the stamp field: head, title block, priority, foot. */
const PAGE_OVERHEAD = 252;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Where the stamps land. The arrangement is fixed per slot count, so nothing shifts when a stamp
 * is added; the stamp size follows the page height, so the same page fits a shorter book.
 */
function scatterFor(count: number, unitsHigh: number): Scatter {
  const room = unitsHigh - PAGE_OVERHEAD;
  const W = FIELD_WIDTH;
  if (count <= 1) {
    const size = Math.round(clamp(room - CAPTION - 6, 120, 180));
    return { size, height: size + CAPTION, at: [[(W - size) / 2, 0]] };
  }
  if (count === 2) {
    const size = Math.round(clamp((room - CAPTION) / 1.88, 104, 148));
    return { size, height: Math.round(size * 1.88) + CAPTION, at: [[2, 0], [W - size - 2, Math.round(size * 0.88)]] };
  }
  if (count === 3) {
    const size = Math.round(clamp((room - CAPTION * 2) / 2, 92, 124));
    return {
      size,
      height: size * 2 + CAPTION * 2,
      at: [[2, 0], [W - size - 2, Math.round(size * 0.3)], [Math.round((W - size) / 2 - 30), size + CAPTION]],
    };
  }
  if (count === 4) {
    const size = Math.round(clamp((room - CAPTION * 2 - 18) / 2, 88, 118));
    return {
      size,
      height: size * 2 + CAPTION * 2 + 18,
      at: [[12, 0], [W - size - 10, 18], [0, size + CAPTION], [W - size - 22, size + CAPTION + 18]],
    };
  }
  // Five or more: an even grid, three across.
  const rows = Math.ceil(count / 3);
  const size = Math.round(clamp((room - 14) / rows - CAPTION, 70, 98));
  const pitchX = (W - size) / 2;
  const pitchY = size + CAPTION + 4;
  const at: [number, number][] = [];
  for (let i = 0; i < count; i++) at.push([(i % 3) * pitchX, Math.floor(i / 3) * pitchY + (i % 3 === 1 ? 14 : 0)]);
  return { size, height: rows * pitchY + 14, at };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export interface IslandPageProps {
  island: Island;
  /** One-based position of the island in the province. */
  index: number;
  islandCount: number;
  slots: StampSlot[];
  /** All islands, for the locator's context dots. */
  markers: ChartMarker[];
  overrides?: Record<string, SlotOverride>;
  chrome: PageChromeProps;
  onStampSelect?(slot: StampSlot, stamp: StampData): void;
  onEmptySlotSelect?(slot: StampSlot): void;
  /**
   * Changes each time the reader jumps here from the province page: the locator pulses once.
   * 0 or undefined: no pulse.
   */
  locate?: number;
}

/** The stamp slots. A component of its own because the page is measured inside <Page>. */
function StampField({
  slots,
  overrides,
  onStampSelect,
  onEmptySlotSelect,
}: Pick<IslandPageProps, "slots" | "overrides" | "onStampSelect" | "onEmptySlotSelect">) {
  const { unitsHigh } = usePageMetrics();
  const scatter = scatterFor(slots.length, unitsHigh);
  return (
    <div className="ipp-stamps" data-count={slots.length} style={{ height: u(scatter.height) }}>
      {slots.map((slot, i) => {
        const [x, y] = scatter.at[i] ?? [0, 0];
        return (
          <SlotView
            key={slot.id}
            slot={slot}
            units={scatter.size}
            override={overrides?.[slot.id]}
            onSelect={onStampSelect}
            onEmptySelect={onEmptySlotSelect}
            style={{ left: u(x), top: u(y), width: u(scatter.size), ["--slot" as string]: scatter.size }}
          />
        );
      })}
    </div>
  );
}

function IslandPageImpl({
  island,
  index,
  islandCount,
  slots,
  markers,
  overrides,
  chrome,
  onStampSelect,
  onEmptySlotSelect,
  locate,
}: IslandPageProps) {
  const chart = getChart(island.province);
  const place = chart?.places[island.id];
  const collected = slots.filter((s) => s.stamp && !overrides?.[s.id]?.hidden).length;

  return (
    <Page
      {...chrome}
      kind="island"
      title={t(cs.island.aria, { island: island.name, province: island.province })}
      headLeft={t(strings.province.of, { province: island.province })}
      headRight={`${cs.island.label} ${t(cs.island.indexOf, { n: index, total: islandCount })}`}
      data={{ "data-island-id": island.id }}
    >
      <div className="ipp-island">
        <div className="ipp-island__top">
          <div className="ipp-island__heading">
            <h2 className="ipp-island__name type-display" data-long={island.name.length > 10 ? "" : undefined}>
              {island.name}
            </h2>
            <p className="ipp-island__meta">
              <span>{t(strings.passport.stampsOnIsland, { n: collected, total: slots.length })}</span>
              {place?.coords && (
                <span className="ipp-island__coords">
                  {cs.island.approx} {place.coords}
                </span>
              )}
            </p>
          </div>
          <div className="ipp-island__locator">
            {chart && place ? (
              <ProvinceChartArt
                key={locate ?? 0}
                chart={chart}
                markers={markers}
                activeId={island.id}
                pulse={Boolean(locate)}
                title={t(cs.island.locatorAria, { island: island.name, province: island.province })}
              />
            ) : (
              <CompassMark />
            )}
          </div>
        </div>
        <p className="ipp-island__blurb">{island.blurb}</p>
        <p className="ipp-island__priority">
          <span className="ipp-island__priority-label">{cs.island.priority}</span>
          <span className="ipp-island__priority-value">{island.subjects.join(" · ")}</span>
        </p>
        <StampField slots={slots} overrides={overrides} onStampSelect={onStampSelect} onEmptySlotSelect={onEmptySlotSelect} />
      </div>
    </Page>
  );
}

function sameChrome(a: PageChromeProps, b: PageChromeProps): boolean {
  return (
    a.number === b.number &&
    a.total === b.total &&
    a.side === b.side &&
    a.province === b.province &&
    a.passportNo === b.passportNo &&
    a.initialWidth === b.initialWidth
  );
}

function sameOverrides(
  slots: StampSlot[],
  a: Record<string, SlotOverride> | undefined,
  b: Record<string, SlotOverride> | undefined,
): boolean {
  if (a === b) return true;
  for (const slot of slots) {
    const x = a?.[slot.id];
    const y = b?.[slot.id];
    if (x === y) continue;
    if (!x || !y) return false;
    if (
      x.hidden !== y.hidden ||
      x.status !== y.status ||
      x.inkProgress !== y.inkProgress ||
      x.showSeal !== y.showSeal ||
      x.highlight !== y.highlight ||
      x.render !== y.render ||
      x.after !== y.after
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Memoised so that changing one stamp re-renders one page. The helpers in sample-data return new
 * arrays on every call, so slots are compared one by one (a changed slot is a new object).
 */
export const IslandPage = memo(IslandPageImpl, (a, b) => {
  if (
    a.island !== b.island ||
    a.index !== b.index ||
    a.islandCount !== b.islandCount ||
    a.onStampSelect !== b.onStampSelect ||
    a.onEmptySlotSelect !== b.onEmptySlotSelect ||
    a.locate !== b.locate ||
    a.slots.length !== b.slots.length ||
    a.markers.length !== b.markers.length ||
    !sameChrome(a.chrome, b.chrome)
  ) {
    return false;
  }
  for (let i = 0; i < a.slots.length; i++) if (a.slots[i] !== b.slots[i]) return false;
  return sameOverrides(a.slots, a.overrides, b.overrides);
});

export { sameChrome };
