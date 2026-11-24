"use client";

/**
 * Every generated picture on one page: three art directions by three choices (stamp, island,
 * passport) by two formats, and the stamp at each status. A reference for the pitch and the
 * quickest way to check the canvas artwork. Not part of the flow itself.
 */
import { useState } from "react";
import { ShareShell } from "@/components/share/kit";
import { SAMPLE_TRAVELER, shareUrl } from "@/lib/share";
import { strings } from "@/lib/strings";
import { DIRECTION_IDS, type DirectionId, type StampStatus } from "@/lib/types";
import { PassportFilm } from "./PassportFilm";
import { PostCanvas } from "./PostCanvas";
import { STATUSES, SUBJECTS, codeFor, headlineSuggestions, travelerPassport, type ShareSubject } from "./data";

export function Artboard() {
  const [format, setFormat] = useState<"story" | "feed">("story");
  const [status, setStatus] = useState<StampStatus>("verified");
  const islandId = SAMPLE_TRAVELER.featuredStamp.islandId;
  const passport = travelerPassport(status);
  const cell = (direction: DirectionId, subject: ShareSubject, island = islandId) => {
    const code = codeFor(subject, island);
    return (
      <PostCanvas
        key={`${direction}-${subject}-${island}`}
        label={`${subject} in ${direction}`}
        spec={{ format, subject, direction, status, islandId: island, headline: headlineSuggestions(subject, island, passport)[0], code, qrValue: shareUrl(code) }}
        style={{ borderRadius: 14, boxShadow: "var(--sk-shadow-m)" }}
      />
    );
  };
  return (
    <ShareShell width="wide" back={{ href: "/share/traveler", label: "Traveler flow" }}>
      <div style={{ display: "grid", gap: 12 }}>
        <p className="sk-eyebrow">Traveler flow · artboard</p>
        <h1 className="sk-h2">Every generated post</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(["story", "feed"] as const).map((f) => (
            <button key={f} type="button" className="sk-chip" aria-pressed={format === f} onClick={() => setFormat(f)}>
              {f === "story" ? "Story" : "Feed post"}
            </button>
          ))}
          {STATUSES.map((s) => (
            <button key={s} type="button" className="sk-chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {strings.status[s].label}
            </button>
          ))}
        </div>
      </div>
      <section style={{ marginTop: 32, display: "grid", gap: 12 }}>
        <h2 className="sk-h3">Passport film (concept)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
          {DIRECTION_IDS.map((direction) => (
            <PassportFilm key={direction} spec={{ direction, status, code: codeFor("passport", islandId), qrValue: shareUrl(codeFor("passport", islandId)) }} />
          ))}
        </div>
      </section>
      {DIRECTION_IDS.map((direction) => (
        <section key={direction} style={{ marginTop: 32, display: "grid", gap: 12 }}>
          <h2 className="sk-h3">{strings.theme.directions[direction].name}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
            {SUBJECTS.map((subject) => cell(direction, subject))}
            {cell(direction, "island", "balicasag")}
          </div>
        </section>
      ))}
    </ShareShell>
  );
}
