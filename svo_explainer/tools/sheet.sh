#!/usr/bin/env bash
# Контактный лист: tools/sheet.sh out.jpg COLS file1.jpg file2.jpg ...
set -e; out="$1"; cols="$2"; shift 2; tmp=$(mktemp -d); i=0
for f in "$@"; do lbl=$(basename "$f" .jpg | sed 's/^f_0*//'); ffmpeg -v error -y -i "$f" -vf "scale=640:360,drawtext=text='$lbl':x=8:y=8:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.7" "$tmp/$(printf %03d $i).png"; i=$((i+1)); done
rows=$(( (i + cols - 1) / cols )); ffmpeg -v error -y -framerate 1 -i "$tmp/%03d.png" -vf "tile=${cols}x${rows}:color=black" -frames:v 1 "$out"; rm -r "$tmp"; echo "$out"
