// Render stills at given times: node tools/still.mjs outdir t1 t2 ... [--port 8140] [--sheet sheet.jpg]
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'fs'; import { execFileSync } from 'child_process';
const args = process.argv.slice(2); const opt = k => { const i = args.indexOf('--' + k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const port = opt('port') || '8140', sheet = opt('sheet');
const [out, ...ts] = args; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--font-render-hinting=none'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.error('pageerror', e.message)); p.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
await p.goto(`http://localhost:${port}/?render`); await p.waitForFunction('window.__ready', null, { timeout: 120000 });
const files = [];
for (const t of ts) {
  const t0 = Date.now(); await p.evaluate(t => window.renderAt(t), +t);
  const f = `${out}/t${(+t).toFixed(2).padStart(6, '0')}.jpg`; await p.screenshot({ path: f, type: 'jpeg', quality: 85 }); files.push(f);
  console.log(t, Date.now() - t0, 'ms');
}
await b.close();
if (sheet) {
  const cols = Math.min(4, files.length);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex',
    files.map((f, i) => `[${i}]scale=480:270,drawtext=text='${ts[i]}':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6[v${i}]`).join(';') + ';' +
    files.map((f, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=${files.map((f, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|')}`, '-frames:v', '1', sheet]);
  console.log('sheet', sheet);
}
