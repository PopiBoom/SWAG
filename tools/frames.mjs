// Render individual frames for review:  node tools/frames.mjs --scale 0.5 --times 1,5.5,9 --out out/review
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const scale = +arg('scale', 0.5), out = arg('out', 'out/review'), port = arg('port', '8123');
let times = arg('times', '');
if (arg('range')) { const [a, b, st] = arg('range').split(':').map(Number); times = []; for (let t = a; t <= b + 1e-9; t += st) times.push(+t.toFixed(4)); }
else times = times.split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const W = Math.round(1080 * scale), H = Math.round(1920 * scale);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('PAGE', m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${port}/index.html?scale=${scale}&msaa=${arg('msaa', 0)}`);
await p.waitForFunction(() => window.ready, null, { timeout: 300000 });
for (const t of times) {
  const t0 = Date.now();
  const data = await p.evaluate(async (t) => {
    const name = window.renderAt(t); const c = document.getElementById('view');
    const bl = await new Promise(r => c.toBlob(r, 'image/png')); const u = new Uint8Array(await bl.arrayBuffer());
    let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return [name, btoa(s)];
  }, t);
  const f = path.join(out, `t${t.toFixed(2).padStart(7, '0')}.png`);
  fs.writeFileSync(f, Buffer.from(data[1], 'base64'));
  console.log(f, data[0], Date.now() - t0, 'ms');
}
await b.close();
