"use client";

/**
 * Hidden frame-rate read-out for checking the demo on a real phone: add ?debug to the URL.
 * Shows the frame rate over the last second and the worst frame in that second. It only counts
 * requestAnimationFrame intervals, so it reflects the main thread, not the GPU.
 */
import { useEffect, useRef } from "react";
import { strings, t } from "@/lib/strings";

export function FpsMeter() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let windowStart = last;
    let frames = 0;
    let worst = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames++;
      if (dt > worst) worst = dt;
      if (now - windowStart >= 1000) {
        const fps = Math.round((frames * 1000) / (now - windowStart));
        if (ref.current) {
          ref.current.textContent = `${t(strings.demo.fps, { fps })} · ${t(strings.demo.fpsWorst, { ms: Math.round(worst) })}`;
          ref.current.toggleAttribute("data-slow", worst > 34);
        }
        windowStart = now;
        frames = 0;
        worst = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div ref={ref} className="ipd-fps" aria-hidden="true" />;
}

export default FpsMeter;
