import type { FromWorker, ToWorker } from "./decoder.worker.ts";

export interface Listener {
  push(samples: Float32Array): void;
  flush(): void;
  dispose(): void;
}

/** Runs the ggwave decoder off the main thread. */
export async function createListener(sampleRate: number, onMessage: (bytes: Uint8Array) => void): Promise<Listener> {
  const worker = new Worker(new URL("./decoder.worker.ts", import.meta.url), { type: "module" });
  const send = (m: ToWorker, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      if (e.data.type === "ready") resolve();
      else if (e.data.type === "error") reject(new Error(e.data.error));
    };
    send({ type: "init", sampleRate });
  });
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    if (e.data.type === "message") onMessage(e.data.bytes);
    else if (e.data.type === "error") console.error(e.data.error);
  };
  return {
    push: (samples) => send({ type: "push", samples }, [samples.buffer]),
    flush: () => send({ type: "flush" }),
    dispose: () => worker.terminate(),
  };
}
