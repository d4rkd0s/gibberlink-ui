# GibberLink UI — STATUS (what is true right now)

_Last verified: 2026-09-13. Update whenever reality changes._

## State

**v0 prototype on `main`; v2 planned, not started.** No v2 code exists. Plan lives on branch `worktree-v2-plan`.

## Repo facts (VERIFIED 2026-09-13)

| Fact | Detail |
|---|---|
| GitHub | `d4rkd0s/gibberlink-ui`, **PUBLIC**, 5 stars, 0 forks, created 2025-09-15, last push 2025-09-16 |
| Old name | Early commits reference `text-to-gibber` |
| Releases / tags | None. README says "Download: TBD" |
| License | None on `main`; MIT added on plan branch |
| Submodules | `ggwave/`, `gibberlink-translator/` declared, **empty** locally |
| Tests | None |
| CI | `release.yml` builds Windows exe on tag; never triggered |
| Sibling repo | `d4rkd0s/gibber-to-runic`: PRIVATE, **empty (no commits)**, created 2025-09-15. Scope now in SPEC §5; to be archived in M0 |

## Library facts (VERIFIED on npm / GitHub 2026-09-13)

| Thing | Fact |
|---|---|
| npm `ggwave` | 0.4.0, last published 2022-07-05. Stale |
| Upstream ggwave C++ | 0.4.3, recent Emscripten C++17 fix; MIT |
| Toolchain latest | Vite 8.3, Vitest 5.0, TypeScript 7.0.2, Svelte 5.57, Biome 2.5, Playwright 1.63, vite-plugin-pwa 1.3, tsdown 0.23 |
| Local Node | v26.7.0 |

## v0 (from README + code read, NOT re-run)

| Piece | Notes |
|---|---|
| `gibberlink-ui.py` | Tkinter UI + CLI wrapper; builds Rust binary on first run |
| `gibberlink-tx/` | Rust CLI, FFI to ggwave C++, writes WAV, plays via WinMM or ffplay/aplay |
| Decode | WAV file only, via PyPI `ggwave` (separate codec build from encoder) |

## Decisions pending (Logan)

| # | Decision | Recommendation |
|---|---|---|
| 1 | Visibility. Repo is already public; going private permanently erases its 5 stars/watchers | Keep public and build in the open |
| 2 | Stack in SPEC §7 (Svelte 5, self-built ggwave WASM, etc.) | Approve |
| 3 | Rune sets for v1.0; Cirth wanted? | Elder + Younger + Futhorc; Cirth later |
| 4 | Word separator | `᛫` with option for space |
| 5 | Runic wire default | Runes on the wire |
| 6 | Archive `gibber-to-runic` after M0 | Yes |
