#!/usr/bin/env bash
# Превью одного 10-секундного сегмента со звуком: tools/preview_seg.sh 1200 → out/preview_20-30s.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
f=$1; s=$((10#$f / 60)); e=$((s + 10)); [ $e -gt 117 ] && e=117
ffmpeg -v error -y -i out/segments/seg_$(printf %05d $((10#$f))).mp4 -ss $s -i out/soundtrack.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 256k -t $((e - s)) -movflags +faststart out/preview_${s}-${e}s.mp4
echo out/preview_${s}-${e}s.mp4
