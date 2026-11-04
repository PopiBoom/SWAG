// Проверка доставляемого MP4: потоки, число кадров, длительности, уровни звука по сценам, кадры у границ сцен.
// node tools/verify.mjs export/file.mp4 sheet.jpg
import { execFileSync, spawnSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const [file, sheet] = process.argv.slice(2);
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]).toString());
const v = probe.streams.find(s => s.codec_type === 'video'), a = probe.streams.find(s => s.codec_type === 'audio');
console.log(`video ${v.codec_name}/${v.profile} ${v.width}x${v.height} ${v.pix_fmt} fps=${v.r_frame_rate} avg=${v.avg_frame_rate} frames=${v.nb_read_frames} dur=${v.duration}`);
console.log(a ? `audio ${a.codec_name} ${a.sample_rate}Hz ch=${a.channels} dur=${a.duration}` : 'audio: MISSING');
console.log(`container ${probe.format.duration}s  ${(probe.format.size / 1e6).toFixed(1)} MB  ${(probe.format.bit_rate / 1e6).toFixed(1)} Mb/s`);
console.log(`frame count ${v.nb_read_frames} (expected 2250) -> ${+v.nb_read_frames === 2250 ? 'OK' : 'MISMATCH'}`);
if (a) for (let s = 0; s < 75; s += 8) { const t1 = Math.min(75, s === 64 ? 75 : s + 8); const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(s), '-t', String(t1 - s), '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']); const e = r.stderr.toString(); console.log(`audio ${s}-${t1}s mean ${(e.match(/mean_volume: (-?[\d.]+)/) || [])[1]} dB max ${(e.match(/max_volume: (-?[\d.]+)/) || [])[1]} dB`); if (s === 64) break; }
if (sheet) {
  const times = [0.0, 7.5, 7.73, 7.9, 8.1, 8.3, 15.83, 15.95, 16.05, 16.17, 31.6, 31.9, 32.2, 32.4, 39.65, 39.9, 40.1, 40.3, 47.75, 47.95, 48.1, 48.3, 55.55, 55.65, 56.0, 63.95, 64.05, 64.3, 74.0, 74.95];
  const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(sheet)), 'verify-'));
  times.forEach((t, i) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `scale=384:216,drawtext=text='${t}':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6`, path.join(tmp, `${String(i).padStart(2, '0')}.png`)]));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, '%02d.png'), '-vf', 'tile=5x6', '-frames:v', '1', sheet]);
  for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f)); fs.rmdirSync(tmp); console.log('sheet', sheet);
}
