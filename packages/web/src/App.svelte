<script lang="ts">
  import {
    byteTimeline,
    DEFAULT_PROTOCOL,
    encode,
    glyphTimeline,
    isRunic,
    lexicon,
    MAX_PAYLOAD_BYTES,
    PROTOCOLS,
    type ProtocolId,
    payloadBytes,
    RUNE_SEPARATORS,
    type RuneSeparator,
    type RuneSetId,
    toLatin,
    toRunes,
    writeWav,
  } from "@gibberlink/core";
  import { onDestroy } from "svelte";
  import { decodeFile, type MicCapture, type Playback, play, startMic } from "./lib/audio.ts";
  import FlockCanvas, { type Flight } from "./lib/FlockCanvas.svelte";
  import { createListener, type Listener } from "./lib/listener.ts";
  import RuneKeyboard from "./lib/RuneKeyboard.svelte";
  import RuneText from "./lib/RuneText.svelte";

  // ---- compose -------------------------------------------------------------
  let message = $state("");
  let set = $state<RuneSetId>("elder");
  let separator = $state<RuneSeparator>("᛫");
  let wire = $state<"runes" | "text">("runes");
  let protocol = $state<ProtocolId>(DEFAULT_PROTOCOL);
  let volume = $state(50);
  let showKeyboard = $state(false);
  let textarea: HTMLTextAreaElement;

  const payload = $derived(wire === "runes" ? toRunes(message, { set, separator }) : message.normalize("NFC").trim());
  const bytes = $derived(payload ? payloadBytes(payload) : 0);
  const over = $derived(bytes > MAX_PAYLOAD_BYTES);
  const runesLeft = $derived(Math.max(0, Math.floor((MAX_PAYLOAD_BYTES - bytes) / 3)));
  const currentSet = $derived(lexicon.sets.find((s) => s.id === set));

  let flight = $state<Flight | null>(null);
  let playing = $state<Playback | null>(null);
  let status = $state("");
  let flightId = 1;

  function insertGlyph(glyph: string) {
    const start = textarea.selectionStart ?? message.length;
    const end = textarea.selectionEnd ?? message.length;
    message = message.slice(0, start) + glyph + message.slice(end);
    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(start + glyph.length, start + glyph.length);
    });
  }

  /** What a bird carries: the rune form of each transmitted character. */
  function runeFace(ch: string): string {
    if (isRunic(ch) || !/\p{L}/u.test(ch)) return ch;
    return toRunes(ch, { set, separator: "" }) || ch;
  }

  async function transmit() {
    if (!payload || over) return;
    try {
      playing?.stop();
      const wave = await encode(payload, { protocol, volume });
      const p = play(wave.samples, wave.sampleRate);
      playing = p;
      flight = { glyphs: glyphTimeline(payload, wave.byteTimes), clock: p.elapsed, display: runeFace, id: flightId++ };
      status = `Transmitting ${bytes} bytes`;
      await p.done;
      if (playing === p) {
        playing = null;
        status = "Sent";
      }
    } catch (err) {
      status = `Couldn't transmit: ${(err as Error).message}`;
    }
  }

  async function downloadWav() {
    if (!payload || over) return;
    const wave = await encode(payload, { protocol, volume });
    const blob = new Blob([writeWav(wave.samples, wave.sampleRate) as Uint8Array<ArrayBuffer>], { type: "audio/wav" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gibberlink-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  // ---- listen --------------------------------------------------------------
  interface Heard {
    id: number;
    at: Date;
    source: "mic" | "file";
    text: string;
    runic: boolean;
  }
  let heard = $state<Heard[]>([]);
  let mic = $state<MicCapture | null>(null);
  let micListener: Listener | null = null;
  let decodingFile = $state(false);
  let dragging = $state(false);
  let announce = $state("");
  let heardId = 1;

  const utf8 = new TextDecoder("utf-8", { fatal: false });

  function receive(raw: Uint8Array, source: Heard["source"]) {
    const text = utf8.decode(raw);
    const runic = isRunic(text);
    heard = [{ id: heardId++, at: new Date(), source, text, runic }, ...heard];
    announce = runic ? `Heard runes: ${toLatin(text, { set })}` : `Heard: ${text}`;
    // replay the message as a flight so received runes migrate across the sky too
    const t0 = performance.now();
    flight = {
      glyphs: glyphTimeline(text, byteTimeline(raw.length, protocol)),
      clock: () => (performance.now() - t0) / 1000,
      display: runeFace,
      id: flightId++,
    };
  }

  async function toggleMic() {
    if (mic) {
      mic.stop();
      micListener?.dispose();
      mic = null;
      micListener = null;
      status = "Microphone off";
      return;
    }
    try {
      let listener: Listener | null = null;
      const pending: Float32Array[] = [];
      const capture = await startMic((chunk) => (listener ? listener.push(chunk) : pending.push(chunk)));
      listener = await createListener(capture.sampleRate, (b) => receive(b, "mic"));
      for (const c of pending) listener.push(c);
      micListener = listener;
      mic = capture;
      status = "Listening";
    } catch (err) {
      status = `Microphone unavailable: ${(err as Error).message}`;
    }
  }

  async function decodeBlob(file: File) {
    decodingFile = true;
    status = `Decoding ${file.name}`;
    try {
      const { samples, sampleRate } = await decodeFile(file);
      const before = heard.length;
      const listener = await createListener(sampleRate, (b) => receive(b, "file"));
      listener.push(samples);
      listener.flush();
      await new Promise((r) => setTimeout(r, 400));
      listener.dispose();
      status = heard.length > before ? `Decoded ${file.name}` : `No GibberLink message found in ${file.name}`;
    } catch (err) {
      status = `Couldn't read ${file.name}: ${(err as Error).message}`;
    } finally {
      decodingFile = false;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) void decodeBlob(file);
  }

  function exportTranscript(kind: "txt" | "json") {
    const rows = [...heard].reverse();
    const body =
      kind === "json"
        ? JSON.stringify(
            rows.map((h) => ({ at: h.at.toISOString(), source: h.source, text: h.text, runic: h.runic })),
            null,
            2,
          )
        : rows
            .map((h) => `[${h.at.toISOString()}] ${h.text}${h.runic ? `  (${toLatin(h.text, { set })})` : ""}`)
            .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/plain" }));
    a.download = `gibberlink-transcript.${kind}`;
    a.click();
  }

  onDestroy(() => {
    mic?.stop();
    micListener?.dispose();
    playing?.stop();
  });
</script>

<header>
  <h1><span class="mark" aria-hidden="true">ᚷ</span> GibberLink UI</h1>
  <p class="tagline">Text and runes to GibberLink sound, and back. Everything stays in your browser.</p>
</header>

<main>
  <FlockCanvas {flight} label="Runes fly here while a message plays" />

  <p class="status" role="status" aria-live="polite">{status}</p>
  <p class="sr-only" aria-live="assertive">{announce}</p>

  <div class="grid">
    <section class="card" aria-labelledby="compose-h">
      <h2 id="compose-h">Compose</h2>

      <label class="field">
        <span>Message</span>
        <textarea
          bind:this={textarea}
          bind:value={message}
          rows="3"
          placeholder="Type text, or tap runes below"
          spellcheck="false"
        ></textarea>
      </label>

      <div class="row">
        <label class="field">
          <span>Send as</span>
          <select bind:value={wire}>
            <option value="runes">Runes</option>
            <option value="text">Text as typed</option>
          </select>
        </label>
        <label class="field">
          <span>Rune set</span>
          <select bind:value={set}>
            {#each lexicon.sets as s (s.id)}
              <option value={s.id}>{s.name}{s.historical ? "" : " (modern)"}</option>
            {/each}
          </select>
        </label>
        <label class="field">
          <span>Word separator</span>
          <select bind:value={separator}>
            {#each RUNE_SEPARATORS as sep (sep)}
              <option value={sep}>{sep === " " ? "space" : sep === "" ? "none (Elder style)" : sep}</option>
            {/each}
          </select>
        </label>
      </div>

      {#if currentSet}
        <p class="note">{currentSet.note}</p>
      {/if}

      <div class="preview" aria-live="polite">
        {#if payload}
          {#if isRunic(payload)}
            <RuneText text={payload} {set} size={1.8} />
            <p class="reading">Read as: {toLatin(payload, { set })}</p>
          {:else}
            <p class="plain-preview">{payload}</p>
          {/if}
        {:else}
          <p class="muted">Your runes appear here.</p>
        {/if}
      </div>

      <div class="budget" class:over>
        <meter min="0" max={MAX_PAYLOAD_BYTES} value={bytes} high={MAX_PAYLOAD_BYTES * 0.9} aria-label="Message size"></meter>
        <span>{bytes} / {MAX_PAYLOAD_BYTES} bytes{#if !over && wire === "runes"} · room for {runesLeft} more runes{/if}</span>
        {#if over}<strong>Too long for one GibberLink message</strong>{/if}
      </div>

      <details bind:open={showKeyboard}>
        <summary>Rune keyboard</summary>
        {#if showKeyboard}
          <RuneKeyboard {set} oninsert={insertGlyph} />
        {/if}
      </details>

      <div class="row">
        <label class="field">
          <span>Protocol</span>
          <select bind:value={protocol}>
            {#each PROTOCOLS as p (p.id)}
              <option value={p.id}>{p.label}</option>
            {/each}
          </select>
        </label>
        <label class="field">
          <span>Volume {volume}</span>
          <input type="range" min="1" max="100" bind:value={volume} />
        </label>
      </div>

      <div class="actions">
        <button class="primary" onclick={transmit} disabled={!payload || over}>Transmit</button>
        <button onclick={downloadWav} disabled={!payload || over}>Download WAV</button>
      </div>
    </section>

    <section class="card" aria-labelledby="listen-h">
      <h2 id="listen-h">Listen</h2>

      <div class="actions">
        <button class:live={mic} aria-pressed={!!mic} onclick={toggleMic}>
          {mic ? "Stop listening" : "Listen with microphone"}
        </button>
      </div>

      <label
        class="drop"
        class:dragging
        ondragover={(e) => {
          e.preventDefault();
          dragging = true;
        }}
        ondragleave={() => (dragging = false)}
        ondrop={onDrop}
      >
        <input
          type="file"
          accept="audio/*,.wav"
          onchange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void decodeBlob(f);
            e.currentTarget.value = "";
          }}
        />
        <span>{decodingFile ? "Decoding…" : "Drop an audio file here or choose one"}</span>
      </label>

      <div class="transcript-head">
        <h3>Transcript</h3>
        <div class="actions small">
          <button onclick={() => exportTranscript("txt")} disabled={!heard.length}>Export .txt</button>
          <button onclick={() => exportTranscript("json")} disabled={!heard.length}>Export .json</button>
          <button onclick={() => (heard = [])} disabled={!heard.length}>Clear</button>
        </div>
      </div>

      {#if heard.length === 0}
        <p class="muted">Nothing heard yet. Play a GibberLink message near the mic, or open a recording.</p>
      {:else}
        <ol class="transcript" data-testid="transcript">
          {#each heard as h (h.id)}
            <li>
              <div class="meta">
                <time datetime={h.at.toISOString()}>{h.at.toLocaleTimeString()}</time>
                <span>{h.source}</span>
                <button class="link" onclick={() => navigator.clipboard.writeText(h.text)}>Copy</button>
              </div>
              {#if h.runic}
                <RuneText text={h.text} {set} size={1.6} />
                <p class="reading">Read as: {toLatin(h.text, { set })}</p>
              {:else}
                <p class="heard-text">{h.text}</p>
                <RuneText text={toRunes(h.text, { set, separator })} {set} size={1.1} />
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    </section>
  </div>
</main>

<footer>
  <p>
    MIT licensed. Sound by <a href="https://github.com/ggerganov/ggwave">ggwave</a>. Rune outlines from Noto Sans Runic (OFL).
    Runes from Latin letters follow a modern convention; see the lexicon for sources.
  </p>
</footer>
