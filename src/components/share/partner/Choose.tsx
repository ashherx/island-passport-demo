"use client";

/**
 * Step 2: choose what to promote. An island, what the post leads with (the stamp or the charity
 * behind it) and the format. The island-specific link updates as the island changes.
 */
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";
import { IconCheck, IconLink, POST_FORMATS, usePrefersReducedMotion, type PostFormat } from "@/components/share/kit";
import { Stamp } from "@/components/stamp";
import { getIsland } from "@/lib/islands/data";
import { SHARE_DOMAIN, shareCode, shareCopy } from "@/lib/share";
import type { SharePartner } from "@/lib/share/types";
import { ISLAND_PHOTOS, offerStamp, type PostLead } from "./data";
import { EASE, IconLeaf, Photo } from "./parts";
import type { Draft } from "./post";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

const FORMAT_NOTES: Record<PostFormat, { shape: string; note: string }> = {
  feed: { shape: "4:5", note: "Photo or video, caption under it" },
  story: { shape: "9:16", note: "Full screen, add a link sticker" },
  short: { shape: "9:16", note: "One of the six island videos" },
};

function Tick({ on }: { on: boolean }) {
  return (
    <span className="pf-tick" data-on={on} aria-hidden="true">
      <IconCheck size={14} strokeWidth={3} />
    </span>
  );
}

export function Choose({
  partner,
  draft,
  onIsland,
  onLead,
  onFormat,
}: {
  partner: SharePartner;
  draft: Draft;
  onIsland: (islandId: string) => void;
  onLead: (lead: PostLead) => void;
  onFormat: (format: PostFormat) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const { offer } = partner;
  const island = getIsland(draft.islandId);
  const code = shareCode(partner, draft.islandId);
  const isSeal = offer.kind !== "stamp";

  return (
    <div className="pf-choose">
      <header className="pf-head pf-rise" style={rise(0)}>
        <p className="sk-eyebrow">
          {partner.name} · {shareCopy.partnerTypes[partner.type]}
        </p>
        <h1 className="sk-h2 pf-h1">
          What are you <em>promoting?</em>
        </h1>
        <p className="sk-lead">Three quick choices. Everything after this is made for you.</p>
      </header>

      <section className="pf-sec pf-rise" style={rise(1)} aria-labelledby="pf-ch-island">
        <h2 className="pf-sec-title" id="pf-ch-island">
          <span className="pf-sec-n">1</span>Island
        </h2>
        <ul className="pf-islands">
          {partner.islandIds.map((id) => {
            const item = getIsland(id);
            const photo = ISLAND_PHOTOS[id]?.[0] ?? ISLAND_PHOTOS.bohol[0];
            const on = id === draft.islandId;
            return (
              <li key={id}>
                <button type="button" className="pf-island" aria-pressed={on} onClick={() => onIsland(id)}>
                  <Photo name={photo.name} focus={photo.focus} sizes="180px" eager />
                  <span className="pf-island-shade" />
                  <Tick on={on} />
                  <span className="pf-island-text">
                    <b>{item?.name ?? id}</b>
                    <span>{item?.tagline}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="pf-sec pf-rise" style={rise(2)} aria-labelledby="pf-ch-lead">
        <h2 className="pf-sec-title" id="pf-ch-lead">
          <span className="pf-sec-n">2</span>Lead with
        </h2>
        <div className="pf-leads">
          <button type="button" className="sk-card pf-lead" aria-pressed={draft.lead === "stamp"} onClick={() => onLead("stamp")}>
            <Tick on={draft.lead === "stamp"} />
            <span className="pf-lead-art">
              <Stamp stamp={offerStamp(partner, draft.islandId)} size={92} decorative showSeal={false} />
            </span>
            <span className="pf-lead-text">
              <span className="pf-lead-k">{isSeal ? "The seal" : "The stamp"}</span>
              <b>{offer.title}</b>
              <span>
                {offer.threshold.display} gift <i className="pf-ex">example</i>
              </span>
            </span>
          </button>
          <button type="button" className="sk-card pf-lead" aria-pressed={draft.lead === "charity"} onClick={() => onLead("charity")}>
            <Tick on={draft.lead === "charity"} />
            <span className="pf-lead-art">
              <span className="pf-cause">
                <IconLeaf size={34} strokeWidth={1.5} />
              </span>
            </span>
            <span className="pf-lead-text">
              <span className="pf-lead-k">The charity</span>
              <b>{offer.charity}</b>
              <span>{offer.purpose}</span>
            </span>
          </button>
        </div>
        <p className="sk-hint">
          {shareCopy.noDonations.replace("{charity}", offer.charity)} {shareCopy.exampleThreshold}
        </p>
      </section>

      <section className="pf-sec pf-rise" style={rise(3)} aria-labelledby="pf-ch-format">
        <h2 className="pf-sec-title" id="pf-ch-format">
          <span className="pf-sec-n">3</span>Start with a format
        </h2>
        <div className="pf-formats">
          {POST_FORMATS.map((format) => {
            const on = draft.format === format;
            return (
              <button type="button" key={format} className="sk-card pf-format" aria-pressed={on} onClick={() => onFormat(format)}>
                <span className="pf-format-glyph" data-format={format} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <b>{shareCopy.formats[format]}</b>
                <span className="pf-format-shape">{FORMAT_NOTES[format].shape}</span>
                <span className="pf-format-note">{FORMAT_NOTES[format].note}</span>
                <Tick on={on} />
              </button>
            );
          })}
        </div>
        <p className="sk-hint">You can flip between all three in the next step. A widget for your own website comes with every post.</p>
      </section>

      <div className="pf-linkline pf-rise" style={rise(4)} aria-live="polite">
        <span className="pf-linkline-ico">
          <IconLink size={18} />
        </span>
        <span className="pf-linkline-text">
          <span>Your link for {island?.name ?? "this island"}</span>
          <b>
            {SHARE_DOMAIN}/s/
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.i
                key={code}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {code}
              </motion.i>
            </AnimatePresence>
          </b>
        </span>
      </div>
    </div>
  );
}
