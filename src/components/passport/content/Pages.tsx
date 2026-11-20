"use client";

/**
 * The pages that are not island pages:
 *   HolderPage      inside-cover identity page (sample traveler, passport no., playful MRZ)
 *   ProvincePage    province divider: chart, island index with a dot per stamp, stamp key
 *   ProvincialPage  the Provincial Stamp and its ornate slot (STM-4)
 */
import { memo, type ReactNode } from "react";
import { Stamp } from "@/components/stamp";
import { formatDate, formatStampDate, strings, statusLabel, t } from "@/lib/strings";
import {
  STAMP_STATUSES,
  type Island,
  type PassportHolder,
  type PassportProgress,
  type ProvincialStampDef,
  type Stamp as StampData,
  type StampSlot,
  type StampStatus,
} from "@/lib/types";
import { ProvinceChartArt, getChart, type ChartMarker } from "./chart";
import { sameChrome, u } from "./IslandPage";
import { Page, usePageMetrics, useStampPx, type PageChromeProps } from "./PageFrame";
import { contentStrings as cs } from "./strings";
import type { SlotOverride } from "./types";

/* ------------------------------------------------------------------ */
/* Holder                                                              */
/* ------------------------------------------------------------------ */

const MRZ_WIDTH = 44;

/** Machine-readable style: capitals and digits only, everything else becomes the "<" filler. */
function mrz(text: string): string {
  const clean = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9<]/g, "<");
  return clean.padEnd(MRZ_WIDTH, "<").slice(0, MRZ_WIDTH);
}

function splitName(name: string): { given: string; surname: string; initials: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const surname = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? "");
  const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const initials = parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  return { given, surname, initials };
}

export interface HolderPageProps {
  holder: PassportHolder;
  country: string;
  province: string;
  progress: PassportProgress;
  chrome: PageChromeProps;
}

function HolderPageImpl({ holder, country, province, progress, chrome }: HolderPageProps) {
  const { given, surname, initials } = splitName(holder.name);
  const line1 = mrz(t(strings.passport.mrzLine, { surname: mrz(surname).replace(/<+$/, ""), given: mrz(given).replace(/<+$/, "") }));
  const line2 = mrz(
    t(cs.holder.mrzLine2, {
      no: holder.passportNo.replace(/[^A-Za-z0-9]/g, ""),
      n: progress.collected,
      total: progress.total,
    }),
  );

  return (
    <Page
      {...chrome}
      kind="holder"
      title={cs.holder.aria}
      headLeft={strings.app.name}
      headRight={`${strings.country.code} · ${province}`}
    >
      <div className="ipp-holder">
        <div className="ipp-holder__id">
          <div className="ipp-portrait" role="img" aria-label={t(cs.holder.monogramAria, { name: holder.name })}>
            <span className="ipp-portrait__pattern" aria-hidden="true" />
            <span className="ipp-portrait__mono type-display" aria-hidden="true">
              {initials}
            </span>
            <span className="ipp-portrait__corner" aria-hidden="true" />
          </div>
          <dl className="ipp-fields">
            <div className="ipp-field ipp-field--name">
              <dt>{strings.passport.holder}</dt>
              <dd className="type-display">{holder.name}</dd>
            </div>
            <div className="ipp-field">
              <dt>{cs.holder.handle}</dt>
              <dd>{holder.handle}</dd>
            </div>
            <div className="ipp-field">
              <dt>{strings.passport.passportNo}</dt>
              <dd className="ipp-field__mono">{holder.passportNo}</dd>
            </div>
          </dl>
        </div>

        <dl className="ipp-fields ipp-fields--row">
          <div className="ipp-field">
            <dt>{cs.holder.issued}</dt>
            <dd className="ipp-field__mono">{formatStampDate(holder.memberSince)}</dd>
          </div>
          <div className="ipp-field">
            <dt>{cs.holder.province}</dt>
            <dd>
              {province}, {country}
            </dd>
          </div>
          <div className="ipp-field">
            <dt>{cs.holder.stamps}</dt>
            <dd className="ipp-field__mono">{t(cs.holder.stampsValue, { n: progress.collected, total: progress.total })}</dd>
          </div>
        </dl>

        <div className="ipp-pledge">
          <span className="ipp-pledge__label">{cs.holder.pledgeLabel}</span>
          <p className="ipp-pledge__text">{cs.holder.pledge}</p>
          <div className="ipp-sign">
            <svg viewBox="0 0 150 40" className="ipp-sign__ink" aria-hidden="true">
              <path d="M6 30C10 14 16 5 19 8C23 13 13 29 11 31C17 20 24 13 27 16C29 19 25 27 28 27C32 27 34 17 39 17C43 17 38 27 43 26C48 25 49 13 55 9C57 8 56 22 54 28C58 20 63 16 66 18C69 20 65 26 69 26C75 26 80 15 88 15C82 15 79 25 85 26C92 27 96 16 102 15C100 21 100 26 105 26C112 26 120 19 131 20" />
              <path d="M34 35C62 31 104 30 142 33" />
            </svg>
            <span className="ipp-sign__label">{cs.holder.signature}</span>
          </div>
        </div>

        <div className="ipp-specimen" aria-hidden="true">
          {cs.holder.specimen}
        </div>

        <div className="ipp-mrz" aria-hidden="true">
          <span>{line1}</span>
          <span>{line2}</span>
        </div>
      </div>
    </Page>
  );
}

export const HolderPage = memo(
  HolderPageImpl,
  (a, b) =>
    a.holder === b.holder &&
    a.country === b.country &&
    a.province === b.province &&
    a.progress.collected === b.progress.collected &&
    a.progress.total === b.progress.total &&
    sameChrome(a.chrome, b.chrome),
);

/* ------------------------------------------------------------------ */
/* Province                                                            */
/* ------------------------------------------------------------------ */

export interface ProvinceIndexRow {
  island: Island;
  slots: StampSlot[];
  /** One-based page number of the island's page. */
  page: number;
}

export interface ProvincePageProps {
  province: string;
  country: string;
  rows: ProvinceIndexRow[];
  markers: ChartMarker[];
  overrides?: Record<string, SlotOverride>;
  chrome: PageChromeProps;
}

/** A dot per slot: the status mark in miniature (STM-7: outline, dashed, solid). */
function StatusDot({ status }: { status: StampStatus | "empty" }) {
  return <i className="ipp-dot" data-status={status} aria-hidden="true" />;
}

function slotStatus(slot: StampSlot, overrides?: Record<string, SlotOverride>): StampStatus | "empty" {
  const o = overrides?.[slot.id];
  if (!slot.stamp || o?.hidden) return "empty";
  return o?.status ?? slot.stamp.status;
}

/** Chart width in units: as large as the page height allows once the title, index and key are in. */
function chartUnits(unitsHigh: number, rowCount: number): number {
  const room = unitsHigh - 222 - rowCount * 23;
  return Math.round(Math.min(256, Math.max(150, room / 0.75)));
}

function ProvinceFigure({ rows, children }: { rows: number; children: ReactNode }) {
  const { unitsHigh } = usePageMetrics();
  return (
    <figure className="ipp-province__chart" style={{ width: u(chartUnits(unitsHigh, rows)) }}>
      {children}
    </figure>
  );
}

function ProvincePageImpl({ province, country, rows, markers, overrides, chrome }: ProvincePageProps) {
  const chart = getChart(province);
  return (
    <Page
      {...chrome}
      kind="province"
      title={t(cs.province.aria, { province })}
      headLeft={country}
      headRight={t(cs.province.summary, {
        islands: rows.length,
        stamps: rows.reduce((sum, row) => sum + row.slots.length, 0),
      })}
    >
      <div className="ipp-province">
        <div className="ipp-province__title">
          <span className="ipp-province__label">{strings.country.regionLabel}</span>
          <h2 className="ipp-province__name type-display">{province}</h2>
        </div>

        {chart && (
          <ProvinceFigure rows={rows.length}>
            <ProvinceChartArt
              chart={chart}
              markers={markers}
              labels
              title={t(cs.province.mapAria, { province, n: markers.length })}
            />
            <figcaption>{cs.province.mapNote}</figcaption>
          </ProvinceFigure>
        )}

        <ol className="ipp-index" aria-label={cs.province.islandsLabel}>
          {rows.map((row, i) => {
            const statuses = row.slots.map((s) => slotStatus(s, overrides));
            const collected = statuses.filter((s) => s !== "empty").length;
            return (
              <li
                key={row.island.id}
                className="ipp-index__row"
                aria-label={t(cs.province.rowAria, {
                  island: row.island.name,
                  n: collected,
                  total: row.slots.length,
                  page: row.page,
                })}
              >
                <span className="ipp-index__num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="ipp-index__name" aria-hidden="true">
                  {row.island.name}
                </span>
                <span className="ipp-index__dots" aria-hidden="true">
                  {statuses.map((s, k) => (
                    <StatusDot key={row.slots[k].id} status={s} />
                  ))}
                </span>
                <span className="ipp-index__leader" aria-hidden="true" />
                <span className="ipp-index__page" aria-hidden="true">
                  {String(row.page).padStart(2, "0")}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="ipp-key">
          <span className="ipp-key__label">{cs.province.keyLabel}</span>
          <ul className="ipp-key__list">
            {STAMP_STATUSES.map((status) => (
              <li key={status} data-status={status}>
                <StatusDot status={status} />
                <span>{statusLabel(status)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Page>
  );
}

export const ProvincePage = memo(ProvincePageImpl, (a, b) => {
  if (
    a.province !== b.province ||
    a.country !== b.country ||
    a.rows.length !== b.rows.length ||
    !sameChrome(a.chrome, b.chrome)
  ) {
    return false;
  }
  for (let i = 0; i < a.rows.length; i++) {
    const x = a.rows[i];
    const y = b.rows[i];
    if (x.island !== y.island || x.page !== y.page || x.slots.length !== y.slots.length) return false;
    for (let k = 0; k < x.slots.length; k++) {
      if (slotStatus(x.slots[k], a.overrides) !== slotStatus(y.slots[k], b.overrides)) return false;
    }
  }
  return true;
});

/* ------------------------------------------------------------------ */
/* Provincial Stamp                                                    */
/* ------------------------------------------------------------------ */

export interface ProvincialPageProps {
  provincial: ProvincialStampDef;
  /** Verified Supporter stamps the traveler holds in the province. */
  verified: number;
  override?: SlotOverride;
  chrome: PageChromeProps;
  onSelect?(stamp: StampData): void;
}

/** The ornate slot is as large as the page height allows; the stamp sizes follow it. */
function ornateUnits(unitsHigh: number): number {
  return Math.round(Math.min(268, Math.max(190, unitsHigh - 290)));
}

function ProvincialPageImpl(props: ProvincialPageProps) {
  // The frame that measures the page is inside <Page>, so the body is a child component.
  const { provincial, chrome } = props;
  return (
    <Page
      {...chrome}
      kind="provincial"
      title={cs.provincial.aria}
      headLeft={t(strings.province.of, { province: provincial.province })}
      headRight={strings.country.regionalStampLabel}
    >
      <ProvincialBody {...props} />
    </Page>
  );
}

function ProvincialBody({ provincial, verified, override, onSelect }: ProvincialPageProps) {
  const { unitsHigh } = usePageMetrics();
  const ORNATE_UNITS = ornateUnits(unitsHigh);
  const EARNED_UNITS = Math.round(ORNATE_UNITS * 0.8);
  const EMPTY_UNITS = Math.round(ORNATE_UNITS * 0.59);
  const earned = provincial.earned && !override?.hidden;
  const required = provincial.requiredVerified;
  const have = Math.min(verified, required);
  const remaining = Math.max(0, required - verified);
  const earnedPx = useStampPx(EARNED_UNITS);
  const emptyPx = useStampPx(EMPTY_UNITS);
  const lockedLabel =
    remaining === 1 ? strings.stamp.provincialLockedOne : t(strings.stamp.provincialLocked, { n: remaining });

  const stamp = earned ? (
    <Stamp
      stamp={provincial.stamp}
      size={earnedPx}
      detail="large"
      inkProgress={override?.inkProgress}
      decorative={Boolean(onSelect)}
    />
  ) : (
    <Stamp
      stamp={provincial.stamp}
      variant="empty"
      size={emptyPx}
      emptyLabel={remaining > 0 ? lockedLabel : strings.stamp.provincial}
    />
  );

  return (
      <div className="ipp-provincial" data-earned={earned ? "" : undefined}>
        <div className="ipp-provincial__title">
          <span className="ipp-provincial__label">{t(strings.stamp.provincialOf, { province: provincial.province })}</span>
          <h2 className="ipp-provincial__name type-display">{strings.country.regionalStampLabel}</h2>
        </div>

        <div
          className="ipp-ornate"
          style={{ width: u(ORNATE_UNITS), height: u(ORNATE_UNITS) }}
          data-slot-id={provincial.id}
          data-provincial-slot=""
          data-slot-status={earned ? "provincial" : "empty"}
          data-highlight={override?.highlight ? "" : undefined}
        >
          <span className="ipp-ornate__ring" aria-hidden="true" />
          {earned && onSelect ? (
            <button
              type="button"
              className="ipp-ornate__stamp"
              aria-label={cs.provincial.open}
              aria-haspopup="dialog"
              onClick={() => onSelect(provincial.stamp)}
            >
              {stamp}
            </button>
          ) : (
            <span className="ipp-ornate__stamp">{stamp}</span>
          )}
        </div>

        <p className="ipp-provincial__caption">
          {earned
            ? t(cs.provincial.earnedCaption, { date: formatDate(provincial.stamp.date) })
            : t(cs.provincial.slotCaption, { province: provincial.province })}
        </p>

        <div className="ipp-pips" role="img" aria-label={t(cs.provincial.pipAria, { n: have, total: required })}>
          <span className="ipp-pips__row" aria-hidden="true">
            {Array.from({ length: required }, (_, i) => (
              <i key={i} className="ipp-pip" data-on={i < have ? "" : undefined} />
            ))}
          </span>
          <span className="ipp-pips__text" aria-hidden="true">
            {t(cs.provincial.progress, { n: have, total: required })}
          </span>
        </div>

        <p className="ipp-provincial__rule">{t(cs.provincial.rule, { n: required, province: provincial.province })}</p>
      </div>
  );
}

export const ProvincialPage = memo(
  ProvincialPageImpl,
  (a, b) =>
    a.provincial === b.provincial &&
    a.verified === b.verified &&
    a.onSelect === b.onSelect &&
    a.override?.hidden === b.override?.hidden &&
    a.override?.inkProgress === b.override?.inkProgress &&
    a.override?.highlight === b.override?.highlight &&
    sameChrome(a.chrome, b.chrome),
);
