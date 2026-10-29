// Frame-exact export: renders every frame i/fps via window.renderAt and pipes JPEG frames into FFmpeg.
// node tools/render.mjs --out video.mp4 --scale 1 --fps 60 [--from 0] [--to 3600] [--crf 16] [--port 8130]
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
import { spawn } from 'child_process';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'render.mp4'), scale = +arg('scale', 1), fps = +arg('fps', 60), crf = arg('crf', '16'), port = arg('port', '8130');
const mb = process.argv.includes('--mb');
const from = +arg('from', 0), to = +arg('to', Math.round(60 * fps)), quality = +arg('q', 95), preset = arg('preset', 'slow');
const W = Math.round(1080 * scale / 2) * 2, H = Math.round(1920 * scale / 2) * 2;
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-profile:v', 'high', '-r', String(fps), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
p.on('pageerror', e => console.error('pageerror', e.message));
await p.goto(`http://localhost:${port}/?render&scale=${scale}`);
await p.waitForFunction('window.__ready', null, { timeout: 600000 });
const t0 = Date.now();
for (let i = from; i < to; i++) {
  await p.evaluate(([t, mb]) => window.renderAt(t, mb ? window.motionBlurAt(t) : {}), [i / fps, mb]);
  const jpg = await p.screenshot({ type: 'jpeg', quality });
  if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
  if ((i - from) % 30 === 0) {
    const el = (Date.now() - t0) / 1000, per = el / (i - from + 1);
    console.log(`frame ${i}/${to}  ${per.toFixed(2)} s/frame  eta ${((to - i) * per / 60).toFixed(1)} min`);
  }
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await b.close();
console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
