/**
 * The lens: the continuity between the cover and the island's page.
 *
 * When the passport is opened from its cover, the globe's view lifts out of the window as a small
 * round lens, hangs over the pages while the cover swings away and the pages riffle, and then
 * drops onto the island page's locator map, where a ring spreads as it disappears. The view the
 * traveler was looking at on the cover becomes the small map on the page.
 *
 * Plain DOM and the Web Animations API (transform and opacity only, so it stays on the
 * compositor while the book is flipping). Not used with reduced motion.
 *
 * Flavour per direction:
 *   classic  a gilded lens: steady glide, one band of light across it, one foil ring on landing
 *   reef     a bubble: floats up with a little overshoot, bobs, lands in two ripples
 *   journal  a paper cut-out: tilts as it lifts, comes down like a rubber stamp, leaves an ink ring
 */
import type { DirectionId } from "@/lib/types";

/** Every duration of the transition (ms). The book's own timings are in polish.md. */
export const LENS = {
  /** Window to hover point. The phone cover swings open in about 560 ms. */
  liftMs: 560,
  /** Correction when the book has moved under it (a desktop spread slides sideways as it opens). */
  retargetMs: 320,
  /** Hover point to the locator on the page. */
  landMs: { classic: 430, reef: 440, journal: 360 } satisfies Record<DirectionId, number>,
  /** Fade after touch-down. */
  fadeMs: 240,
  pulseMs: { classic: 760, reef: 900, journal: 520 } satisfies Record<DirectionId, number>,
  /** Scale of the lens while it hangs over the pages, relative to the window on the cover. */
  hoverScale: 0.64,
} as const;

export interface LensPose {
  /** Centre, in viewport px. */
  x: number;
  y: number;
  scale: number;
}

export interface LensOptions {
  direction: DirectionId;
  /** The globe window on the cover. Null: the cover is already out of the way, so fade in at the hover point. */
  from: DOMRect | null;
  /** Diameter of the lens at scale 1, px. */
  size: number;
  hover: LensPose;
  /** The still image of the globe, once it exists. */
  image(): string | null;
  /** Called with a listener for "the still image changed"; returns the unsubscribe. */
  watch(listener: () => void): () => void;
  /** CSS background behind the image (what surrounds the planet). */
  space: string;
}

export interface Lens {
  /** The hover point has moved. */
  retarget(hover: LensPose): void;
  /** Drop onto this rectangle. Resolves at touch-down; the fade and the ring follow by themselves. */
  land(target: DOMRect): Promise<void>;
  cancel(): void;
}

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const tilt: Record<DirectionId, number> = { classic: 0, reef: 0, journal: -9 };

const matrix = (size: number, pose: LensPose, rotate = 0) =>
  `translate3d(${(pose.x - size / 2).toFixed(2)}px, ${(pose.y - size / 2).toFixed(2)}px, 0) scale(${pose.scale.toFixed(4)}) rotate(${rotate}deg)`;

function pulse(direction: DirectionId, target: DOMRect, delay: number, grow: number): void {
  const size = Math.max(24, target.width * 0.86);
  const el = document.createElement("i");
  el.className = "ipcg-pulse";
  el.dataset.dir = direction;
  el.style.width = el.style.height = `${size}px`;
  const at = `translate3d(${(target.left + target.width / 2 - size / 2).toFixed(1)}px, ${(target.top + target.height / 2 - size / 2).toFixed(1)}px, 0)`;
  document.body.appendChild(el);
  const animation = el.animate(
    [
      { transform: `${at} scale(0.72)`, opacity: 0 },
      { transform: `${at} scale(0.9)`, opacity: 0.9, offset: 0.18 },
      { transform: `${at} scale(${grow})`, opacity: 0 },
    ],
    { duration: LENS.pulseMs[direction], delay, easing: EASE_OUT, fill: "both" },
  );
  const remove = () => el.remove();
  animation.finished.then(remove, remove);
}

export function launchLens(options: LensOptions): Lens {
  const { direction, size, from } = options;
  let hover = options.hover;
  let gone = false;

  const root = document.createElement("div");
  root.className = "ipcg-lens";
  root.dataset.dir = direction;
  root.setAttribute("aria-hidden", "true");
  root.style.width = root.style.height = `${size}px`;
  root.style.setProperty("--ipcg-space", options.space);

  const float = document.createElement("div");
  float.className = "ipcg-lens__float";
  const shadow = document.createElement("i");
  shadow.className = "ipcg-lens__shadow";
  const disc = document.createElement("div");
  disc.className = "ipcg-lens__disc";
  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "sync";
  img.draggable = false;
  const rim = document.createElement("i");
  rim.className = "ipcg-lens__rim";
  disc.appendChild(img);
  float.append(shadow, disc, rim);
  if (direction === "classic") {
    const glint = document.createElement("i");
    glint.className = "ipcg-lens__glint";
    float.appendChild(glint);
  }
  root.appendChild(float);

  // Until the still image exists the lens is empty, and the live canvas under it shows the same view.
  const paint = () => {
    const src = options.image();
    if (src && img.src !== src) img.src = src;
    disc.style.visibility = src ? "visible" : "hidden";
  };
  paint();
  const unwatch = options.watch(paint);

  const start: LensPose = from ? { x: from.left + from.width / 2, y: from.top + from.height / 2, scale: from.width / size } : { ...hover, scale: hover.scale * 0.7 };
  root.style.transform = matrix(size, start);
  root.style.opacity = from ? "1" : "0";
  document.body.appendChild(root);

  let move: Animation | null = root.animate(
    from
      ? direction === "reef"
        ? [
            { transform: matrix(size, start) },
            { transform: matrix(size, { ...hover, y: hover.y - 10, scale: hover.scale * 1.06 }), offset: 0.72 },
            { transform: matrix(size, hover) },
          ]
        : [{ transform: matrix(size, start) }, { transform: matrix(size, hover, tilt[direction]) }]
      : [
          { transform: matrix(size, start), opacity: 0 },
          { transform: matrix(size, hover, tilt[direction]), opacity: 1 },
        ],
    // A slow start: the lens leaves the cover as the cover itself begins to move.
    { duration: from ? LENS.liftMs : 300, easing: from ? "cubic-bezier(0.5, 0, 0.2, 1)" : EASE_OUT, fill: "forwards" },
  );
  rim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out", fill: "forwards" });
  shadow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 80, easing: "ease-out", fill: "forwards" });

  // It hangs in the air while the pages turn under it.
  const bobBy = direction === "reef" ? 5 : 3;
  const bob = float.animate(
    direction === "reef"
      ? [{ transform: "translate3d(0, 0, 0) scale(1, 1)" }, { transform: `translate3d(0, ${-bobBy}px, 0) scale(1.02, 0.985)` }]
      : [{ transform: "translate3d(0, 0, 0)" }, { transform: `translate3d(0, ${-bobBy}px, 0)` }],
    { duration: direction === "reef" ? 780 : 900, delay: from ? LENS.liftMs - 120 : 180, direction: "alternate", iterations: Infinity, easing: "ease-in-out" },
  );

  /** Where the lens is right now, as a transform, with the running move let go. */
  const freezeAt = (): string => {
    const now = getComputedStyle(root).transform;
    move?.cancel();
    move = null;
    root.style.transform = now === "none" ? matrix(size, hover) : now;
    return root.style.transform;
  };

  const destroy = () => {
    if (gone) return;
    gone = true;
    unwatch();
    root.remove();
  };

  return {
    retarget(next) {
      if (gone) return;
      if (Math.hypot(next.x - hover.x, next.y - hover.y) < 4) return;
      hover = next;
      const fromT = freezeAt();
      move = root.animate([{ transform: fromT }, { transform: matrix(size, hover, tilt[direction]) }], {
        duration: LENS.retargetMs,
        easing: EASE_OUT,
        fill: "forwards",
      });
    },

    land(target) {
      if (gone) return Promise.resolve();
      const end: LensPose = {
        x: target.left + target.width / 2,
        y: target.top + target.height / 2,
        scale: (target.width * (direction === "journal" ? 0.84 : 0.9)) / size,
      };
      const fromT = freezeAt();
      root.style.opacity = "1";
      bob.cancel();
      const duration = LENS.landMs[direction];
      const frames: Keyframe[] =
        direction === "journal"
          ? [
              { transform: fromT, easing: "cubic-bezier(0.3, 0, 0.6, 1)" },
              // Raised over the page, then brought down flat: a rubber stamp.
              { transform: matrix(size, { ...end, y: end.y - 8, scale: end.scale * 1.2 }, 5), offset: 0.66, easing: "cubic-bezier(0.6, 0, 0.9, 0.4)" },
              { transform: matrix(size, end, 3) },
            ]
          : direction === "reef"
            ? [
                { transform: fromT, easing: "cubic-bezier(0.4, 0, 0.3, 1)" },
                { transform: matrix(size, { ...end, scale: end.scale * 0.93 }), offset: 0.8, easing: "ease-out" },
                { transform: matrix(size, end) },
              ]
            : [{ transform: fromT }, { transform: matrix(size, end) }];
      move = root.animate(frames, { duration, easing: direction === "classic" ? "cubic-bezier(0.5, 0, 0.15, 1)" : "linear", fill: "forwards" });
      shadow.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration * 0.8, easing: "ease-in", fill: "forwards" });

      return new Promise<void>((resolve) => {
        const down = () => {
          resolve();
          if (gone) return;
          if (direction === "reef") {
            pulse(direction, target, 0, 1.7);
            pulse(direction, target, 190, 2.25);
          } else pulse(direction, target, 0, direction === "journal" ? 1.32 : 1.9);
          const fade = root.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: LENS.fadeMs,
            delay: direction === "journal" ? 120 : 40,
            easing: "ease-in",
            fill: "forwards",
          });
          fade.finished.then(destroy, destroy);
        };
        move?.finished.then(down, down);
      });
    },

    cancel() {
      if (gone) return;
      const fade = root.animate([{ opacity: getComputedStyle(root).opacity }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" });
      fade.finished.then(destroy, destroy);
    },
  };
}
