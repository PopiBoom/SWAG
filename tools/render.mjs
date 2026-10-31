// Deterministic export: every frame i is rendered at t = i / fps, piped to FFmpeg, then muxed with the soundtrack.
//   node tools/render.mjs --scale 1 --fps 60 --workers 3 --out out/MEMENTO_MORI.mp4
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { spawn, execFileSync } from 'child_process';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const scale = +arg('scale', 1), fps = +arg('fps', 60), workers = +arg('workers', 3), out = arg('out', 'out/MEMENTO_MORI.mp4');
const crf = arg('crf', '17'), preset = arg('preset', 'slow'), port = arg('port', '8123');
const t0 = +arg('from', 0), t1 = +arg('to', 135);
const W = Math.round(1080 * scale / 2) * 2, H = Math.round(1920 * scale / 2) * 2;
const first = Math.round(t0 * fps), last = Math.round(t1 * fps); // [first, last)
const total = last - first;
const tmp = path.join(path.dirname(out), '_seg_' + path.basename(out, '.mp4')); fs.mkdirSync(tmp, { recursive: true });
const per = Math.ceil(total / workers);
const started = Date.now();
let done = 0;

async function work(w) {
  const a = first + w * per, b = Math.min(last, a + per); if (a >= b) return null;
  const seg = path.join(tmp, `seg${w}.mp4`);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(fps), '-threads', '2', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.log(`[w${w}] PAGEERR`, e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?scale=${scale}`);
  await page.waitForFunction(() => window.ready, null, { timeout: 600000 });
  for (let i = a; i < b; i++) {
    const b64 = await page.evaluate(async (t) => {
      window.renderAt(t); const c = document.getElementById('view');
      const bl = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.96)); const u = new Uint8Array(await bl.arrayBuffer());
      let s = ''; for (let k = 0; k < u.length; k += 32768) s += String.fromCharCode.apply(null, u.subarray(k, k + 32768)); return btoa(s);
    }, i / fps);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    done++;
    if (done % 100 === 0) { const el = (Date.now() - started) / 1000; console.log(`${done}/${total} frames  ${(el / done).toFixed(2)} s/frame  eta ${((total - done) * el / done / 60).toFixed(1)} min`); }
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
  return seg;
}
const segs = (await Promise.all([...Array(workers).keys()].map(work))).filter(Boolean);
const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, segs.map(s => `file '${path.resolve(s)}'`).join('\n'));
const video = path.join(tmp, 'video.mp4');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
// mux with the soundtrack (cut to the same span; no -shortest so nothing is trimmed accidentally)
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', video, '-ss', String(t0), '-t', String(t1 - t0), '-i', 'audio/mix.wav',
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', out]);
console.log('wrote', out, `in ${((Date.now() - started) / 60000).toFixed(1)} min`);
