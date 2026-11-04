// Сцены 5–6: разведка и информация (космос), технологии (лаборатория).
'use strict';
(() => {
const { clamp, lerp, inv, smooth, ease, C } = V;
const S = V.scenes;

// ---------------------------------------------------------------- СЦЕНА 5. Космос, спутники, голопанель
let LAND = null, UA3 = null, RU3 = null;
const R = 10;
V.initGlobe = (land, countries) => {
  LAND = V.decodeTopo(land, 'land').flatMap(c => c.rings);
  const cs = V.decodeTopo(countries, 'countries', g => g.id === '804' || g.id === '643');
  UA3 = cs.find(c => c.id === '804').rings; RU3 = cs.find(c => c.id === '643').rings;
};
const sph = (lon, lat, rot, r = R) => { const l = (lon - rot) * Math.PI / 180, p = lat * Math.PI / 180; return [r * Math.cos(p) * Math.sin(l), r * Math.sin(p), r * Math.cos(p) * Math.cos(l)]; };
const STARS = (() => { const r = V.rng(808), a = []; for (let i = 0; i < 520; i++) a.push([r() * V.W * 1.3, r() * V.H * 1.2, r(), r()]); return a; })();
const SATS = (() => { const r = V.rng(909), a = []; for (let i = 0; i < 6; i++) a.push({ r: 13.5 + i * .9, inc: (-.9 + r() * 1.8), node: r() * 6.28, ph: r() * 6.28, sp: .16 + r() * .12 }); return a; })();
const satPos = (s, t) => { const a = s.ph + t * s.sp; const x = Math.cos(a) * s.r, z = Math.sin(a) * s.r; const y = z * Math.sin(s.inc), z2 = z * Math.cos(s.inc); return [x * Math.cos(s.node) - z2 * Math.sin(s.node), y, x * Math.sin(s.node) + z2 * Math.cos(s.node)]; };
S.s5cam = t => {
  const u = inv(31.6, 40.4, t), k = 1 - Math.pow(1 - u, 2.4);
  const ua = sph(31, 49, 0, 1);
  const dist = lerp(11.5, 36, k), az = Math.atan2(ua[0], ua[2]) + lerp(.05, -.38, k), el = lerp(.86, .42, k);
  const tgt = V.mix3([ua[0] * 10, ua[1] * 10, ua[2] * 10], [5.5, -.5, 1], ease.io(inv(32, 36, t)));
  return V.camera(V.orbit(tgt, dist, az, el), tgt, 40, lerp(.1, -.03, k));
};
const panel = (ctx, t, uaScreen) => {
  const a = smooth(inv(32.8, 33.6, t)); if (a <= 0) return;
  const X = 1030, Y = 150, PW = 800, PH = 700;
  ctx.save(); ctx.globalAlpha = a;
  // голопанель в лёгкой перспективе
  ctx.setTransform(1, -.035, 0, 1, 0, 30);
  ctx.fillStyle = 'rgba(6,20,40,0.62)'; ctx.fillRect(X, Y, PW, PH);
  ctx.strokeStyle = 'rgba(0,212,255,0.75)'; ctx.lineWidth = 2; ctx.shadowColor = C.cyan; ctx.shadowBlur = 18; ctx.strokeRect(X, Y, PW, PH); ctx.shadowBlur = 0;
  for (let y = Y; y < Y + PH; y += 4) { ctx.fillStyle = 'rgba(0,212,255,0.025)'; ctx.fillRect(X, y, PW, 1); }
  V.text(ctx, 'ЕДИНАЯ КАРТИНА ОБСТАНОВКИ', X + 30, Y + 50, { size: 26, weight: 800, color: '#fff', track: 4, p: inv(33.0, 33.8, t), stagger: .3, rise: 6 });
  // 4 источника
  const src = [['СПУТНИКИ', 33.1], ['БПЛА', 33.5], ['РАДИОСВЯЗЬ', 33.9], ['АНАЛИЗ ДАННЫХ', 34.3]];
  src.forEach(([l, tt], i) => {
    const x = X + 30 + (i % 2) * 380, y = Y + 80 + Math.floor(i / 2) * 150, on = smooth(inv(tt, tt + .4, t));
    ctx.globalAlpha = a * on; ctx.fillStyle = 'rgba(0,60,100,0.35)'; ctx.fillRect(x, y, 360, 130); ctx.strokeStyle = V.rgba(C.cyan, .6); ctx.lineWidth = 1.5; ctx.strokeRect(x, y, 360, 130);
    ctx.save(); ctx.translate(x + 70, y + 65); ctx.strokeStyle = C.cyan; ctx.fillStyle = C.cyan; ctx.lineWidth = 2;
    if (i === 0) { ctx.fillRect(-8, -8, 16, 16); ctx.strokeRect(-36, -6, 22, 12); ctx.strokeRect(14, -6, 22, 12); ctx.beginPath(); ctx.ellipse(0, 0, 46, 16, -.3, 0, 7); ctx.globalAlpha *= .4; ctx.stroke(); }
    else if (i === 1) { for (const [dx, dy] of [[-20, -16], [20, -16], [-20, 16], [20, 16]]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, dy); ctx.stroke(); ctx.beginPath(); ctx.ellipse(dx, dy, 11, 3.5, t * 30 + dx, 0, 7); ctx.stroke(); } ctx.fillRect(-6, -6, 12, 12); }
    else if (i === 2) { ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(0, -6); ctx.stroke(); for (let k = 1; k <= 3; k++) { const ph = (t * 1.5 + k / 3) % 1; ctx.globalAlpha = a * on * (1 - ph); ctx.beginPath(); ctx.arc(0, -6, 8 + ph * 30, -2.4, -.7); ctx.stroke(); } }
    else { for (let k = 0; k < 6; k++) { const h = 10 + 30 * V.noise(k * 1.3, t * 1.4, 4); ctx.fillRect(-30 + k * 11, 24 - h, 7, h); } }
    ctx.restore();
    V.text(ctx, l, x + 128, y + 74, { size: 22, weight: 700, color: '#fff', track: 3, p: on, stagger: .2, rise: 4, alpha: on });
  });
  ctx.globalAlpha = a;
  // оценка обстановки — сетка достоверности
  const gx = X + 30, gy = Y + 400, cs = 26, cols = 26, rows = 8, gp = smooth(inv(34.6, 35.6, t));
  V.text(ctx, 'ОЦЕНКА', gx, gy - 16, { size: 20, weight: 700, color: C.cyan, track: 6, p: gp, rise: 4 });
  const miss = smooth(inv(36.89, 37.2, t)), jit = smooth(inv(37.57, 37.9, t)), old = smooth(inv(38.31, 38.6, t));
  const rr = V.rng(5150);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = V.fbm(i * .2, j * .25, 12, 3), r0 = rr(), hole = r0 < .22 && miss > 0, ji = (r0 > .75) * jit;
    if (gp * cols * 1.2 < i) continue;
    const x = gx + i * cs + (ji ? Math.sin(t * 40 + i) * 4 : 0), y = gy + j * cs;
    let col = v > .55 ? C.red : v > .45 ? C.gold : C.cyan; let al = .25 + .5 * v;
    if (hole) { al *= 1 - miss; }
    if (old > 0) al *= lerp(1, .45, old);
    ctx.fillStyle = V.rgba(col, al); ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
    if (hole && miss > .5) { ctx.strokeStyle = 'rgba(255,69,58,0.6)'; ctx.setLineDash([3, 3]); ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4); ctx.setLineDash([]); }
  }
  // метки достоверности
  [[36.89, 'НЕПОЛНЫЕ', C.red], [37.57, 'НЕТОЧНЫЕ', C.gold], [38.31, 'УСТАРЕВШИЕ', '#C9D6E3']].forEach(([tt, l, c], i) => V.chip(ctx, t, tt, gx + i * 236, gy + rows * cs + 26, l, c));
  if (old > 0) V.text(ctx, 'ОБНОВЛЕНО: 6 Ч НАЗАД', X + PW - 30, gy - 16, { size: 18, weight: 700, color: '#C9D6E3', align: 'right', track: 3, p: old, rise: 4 });
  ctx.restore();
  // потоки данных из точки на Земле в панель
  if (uaScreen) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rr2 = V.rng(66);
    for (let k = 0; k < 90; k++) {
      const st = 32.9 + rr2() * 1.6, u = ((t - st) * (.35 + rr2() * .3)) % 1, tx = X + 30 + rr2() * 680, ty = Y + 90 + rr2() * 260;
      if (t < st) continue;
      const cx = lerp(uaScreen.x, tx, .5), cy = Math.min(uaScreen.y, ty) - 160;
      const x = (1 - u) ** 2 * uaScreen.x + 2 * (1 - u) * u * cx + u * u * tx, y = (1 - u) ** 2 * uaScreen.y + 2 * (1 - u) * u * cy + u * u * ty;
      ctx.fillStyle = V.rgba(k % 5 ? C.cyan : C.gold, .7 * a * (1 - smooth(inv(39.2, 39.8, t)))); ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    ctx.restore();
  }
};
S.s5 = (ctx, t) => {
  ctx.fillStyle = '#03060D'; ctx.fillRect(0, 0, V.W, V.H);
  const cam = S.s5cam(t), rot = -4 + (t - 32) * 1.4;
  // звёзды
  ctx.save(); const sx = (t - 32) * 6;
  for (const s of STARS) { const x = (s[0] - sx * (.3 + s[2])) % (V.W * 1.3), y = s[1]; ctx.fillStyle = `rgba(200,230,255,${.25 + .6 * s[3] * (0.7 + 0.3 * Math.sin(t * 2 + s[2] * 20))})`; const sz = s[2] > .9 ? 2 : 1.2; ctx.fillRect(x - V.W * .15, y - V.H * .1, sz, sz); }
  ctx.restore();
  const c = cam.p(0, 0, 0); if (!c) return;
  const d = Math.hypot(...cam.eye), rad = cam.f * R / Math.sqrt(Math.max(.01, d * d - R * R));
  // атмосфера
  const at = ctx.createRadialGradient(c.x, c.y, rad * .92, c.x, c.y, rad * 1.22); at.addColorStop(0, 'rgba(0,212,255,0.45)'); at.addColorStop(.25, 'rgba(0,140,255,0.18)'); at.addColorStop(1, 'rgba(0,120,255,0)');
  ctx.fillStyle = at; ctx.beginPath(); ctx.arc(c.x, c.y, rad * 1.25, 0, 7); ctx.fill();
  const body = ctx.createRadialGradient(c.x - rad * .35, c.y - rad * .4, rad * .1, c.x, c.y, rad); body.addColorStop(0, '#12305A'); body.addColorStop(.7, '#0A1A34'); body.addColorStop(1, '#050C1A');
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(c.x, c.y, rad, 0, 7); ctx.fill();
  const vis = q => (q[0] * (cam.eye[0] - q[0]) + q[1] * (cam.eye[1] - q[1]) + q[2] * (cam.eye[2] - q[2])) > 0;
  const ringPath = (rings, r0 = R) => { ctx.beginPath(); for (const rg of rings) { let on = false; for (let i = 0; i < rg.length; i++) { const q = sph(rg[i][0], rg[i][1], rot, r0); if (!vis(q)) { on = false; continue; } const p = cam.p(...q); if (!p) { on = false; continue; } on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true; } } };
  // сетка
  ctx.save(); ctx.strokeStyle = 'rgba(0,212,255,0.08)'; ctx.lineWidth = 1;
  for (let lo = -180; lo < 180; lo += 15) { const pts = []; for (let la = -85; la <= 85; la += 5) pts.push([lo, la]); ringPath([pts]); ctx.stroke(); }
  for (let la = -75; la <= 75; la += 15) { const pts = []; for (let lo = -180; lo <= 180; lo += 5) pts.push([lo, la]); ringPath([pts]); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(0,212,255,0.55)'; ctx.lineWidth = 1.2; ringPath(LAND); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,69,58,0.7)'; ctx.lineWidth = 1.5; ringPath(RU3, R * 1.003); ctx.stroke();
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 16; ctx.strokeStyle = '#8FF0FF'; ctx.lineWidth = 2.5; ringPath(UA3, R * 1.004); ctx.stroke();
  ctx.restore();
  // ночная сторона
  const sh = ctx.createLinearGradient(c.x - rad, c.y, c.x + rad, c.y); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,8,0.55)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(c.x, c.y, rad, 0, 7); ctx.fill();
  // спутники и лучи
  const uaQ = sph(31.5, 49, rot, R), uaP = vis(uaQ) ? cam.p(...uaQ) : null;
  const sa = smooth(inv(32.4, 33.4, t));
  const hidden = q => { const p = cam.p(...q); if (!p) return true; const dq = Math.hypot(q[0] - cam.eye[0], q[1] - cam.eye[1], q[2] - cam.eye[2]); return dq > Math.sqrt(d * d - R * R) && Math.hypot(p.x - c.x, p.y - c.y) < rad; };
  ctx.save();
  SATS.forEach((s, i) => {
    ctx.strokeStyle = `rgba(150,220,255,${.38 * sa})`; ctx.lineWidth = 1.3; ctx.beginPath(); let on = false;
    for (let k = 0; k <= 96; k++) { const qq = satPos(s, (k / 96) * (Math.PI * 2) / s.sp); const p = cam.p(...qq); if (!p || hidden(qq)) { on = false; continue; } on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true; }
    ctx.stroke();
    const q = satPos(s, t); if (hidden(q)) return; const p = cam.p(...q); if (!p) return;
    const sz = clamp(p.s * .5, 5, 12);
    ctx.globalAlpha = sa * .5; const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 4); hg.addColorStop(0, 'rgba(160,240,255,0.8)'); hg.addColorStop(1, 'rgba(160,240,255,0)'); ctx.fillStyle = hg; ctx.fillRect(p.x - sz * 4, p.y - sz * 4, sz * 8, sz * 8);
    ctx.globalAlpha = sa; ctx.fillStyle = '#fff'; ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    ctx.fillStyle = 'rgba(0,212,255,0.85)'; ctx.fillRect(p.x - sz * 2.6, p.y - sz * .3, sz * 1.8, sz * .6); ctx.fillRect(p.x + sz * .8, p.y - sz * .3, sz * 1.8, sz * .6);
    if (uaP && i % 2 === 0) { const on2 = smooth(inv(33 + i * .3, 33.6 + i * .3, t)); ctx.globalAlpha = .55 * on2 * sa; ctx.strokeStyle = C.gold; ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * 40; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(uaP.x, uaP.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha = 1;
  });
  ctx.restore();
  if (uaP) { const pr = (t * .8) % 1; ctx.save(); ctx.strokeStyle = V.rgba(C.gold, (1 - pr) * .9); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(uaP.x, uaP.y, 6 + pr * 40, 0, 7); ctx.stroke(); ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(uaP.x, uaP.y, 4, 0, 7); ctx.fill(); ctx.restore(); }
  panel(ctx, t, uaP);
  V.sceneTitle(ctx, t, 32.6, '05 · РАЗВЕДКА', ['ИНФОРМАЦИЯ И СВЯЗЬ'], { size: 76, out: 39.6 });
  V.hud(ctx, t, '05', smooth(inv(32.2, 33, t)));
};

// ---------------------------------------------------------------- СЦЕНА 6. Лаборатория технологий
// модели — наборы деталей (коробки/цилиндры в локальных координатах) со смещением «взрыв-схемы»
const cyl = (cx, cy, cz, r, h, axis = 'y', n = 14) => { const segs = []; for (let i = 0; i < n; i++) { const a = i / n * 6.283, b = (i + 1) / n * 6.283; const P = (ang, yy) => axis === 'y' ? [cx + Math.cos(ang) * r, cy + yy, cz + Math.sin(ang) * r] : axis === 'x' ? [cx + yy, cy + Math.cos(ang) * r, cz + Math.sin(ang) * r] : [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, cz + yy]; segs.push([P(a, -h / 2), P(b, -h / 2)], [P(a, h / 2), P(b, h / 2)]); if (i % 3 === 0) segs.push([P(a, -h / 2), P(a, h / 2)]); } return segs; };
const boxE = (x0, y0, z0, x1, y1, z1) => { const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]; return [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].map(([a, b]) => [P[a], P[b]]); };
const MODELS = [
  { x: -13, name: 'БПЛА', t: 41.2, parts: [
    { e: boxE(-.7, -.25, -.45, .7, .25, .45), off: [0, 0, 0], l: 'КОРПУС' },
    { e: [[[-.6, 0, -.4], [-2.1, 0, -1.6]], [[.6, 0, -.4], [2.1, 0, -1.6]], [[-.6, 0, .4], [-2.1, 0, 1.6]], [[.6, 0, .4], [2.1, 0, 1.6]]].concat(cyl(-2.1, .15, -1.6, .9, .02), cyl(2.1, .15, -1.6, .9, .02), cyl(-2.1, .15, 1.6, .9, .02), cyl(2.1, .15, 1.6, .9, .02)), off: [0, 1.4, 0], l: 'РОТОРЫ' },
    { e: cyl(0, -.55, .1, .28, .4, 'y', 10), off: [0, -1.3, .6], l: 'КАМЕРА' },
    { e: boxE(-.45, .3, -.3, .45, .55, .3), off: [0, .6, -1.6], l: 'МОДУЛЬ СВЯЗИ' },
  ] },
  { x: 0, name: 'СВЯЗЬ', t: 43.5, parts: [
    { e: boxE(-.12, -2.2, -.12, .12, 1.6, .12).concat([[[-.12, -2.2, 0], [-1, -2.2, .9]], [[.12, -2.2, 0], [1, -2.2, .9]], [[0, -2.2, -.12], [0, -2.2, -1.2]]]), off: [0, 0, 0], l: 'МАЧТА' },
    { e: cyl(0, 1.3, .4, .95, .05, 'z', 18).concat([[[0, 1.3, .4], [0, 1.3, 1.4]]]), off: [0, .9, 1.4], l: 'АНТЕННА' },
    { e: boxE(-.6, -.6, -.4, .6, .3, .4), off: [1.7, 0, 0], l: 'ПЕРЕДАТЧИК' },
    { e: boxE(-.45, -2.1, -.45, .45, -1.4, .45), off: [-1.6, 0, .4], l: 'ПИТАНИЕ' },
  ] },
  { x: 13, name: 'БРОНЕТЕХНИКА', t: 45.7, parts: [
    { e: boxE(-2.2, -.3, -1, 2.2, .7, 1).concat([[[2.2, .7, -1], [2.9, -.1, -1]], [[2.2, .7, 1], [2.9, -.1, 1]], [[2.9, -.1, -1], [2.9, -.1, 1]], [[2.2, -.3, -1], [2.9, -.1, -1]], [[2.2, -.3, 1], [2.9, -.1, 1]]]), off: [0, 0, 0], l: 'БРОНЕКОРПУС' },
    { e: [-1.5, 0, 1.5].flatMap(x => cyl(x, -.55, 1.05, .5, .3, 'z', 12).concat(cyl(x, -.55, -1.05, .5, .3, 'z', 12))), off: [0, -1.3, 0], l: 'ПОДВЕСКА' },
    { e: boxE(-1.9, .1, -.7, -.7, .6, .7), off: [-1.6, 1.3, 0], l: 'ДВИГАТЕЛЬ' },
    { e: boxE(.2, .7, -.5, 1.2, 1.1, .5).concat([[[-.6, .7, .6], [-.6, 2.0, .6]]]), off: [.4, 1.5, 0], l: 'СВЯЗЬ И ОПТИКА' },
  ] },
];
S.s6cam = t => {
  const u = inv(39.8, 48.2, t);
  // проезд вдоль моделей: задержка на каждой во время её раскрытия + непрерывный дрейф
  const x = V.keys(t, [[39.7, -19], [41.0, -13.6], [42.9, -12.4], [43.8, -.6], [45.2, .6], [46.1, 12.4], [48.3, 14.5]]);
  const eye = [x - 1.6 + Math.sin(u * 6) * .5, 4.4 + Math.sin(u * 3.2) * .4, 12.5 - Math.sin(u * Math.PI) * 1.2];
  const tgt = [x, 3.0, -1];
  return V.camera(eye, tgt, 40, Math.sin(u * 5) * .015);
};
const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
S.s6 = (ctx, t) => {
  const cam = S.s6cam(t);
  const bg = ctx.createLinearGradient(0, 0, 0, V.H); bg.addColorStop(0, '#060B16'); bg.addColorStop(.55, '#0B1426'); bg.addColorStop(1, '#060A12');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, V.W, V.H);
  // пол: концентрические кольца, сетка, стена с вертикальными панелями
  ctx.save(); ctx.strokeStyle = 'rgba(0,212,255,0.07)'; ctx.lineWidth = 1;
  for (let gx = -40; gx <= 40; gx += 2) { V.line3(ctx, cam, [[gx, 0, -14], [gx, 0, 14]]); ctx.stroke(); }
  for (let gz = -14; gz <= 14; gz += 2) { V.line3(ctx, cam, [[-40, 0, gz], [40, 0, gz]]); ctx.stroke(); }
  for (let wx = -40; wx <= 40; wx += 3) { V.line3(ctx, cam, [[wx, 0, -14], [wx, 14, -14]]); ctx.strokeStyle = 'rgba(0,212,255,0.05)'; ctx.stroke(); }
  ctx.restore();
  // фокус — ближайшая к цели камеры модель
  const fx = cam.target[0];
  MODELS.forEach((M, mi) => {
    const dist = Math.abs(M.x - fx), blur = clamp((dist - 3) * .9, 0, 7);
    const [lc, lg] = V.layer(2 + mi);
    const g = blur > .3 ? lg : ctx;
    // пьедестал
    for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * 6.283; pts.push([M.x + Math.cos(a) * (2.8 + k * .5), .02, Math.sin(a) * (2.8 + k * .5)]); } V.line3(g, cam, pts); g.strokeStyle = V.rgba(C.cyan, [.7, .35, .15][k]); g.lineWidth = k ? 1 : 2; g.shadowColor = C.cyan; g.shadowBlur = k ? 0 : 14; g.stroke(); g.shadowBlur = 0; }
    // световой конус
    const top = cam.p(M.x, 6, 0), bot = cam.p(M.x, 0, 0);
    if (top && bot) { const gr = g.createLinearGradient(0, top.y, 0, bot.y); gr.addColorStop(0, 'rgba(0,212,255,0)'); gr.addColorStop(1, 'rgba(0,212,255,0.12)'); g.fillStyle = gr; const w = 2.8 * bot.s; g.beginPath(); g.moveTo(top.x - w * .2, top.y); g.lineTo(top.x + w * .2, top.y); g.lineTo(bot.x + w, bot.y); g.lineTo(bot.x - w, bot.y); g.fill(); }
    const ex = ease.io(inv(M.t, M.t + .55, t)) * (1 - ease.io(inv(M.t + 1.55, M.t + 2.1, t)));
    const rot = t * .55 + mi * 1.7, bob = Math.sin(t * 1.4 + mi) * .12, cy = 3.2 + bob;
    M.parts.forEach((P, pi) => {
      const o = P.off.map(v => v * ex);
      g.strokeStyle = ex > .05 && pi > 0 ? V.rgba(pi % 2 ? C.gold : '#BFF3FF', .95) : V.rgba(C.cyan, .9);
      g.lineWidth = 1.6; g.shadowColor = C.cyan; g.shadowBlur = 8;
      g.beginPath();
      for (const [a, b] of P.e) { const A = rotY([a[0] + o[0], a[1] + o[1], a[2] + o[2]], rot), B = rotY([b[0] + o[0], b[1] + o[1], b[2] + o[2]], rot); const pa = cam.p(M.x + A[0], cy + A[1], A[2]), pb = cam.p(M.x + B[0], cy + B[1], B[2]); if (pa && pb) { g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); } }
      g.stroke(); g.shadowBlur = 0;
      // выноски
      if (ex > .3) {
        const c0 = P.e[0][0], A = rotY([c0[0] + o[0], c0[1] + o[1], c0[2] + o[2]], rot), pa = cam.p(M.x + A[0], cy + A[1], A[2]);
        if (pa) { const la = smooth(inv(.3, .8, ex)), lx = pa.x + (pi % 2 ? 90 : -90), ly = pa.y - 40 - pi * 6;
          g.save(); g.globalAlpha = la; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(lx, ly); g.lineTo(lx + (pi % 2 ? 30 : -30), ly); g.stroke();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(pa.x, pa.y, 3, 0, 7); g.fill();
          V.text(g, P.l, lx + (pi % 2 ? 38 : -38), ly + 7, { size: 20, weight: 700, color: '#fff', track: 3, align: pi % 2 ? 'left' : 'right', p: la, rise: 4 }); g.restore(); }
      }
    });
    // подпись модели
    const lp = cam.p(M.x, .2, 3.6); if (lp) V.text(g, M.name, lp.x, lp.y + 34, { size: 24, weight: 800, color: C.cyan, align: 'center', track: 8, p: smooth(inv(40.3 + mi * .5, 41 + mi * .5, t)), rise: 6 });
    if (g === lg) { ctx.save(); ctx.filter = `blur(${blur.toFixed(1)}px)`; ctx.drawImage(lc, 0, 0); ctx.restore(); }
  });
  // голографические сканлинии
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const sy = (t * 300) % (V.H + 200) - 100; const gr = ctx.createLinearGradient(0, sy - 60, 0, sy + 60); gr.addColorStop(0, 'rgba(0,212,255,0)'); gr.addColorStop(.5, 'rgba(0,212,255,0.06)'); gr.addColorStop(1, 'rgba(0,212,255,0)'); ctx.fillStyle = gr; ctx.fillRect(0, sy - 60, V.W, 120); ctx.restore();
  V.dust(ctx, cam, t, .3);
  // подзаголовок к концу реплики
  const st = V.win(t, 45.3, 47.9, .5, .4);
  if (st > 0) { ctx.save(); ctx.globalAlpha = st; V.text(ctx, 'ТЕХНОЛОГИИ ≠ ИСХОД ВОЙНЫ', V.W - 120, 160, { size: 30, weight: 800, color: C.gold, align: 'right', track: 4, p: inv(45.3, 46.1, t), stagger: .3, rise: 8 }); ctx.restore(); }
  V.sceneTitle(ctx, t, 40.4, '06 · ТЕХНОЛОГИИ', ['ТЕХНОЛОГИИ МЕНЯЮТ', 'ХАРАКТЕР ВОЙНЫ'], { size: 74, out: 47.6 });
  V.hud(ctx, t, '06', 1 - smooth(inv(47.5, 48, t)));
};
})();
