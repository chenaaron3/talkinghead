#!/usr/bin/env python3
"""Transcribe audio with whispermlx forced alignment; emit JSON on stdout."""

from __future__ import annotations

import argparse
import gc
import json
import sys

import mlx_whisper
import numpy as np

ALIGN_DEVICE = "cpu"

MLX_MODEL_MAP = {
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
    "turbo": "mlx-community/whisper-large-v3-turbo",
    "large-v3": "mlx-community/whisper-large-v3-mlx",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="whispermlx transcription for talking-head",
    )
    parser.add_argument("audio_path", help="Path to 16kHz mono WAV audio")
    parser.add_argument("--language", default="en", help="Language code (default: en)")
    parser.add_argument("--model", default="large-v3-turbo", help="Whisper model name")
    return parser.parse_args()


def resolve_model(name: str) -> str:
    if "/" in name:
        return name
    return MLX_MODEL_MAP.get(name, f"mlx-community/whisper-{name}-mlx")


def resolve_local_model(repo_or_path: str) -> str:
    """Prefer the on-disk HF cache so mlx_whisper never blocks on hub.repo_info()."""
    from pathlib import Path

    if Path(repo_or_path).exists():
        return repo_or_path
    try:
        from huggingface_hub import snapshot_download

        local = snapshot_download(repo_or_path, local_files_only=True)
        print(f"[whispermlx] using cached model at {local}", file=sys.stderr)
        return local
    except Exception:
        print(
            f"[whispermlx] cache miss for {repo_or_path}; downloading from Hugging Face…",
            file=sys.stderr,
            flush=True,
        )
        return repo_or_path


def main() -> int:
    args = parse_args()

    try:
        import whispermlx
    except ImportError:
        print(
            "whispermlx is not installed. Run: pnpm setup:whispermlx",
            file=sys.stderr,
        )
        return 1

    model_path = resolve_local_model(resolve_model(args.model))
    print(f"[whispermlx] loading audio…", file=sys.stderr)
    audio = whispermlx.load_audio(args.audio_path)
    duration_sec = len(audio) / 16_000
    print(f"[whispermlx] audio={duration_sec:.1f}s", file=sys.stderr)

    print(
        f"[whispermlx] transcribing model={model_path} (MLX, no VAD)",
        file=sys.stderr,
    )
    mlx_result = mlx_whisper.transcribe(
        audio,
        path_or_hf_repo=model_path,
        language=args.language,
        verbose=False,
        word_timestamps=False,
    )
    language = mlx_result.get("language") or args.language

    segments: list[dict[str, float | str]] = []
    for seg in mlx_result.get("segments", []):
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        segments.append(
            {
                "text": text,
                "start": float(seg["start"]),
                "end": float(seg["end"]),
            },
        )

    if not segments:
        text = str(mlx_result.get("text", "")).strip()
        if text:
            segments.append({"text": text, "start": 0.0, "end": duration_sec})

    print(
        f"[whispermlx] aligning {len(segments)} segment(s), language={language}",
        file=sys.stderr,
    )
    align_model, metadata = whispermlx.load_align_model(
        language_code=language,
        device=ALIGN_DEVICE,
    )
    result = whispermlx.align(
        segments,
        align_model,
        metadata,
        np.asarray(audio),
        device=ALIGN_DEVICE,
        return_char_alignments=False,
    )

    del align_model
    gc.collect()

    captions: list[dict[str, float | str]] = []
    for segment in result.get("segments", []):
        for word in segment.get("words") or []:
            text = str(word.get("word", "")).strip()
            start = word.get("start")
            end = word.get("end")
            if not text or start is None or end is None:
                continue
            start_f = float(start)
            end_f = float(end)
            if end_f <= start_f:
                continue
            captions.append({"text": text, "start": start_f, "end": end_f})

    duration = max((c["end"] for c in captions), default=duration_sec)

    print(
        f"[whispermlx] wrote {len(captions)} word(s), duration={duration:.2f}s",
        file=sys.stderr,
    )

    payload = {
        "language": language,
        "duration": duration,
        "captions": captions,
    }
    json.dump(payload, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
