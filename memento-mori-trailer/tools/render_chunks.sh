#!/usr/bin/env bash
# Resumable full render in 10-second chunks, then concat.  Usage: tools/render_chunks.sh OUTDIR SCALE FPS
set -euo pipefail
OUT="$1"; SCALE="${2:-1}"; FPS="${3:-60}"
mkdir -p "$OUT"
cd "$(dirname "$0")/.."
for c in 0 1 2 3 4 5; do
  f="$OUT/chunk_$c.mp4"
  [ -s "$f" ] && { echo "skip $f"; continue; }
  from=$((c * 10 * FPS)); to=$(((c + 1) * 10 * FPS))
  node tools/render.mjs --out "$f.part.mp4" --scale "$SCALE" --fps "$FPS" --from "$from" --to "$to" --crf 15 --preset slow --mb
  mv "$f.part.mp4" "$f"
done
: > "$OUT/list.txt"
for c in 0 1 2 3 4 5; do echo "file 'chunk_$c.mp4'" >> "$OUT/list.txt"; done
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/picture.mp4"
echo "ALL DONE $OUT/picture.mp4"
