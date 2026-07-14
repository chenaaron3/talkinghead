#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/whispermlx-env"
REQUIREMENTS="$ROOT/scripts/whispermlx/requirements.txt"

pick_python() {
  for candidate in "${PYTHON:-}" python3.13 python3.12 python3.11 python3; do
    if [[ -n "$candidate" && -x "$(command -v "$candidate" 2>/dev/null || true)" ]]; then
      version="$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
      major="${version%%.*}"
      minor="${version#*.}"
      if (( major == 3 && minor >= 10 && minor <= 13 )); then
        echo "$candidate"
        return 0
      fi
    fi
  done
  echo "Need Python 3.10–3.13 for whispermlx (not 3.14). Try: brew install python@3.13" >&2
  exit 1
}

PYTHON_BIN="$(pick_python)"
echo "[setup:whispermlx] using $("$PYTHON_BIN" --version) at $PYTHON_BIN"

if [[ ! -d "$VENV" ]]; then
  echo "[setup:whispermlx] creating venv at whispermlx-env/"
  "$PYTHON_BIN" -m venv "$VENV"
fi

source "$VENV/bin/activate"
python -m pip install --upgrade pip
python -m pip install -r "$REQUIREMENTS"

echo "[setup:whispermlx] pre-downloading MLX model (first run only)…"
python - <<'PY'
import numpy as np
import mlx_whisper

# Trigger HF download so process doesn't stall mid-transcription.
silence = np.zeros(16_000, dtype=np.float32)
mlx_whisper.transcribe(
    silence,
    path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
    language="en",
    verbose=False,
)
print("[setup:whispermlx] model ready")
PY

echo "[setup:whispermlx] done. Test with:"
echo "  whispermlx-env/bin/python scripts/whispermlx/transcribe.py --help"
