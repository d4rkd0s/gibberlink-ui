# Text → Gibberlink (ggwave) Audio

Encode and decode Gibberlink/ggwave audio. Comes with:

- A Rust CLI (`gibberlink-tx`) that uses the official `ggwave` C library to encode audio
- A Python wrapper (`gibberlink-ui.py`) that builds/runs the Rust CLI
- A small Python UI (Tkinter) with a volume slider
- 
<img width="564" height="371" alt="image" src="https://github.com/user-attachments/assets/0ec35e85-05c6-496e-94b5-3596782c8110" />


## Capabilities

- Encode: text -> WAV (via CLI and UI)
- Decode: WAV -> text (CLI `--decode` and UI "Decode" section)

## Quick Start

- UI (recommended):

  ```
  python launcher.py
  ```
  On Windows, you can also double‑click `launcher.py`.

- CLI:

  ```
  python gibberlink-ui.py --text "hello world" --protocol audible:fast --volume 75 --out gibberlink.wav
  ```

- Decode from WAV -> text:

  ```
  python gibberlink-ui.py --decode gibberlink.wav
  ```

- Direct Rust binary (after build):

  ```
  gibberlink-tx/target/release/gibberlink-tx --text "hello" --protocol audible:fast --volume 75 --out hello.wav --play
  ```

The first run will build the Rust binary automatically (one‑time).


## Requirements

- Python 3.10+ with Tkinter (Windows Python includes Tkinter by default)
- Rust toolchain with Cargo (for building the encoder): https://rustup.rs/
- Windows: audio playback uses the built‑in WinMM (`PlaySoundW`)
- macOS/Linux: fallback playback tries `ffplay`, `afplay`, `aplay`, or `paplay` if available

This repo already includes the `ggwave` source tree under `ggwave/`. The Rust build compiles it statically.


## Usage Details

- UI controls:
  - Text input: the message to encode
  - Protocol: `audible|ultrasound|dt|mt` + `:normal|fast|fastest` (e.g., `audible:fast`)
  - Volume: 0–100 (default 75). Very high levels can distort.
  - Output file: path to save the generated WAV. Playback is optional.
  - Decode section: browse a `.wav` or use last generated file and decode to text.

- CLI flags (wrapper):
  - `--text/-t`: text to encode (reads stdin if omitted)
  - `--protocol`: defaults to `audible:fast`
  - `--volume`: 0–100 (default 75)
  - `--out`: output WAV path (default `gibberlink.wav`)
  - `--no-play`: generate but do not play
  - `--ui`: launch the Tkinter UI
  - `--decode WAV`: decode payload from a WAV file and print


## Project Layout

- `gibberlink-ui.py` — Python wrapper + Tkinter UI
- `launcher.py` — one‑liner launcher to open the UI
- `gibberlink-tx/` — Rust CLI that links against `ggwave`
  - `build.rs` — compiles `../ggwave/src/ggwave.cpp`
  - `src/main.rs` — FFI to `ggwave`, WAV writer, and platform playback
- `ggwave/` — upstream `ggwave` sources (MIT License)


## Troubleshooting

- Cargo not found: install Rust via rustup, then re‑run.
- Playback is too quiet: increase `--volume`, raise OS output, or use external amplification.
- Ultrasound modes: likely inaudible to humans; reception depends on hardware.
- Linux/macOS playback: ensure one of `ffplay`, `afplay`, `aplay`, or `paplay` exists, or open the saved WAV in any player.


## Attribution

- `ggwave` by Georgi Gerganov (MIT): https://github.com/ggerganov/ggwave
- Concept inspired by Gibberlink translator repo: https://github.com/yanivlevydfs/gibberlink-translator
