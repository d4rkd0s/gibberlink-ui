# GibberLink UI — CLAUDE.md

Text ⇄ runes ⇄ GibberLink (ggwave data-over-sound) audio. Browser-first, no server. MIT, built to be public.
Absorbed `d4rkd0s/gibber-to-runic`; runic design is SPEC §5.

**Read order every session: `STATUS.md` (what's true) → `ROADMAP.md` (what's next) → `docs/SPEC.md` (what/why).**

---

## Session rules

- **Exit rule:** before ending a session that changed reality, update `STATUS.md` (and tick `ROADMAP.md`). Stale docs are bugs.
- **Spec → tests → code.** New behavior starts as a line in `docs/SPEC.md` §7 and a failing test.
- **`npm test` is the gate.** Nothing merges red. (Until M0 lands there is no JS toolchain; v0 lives in `legacy/`.)
- **Interop is sacred.** Only ggwave protocols, no custom framing. If upstream GibberLink can't decode what we emit, it's a bug.
- **Privacy by construction.** No network calls after page load, no analytics, no telemetry. Mic audio never leaves the device.
- **Public-ready at all times:** no secrets, no personal paths, no private fixtures in git. Anything human-facing (README, release notes, PR text) goes through the `humanizer` skill; no em dashes in that copy.
- Heavy local work (`npm install`, builds, Playwright) runs under `nice -n 15`.

## Architecture (planned, see SPEC §5)

Stack (SPEC §7): TypeScript 7, Vite 8, Svelte 5, Vitest 5, Playwright, Biome 2, tsdown, self-built ggwave WASM.

```
packages/
  ggwave-wasm/ reproducible emsdk build of pinned upstream ggwave + typed ESM wrapper. Never use npm ggwave@0.4.0 except as a test oracle.
  core/   pure TS: encode, createDecoder, wav, resample, runes/ (one table per rune set). No DOM.
  web/    Svelte app: compose (text⇄runes), listen (file + mic via AudioWorklet→worker), spectrogram, transcript, PWA
  cli/    Node: gibberlink encode|decode|runes
fixtures/ WAVs for interop + regression tests (small, license-clean)
legacy/   v0 Tkinter + Rust prototype, removed at v1.0.0
docs/     SPEC.md and design notes
```

### Invariants
- Payload is 1..140 **bytes** (UTF-8), not characters. A rune is 3 bytes → ~46 runes max.
- Runes → Latin is lossy and labeled "best effort"; only runes → Latin → runes must be stable.
- Adding a rune set = one table file + its stability test. Rune-set and visual choices are Logan's call; ask first.
- `core` never touches `window`/`AudioContext`; the web layer converts `AudioBuffer` → `Float32Array` + sampleRate.
- Decoder is stateful and chunk-size agnostic (buffers internally).

## Dev workflow (from M0 on)

```bash
nice -n 15 npm ci
npm test            # vitest, all packages
npm run e2e         # playwright, fake mic
npm run dev -w web  # http://localhost:5173 (mic requires localhost or https)
```

## Git

Single branch `main` plus short-lived feature branches; conventional commits; tag `vX.Y.Z` to release.
