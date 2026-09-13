import { describe, expect, it } from "vitest";
import { createFlock, glyphTimeline } from "../src/index.ts";

const view = { width: 1000, height: 400 };

describe("glyphTimeline", () => {
  it("maps each code point to the on-air time of its first byte", () => {
    // "aᚠb": a=1 byte, ᚠ=3 bytes, b=1 byte
    const byteTimes = [0, 1, 2, 3, 4].map((i) => ({ start: i, end: i + 0.5 }));
    expect(glyphTimeline("aᚠb", byteTimes)).toEqual([
      { glyph: "a", index: 0, start: 0, end: 0.5 },
      { glyph: "ᚠ", index: 1, start: 1, end: 3.5 },
      { glyph: "b", index: 2, start: 4, end: 4.5 },
    ]);
  });

  it("rejects a timeline that doesn't match the text", () => {
    expect(() => glyphTimeline("ᚠ", [{ start: 0, end: 1 }])).toThrow();
  });
});

describe("flock", () => {
  const glyphs = Array.from({ length: 40 }, (_, i) => ({
    glyph: "ᚠ",
    index: i,
    start: 0.2 + i * 0.043,
    end: 0.2 + i * 0.043 + 0.128,
  }));

  function run(seconds: number, seed = 1) {
    const flock = createFlock(glyphs, { ...view, seed });
    const frames: ReturnType<typeof flock.step>[] = [];
    for (let t = 0; t <= seconds; t += 1 / 60) frames.push(flock.step(t));
    return frames;
  }

  it("spawns nothing before a glyph is on air", () => {
    const [first] = run(0);
    expect(first).toEqual([]);
  });

  it("birds enter at the right edge and fly left", () => {
    const flock = createFlock(glyphs, { ...view, seed: 3 });
    const [bird] = flock.step(glyphs[0]!.start + 0.01);
    expect(bird!.x).toBeGreaterThan(view.width);
    let frame = flock.step(glyphs[0]!.start + 0.01);
    for (let t = glyphs[0]!.start; t <= glyphs[0]!.start + 1; t += 1 / 60) frame = flock.step(t);
    const later = frame.find((b) => b.index === 0);
    expect(later!.x).toBeLessThan(bird!.x - 100);
  });

  it("keeps birds in reading order: earlier glyphs lead on the left", () => {
    for (const frame of run(6)) {
      const sorted = [...frame].sort((a, b) => a.index - b.index);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1]!.x, `frame bird ${sorted[i]!.index}`).toBeLessThan(sorted[i]!.x);
      }
    }
  });

  it("fades in and out with opacity in [0, 1]", () => {
    const frames = run(8);
    const seen = new Map<number, number[]>();
    for (const f of frames) for (const b of f) seen.set(b.index, [...(seen.get(b.index) ?? []), b.alpha]);
    for (const alphas of seen.values()) {
      for (const a of alphas) expect(a).toBeGreaterThanOrEqual(0);
      for (const a of alphas) expect(a).toBeLessThanOrEqual(1);
      expect(alphas[0]).toBeLessThan(0.2);
      expect(Math.max(...alphas)).toBeGreaterThan(0.9);
    }
  });

  it("every bird eventually leaves", () => {
    const frames = run(20);
    expect(frames.at(-1)).toEqual([]);
    const ever = new Set(frames.flat().map((b) => b.index));
    expect(ever.size).toBe(glyphs.length);
  });

  it("stays vertically on screen", () => {
    for (const f of run(8)) {
      for (const b of f) {
        expect(b.y).toBeGreaterThan(0);
        expect(b.y).toBeLessThan(view.height);
      }
    }
  });

  it("is deterministic for a seed and alive (not a straight line)", () => {
    const a = run(3, 5).at(-1)!;
    const b = run(3, 5).at(-1)!;
    expect(a).toEqual(b);
    const ys = new Set(a.map((bird) => Math.round(bird.y)));
    expect(ys.size).toBeGreaterThan(3);
  });

  it("reduced motion: no drift, ordered, still fades", () => {
    const flock = createFlock(glyphs, { ...view, seed: 1, reducedMotion: true });
    const f = flock.step(2);
    const sorted = [...f].sort((x, y) => x.index - y.index);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1]!.x).toBeLessThan(sorted[i]!.x);
    expect(new Set(f.map((b) => b.y)).size).toBe(1);
  });
});
