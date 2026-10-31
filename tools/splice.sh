#!/bin/sh
# Replace re-rendered ranges of the master with patch renders (frame-exact), remux the current soundtrack,
# and write the two deliverables: high-quality master + Telegram-friendly file.
set -e
cd "$(dirname "$0")/.."
M=out/MEMENTO_MORI_1080x1920_60fps_v1.mp4
ffmpeg -loglevel error -y -i "$M" -i out/patch1.mp4 -i out/patch2.mp4 -i out/patch3.mp4 -i audio/mix.wav -filter_complex "\
[0:v]split=4[m1][m2][m3][m4];\
[m1]trim=start_frame=0:end_frame=1470,setpts=PTS-STARTPTS[a];\
[1:v]setpts=PTS-STARTPTS[p1];\
[m2]trim=start_frame=1740:end_frame=3240,setpts=PTS-STARTPTS[b];\
[2:v]setpts=PTS-STARTPTS[p2];\
[m3]trim=start_frame=4200:end_frame=6000,setpts=PTS-STARTPTS[c];\
[3:v]setpts=PTS-STARTPTS[p3];\
[m4]trim=start_frame=6696,setpts=PTS-STARTPTS[d];\
[a][p1][b][p2][c][p3][d]concat=n=7:v=1:a=0,fps=60,split=2[v1][v2]" \
  -map "[v1]" -map 4:a -c:v libx264 -preset slow -crf 17 -maxrate 30M -bufsize 60M -profile:v high -level 5.1 -pix_fmt yuv420p \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart out/MEMENTO_MORI_1080x1920_60fps.mp4 \
  -map "[v2]" -map 4:a -c:v libx264 -preset slow -crf 20 -maxrate 12M -bufsize 24M -profile:v high -level 4.2 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart out/MEMENTO_MORI_telegram.mp4
echo spliced
