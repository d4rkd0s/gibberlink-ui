/// <reference lib="webworker" />
import { createDecoder, type Decoder } from "@gibberlink/core";

export type ToWorker =
  | { type: "init"; sampleRate: number }
  | { type: "push"; samples: Float32Array }
  | { type: "flush" };
export type FromWorker = { type: "ready" } | { type: "message"; bytes: Uint8Array } | { type: "error"; error: string };

let decoder: Decoder | null = null;
let sampleRate = 48000;
const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  try {
    const msg = e.data;
    if (msg.type === "init") {
      decoder?.dispose();
      sampleRate = msg.sampleRate;
      decoder = await createDecoder({ sampleRate });
      post({ type: "ready" });
      return;
    }
    if (!decoder) return;
    const samples = msg.type === "push" ? msg.samples : new Float32Array(sampleRate);
    for (const bytes of decoder.push(samples)) post({ type: "message", bytes });
  } catch (err) {
    post({ type: "error", error: String(err) });
  }
};
