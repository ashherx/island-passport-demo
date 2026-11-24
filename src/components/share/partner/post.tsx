"use client";

/**
 * The post a partner is building: its draft state, everything derived from it (code, byline, end
 * card wording, the PNG spec) and the media that fills a <PostPreview> in each format.
 */
import { forwardRef, type ReactNode } from "react";
import { IslandReel, authorOf, type IslandReelHandle, type PostAuthor, type PostFormat, type PostImageSpec } from "@/components/share/kit";
import { getIsland } from "@/lib/islands/data";
import { captionSuggestions, defaultHashtags, featuredReel, getReel, shareCode, shareCopy } from "@/lib/share";
import type { CaptionSuggestion, IslandReel as IslandReelData, SharePartner } from "@/lib/share/types";
import { LINE_SUGGESTIONS, defaultByline, photoReel, photosForIsland, type Footage, type PhotoChoice, type PostLead } from "./data";
import { PhotoPost } from "./parts";

export interface Draft {
  islandId: string;
  lead: PostLead;
  format: PostFormat;
  footage: Footage;
  /** Print the partner's name in the video. */
  showName: boolean;
  /** The name line, e.g. "with Mia Sample". */
  name: string;
  /** The partner's own short line, printed in quotes. */
  message: string;
  /** Caption text, without hashtags. */
  caption: string;
  tags: string[];
}

/** Which ready-made caption a lead starts from: warm for the stamp, facts for the charity. */
const leadTone = (lead: PostLead) => (lead === "charity" ? 2 : 0);

export function newDraft(partner: SharePartner, reelId?: string | null, islandId: string = partner.islandIds[0]): Draft {
  const lead: PostLead = partner.type === "charity" ? "charity" : "stamp";
  return {
    islandId,
    lead,
    format: "short",
    footage: { kind: "reel", id: reelId ?? featuredReel(islandId).id },
    showName: true,
    name: defaultByline(partner),
    message: LINE_SUGGESTIONS[partner.type][0],
    caption: captionSuggestions(partner, islandId)[leadTone(lead)].text,
    tags: defaultHashtags(islandId, partner.type),
  };
}

/** Move a draft to another island or lead, carrying the caption across unless it was rewritten by hand. */
export function retarget(partner: SharePartner, draft: Draft, change: { islandId?: string; lead?: PostLead }): Draft {
  const islandId = change.islandId ?? draft.islandId;
  const lead = change.lead ?? draft.lead;
  const before = captionSuggestions(partner, draft.islandId);
  const after = captionSuggestions(partner, islandId);
  const tone = before.findIndex((s) => s.text === draft.caption);
  const caption = tone === -1 ? draft.caption : after[change.lead ? leadTone(lead) : tone].text;
  const islandChanged = islandId !== draft.islandId;
  return {
    ...draft,
    islandId,
    lead,
    caption,
    tags: islandChanged ? defaultHashtags(islandId, partner.type) : draft.tags,
    // Another island brings its own best footage: its first photo, or the video that suits it.
    footage: !islandChanged ? draft.footage : draft.footage.kind === "photo" ? { kind: "photo", name: photosForIsland(islandId)[0].name } : { kind: "reel", id: featuredReel(islandId).id },
  };
}

export interface Post {
  partner: SharePartner;
  draft: Draft;
  islandId: string;
  islandName: string;
  /** `mia-bohol` */
  code: string;
  /** The prepared video, or the photo as a one-scene video. */
  reel: IslandReelData;
  /** Set when the footage is a photo. */
  photo: PhotoChoice | null;
  /** Title for summaries: the video's title or the photo's headline. */
  title: string;
  byline: string | undefined;
  message: string | undefined;
  endTitle: ReactNode;
  /** Line with the QR code, e.g. "Scan to support Coral Trust". */
  support: string;
  author: PostAuthor;
  suggestions: CaptionSuggestion[];
}

export function buildPost(partner: SharePartner, draft: Draft): Post {
  const island = getIsland(draft.islandId);
  const islandName = island?.name ?? "Bohol";
  const { offer } = partner;
  const photos = photosForIsland(draft.islandId);
  const photo = draft.footage.kind === "photo" ? (photos.find((p) => p.name === (draft.footage as { name: string }).name) ?? photos[0]) : null;
  const reel = photo ? photoReel(photo, draft.islandId, offer.art) : (getReel(draft.footage.kind === "reel" ? draft.footage.id : null) ?? featuredReel(draft.islandId));
  const byline = draft.showName && draft.name.trim() ? draft.name.trim() : undefined;
  const message = draft.message.trim() || undefined;
  const endTitle =
    draft.lead === "charity" ? (
      <>
        Help <em>{offer.charity}</em> protect {islandName}
      </>
    ) : offer.kind === "stamp" ? (
      <>
        Collect the <em>{offer.title}</em> stamp
      </>
    ) : (
      <>
        Earn the <em>{offer.title}</em>
      </>
    );
  const support = draft.lead === "charity" ? `${shareCopy.scanToSupport} ${offer.charity}` : offer.kind === "stamp" ? "Scan to collect the stamp" : "Scan to earn the seal";
  return {
    partner,
    draft,
    islandId: draft.islandId,
    islandName,
    code: shareCode(partner, draft.islandId),
    reel,
    photo,
    title: photo ? photo.line : reel.title,
    byline,
    message,
    endTitle,
    support,
    author: authorOf(partner, `${islandName}, ${island?.country ?? "Philippines"}`),
    suggestions: captionSuggestions(partner, draft.islandId),
  };
}

/** The still PNG the share sheet saves: the photo, or the video's opening frame as a cover. */
export function imageSpec(post: Post, format: PostFormat, qrValue: string): PostImageSpec {
  const scene = post.reel.scenes[0];
  const said = post.message ? `“${post.message}”` : "";
  return {
    format: format === "feed" ? "feed" : "story",
    photo: scene.photo,
    focus: scene.focus,
    islandName: post.islandName,
    headline: scene.line,
    byline: [said, post.byline].filter(Boolean).join("  ") || undefined,
    code: post.code,
    support: post.draft.lead === "charity" ? shareCopy.scanToSupport : post.partner.offer.kind === "stamp" ? "Scan to collect" : "Scan to earn",
    supportName: post.draft.lead === "charity" ? post.partner.offer.charity : post.partner.offer.kind === "stamp" ? `${post.partner.offer.title} stamp` : post.partner.offer.title,
    qrValue,
  };
}

/**
 * What fills the media area of a mockup. `live` plays; otherwise it is a still frame with no
 * timers (the phones waiting at the sides of the studio, thumbnails).
 */
export const PostMedia = forwardRef<IslandReelHandle, { post: Post; format: PostFormat; live?: boolean; controls?: boolean; sizes?: string }>(function PostMedia(
  { post, format, live = true, controls, sizes },
  ref,
) {
  if (post.photo && format !== "short") {
    return <PhotoPost choice={post.photo} islandName={post.islandName} code={post.code} byline={post.byline} avatar={post.partner.avatar} message={post.message} support={post.support} />;
  }
  return (
    <IslandReel
      // A still frame and a playing reel keep different state, so each gets its own instance.
      key={live ? "live" : "still"}
      ref={live ? ref : undefined}
      mode={live ? "player" : "poster"}
      reel={post.reel}
      islandName={post.islandName}
      code={post.code}
      byline={post.byline}
      avatar={post.byline || post.message ? post.partner.avatar : undefined}
      message={post.message}
      endTitle={post.endTitle}
      support={post.support}
      controls={controls}
      sizes={sizes}
    />
  );
});
