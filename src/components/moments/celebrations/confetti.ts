/**
 * Restrained confetti for the Provincial Stamp award (UX-4): one burst of tiny stamps, leaves,
 * waves and foil sparks on a 2D canvas. Sprites are drawn once to offscreen canvases, so a frame
 * is a few dozen drawImage calls. Hard-stops and clears itself after `duration` (max 1.8s).
 */

export interface ConfettiOptions {
  /** Burst centre in CSS px, relative to the canvas. */
  x: number;
  y: number;
  /** Radius around the centre that pieces start from (they appear from behind the stamp). */
  radius?: number;
  /** CSS colours. The first two are used most. */
  colors: string[];
  /** Number of pieces. Default 44. */
  count?: number;
  /** Total run time in ms, capped at 1800. Default 1800. */
  duration?: number;
  onDone?(): void;
}

type ShapeName = "stamp" | "leaf" | "wave" | "spark";
const SHAPES: ShapeName[] = ["stamp", "leaf", "wave", "leaf", "stamp", "spark", "wave"];
const SPRITE = 28; // logical px of a sprite cell

interface Piece {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  flip: number;
  vflip: number;
  size: number;
  delay: number;
  life: number;
}

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeName, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (shape) {
    case "stamp": {
      // A postmark: scalloped disc with a ring and a centre dot knocked out.
      const bumps = 12;
      ctx.beginPath();
      for (let i = 0; i < bumps; i++) {
        const a = (i / bumps) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * 8.2 + 2.3, Math.sin(a) * 8.2);
        ctx.arc(Math.cos(a) * 8.2, Math.sin(a) * 8.2, 2.3, 0, Math.PI * 2);
      }
      ctx.moveTo(8.4, 0);
      ctx.arc(0, 0, 8.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      break;
    }
    case "leaf": {
      ctx.beginPath();
      ctx.moveTo(0, -10.5);
      ctx.bezierCurveTo(7.4, -5, 7.4, 5, 0, 10.5);
      ctx.bezierCurveTo(-7.4, 5, -7.4, -5, 0, -10.5);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 12);
      ctx.moveTo(0, -1.5);
      ctx.lineTo(3.4, -4.4);
      ctx.moveTo(0, 2.8);
      ctx.lineTo(-3.4, -0.2);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      break;
    }
    case "wave": {
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-11, 1.6);
      ctx.quadraticCurveTo(-8.25, -5.2, -5.5, 1.6);
      ctx.quadraticCurveTo(-2.75, 8.4, 0, 1.6);
      ctx.quadraticCurveTo(2.75, -5.2, 5.5, 1.6);
      ctx.quadraticCurveTo(8.25, 8.4, 11, 1.6);
      ctx.stroke();
      break;
    }
    default: {
      // Four-point foil spark.
      const s = 9.5;
      const k = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(k, -k);
      ctx.lineTo(s, 0);
      ctx.lineTo(k, k);
      ctx.lineTo(0, s);
      ctx.lineTo(-k, k);
      ctx.lineTo(-s, 0);
      ctx.lineTo(-k, -k);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function makeSprite(shape: ShapeName, color: string, dpr: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = Math.ceil(SPRITE * dpr);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    ctx.translate(SPRITE / 2, SPRITE / 2);
    drawShape(ctx, shape, color);
  }
  return c;
}

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

/** Start a burst. Returns a function that stops and clears it. */
export function burstConfetti(canvas: HTMLCanvasElement, options: ConfettiOptions): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx || options.colors.length === 0) {
    options.onDone?.();
    return () => {};
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const duration = Math.min(1800, options.duration ?? 1800);
  const count = options.count ?? 44;
  const radius = options.radius ?? 60;
  const colors = options.colors;
  const sprites = new Map<string, HTMLCanvasElement>();
  const sprite = (shape: ShapeName, color: string) => {
    const key = `${shape}|${color}`;
    let s = sprites.get(key);
    if (!s) sprites.set(key, (s = makeSprite(shape, color, dpr)));
    return s;
  };

  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    // Even spread around the stamp with a little jitter, thrown outward and up.
    const angle = (i / count) * Math.PI * 2 + rnd(-0.16, 0.16);
    const speed = rnd(230, 640);
    const shape = SHAPES[i % SHAPES.length];
    // Favour the first two colours (foil), sprinkle the rest.
    const color = shape === "spark" ? colors[i % 2] : colors[Math.random() < 0.34 ? i % 2 : 2 + (i % Math.max(1, colors.length - 2))] ?? colors[0];
    pieces.push({
      sprite: sprite(shape, color),
      x: options.x + Math.cos(angle) * radius * rnd(0.55, 0.95),
      y: options.y + Math.sin(angle) * radius * rnd(0.55, 0.95),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rnd(210, 420),
      rot: rnd(0, Math.PI * 2),
      vr: rnd(-7, 7),
      flip: rnd(0, Math.PI * 2),
      vflip: rnd(5, 11),
      size: shape === "spark" ? rnd(9, 15) : rnd(13, 21),
      delay: rnd(0, 110),
      life: rnd(0.62, 1) * (duration - 120),
    });
  }

  const GRAVITY = 1250;
  let raf = 0;
  let stopped = false;
  let start = 0;
  let last = 0;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const frame = (now: number) => {
    if (stopped) return;
    if (!start) start = last = now;
    const elapsed = now - start;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (elapsed >= duration) {
      stop();
      options.onDone?.();
      return;
    }
    const drag = Math.pow(0.16, dt);
    for (const p of pieces) {
      const age = elapsed - p.delay;
      if (age < 0 || age > p.life) continue;
      p.vx *= drag;
      p.vy = p.vy * drag + GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vflip * dt;
      const t = age / p.life;
      const alpha = t < 0.08 ? t / 0.08 : t > 0.66 ? 1 - (t - 0.66) / 0.34 : 1;
      const cos = Math.cos(p.rot);
      const sin = Math.sin(p.rot);
      const sy = 0.35 + 0.65 * Math.abs(Math.cos(p.flip));
      const k = (p.size / SPRITE) * dpr;
      ctx.setTransform(cos * k, sin * k, -sin * k * sy, cos * k * sy, p.x * dpr, p.y * dpr);
      ctx.globalAlpha = alpha;
      ctx.drawImage(p.sprite, -SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}
