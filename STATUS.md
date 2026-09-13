# GibberLink UI — STATUS (what is true right now)

_Last verified: 2026-09-13. Update whenever reality changes._

## State

**v2 is on branch `worktree-v2-plan`, open as draft [PR #1](https://github.com/d4rkd0s/gibberlink-ui/pull/1). It is not merged and not deployed.** `main` still holds the v0 prototype.
Gates, last run 2026-09-13:

| Gate | Result |
|---|---|
| `npm test` | 63/63 |
| `npm run e2e` | 7/7 (Chromium, fake mic) |
| `tsc` | 0 errors |
| `svelte-check` | 0 errors |
| `biome ci` | clean |
| WASM rebuild | byte-identical |

## Working (VERIFIED)

| Piece | Notes |
|---|---|
| ggwave WASM | Pinned upstream `060aec7`, emsdk 6.0.9, 82 KB, built with `-DNDEBUG -ffile-prefix-map`. Builds from different directories hash-identically, and the binary contains no local paths. Decodes npm ggwave@0.4.0 audio and vice versa. |
| GitHub CI on PR #1 | `test` and `e2e` green on GitHub. `wasm` rebuild diff green after the path-leak fix in `191ebb6`. All 3 jobs green. |
| Codec | Audible and ultrasound × normal/fast/fastest round-trip. Survives 44.1⇄48 kHz, noise and random chunking. |
| Byte timeline | Predicts exact sample length for every protocol. Drives flock timing. |
| Runic lexicon | 8 sets, 105 rune rows, 140 rules. Unicode 17 names verified. All 89 Runic-block characters covered. |
| Glyph outlines | 89 SVG paths from Noto Sans Runic v2.002 (sha256 pinned). Runes render with no font installed. |
| Web: compose | Rune set, separator (᛫ default), send as runes or text, byte budget, rune keyboard, Transmit, WAV download |
| Web: flock | Runes fly right→left while audio plays, reading left→right, threaded in order. Sticky sky band. Reduced-motion fallback. |
| Web: listen | Live mic (AudioWorklet → worker) and file decode. Transcript shows runes with their reading. Received messages replay as a flight. |
| PWA build | 51 KB gzip JS + 36 KB gzip WASM, 16 precached files |
| a11y | axe: 0 serious/critical |

## Not done / known gaps

| Priority | Gap |
|---|---|
| P1 | Not merged to `main`, so the Pages workflow hasn't run; Pages isn't enabled in repo settings yet |
| P2 | No fixture recorded from the real GibberLink demo (SPEC test 7). Interop is proven only against npm ggwave@0.4.0. |
| P2 | Not tested on iOS Safari or Firefox; no mic spectrogram yet |
| P2 | Flock look is a first pass and needs Logan's eye (SPEC §9) |
| P3 | CLI package not started (M3) |
| P3 | `legacy/` still present; its Rust build references the removed `ggwave` submodule (won't build as-is) |

## Repo & ops facts

| Fact | Detail |
|---|---|
| GitHub | `d4rkd0s/gibberlink-ui`, PUBLIC (Logan: keep public), 5 stars |
| Pushing | The `gh` HTTPS token lacks `workflow` scope, so pushes that touch `.github/workflows` must go over SSH (`git push git@github.com:d4rkd0s/gibberlink-ui.git <branch>`). `gh auth refresh -s workflow` would fix HTTPS. |
| Sibling repo | `d4rkd0s/gibber-to-runic`: **archived 2026-09-13**, and its description points here. It was empty; its scope is SPEC §5. |
| Local toolchain | Node 26, emsdk at `~/emsdk` (6.0.9), fontTools 4.62, Playwright Chromium installed |

## Decisions pending (Logan)

| # | Decision | Recommendation |
|---|---|---|
| 1 | Flock look (size, glow, colour, thread) | Review `docs/images/flock-*.png` or the live site after merge |
| 2 | Merge the v2 draft PR to `main` (replaces v0 on main; v0 kept in `legacy/`) | Merge once CI is green on the PR |
