// Render stills: node tools/still.mjs out_dir scale t1 t2 ...  (needs tools/serve.mjs running on 8130)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const [out, scale, ...times] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: +scale });
p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => { if (m.type() !== 'debug') console.log('console:', m.text()); });
const t0 = Date.now();
await p.goto(`http://localhost:8130/?render&scale=${scale}`); await p.waitForFunction('window.__ready', null, { timeout: 300000 });
console.log('load', Date.now() - t0, 'ms');
for (const t of times) {
  const a = Date.now();
  await p.evaluate(t => window.renderAt(t), +t);
  const r = Date.now();
  await p.screenshot({ path: `${out}/still_${String(t).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
  console.log('t', t, 'render', r - a, 'ms, shot', Date.now() - r, 'ms');
}
await b.close();
