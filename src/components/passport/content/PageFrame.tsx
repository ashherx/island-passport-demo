"use client";

/**
 * Frame and furniture shared by every passport surface.
 *
 * <Frame>  fills its parent and sets up the design-unit system: the surface is 360 units wide,
 *          and `--u` is one unit. Everything inside is sized with `calc(var(--u) * n)`, so a page
 *          looks the same at 300px or 420px wide. `--u` comes from container-query units in CSS
 *          (no JavaScript, correct on first paint); browsers without them get it from the
 *          ResizeObserver below. The same observer gives stamps their pixel size, because
 *          <Stamp size> must be a number.
 *
 * <Page>   a paper page: security pattern, running head, body, footer with the page number.
 */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useDirectionId } from "@/components/theme";
import { strings, t } from "@/lib/strings";
import { contentPatternCss } from "./patterns";
import { contentStrings as cs } from "./strings";
import "./content.css";

/** Width of the design canvas, in units. */
export const PAGE_UNITS = 360;
/** Height the layouts are tuned for. Pages stay well composed from about 500 to 600. */
export const PAGE_UNITS_HIGH = 560;

export interface PageMetrics {
  /** Pixels per design unit. */
  scale: number;
  /** Height of the surface in design units (width is always 360). Books differ: 0.64 to 0.7 wide. */
  unitsHigh: number;
}

const DEFAULT_METRICS: PageMetrics = { scale: 1, unitsHigh: PAGE_UNITS_HIGH };
const PageMetricsContext = createContext<PageMetrics>(DEFAULT_METRICS);

/** Size of the surrounding passport surface. Layouts use `unitsHigh` to fit shorter books. */
export function usePageMetrics(): PageMetrics {
  return useContext(PageMetricsContext);
}

/** Pixels per design unit of the surrounding passport surface. */
export function usePageScale(): number {
  return useContext(PageMetricsContext).scale;
}

/** Round a size in design units to whole pixels for <Stamp size>. */
export function useStampPx(units: number): number {
  return Math.max(24, Math.round(units * usePageScale()));
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Last measurement. Lets a surface that mounts hidden (width 0) start at the right size. */
let lastKnown: PageMetrics | null = null;

/**
 * Pattern variables for every direction. React hoists this into <head> and de-duplicates it by
 * `href`, so rendering it from every surface costs one <style> element.
 */
function ContentStyles() {
  return (
    <style href="ipp-content-patterns" precedence="default">
      {contentPatternCss()}
    </style>
  );
}

export interface FrameProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  /** Expected width in px, used before the first measurement. */
  initialWidth?: number;
}

export function Frame({ children, className, initialWidth, ...rest }: FrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const direction = useDirectionId();
  const [metrics, setMetrics] = useState<PageMetrics>(() =>
    initialWidth && initialWidth > 0 ? { scale: initialWidth / PAGE_UNITS, unitsHigh: PAGE_UNITS_HIGH } : DEFAULT_METRICS,
  );

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hasContainerUnits = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("width", "1cqw");

    const adopt = (next: PageMetrics) => {
      lastKnown = next;
      setMetrics((prev) =>
        Math.abs(prev.scale - next.scale) < 0.004 && Math.abs(prev.unitsHigh - next.unitsHigh) < 2 ? prev : next,
      );
      if (!hasContainerUnits) el.style.setProperty("--u-fallback", `${next.scale}px`);
    };
    const apply = (width: number, height: number) => {
      if (!(width > 0) || !(height > 0)) return; // hidden (display: none): keep the last good size
      const scale = width / PAGE_UNITS;
      adopt({ scale, unitsHigh: height / scale });
    };

    if (el.clientWidth > 0) apply(el.clientWidth, el.clientHeight);
    else if (lastKnown !== null) adopt(lastKnown);

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) apply(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={["ipp-frame", className].filter(Boolean).join(" ")} data-dir={direction} {...rest}>
      <ContentStyles />
      <PageMetricsContext.Provider value={metrics}>
        <div className="ipp-canvas">{children}</div>
      </PageMetricsContext.Provider>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paper page                                                          */
/* ------------------------------------------------------------------ */

export type PageSide = "left" | "right";

export interface PageChromeProps {
  /** One-based page number printed in the footer. */
  number: number;
  total: number;
  side: PageSide;
  province: string;
  passportNo: string;
  initialWidth?: number;
}

export interface PageProps extends PageChromeProps {
  /** "holder" | "province" | "island" | "provincial": exposed as data-page-kind. */
  kind: string;
  /** Used in the page's accessible name. */
  title: string;
  headLeft: ReactNode;
  headRight?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Extra data attributes for the motion layer to find things. */
  data?: Record<string, string | undefined>;
}

const MICRO_REPEAT = 6;

export function Page({
  kind,
  title,
  number,
  total,
  side,
  province,
  passportNo,
  initialWidth,
  headLeft,
  headRight,
  children,
  className,
  style,
  data,
}: PageProps) {
  const micro = t(cs.page.microtext, { province: province.toUpperCase() }).repeat(MICRO_REPEAT);
  return (
    <Frame
      className={["ipp-page mat-paper", className].filter(Boolean).join(" ")}
      style={style}
      initialWidth={initialWidth}
      role="group"
      aria-label={t(cs.page.aria, { page: number, total, title })}
      data-page-kind={kind}
      data-page-number={number}
      data-side={side}
      {...data}
    >
      <div className="ipp-page__deco" aria-hidden="true" />
      <div className="ipp-page__head">
        <span className="ipp-page__head-left">{headLeft}</span>
        <span className="ipp-page__head-right">{headRight}</span>
      </div>
      <div className="ipp-page__rule" aria-hidden="true">
        <span className="ipp-page__micro">{micro}</span>
      </div>
      <div className="ipp-page__body">{children}</div>
      <div className="ipp-page__foot">
        <span className="ipp-page__serial" aria-hidden="true">
          {passportNo}
        </span>
        <span className="ipp-page__sample">{strings.sample.tag}</span>
        <span className="ipp-page__number" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </span>
      </div>
      <div className="ipp-page__gutter" aria-hidden="true" />
      <div className="mat-page-dim ipp-page__dim" aria-hidden="true" />
    </Frame>
  );
}
