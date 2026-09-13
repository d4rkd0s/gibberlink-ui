# GibberLink UI — CLAUDE.md

Text ⇄ runes ⇄ GibberLink (ggwave data-over-sound) audio. Browser-first, no server. MIT, public.
Absorbed `d4rkd0s/gibber-to-runic`.

**Read order every session: `STATUS.md` (what's true) → `ROADMAP.md` (what's next) → `docs/SPEC.md` (what/why/decisions).**

---

## Session rules

- **Exit rule:** before ending a session that changed reality, update `STATUS.md`, tick `ROADMAP.md`, and log decisions in SPEC §10. Stale docs are bugs.
- **Spec → tests → code.** New behaviour starts as a line in SPEC §8 and a failing test.
- **Gates:** `npm test`, `npm run e2e`, `npx tsc -p tsconfig.json`, `npm run check -w @gibberlink/web`, `npx biome ci .`. Nothing merges red.
- **Interop is sacred.** Only ggwave protocols, no custom framing. Never swap the codec for npm `ggwave@0.4.0` (it's a test oracle only).
- **Runes must never render as boxes.** Canvas/inline runes draw from `runic-glyphs.toon` outlines; inputs use the bundled font. Never rely on system fonts.
- **Lexicon accuracy is critical.** Every change to `runic-lexicon.toon` must keep the integrity tests green (Unicode names, coverage, no leaks, honest `reversible`). Cite sources in `docs/research/runes.md`. Rune-set additions and visual/creative choices (flock look, colours) are Logan's call; ask first.
- **Privacy by construction:** no network calls after load, no analytics, mic audio never leaves the device.
- **Public-ready at all times.** Human-facing copy (README, release notes, PR text) goes through the `humanizer` skill, with no em dashes.
- Heavy local work (`npm install`, builds, Playwright, emsdk) runs under `nice -n 15`.
- Pushing workflow files: use SSH (see STATUS "Repo & ops facts").

## Architecture

```
packages/
  ggwave-wasm/  build.sh + SOURCES.sha256 → dist/ggwave.{mjs,wasm} (committed, CI rebuild-diffs it)
  core/         src/codec.ts      encode, createDecoder (frame-buffered), byteTimeline
                src/wav.ts        writeWav / parseWav
                src/flock.ts      glyphTimeline, createFlock (pure boids, seeded, order-guaranteed)
                src/runes/        lexicon (TOON decode), toRunes/toLatin/describeRunes/glyphOutline
                data/             runic-lexicon.toon, runic-glyphs.toon, unicode-runic.txt, OFL
                scripts/          embed-data.mjs (data → data.generated.ts), build-glyphs.mjs (font → outlines + woff2)
  web/          Svelte 5: App.svelte, lib/{FlockCanvas,RuneText,RuneKeyboard}.svelte, audio.ts, decoder.worker.ts
                public/capture-worklet.js; e2e/ (Playwright, fixtures generated from core)
legacy/         v0 prototype, removed at v1.0.0
docs/           SPEC.md, research/runes.md, images/
```

### Invariants
- Payload is 1..140 **bytes** (UTF-8, NFC). One rune is 3 bytes, so at most 46 runes.
- `core` never touches the DOM. It uses erasable TS syntax only, so Node can run it directly.
- After editing `data/*.toon`, run `node packages/core/scripts/embed-data.mjs` (a test fails if you forget).
- In TOON, code points are `U+XXXX` and numeric-looking text is quoted.
- Lexicon `parent` = lineage; `rulesFrom` = inheritance. Younger Futhark has no `rulesFrom` on purpose.
- Flock: the leader is on the left, birds fly right→left, and order is clamped every frame.
- Biome doesn't understand Svelte templates. `.svelte` files are lint-only with unused-variable rules off (see `biome.json`).

## Dev workflow

```bash
nice -n 15 npm ci
npm test                          # vitest (core)
npm run e2e                       # playwright: builds, previews on :4173, fake mic
SCREENS=1 npm run e2e -- screens  # capture flock screenshots to packages/web/e2e/.screens
npm run dev -w @gibberlink/web    # http://localhost:5173 (mic needs localhost or https)
bash packages/ggwave-wasm/build.sh               # rebuild WASM (needs ~/emsdk)
node packages/core/scripts/build-glyphs.mjs      # regenerate outlines + font subset (needs pyftsubset)
```

## Git

`main` plus short-lived branches; conventional commits; tag `vX.Y.Z` to release. Pages deploys from `main`.
