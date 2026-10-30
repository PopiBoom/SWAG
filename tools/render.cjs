// Покадровый рендер в MP4-сегменты по 10 с (600 кадров): node tools/render.cjs <workers> [fromSec] [toSec]
// Повторный запуск с диапазоном перерисовывает только затронутые сегменты; tools/assemble.sh склеивает их со звуком.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const SEGDIR = path.join(ROOT, 'out', 'segments');
const FPS = 60, CHUNK = 600, DUR = 117;
const TOTAL = DUR * FPS;

async function worker(id, queue) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => console.log(`[w${id}] pageerror`, e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html') + '?render=1');
  await p.waitForFunction('window.ready', null, { timeout: 180000 });
  while (queue.length) {
    const [f0, f1] = queue.shift();
    const seg = path.join(SEGDIR, `seg_${String(f0).padStart(5, '0')}.mp4`);
    const tmp = seg + '.part.mp4';
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '120', '-bf', '2', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      await p.evaluate((t) => window.renderAt(t), f / FPS);
      const png = await p.screenshot({ type: 'jpeg', quality: 97 });
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((f - f0) % 120 === 119) console.log(`[w${id}] seg ${f0}: ${f - f0 + 1}/${f1 - f0}  ${((Date.now() - t0) / 1000 / (f - f0 + 1)).toFixed(2)} s/f`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    fs.renameSync(tmp, seg);
    console.log(`[w${id}] done seg ${f0}-${f1} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  await b.close();
}

(async () => {
  fs.mkdirSync(SEGDIR, { recursive: true });
  const workers = +(process.argv[2] || 3);
  const from = Math.floor(+(process.argv[3] || 0) * FPS), to = Math.ceil(+(process.argv[4] || DUR) * FPS);
  const queue = [];
  for (let f = 0; f < TOTAL; f += CHUNK) { const e = Math.min(TOTAL, f + CHUNK); if (e > from && f < to) queue.push([f, e]); }
  // сначала тяжёлые сегменты (город), чтобы воркеры закончили примерно одновременно
  queue.sort((a, b) => (b[0] >= 3960 && b[0] < 5100 ? 1 : 0) - (a[0] >= 3960 && a[0] < 5100 ? 1 : 0));
  console.log('segments:', queue.map((q) => q[0]).join(' '));
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i, queue)));
  console.log('all done');
})();
