// Контрольные кадры: node tools/still.mjs outdir t1 t2 ...   (печатает время рендера каждого кадра)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'fs';
const [dir, ...times] = process.argv.slice(2); fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8140/?render'); await p.waitForFunction('window.__ready', null, { timeout: 300000 }).catch(e => { console.log('ERR', errs); throw e; });
for (const t of times) { const t0 = Date.now(); await p.evaluate(t => window.renderAt(+t, 1), t); const ms = Date.now() - t0; await p.screenshot({ path: `${dir}/f_${(+t).toFixed(2).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 88 }); console.log(t, ms + 'ms'); }
if (errs.length) console.log('ERRORS', errs);
await b.close();
