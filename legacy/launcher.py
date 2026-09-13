"""
Launcher for the Text → Gibberlink (ggwave) UI.

Double‑click this file on Windows, or run:

    python launcher.py

It delegates to `gibberlink-ui.py --ui` so you always get the latest UI.
"""

import os
import subprocess
import sys


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    wrapper = os.path.join(here, "gibberlink-ui.py")
    if not os.path.exists(wrapper):
        print("Could not find gibberlink-ui.py next to launcher.py", file=sys.stderr)
        return 2
    try:
        return subprocess.call([sys.executable, wrapper, "--ui"])  # Blocks until UI closes
    except Exception as e:
        print(f"Failed to launch UI: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

