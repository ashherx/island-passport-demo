"use client";

/**
 * The generated post on a canvas. It fills its parent's width and keeps the format's shape; the
 * pixels are the full export size (1080 wide), so it is sharp at any preview size.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ctxOf } from "./art/core";
import { POST_SIZE, drawPost, loadPostAssets, type PostSpec } from "./art/post";

export interface PostCanvasProps {
  spec: PostSpec;
  /** Read aloud in place of the picture. Empty when the picture is decoration. */
  label: string;
  /** Fraction of the export size to draw at (for thumbnails). Default 1. */
  scale?: number;
  className?: string;
  style?: CSSProperties;
}

export function PostCanvas({ spec, label, scale = 1, className = "", style }: PostCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const key = JSON.stringify(spec);
  const { width, height } = POST_SIZE[spec.format];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let live = true;
    const next: PostSpec = JSON.parse(key);
    loadPostAssets(next)
      .then((assets) => {
        if (!live) return;
        const size = POST_SIZE[next.format];
        const w = Math.round(size.width * scale);
        const h = Math.round(size.height * scale);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = ctxOf(canvas);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, size.width, size.height);
        drawPost(ctx, next, assets);
        setReady(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, scale]);

  return (
    <canvas
      ref={ref}
      className={`skt-post-canvas ${className}`}
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-ready={ready}
      style={{ display: "block", width: "100%", height: "100%", aspectRatio: `${width} / ${height}`, ...style }}
    />
  );
}
