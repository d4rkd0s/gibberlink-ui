import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createDecoder, encode, toPayload } from "../src/index.ts";

// npm ggwave@0.4.0 (2022 build, the one most GibberLink web demos load) as an independent oracle.
const require = createRequire(import.meta.url);
const factory = require("ggwave") as () => Promise<any>;

async function oracle() {
  const g = await factory();
  g.disableLog?.();
  const p = g.getDefaultParameters();
  p.sampleFormatInp = g.SampleFormat.GGWAVE_SAMPLE_FORMAT_F32;
  p.sampleFormatOut = g.SampleFormat.GGWAVE_SAMPLE_FORMAT_F32;
  p.sampleRateInp = 48000;
  p.sampleRateOut = 48000;
  return { g, inst: g.init(p) };
}

describe("interop with npm ggwave@0.4.0", () => {
  it("oracle-encoded audio decodes with our build", async () => {
    const { g, inst } = await oracle();
    const text = "from the old build ᚠ";
    const view = g.encode(inst, text, g.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, 50);
    const raw = new Int8Array(view).slice();
    const samples = new Float32Array(raw.buffer, 0, raw.byteLength / 4);
    const d = await createDecoder();
    const got = [...d.push(samples), ...d.push(new Float32Array(48000))];
    d.dispose();
    expect(got.map((m) => new TextDecoder().decode(m))).toEqual([text]);
  });

  it("our audio decodes with the oracle", async () => {
    const { g, inst } = await oracle();
    const text = "from the new build ᛟ";
    const wave = await encode(toPayload(text), { protocol: "audible-fast" });
    const bytes = new Int8Array(wave.samples.buffer, wave.samples.byteOffset, wave.samples.byteLength);
    let got: string | null = null;
    for (let i = 0; i < bytes.length && !got; i += 4096) {
      const r = g.decode(inst, bytes.subarray(i, i + 4096));
      if (r && r.length > 0) got = new TextDecoder().decode(new Uint8Array(r));
    }
    expect(got).toBe(text);
  });
});
