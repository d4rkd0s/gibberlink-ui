#!/usr/bin/env python3
"""
Text → Gibberlink audio (using ggwave) and play it.

This is a thin Python wrapper around the Rust CLI at `gibberlink-tx/target/release/gibberlink-tx`.
It ensures you can trigger Gibberlink (ggwave) synthesis even if Python cannot
build the `ggwave` wheel on your system.

Usage examples:
  python text-to-gibberlink.py --text "hello world"
  python text-to-gibberlink.py --text "secret" --protocol ultrasound:fast --volume 20

If the Rust binary is missing, the script will attempt to build it with Cargo.
"""

import argparse
import os
import subprocess
import sys
from typing import Optional


def ensure_binary() -> str:
    root = os.path.dirname(os.path.abspath(__file__))
    exe = os.path.join(root, "gibberlink-tx", "target", "release", "gibberlink-tx")
    if os.name == "nt":
        exe += ".exe"
    if os.path.exists(exe):
        return exe
    # Try building it
    print("Building Rust gibberlink-tx binary (first run only)...", flush=True)
    try:
        subprocess.check_call(["cargo", "build", "--release"], cwd=os.path.join(root, "gibberlink-tx"))
    except FileNotFoundError:
        print("Cargo not found. Please install Rust (https://rustup.rs/) to build the binary.", file=sys.stderr)
        sys.exit(2)
    except subprocess.CalledProcessError as e:
        print(f"Cargo build failed with code {e.returncode}", file=sys.stderr)
        sys.exit(e.returncode)
    if not os.path.exists(exe):
        print("Build succeeded but binary not found. Please check the build output.", file=sys.stderr)
        sys.exit(3)
    return exe


def run_ui() -> int:
    try:
        import tkinter as tk
        from tkinter import ttk
    except Exception as e:
        print(f"Tkinter is not available: {e}", file=sys.stderr)
        return 2

    exe = ensure_binary()

    root = tk.Tk()
    root.title("Text → Gibberlink (ggwave)")
    root.geometry("560x340")

    mainframe = ttk.Frame(root, padding=12)
    mainframe.pack(fill=tk.BOTH, expand=True)

    # Text input
    ttk.Label(mainframe, text="Text to encode:").grid(row=0, column=0, sticky="w")
    text_box = tk.Text(mainframe, height=5, wrap=tk.WORD)
    text_box.grid(row=1, column=0, columnspan=4, sticky="nsew", pady=(4, 8))
    text_box.insert("1.0", "The sum of the parts is greater than the whole.")

    # Protocol dropdown
    ttk.Label(mainframe, text="Protocol:").grid(row=2, column=0, sticky="w")
    protocol_var = tk.StringVar(value="audible:fast")
    protocol_options = [
        "audible:normal", "audible:fast", "audible:fastest",
        "ultrasound:normal", "ultrasound:fast", "ultrasound:fastest",
        "dt:normal", "dt:fast", "dt:fastest",
        "mt:normal", "mt:fast", "mt:fastest",
    ]
    protocol_combo = ttk.Combobox(mainframe, textvariable=protocol_var, values=protocol_options, state="readonly")
    protocol_combo.grid(row=2, column=1, sticky="w")

    # Volume slider
    ttk.Label(mainframe, text="Volume (0–100):").grid(row=2, column=2, sticky="e")
    volume_var = tk.IntVar(value=75)
    volume_slider = ttk.Scale(mainframe, from_=0, to=100, orient=tk.HORIZONTAL, variable=volume_var)
    volume_slider.grid(row=2, column=3, sticky="we")

    # Output filename
    ttk.Label(mainframe, text="Output file:").grid(row=3, column=0, sticky="w", pady=(8, 0))
    out_var = tk.StringVar(value="gibberlink.wav")
    out_entry = ttk.Entry(mainframe, textvariable=out_var)
    out_entry.grid(row=3, column=1, columnspan=3, sticky="we", pady=(8, 0))

    # Play checkbox
    play_var = tk.BooleanVar(value=True)
    play_check = ttk.Checkbutton(mainframe, text="Play after generating", variable=play_var)
    play_check.grid(row=4, column=0, columnspan=2, sticky="w", pady=(8, 0))

    # Status label
    status_var = tk.StringVar(value="")
    status_label = ttk.Label(mainframe, textvariable=status_var, foreground="#0a0")
    status_label.grid(row=5, column=0, columnspan=4, sticky="w", pady=(8, 0))

    # Grid weights
    mainframe.columnconfigure(0, weight=0)
    mainframe.columnconfigure(1, weight=1)
    mainframe.columnconfigure(2, weight=0)
    mainframe.columnconfigure(3, weight=1)
    mainframe.rowconfigure(1, weight=1)

    def run_encode() -> None:
        txt = text_box.get("1.0", tk.END).strip()
        if not txt:
            status_var.set("Please enter some text.")
            return
        out_path = out_var.get().strip() or "gibberlink.wav"
        protocol = protocol_var.get()
        volume = max(0, min(100, int(volume_var.get())))
        cmd = [exe, "--out", out_path, "--protocol", protocol, "--volume", str(volume)]
        if play_var.get():
            cmd.append("--play")
        # pass text via arg (handles spaces safely)
        cmd += ["--text", txt]
        status_var.set("Generating...")
        root.update_idletasks()
        try:
            completed = subprocess.run(cmd, capture_output=True, text=True)
            if completed.returncode == 0:
                # Show the CLI stdout (contains 'Wrote N bytes to ...')
                msg = completed.stdout.strip() or "Done."
                status_var.set(msg)
            else:
                err = completed.stderr.strip() or completed.stdout.strip() or f"Error code {completed.returncode}"
                status_label.configure(foreground="#a00")
                status_var.set(err)
        except Exception as e:
            status_label.configure(foreground="#a00")
            status_var.set(f"Failed: {e}")

    # Buttons
    btn = ttk.Button(mainframe, text="Generate + Play", command=run_encode)
    btn.grid(row=4, column=3, sticky="e", pady=(8, 0))

    # Tip
    tip = ttk.Label(
        mainframe,
        text="Tip: Very high volumes (>50) can distort or be uncomfortable.",
        foreground="#666"
    )
    tip.grid(row=6, column=0, columnspan=4, sticky="w", pady=(6, 0))

    root.mainloop()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Text → Gibberlink audio and play it (via ggwave)")
    parser.add_argument("--text", "-t", help="Text to encode (reads stdin if omitted)")
    parser.add_argument("--protocol", default="audible:fast", help="audible|ultrasound|dt|mt optionally with :normal|fast|fastest")
    parser.add_argument("--volume", type=int, default=75, help="Volume 0..100 (default 75)")
    parser.add_argument("--out", default="gibberlink.wav", help="Output WAV path (default gibberlink.wav)")
    parser.add_argument("--no-play", dest="play", action="store_false", help="Do not play after generating")
    parser.add_argument("--ui", action="store_true", help="Open a small UI for text + volume")
    args = parser.parse_args()

    if args.ui:
        return run_ui()

    exe = ensure_binary()

    cmd = [exe, "--out", args.out, "--protocol", args.protocol, "--volume", str(args.volume)]
    if args.text:
        cmd += ["--text", args.text]
        input_data = None
    else:
        input_data = sys.stdin.read().encode("utf-8")

    if args.play:
        cmd.append("--play")

    res = subprocess.run(cmd, input=input_data)
    return res.returncode


if __name__ == "__main__":
    raise SystemExit(main())
