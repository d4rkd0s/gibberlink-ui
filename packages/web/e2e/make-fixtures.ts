// Generates real GibberLink WAVs with @gibberlink/core for the E2E suite.
// Run with Node >= 23 (native type stripping): node e2e/make-fixtures.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encode, toPayload, toRunes, writeWav } from "../../core/src/index.ts";

const out = join(dirname(fileURLToPath(import.meta.url)), ".fixtures");
mkdirSync(out, { recursive: true });

async function fixture(name: string, text: string) {
  const wave = await encode(toPayload(text), { protocol: "audible-fast", volume: 60 });
  const pad = (s: number) => new Float32Array(Math.round(s * wave.sampleRate));
  const lead = pad(0.5);
  const tail = pad(1.5);
  const all = new Float32Array(lead.length + wave.samples.length + tail.length);
  all.set(wave.samples, lead.length);
  writeFileSync(join(out, name), writeWav(all, wave.sampleRate));
}

await fixture("runes.wav", toRunes("hail odin"));
await fixture("text.wav", "hello gibberlink");
console.log(`fixtures in ${out}`);
