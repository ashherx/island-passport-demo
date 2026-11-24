/**
 * <PostPreview />: a neutral phone mockup that shows how a post would read as a feed post (4:5),
 * a story (9:16) or a short video (9:16).
 *
 * The chrome is generic on purpose: an avatar, a handle, a caption and abstract action icons. It
 * does not copy any platform's logo, icons or layout, and it always carries a SAMPLE mark.
 * Everything inside is sized in container units, so the mockup is crisp at any width (a 96px
 * thumbnail in a picker, 300px in a preview step). No hooks: it renders on the server too.
 */
import type { CSSProperties, ReactNode } from "react";
import { shareCopy } from "@/lib/share/sample";
import type { ShareAvatar, ShareOwner } from "@/lib/share/types";
import { IconBubble, IconDots, IconHeart, IconKeep, IconLink, IconSend } from "./icons";
import { Avatar } from "./primitives";

export type PostFormat = "feed" | "story" | "short";
export const POST_FORMATS: readonly PostFormat[] = ["feed", "story", "short"] as const;

/** Width / height of the media area for each format. */
export const POST_ASPECT: Record<PostFormat, number> = { feed: 4 / 5, story: 9 / 16, short: 9 / 16 };

export interface PostAuthor {
  /** Shown as the handle, e.g. "@mia.sample". */
  handle: string;
  avatar: ShareAvatar;
  /** Second line in the feed header, e.g. "Bohol, Philippines". */
  place?: string;
}

/** The author block for a partner or the traveler. */
export function authorOf(owner: ShareOwner, place?: string): PostAuthor {
  return { handle: owner.socialHandle, avatar: owner.avatar, place };
}

export interface PostPreviewProps {
  format: PostFormat;
  author: PostAuthor;
  /** What fills the media area: an <IslandReel />, an <img>, or any node that fills its parent. */
  media: ReactNode;
  /** Caption text without hashtags. Shown under a feed post and over a short video; a story has none. */
  caption?: string;
  hashtags?: readonly string[];
  /** Short link for the story's link sticker, e.g. `shareDisplayUrl(code)`. */
  link?: string;
  /** "phone" = inside the device bezel (default). "bare" = just the screen, for tight spaces. */
  frame?: "phone" | "bare";
  /** Line above the mockup. Default the format's name ("Feed post", "Story", "Short video"). false = none. */
  label?: string | false;
  /** CSS width of the mockup. Default "100%" of its parent (cap it with max-width or a grid). */
  width?: number | string;
  /** Caption lines before it is cut off (feed: default 4, short: 2). */
  lines?: number;
  className?: string;
  style?: CSSProperties;
}

function Caption({ handle, caption, hashtags, lines }: { handle: string; caption?: string; hashtags?: readonly string[]; lines?: number }) {
  if (!caption && !hashtags?.length) return null;
  return (
    <p className="sk-post-caption" style={lines ? ({ "--lines": lines } as CSSProperties) : undefined}>
      <b>{handle}</b> {caption} {hashtags?.length ? <i>{hashtags.join(" ")}</i> : null}
    </p>
  );
}

export function PostPreview({ format, author, media, caption, hashtags, link, frame = "phone", label, width, lines, className = "", style }: PostPreviewProps) {
  const name = label === undefined ? shareCopy.formats[format] : label;
  const handle = author.handle.replace(/^@/, "");
  const sized = width === undefined ? style : ({ "--post-w": typeof width === "number" ? `${width}px` : width, ...style } as CSSProperties);

  return (
    <figure className={`sk-post ${className}`} data-format={format} data-frame={frame} style={{ margin: 0, ...sized }}>
      {name ? <figcaption className="sk-post-label">{name}</figcaption> : null}
      <div className="sk-post-device">
        <div className="sk-post-bezel">
          <div className="sk-post-screen">
            {format === "feed" ? (
              <>
                <div className="sk-post-head">
                  <Avatar avatar={author.avatar} className="sk-post-avatar" />
                  <div className="sk-post-head-text">
                    <span className="sk-post-handle">{handle}</span>
                    {author.place ? <span className="sk-post-meta">{author.place}</span> : null}
                  </div>
                  <span className="sk-post-tag">{shareCopy.sampleTag}</span>
                  <IconDots />
                </div>
                <div className="sk-post-media">{media}</div>
                <div className="sk-post-actions" aria-hidden="true">
                  <IconHeart />
                  <IconBubble />
                  <IconSend />
                  <IconKeep />
                </div>
                <Caption handle={handle} caption={caption} hashtags={hashtags} lines={lines} />
                <div className="sk-post-foot" aria-hidden="true">
                  Just now
                </div>
              </>
            ) : (
              <div className="sk-post-media">
                {media}
                <div className="sk-post-over">
                  {format === "story" ? (
                    <>
                      <div className="sk-post-bars" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="sk-post-who">
                        <Avatar avatar={author.avatar} className="sk-post-avatar" />
                        <span className="sk-post-handle">{handle}</span>
                        <span className="sk-post-meta">now</span>
                        <span className="sk-post-tag">{shareCopy.sampleTag}</span>
                      </div>
                      <div className="sk-post-bottom">
                        {link ? (
                          <div className="sk-post-sticker">
                            <IconLink />
                            <span>{link}</span>
                          </div>
                        ) : null}
                        <div className="sk-post-reply" aria-hidden="true">
                          <span>Send a message</span>
                          <IconHeart />
                          <IconSend />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sk-post-rail" aria-hidden="true">
                        <Avatar avatar={author.avatar} className="sk-post-avatar" />
                        <div>
                          <IconHeart />
                          4.2k
                        </div>
                        <div>
                          <IconBubble />
                          186
                        </div>
                        <div>
                          <IconSend />
                          Share
                        </div>
                      </div>
                      <div className="sk-post-bottom">
                        <div className="sk-post-short-text">
                          <div className="sk-post-who" style={{ padding: 0 }}>
                            <span className="sk-post-handle">{handle}</span>
                            <span className="sk-post-tag" style={{ marginLeft: 0 }}>
                              {shareCopy.sampleTag}
                            </span>
                          </div>
                          <Caption handle="" caption={caption} hashtags={hashtags} lines={lines} />
                        </div>
                        <div className="sk-post-scrub" aria-hidden="true" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}
