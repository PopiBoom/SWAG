// Покадровый экспорт: каждый кадр i/fps через window.renderAt (с субкадровым motion blur) → FFmpeg (H.264).
// node tools/render.mjs --out part.mp4 --from 0 --to 2250 [--fps 30] [--crf 14]
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { spawn } from 'child_process';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'render.mp4'), fps = +arg('fps', 30), crf = arg('crf', '14'), from = +arg('from', 0), to = +arg('to', 75 * fps);
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.error('pageerror', e.message));
await p.goto('http://localhost:8140/?render'); await p.waitForFunction('window.__ready', null, { timeout: 600000 });
const t0 = Date.now();
for (let i = from; i < to; i++) {
  await p.evaluate(t => window.renderAt(t, window.mbSamples(t)), i / fps);
  const img = await p.screenshot({ type: 'png' });
  if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
  if ((i - from) % 150 === 0) { const per = (Date.now() - t0) / 1000 / (i - from + 1); console.log(`${out}: ${i}/${to} ${per.toFixed(2)} s/f eta ${((to - i) * per / 60).toFixed(1)} min`); }
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
