import { describe, expect, it } from "vitest";
import { createDecoder, encode, parseWav, toPayload, writeWav } from "../src/index.ts";

describe("wav", () => {
  it("writes a valid RIFF PCM16 mono header", () => {
    const buf = writeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), 48000);
    const v = new DataView(buf.buffer);
    const tag = (o: number) => String.fromCharCode(...buf.subarray(o, o + 4));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(tag(12)).toBe("fmt ");
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(tag(36)).toBe("data");
    expect(v.getUint32(40, true)).toBe(10);
    expect(buf.length).toBe(54);
  });

  it("round-trips samples within PCM16 precision", () => {
    const src = new Float32Array([0, 0.25, -0.25, 0.999, -1]);
    const { samples, sampleRate } = parseWav(writeWav(src, 44100));
    expect(sampleRate).toBe(44100);
    for (const [i, s] of src.entries()) expect(samples[i]).toBeCloseTo(s, 3);
  });

  it("parses float32 and stereo files (downmix)", () => {
    const frames = 3;
    const buf = new Uint8Array(44 + frames * 2 * 4);
    const v = new DataView(buf.buffer);
    const put = (o: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    put(0, "RIFF");
    v.setUint32(4, buf.length - 8, true);
    put(8, "WAVE");
    put(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 3, true); // IEEE float
    v.setUint16(22, 2, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 8000 * 8, true);
    v.setUint16(32, 8, true);
    v.setUint16(34, 32, true);
    put(36, "data");
    v.setUint32(40, frames * 8, true);
    for (const [i, s] of [0.2, 0.4, -1, 1, 0.5, 0.5].entries()) v.setFloat32(44 + i * 4, s, true);
    const { samples, sampleRate } = parseWav(buf);
    expect(sampleRate).toBe(8000);
    expect([...samples].map((s) => +s.toFixed(3))).toEqual([0.3, 0, 0.5]);
  });

  it("rejects non-WAV input", () => {
    expect(() => parseWav(new Uint8Array(64))).toThrow(/not a WAV/i);
  });

  it("an encoded message survives write → parse → decode", async () => {
    const wave = await encode(toPayload("wav trip"), { protocol: "audible-fast" });
    const { samples, sampleRate } = parseWav(writeWav(wave.samples, wave.sampleRate));
    const d = await createDecoder({ sampleRate });
    const got = [...d.push(samples), ...d.push(new Float32Array(sampleRate))];
    d.dispose();
    expect(got.map((m) => new TextDecoder().decode(m))).toEqual(["wav trip"]);
  });
});
