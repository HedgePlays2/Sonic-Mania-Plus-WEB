#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CXX="${CXX:-clang++}"

for tool in "$CXX" python3 node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool" >&2
    exit 127
  fi
done

COMMON_FLAGS=(
  --target=wasm32-unknown-unknown
  -std=c++17
  -O2
  -nostdlib
  -fno-exceptions
  -fno-rtti
  -Wl,--no-entry
  -Wl,--export=mod_init
  -Wl,--export=mod_update
  -Wl,--export=mod_shutdown
  -Wl,--strip-all
)

"${CXX}" "${COMMON_FLAGS[@]}" \
  "${SCRIPT_DIR}/cpp-wasm-smoke-test/main.cpp" \
  -o "${SCRIPT_DIR}/cpp-wasm-smoke-test/cpp-wasm-smoke-test.wasm"

"${CXX}" "${COMMON_FLAGS[@]}" \
  "${SCRIPT_DIR}/super-speed-indicator/super_speed_indicator.cpp" \
  -o "${SCRIPT_DIR}/super-speed-indicator/super-speed-indicator.wasm"

python3 - "${SCRIPT_DIR}" <<'PY'
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import sys

examples = Path(sys.argv[1])
folder = examples / "super-speed-indicator"
archive = folder / "Super-Speed-Mod.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as zf:
    zf.write(folder / "mod.json", "mod.json")
    zf.write(folder / "super-speed-indicator.wasm", "super-speed-indicator.wasm")
print(f"Created {archive.relative_to(examples.parent)}")
PY

node "${SCRIPT_DIR}/test-wasm-lifecycle.mjs"
