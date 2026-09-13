# GibberLink UI — Roadmap

What's next, in order. `STATUS.md` = what's true now. `docs/SPEC.md` = what/why + library picks.
`CLAUDE.md` = how we work. Each milestone ends green on `npm test` before the next starts.

## Done

- v0 prototype (Sep 2025): Tkinter UI + Rust `gibberlink-tx` encoder, WAV decode via PyPI ggwave, Windows release workflow (never tagged)
- v2 plan (2026-09-13): SPEC with runic design + re-selected 2026 libraries, ROADMAP, STATUS, CLAUDE, MIT LICENSE
- `gibber-to-runic` absorbed into this plan (that repo was empty; its scope is SPEC §5)

## Next

### M0 — Foundation (target 2026-09-20)
1. Logan decisions: visibility, rune sets, separator, runic wire default (SPEC §9)
2. Move v0 to `legacy/`; remove the empty `ggwave` and `gibberlink-translator` submodules
3. npm workspaces: `packages/ggwave-wasm`, `core`, `web`, `cli`; TS 7 strict, Biome 2, Vitest 5
4. `ggwave-wasm`: reproducible emsdk build of pinned upstream ggwave, checksum test, CI job
5. Resolve SPEC §9 verify items; record interop fixture WAVs (upstream GibberLink + npm ggwave oracle) into `fixtures/`
6. CI: Biome + typecheck + test on PRs and `main`; Renovate
7. Close out `d4rkd0s/gibber-to-runic`: set description to point here, archive it (Logan confirms)

### M1 — Core (target 2026-09-27)
1. Acceptance tests 1–12 written failing first
2. Codec: `encode`, `createDecoder` (chunk-buffered), `wav`, `resample`, typed payload errors
3. Runes: Elder Futhark, Younger Futhark, Futhorc tables; transliterate both ways; runic detection; budget helper

### M2 — Web app (target 2026-10-11)
1. Svelte 5 + Vite 8 shell; light/dark
2. Compose panel: text ⇄ runes side by side, rune set picker, byte + rune budget, wire toggle, Play, Download WAV
3. Listen panel: file drop + live mic (AudioWorklet → worker), level meter, transcript with text/rune views
4. Spectrogram canvas; export `.txt`/`.json`
5. Playwright fake-mic E2E (13) + axe (15)

### M3 — Ship (target 2026-10-25)
1. PWA (vite-plugin-pwa), GitHub Pages deploy
2. CLI: `encode`, `decode`, `runes` (test 14); publish to npm as `gibberlink-ui` or scoped (check name)
3. README rewrite through humanizer, screenshots/GIF, CONTRIBUTING, SECURITY, issue templates
4. Delete `legacy/`, tag `v1.0.0`, confirm public

## Later / exploratory

- Multi-part messages for text longer than 140 bytes (sequence header inside payload)
- Tolkien Cirth / custom rune sets via JSON table + bundled font (ask Logan first)
- Auto-detect protocol on decode, shown per message
- Conversation mode: two-speaker transcript for replaying AI↔AI GibberLink calls
- Share link with message in URL fragment (never sent to a server)
- Tauri desktop wrapper if requested; i18n of UI strings
