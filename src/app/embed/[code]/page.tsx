import type { Metadata } from "next";
import { Avatar, BrandMark, IconArrow, QrCode, SampleTag, skRootClass } from "@/components/share/kit";
import { ISLAND_PHOTOS, offerStamp } from "@/components/share/partner/data";
import { Photo } from "@/components/share/partner/parts";
import { Stamp } from "@/components/stamp";
import { getIsland } from "@/lib/islands/data";
import { resolveShareCode, shareCopy, shareDisplayUrl, sharePath, shareUrl } from "@/lib/share";
import { strings } from "@/lib/strings";
import "./embed.css";

/**
 * /embed/[code]: the widget a partner places on their own website in an iframe.
 *
 * Display only, as Technical_Questions.md section 4 recommends: the island, the stamp, who is
 * sharing, a QR code and ONE button that opens Island Passport in a full tab with the partner's
 * code in the link. Nobody signs in or gives inside the frame, and nothing depends on cookies.
 * Designed for 100% width (240px to 460px, wider gets a side-by-side layout) and 440px height.
 */
export const metadata: Metadata = { title: "Island Passport widget (sample)", robots: { index: false } };

export default async function EmbedPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const shared = resolveShareCode(code);

  if (!shared || shared.kind !== "partner") {
    return (
      <main className={`${skRootClass} em`} data-empty="true">
        <div className="em-empty">
          <BrandMark size={30} />
          <b>{strings.app.name}</b>
          <span>This widget code is not one of the samples.</span>
        </div>
      </main>
    );
  }

  const { partner, islandId } = shared;
  const island = getIsland(islandId);
  const islandName = island?.name ?? "Bohol";
  const photo = ISLAND_PHOTOS[islandId]?.[0] ?? ISLAND_PHOTOS.bohol[0];
  const { offer } = partner;
  const isSeal = offer.kind !== "stamp";

  return (
    <main className={`${skRootClass} em`}>
      <article className="em-card">
        <div className="em-photo">
          <Photo name={photo.name} focus={photo.focus} width={1280} sizes="(max-width: 520px) 100vw, 460px" eager />
          <span className="em-shade" />
          <span className="em-brand">
            <BrandMark size={18} />
            {strings.app.name}
          </span>
          <SampleTag className="em-sample" />
          <div className="em-title">
            <span>{island?.region === islandName ? island?.country : `${island?.region ?? "Bohol"}, ${island?.country ?? "Philippines"}`}</span>
            <h1>{islandName}</h1>
          </div>
        </div>

        <div className="em-body">
          <div className="em-offer">
            <span className="em-stamp" aria-hidden="true">
              <Stamp stamp={offerStamp(partner, islandId)} size={78} decorative showSeal={false} />
            </span>
            <div className="em-offer-text">
              <h2>
                {isSeal ? "Earn the" : "Collect the"} <em>{offer.title}</em>
                {isSeal ? "" : " stamp"}
              </h2>
              <p className="em-by">
                <Avatar avatar={partner.avatar} size={20} />
                <span>
                  Shared by <b>{partner.name}</b>
                </span>
              </p>
            </div>
            <span className="em-qr">
              <QrCode value={shareUrl(shared.code)} size={74} frame="bare" label={false} mark={false} animate={false} title={`QR code for ${shareDisplayUrl(shared.code)}`} />
            </span>
          </div>

          <a className="sk-btn em-cta" data-variant="primary" data-block="true" href={sharePath(shared.code)} target="_blank" rel="noopener">
            {isSeal ? "Earn the seal" : "Collect the stamp"} <IconArrow size={18} />
          </a>
          <p className="em-note">
            Opens {shareDisplayUrl(shared.code)} in a new tab. {shareCopy.noDonations.replace("{charity}", offer.charity)}
          </p>
        </div>
      </article>
    </main>
  );
}
