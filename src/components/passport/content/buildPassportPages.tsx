"use client";

/**
 * buildPassportPages(data, opts) turns a PassportData into the nodes <PassportBook> takes:
 *
 *   const { cover, pages, backCover, pageMap } = buildPassportPages(passport, { onStampSelect });
 *   <PassportBook cover={cover} pages={pages} backCover={backCover} />
 *
 * Page order (zero-based indexes into `pages`):
 *   0                holder page (inside cover)
 *   1                province page: chart, island index, stamp key
 *   2 .. 1 + islands one page per island, in passport order
 *   last             Provincial Stamp
 *
 * usePassportContent(data, opts) is the same plus the stamp detail sheet wired up (PAS-4).
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { getProgress, slotsByIsland } from "@/lib/sample-data";
import type { PassportData, Stamp, StampSlot } from "@/lib/types";
import type { ChartMarker } from "./chart";
import { BackCover, FrontCover } from "./Cover";
import { IslandPage } from "./IslandPage";
import type { PageChromeProps, PageSide } from "./PageFrame";
import { HolderPage, ProvincePage, ProvincialPage, type ProvinceIndexRow } from "./Pages";
import { StampDetailSheet } from "./StampDetailSheet";
import type { BuildPassportOptions, PassportContent, PassportPageMap } from "./types";

const FIRST_ISLAND_PAGE = 2;

/** Where each page is, without building anything. */
export function getPassportPageMap(data: PassportData): PassportPageMap {
  const islands: Record<string, number> = {};
  data.islands.forEach((island, i) => {
    islands[island.id] = FIRST_ISLAND_PAGE + i;
  });
  const provincial = FIRST_ISLAND_PAGE + data.islands.length;
  const slotIsland = new Map(data.slots.map((s) => [s.id, s.islandId]));
  return {
    count: provincial + 1,
    holder: 0,
    province: 1,
    islands,
    provincial,
    forSlot(slotId: string) {
      if (slotId === data.provincial.id) return provincial;
      const islandId = slotIsland.get(slotId);
      return islandId !== undefined && islandId in islands ? islands[islandId] : -1;
    },
  };
}

export function buildPassportPages(data: PassportData, opts: BuildPassportOptions = {}): PassportContent {
  const pageMap = getPassportPageMap(data);
  const total = pageMap.count;
  const progress = getProgress(data);
  const groups = slotsByIsland(data);
  const spread = opts.layout === "spread";

  const chrome = (index: number): PageChromeProps => {
    const side: PageSide = spread && index % 2 === 0 ? "left" : "right";
    return {
      number: index + 1,
      total,
      side,
      province: data.province,
      passportNo: data.holder.passportNo,
      initialWidth: opts.pageWidth,
    };
  };

  const markers: ChartMarker[] = data.islands.map((island, i) => ({ id: island.id, index: i + 1, name: island.name }));
  const rows: ProvinceIndexRow[] = groups.map((g) => ({
    island: g.island,
    slots: g.slots,
    page: pageMap.islands[g.island.id] + 1,
  }));

  const pages: ReactNode[] = [
    <HolderPage
      key="holder"
      holder={data.holder}
      country={data.country}
      province={data.province}
      progress={progress}
      chrome={chrome(pageMap.holder)}
    />,
    <ProvincePage
      key="province"
      province={data.province}
      country={data.country}
      rows={rows}
      markers={markers}
      overrides={opts.slotOverrides}
      chrome={chrome(pageMap.province)}
    />,
    ...groups.map((g, i) => (
      <IslandPage
        key={`island-${g.island.id}`}
        island={g.island}
        index={i + 1}
        islandCount={groups.length}
        slots={g.slots}
        markers={markers}
        overrides={opts.slotOverrides}
        chrome={chrome(pageMap.islands[g.island.id])}
        onStampSelect={opts.onStampSelect}
        onEmptySlotSelect={opts.onEmptySlotSelect}
      />
    )),
    <ProvincialPage
      key="provincial"
      provincial={data.provincial}
      verified={progress.verified}
      override={opts.slotOverrides?.[data.provincial.id]}
      chrome={chrome(pageMap.provincial)}
      onSelect={opts.onProvincialSelect}
    />,
  ];

  const cover = (
    <FrontCover
      province={data.province}
      country={data.country}
      passportNo={data.holder.passportNo}
      holderName={data.holder.name}
      interactive={opts.coverInteractive ?? true}
      pageEdge={opts.coverPageEdge}
      initialWidth={opts.pageWidth}
    />
  );
  const backCover = <BackCover pageEdge={opts.coverPageEdge} initialWidth={opts.pageWidth} />;

  return { cover, pages, backCover, pageMap };
}

export interface UsePassportContentResult extends PassportContent {
  /** Render this once, anywhere. It portals to <body>. */
  sheet: ReactNode;
  /** Open the detail sheet for a slot (no-op when the slot is empty) or for the Provincial Stamp. */
  openStamp(slotId: string): void;
  closeStamp(): void;
  /** Stamp currently shown in the sheet. */
  selected: Stamp | null;
}

/**
 * buildPassportPages with the detail sheet wired up. Tapping a stamp opens the sheet; the sheet
 * always shows the stamp's current state, so a status change while it is open updates it.
 * Callbacks passed in `opts` are still called.
 */
export function usePassportContent(data: PassportData, opts: BuildPassportOptions = {}): UsePassportContentResult {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const latest = useRef(opts);
  latest.current = opts;

  const onStampSelect = useCallback((slot: StampSlot, stamp: Stamp) => {
    setSelectedId(slot.id);
    latest.current.onStampSelect?.(slot, stamp);
  }, []);
  const onProvincialSelect = useCallback((stamp: Stamp) => {
    setSelectedId(stamp.id);
    latest.current.onProvincialSelect?.(stamp);
  }, []);
  const onEmptySlotSelect = useCallback((slot: StampSlot) => {
    latest.current.onEmptySlotSelect?.(slot);
  }, []);
  const closeStamp = useCallback(() => setSelectedId(null), []);
  const openStamp = useCallback((slotId: string) => setSelectedId(slotId), []);

  const hasEmptyHandler = Boolean(opts.onEmptySlotSelect);
  const { slotOverrides, layout, pageWidth, coverInteractive, coverPageEdge } = opts;
  const content = useMemo(
    () =>
      buildPassportPages(data, {
        slotOverrides,
        layout,
        pageWidth,
        coverInteractive,
        coverPageEdge,
        onStampSelect,
        onProvincialSelect,
        onEmptySlotSelect: hasEmptyHandler ? onEmptySlotSelect : undefined,
      }),
    [
      data,
      slotOverrides,
      layout,
      pageWidth,
      coverInteractive,
      coverPageEdge,
      onStampSelect,
      onProvincialSelect,
      onEmptySlotSelect,
      hasEmptyHandler,
    ],
  );

  let selected: Stamp | null = null;
  if (selectedId !== null) {
    if (selectedId === data.provincial.id) selected = data.provincial.earned ? data.provincial.stamp : null;
    else selected = data.slots.find((s) => s.id === selectedId)?.stamp ?? null;
  }

  const sheet = <StampDetailSheet stamp={selected} onClose={closeStamp} province={data.province} />;

  return { ...content, sheet, openStamp, closeStamp, selected };
}
