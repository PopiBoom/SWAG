// Encode the delivery file from the rendered picture + soundtrack and print what was actually written.
// node tools/mux.mjs picture.mp4 soundtrack.wav out.mp4 [--size 2160x3840] [--crf 18] [--maxrate 40M] [--copy]
import { execFileSync } from 'child_process';
const [video, audio, out] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const size = opt('size', null), crf = opt('crf', '18'), maxrate = opt('maxrate', '40M');
const args = ['-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-t', '60'];
if (process.argv.includes('--copy')) {
  args.push('-c:v', 'copy');
} else {
  const vf = size ? `scale=${size.replace('x', ':')}:flags=lanczos,unsharp=5:5:0.35:5:5:0.0,format=yuv420p` : 'format=yuv420p';
  const bufsize = (parseInt(maxrate, 10) * 2) + 'M';
  args.push('-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-maxrate', maxrate, '-bufsize', bufsize,
    '-profile:v', 'high', '-level', size ? '5.2' : '4.2', '-r', '60', '-g', '120', '-bf', '2');
}
args.push('-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-count_frames', '-of', 'json', out]).toString());
for (const s of probe.streams) {
  if (s.codec_type === 'video') console.log(`video: ${s.codec_name} ${s.profile} ${s.width}x${s.height} ${s.pix_fmt} ${s.r_frame_rate} frames=${s.nb_read_frames} dur=${s.duration}`);
  else console.log(`audio: ${s.codec_name} ${s.sample_rate}Hz ${s.channels}ch dur=${s.duration}`);
}
console.log(`container duration: ${probe.format.duration}s, size ${(probe.format.size / 1e6).toFixed(1)} MB, bitrate ${(probe.format.bit_rate / 1e6).toFixed(1)} Mb/s`);
