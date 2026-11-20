/**
 * The small chart that appears on the province page and as the locator on each island page.
 *
 * It is a stylised drawing, not survey data: an original, simplified outline of the province with
 * a marker per island. Chart art is keyed by province and island id, the way stamp templates are
 * keyed by name, so another province supplies its own entry (TEC-11). An island without an entry
 * still renders: it gets a compass mark instead of a locator.
 *
 * Positions and the approximate coordinates are sample content and have not been checked against
 * a survey chart.
 */
import type { CSSProperties } from "react";

export interface ChartPlace {
  /** Position in the 200 x 150 chart box. */
  x: number;
  y: number;
  /** Where the label sits relative to the marker on the province page. */
  label: "n" | "s" | "e" | "w";
  /** Rounded position, printed as a field note. */
  coords?: string;
}

export interface ProvinceChart {
  viewBox: string;
  /** Closed land outlines. */
  land: string[];
  /** Offshore features drawn as dotted lines (reefs, banks). */
  reefs: string[];
  places: Record<string, ChartPlace>;
}

const BOHOL: ProvinceChart = {
  viewBox: "0 0 200 150",
  land: [
    // Main island
    "M49 66C49 46 68 31 94 27C116 23 139 27 153 38C165 47 171 60 168 73C166 82 174 89 171 97C167 106 153 104 142 110C126 119 106 123 90 119C75 115 62 107 56 96C51 86 49 76 49 66Z",
    // The small island off the south-west corner
    "M38 111C42 105 56 104 61 110C59 117 44 118 38 111Z",
  ],
  reefs: [
    "M58 26C82 10 126 6 160 20",
    "M70 17C92 6 124 3 150 10",
  ],
  places: {
    bohol: { x: 112, y: 72, label: "e", coords: "9.8°N 124.2°E" },
    balicasag: { x: 31, y: 128, label: "s", coords: "9.5°N 123.7°E" },
    pamilacan: { x: 80, y: 136, label: "e", coords: "9.5°N 123.9°E" },
    banacon: { x: 96, y: 15, label: "w", coords: "10.2°N 124.2°E" },
    danajon: { x: 136, y: 8, label: "e", coords: "10.2°N 124.4°E" },
  },
};

const CHARTS: Record<string, ProvinceChart> = {
  bohol: BOHOL,
};

export function getChart(province: string): ProvinceChart | null {
  return CHARTS[province.trim().toLowerCase()] ?? null;
}

export function getPlace(province: string, islandId: string): ChartPlace | null {
  return getChart(province)?.places[islandId] ?? null;
}

export interface ChartMarker {
  id: string;
  /** Printed inside or beside the marker (the island's number in the passport). */
  index: number;
  name: string;
}

export interface ProvinceChartArtProps {
  chart: ProvinceChart;
  markers: ChartMarker[];
  /** Island to highlight. When set, the chart is a locator: other markers shrink to dots. */
  activeId?: string;
  /** Print island names beside the markers. */
  labels?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const LABEL_OFFSET: Record<ChartPlace["label"], { dx: number; dy: number; anchor: "start" | "middle" | "end" }> = {
  n: { dx: 0, dy: -9, anchor: "middle" },
  s: { dx: 0, dy: 15, anchor: "middle" },
  e: { dx: 9.5, dy: 3.2, anchor: "start" },
  w: { dx: -9.5, dy: 3.2, anchor: "end" },
};

/** Inline SVG. Colours come from CSS (see .ipp-chart in content.css). */
export function ProvinceChartArt({ chart, markers, activeId, labels = false, title, className, style }: ProvinceChartArtProps) {
  const locator = activeId !== undefined;
  return (
    <svg
      viewBox={chart.viewBox}
      className={["ipp-chart", className].filter(Boolean).join(" ")}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-locator={locator ? "" : undefined}
    >
      {chart.reefs.map((d) => (
        <path key={d} d={d} className="ipp-chart__reef" />
      ))}
      {chart.land.map((d) => (
        <path key={d} d={d} className="ipp-chart__land" />
      ))}
      {markers.map((m) => {
        const place = chart.places[m.id];
        if (!place) return null;
        const active = m.id === activeId;
        if (locator && !active) {
          return <circle key={m.id} cx={place.x} cy={place.y} r={3.4} className="ipp-chart__dot" />;
        }
        const off = LABEL_OFFSET[place.label];
        return (
          <g key={m.id} className="ipp-chart__marker" data-active={active ? "" : undefined}>
            {locator && <circle cx={place.x} cy={place.y} r={19} className="ipp-chart__halo" />}
            <circle cx={place.x} cy={place.y} r={locator ? 8.5 : 6.2} className="ipp-chart__pin" />
            {!locator && (
              <text x={place.x} y={place.y + 2.6} textAnchor="middle" className="ipp-chart__num">
                {m.index}
              </text>
            )}
            {labels && (
              <text x={place.x + off.dx} y={place.y + off.dy} textAnchor={off.anchor} className="ipp-chart__label">
                {m.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Fallback mark for an island with no chart entry: a plain compass star. */
export function CompassMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={["ipp-chart", className].filter(Boolean).join(" ")} aria-hidden="true">
      <circle cx="20" cy="20" r="15" className="ipp-chart__land" />
      <path d="M20 3L23 20L20 37L17 20Z" className="ipp-chart__pin" />
      <path d="M3 20L20 17L37 20L20 23Z" className="ipp-chart__reef" />
    </svg>
  );
}
