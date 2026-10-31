// Final delivery: picture + soundtrack -> MP4 (H.264 High, yuv420p, 60 fps CFR, AAC 48 kHz), exactly 120 s.
// node tools/mux.mjs build/picture.mkv assets/audio/soundtrack.wav export/SWAG_ZOV_NEFOR_1920x1080_60fps.mp4
import { execFileSync } from 'child_process';
const [video, audio, out] = process.argv.slice(2);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-t', '120',
  '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-maxrate', '30M', '-bufsize', '60M',
  '-profile:v', 'high', '-level', '4.2', '-r', '60', '-g', '120', '-bf', '2',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', out], { stdio: 'inherit' });
const p = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-count_frames', '-of', 'json', out]).toString());
for (const s of p.streams) console.log(s.codec_type === 'video'
  ? `video: ${s.codec_name} ${s.profile} ${s.width}x${s.height} ${s.pix_fmt} ${s.r_frame_rate} frames=${s.nb_read_frames} dur=${s.duration}`
  : `audio: ${s.codec_name} ${s.sample_rate}Hz ${s.channels}ch dur=${s.duration}`);
console.log(`container ${p.format.duration}s, ${(p.format.size / 1e6).toFixed(1)} MB, ${(p.format.bit_rate / 1e6).toFixed(1)} Mb/s`);
