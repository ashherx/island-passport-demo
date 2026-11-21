"use client";

/**
 * <Photo name="bohol-tarsier" /> : a photo slot that is never a broken image.
 *
 * With the photo processed (scripts/process-photos.py) it renders a responsive WebP with a
 * blurred preview behind it while it loads. Without it, it draws a placeholder: a soft gradient
 * from the option palette and a faint line drawing from the stamp artwork that suits the slot.
 * The switch is automatic: the manifest next to src/lib/islands/photos.ts decides.
 */
import { useState, type CSSProperties } from "react";
import { artUrl } from "@/lib/assets";
import { PHOTO_SLOTS, islandStrings, photoAspect, photoAsset, photoSources, type PhotoName } from "@/lib/islands";
import "./options-ui.css";

export interface PhotoProps {
  name: PhotoName;
  /** Alt text. Default: the slot's own description. Pass "" for a decorative photo. */
  alt?: string;
  /** The `sizes` attribute: how wide the photo is drawn. Default "100vw". */
  sizes?: string;
  /**
   * Width / height of the frame. Default: the photo's own shape. With "fill" the frame takes its
   * size from its parent (position it yourself) and the photo covers it.
   */
  aspect?: number | "fill";
  /** Load eagerly and at high priority (the hero photo of an open card). Default false. */
  priority?: boolean;
  /** Where the photo is anchored when cropped, as CSS object-position. Default "center". */
  position?: string;
  /** Show the "Sample photo" marker on the placeholder. Default false. */
  showSampleTag?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Four placeholder moods, picked per slot so a gallery of placeholders is not monotone. */
function moodOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 4;
}

export function Photo({ name, alt, sizes = "100vw", aspect, priority = false, position = "center", showSampleTag = false, className, style }: PhotoProps) {
  const slot = PHOTO_SLOTS[name];
  const asset = photoAsset(name);
  const sources = photoSources(name);
  const [loaded, setLoaded] = useState(false);
  const label = alt ?? slot.alt;
  const fill = aspect === "fill";
  const ratio = fill ? undefined : (aspect ?? photoAspect(name));

  const frame: CSSProperties = {
    ...(ratio ? { aspectRatio: String(ratio) } : null),
    ...(asset ? { backgroundColor: asset.color, backgroundImage: `url(${asset.blur})` } : null),
    ...style,
  };

  if (!asset || !sources) {
    return (
      <span
        className={className ? `ipp ipp-empty ${className}` : "ipp ipp-empty"}
        data-fill={fill ? "" : undefined}
        data-mood={moodOf(name)}
        data-photo={name}
        role={label ? "img" : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : true}
        style={frame}
      >
        <span className="ipp-art" style={{ maskImage: `url(${artUrl(slot.art)})`, WebkitMaskImage: `url(${artUrl(slot.art)})` }} aria-hidden="true" />
        {showSampleTag ? <span className="ipp-tag">{islandStrings.sample.photo}</span> : null}
      </span>
    );
  }

  return (
    <span className={className ? `ipp ${className}` : "ipp"} data-fill={fill ? "" : undefined} data-loaded={loaded ? "" : undefined} data-photo={name} style={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP renditions from our own pipeline; no optimizer needed */}
      <img
        className="ipp-img"
        src={sources.src}
        srcSet={sources.srcSet}
        sizes={sizes}
        width={asset.width}
        height={asset.height}
        alt={label}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        style={{ objectPosition: position }}
        onLoad={() => setLoaded(true)}
        // A cached photo can finish before React attaches onLoad.
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setLoaded(true);
        }}
      />
    </span>
  );
}
