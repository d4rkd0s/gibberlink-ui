#!/usr/bin/env bash
# Reproducible WASM build of upstream ggwave at a pinned commit.
# Needs emsdk on PATH (source ~/emsdk/emsdk_env.sh) or EMSDK set.
set -euo pipefail

GGWAVE_SHA=060aec73dd7123ccac200442f75bdc7369795ffe  # v0.4.3 + "emscripten: Emscripten fixup (#177)"

here="$(cd "$(dirname "$0")" && pwd)"
vendor="$here/.vendor/ggwave-$GGWAVE_SHA"
out="$here/dist"

if ! command -v em++ >/dev/null; then
  if [ -f "${EMSDK:-$HOME/emsdk}/emsdk_env.sh" ]; then
    # shellcheck disable=SC1091
    source "${EMSDK:-$HOME/emsdk}/emsdk_env.sh" >/dev/null 2>&1
  fi
fi
command -v em++ >/dev/null || { echo "em++ not found: install emsdk" >&2; exit 1; }

if [ ! -f "$vendor/src/ggwave.cpp" ]; then
  mkdir -p "$vendor"
  curl -fsSL "https://github.com/ggerganov/ggwave/archive/$GGWAVE_SHA.tar.gz" \
    | tar xz --strip-components=1 -C "$vendor"
fi

(cd "$vendor" && sha256sum --quiet -c "$here/SOURCES.sha256")

mkdir -p "$out"
# NDEBUG matches upstream's CMake Release build and drops assert() __FILE__ strings;
# the prefix map keeps any remaining paths machine-independent (reproducible, no local paths).
em++ -O3 -std=c++17 -flto -DNDEBUG -ffile-prefix-map="$vendor"=ggwave \
  -I "$vendor/include" -I "$vendor/src" \
  "$vendor/src/ggwave.cpp" "$vendor/bindings/javascript/emscripten.cpp" \
  -lembind \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createGgwave \
  -sALLOW_MEMORY_GROWTH=1 -sENVIRONMENT=web,worker,node \
  -sFILESYSTEM=0 -sASSERTIONS=0 \
  -o "$out/ggwave.mjs"

cp "$vendor/LICENSE" "$out/LICENSE.ggwave"
em++ --version | head -1 > "$out/BUILD_INFO"
echo "ggwave $GGWAVE_SHA" >> "$out/BUILD_INFO"
echo "built $out/ggwave.mjs"
