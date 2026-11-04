// Сцены 1–4: вступление-карта, командный центр, линия фронта, логистика.
'use strict';
(() => {
const { clamp, lerp, inv, smooth, ease, C } = V;
const S = V.scenes = V.scenes || {};

// ---------------------------------------------------------------- общие 3D-примитивы
V.box = (ctx, cam, x0, y0, z0, x1, y1, z1, st) => {
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const pr = P.map(p => cam.p(p[0], p[1], p[2])); if (pr.some(p => !p)) return;
  const faces = [[0, 1, 2, 3, [0, 0, -1]], [5, 4, 7, 6, [0, 0, 1]], [4, 0, 3, 7, [-1, 0, 0]], [1, 5, 6, 2, [1, 0, 0]], [3, 2, 6, 7, [0, 1, 0]], [4, 5, 1, 0, [0, -1, 0]]];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2, e = cam.eye;
  for (const f of faces) {
    const n = f[4], fc = [cx + n[0] * (x1 - x0) / 2, cy + n[1] * (y1 - y0) / 2, cz + n[2] * (z1 - z0) / 2];
    if ((e[0] - fc[0]) * n[0] + (e[1] - fc[1]) * n[1] + (e[2] - fc[2]) * n[2] <= 0) continue;
    ctx.beginPath(); for (let k = 0; k < 4; k++) { const p = pr[f[k]]; k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.closePath();
    const shade = n[1] > 0 ? st.top : n[0] !== 0 ? st.side : st.front;
    if (shade) { ctx.fillStyle = shade; ctx.fill(); }
    if (st.line) { ctx.strokeStyle = st.line; ctx.lineWidth = st.lw || 1; ctx.stroke(); }
  }
};
V.line3 = (ctx, cam, pts) => { let on = false; ctx.beginPath(); for (const q of pts) { const p = cam.p(q[0], q[1], q[2]); if (!p) { on = false; continue; } on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true; } };
V.layers = []; V.layer = i => { if (!V.layers[i]) { const c = document.createElement('canvas'); c.width = V.W; c.height = V.H; V.layers[i] = c; } const c = V.layers[i], g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, V.W, V.H); g.filter = 'none'; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; return [c, g]; };

// ---------------------------------------------------------------- СЦЕНА 1. Вступление: линия → карта Европы
let MAP = null;
V.initMap = topo => {
  const all = V.decodeTopo(topo, 'countries');
  MAP = [];
  for (const c of all) {
    const rings = [];
    for (const r of c.rings) {
      let inBox = false; for (const [lo, la] of r) if (lo > -26 && lo < 75 && la > 33 && la < 73) { inBox = true; break; }
      if (!inBox) continue;
      const pts = []; for (const [lo, la] of r) { if (lo < -30 || lo > 100) continue; pts.push(V.geo(lo, la)); }
      if (pts.length > 2) rings.push(pts);
    }
    if (rings.length) MAP.push({ id: c.id, name: c.name, rings });
  }
  V.UA = all.find(c => c.id === '804');
  V.MAPC = MAP;
};
const RU = '643', UA = '804';
V.drawMap = (ctx, cam, o = {}) => {
  const a = o.alpha === undefined ? 1 : o.alpha;
  ctx.save(); ctx.lineJoin = 'round';
  // градусная сетка
  ctx.strokeStyle = V.rgba(C.cyan, .07 * a); ctx.lineWidth = 1;
  for (let lo = -30; lo <= 90; lo += 5) { V.line3(ctx, cam, [V.geo(lo, 30), V.geo(lo, 50), V.geo(lo, 75)].map(([x, z]) => [x, 0, z])); ctx.stroke(); }
  for (let la = 30; la <= 75; la += 5) { const pts = []; for (let lo = -30; lo <= 90; lo += 10) { const [x, z] = V.geo(lo, la); pts.push([x, 0, z]); } V.line3(ctx, cam, pts); ctx.stroke(); }
  const pathOf = (rings, y) => { ctx.beginPath(); for (const r of rings) { let st = false; for (const [x, z] of r) { const p = cam.p(x, y, z); if (!p) continue; st ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); st = true; } ctx.closePath(); } };
  for (const c of MAP) {
    if (c.id === RU || c.id === UA) continue;
    pathOf(c.rings, 0); ctx.fillStyle = `rgba(14,26,46,${.85 * a})`; ctx.fill();
    ctx.strokeStyle = V.rgba(C.cyan, .28 * a); ctx.lineWidth = 1; ctx.stroke();
  }
  // объём: выдавленные Россия и Украина
  const hl = o.hl === undefined ? 1 : o.hl, ext = .35 * hl;
  for (const [id, col, fillA] of [[RU, C.red, .07], [UA, C.cyan, .13]]) {
    const c = MAP.find(m => m.id === id); if (!c) continue;
    pathOf(c.rings, 0); ctx.fillStyle = `rgba(10,20,38,${a})`; ctx.fill(); ctx.strokeStyle = V.rgba(col, .25 * a * hl); ctx.lineWidth = 1; ctx.stroke();
    pathOf(c.rings, ext); ctx.fillStyle = V.rgba(col, fillA * a * hl); ctx.fill();
    ctx.shadowColor = col; ctx.shadowBlur = 14 * hl; ctx.strokeStyle = V.rgba(col, (.35 + .55 * hl) * a); ctx.lineWidth = 1.2 + 1.3 * hl; ctx.stroke(); ctx.shadowBlur = 0;
  }
  ctx.restore();
};
const DUST = (() => { const r = V.rng(11), a = []; for (let i = 0; i < 700; i++) a.push([r() * 90 - 45, r() * 9, r() * 60 - 35, r()]); return a; })();
V.dust = (ctx, cam, t, a = 1, col = C.cyan) => {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const d of DUST) {
    const y = (d[1] + t * (.2 + d[3] * .3)) % 9;
    const p = cam.p(d[0] + Math.sin(t * .3 + d[3] * 9) * .6, y, d[2]); if (!p) continue;
    const s = clamp(p.s * .05, .6, 4), al = a * (.25 + .5 * d[3]) * smooth(inv(0, 1.2, y)) * (1 - inv(6, 9, y));
    ctx.fillStyle = V.rgba(col, al); ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.restore();
};
const geoLabel = (ctx, cam, lon, lat, txt, a, o = {}) => {
  const [x, z] = V.geo(lon, lat), p = cam.p(x, .4, z); if (!p || a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  if (o.dot) { ctx.fillStyle = o.color || '#fff'; ctx.shadowColor = o.color || '#fff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
  V.text(ctx, txt, p.x + (o.dot ? 12 : 0), p.y + (o.dot ? 6 : 0), { size: o.size || 22, weight: o.w || 700, color: o.color || '#fff', track: o.track || 6, align: o.dot ? 'left' : 'center', p: 1 });
  ctx.restore();
};
S.s1cam = t => {
  // широкий обзор → стремительное приближение к России и Украине → нырок
  const u = ease.io(inv(2.4, 6.9, t)), d = ease.in(inv(6.6, 8.3, t));
  const tgt = V.mix3([-7, 0, -5], [4.5, 0, -5.2], u);
  const dist = lerp(lerp(70, 21, u), 7, d), el = lerp(lerp(1.12, .78, u), .45, d), az = lerp(lerp(0, .2, u), .28, d) + Math.sin(t * .4) * .02;
  return V.camera(V.orbit(tgt, dist, az, el), tgt, 40, lerp(0, -.04, u));
};
S.s1 = (ctx, t) => {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, V.W, V.H);
  const cam = S.s1cam(t);
  // 1) тонкая линия
  const lw = ease.io(inv(.35, 1.6, t)), lineA = 1 - smooth(inv(1.9, 2.4, t));
  // 2) раскрытие карты полосой-сканом от центра
  const rv = ease.io(inv(1.6, 3.6, t));
  const bgA = smooth(inv(1.6, 3.2, t));
  const bg = ctx.createRadialGradient(V.W / 2, V.H * .55, 50, V.W / 2, V.H / 2, V.W * .7);
  bg.addColorStop(0, V.rgba('#0E1A30', bgA)); bg.addColorStop(1, V.rgba(C.bg, bgA)); ctx.fillStyle = bg; ctx.fillRect(0, 0, V.W, V.H);
  if (rv > 0) {
    const zc = -5, w = rv * 48;
    const q = [[-80, zc - w], [80, zc - w], [80, zc + w], [-80, zc + w]].map(([x, z]) => cam.p(x, 0, z));
    ctx.save();
    if (q.every(Boolean) && rv < 1) { ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip(); }
    V.drawMap(ctx, cam, { alpha: 1, hl: smooth(inv(3.4, 5, t)) });
    ctx.restore();
    // кромки скана
    if (rv < 1) for (const s of [-1, 1]) {
      V.line3(ctx, cam, [[-80, 0, zc + s * w], [80, 0, zc + s * w]]);
      ctx.save(); ctx.strokeStyle = V.rgba(C.cyan, .9 * (1 - rv)); ctx.lineWidth = 2; ctx.shadowColor = C.cyan; ctx.shadowBlur = 20; ctx.stroke(); ctx.restore();
    }
  }
  if (lineA > 0 && lw > 0) {
    ctx.save(); const hw = lw * 860; ctx.globalAlpha = lineA;
    const g = ctx.createLinearGradient(V.W / 2 - hw, 0, V.W / 2 + hw, 0);
    g.addColorStop(0, 'rgba(0,212,255,0)'); g.addColorStop(.5, 'rgba(160,240,255,1)'); g.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = g; ctx.shadowColor = C.cyan; ctx.shadowBlur = 30; ctx.fillRect(V.W / 2 - hw, V.H / 2 - 1, hw * 2, 2); ctx.restore();
  }
  V.dust(ctx, cam, t, smooth(inv(2, 4, t)));
  const la = V.win(t, 4.0, 7.6, .8, .5);
  geoLabel(ctx, cam, 45, 51.5, 'РОССИЯ', la * .9, { color: V.rgba(C.red, 1), size: 26, track: 10 });
  geoLabel(ctx, cam, 31.6, 48.7, 'УКРАИНА', la * .95, { color: '#BFF3FF', size: 26, track: 10 });
  geoLabel(ctx, cam, 37.62, 55.75, 'МОСКВА', la * .8, { dot: 1, size: 18, track: 3 });
  geoLabel(ctx, cam, 30.52, 50.45, 'КИЕВ', la * .8, { dot: 1, size: 18, track: 3 });
  // заголовок
  const ta = V.win(t, 4.3, 7.9, .4, .6), tp = inv(4.3, 5.6, t);
  if (ta > 0) {
    ctx.save();
    const rg = ctx.createRadialGradient(V.W / 2, 300, 40, V.W / 2, 300, 760); rg.addColorStop(0, `rgba(8,13,24,${.72 * ta})`); rg.addColorStop(1, 'rgba(8,13,24,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, V.W, V.H);
    const TY = 250, sc = 1 + ease.in(inv(7.2, 8.2, t)) * .25; ctx.translate(V.W / 2, TY); ctx.scale(sc, sc); ctx.translate(-V.W / 2, -TY);
    const track = lerp(34, 4, ease.outExpo(tp));
    V.text(ctx, 'КАК РАБОТАЕТ СВО?', V.W / 2, TY, { size: 92, weight: 800, align: 'center', track, p: tp, stagger: .45, blurIn: 16, alpha: ta, glow: 'rgba(0,212,255,0.45)', glowBlur: 30 });
    const lp = ease.io(inv(5.0, 5.9, t)); ctx.globalAlpha = ta; ctx.fillStyle = C.red; ctx.fillRect(V.W / 2 - 160 * lp, TY + 40, 320 * lp, 3);
    V.text(ctx, 'Одна война. Множество взаимосвязанных процессов.', V.W / 2, TY + 108, { size: 38, weight: 500, align: 'center', color: 'rgba(255,255,255,0.88)', p: inv(5.3, 6.4, t), stagger: .35, rise: 14, alpha: ta });
    ctx.restore();
  }
  V.hud(ctx, t, '01', smooth(inv(3, 4.5, t)) * (1 - smooth(inv(7.4, 8, t))));
};

// ---------------------------------------------------------------- СЦЕНА 2. Командный центр
const SCR = { x0: -17, x1: 17, y0: 1.6, y1: 15.6, z: -30 }, SW = 2040, SH = 840;
let scrCanvas = null;
const scheme = (g, t) => {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW, SH);
  g.fillStyle = 'rgba(5,14,30,0.94)'; g.fillRect(0, 0, SW, SH);
  g.strokeStyle = 'rgba(0,212,255,0.07)'; g.lineWidth = 1;
  for (let x = 0; x < SW; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, SH); g.stroke(); }
  for (let y = 0; y < SH; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y); g.stroke(); }
  g.strokeStyle = 'rgba(0,212,255,0.6)'; g.lineWidth = 3; g.strokeRect(6, 6, SW - 12, SH - 12);
  V.text(g, 'СХЕМА: ОТ РЕШЕНИЯ К ДЕЙСТВИЮ', 50, 70, { size: 28, weight: 700, color: C.cyan, track: 6, p: inv(8.4, 9.4, t), stagger: .3, rise: 6 });
  V.text(g, 'УРОВНИ УПРАВЛЕНИЯ', SW - 50, 70, { size: 22, weight: 600, color: 'rgba(0,212,255,0.6)', track: 6, align: 'right', p: inv(8.6, 9.6, t), stagger: .3, rise: 6 });
  const blocks = [{ x: 350, l: ['ПОЛИТИЧЕСКИЕ', 'РЕШЕНИЯ'], t: 9.74, c: C.gold }, { x: 1020, l: ['ВОЕННЫЕ', 'ЦЕЛИ'], t: 12.0, c: C.cyan }, { x: 1690, l: ['ДЕЙСТВИЯ'], t: 13.8, c: C.red }];
  const by = 300, bw = 540, bh = 200;
  // стрелки
  [[0, 11.2, 12.0], [1, 13.0, 13.8]].forEach(([i, a, b]) => {
    const p = ease.io(inv(a, b, t)); if (p <= 0) return;
    const x0 = blocks[i].x + bw / 2 + 14, x1 = blocks[i + 1].x - bw / 2 - 14, xe = lerp(x0, x1, p);
    g.save(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.shadowColor = C.cyan; g.shadowBlur = 16;
    g.beginPath(); g.moveTo(x0, by); g.lineTo(xe, by); g.stroke();
    if (p > .7) { const ah = (p - .7) / .3 * 22; g.beginPath(); g.moveTo(xe, by); g.lineTo(xe - ah, by - ah * .7); g.moveTo(xe, by); g.lineTo(xe - ah, by + ah * .7); g.stroke(); }
    g.restore();
  });
  blocks.forEach((b, i) => {
    const on = smooth(inv(b.t - .3, b.t + .25, t)), appear = smooth(inv(8.7 + i * .25, 9.4 + i * .25, t));
    const flash = Math.max(0, 1 - Math.abs(t - b.t - .1) * 3);
    g.save(); g.globalAlpha = appear;
    g.fillStyle = `rgba(${on ? 20 : 10},${30 + on * 20},${55 + on * 25},0.95)`; g.fillRect(b.x - bw / 2, by - bh / 2, bw, bh);
    g.strokeStyle = on > 0 ? V.rgba(b.c, .35 + .65 * on) : 'rgba(0,212,255,0.35)'; g.lineWidth = 3 + 3 * on;
    g.shadowColor = b.c; g.shadowBlur = 40 * on; g.strokeRect(b.x - bw / 2, by - bh / 2, bw, bh); g.shadowBlur = 0;
    if (flash > 0) { g.fillStyle = V.rgba(b.c, .3 * flash); g.fillRect(b.x - bw / 2, by - bh / 2, bw, bh); }
    g.fillStyle = V.rgba(b.c, on); g.fillRect(b.x - bw / 2, by - bh / 2, 12, bh);
    b.l.forEach((ln, k) => V.text(g, ln, b.x, by + 18 + (k - (b.l.length - 1) / 2) * 58, { size: 50, weight: 800, align: 'center', color: on > .5 ? '#fff' : 'rgba(255,255,255,0.55)', p: 1, track: 2 }));
    V.text(g, `0${i + 1}`, b.x - bw / 2 + 30, by - bh / 2 + 36, { size: 20, weight: 700, color: V.rgba(b.c, .9), p: 1, track: 4 });
    g.restore();
  });
  // сеть из центрального блока
  const np = inv(13.6, 15.6, t);
  if (np > 0) {
    const r = V.rng(77), ox = blocks[1].x, oy = by + bh / 2;
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const ax = 160 + i * (SW - 320) / 6, ay = 560 + r() * 40, d0 = i * .04;
      const p1 = ease.out(inv(d0, d0 + .4, np));
      g.strokeStyle = V.rgba(C.cyan, .75); g.lineWidth = 3; g.shadowColor = C.cyan; g.shadowBlur = 10;
      g.beginPath(); g.moveTo(ox, oy); g.quadraticCurveTo(ox, lerp(oy, ay, .6), lerp(ox, ax, p1), lerp(oy, ay, p1)); g.stroke();
      if (p1 >= 1) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ax, ay, 8, 0, 7); g.fill(); }
      for (let k = 0; k < 6; k++) {
        const bx = ax + (r() - .5) * 280, byy = 680 + r() * 120, d1 = .35 + i * .04 + k * .04, p2 = ease.out(inv(d1, d1 + .35, np));
        if (p2 <= 0) continue;
        g.strokeStyle = V.rgba(k % 3 === 0 ? C.gold : C.cyan, .55); g.lineWidth = 1.6; g.shadowBlur = 6;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(lerp(ax, bx, p2), lerp(ay, byy, p2)); g.stroke();
        if (p2 >= 1) { g.fillStyle = k % 3 === 0 ? C.gold : 'rgba(180,240,255,0.95)'; g.fillRect(bx - 5, byy - 5, 10, 10); }
        // импульс по ребру
        const ph = (t * .9 + r()) % 1; if (p2 >= 1) { g.fillStyle = '#fff'; g.fillRect(lerp(ax, bx, ph) - 2, lerp(ay, byy, ph) - 2, 4, 4); }
      }
    }
    g.restore();
    V.text(g, 'ЗАДАЧИ ДЛЯ ВОЕННОГО РУКОВОДСТВА', SW / 2, SH - 34, { size: 26, weight: 700, color: C.gold, align: 'center', track: 6, p: inv(14.2, 15.0, t), stagger: .3, rise: 6 });
  }
  // строка развёртки
  const sy = (t * 260) % SH; g.fillStyle = 'rgba(0,212,255,0.05)'; g.fillRect(0, sy, SW, 60);
};
const mapQuad = (ctx, cam, img, x0, x1, y0, y1, z, N = 24) => {
  const w = img.width, h = img.height;
  for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N, xa = lerp(x0, x1, u0), xb = lerp(x0, x1, u1);
    const p00 = cam.p(xa, y1, z), p10 = cam.p(xb, y1, z), p01 = cam.p(xa, y0, z); if (!p00 || !p10 || !p01) continue;
    const sx0 = u0 * w, sw = (u1 - u0) * w;
    const a = (p10.x - p00.x) / sw, b = (p10.y - p00.y) / sw, c = (p01.x - p00.x) / h, d = (p01.y - p00.y) / h;
    ctx.save(); ctx.setTransform(a, b, c, d, p00.x - a * sx0, p00.y - b * sx0);
    ctx.drawImage(img, sx0, 0, sw + 1.5, h, sx0, 0, sw + 1.5, h); ctx.restore();
  }
};
V.mapQuad = mapQuad;
S.s2 = (ctx, t) => {
  if (!scrCanvas) { scrCanvas = document.createElement('canvas'); scrCanvas.width = SW; scrCanvas.height = SH; }
  scheme(scrCanvas.getContext('2d'), t);
  const x = inv(7.6, 16.3, t), u = 1 - Math.pow(1 - x, 2.2);
  const eye = V.spline([[-3.5, 8.5, 26], [-1.6, 6.2, 9], [.6, 5.0, -2], [1.8, 4.7, -8]], u);
  const tgt = V.spline([[0, 6, -30], [0, 7.6, -30], [.3, 8.2, -30], [.8, 8.4, -30]], u);
  const cam = V.camera(eye, tgt, lerp(52, 44, u), Math.sin(t * .5) * .012);
  // фон
  const g0 = ctx.createLinearGradient(0, 0, 0, V.H); g0.addColorStop(0, '#060A14'); g0.addColorStop(1, '#0A1222');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, V.W, V.H);
  // пол — сетка с отражением
  ctx.save(); ctx.strokeStyle = 'rgba(0,212,255,0.10)'; ctx.lineWidth = 1;
  for (let gx = -30; gx <= 30; gx += 2) { V.line3(ctx, cam, [[gx, 0, -30], [gx, 0, 30]]); ctx.stroke(); }
  for (let gz = -30; gz <= 30; gz += 2) { V.line3(ctx, cam, [[-30, 0, gz], [30, 0, gz]]); ctx.stroke(); }
  ctx.restore();
  // потолочные световые полосы
  ctx.save(); ctx.strokeStyle = 'rgba(160,220,255,0.35)'; ctx.lineWidth = 3; ctx.shadowColor = C.cyan; ctx.shadowBlur = 12;
  for (let gx = -12; gx <= 12; gx += 6) { V.line3(ctx, cam, [[gx, 18, -28], [gx, 18, 20]]); ctx.stroke(); }
  ctx.restore();
  // стена и колонны
  [-22, 22].forEach(px => V.box(ctx, cam, px - 1.2, 0, -30, px + 1.2, 18, -27.6, { front: '#0B1426', side: '#0E1A30', top: '#101d34', line: 'rgba(0,212,255,0.25)' }));
  // экран: свечение, отражение на полу, контент
  const sp = [cam.p(0, 8.6, SCR.z)]; if (sp[0]) { const rg = ctx.createRadialGradient(sp[0].x, sp[0].y, 50, sp[0].x, sp[0].y, 900 * sp[0].s / 40); rg.addColorStop(0, 'rgba(0,140,220,0.28)'); rg.addColorStop(1, 'rgba(0,140,220,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, V.W, V.H); }
  const fr = [[-17, 0, -29.8], [17, 0, -29.8], [17, 0, -14], [-17, 0, -14]].map(q => cam.p(...q));
  if (fr.every(Boolean)) { const gg = ctx.createLinearGradient(0, fr[0].y, 0, fr[2].y); gg.addColorStop(0, 'rgba(0,180,255,0.20)'); gg.addColorStop(1, 'rgba(0,180,255,0)'); ctx.fillStyle = gg; ctx.beginPath(); fr.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.fill(); }
  V.box(ctx, cam, SCR.x0 - .5, SCR.y0 - .5, SCR.z - .6, SCR.x1 + .5, SCR.y1 + .5, SCR.z - .05, { front: '#050a14', side: '#0b1528', top: '#0b1528', line: 'rgba(0,212,255,0.5)' });
  mapQuad(ctx, cam, scrCanvas, SCR.x0, SCR.x1, SCR.y0, SCR.y1, SCR.z);
  // пульты: дальние резкие, ближние размыты (глубина резкости)
  const desks = []; for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) desks.push([-11.5 + k * 7.6 + (row % 2) * 1.2, -21 + row * 8]);
  desks.sort((a, b) => a[1] - b[1]);
  const [lc, lg] = V.layer(1);
  for (const [dx, dz] of desks) {
    const near = dz > -9, g = near ? lg : ctx;
    V.box(g, cam, dx - 2.6, 0, dz - .9, dx + 2.6, 1.8, dz + .9, { front: '#0a1324', side: '#0d182c', top: '#13223c', line: 'rgba(0,212,255,0.28)' });
    // мониторы
    for (const m of [-1.3, 1.3]) {
      const q = [[dx + m - 1, 1.95, dz - .3], [dx + m + 1, 1.95, dz - .3], [dx + m + 1, 3.1, dz - .5], [dx + m - 1, 3.1, dz - .5]].map(v => cam.p(...v));
      if (!q.every(Boolean)) continue;
      g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
      g.fillStyle = 'rgba(0,90,140,0.55)'; g.fill(); g.strokeStyle = 'rgba(0,212,255,0.7)'; g.lineWidth = 1; g.stroke();
      // мини-график
      g.beginPath(); for (let s = 0; s <= 10; s++) { const v = V.noise(s * .7 + t * 2, dx + m, 3); const p = cam.p(dx + m - .9 + s * .18, 2.1 + v * .8, dz - .32 - v * .15); if (p) s ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
      g.strokeStyle = V.rgba(m > 0 ? C.gold : C.cyan, .9); g.stroke();
    }
  }
  ctx.save(); ctx.filter = 'blur(5px)'; ctx.drawImage(lc, 0, 0); ctx.restore();
  // ближний передний план — силуэт края стола, сильно размыт
  ctx.save(); ctx.filter = 'blur(14px)'; ctx.fillStyle = '#03060c';
  const ex = lerp(-200, 120, u);
  ctx.beginPath(); ctx.moveTo(ex, V.H); ctx.lineTo(ex + 300, V.H - 120); ctx.lineTo(ex + 760, V.H - 150); ctx.lineTo(ex + 900, V.H); ctx.fill();
  ctx.restore();
  V.dust(ctx, cam, t, .35, '#8fe9ff');
  V.sceneTitle(ctx, t, 8.6, '02 · ПОЛИТИКА', ['ПОЛИТИЧЕСКИЕ РЕШЕНИЯ'], { size: 56, y: 1000, out: 12.4, accent: C.gold });
  V.hud(ctx, t, '02', smooth(inv(8.2, 9, t)));
};

// ---------------------------------------------------------------- СЦЕНЫ 3–4. Рельеф → логистическая сеть
const GX0 = -40, GX1 = 40, GZ0 = -72, GZ1 = 16, ST = 1;
const NX = (GX1 - GX0) / ST + 1, NZ = (GZ1 - GZ0) / ST + 1;
const riverX = z => -6 + 7 * Math.sin(z * .07) + 2 * Math.sin(z * .19);
const frontX = z => 5 + 4 * Math.sin(z * .05 + 1) + 1.6 * Math.sin(z * .17 + .4);
const HRAW = new Float32Array(NX * NZ);
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  const x = GX0 + i * ST, z = GZ0 + j * ST;
  let h = (V.fbm(x * .055 + 3, z * .055 + 7, 5) - .42) * 11;
  const r = Math.abs(x - riverX(z)); h = h * smooth(r / 9) - (1 - smooth(r / 3)) * .6;
  HRAW[j * NX + i] = Math.max(-.4, h) + .4;
}
const hAt = (x, z) => { const fi = clamp((x - GX0) / ST, 0, NX - 1.001), fj = clamp((z - GZ0) / ST, 0, NZ - 1.001), i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
  const a = HRAW[j * NX + i], b = HRAW[j * NX + i + 1], c = HRAW[(j + 1) * NX + i], d = HRAW[(j + 1) * NX + i + 1]; return lerp(lerp(a, b, u), lerp(c, d, u), v); };
const R3 = V.rng(303);
const MARK = []; for (let i = 0; i < 46; i++) { const z = -66 + R3() * 76, side = i % 2 ? 1 : -1; MARK.push({ z, x: frontX(z) + side * (2.5 + R3() * 9), side, ph: R3() }); }
const TOWNS = []; for (let i = 0; i < 16; i++) TOWNS.push({ x: -34 + R3() * 68, z: -68 + R3() * 76, n: 4 + Math.floor(R3() * 8) });
const FOREST = []; { const r = V.rng(55); while (FOREST.length < 2600) { const x = -38 + r() * 76, z = -70 + r() * 84; if (V.fbm(x * .09, z * .09, 91, 3) > .54) FOREST.push([x, z, r()]); } }
// логистика
const NODES = []; { const r = V.rng(404); for (let i = 0; i < 18; i++) NODES.push({ x: -30 + r() * 56, z: -62 + r() * 58, w: .8 + r() * 1.2, d: .8 + r() * 1.6, h: .8 + r() * 1.8, t: 24.9 + r() * 1.8, hub: i < 3 }); }
const ROADS = []; { for (let i = 0; i < NODES.length; i++) { const ds = NODES.map((n, j) => [Math.hypot(n.x - NODES[i].x, n.z - NODES[i].z), j]).sort((a, b) => a[0] - b[0]); for (const [, j] of ds.slice(1, 3)) if (!ROADS.some(r => (r[0] === j && r[1] === i))) ROADS.push([i, j]); } }
const RAILS = [[[-40, -50], [-18, -40], [0, -34], [18, -22], [40, -14]], [[-30, 10], [-20, -12], [-6, -30], [4, -52], [10, -72]]];
const ARCS = []; { const r = V.rng(505); for (let i = 0; i < 420; i++) { const a = NODES[Math.floor(r() * NODES.length)], b = NODES[Math.floor(r() * NODES.length)]; if (a === b) continue; ARCS.push({ a, b, h: 2 + r() * 7, t: 25.4 + r() * 2.6, sp: .12 + r() * .25, ph: r(), c: r() < .2 ? C.gold : C.cyan }); } }
const arcPt = (A, u) => [lerp(A.a.x, A.b.x, u), Math.sin(u * Math.PI) * A.h, lerp(A.a.z, A.b.z, u)];
const railPt = (R, u) => { const n = R.length - 1, x = clamp(u) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i; return [lerp(R[i][0], R[i + 1][0], f), lerp(R[i][1], R[i + 1][1], f)]; };

S.s34cam = t => {
  if (t < 24.2) {
    const u = inv(15.7, 24.2, t);
    const eye = V.spline([[-11, 9.5, 18], [-5, 8.2, 4], [1, 7.6, -8], [3, 8.4, -14]], u);
    const tgt = V.spline([[1, 0, -16], [3, .5, -28], [5, 1, -40], [5, 0, -44]], u);
    return V.camera(eye, tgt, 50, Math.sin(u * Math.PI * 1.3) * .06);
  }
  const u = inv(24.2, 32.6, t), k = ease.io(u), up = ease.in(inv(30.6, 32.6, t));
  const eye = V.spline([[3, 8.4, -14], [6, 15, -6], [1, 26, 4], [-5, 34, 8]], ease.io(inv(24.2, 31, t)));
  eye[1] += up * 70; eye[2] -= up * 20;
  const tgt = V.spline([[5, 0, -44], [3, 0, -38], [0, 0, -32], [-2, 0, -30]], k);
  return V.camera(eye, tgt, lerp(50, 46, k), Math.sin(t * .4) * .03);
};
S.s34 = (ctx, t) => {
  const cam = S.s34cam(t), flat = ease.io(inv(24.0, 25.8, t)), hk = 1 - flat;
  const g0 = ctx.createLinearGradient(0, 0, 0, V.H); g0.addColorStop(0, '#0A1424'); g0.addColorStop(.45, '#0B1728'); g0.addColorStop(1, '#070C16');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, V.W, V.H);
  const H = (x, z) => hAt(x, z) * hk;
  const eyeZ = cam.eye[2], fogD = 70;
  // облака / погода (дальний слой)
  const wA = V.win(t, 16.2, 24.6, 1, .8);
  if (wA > 0) { ctx.save(); const r = V.rng(66); for (let i = 0; i < 9; i++) { const x = -40 + r() * 80 + t * .8, z = -70 + r() * 50, p = cam.p(x, 9 + r() * 3, z); if (!p) continue; const rad = 260 * p.s / 40; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad); g.addColorStop(0, `rgba(200,220,240,${.08 * wA})`); g.addColorStop(1, 'rgba(200,220,240,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2); } ctx.restore(); }
  // ряды рельефа от дальних к ближним; оверлеи в промежутках — корректное перекрытие
  const rowPts = new Array(NX);
  const fA = V.win(t, 16.6, 25.2, 1.2, 1.0), mA = V.win(t, 17.4, 25.0, 1, .8);
  for (let j = 0; j < NZ; j++) {
    const z = GZ0 + j * ST; if (z > eyeZ - .6) break;
    const depth = eyeZ - z, fog = 1 - clamp(depth / fogD) ** 1.4;
    let ok = true;
    for (let i = 0; i < NX; i++) { const x = GX0 + i * ST; rowPts[i] = cam.p(x, H(x, z), z); if (!rowPts[i]) { ok = false; break; } }
    if (!ok) continue;
    // заливка под строкой — скрывает задние
    if (hk > .02) {
      ctx.beginPath(); ctx.moveTo(rowPts[0].x, V.H + 400); for (let i = 0; i < NX; i++) ctx.lineTo(rowPts[i].x, rowPts[i].y); ctx.lineTo(rowPts[NX - 1].x, V.H + 400); ctx.closePath();
      ctx.fillStyle = `rgb(${lerp(8, 10, fog) | 0},${lerp(13, 22, fog) | 0},${lerp(24, 38, fog) | 0})`; ctx.fill();
    }
    // строка: цвет по высоте
    ctx.lineWidth = lerp(.6, 1.6, fog);
    for (let i = 0; i < NX - 1; i++) {
      const hh = hAt(GX0 + i * ST, z);
      const c = hh > 3.2 ? [190, 235, 255] : hh > 1.4 ? [70, 190, 235] : [30, 120, 170];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(.18 + .55 * fog) * lerp(.55, 1, hk)})`;
      ctx.beginPath(); ctx.moveTo(rowPts[i].x, rowPts[i].y); ctx.lineTo(rowPts[i + 1].x, rowPts[i + 1].y); ctx.stroke();
    }
    // продольные линии сетки после «сплющивания»
    if (flat > .05 && j % 2 === 0) {
      ctx.strokeStyle = V.rgba(C.cyan, .06 * flat * fog);
      for (let i = 0; i < NX; i += 2) { const p = rowPts[i], q = cam.p(GX0 + i * ST, 0, z + 2 * ST); if (q) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }
    }
    // --- оверлеи полосы [z, z+1)
    const inRow = zz => zz >= z && zz < z + ST;
    if (fA > 0) {
      // лес
      ctx.fillStyle = `rgba(40,110,80,${.55 * fA * fog})`;
      for (const f of FOREST) if (inRow(f[1])) { const p = cam.p(f[0], H(f[0], f[1]) + .05, f[1]); if (p) { const s = clamp(p.s * .09, .8, 5); ctx.fillRect(p.x - s / 2, p.y - s, s, s); } }
      // река
      const r0 = cam.p(riverX(z), H(riverX(z), z) + .05, z), r1 = cam.p(riverX(z + ST), H(riverX(z + ST), z + ST) + .05, z + ST);
      if (r0 && r1) { ctx.strokeStyle = `rgba(90,170,255,${.8 * fA * fog})`; ctx.lineWidth = clamp(r0.s * .12, 1, 6); ctx.beginPath(); ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y); ctx.stroke(); }
      // населённые пункты
      for (const T of TOWNS) if (inRow(T.z)) { const r = V.rng(T.n * 13 + (T.x * 7 | 0)); for (let k = 0; k < T.n; k++) { const x = T.x + (r() - .5) * 2.4, zz = T.z + (r() - .5) * 2, p = cam.p(x, H(x, zz) + .15, zz); if (!p) continue; const s = clamp(p.s * .14, 1.5, 9); ctx.fillStyle = `rgba(255,240,210,${.85 * fA * fog})`; ctx.fillRect(p.x - s / 2, p.y - s, s, s); } }
    }
    // линия фронта (условная)
    if (fA > 0 || flat < 1) {
      const fa = fA * (1 - flat * .7);
      const ps = []; for (let s = 0; s <= 4; s++) { const zz = z + s * ST / 4, x = frontX(zz); ps.push(cam.p(x, H(x, zz) + .12, zz)); }
      if (ps.every(Boolean) && fa > 0) {
        const grow = clamp((t - 17.6) * 30 - (GZ1 - z)); // прорастает вглубь
        if (grow > 0) {
          ctx.save(); ctx.strokeStyle = V.rgba(C.gold, .95 * fa * fog); ctx.lineWidth = clamp(ps[0].s * .1, 1.5, 5); ctx.shadowColor = C.gold; ctx.shadowBlur = 14;
          ctx.beginPath(); ps.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.restore();
        }
      }
    }
    if (mA > 0) for (const M of MARK) if (inRow(M.z)) {
      const g = cam.p(M.x, H(M.x, M.z), M.z), top = cam.p(M.x, H(M.x, M.z) + 1.6, M.z); if (!g || !top) continue;
      const col = M.side > 0 ? C.red : C.cyan, al = mA * fog * smooth(inv(17.4 + M.ph * 1.6, 18 + M.ph * 1.6, t));
      ctx.save(); ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      const s = clamp(top.s * .22, 3, 11); ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(top.x, top.y - s); ctx.lineTo(top.x + s, top.y); ctx.lineTo(top.x, top.y + s); ctx.lineTo(top.x - s, top.y); ctx.closePath(); ctx.fill();
      const pr = (t * .6 + M.ph) % 1; ctx.globalAlpha = al * (1 - pr) * .7; ctx.beginPath(); ctx.ellipse(g.x, g.y, s * (1 + pr * 2.5), s * (1 + pr * 2.5) * .35, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
  // ---------- логистика поверх плоскости
  const LA = smooth(inv(24.6, 25.6, t));
  if (LA > 0) {
    ctx.save();
    // дороги
    ctx.strokeStyle = V.rgba(C.gold, .55 * LA); ctx.lineWidth = 2;
    for (const [i, j] of ROADS) { const p = ease.io(inv(24.8, 26.2, t)), a = NODES[i], b = NODES[j]; V.line3(ctx, cam, [[a.x, 0, a.z], [lerp(a.x, b.x, p), 0, lerp(a.z, b.z, p)]]); ctx.stroke(); }
    // ж/д
    for (const R of RAILS) { ctx.strokeStyle = V.rgba('#9FE8FF', .7 * LA); ctx.lineWidth = 2.5; V.line3(ctx, cam, R.map(([x, z]) => [x, 0, z])); ctx.stroke(); ctx.setLineDash([2, 7]); ctx.lineWidth = 7; ctx.strokeStyle = V.rgba('#9FE8FF', .25 * LA); ctx.stroke(); ctx.setLineDash([]); }
    // дуги-маршруты и частицы
    ctx.globalCompositeOperation = 'lighter';
    for (const A of ARCS) { const p = ease.out(inv(A.t, A.t + 1.4, t)); if (p <= 0) continue; ctx.strokeStyle = V.rgba(A.c, .17 * LA); ctx.lineWidth = 1; const pts = []; for (let s = 0; s <= 14 * p; s++) pts.push(arcPt(A, s / 14)); V.line3(ctx, cam, pts); ctx.stroke(); }
    for (let i = 0; i < ARCS.length; i++) { const A = ARCS[i]; if (t < A.t + .8) continue; for (let k = 0; k < 4; k++) { const u = (A.ph + k * .25 + t * A.sp) % 1, q = arcPt(A, u), p = cam.p(...q); if (!p) continue; const s = clamp(p.s * .07, 1, 3.5); ctx.fillStyle = V.rgba(A.c, .9 * LA); ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); } }
    ctx.globalCompositeOperation = 'source-over';
    // склады
    const ns = NODES.map(n => ({ n, d: Math.hypot(n.x - cam.eye[0], n.z - cam.eye[2]) })).sort((a, b) => b.d - a.d);
    for (const { n } of ns) { const g = ease.outBack(inv(n.t, n.t + .7, t)); if (g <= 0) continue; const h = n.h * g * (n.hub ? 1.6 : 1);
      V.box(ctx, cam, n.x - n.w, 0, n.z - n.d, n.x + n.w, h, n.z + n.d, { top: n.hub ? 'rgba(255,209,102,0.55)' : 'rgba(0,212,255,0.35)', side: 'rgba(10,40,70,0.9)', front: 'rgba(8,30,55,0.9)', line: n.hub ? 'rgba(255,209,102,0.9)' : 'rgba(0,212,255,0.8)', lw: 1.2 }); }
    // грузовики по дорогам
    ROADS.forEach(([i, j], k) => { if (k % 2) return; const a = NODES[i], b = NODES[j], u = ((t - 25.2) * .12 + k * .13) % 1; if (t < 25.6) return;
      const x = lerp(a.x, b.x, u), z = lerp(a.z, b.z, u), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ux = dx / L * .9, uz = dz / L * .9, vx = -uz * .45, vz = ux * .45;
      const q = [[x - ux - vx, z - uz - vz], [x + ux - vx, z + uz - vz], [x + ux + vx, z + uz + vz], [x - ux + vx, z - uz + vz]];
      for (const [yy, col] of [[0, 'rgba(255,209,102,0.25)'], [.5, 'rgba(255,230,170,0.95)']]) { const pr = q.map(([qx, qz]) => cam.p(qx, yy, qz)); if (!pr.every(Boolean)) return; ctx.beginPath(); pr.forEach((p, ii) => ii ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); } });
    // составы
    RAILS.forEach((R, ri) => { if (t < 25.4) return; for (let c = 0; c < 9; c++) { const u = ((t - 25.4) * .05 + ri * .4 - c * .012) % 1; const [x, z] = railPt(R, u), [x2, z2] = railPt(R, u + .008); const a = cam.p(x, .35, z), b = cam.p(x2, .35, z2); if (!a || !b) continue; ctx.strokeStyle = c === 0 ? '#FFFFFF' : 'rgba(159,232,255,0.95)'; ctx.lineWidth = clamp(a.s * .4, 2, 12); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } });
    ctx.restore();
  }
  V.dust(ctx, cam, t, .25 + .2 * flat);
  // ---------- подписи и чипы
  if (t < 25) {
    const ch = [[19.0, 'РЕЛЬЕФ И ГЕОГРАФИЯ', C.cyan], [19.8, 'СОПРОТИВЛЕНИЕ', C.red], [21.25, 'ПОГОДА', '#BFD7EA'], [22.3, 'МЕНЯЮЩАЯСЯ ОБСТАНОВКА', C.gold]];
    const ca = 1 - smooth(inv(23.9, 24.5, t));
    ctx.save(); ctx.globalAlpha = ca; ch.forEach(([tt, l, c], i) => V.chip(ctx, t, tt, 1340, 190 + i * 74, l, c)); ctx.restore();
    // легенда
    const lg = V.win(t, 18.0, 24.3, .6, .5); if (lg > 0) { ctx.save(); ctx.globalAlpha = lg; ctx.font = V.font(18, 600); ctx.letterSpacing = '3px';
      [[C.red, 'РОССИЙСКИЕ СИЛЫ'], [C.cyan, 'УКРАИНСКИЕ СИЛЫ'], [C.gold, 'УСЛОВНАЯ ЛИНИЯ ФРОНТА']].forEach(([c, l], i) => { ctx.fillStyle = c; ctx.fillRect(126, 130 + i * 34, 14, 14); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(l, 154, 143 + i * 34); });
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = V.font(15, 500); ctx.fillText('СХЕМА УСЛОВНА · БЕЗ РЕАЛЬНЫХ ПОЗИЦИЙ', 126, 248); ctx.restore(); }
  }
  V.sceneTitle(ctx, t, 16.5, '03 · ФРОНТ', ['ЛИНИЯ ФРОНТА'], { size: 88, out: 23.9, accent: C.gold });
  const icons = {
    tech: g => { g.beginPath(); g.arc(0, 0, 9, 0, 7); g.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); g.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); g.stroke(); } },
    food: g => { g.strokeRect(-11, -8, 22, 16); g.beginPath(); g.moveTo(-11, -2); g.lineTo(11, -2); g.stroke(); },
    fuel: g => { g.beginPath(); g.moveTo(0, -13); g.quadraticCurveTo(12, 2, 0, 12); g.quadraticCurveTo(-12, 2, 0, -13); g.stroke(); },
    med: g => { g.fillRect(-3, -12, 6, 24); g.fillRect(-12, -3, 24, 6); },
  };
  if (t > 25) {
    const ca = 1 - smooth(inv(31.0, 31.6, t));
    ctx.save(); ctx.globalAlpha = ca;
    [[26.78, 'ТЕХНИКА', C.cyan, icons.tech], [27.42, 'ПРОДОВОЛЬСТВИЕ', C.gold, icons.food], [28.0, 'ТОПЛИВО', C.gold, icons.fuel], [28.64, 'МЕДИЦИНСКАЯ ПОМОЩЬ', C.red, icons.med]].forEach(([tt, l, c, ic], i) => V.chip(ctx, t, tt, 1330, 170 + i * 74, l, c, ic));
    ctx.restore();
  }
  V.sceneTitle(ctx, t, 24.9, '04 · ЛОГИСТИКА', ['ЛОГИСТИКА —', 'ОСНОВА СНАБЖЕНИЯ'], { size: 76, out: 31.4 });
  V.hud(ctx, t, t < 24 ? '03' : '04', 1 - smooth(inv(31.4, 32, t)));
};
})();
