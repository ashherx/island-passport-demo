/**
 * Layout primitives for the share flows: the page shell with the brand bar, the step header for
 * multi-step flows, and the button, avatar and SAMPLE tag everything else is built from.
 * No hooks here, so all of these also render in server components.
 */
import Link from "next/link";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { fontClass } from "@/options/a/fonts";
import { shareCopy } from "@/lib/share/sample";
import type { ShareAvatar } from "@/lib/share/types";
import { strings } from "@/lib/strings";
import { BrandMark, IconBack } from "./icons";
import "./share-kit.css";

/**
 * Class for a root that is not a <ShareShell> (a full-bleed recipient page, a portal): it turns
 * on the --sk-* tokens and loads the Daylight Atlas typefaces.
 */
export const skRootClass = `sk ${fontClass}`;

/** The SAMPLE pill. Put one next to every fictional partner, handle, charity or figure. */
export function SampleTag({ children = shareCopy.sampleTag, className = "" }: { children?: ReactNode; className?: string }) {
  return <span className={`sk-sample ${className}`}>{children}</span>;
}

export interface ShareShellProps {
  children: ReactNode;
  /** A back arrow before the wordmark, e.g. `{ href: "/share", label: "All share flows" }`. */
  back?: { href: string; label: string };
  /** Right side of the brand bar: a step count, a "Preview" button. */
  end?: ReactNode;
  /** "narrow" (560px column, the default: forms and steps) or "wide" (1120px: hubs and side-by-side). */
  width?: "narrow" | "wide";
  /** The fictional-content line at the foot of the page. Pass false to leave it out. */
  footer?: ReactNode | false;
  className?: string;
}

/**
 * Page shell: soft sky background, sticky brand bar (wordmark links to /share, SAMPLE tag), a
 * centred column and the sample notice at the foot. Always light, whatever theme the passport
 * demo has saved.
 */
export function ShareShell({ children, back, end, width = "narrow", footer, className = "" }: ShareShellProps) {
  return (
    <div className={`${skRootClass} sk-shell ${className}`} data-width={width}>
      <header className="sk-bar">
        {back ? (
          <Link className="sk-bar-back" href={back.href} aria-label={back.label}>
            <IconBack size={22} />
          </Link>
        ) : null}
        <Link className="sk-brand" href="/share" aria-label={`${strings.app.name}: share flows`}>
          <BrandMark size={24} />
          <span className="sk-brand-name">{strings.app.name}</span>
        </Link>
        <SampleTag />
        {end ? <div className="sk-bar-end">{end}</div> : null}
      </header>
      <main className="sk-main">{children}</main>
      {footer === false ? null : <footer className="sk-foot">{footer ?? shareCopy.sampleNotice}</footer>}
    </div>
  );
}

export interface StepDef {
  id: string;
  /** Two words at most: "Choose", "Personalise", "Preview", "Share". */
  label: string;
}

export interface StepHeaderProps {
  steps: StepDef[];
  /** Id of the step being shown. */
  current: string;
  /** Makes finished steps tappable. Called with the step id. */
  onSelect?: (id: string) => void;
  /** Small line above the title, e.g. the partner's name. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  className?: string;
}

/**
 * Progress for a multi-step flow: one bar per step that fills as the flow advances, labels from
 * 600px up, "Step 2 of 4" on phones, then the step's eyebrow, title and lead.
 * The title is an <h1>: use one StepHeader per screen.
 */
export function StepHeader({ steps, current, onSelect, eyebrow, title, lead, className = "" }: StepHeaderProps) {
  const index = Math.max(0, steps.findIndex((s) => s.id === current));
  return (
    <div className={`sk-steps ${className}`}>
      <nav aria-label="Progress">
        <ol className="sk-steps-track">
          {steps.map((step, i) => {
            const state = i < index ? "done" : i === index ? "current" : "todo";
            const clickable = Boolean(onSelect) && i < index;
            return (
              <li className="sk-step" key={step.id} data-state={state}>
                <button
                  type="button"
                  className="sk-step-btn"
                  data-clickable={clickable}
                  tabIndex={clickable ? 0 : -1}
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={`Step ${i + 1} of ${steps.length}: ${step.label}${state === "done" ? " (done)" : ""}`}
                  onClick={clickable ? () => onSelect?.(step.id) : undefined}
                >
                  <span className="sk-step-bar">
                    <span className="sk-step-fill" />
                  </span>
                  <span className="sk-step-label" aria-hidden="true">
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <p className="sk-steps-now" aria-hidden="true">
        <b>
          {index + 1} / {steps.length}
        </b>
        {steps[index]?.label}
      </p>
      {eyebrow || title || lead ? (
        <div className="sk-steps-head">
          {eyebrow ? <p className="sk-eyebrow">{eyebrow}</p> : null}
          {title ? <h1 className="sk-h2">{title}</h1> : null}
          {lead ? <p className="sk-lead">{lead}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

type ButtonCommon = {
  variant?: "primary" | "secondary" | "ghost" | "ink";
  size?: "m" | "s";
  /** Full width. */
  block?: boolean;
  children: ReactNode;
  className?: string;
};

export type SkButtonProps = ButtonCommon &
  (({ href: string } & { onClick?: undefined; type?: undefined; disabled?: undefined }) | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>));

/** Pill button. With `href` it renders a Next <Link>; otherwise a <button type="button">. */
export function SkButton({ variant = "primary", size = "m", block, children, className = "", ...rest }: SkButtonProps) {
  const shared = { className: `sk-btn ${className}`, "data-variant": variant, "data-size": size, "data-block": block ? "true" : undefined };
  if (typeof rest.href === "string") {
    return (
      <Link href={rest.href} {...shared}>
        {children}
      </Link>
    );
  }
  const { href: _href, ...button } = rest as { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>;
  void _href;
  return (
    <button type="button" {...button} {...shared}>
      {children}
    </button>
  );
}

/** Initials on a tinted disc. `size` in px, or leave it out and set `--size` in CSS. */
export function Avatar({ avatar, size, className = "" }: { avatar: ShareAvatar; size?: number; className?: string }) {
  const style = { "--a": avatar.tint[0], "--b": avatar.tint[1], ...(size ? { "--size": `${size}px` } : null) } as CSSProperties;
  return (
    <span className={`sk-avatar ${className}`} style={style} aria-hidden="true">
      {avatar.initials}
    </span>
  );
}
