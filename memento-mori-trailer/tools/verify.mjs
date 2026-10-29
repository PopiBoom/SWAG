// Decode the delivered MP4 and check it: streams, exact frame count, A/V durations, audio level per section,
// and a contact sheet of frames before/after every scene boundary.
// node tools/verify.mjs export/file.mp4 sheet.jpg
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs'; import path from 'path';
const [file, sheet] = process.argv.slice(2);
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]).toString());
const v = probe.streams.find(s => s.codec_type === 'video'), a = probe.streams.find(s => s.codec_type === 'audio');
console.log(`video ${v.codec_name}/${v.profile} ${v.width}x${v.height} ${v.pix_fmt} fps=${v.r_frame_rate} avg=${v.avg_frame_rate} frames=${v.nb_read_frames} dur=${v.duration}`);
console.log(a ? `audio ${a.codec_name} ${a.sample_rate}Hz ch=${a.channels} dur=${a.duration}` : 'audio: MISSING');
const fps = eval(v.r_frame_rate);
const expect = Math.round(60 * fps);
console.log(`frame count ${v.nb_read_frames} (expected ${expect}) -> ${+v.nb_read_frames === expect ? 'OK' : 'MISMATCH'}`);
if (a) {
  for (const [t0, t1] of [[0, 4], [4, 7], [7, 15], [15, 24], [24, 33], [33, 42], [42, 51], [51, 58.5], [58.5, 60]]) {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(t0), '-t', String(t1 - t0), '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
    const err = r.stderr.toString();
    const mean = (err.match(/mean_volume: (-?[\d.]+)/) || [])[1], max = (err.match(/max_volume: (-?[\d.]+)/) || [])[1];
    console.log(`audio ${t0}-${t1}s mean ${mean} dB, max ${max} dB`);
  }
}
if (sheet) {
  const times = [0.5, 3.0, 4.05, 6.9, 7.02, 9.5, 12.5, 14.98, 15.02, 17.8, 18.05, 21.05, 23.1, 23.6, 24.05, 28.4, 29.1, 32.45, 32.7, 33.4, 36.3, 40.9, 42.1, 45.5, 46.3, 52.6, 55.5, 57.5, 59.0, 59.98];
  const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(sheet)), 'verify-'));
  times.forEach((t, i) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `scale=216:384,drawtext=text='${t}':x=6:y=6:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.6`, path.join(tmp, `${String(i).padStart(2, '0')}.png`)]));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, '%02d.png'), '-vf', 'tile=10x3', '-frames:v', '1', sheet]);
  for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f));
  fs.rmdirSync(tmp);
  console.log('sheet', sheet);
}
