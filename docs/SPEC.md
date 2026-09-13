# GibberLink UI v2 — Spec

_Status: DRAFT, 2026-09-13. Written before any v2 code (spec → design → tests → code)._
_Absorbs `d4rkd0s/gibber-to-runic` (private, empty repo; only artifact was its description "Convert runes to gibberlink audio")._

## 1. What it is

A small tool that converts between three forms of a message, in any direction:

```
        text  ⇄  runes
          ⇅  ⤡⤢  ⇅
       GibberLink audio (ggwave)
```

Runs entirely in the browser (plus a CLI). No server, no account, no network after load.

## 2. Why rebuild

v0 (Sep 2025, moves to `legacy/`) proved the idea: Tkinter → Python wrapper → Rust CLI → ggwave C++.
Problems found on review:
- Needs Python + Tkinter + Cargo; Windows-first; no tests, no releases, no license.
- Decodes WAV files only; no live mic, which is the thing people actually want.
- Git submodules (`ggwave`, `gibberlink-translator`) declared but empty; the second one is an unrelated app and was never used.
- Python decode used `ggwave` from PyPI while encode used vendored C++: two codec builds that can drift.
- Nobody noticed the npm `ggwave` package is frozen at 0.4.0 (2022) while upstream is 0.4.3 with Emscripten fixes. v2 must not repeat that.

## 3. Users & jobs

| User | Job |
|---|---|
| Curious viewer of the GibberLink demo | "What are those beeps saying?" → live mic decode |
| Rune / fantasy / tabletop fan | Type a name, see it in runes, play it as sound; hear a sound, see runes |
| Tinkerer / maker | Generate payload WAV, play to a device, test reception |
| Developer | Script it → CLI + importable `core` |
| Educator | Show data-over-sound visually (spectrogram) |

## 4. Scope

### Will do (v1.0)
- **Encode**: text or runes → audio. Protocol + volume, Play, Download WAV, live UTF-8 byte counter.
- **Decode file**: drag/drop or pick WAV/MP3/OGG/WebM/M4A → text (browser `decodeAudioData` + resample).
- **Decode live**: mic → rolling decode into a timestamped transcript; level meter.
- **Runic**: text ⇄ runes transliteration with selectable rune set; decoded payloads can be shown as text, runes, or both.
- **Visuals**: live spectrogram for playback and mic.
- **Transcript**: copy, clear, export `.txt` / `.json`.
- **Offline PWA**, static deploy to GitHub Pages.
- **CLI**: `gibberlink encode | decode | runes`.
- Accessible: keyboard-complete, `aria-live` announcements for decoded messages, WCAG 2.2 AA. Runes always have a Latin reading available to screen readers.

### Will not do (v1.0)
- No backend, telemetry, analytics, accounts.
- No encryption; document that payloads are plaintext anyone can decode.
- No custom audio framing; ggwave protocols only, so we interoperate with real GibberLink.
- No multi-message chunking for long text (Later).
- No native desktop builds (PWA installs on desktop).

## 5. Runic design

Runes are Unicode (Runic block U+16A0–U+16FF). Transliteration is a **pure, table-driven** module per rune set.

| Rune set | v1.0 | Notes |
|---|---|---|
| Elder Futhark (24) | Default | Best known; `th`→ᚦ, `ng`→ᛜ digraphs |
| Younger Futhark (16) | Yes | Many-to-one; heavy loss on reverse |
| Anglo-Saxon Futhorc | Yes | Adds ᚪ ᚫ ᚣ ᛠ etc. |
| Tolkien Cirth / Dwarvish | Later | Not in Unicode; would need a font. Ask Logan before adding |

Rules:
- **text → runes** is deterministic: greedy longest-match digraphs, case-folded, spaces → `᛫` (U+16EB) or kept as space (option), unmapped chars (digits, punctuation) pass through unchanged.
- **runes → text** is *best effort* and labeled as such in UI: each rune maps to its canonical Latin reading (ᚲ → `k`, never recovers `c`/`q`).
- Round-trip guarantee is only runes → text → runes (stable), not text → runes → text.
- **Payload budget**: runic code points are 3 UTF-8 bytes, so a 140-byte ggwave payload holds ~46 runes. UI shows the budget in both bytes and runes.
- **Wire format choice** (per message, user toggle, default = Runes on the wire):
  - *Runes on the wire*: send runic UTF-8. Any ggwave receiver shows true runes. 46-rune limit.
  - *Latin on the wire*: send transliterated Latin, render as runes locally. 140-char limit, but other receivers see Latin.
- Decoder auto-detects: if payload contains Runic-block code points, show runes primary + Latin reading; else text primary + optional rune view.

## 6. Domain model

```
Protocol       { id, family: audible|ultrasound|dt|mt, speed: normal|fast|fastest }
Payload        { bytes: Uint8Array }                 // invariant 1..140 bytes
RuneSet        { id, name, toRunes(text), toLatin(runes), table }
Message        { text?, runes?, runeSet?, wire: 'runes'|'latin'|'text' } -> Payload
Waveform       { samples: Float32Array, sampleRate }
DecodedMessage { payload, text, runes?, protocol?, at, source: 'file'|'mic' }
Decoder        stateful: push(Float32Array) -> DecodedMessage[]; chunk-size agnostic
```

Packages (npm workspaces, one codec build shared by all):
- `ggwave-wasm` — our reproducible Emscripten build of upstream ggwave at a pinned tag, typed ESM wrapper, checksum-verified.
- `core` — pure TS: `encode`, `createDecoder`, `wav.write/parse`, `resample`, `runes/*`. No DOM; runs in browser, Node, Bun, Deno.
- `web` — Svelte app: panels, Web Audio I/O, spectrogram, PWA.
- `cli` — Node wrapper over `core`.

## 7. Library selection (re-evaluated 2026-09-13, versions verified on npm)

| Concern | Pick | Rejected / why |
|---|---|---|
| Codec | **Self-built ggwave WASM** from `ggerganov/ggwave` pinned tag (0.4.3+), `emsdk` in CI, `-sMODULARIZE -sEXPORT_ES6 -sSINGLE_FILE=0` | npm `ggwave@0.4.0`: stale since 2022, no types, bundles old Emscripten runtime. Kept only as an interop test oracle |
| Language | **TypeScript 7** (native compiler), strict | TS 5.x slower; 7 is stable at 7.0.x |
| Build / dev | **Vite 8** (Rolldown) | Webpack/Parcel: heavier, no benefit |
| UI | **Svelte 5** (runes reactivity, compiles away, built-in a11y warnings) | React: bundle + ceremony for a 3-panel app. Vanilla: state (mic, transcript, settings) gets messy fast. Preact: fine, but Svelte's a11y lint and transitions fit better |
| Styling | Plain CSS with custom properties, light/dark via `prefers-color-scheme` | Tailwind: unnecessary for ~5 components |
| Mic capture | **AudioWorklet** → `MessagePort` → decode in a **Web Worker** | ScriptProcessorNode: deprecated |
| File decode | Browser `decodeAudioData` + `OfflineAudioContext` resample | ffmpeg.wasm: 30 MB, overkill |
| Spectrogram | Own `AnalyserNode` → `<canvas>` (~100 lines) | wavesurfer.js: large, file-centric |
| WAV I/O | Own tiny RIFF PCM16/Float32 writer + parser in `core` (tested) | `wavefile`: fine but 11.x is heavy for our need |
| PWA | **vite-plugin-pwa 1.x** (Workbox) | Hand-rolled SW: easy to get caching wrong |
| CLI args | Node built-in **`util.parseArgs`** | commander/citty: zero-dep is nicer for a tiny CLI |
| Library bundling | **tsdown** for `core` + `cli` (ESM + d.ts) | tsup: in maintenance mode |
| Lint + format | **Biome 2** | ESLint + Prettier: two tools, slower, more config |
| Unit tests | **Vitest 5** | Jest: ESM/WASM friction |
| E2E | **Playwright 1.63** + `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture` | Cypress: no fake-mic support |
| A11y | **@axe-core/playwright** | |
| Runtime | Node ≥ 22 LTS for CLI/dev | |
| CI / hosting | GitHub Actions → GitHub Pages; Renovate for deps | Dependabot also fine |

## 8. Acceptance tests (write these first)

Codec
1. Round-trip: every protocol, `decode(encode("hello gibberlink"))` returns exact bytes.
2. Byte limit: 140-byte payload encodes; 141 rejected with typed error; multibyte chars counted as bytes.
3. WAV: `wav.write` output is valid RIFF and decodes back to the same payload.
4. Resample: 44.1 kHz input decodes in a 48 kHz pipeline and vice versa.
5. Noise: payload + white noise at a measured SNR still decodes.
6. Streaming: waveform pushed in random 128–4096-sample chunks yields exactly one message.
7. Interop: our WASM decodes audio from npm `ggwave@0.4.0` and vice versa; fixture WAV from upstream GibberLink decodes to known text.

Runic
8. Elder Futhark table: `"thing"` → `ᚦᛁᛜ`; space handling option; digits/punctuation pass through.
9. Stability: for every rune set and 1000 random rune strings, `toRunes(toLatin(r)) === r`.
10. Budget: 46 Elder Futhark runes fit, 47 rejected (3 bytes each, 140 max).
11. Detection: decoded payload containing U+16A0–U+16FF is flagged runic.
12. Audio: `decode(encode(toRunes("odin")))` → runes displayed + Latin reading `odin`.

App / CLI
13. E2E fake mic playing fixture WAV → transcript shows text; runic fixture → runes shown.
14. CLI: `gibberlink encode -t hi -o hi.wav && gibberlink decode hi.wav` prints `hi`; `gibberlink runes "thing"` prints `ᚦᛁᛜ`.
15. axe: zero serious/critical violations; runes have accessible Latin labels.

## 9. Open questions

Verify (Claude, M0):
- Upstream GibberLink default protocol (believed audible fast; read PennyroyalTea/gibberlink source).
- ggwave decode chunk alignment requirement (`samplesPerFrame`).
- iOS Safari AudioWorklet mic reliability at 48 kHz.
- Upstream ggwave release tagging: latest tag list shows only `waver-v*`; confirm the 0.4.3 commit to pin.

Decide (Logan, creative):
- Rune sets for v1.0 (proposed: Elder, Younger, Futhorc) and whether Cirth is wanted.
- Word separator default: `᛫` vs space.
- Default wire format for runic messages (proposed: runes on the wire).
- Visibility of this repo (already public; see STATUS).
