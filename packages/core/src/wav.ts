/** Mono 16-bit PCM WAV. */
export function writeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const data = samples.length * 2;
  const buf = new Uint8Array(44 + data);
  const v = new DataView(buf.buffer);
  const tag = (o: number, s: string) => {
    for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  tag(0, "RIFF");
  v.setUint32(4, 36 + data, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, data, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

export interface ParsedWav {
  samples: Float32Array;
  sampleRate: number;
}

/** Parses PCM 8/16/24/32-bit and IEEE float 32/64 WAV; downmixes to mono. */
export function parseWav(input: Uint8Array | ArrayBuffer): ParsedWav {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o] ?? 0, buf[o + 1] ?? 0, buf[o + 2] ?? 0, buf[o + 3] ?? 0);
  if (buf.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file");

  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = tag(off);
    const size = v.getUint32(off + 4, true);
    const body = off + 8;
    if (id === "fmt ") {
      format = v.getUint16(body, true);
      channels = v.getUint16(body + 2, true);
      sampleRate = v.getUint32(body + 4, true);
      bits = v.getUint16(body + 14, true);
      if (format === 0xfffe && size >= 26) format = v.getUint16(body + 24, true); // WAVE_FORMAT_EXTENSIBLE
    } else if (id === "data") {
      if (!channels) throw new Error("Not a WAV file: data before fmt");
      const bytesPer = bits / 8;
      const end = Math.min(buf.length, body + size);
      const frames = Math.floor((end - body) / (bytesPer * channels));
      const samples = new Float32Array(frames);
      const read = readerFor(format, bits, v);
      for (let f = 0; f < frames; f++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += read(body + (f * channels + c) * bytesPer);
        samples[f] = sum / channels;
      }
      return { samples, sampleRate };
    }
    off = body + size + (size % 2);
  }
  throw new Error("Not a WAV file: no data chunk");
}

function readerFor(format: number, bits: number, v: DataView): (o: number) => number {
  if (format === 3 && bits === 32) return (o) => v.getFloat32(o, true);
  if (format === 3 && bits === 64) return (o) => v.getFloat64(o, true);
  if (format === 1 && bits === 8) return (o) => (v.getUint8(o) - 128) / 128;
  if (format === 1 && bits === 16) return (o) => v.getInt16(o, true) / 0x8000;
  if (format === 1 && bits === 24)
    return (o) => ((v.getUint8(o + 2) << 24) | (v.getUint8(o + 1) << 16) | (v.getUint8(o) << 8)) / 0x80000000;
  if (format === 1 && bits === 32) return (o) => v.getInt32(o, true) / 0x80000000;
  throw new Error(`Unsupported WAV encoding (format ${format}, ${bits}-bit)`);
}
