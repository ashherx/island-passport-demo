import type { ReactNode } from "react";
import { IconArrow, ShareShell, SkButton } from "@/components/share/kit";
import "./hub.css";

/** Placeholder used until the flow pages are built. The next agents replace the pages that use it. */
export function ComingSoon({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <ShareShell back={{ href: "/share", label: "All share flows" }}>
      <div className="skh-soon">
        <p className="sk-eyebrow">{eyebrow}</p>
        <h1 className="sk-title">{title}</h1>
        <p className="sk-lead">Coming soon. This screen is being built.</p>
        {children}
        <SkButton variant="secondary" href="/share">
          Back to the share flows <IconArrow size={18} />
        </SkButton>
      </div>
    </ShareShell>
  );
}
