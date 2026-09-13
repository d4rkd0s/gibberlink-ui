# GibberLink UI — Roadmap

What's next, in order. `STATUS.md` = what's true now. `docs/SPEC.md` = what/why + decisions.
`CLAUDE.md` = how we work. Each milestone ends green on `npm test` and `npm run e2e`.

## Done

- v0 prototype (Sep 2025): Tkinter + Rust encoder, now in `legacy/`
- v2 plan: SPEC, ROADMAP, STATUS, CLAUDE, MIT LICENSE (2026-09-13)
- **M0 Foundation** (2026-09-13)
  - v0 moved to `legacy/`; empty submodules removed
  - npm workspaces; TS 7, Biome 2, Vitest 5
  - `ggwave-wasm` builds from hash-checked sources and is byte-reproducible
  - CI workflows written: lint, types, unit, E2E, WASM rebuild diff
- **M1 Core** (2026-09-13)
  - Codec, WAV, byte timeline; interop with npm ggwave in both directions
  - Runic tomes lexicon: 8 layered sets, 105 runes, 140 rules, all checked against Unicode 17
  - Glyph outlines for all 89 runic code points, plus a 3.2 KB font subset
  - Flock simulation
- **M2 Web app, first pass** (2026-09-13)
  - Compose (rune keyboard, set and separator pickers, byte budget, WAV download)
  - Flock flight synced to audio; Listen by mic and by file; transcript with export
  - PWA build; E2E suite with fake mic and axe

## Next

### M2 finish (target 2026-09-27)
1. Merge the v2 branch to `main` (draft PR). The Pages workflow deploys on merge.
2. Enable GitHub Pages (source: GitHub Actions) and check the live site on desktop and phone
3. Logan reviews the flock look (SPEC §9); tune glyph size, glow, colours and thread
4. Spectrogram / level meter for mic input
5. Record an interop fixture from the real GibberLink demo into `fixtures/` (SPEC test 7)
6. iOS Safari mic check; wrapping check for ᛫ in long transcripts
7. Archive `d4rkd0s/gibber-to-runic` (approved; see STATUS)

### M3 Ship v1.0 (target 2026-10-25)
1. `packages/cli`: `gibberlink encode | decode | runes`, built with tsdown; publish to npm (check the name)
2. README rewrite through humanizer with the screenshots in `docs/images/`; CONTRIBUTING, SECURITY, issue templates
3. Rune lexicon page in the app: browse sets by layer with names, IPA, notes and sources
4. Delete `legacy/`, tag `v1.0.0`

## Later / exploratory

- Multi-part messages over 140 bytes (sequence header inside the payload)
- Staveless / Hälsinge runes as an SVG-only style (no code points exist)
- Cirth as an SVG-only, clearly-fictional set (ask Logan first)
- Export a flight as GIF/WebM, or runes as SVG/PNG
- Auto-detect protocol on decode
- Conversation mode for replaying AI↔AI GibberLink calls
- Share link with the message in the URL fragment
- Tauri desktop wrapper if requested; UI translations
