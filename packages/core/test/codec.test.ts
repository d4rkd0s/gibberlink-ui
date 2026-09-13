import { describe, expect, it } from "vitest";
import {
  createDecoder,
  EmptyPayloadError,
  encode,
  MAX_PAYLOAD_BYTES,
  PayloadTooLargeError,
  PROTOCOLS,
  toPayload,
} from "../src/index.ts";

const utf8 = new TextDecoder();

async function roundTrip(
  bytes: Uint8Array,
  protocol: (typeof PROTOCOLS)[number]["id"],
  opts: { encodeRate?: number; decodeRate?: number; chunk?: () => number } = {},
) {
  const encodeRate = opts.encodeRate ?? 48000;
  const decodeRate = opts.decodeRate ?? encodeRate;
  const chunk = opts.chunk ?? (() => 1024);
  const wave = await encode(bytes, { protocol, sampleRate: encodeRate });
  const decoder = await createDecoder({ sampleRate: decodeRate });
  const messages: Uint8Array[] = [];
  try {
    for (let i = 0; i < wave.samples.length; ) {
      const n = chunk();
      messages.push(...decoder.push(wave.samples.subarray(i, i + n)));
      i += n;
    }
    // trailing silence lets the end marker register
    messages.push(...decoder.push(new Float32Array(decodeRate)));
  } finally {
    decoder.dispose();
  }
  return { wave, messages };
}

describe("payload", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(toPayload("ᚠ").length).toBe(3);
    expect(toPayload("a").length).toBe(1);
  });

  it(`accepts ${MAX_PAYLOAD_BYTES} bytes and rejects ${MAX_PAYLOAD_BYTES + 1}`, () => {
    expect(toPayload("x".repeat(MAX_PAYLOAD_BYTES)).length).toBe(140);
    expect(() => toPayload("x".repeat(MAX_PAYLOAD_BYTES + 1))).toThrow(PayloadTooLargeError);
    expect(() => toPayload("ᚠ".repeat(47))).toThrow(PayloadTooLargeError);
    expect(toPayload("ᚠ".repeat(46)).length).toBe(138);
  });

  it("rejects empty payloads", () => {
    expect(() => toPayload("")).toThrow(EmptyPayloadError);
  });
});

describe("codec round-trip", () => {
  for (const p of PROTOCOLS) {
    it(`${p.id} decodes exactly`, async () => {
      const bytes = toPayload("hello gibberlink ᚦᛁᛜ");
      const { messages } = await roundTrip(bytes, p.id);
      expect(messages).toHaveLength(1);
      expect(utf8.decode(messages[0])).toBe("hello gibberlink ᚦᛁᛜ");
    });
  }

  it("decodes a max-length payload", async () => {
    const text = `${"ᚠ".repeat(46)}ab`;
    const { messages } = await roundTrip(toPayload(text), "audible-fastest");
    expect(utf8.decode(messages[0])).toBe(text);
  });

  it("is chunk-size agnostic", async () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return 128 + (seed % (4096 - 128));
    };
    const { messages } = await roundTrip(toPayload("chunky"), "audible-fast", { chunk: rand });
    expect(messages.map((m) => utf8.decode(m))).toEqual(["chunky"]);
  });

  it("decodes when capture rate differs from the source rate", async () => {
    const pairs: [number, number][] = [
      [44100, 48000],
      [48000, 44100],
    ];
    for (const [encodeRate, decodeRate] of pairs) {
      const { wave } = await roundTrip(toPayload("rate"), "audible-fast", { encodeRate });
      // simulate a device capturing at decodeRate: linear resample
      const ratio = decodeRate / encodeRate;
      const out = new Float32Array(Math.floor(wave.samples.length * ratio));
      for (let i = 0; i < out.length; i++) {
        const x = i / ratio;
        const i0 = Math.floor(x);
        const f = x - i0;
        out[i] = (wave.samples[i0] ?? 0) * (1 - f) + (wave.samples[i0 + 1] ?? 0) * f;
      }
      const decoder = await createDecoder({ sampleRate: decodeRate });
      const got = [...decoder.push(out), ...decoder.push(new Float32Array(decodeRate))];
      decoder.dispose();
      expect(got.map((m) => utf8.decode(m))).toEqual(["rate"]);
    }
  });

  it("survives white noise at -20 dB relative to signal peak", async () => {
    const wave = await encode(toPayload("noisy"), { protocol: "audible-normal", volume: 50 });
    let seed = 42;
    const noisy = wave.samples.map((s) => {
      seed = (seed * 16807) % 2147483647;
      return s + ((seed / 2147483647) * 2 - 1) * 0.05;
    });
    const decoder = await createDecoder({ sampleRate: wave.sampleRate });
    const got = [...decoder.push(noisy), ...decoder.push(new Float32Array(48000))];
    decoder.dispose();
    expect(got.map((m) => utf8.decode(m))).toEqual(["noisy"]);
  });
});

describe("timeline", () => {
  it("framing model predicts the exact audio length", async () => {
    for (const p of PROTOCOLS) {
      for (const len of [1, 5, 46, 140]) {
        const wave = await encode(new Uint8Array(len).fill(65), { protocol: p.id });
        const ecc = len < 4 ? 2 : Math.max(4, 2 * Math.floor(len / 5));
        const dataFrames = p.extra * Math.ceil((3 + len + ecc) / p.bytesPerTx) * p.framesPerTx;
        expect(wave.samples.length, `${p.id} len ${len}`).toBe((16 + dataFrames + 16) * 1024);
      }
    }
  });

  it("places every payload byte inside the audio, in order", async () => {
    const bytes = toPayload("ᚠᚢᚦ abc");
    const wave = await encode(bytes, { protocol: "audible-fast" });
    const duration = wave.samples.length / wave.sampleRate;
    expect(wave.byteTimes).toHaveLength(bytes.length);
    let last = -1;
    for (const t of wave.byteTimes) {
      expect(t.start).toBeGreaterThan(0);
      expect(t.end).toBeLessThan(duration);
      expect(t.end).toBeGreaterThan(t.start);
      expect(t.start).toBeGreaterThanOrEqual(last);
      last = t.start;
    }
  });
});
