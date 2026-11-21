/**
 * Confetti for the Provincial Stamp award (UX-4): tiny stamps, leaves, waves and foil sparks on a
 * 2D canvas, in three depth layers (far pieces are small, dim and slow; near ones large and quick).
 * A main burst, then a smaller second one a quarter of a second later. Pieces are thrown hard and
 * meet strong drag, so the burst opens fast and then floats down.
 *
 * Sprites are drawn once to offscreen canvases, so a frame is about a hundred drawImage calls.
 * Hard-stops and clears itself after `duration` (max 1.8s). Reduced motion is the caller's switch:
 * do not call this at all (ProvincialAward does not).
 */

export interface ConfettiOptions {
  /** Burst centre in CSS px, relative to the canvas. */
  x: number;
  y: number;
  /** Radius around the centre that pieces start from (they appear from behind the stamp). */
  radius?: number;
  /** CSS colours. The first two are used most. */
  colors: string[];
  /** Pieces in the main burst. Default 86. */
  count?: number;
  /** Pieces in the second burst, 240 ms after the first. Default 25. 0 turns it off. */
  echo?: number;
  /** Total run time in ms, capped at 1800. Default 1800. */
  duration?: number;
  /** Fires once when the burst has finished or was stopped. Remove or hide the canvas here. */
  onDone?(): void;
}

type ShapeName = "stamp" | "leaf" | "wave" | "spark";
const SHAPES: ShapeName[] = ["stamp", "leaf", "wave", "leaf", "stamp", "spark", "wave"];
const SPRITE = 28; // logical px of a sprite cell
/** The shapes are drawn about this wide inside the cell: a piece of `size` px is this many px across. */
const SHAPE_SPAN = 21;
/** Sprites are baked a little larger than 1:1, because the near layer draws them enlarged. */
const SPRITE_RES = 1.3;

/** Depth layers, drawn far to near. `share` is the fraction of pieces in the layer. */
const LAYERS = [
  { share: 0.36, size: 8, alpha: 0.6, speed: 0.7 },
  { share: 0.4, size: 14, alpha: 0.92, speed: 0.88 },
  { share: 0.24, size: 22, alpha: 1, speed: 1 },
] as const;

/** Second burst: this long after the first, in ms. */
const ECHO_DELAY = 240;
/** Launch speed range in px/s (near layer). */
const LAUNCH: readonly [number, number] = [300, 830];
/** Fraction of velocity left after one second: strong, so pieces burst and then float. */
const DRAG = 0.06;
const GRAVITY = 900;

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
  /** Layer opacity. */
  alpha: number;
  /** Layer speed: far pieces move slower (parallax). */
  speed: number;
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
  c.width = c.height = Math.ceil(SPRITE * dpr * SPRITE_RES);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.scale(dpr * SPRITE_RES, dpr * SPRITE_RES);
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
  const count = Math.max(0, Math.round(options.count ?? 86));
  const echo = Math.max(0, Math.round(options.echo ?? 25));
  const radius = options.radius ?? 60;
  const colors = options.colors;
  const sprites = new Map<string, HTMLCanvasElement>();
  const sprite = (shape: ShapeName, color: string) => {
    const key = `${shape}|${color}`;
    let s = sprites.get(key);
    if (!s) sprites.set(key, (s = makeSprite(shape, color, dpr)));
    return s;
  };

  /** One burst of `n` pieces, `delay` ms in. Appends to the layer buckets. */
  const buckets: Piece[][] = LAYERS.map(() => []);
  const burst = (n: number, delay: number, power: number) => {
    const turn = rnd(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      // Layers are interleaved round the circle, so no direction is all near or all far.
      const pick = ((i * 7) % n) / n;
      const layerIndex = pick < LAYERS[0].share ? 0 : pick < LAYERS[0].share + LAYERS[1].share ? 1 : 2;
      const layer = LAYERS[layerIndex];
      // Even spread around the stamp with a little jitter, thrown outward and up.
      const angle = turn + (i / n) * Math.PI * 2 + rnd(-0.18, 0.18);
      const speed = rnd(LAUNCH[0], LAUNCH[1]) * power;
      const shape = SHAPES[i % SHAPES.length];
      // Favour the first two colours (foil), sprinkle the rest.
      const color = shape === "spark" ? colors[i % 2] : colors[Math.random() < 0.34 ? i % 2 : 2 + (i % Math.max(1, colors.length - 2))] ?? colors[0];
      const wait = delay + rnd(0, 110);
      buckets[layerIndex].push({
        sprite: sprite(shape, color),
        x: options.x + Math.cos(angle) * radius * rnd(0.55, 0.95),
        y: options.y + Math.sin(angle) * radius * rnd(0.55, 0.95),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rnd(260, 520) * power,
        rot: rnd(0, Math.PI * 2),
        vr: rnd(-7, 7),
        flip: rnd(0, Math.PI * 2),
        vflip: rnd(4, 10),
        size: layer.size * (shape === "spark" ? rnd(0.7, 0.95) : rnd(0.88, 1.16)),
        alpha: layer.alpha,
        speed: layer.speed,
        delay: wait,
        life: Math.max(200, rnd(0.66, 1) * (duration - 120 - wait)),
      });
    }
  };
  burst(count, 0, 1);
  if (echo > 0 && duration > ECHO_DELAY + 400) burst(echo, ECHO_DELAY, 0.82);
  // Far to near, so large pieces pass in front of small ones.
  const pieces = buckets.flat();

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
    options.onDone?.();
  };

  const frame = (now: number) => {
    if (stopped) return;
    if (!start) start = last = now;
    const elapsed = now - start;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (elapsed >= duration) {
      stop();
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const drag = Math.pow(DRAG, dt);
    for (const p of pieces) {
      const age = elapsed - p.delay;
      if (age < 0 || age > p.life) continue;
      const step = dt * p.speed;
      p.vx *= drag;
      p.vy = p.vy * drag + GRAVITY * dt;
      // Once the throw is spent the piece flutters: it slips sideways as it turns over.
      p.x += (p.vx + Math.sin(p.flip) * 26) * step;
      p.y += p.vy * step;
      p.rot += p.vr * dt;
      p.flip += p.vflip * dt;
      const t = age / p.life;
      const alpha = (t < 0.06 ? t / 0.06 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1) * p.alpha;
      const cos = Math.cos(p.rot);
      const sin = Math.sin(p.rot);
      const sy = 0.35 + 0.65 * Math.abs(Math.cos(p.flip));
      const k = (p.size / SHAPE_SPAN) * dpr;
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
