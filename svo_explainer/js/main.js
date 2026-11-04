// Таймлайн, переходы, motion blur, плеер (один requestAnimationFrame) и режим покадрового экспорта.
'use strict';
(() => {
const { clamp, lerp, inv, smooth, ease, C } = V;
const S = V.scenes;
const mk = () => { const c = document.createElement('canvas'); c.width = V.W; c.height = V.H; return [c, c.getContext('2d')]; };
const [bufA, gA] = mk(), [bufB, gB] = mk(), [frame, gF] = mk(), [accum, gAc] = mk(), [live8, gL8] = mk();
const reset = g => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowBlur = 0; };

// [начало, конец, сцена]
const SEG = [[0, 7.75, 's1'], [7.75, 8.25, 'T1'], [8.25, 15.85, 's2'], [15.85, 16.15, 'T2'], [16.15, 31.7, 's34'], [31.7, 32.35, 'T3'], [32.35, 39.7, 's5'], [39.7, 40.25, 'T4'], [40.25, 47.8, 's6'], [47.8, 48.25, 'T5'], [48.25, 55.6, 's7'], [55.6, 64.0, 's8'], [64.0, 75.01, 's9']];
const draw = (name, g, t) => { reset(g); if (name === 's9') { reset(gL8); if (t < 65.2) S.s8(gL8, t); S.s9(g, t, live8); } else S[name](g, t); };
const zoomDraw = (g, src, cx, cy, sc, alpha, blurSteps = 0) => {
  g.save();
  for (let k = blurSteps; k >= 0; k--) { const s = sc * (1 + k * .025 * (sc - 1 + .2)); g.globalAlpha = alpha * (k ? .18 : 1); g.setTransform(s, 0, 0, s, cx - cx * s, cy - cy * s); g.drawImage(src, 0, 0); }
  g.restore();
};
const flash = (g, col, a) => { if (a <= 0) return; g.save(); g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, V.W, V.H); g.restore(); };
V.renderScene = (g, t) => {
  reset(g);
  const seg = SEG.find(s => t >= s[0] && t < s[1]) || SEG[SEG.length - 1], name = seg[2];
  if (name[0] === 's') { draw(name, g, t); return; }
  const k = inv(seg[0], seg[1], t);
  g.fillStyle = '#000'; g.fillRect(0, 0, V.W, V.H);
  if (name === 'T1') { // нырок сквозь карту в командный центр
    draw('s1', gA, t); draw('s2', gB, t); const e = ease.io(k);
    zoomDraw(g, bufA, V.W / 2, V.H / 2, 1 + ease.in(k) * .9, 1 - e, 4);
    zoomDraw(g, bufB, V.W / 2, V.H / 2, lerp(.86, 1, ease.out(k)), e, 2);
    flash(g, 'rgba(120,230,255,1)', .32 * Math.sin(k * Math.PI));
    V.glitch(g, k < .5 ? bufA : bufB, Math.sin(k * Math.PI) * .3, Math.round(t * 30));
  } else if (name === 'T2') { // резкая glitch-склейка
    const src = t < 16 ? bufA : bufB; draw(t < 16 ? 's2' : 's34', t < 16 ? gA : gB, t);
    g.drawImage(src, 0, 0); V.glitch(g, src, 1 - Math.abs(t - 16) / .15, Math.round(t * 30) + 7);
    flash(g, '#fff', .18 * (1 - Math.abs(t - 16) / .15));
  } else if (name === 'T3') { // подъём в космос
    draw('s34', gA, t); draw('s5', gB, t); const e = smooth(k);
    zoomDraw(g, bufA, V.W / 2, V.H * .45, 1 - .25 * e, 1, 3);
    zoomDraw(g, bufB, V.W / 2, V.H / 2, lerp(1.18, 1, ease.out(k)), e, 3);
  } else if (name === 'T4') { // погружение в голопанель → лаборатория
    draw('s5', gA, t); draw('s6', gB, t); const e = ease.io(k);
    zoomDraw(g, bufA, 1430, 500, 1 + ease.in(k) * 1.8, 1 - e, 4);
    zoomDraw(g, bufB, V.W / 2, V.H / 2, lerp(.82, 1, ease.out(k)), e, 2);
    flash(g, 'rgba(160,240,255,1)', .45 * Math.sin(k * Math.PI));
  } else if (name === 'T5') { // смена языка: цифровое → документальное
    draw('s6', gA, t); draw('s7', gB, t); const e = smooth(inv(.35, .75, k));
    g.drawImage(bufA, 0, 0); if (k < .5) V.glitch(g, bufA, k * 1.6, Math.round(t * 30) + 3);
    g.save(); g.globalAlpha = e; g.drawImage(bufB, 0, 0); g.restore();
    flash(g, 'rgba(255,236,210,1)', .6 * Math.max(0, 1 - Math.abs(k - .45) / .35));
  }
};
// где нужен смаз движения и сколько субкадров
const MB = [[7.4, 8.4, 5], [15.8, 16.2, 3], [23.9, 25.0, 3], [30.6, 32.8, 5], [39.5, 40.5, 5], [47.7, 48.3, 3], [55.7, 57.6, 3], [64.0, 66.2, 5], [69.7, 71.2, 3]];
V.mbSamples = t => { for (const [a, b, n] of MB) if (t >= a && t < b) return n; return 1; };
V.renderAt = (t, samples) => {
  const n = samples || 1, shutter = .5 / V.FPS;
  if (n === 1) V.renderScene(gF, t);
  else { reset(gAc); for (let i = 0; i < n; i++) { V.renderScene(gF, t + (i / (n - 1) - .5) * shutter); gAc.globalAlpha = 1 / (i + 1); gAc.drawImage(frame, 0, 0); } reset(gF); gF.drawImage(accum, 0, 0); }
  // общая пост-обработка: виньетка, зерно, финальное затемнение
  const doc = t >= 48.1 && t < 55.8;
  V.post(gF, t, { grain: doc ? .14 : .07, vig: doc ? .6 : .55 });
  const fo = smooth(inv(73.9, 74.96, t)); if (fo > 0) { gF.fillStyle = `rgba(0,0,0,${fo})`; gF.fillRect(0, 0, V.W, V.H); }
  if (V.out) { V.outCtx.setTransform(1, 0, 0, 1, 0, 0); V.outCtx.drawImage(frame, 0, 0, V.out.width, V.out.height); }
  return frame;
};

// ---------- загрузка ----------
const qs = new URLSearchParams(location.search), RENDER = qs.has('render');
const boot = async () => {
  const ff = new FontFace(V.FONT, 'url(assets/Montserrat.ttf)', { weight: '100 900' }); await ff.load(); document.fonts.add(ff);
  await document.fonts.ready;
  const [countries, land] = await Promise.all([fetch('assets/countries-50m.json').then(r => r.json()), fetch('assets/land-110m.json').then(r => r.json())]);
  V.initMap(countries); V.initGlobe(land, countries); V.initGrain();
  const [tc, tg] = mk();
  V.makeThumbs(tt => { V.renderScene(tg, tt); return tc; });
  const [sc, sg] = mk(); S.s7(sg, 55.6); V.makeSnap(sc);
  // вывод
  const cv = document.getElementById('c');
  const dpr = RENDER ? 1 : Math.min(2, window.devicePixelRatio || 1);
  cv.width = V.W * dpr; cv.height = V.H * dpr; V.out = cv; V.outCtx = cv.getContext('2d'); V.outCtx.imageSmoothingQuality = 'high';
  window.renderAt = (t, n) => { V.renderAt(t, n); return true; }; window.mbSamples = V.mbSamples;
  window.__ready = true;
  if (RENDER) { document.body.classList.add('render'); return; }
  // плеер: время берётся из аудио (если играет), один requestAnimationFrame
  const au = document.getElementById('a'); let t0 = performance.now() - (+qs.get('t') || 0) * 1000, playing = false, last = +qs.get('t') || 0;
  au.currentTime = last;
  const toggle = () => { playing = !playing; if (playing) { t0 = performance.now() - last * 1000; au.currentTime = last; au.play().catch(() => {}); } else au.pause(); document.body.classList.toggle('playing', playing); };
  document.getElementById('play').onclick = toggle; addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle(); } });
  const loop = now => {
    if (playing) { last = !au.paused && au.readyState > 2 ? au.currentTime : (now - t0) / 1000; if (last >= V.DUR) { last = V.DUR - 1 / V.FPS; toggle(); } }
    V.renderAt(Math.min(last, V.DUR - 1e-3), 1);
    document.getElementById('tc').textContent = last.toFixed(2) + ' / 75.00';
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f55">${e.stack}</pre>`); });
})();
