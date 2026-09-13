let ctx: AudioContext | null = null;

/** One shared context, created on first user gesture. */
export function audioContext(): AudioContext {
  ctx ??= new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export interface Playback {
  /** Seconds since the waveform started, on the audio clock. */
  elapsed(): number;
  stop(): void;
  done: Promise<void>;
}

export function play(samples: Float32Array, sampleRate: number, analyser?: AnalyserNode): Playback {
  const ac = audioContext();
  const buffer = ac.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.connect(ac.destination);
  if (analyser) src.connect(analyser);
  const startAt = ac.currentTime + 0.05;
  src.start(startAt);
  const done = new Promise<void>((resolve) => {
    src.onended = () => resolve();
  });
  return {
    elapsed: () => ac.currentTime - startAt,
    stop: () => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    },
    done,
  };
}

/** Decode any browser-supported audio file to mono samples. */
export async function decodeFile(file: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const ac = audioContext();
  const audio = await ac.decodeAudioData(await file.arrayBuffer());
  const mono = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < ch.length; i++) mono[i] = (mono[i] ?? 0) + (ch[i] ?? 0) / audio.numberOfChannels;
  }
  return { samples: mono, sampleRate: audio.sampleRate };
}

export interface MicCapture {
  sampleRate: number;
  analyser: AnalyserNode;
  stop(): void;
}

export async function startMic(onChunk: (samples: Float32Array) => void): Promise<MicCapture> {
  const ac = audioContext();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });
  await ac.audioWorklet.addModule(new URL("./capture-worklet.js", document.baseURI).href);
  const source = ac.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ac, "capture", { numberOfInputs: 1, numberOfOutputs: 0 });
  node.port.onmessage = (e: MessageEvent<Float32Array>) => onChunk(e.data);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(node);
  source.connect(analyser);
  return {
    sampleRate: ac.sampleRate,
    analyser,
    stop() {
      source.disconnect();
      node.disconnect();
      node.port.close();
      for (const t of stream.getTracks()) t.stop();
    },
  };
}
