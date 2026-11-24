"use client";

/**
 * Presenter controls at the foot of the recipient page. Not part of the product: they let the
 * demo jump between sample links, simulate each social app's browser, open the link preview and
 * start the collect flow again.
 */
import Link from "next/link";
import { useState } from "react";
import { IconArrow, IconReplay } from "@/components/share/kit";
import { sharePath } from "@/lib/share";
import { REF_COOKIE, REF_STORE_KEY } from "./Attribution";
import { useCollect } from "./CollectFlow";
import { IN_APP_PLATFORMS, PLATFORM_NAME, type InAppPlatform } from "./inapp";
import { SAMPLE_LANDING_CODES } from "./text";

export function DemoControls({ code, platform }: { code: string; platform: InAppPlatform | null }) {
  const { reset } = useCollect();
  const [cleared, setCleared] = useState(false);
  const here = sharePath(code);

  const clear = () => {
    reset();
    try {
      localStorage.removeItem(REF_STORE_KEY);
      sessionStorage.removeItem("ip.share.inapp.dismissed");
      document.cookie = `${REF_COOKIE}=; Max-Age=0; Path=/`;
    } catch {
      /* fine */
    }
    setCleared(true);
    setTimeout(() => setCleared(false), 1800);
  };

  return (
    <section className="lp-demo" aria-labelledby="lp-demo-title">
      <div className="lp-demo-head">
        <span className="lp-demo-tag">Demo controls</span>
        <h2 id="lp-demo-title">For the presenter, not part of the product</h2>
      </div>

      <div className="lp-demo-group">
        <p>Open another sample link</p>
        <div className="lp-demo-chips">
          {SAMPLE_LANDING_CODES.map((item) => (
            <Link key={item.code} className="sk-chip" data-on={item.code === code} href={sharePath(item.code)} aria-current={item.code === code ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="lp-demo-group">
        <p>View it as if opened inside</p>
        <div className="lp-demo-chips">
          <Link className="sk-chip" data-on={!platform} href={here}>
            A normal browser
          </Link>
          {IN_APP_PLATFORMS.map((p) => (
            <Link key={p} className="sk-chip" data-on={platform === p} href={`${here}?inapp=${p}`}>
              {PLATFORM_NAME[p]}
            </Link>
          ))}
        </div>
      </div>

      <div className="lp-demo-links">
        <Link className="lp-demo-link" href={`${here}?preview=1`}>
          <span>
            <b>How this link looks when shared</b>
            <small>The preview card in chat and social apps</small>
          </span>
          <IconArrow size={18} />
        </Link>
        <Link className="lp-demo-link" href="/share">
          <span>
            <b>All share flows</b>
            <small>Partner flow, traveler flow and this page</small>
          </span>
          <IconArrow size={18} />
        </Link>
        <button type="button" className="lp-demo-link" onClick={clear}>
          <span>
            <b>{cleared ? "Cleared" : "Start this demo again"}</b>
            <small>Forgets the sign-in step, the stamp and the stored credit</small>
          </span>
          <IconReplay size={18} />
        </button>
      </div>
    </section>
  );
}
