// Снимки отдельных моментов: node tools/snap.cjs out/snaps 1.0 2.5 ...
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const [outDir, ...times] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?render=1');
  await p.waitForFunction('window.ready', null, { timeout: 120000 });
  for (const t of times) {
    const t0 = Date.now();
    await p.evaluate((t) => window.renderAt(t), +t);
    await p.screenshot({ path: path.join(outDir, `t${(+t).toFixed(2).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 85 });
    console.log(t, Date.now() - t0, 'ms');
  }
  await b.close();
})();
