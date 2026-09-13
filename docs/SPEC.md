# GibberLink UI v2 — Spec

_Status: ACTIVE, updated 2026-09-13. Decisions from Logan on 2026-09-13 are folded in (§10)._
_Absorbs `d4rkd0s/gibber-to-runic` (private, empty; its only artifact was the description "Convert runes to gibberlink audio")._

## 1. What it is

A small tool that converts a message between three forms, in any direction:

```
        text  ⇄  runes
          ⇅  ⤡⤢  ⇅
       GibberLink audio (ggwave)
```

It runs entirely in the browser (and later as a CLI). There is no server and no account, and nothing touches the network after the page loads.

## 2. Why rebuild

v0 (Sep 2025, now `legacy/`) was Tkinter → Python wrapper → Rust CLI → ggwave C++. Review found:
- It needed Python, Tkinter and Cargo, targeted Windows first, and had no tests, releases or license.
- It decoded WAV files only, with no live microphone.
- Both git submodules were empty, and one (`gibberlink-translator`) was an unrelated app.
- Encode used vendored C++ while decode used PyPI `ggwave`: two separate codec builds.
- npm `ggwave` has been frozen at 0.4.0 since 2022, while upstream is at 0.4.3.

## 3. Users & jobs

| User | Job |
|---|---|
| Curious viewer of the GibberLink demo | "What are those beeps saying?" → live mic decode |
| Rune / fantasy / history fan | Type a name, watch it fly as runes while it sounds; hear a sound, read runes |
| Tinkerer / maker | Generate a payload WAV and play it to a device |
| Developer | Script it with `@gibberlink/core` (and the CLI, M3) |
| Educator | Show data-over-sound, and runic history with sources |

## 4. Scope

### Will do (v1.0)
- **Compose:** text or runes (typed Latin or the on-screen rune keyboard) → audio.
  - Controls: protocol, volume, a byte budget shown in bytes and in runes, Play, Download WAV.
- **Flight:** while a message plays, its runes fly across a sky band like a flock of migrating birds.
  - They enter from the right and fly left. Each rune leaves at the moment its bytes are on air, fades in, and fades out as it leaves.
  - Order is guaranteed: the first rune always leads on the left, and a faint thread links the flock in order.
  - Reduced motion: runes glide in a straight line, still in order.
- **Listen:** mic (AudioWorklet → Web Worker decoder) and audio file drop.
  - The transcript shows runes with their Latin reading, or text with a rune view. Received messages replay as a flight.
  - Transcript actions: copy, clear, export `.txt` / `.json`.
- **Runes that always render:**
  - Canvas and inline rune display draw from embedded SVG outlines, so no font is needed.
  - Text inputs use a bundled WOFF2 subset of Noto Sans Runic (OFL). macOS and iOS ship no runic font.
- Offline PWA, static deploy to GitHub Pages.
- CLI `gibberlink encode | decode | runes` (M3).
- Accessible: keyboard-complete, `aria-live` announcements, rune images labelled with their Latin reading, zero axe serious/critical findings.

### Will not do (v1.0)
- No backend, telemetry or accounts.
- No encryption. Payloads are plaintext that anyone can decode.
- No custom audio framing: ggwave protocols only, so we stay interoperable.
- No DT/MT ggwave protocols. Upstream supports them only with fixed-length payloads (ggwave.cpp rejects mono-tone for variable length and skips it on receive).
- No Tolkien Cirth or Dalecarlian runes. They aren't in Unicode, and Private Use Area code points collide with other agreements.
- No multi-message chunking for text over 140 bytes (Later).

## 5. Runic design

Research and sources: `docs/research/runes.md`. The data lives in `packages/core/data/runic-lexicon.toon`.

**Layering (oldest first):**

| Layer | Set | Rules come from |
|---|---|---|
| 0 | **Elder Futhark** (c. 150–800; Vimose comb c. 160 is the oldest securely read inscription) | — |
| 1 | Anglo-Frisian Futhorc | Elder |
| 1 | Younger Futhark long-branch | none (so Elder runes never leak in) |
| 2 | Younger Futhark short-twig | long-branch |
| 2 | Medieval dotted runes | long-branch |
| 3 | Franks Casket cryptic vowels | Futhorc |
| 3 | Golden-number runes (keyboard only) | Medieval |
| 3 | Tolkienian runes (flagged modern) | Futhorc |

`parent` records historical lineage. `rulesFrom` controls inheritance of runes and Latin rules.

**Lexicon guarantees (all enforced by tests):**
- Every rune row's glyph equals its code point, and its name matches Unicode 17.0 `UnicodeData.txt`.
- The lexicon covers all 89 characters of the Unicode Runic block (U+16A0–U+16F8).
- A set's rules never emit a rune outside that set.
- Each row's `reversible` flag matches what the rules actually do.
- Code points are stored as `U+XXXX` (a bare `16E0` would parse as a number in TOON), and the file is valid strict TOON that round-trips through the reference encoder.

**Transliteration:**
- Latin → runes is a modern convention; no scholarly standard exists for that direction. Rules that fill a gap carry `convention=true`.
- Processing: NFC, lower-case, greedy longest match, accent fallback, and digits and punctuation pass through unchanged.
- Runes → Latin uses each rune's conventional transliteration and is best effort. Adjacent readings can re-segment once (ᛏ+ᚺ reads "th", which is written ᚦ); a second pass is a fixed point.

**Separators:**
- Rune text uses ᛫ (U+16EB) between words by default. ᛬, ᛭, space, or none ("Elder style") are selectable.
- Latin text uses ordinary spaces.

**Wire format:**
- Runes on the wire by default (true runic UTF-8), so any ggwave receiver shows real runes.
- Each rune is 3 bytes, so 46 runes fit in one message.
- "Text as typed" is available for plain text.

**Rendering:** `runic-glyphs.toon` holds SVG outlines for all 89 code points. They were extracted from a pinned, hash-checked Noto Sans Runic v2.002 and stay under OFL-1.1.

## 6. Domain model

```
Protocol       { id: audible|ultrasound × normal|fast|fastest, framesPerTx, bytesPerTx, extra }
Payload        Uint8Array, invariant 1..140 bytes (UTF-8, NFC)
Waveform       { samples: Float32Array, sampleRate, protocol, byteTimes: {start,end}[] }
Decoder        push(Float32Array) -> Uint8Array[]; chunk-size agnostic; dispose()
RuneSet        { id, name, layer, parent, rulesFrom, from, to, historical, note, source }
Rune           { set, order, group, cp, glyph, uname, name, translit, ipa, reversible, note }
GlyphTime      { glyph, index, start, end }   // code point timed by its bytes on air
Flock          step(t) -> Bird[] { index, glyph, x, y, angle, alpha, scale }   // pure, seeded
```

Packages (npm workspaces):

| Package | Contents |
|---|---|
| `ggwave-wasm` | Emscripten 6.0.9 build of upstream ggwave pinned at `060aec7` (0.4.3 plus the Emscripten fix). Sources are hash-checked, the output is byte-reproducible, and CI rebuilds and diffs it. |
| `core` | Codec, WAV, byte timeline, runes, glyph outlines and the flock simulation. No DOM; runs in browser, worker and Node. Code uses erasable TypeScript syntax only. |
| `web` | Svelte 5 app. |
| `cli` | M3. |

## 7. Library selection (verified 2026-09-13)

| Concern | Pick (version in use) | Rejected / why |
|---|---|---|
| Codec | Self-built ggwave WASM (emsdk 6.0.9, 82 KB) | npm `ggwave@0.4.0`: stale since 2022, no types. Kept as an interop test oracle. |
| Language | TypeScript 7.0.2, strict, `erasableSyntaxOnly` | — |
| Build / dev | Vite 8.3 | — |
| UI | Svelte 5.57 | React: too much bundle and ceremony for a 3-panel app. Vanilla JS: mic, transcript and flight state gets messy. |
| Data format | TOON 4.1 via `@toon-format/toon` 4.1.1 (pinned) | JSON: noisier for big tables. Logan asked for TOON. |
| Glyph extraction | opentype.js 2 + fontTools `pyftsubset` (build-time only) | — |
| Mic capture | AudioWorklet → Web Worker | ScriptProcessorNode: deprecated |
| File decode | `decodeAudioData`; ggwave resamples internally | ffmpeg.wasm: overkill |
| Animation | Own boids sim in core + Canvas 2D `Path2D` | Physics libraries: unnecessary. DOM nodes: too slow at ~8 runes/s. |
| WAV | Own writer/parser (PCM 8/16/24/32, float 32/64, extensible) | `wavefile`: heavier than needed |
| PWA | vite-plugin-pwa 1.3 | — |
| Lint + format | Biome 2.5 (Svelte files: lint only) | ESLint + Prettier |
| Unit tests | Vitest 5 | — |
| E2E | Playwright 1.63 with Chromium fake mic playing generated fixture WAVs; `@axe-core/playwright` 4.13 | — |
| Runtime | Node ≥ 22 for the library; Node 24 in CI (type stripping for fixtures) | — |
| CLI (M3) | `util.parseArgs`, tsdown | commander/citty |

## 8. Acceptance tests

✅ = implemented and green.

**Codec**
1. ✅ Every protocol round-trips exactly.
2. ✅ 140 bytes accepted, 141 rejected, multibyte characters counted as bytes, empty rejected.
3. ✅ WAV write → parse → decode.
4. ✅ 44.1 kHz ⇄ 48 kHz capture.
5. ✅ White noise at amplitude 0.05.
6. ✅ Random chunk sizes from 128 to 4096 samples.
7. ✅ Interop with npm ggwave@0.4.0 in both directions. ⏳ A fixture recorded from the real GibberLink demo is still to add.
8. ✅ The framing model predicts exact audio length (6 protocols × 4 sizes).

**Runes**
9. ✅ Unicode 17 names, full block coverage, strict TOON round-trip, embedded module in sync.
10. ✅ Layer tree, no duplicates, no leaks, honest `reversible` flags, outlines for every glyph.
11. ✅ Transliteration examples for all layers, separators, accents, pass-through.
12. ✅ Stability fixed point, 500 random strings per set.
13. ✅ 46/47 rune budget. Runes survive the audio channel and read back.

**Flock**
14. ✅ Reading order holds in every frame, fades stay within [0,1], every bird exits, on screen, deterministic, reduced motion, enters from the right.

**App**
15. ✅ Compose preview and budget, over-limit disabled, rune keyboard inserts real runes.
16. ✅ Transmit draws runes on the canvas.
17. ✅ File decode, and live mic decode of runes.
18. ✅ axe: zero serious or critical findings.
19. ⏳ CLI.

## 9. Open questions

**To verify:**
- Does upstream GibberLink default to audible fast? Needs a fixture recorded from the real demo.
- iOS Safari AudioWorklet mic behaviour at 48 kHz.
- Line breaking around ᛫ in long transcripts.

**For Logan:**
- The visual style of the flock and sky: glyph size, glow, colours, thread on or off. The current look is a first pass; see `docs/images/`.

## 10. Decisions log

**2026-09-13 (Logan):**
1. The repo stays public.
2. The v2 stack is approved.
3. Runes start from the oldest attested set, with later sets layered on top. The lexicon is a TOON file, and rendering must never show missing glyphs.
4. Rune text uses ᛫ between words; Latin text uses spaces.
5. Runes fly like a migrating flock while audio plays, ordered enough to read.
6. Archive gibber-to-runic.

**2026-09-13 (Claude):**
- Dropped the DT/MT protocols, because upstream ggwave doesn't support them with variable-length payloads.
- Split `rulesFrom` from `parent` so Younger Futhark never inherits Elder runes.
- The flock flies right-to-left so the message reads left-to-right as it passes. The first version flew rightward, which read backwards.
- The sky band is sticky, because pressing Transmit scrolled it out of view.
