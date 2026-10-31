// Frame-exact export of a frame range: every frame i/fps via window.renderAt -> JPEG -> FFmpeg (lossless-ish intermediate).
// node tools/render.mjs --from 0 --to 7200 --out build/part.mkv [--sub 2] [--port 8140]
// --sub N renders N sub-frames inside the 180° shutter of each frame and averages them (motion blur).
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { spawn } from 'child_process';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fps = 60, from = +arg('from', 0), to = +arg('to', 7200), out = arg('out', 'build/part.mkv'), port = arg('port', '8140'), sub = +arg('sub', 1);
const vf = sub > 1 ? [`tmix=frames=${sub}:weights=${Array(sub).fill(1).join(' ')}`, `select='not(mod(n\\,${sub}))'`, 'setpts=N/(60*TB)'] : [];
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps * sub), '-c:v', 'mjpeg', '-i', '-',
  '-vf', [...vf, 'format=yuv444p'].join(','), '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-qp', '8', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const b = await chromium.launch({ args: ['--font-render-hinting=none'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.error('pageerror', e.message));
await p.goto(`http://localhost:${port}/?render`);
await p.waitForFunction('window.__ready', null, { timeout: 120000 });
const t0 = Date.now();
for (let i = from; i < to; i++) {
  for (let s = 0; s < sub; s++) {
    // sub-frames spread over half a frame (180° shutter), centred on the frame time
    const t = (i + (sub > 1 ? (s / (sub - 1) - 0.5) * 0.5 : 0)) / fps;
    await p.evaluate(t => window.renderAt(t), Math.max(0, t));
    const jpg = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
  }
  if ((i - from) % 120 === 0) { const el = (Date.now() - t0) / 1000, per = el / (i - from + 1); console.log(`[${from}-${to}] frame ${i}  ${per.toFixed(2)} s/frame  eta ${((to - i) * per / 60).toFixed(1)} min`); }
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await b.close();
console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
