#!/usr/bin/env bash
# Full export: 4 parallel chunks of 1800 frames (2 sub-frames each = motion blur), then concat.
# Needs the static server: node tools/serve.mjs 8140 &
set -e
cd "$(dirname "$0")/.."
mkdir -p build
for k in 0 1 2 3; do
  a=$((k*1800)); b=$(((k+1)*1800))
  [ -f build/part$k.done ] || (node tools/render.mjs --from $a --to $b --out build/part$k.mkv --sub 2 > build/part$k.log 2>&1 && touch build/part$k.done) &
done
wait
printf "file 'part0.mkv'\nfile 'part1.mkv'\nfile 'part2.mkv'\nfile 'part3.mkv'\n" > build/parts.txt
ffmpeg -v error -y -f concat -safe 0 -i build/parts.txt -c copy build/picture.mkv
echo picture done
