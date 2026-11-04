#!/usr/bin/env bash
# Параллельный рендер 75 с × 30 fps в 4 потока, склейка без перекодирования.  tools/render_all.sh export/frames
set -euo pipefail; OUT="$1"; FPS=30; TOTAL=2250; mkdir -p "$OUT"; cd "$(dirname "$0")/.."
B=(0 570 1140 1690 2250)
for c in 0 1 2 3; do f="$OUT/part_$c.mp4"; [ -s "$f" ] && continue; node tools/render.mjs --out "$f.tmp.mp4" --from ${B[$c]} --to ${B[$((c+1))]} --fps $FPS > "$OUT/log_$c.txt" 2>&1 && mv "$f.tmp.mp4" "$f" & done; wait
: > "$OUT/list.txt"; for c in 0 1 2 3; do echo "file 'part_$c.mp4'" >> "$OUT/list.txt"; done
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/picture.mp4"; echo "ALL DONE $OUT/picture.mp4"
