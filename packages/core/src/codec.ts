import { type GgwaveModule, loadGgwave } from "@gibberlink/ggwave-wasm";
import { toPayload } from "./payload.ts";
import {
  DEFAULT_PROTOCOL,
  ENCODED_DATA_OFFSET,
  getProtocol,
  MARKER_FRAMES,
  type ProtocolId,
  SAMPLES_PER_FRAME,
} from "./protocols.ts";

export interface EncodeOptions {
  protocol?: ProtocolId;
  /** 1..100 */
  volume?: number;
  /** Output sample rate; ggwave resamples internally. */
  sampleRate?: number;
}

/** When one payload byte is on air, in seconds from the start of `samples`. */
export interface ByteTime {
  start: number;
  end: number;
}

export interface Waveform {
  samples: Float32Array;
  sampleRate: number;
  protocol: ProtocolId;
  /** One entry per payload byte, in transmission order. */
  byteTimes: ByteTime[];
}

function f32Bytes(samples: Float32Array): Uint8Array {
  return new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
}

function params(g: GgwaveModule, sampleRate: number) {
  const p = g.getDefaultParameters();
  p.sampleFormatInp = g.SampleFormat.GGWAVE_SAMPLE_FORMAT_F32;
  p.sampleFormatOut = g.SampleFormat.GGWAVE_SAMPLE_FORMAT_F32;
  p.sampleRateInp = sampleRate;
  p.sampleRateOut = sampleRate;
  return p;
}

export async function encode(input: string | Uint8Array, opts: EncodeOptions = {}): Promise<Waveform> {
  const bytes = toPayload(input);
  const protocol = opts.protocol ?? DEFAULT_PROTOCOL;
  const sampleRate = opts.sampleRate ?? 48000;
  const volume = Math.min(100, Math.max(1, Math.round(opts.volume ?? 50)));

  const g = await loadGgwave();
  const inst = g.init(params(g, sampleRate));
  try {
    const protocolEnum = g.ProtocolId[getProtocol(protocol).key];
    if (!protocolEnum) throw new Error(`ggwave build lacks protocol ${protocol}`);
    const view = g.encode(inst, bytes, protocolEnum, volume);
    // view points into WASM memory: copy before anything else runs
    const raw = view.slice();
    const samples = new Float32Array(raw.buffer, 0, Math.floor(raw.byteLength / 4));
    return { samples, sampleRate, protocol, byteTimes: byteTimeline(bytes.length, protocol) };
  } finally {
    g.free(inst);
  }
}

/**
 * Transmission layout (ggwave.cpp encode): start marker, then encoded data
 * [3 length bytes][payload…][ECC…] sent `bytesPerTx` at a time over `framesPerTx` frames
 * (× `extra` for mono-tone), then end marker. Reed-Solomon here is systematic, so
 * payload bytes keep their order.
 */
export function byteTimeline(length: number, protocolId: ProtocolId): ByteTime[] {
  const p = getProtocol(protocolId);
  // ggwave works internally in 1024-sample frames at 48 kHz; output resampling doesn't change time
  const frameSec = SAMPLES_PER_FRAME / 48000;
  const chunkSec = p.extra * p.framesPerTx * frameSec;
  const out: ByteTime[] = [];
  for (let i = 0; i < length; i++) {
    const chunk = Math.floor((ENCODED_DATA_OFFSET + i) / p.bytesPerTx);
    const start = MARKER_FRAMES * frameSec + chunk * chunkSec;
    out.push({ start, end: start + chunkSec });
  }
  return out;
}

export interface Decoder {
  /** Feed mono float samples at the decoder's sample rate. Returns any completed payloads. */
  push(samples: Float32Array): Uint8Array[];
  dispose(): void;
}

export async function createDecoder({ sampleRate = 48000 }: { sampleRate?: number } = {}): Promise<Decoder> {
  const g = await loadGgwave();
  const inst = g.init(params(g, sampleRate));
  // ggwave consumes whole frames; keep leftovers so any chunk size works
  const frame = Math.ceil((SAMPLES_PER_FRAME * sampleRate) / 48000);
  let pending = new Float32Array(0);
  let disposed = false;

  return {
    push(samples) {
      if (disposed) throw new Error("Decoder disposed");
      const all = new Float32Array(pending.length + samples.length);
      all.set(pending);
      all.set(samples, pending.length);
      const usable = all.length - (all.length % frame);
      const found: Uint8Array[] = [];
      for (let i = 0; i < usable; i += frame) {
        const r = g.decode(inst, f32Bytes(all.subarray(i, i + frame)));
        if (r.length > 0) found.push(r.slice());
      }
      pending = all.slice(usable);
      return found;
    },
    dispose() {
      if (!disposed) g.free(inst);
      disposed = true;
    },
  };
}
