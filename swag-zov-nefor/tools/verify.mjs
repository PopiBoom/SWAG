// Decode the delivered MP4 and check: streams, exact frame count, audio level per section, scene-boundary contact sheet.
// node tools/verify.mjs export/file.mp4 build/check.jpg
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs'; import path from 'path';
import { SCENES } from '../js/data.js';
const [file, sheet] = process.argv.slice(2);
const p = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]).toString());
const v = p.streams.find(s => s.codec_type === 'video'), a = p.streams.find(s => s.codec_type === 'audio');
console.log(`video ${v.codec_name}/${v.profile} ${v.width}x${v.height} ${v.pix_fmt} r=${v.r_frame_rate} avg=${v.avg_frame_rate} frames=${v.nb_read_frames} dur=${v.duration}`);
console.log(a ? `audio ${a.codec_name} ${a.sample_rate}Hz ch=${a.channels} dur=${a.duration}` : 'audio: MISSING');
console.log(`frame count ${v.nb_read_frames} (expected 7200) -> ${+v.nb_read_frames === 7200 ? 'OK' : 'MISMATCH'}`);
const bounds = Object.entries(SCENES);
for (const [name, [t0, t1]] of bounds) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(t0), '-t', String(t1 - t0), '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
  const e = r.stderr.toString();
  console.log(`audio ${name.padEnd(9)} ${t0.toFixed(2)}-${t1.toFixed(2)}  mean ${(e.match(/mean_volume: (-?[\d.]+)/) || [])[1]} dB  max ${(e.match(/max_volume: (-?[\d.]+)/) || [])[1]} dB`);
}
if (sheet) {
  const times = [0.02, ...bounds.flatMap(([, [t0]]) => [Math.max(0, t0 - 0.04), t0 + 0.04]).slice(2), 119.6, 119.98];
  const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(sheet)), 'verify-'));
  times.forEach((t, i) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `scale=320:180,drawtext=text='${t.toFixed(2)}':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6`, path.join(tmp, `${String(i).padStart(2, '0')}.png`)]));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, '%02d.png'), '-vf', 'tile=6x6', '-frames:v', '1', sheet]);
  fs.rmSync(tmp, { recursive: true });
  console.log('sheet', sheet);
}
