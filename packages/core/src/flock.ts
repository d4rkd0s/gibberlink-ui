/**
 * "Migration" animation for glyphs streaming out of a GibberLink transmission.
 *
 * Each glyph is a bird. Birds follow boids rules (separation, alignment, cohesion)
 * so the stream reads as a living flock, but every bird is also tied by a spring to
 * an anchor on a shared migration path. Anchors are spaced by spawn order, and the
 * spring plus a hard ordering clamp guarantee earlier glyphs always fly ahead of later
 * ones, so a reader can still follow the message left-to-right (newest enters left).
 *
 * Pure and deterministic: no DOM, time is passed in. The renderer only draws.
 */
import type { ByteTime } from "./codec.ts";

export interface GlyphTime extends ByteTime {
  glyph: string;
  /** Position in the message (0-based, code points). */
  index: number;
}

const encoder = new TextEncoder();

/** One entry per code point, timed by the on-air window of its bytes. */
export function glyphTimeline(text: string, byteTimes: ByteTime[]): GlyphTime[] {
  const out: GlyphTime[] = [];
  let byte = 0;
  let index = 0;
  for (const glyph of text) {
    const n = encoder.encode(glyph).length;
    const first = byteTimes[byte];
    const last = byteTimes[byte + n - 1];
    if (!first || !last) throw new Error("Byte timeline shorter than text");
    out.push({ glyph, index: index++, start: first.start, end: last.end });
    byte += n;
  }
  if (byte !== byteTimes.length) throw new Error("Byte timeline longer than text");
  return out;
}

export interface FlockOptions {
  width: number;
  height: number;
  seed?: number;
  reducedMotion?: boolean;
  /** Horizontal speed of the migration path, px/s. Default scales with width. */
  speed?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface Bird {
  index: number;
  glyph: string;
  x: number;
  y: number;
  /** Heading in radians, for a gentle tilt when drawn. */
  angle: number;
  alpha: number;
  /** 0..1 scale while arriving/leaving. */
  scale: number;
}

interface State {
  g: GlyphTime;
  /** distance flown (see mirroring note in createFlock) */
  x: number;
  y: number;
  vx: number;
  vy: number;
  jitter: number;
  lane: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

export function createFlock(glyphs: readonly GlyphTime[], opts: FlockOptions) {
  const { width, height } = opts;
  const rand = rng(opts.seed ?? 1);
  const speed = opts.speed ?? Math.max(160, width / 3.2);
  const fadeIn = opts.fadeIn ?? 0.35;
  const fadeOut = opts.fadeOut ?? 0.6;
  const margin = 40;
  const midY = height / 2;
  const amp = opts.reducedMotion ? 0 : height * 0.16;
  const laneSpread = opts.reducedMotion ? 0 : height * 0.28;
  const order = [...glyphs].sort((a, b) => a.index - b.index);
  const birds = new Map<number, State>();
  let lastT: number | null = null;

  // The simulation runs in "distance flown" space (u grows, the leader has the largest u).
  // Output mirrors it (x = width - u) so the flock flies right-to-left and the message
  // reads left-to-right as it passes: the first glyph leads on the left.

  /** The migration path: a slow travelling wave with a personal lane per bird, so the stream
   *  thickens into a band like a murmuration instead of a single line. */
  const anchor = (b: { g: GlyphTime; lane: number; jitter: number }, t: number) => {
    const age = t - b.g.start;
    const u = -margin + age * speed;
    const wave = Math.sin(u * 0.006 + t * 0.7) * amp + Math.sin(u * 0.017 - t * 1.3) * amp * 0.25;
    const drift = Math.sin(t * 0.9 + b.jitter) * laneSpread * 0.2;
    return { x: u, y: midY + wave + b.lane + drift };
  };

  // leave when the anchor is past the right edge plus fade distance
  const exitAge = (width + margin * 2) / speed;

  function step(t: number): Bird[] {
    const dt = lastT === null ? 1 / 60 : clamp(t - lastT, 0, 0.1);
    lastT = t;

    for (const g of order) {
      const age = t - g.start;
      if (age >= 0 && age < exitAge + fadeOut && !birds.has(g.index)) {
        const seed = { g, lane: (rand() - 0.5) * laneSpread, jitter: rand() * Math.PI * 2 };
        const a = anchor(seed, t);
        birds.set(g.index, { ...seed, x: a.x, y: a.y, vx: speed, vy: 0 });
      }
      if (age >= exitAge + fadeOut) birds.delete(g.index);
    }

    const live = order.map((g) => birds.get(g.index)).filter((b): b is State => !!b);

    if (!opts.reducedMotion) {
      const R = 46; // neighbour radius
      for (const b of live) {
        let sepX = 0;
        let sepY = 0;
        let aliX = 0;
        let aliY = 0;
        let cohY = 0;
        let n = 0;
        for (const o of live) {
          if (o === b) continue;
          const dx = b.x - o.x;
          const dy = b.y - o.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > R * R || d2 === 0) continue;
          const d = Math.sqrt(d2);
          sepX += dx / d / d;
          sepY += dy / d / d;
          aliX += o.vx;
          aliY += o.vy;
          cohY += o.y;
          n++;
        }
        const a = anchor(b, t);
        let ax = (a.x - b.x) * 9 - (b.vx - speed) * 3.5; // spring to anchor: keeps order
        let ay = (a.y - b.y) * 4 - b.vy * 2.2;
        if (n > 0) {
          ax += sepX * 900 + (aliX / n - b.vx) * 0.6;
          ay += sepY * 900 + (aliY / n - b.vy) * 0.6 + (cohY / n - b.y) * 0.4;
        }
        // wingbeat flutter
        ay += Math.sin(t * 6 + b.jitter) * 22;
        b.vx += ax * dt;
        b.vy += ay * dt;
      }
      for (const b of live) {
        b.x += b.vx * dt;
        b.y = clamp(b.y + b.vy * dt, 12, height - 12);
      }
      // hard guarantee of reading order, however the forces play out
      const gap = 6;
      for (let i = 1; i < live.length; i++) {
        const ahead = live[i - 1] as State;
        const b = live[i] as State;
        if (b.x > ahead.x - gap) b.x = ahead.x - gap;
      }
    } else {
      for (const b of live) {
        b.x = anchor(b, t).x;
        b.y = midY;
      }
    }

    return live.map((b) => {
      const age = t - b.g.start;
      const leaving = age - exitAge;
      const alpha = smooth(age / fadeIn) * (1 - smooth(leaving / fadeOut));
      return {
        index: b.g.index,
        glyph: b.g.glyph,
        x: width - b.x,
        y: b.y,
        angle: opts.reducedMotion ? 0 : clamp(-Math.atan2(b.vy, Math.max(1, b.vx)), -0.5, 0.5),
        alpha: clamp(alpha, 0, 1),
        scale: 0.6 + 0.4 * smooth(age / fadeIn),
      };
    });
  }

  return {
    step,
    get duration() {
      const lastStart = order.at(-1)?.start ?? 0;
      return lastStart + exitAge + fadeOut;
    },
  };
}
