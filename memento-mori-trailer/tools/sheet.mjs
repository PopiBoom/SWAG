// node tools/sheet.mjs out.jpg scale t1 t2 ... — renders stills and tiles them into one contact sheet
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
import { execFileSync } from 'child_process'; import fs from 'fs'; import path from 'path'; import os from 'os';
const [out, scale, ...times] = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), 'sheet-'));
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: +scale });
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('console', m => { const t = m.text(); if (!t.includes('404')) console.log('console:', t); });
await p.goto(`http://localhost:8130/?render&scale=${scale}${process.env.FLAGS || ""}`); await p.waitForFunction('window.__ready', null, { timeout: 300000 });
const files = [];
for (const [i, t] of times.entries()) {
  await p.evaluate(t => window.renderAt(t), +t);
  const f = path.join(tmp, `${String(i).padStart(3, '0')}.jpg`);
  await p.screenshot({ path: f, type: 'jpeg', quality: 88 });
  files.push(f);
}
await b.close();
const cols = Math.min(files.length, +(process.env.COLS || 6));
const rows = Math.ceil(files.length / cols);
const args = ['-v', 'error', '-y'];
files.forEach(f => args.push('-i', f));
const w = Math.round(1080 * +scale), h = Math.round(1920 * +scale);
let fc = files.map((_, i) => `[${i}]drawtext=text='${times[i]}':x=12:y=12:fontsize=${Math.round(28 * +scale)}:fontcolor=yellow:box=1:boxcolor=black@0.6[v${i}]`).join(';');
const pad = cols * rows - files.length;
fc += ';' + files.map((_, i) => `[v${i}]`).join('');
fc += `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join('|') + (pad ? `:fill=black` : '');
args.push('-filter_complex', fc, '-frames:v', '1', out);
if (files.length === 1) execFileSync('cp', [files[0], out]); else execFileSync('ffmpeg', args);
for (const f of files) fs.unlinkSync(f); fs.rmdirSync(tmp);
console.log('wrote', out);
