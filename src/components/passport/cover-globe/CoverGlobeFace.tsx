"use client";

/**
 * Everything the globe adds to the passport's front cover: the window with the live globe in its
 * frame, the lettering under it (the island the camera is visiting and its stamp status), the
 * row of dots for the traveler's islands, and the discreet partner strip along the foot.
 *
 * It is one node, handed to <FrontCover globe={...}>, and it sits at the same place in the tree
 * for every art direction, so switching direction restyles the map instead of rebuilding it.
 * There is only ever this one WebGL globe on the page.
 *
 * The window is part of the object: the map is clipped to a circle, sunk below the cover's
 * surface by an inner shadow, tinted by the direction's map colours, crossed by the cover's own
 * sheen, and framed by foil (classic), a brass porthole (reef) or an inked compass rose (journal).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Globe, forgetView, type GlobeHandle, type GlobeStatus } from "@/components/globe";
import { useDirectionId } from "@/components/theme";
import { getIsland, type GlobeIsland } from "@/lib/islands";
import { strings, t } from "@/lib/strings";
import type { DirectionId, StampStatus } from "@/lib/types";
import type { CoverGlobeController } from "./controller";
import { frameMasks, partnerMarkUrl } from "./frames";
import { COVER_MAP_LOOKS, coverMapStyle } from "./map-style";
import type { CoverGlobeState, CoverStop } from "./types";
import "./cover-globe.css";

const S = strings.coverGlobe;

export function useCoverGlobeState(controller: CoverGlobeController): CoverGlobeState {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

const statusText = (status: StampStatus) => strings.status[status].label;

/* ------------------------------------------------------------------ */
/* Lettering that changes: the old line leaves as the new one arrives  */
/* ------------------------------------------------------------------ */

function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const [shown, setShown] = useState<{ id: string; node: ReactNode }>({ id, node: children });
  const [leaving, setLeaving] = useState<{ id: string; node: ReactNode } | null>(null);
  if (shown.id !== id) {
    setLeaving(shown);
    setShown({ id, node: children });
  }
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), 420);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  return (
    <span className={className ? `ipcg-swap ${className}` : "ipcg-swap"}>
      {leaving && (
        <span key={`out-${leaving.id}`} className="ipcg-swap__item" data-leaving="" aria-hidden="true">
          {leaving.node}
        </span>
      )}
      <span key={shown.id} className="ipcg-swap__item">
        {id === shown.id ? children : shown.node}
      </span>
    </span>
  );
}

/** Foil-stamped (or printed) lettering, built like the cover's own: impression, lit edge, foil. */
function Letter({ children, foil }: { children: string; foil: boolean }) {
  return (
    <span className="ipp-foil ipcg-letter" data-text={children}>
      <span className={foil ? "ipp-foil__ink foil-text" : "ipp-foil__ink"}>{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The frame                                                           */
/* ------------------------------------------------------------------ */

/** Reef: a brass porthole. Drawn with real gradients, so it is inline SVG, not a mask. */
function Porthole() {
  const bolts = [];
  for (let i = 0; i < 8; i++) {
    const a = ((i * 45 + 22.5) * Math.PI) / 180;
    bolts.push(<circle key={i} cx={100 + Math.sin(a) * 85.2} cy={100 - Math.cos(a) * 85.2} r={2.5} fill="url(#ipcg-bolt)" stroke="rgba(60,40,10,.5)" strokeWidth={0.5} />);
  }
  return (
    <svg className="ipcg__porthole" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ipcg-brass" x1="0.12" y1="0.06" x2="0.88" y2="0.94">
          <stop offset="0" stopColor="var(--foil-hi)" />
          <stop offset="0.34" stopColor="var(--foil)" />
          <stop offset="0.62" stopColor="var(--foil-lo)" />
          <stop offset="0.82" stopColor="var(--foil)" />
          <stop offset="1" stopColor="var(--foil-hi)" />
        </linearGradient>
        <linearGradient id="ipcg-lip" x1="0.12" y1="0.06" x2="0.88" y2="0.94">
          <stop offset="0" stopColor="var(--foil-shadow)" />
          <stop offset="0.55" stopColor="var(--foil-lo)" />
          <stop offset="1" stopColor="var(--foil-hi)" />
        </linearGradient>
        <radialGradient id="ipcg-bolt" cx="0.36" cy="0.32" r="0.8">
          <stop offset="0" stopColor="var(--foil-hi)" />
          <stop offset="0.6" stopColor="var(--foil)" />
          <stop offset="1" stopColor="var(--foil-shadow)" />
        </radialGradient>
      </defs>
      {/* Stitching round the porthole, the same thread as the cover's edge. */}
      <circle cx="100" cy="100" r="97.4" fill="none" stroke="var(--cover-ink)" strokeWidth="1.1" strokeDasharray="3.4 3" opacity="0.5" />
      <circle cx="100" cy="100" r="85.2" fill="none" stroke="url(#ipcg-brass)" strokeWidth="13.6" />
      <circle cx="100" cy="100" r="91.4" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="0.7" />
      <circle cx="100" cy="100" r="78.2" fill="none" stroke="url(#ipcg-lip)" strokeWidth="2.6" />
      {bolts}
    </svg>
  );
}

function Ring({ direction }: { direction: DirectionId }) {
  if (direction === "reef") return <Porthole />;
  const ink = direction === "journal";
  return (
    <span className="ipcg__ring" data-variant={ink ? "ink" : "foil"} aria-hidden="true">
      <i className="ipcg__ring-lo" />
      <i className="ipcg__ring-hi" />
      <i className={ink ? "ipcg__ring-face" : "ipcg__ring-face foil-fill"} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Partner strip                                                       */
/* ------------------------------------------------------------------ */

const PartnerStrip = memo(function PartnerStrip() {
  const [shown, setShown] = useState<string | null>(null);
  const timer = useRef(0);
  const reveal = useCallback((id: string | null, hold = 0) => {
    window.clearTimeout(timer.current);
    setShown(id);
    if (id && hold) timer.current = window.setTimeout(() => setShown(null), hold);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const partner = S.partners.find((p) => p.id === shown);
  return (
    <div
      className="ipcg__partners"
      role="group"
      aria-label={t(S.partnersAria, { names: S.partners.map((p) => p.name).join(", ") })}
      data-revealed={partner ? "" : undefined}
      onPointerLeave={(e) => e.pointerType === "mouse" && reveal(null)}
    >
      <span className="ipcg__partners-label">
        <Swap id={partner?.id ?? "label"}>{partner ? partner.short : S.partnersLabel}</Swap>
      </span>
      <span className="ipcg__partners-marks">
        {S.partners.map((p) => (
          <button
            key={p.id}
            type="button"
            className="ipcg__partner"
            data-on={shown === p.id ? "" : undefined}
            aria-label={p.name}
            title={p.name}
            style={{ "--ipcg-mark": partnerMarkUrl(p.id) } as CSSProperties}
            onPointerEnter={(e) => e.pointerType === "mouse" && reveal(p.id)}
            onFocus={() => reveal(p.id)}
            onBlur={() => reveal(null)}
            onClick={() => reveal(p.id, 2600)}
          >
            <i className="ipcg__partner-lo" />
            <i className="ipcg__partner-hi" />
            <i className="ipcg__partner-face" />
          </button>
        ))}
      </span>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* The face                                                            */
/* ------------------------------------------------------------------ */

export interface CoverGlobeFaceProps {
  controller: CoverGlobeController;
  province: string;
}

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

function CoverGlobeFaceImpl({ controller, province }: CoverGlobeFaceProps) {
  const direction = useDirectionId();
  const state = useCoverGlobeState(controller);
  const look = COVER_MAP_LOOKS[direction];
  const foil = direction !== "journal";
  const medalRef = useRef<HTMLDivElement>(null);
  /** The still image has loaded: the live canvas can be hidden behind it. */
  const [stillShown, setStillShown] = useState(false);

  const ids = state.stops.map((s) => s.id).join(",");
  // Every stop is marked from the planet view on (rank 1). The engine only marks and lets the
  // visitor tap a rank 2 island from zoom 6.8, and in a window this small Bohol's own view is
  // below that: its neighbours were unmarked specks that could not be picked.
  const islands = useMemo(
    () => ids.split(",").flatMap((id): GlobeIsland[] => {
      const island = getIsland(id);
      return island ? [{ ...island, rank: 1 }] : [];
    }),
    [ids],
  );

  const attach = useCallback((handle: GlobeHandle | null) => controller.attach(handle), [controller]);
  const onReady = useCallback((map: MapLibreMap) => controller.mapReady(map), [controller]);
  const onStatus = useCallback((status: GlobeStatus) => controller.setStatus(status), [controller]);
  const onSelect = useCallback((id: string) => controller.selectOnMap(id), [controller]);
  const onUser = useCallback(() => controller.userInteracted(), [controller]);

  // The tour only runs while the cover can be seen.
  useEffect(() => {
    const el = medalRef.current;
    if (!el) return;
    let onScreen = true;
    const update = () => controller.setVisible(onScreen && document.visibilityState === "visible");
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
        update();
      });
      observer.observe(el);
    }
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [controller]);

  // A still image of the map in the previous direction's colours would come back with the cover.
  const styled = useRef(direction);
  useEffect(() => {
    if (styled.current === direction) return;
    styled.current = direction;
    controller.restyled();
  }, [controller, direction]);

  // After the engine has (re-)enabled the map's gestures: see tuneGestures().
  const live = state.status === "ready" && !state.frozen;
  useEffect(() => {
    if (live) controller.tuneGestures();
  }, [controller, live]);

  // The cover's camera is its own: it must not become the landing page's remembered view.
  useEffect(
    () => () => {
      window.setTimeout(forgetView, 0);
    },
    [],
  );

  if (!state.still && stillShown) setStillShown(false);

  const focus: CoverStop | null = state.stops.find((s) => s.id === state.focusId) ?? null;
  const onIsland = state.view === "island" && focus !== null;
  const small = onIsland ? t(S.stampLine, { status: statusText(focus.status), n: focus.count, total: focus.total }) : S.restLine;
  const name = onIsland ? focus.name : province;
  const masks = frameMasks();

  const vars = {
    "--ipcg-ring-mask": direction === "journal" ? masks.journal : masks.classic,
    "--ipcg-space": look.css.space,
    "--globe-ocean": look.css.ocean,
    "--globe-land": look.css.land,
    "--globe-shore": look.css.shore,
    "--globe-dot": look.css.dot,
    "--globe-dot-soon": look.css.dot,
    "--globe-shade": look.css.shade,
    "--globe-shine": look.css.shine,
    "--globe-halo": look.css.halo,
    "--o-bg": "transparent",
  } as CSSProperties;

  return (
    <div
      className="ipcg"
      data-dir={direction}
      data-view={state.view}
      data-phase={state.phase}
      data-status={state.status}
      data-frozen={state.frozen ? "" : undefined}
      data-held={state.frozen && stillShown ? "" : undefined}
      data-veil={state.veil ? "" : undefined}
      data-pinned={state.pinned ? "" : undefined}
      style={vars}
    >
      <div
        ref={medalRef}
        className="ipcg__medal"
        data-no-open=""
        // The globe has its own gestures: a drag on it must not take the cover by its edge.
        onPointerDown={stop}
        onPointerMove={stop}
        onPointerUp={stop}
        onKeyDown={stop}
      >
        <div className="ipcg__window">
          <Globe
            ref={attach}
            className="ipcg__globe"
            style={coverMapStyle(direction)}
            islands={islands}
            selectedId={onIsland ? focus.id : null}
            flyOnSelect={false}
            selectable="live"
            interactive={!state.frozen}
            globeSize={0.955}
            restoreView={false}
            label={S.globeLabel}
            onReady={onReady}
            onStatusChange={onStatus}
            onSelect={onSelect}
            onUserInteraction={onUser}
          >
            {state.still && (
              // eslint-disable-next-line @next/next/no-img-element -- a data URL of the canvas, shown for a moment
              <img className="ipcg__still" src={state.still} alt="" draggable={false} onLoad={() => setStillShown(true)} />
            )}
          </Globe>
          <i className="ipcg__veil" aria-hidden="true" />
        </div>
        <i className="ipcg__glass" aria-hidden="true" />
        <Ring direction={direction} />
      </div>

      <div className="ipcg__caption" aria-hidden="true">
        <div className="ipcg__small">
          <Swap id={small}>
            <span className="ipcg__small-row">
              {foil && <i className="ipcg__orn foil-fill" />}
              <Letter foil={direction === "classic"}>{small}</Letter>
              {foil && <i className="ipcg__orn foil-fill" />}
            </span>
          </Swap>
        </div>
        <div className="ipcg__name type-display">
          <Swap id={name}>
            <Letter foil={foil}>{name}</Letter>
          </Swap>
        </div>
      </div>

      {state.stops.length > 1 && (
        <div className="ipcg__dots" role="group" aria-label={S.stopsLabel} data-no-open="">
          {state.stops.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ipcg__dot"
              data-on={onIsland && s.id === focus.id ? "" : undefined}
              data-status={s.status}
              aria-label={t(S.stopLabel, { island: s.name, status: statusText(s.status), n: s.count, total: s.total })}
              aria-pressed={onIsland && s.id === focus.id}
              disabled={state.frozen}
              onClick={() => controller.select(s.id)}
            >
              <i />
            </button>
          ))}
        </div>
      )}

      <PartnerStrip />

    </div>
  );
}

export const CoverGlobeFace = memo(CoverGlobeFaceImpl);
