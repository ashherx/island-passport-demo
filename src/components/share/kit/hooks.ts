"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { liveShareUrl, shareUrl } from "@/lib/share/urls";

/** Write text to the clipboard, with the old textarea route for in-app browsers that lack the API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea route */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export interface CopyState {
  /** True for `resetMs` after a successful copy. */
  copied: boolean;
  /** True for `resetMs` after a copy that the browser refused. */
  failed: boolean;
  copy: (text: string) => Promise<boolean>;
}

/** Copy-to-clipboard with a "Copied" state that clears itself. */
export function useCopy(resetMs = 1800): CopyState {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const copy = useCallback(
    async (text: string) => {
      const ok = await copyText(text);
      setState(ok ? "copied" : "failed");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), resetMs);
      return ok;
    },
    [resetMs],
  );
  return { copied: state === "copied", failed: state === "failed", copy };
}

/**
 * What a QR code for `code` should encode: the fictional product URL on the server and on
 * localhost, the real address of /s/<code> once the demo is deployed (so a phone can scan it).
 */
export function useShareTarget(code: string): string {
  const [target, setTarget] = useState(() => shareUrl(code));
  useEffect(() => {
    setTarget(liveShareUrl(code, window.location.origin));
  }, [code]);
  return target;
}

/**
 * True when the visitor asked for reduced motion. Unlike motion's `useReducedMotion` it is false
 * on the server and on the first client render, then updates, so markup that depends on it never
 * causes a hydration mismatch. Use this one in the share flows.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
