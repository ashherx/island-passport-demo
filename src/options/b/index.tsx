"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, type GlobeHandle, type GlobeStatus, type StyleInput } from "@/components/globe";
import { ISLANDS } from "@/lib/islands";
import { useOption } from "@/lib/options";
import { buildVoyageStyle } from "./map-style";
import { installSprites } from "./sprites";

export default function LandingB() {
  const { selectedIslandId, selectIsland } = useOption();
  const globe = useRef<GlobeHandle>(null);
  const [status, setStatus] = useState<GlobeStatus>("poster");
  const style = useMemo<StyleInput>(() => (base) => buildVoyageStyle(base, ISLANDS), []);

  useEffect(() => {
    if (status !== "poster") return;
    let raf = 0;
    let off: (() => void) | null = null;
    const look = () => {
      const map = globe.current?.map();
      if (map) off = installSprites(map);
      else raf = requestAnimationFrame(look);
    };
    look();
    return () => {
      cancelAnimationFrame(raf);
      off?.();
    };
  }, [status]);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#fff8ec" }}>
      <Globe
        ref={globe}
        style={style}
        selectedId={selectedIslandId}
        onSelect={(id) => {
          selectIsland(id);
          void globe.current?.flyToIsland(id);
        }}
        onStatusChange={setStatus}
        autoRotate={7}
        globeSize={1}
        padding={{ top: 120, bottom: 60 }}
      />
    </main>
  );
}
