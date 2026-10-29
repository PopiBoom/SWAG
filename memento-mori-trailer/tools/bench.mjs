// node tools/bench.mjs scale t [n]  — average GPU frame time of renderAt(t)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const [scale, t, n = '3', extra = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: +scale });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(`http://localhost:8130/?render&scale=${scale}${extra}`); await p.waitForFunction('window.__ready', null, { timeout: 300000 });
const res = await p.evaluate(async ([t, n]) => {
  const gl = document.getElementById('gl').getContext('webgl2'); const px = new Uint8Array(4);
  await window.renderAt(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const a = performance.now();
  for (let i = 0; i < n; i++) { await window.renderAt(t + i / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  return (performance.now() - a) / n;
}, [+t, +n]);
const a = Date.now(); await p.screenshot({ type: 'jpeg', quality: 92 }); const shot = Date.now() - a;
console.log(`scale ${scale} t ${t}: ${res.toFixed(0)} ms/frame, screenshot ${shot} ms`);
await b.close();
