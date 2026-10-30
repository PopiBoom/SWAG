#!/usr/bin/env bash
# Склейка сегментов и сведение со звуком → out/SWAG_ZOV_NEFOR_digital_anarchy.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
ls out/segments/seg_*.mp4 | sort | sed "s|^|file '$PWD/|; s|$|'|" > out/segments/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/segments/list.txt -c copy out/video_only.mp4
ffmpeg -v error -y -i out/video_only.mp4 -i out/soundtrack.wav -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 320k -ar 48000 -movflags +faststart -t 117 out/SWAG_ZOV_NEFOR_digital_anarchy.mp4
ffmpeg -v error -y -i out/soundtrack.wav -c:a aac -b:a 192k out/soundtrack.m4a
echo "→ out/SWAG_ZOV_NEFOR_digital_anarchy.mp4"
