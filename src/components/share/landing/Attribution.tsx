"use client";

/**
 * Affiliate attribution, shown quietly: "Visit credited to Alex".
 *
 * In the product the sharer's code is read from the link and recorded on the server at first page
 * load, tied to the sign-in request, so credit survives a switch of browser
 * (Technical_Questions.md, section 1). The demo has no server, so it keeps the same record in
 * localStorage and a first-party cookie and says so.
 */
import { useEffect, useState } from "react";
import { IconCheck } from "@/components/share/kit";
import { shareDisplayUrl } from "@/lib/share";
import { IconChevron, IconUserCheck } from "./icons";
import type { LandingModel } from "./model";
import { possessive } from "./text";

export const REF_STORE_KEY = "ip.share.ref.v1";
export const REF_COOKIE = "ip_ref";

interface RefRecord {
  code: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  visits: number;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Attribution({ model }: { model: LandingModel }) {
  const [record, setRecord] = useState<RefRecord | null>(null);
  const name = model.sharer?.name ?? "";

  useEffect(() => {
    if (!model.credited) return;
    const now = new Date().toISOString();
    let next: RefRecord = { code: model.code, name, firstSeen: now, lastSeen: now, visits: 1 };
    try {
      const all = JSON.parse(localStorage.getItem(REF_STORE_KEY) ?? "{}") as Record<string, RefRecord>;
      const before = all[model.code];
      if (before?.firstSeen) next = { ...next, firstSeen: before.firstSeen, visits: (before.visits ?? 1) + 1 };
      all[model.code] = next;
      localStorage.setItem(REF_STORE_KEY, JSON.stringify(all));
    } catch {
      /* storage may be blocked in an in-app browser: the code is still in the link */
    }
    try {
      document.cookie = `${REF_COOKIE}=${encodeURIComponent(model.code)}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax`;
    } catch {
      /* fine */
    }
    setRecord(next);
  }, [model.code, model.credited, name]);

  if (!model.credited || !model.sharer) {
    return (
      <details className="lp-credit" data-credited="false">
        <summary>
          <IconUserCheck size={17} />
          <span>Nobody is credited for this visit</span>
          <IconChevron size={16} className="lp-credit-chev" />
        </summary>
        <p>
          The code in this link (<b className="lp-mono">{model.code}</b>) is not one we recognise, so you landed on {model.islandName}&apos;s own page. Everything else works the same.
        </p>
      </details>
    );
  }

  return (
    <details className="lp-credit" data-credited="true" data-stored={Boolean(record)}>
      <summary>
        <span className="lp-credit-tick">
          <IconCheck size={13} strokeWidth={2.8} />
        </span>
        <span>
          Visit credited to <b>{model.sharer.name}</b>
        </span>
        <IconChevron size={16} className="lp-credit-chev" />
      </summary>
      <p>
        {possessive(model.sharer.shortName)} code is part of the link itself (<b className="lp-mono">{shareDisplayUrl(model.code)}</b>), so the credit follows you even if you switch browsers before signing up. Anything you
        give through this visit counts toward {possessive(model.sharer.shortName)} total for {model.islandName}.
      </p>
      <p className="lp-credit-store">
        <span className="lp-demo-tag">Demo</span>
        <span>
          Remembered on this device only (local storage and a cookie)
          {record ? `: first opened ${formatWhen(record.firstSeen)}, ${record.visits} ${record.visits === 1 ? "visit" : "visits"}` : ""}. The product records it on the server.
        </span>
      </p>
    </details>
  );
}
