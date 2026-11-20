/**
 * Outline of each stamp shape as a single closed path that starts near 12 o'clock and runs
 * clockwise, in stamp units (200 x 200 box). Mirrors `outline()` in components/stamp/Stamp.tsx,
 * which is not exported; the upgrade animation needs a path so the line can be drawn on.
 */
import { circlePath, polygonPath, scallopPath } from "@/components/stamp/geometry";
import type { StampShape } from "@/lib/types";

export function outlinePath(shape: StampShape): string {
  switch (shape) {
    case "scalloped":
      return scallopPath(26, 90.4, 0.8);
    case "octagon":
      return polygonPath(8, 97);
    case "oval":
      return "M 100 23 A 97 77 0 1 1 100 177 A 97 77 0 1 1 100 23 Z";
    case "rounded":
      return "M 100 28 H 176 A 16 16 0 0 1 192 44 V 156 A 16 16 0 0 1 176 172 H 24 A 16 16 0 0 1 8 156 V 44 A 16 16 0 0 1 24 28 Z";
    case "seal":
      return scallopPath(36, 92.4, 0.74);
    default:
      return circlePath(93, 100, 100);
  }
}
