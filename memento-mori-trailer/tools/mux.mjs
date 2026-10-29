// Mux the rendered picture with the soundtrack and verify the result.
// node tools/mux.mjs video.mp4 assets/audio/soundtrack.wav out.mp4 [--upscale 2160x3840]
import { execFileSync } from 'child_process';
const [video, audio, out] = process.argv.slice(2);
const up = process.argv.includes('--upscale') ? process.argv[process.argv.indexOf('--upscale') + 1] : null;
const args = ['-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-t', '60'];
if (up) {
  const [w, h] = up.split('x');
  args.push('-vf', `scale=${w}:${h}:flags=lanczos,unsharp=5:5:0.35:5:5:0.0,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '5.2');
} else {
  args.push('-c:v', 'copy');
}
args.push('-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-count_frames', '-of', 'json', out]).toString());
for (const s of probe.streams) {
  if (s.codec_type === 'video') console.log(`video: ${s.codec_name} ${s.profile} ${s.width}x${s.height} ${s.pix_fmt} ${s.r_frame_rate} frames=${s.nb_read_frames} dur=${s.duration}`);
  else console.log(`audio: ${s.codec_name} ${s.sample_rate}Hz ${s.channels}ch dur=${s.duration}`);
}
console.log(`container duration: ${probe.format.duration}s, size ${(probe.format.size / 1e6).toFixed(1)} MB`);
