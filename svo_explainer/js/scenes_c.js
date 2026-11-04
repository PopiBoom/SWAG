// Сцены 7–9: люди (документальная стилизация), экономика (частицы → граф), финал (система → карта Украины).
'use strict';
(() => {
const { clamp, lerp, inv, smooth, ease, C } = V;
const S = V.scenes;

// ---------------------------------------------------------------- СЦЕНА 7. Люди
const mixc = (a, b, k) => `rgb(${lerp(a[0], b[0], k) | 0},${lerp(a[1], b[1], k) | 0},${lerp(a[2], b[2], k) | 0})`;
// силуэт человека: x,y — точка между ступнями; h — рост в px
const person = (g, x, y, h, o = {}) => {
  const ph = o.ph || 0, walk = o.walk ? Math.sin(ph) : 0, col = o.col || '#1b1f24', coat = o.coat || col;
  g.save(); g.translate(x, y); if (o.flip) g.scale(-1, 1);
  const legW = h * .075, hip = -h * .47, sh = -h * .8;
  g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = legW;
  for (const s of [1, -1]) { const a = walk * .38 * s; g.beginPath(); g.moveTo(0, hip); g.lineTo(Math.sin(a) * h * .47, hip + Math.cos(a) * h * .47); g.stroke(); }
  g.fillStyle = coat; g.beginPath(); g.moveTo(-h * .12, sh); g.lineTo(h * .12, sh); g.lineTo(h * .1 + (o.long ? h * .04 : 0), hip + (o.long ? h * .16 : 0)); g.lineTo(-h * .1 - (o.long ? h * .04 : 0), hip + (o.long ? h * .16 : 0)); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(0, sh, h * .125, h * .04, 0, 0, 7); g.fill();
  g.fillStyle = o.skin || col; g.beginPath(); g.arc(0, -h * .9, h * .066, 0, 7); g.fill();
  if (o.hair) { g.fillStyle = o.hair; g.beginPath(); g.arc(0, -h * .91, h * .068, Math.PI, 0); g.fill(); }
  g.strokeStyle = coat; g.lineWidth = h * .06;
  const arm = o.walk ? -walk * .3 : 0;
  g.beginPath(); g.moveTo(-h * .1, sh + h * .02); g.lineTo(-h * .12 + Math.sin(arm) * h * .3, sh + Math.cos(arm) * h * .33); g.stroke();
  if (o.carry) { g.beginPath(); g.moveTo(h * .1, sh + h * .02); g.lineTo(h * .26, sh + h * .2); g.stroke(); g.fillStyle = o.carry; g.fillRect(h * .2, sh + h * .1, h * .26, h * .2); }
  else { g.beginPath(); g.moveTo(h * .1, sh + h * .02); g.lineTo(h * .16, sh + h * .33); g.stroke(); }
  if (o.vest) { g.fillStyle = o.vest; g.fillRect(-h * .11, sh + h * .02, h * .22, h * .2); g.fillStyle = 'rgba(235,235,220,0.8)'; g.fillRect(-h * .11, sh + h * .13, h * .22, h * .025); }
  if (o.bag) { g.fillStyle = o.bag; g.fillRect(h * .17, sh + h * .3, h * .2, h * .28); g.strokeStyle = o.bag; g.lineWidth = h * .015; g.beginPath(); g.moveTo(h * .17, sh + h * .3); g.lineTo(h * .2, sh + h * .32); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(h * .2, sh + h * .59, h * .02, 0, 7); g.arc(h * .34, sh + h * .59, h * .02, 0, 7); g.fill(); }
  if (o.steth) { g.strokeStyle = '#3a4a55'; g.lineWidth = h * .012; g.beginPath(); g.arc(0, sh + h * .04, h * .07, .2, Math.PI - .2); g.stroke(); }
  g.restore();
};
V.person = person;
const FOG = [150, 158, 162];
const shotStreet = (g, t) => {
  const u = inv(47.8, 51.4, t);
  const cam = V.camera([lerp(-.6, .6, u), 1.7, lerp(14, 8, u)], [lerp(.2, .5, u), 2.4, -40], 46, -.01);
  const sky = g.createLinearGradient(0, 0, 0, V.H * .6); sky.addColorStop(0, '#7f8a92'); sky.addColorStop(.6, '#b9b2a2'); sky.addColorStop(1, '#d4c3a4'); g.fillStyle = sky; g.fillRect(0, 0, V.W, V.H);
  // мокрый асфальт
  const road = [[-6, 0, 20], [6, 0, 20], [6, 0, -60], [-6, 0, -60]].map(q => cam.p(...q));
  if (road.every(Boolean)) { const rg = g.createLinearGradient(0, road[2].y, 0, V.H); rg.addColorStop(0, '#8d8f8c'); rg.addColorStop(1, '#3a3d40'); g.fillStyle = rg; g.beginPath(); road.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.fill(); }
  for (let z = 16; z > -58; z -= 5) { const a = cam.p(0, .01, z), b = cam.p(0, .01, z - 2.2); if (a && b) { g.strokeStyle = 'rgba(220,215,200,0.45)'; g.lineWidth = Math.max(1, a.s * .12); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } }
  // дома по обеим сторонам (от дальних к ближним)
  const r = V.rng(7070), blds = [];
  for (const side of [-1, 1]) { let z = 18; while (z > -60) { const d = 5 + r() * 6, h = 6 + r() * 12; blds.push({ side, z0: z - d, z1: z, h, seed: r() }); z -= d + .3; } }
  blds.sort((a, b) => a.z0 - b.z0);
  for (const B of blds) {
    const x0 = B.side * 8, x1 = B.side * 16, dep = clamp((cam.eye[2] - B.z1) / 60), fogk = dep * .85;
    const base = [64 + B.seed * 20, 66 + B.seed * 15, 70 + B.seed * 10];
    V.box(g, cam, Math.min(x0, x1), 0, B.z0, Math.max(x0, x1), B.h, B.z1, { front: mixc(base.map(v => v * .8), FOG, fogk), side: mixc(base, FOG, fogk), top: mixc(base, FOG, fogk) });
    // окна на фасаде, обращённом к улице
    const rr = V.rng(Math.floor(B.seed * 1e6));
    for (let fy = 1.2; fy < B.h - 1; fy += 2.2) for (let fz = B.z0 + .8; fz < B.z1 - .8; fz += 1.6) {
      const lit = rr() < .12, q = [[x0, fy, fz], [x0, fy, fz + .9], [x0, fy + 1.2, fz + .9], [x0, fy + 1.2, fz]].map(v => cam.p(...v)); if (!q.every(Boolean)) continue;
      g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
      g.fillStyle = lit ? mixc([235, 190, 120], FOG, fogk * .6) : mixc([38, 42, 48], FOG, fogk); g.fill();
    }
  }
  // фонари
  for (let z = 12; z > -50; z -= 9) for (const s of [-1, 1]) { const a = cam.p(s * 7, 0, z), b = cam.p(s * 7, 5.5, z), c = cam.p(s * 6, 5.5, z); if (!a || !b || !c) continue; const fk = clamp((cam.eye[2] - z) / 60) * .85; g.strokeStyle = mixc([30, 32, 34], FOG, fk); g.lineWidth = Math.max(1, a.s * .12); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.stroke(); }
  // туман и утренний свет
  const fg = g.createLinearGradient(0, V.H * .25, 0, V.H * .75); fg.addColorStop(0, 'rgba(200,196,184,0)'); fg.addColorStop(.5, 'rgba(200,196,184,0.35)'); fg.addColorStop(1, 'rgba(200,196,184,0)'); g.fillStyle = fg; g.fillRect(0, 0, V.W, V.H);
  const vp = cam.p(0, 3, -60); if (vp) { const lg = g.createRadialGradient(vp.x, vp.y, 0, vp.x, vp.y, 700); lg.addColorStop(0, 'rgba(255,230,190,0.45)'); lg.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = lg; g.fillRect(0, 0, V.W, V.H); }
  // пыль в воздухе
  const rd = V.rng(4); g.fillStyle = 'rgba(255,245,225,0.5)'; for (let i = 0; i < 120; i++) { const x = (rd() * V.W + t * 30 * (rd() + .3)) % V.W, y = rd() * V.H; g.fillRect(x, y + Math.sin(t + i) * 6, 2, 2); }
};
const shotBus = (g, t) => {
  const u = inv(50.4, 54.0, t), pan = lerp(0, 1, u);
  const sky = g.createLinearGradient(0, 0, 0, V.H); sky.addColorStop(0, '#8f9aa0'); sky.addColorStop(.55, '#c4b9a6'); sky.addColorStop(1, '#6e6a62'); g.fillStyle = sky; g.fillRect(0, 0, V.W, V.H);
  // дальний план: дома (размыты)
  const [lc, lg] = V.layer(4); const r = V.rng(51);
  for (let i = 0; i < 14; i++) { const w = 160 + r() * 220, h = 220 + r() * 320, x = i * 170 - 200 - pan * 120; lg.fillStyle = `rgb(${110 + r() * 20 | 0},${112 + r() * 18 | 0},${112 + r() * 12 | 0})`; lg.fillRect(x, 640 - h, w, h); for (let k = 0; k < 10; k++) { lg.fillStyle = r() < .2 ? 'rgba(240,200,140,0.8)' : 'rgba(70,75,82,0.7)'; lg.fillRect(x + 20 + (k % 4) * (w - 40) / 4, 640 - h + 30 + Math.floor(k / 4) * 70, 22, 34); } }
  g.save(); g.filter = 'blur(6px)'; g.drawImage(lc, 0, 0); g.restore();
  // тротуар
  g.fillStyle = '#5d5a55'; g.fillRect(0, 760, V.W, 320); g.fillStyle = '#7b7770'; g.fillRect(0, 740, V.W, 26);
  // автобус
  const bx = 820 - pan * 260, by = 380;
  g.save(); g.translate(bx, by);
  g.fillStyle = '#d6d0c0'; g.beginPath(); g.roundRect(0, 0, 1180, 360, [40, 40, 14, 14]); g.fill();
  g.fillStyle = '#4a6a78'; g.fillRect(0, 250, 1180, 22);
  for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(40,46,52,0.9)'; g.fillRect(150 + i * 140, 50, 118, 140); g.fillStyle = 'rgba(245,205,140,0.45)'; g.fillRect(150 + i * 140, 50, 118, 140); if (i % 2 === 0) person(g, 210 + i * 140, 190, 120, { col: '#3b3530' }); }
  g.fillStyle = '#2d3238'; g.fillRect(30, 60, 90, 280); g.fillStyle = 'rgba(245,205,140,0.6)'; g.fillRect(38, 70, 74, 150);
  g.fillStyle = '#2f4f5e'; g.font = V.font(38, 800); g.letterSpacing = '4px'; g.fillText('ЭВАКУАЦИЯ', 700, 320); g.letterSpacing = '0px';
  for (const wx of [230, 960]) { g.fillStyle = '#1e2124'; g.beginPath(); g.arc(wx, 360, 62, 0, 7); g.fill(); g.fillStyle = '#6d6f70'; g.beginPath(); g.arc(wx, 360, 26, 0, 7); g.fill(); }
  g.restore();
  // люди: семьи с чемоданами идут к двери, волонтёр передаёт коробку
  const walkers = [{ x: 300, h: 300, bag: '#5a4636' }, { x: 420, h: 210, bag: null, child: 1 }, { x: 140, h: 320, bag: '#3d4a55' }, { x: -60, h: 290, bag: '#6a3f35' }, { x: -230, h: 305, bag: '#4b4d3a' }];
  walkers.forEach((w, i) => { const x = w.x + (t - 50.4) * 70 - pan * 260, ph = (t - 50.4) * 7 + i; person(g, x, 830, w.h, { walk: 1, ph, col: ['#24262a', '#2c2620', '#1f2a30', '#2e2420', '#23251f'][i], bag: w.bag, hair: i === 0 ? '#3a2a20' : null }); });
  person(g, 760 - pan * 260, 830, 310, { col: '#24282c', vest: '#c98a3a', carry: '#a8885a', flip: 1 });
  person(g, 640 - pan * 260, 830, 300, { col: '#2a2522', carry: '#a8885a' });
  // передний план — размытые прохожие
  const [lc2, lg2] = V.layer(5); person(lg2, 2000 - (t - 50.4) * 1100, 1240, 900, { walk: 1, ph: t * 5, col: '#14171a' }); person(lg2, 200 - (t - 50.4) * 260, 1260, 860, { walk: 1, ph: t * 5 + 2, col: '#111316' });
  g.save(); g.filter = 'blur(16px)'; g.drawImage(lc2, 0, 0); g.restore();
};
const shotHospital = (g, t) => {
  const u = inv(53.1, 56.2, t);
  const cam = V.camera([lerp(-.3, .4, u), 1.65, lerp(9, 5.5, u)], [.2, 1.6, -30], 50, 0);
  g.fillStyle = '#c8cfc9'; g.fillRect(0, 0, V.W, V.H);
  const quad = (pts, fill) => { const q = pts.map(p => cam.p(...p)); if (!q.every(Boolean)) return; g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fillStyle = fill; g.fill(); };
  const Z0 = 12, Z1 = -30, Wd = 2.6, Hh = 3.2;
  const lin = (a, b, y0, y1) => { const gg = g.createLinearGradient(0, y0, 0, y1); gg.addColorStop(0, a); gg.addColorStop(1, b); return gg; };
  quad([[-Wd, 0, Z0], [Wd, 0, Z0], [Wd, 0, Z1], [-Wd, 0, Z1]], lin('#a9b2ab', '#6f7a75', 560, V.H));
  quad([[-Wd, Hh, Z0], [Wd, Hh, Z0], [Wd, Hh, Z1], [-Wd, Hh, Z1]], '#d8ddd6');
  quad([[-Wd, 0, Z0], [-Wd, Hh, Z0], [-Wd, Hh, Z1], [-Wd, 0, Z1]], '#b9c3bc');
  quad([[Wd, 0, Z0], [Wd, Hh, Z0], [Wd, Hh, Z1], [Wd, 0, Z1]], '#aab5ae');
  quad([[-Wd, 0, Z1], [Wd, 0, Z1], [Wd, Hh, Z1], [-Wd, Hh, Z1]], '#e9ece4');
  // полоса-панель на стенах
  for (const s of [-1, 1]) quad([[s * Wd, 0, Z0], [s * Wd, .9, Z0], [s * Wd, .9, Z1], [s * Wd, 0, Z1]], s < 0 ? '#8fa39b' : '#869a92');
  // окна слева с дневным светом, двери справа
  for (let z = 6; z > -28; z -= 5) {
    quad([[-Wd + .01, 1.1, z], [-Wd + .01, 2.6, z], [-Wd + .01, 2.6, z - 2], [-Wd + .01, 1.1, z - 2]], '#f6f1e2');
    quad([[-Wd + .01, 0, z], [Wd * .2, 0, z - 1.2], [Wd * .2, 0, z - 3.6], [-Wd + .01, 0, z - 2]], 'rgba(255,245,220,0.35)');
    quad([[Wd - .01, 0, z - 1], [Wd - .01, 2.3, z - 1], [Wd - .01, 2.3, z - 2.4], [Wd - .01, 0, z - 2.4]], '#7d8c86');
  }
  for (let z = 8; z > -28; z -= 4) quad([[-.6, Hh - .01, z], [.6, Hh - .01, z], [.6, Hh - .01, z - 1.2], [-.6, Hh - .01, z - 1.2]], '#fbfbf4');
  // врач и семья на скамье — плоские фигуры в пространстве
  const pp = cam.p(.75, 0, -1.2), pb = cam.p(-1.6, 0, -.6);
  if (pb) { g.fillStyle = '#4b544f'; g.fillRect(pb.x - 1.8 * pb.s, pb.y - .5 * pb.s, 2.6 * pb.s, .12 * pb.s); person(g, pb.x - .9 * pb.s, pb.y - .02 * pb.s, 1.25 * pb.s, { col: '#3a3632', bag: null }); person(g, pb.x - .2 * pb.s, pb.y - .02 * pb.s, .85 * pb.s, { col: '#4a3d36' }); }
  if (pp) person(g, pp.x, pp.y, 1.8 * pp.s, { col: '#3a4148', coat: '#e7ebe8', long: 1, skin: '#6b5446', hair: '#2a2420', steth: 1, flip: 1 });
  const fk = g.createLinearGradient(0, 0, V.W, 0); fk.addColorStop(0, 'rgba(255,240,210,0.25)'); fk.addColorStop(.5, 'rgba(255,240,210,0)'); g.fillStyle = fk; g.fillRect(0, 0, V.W, V.H);
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#b4bcb6'; g.fillRect(0, 0, V.W, V.H); g.restore();
};
S.s7 = (ctx, t) => {
  const kA = 1 - smooth(inv(50.5, 51.1, t)), kC = smooth(inv(53.2, 53.8, t));
  if (kA > 0) shotStreet(ctx, t);
  if (kA < 1 && kC < 1) { const [lc, lg] = V.layer(6); shotBus(lg, t); ctx.save(); ctx.globalAlpha = (1 - kA); ctx.drawImage(lc, 0, 0); ctx.restore(); }
  if (kC > 0) { const [lc, lg] = V.layer(6); shotHospital(lg, t); ctx.save(); ctx.globalAlpha = kC; ctx.drawImage(lc, 0, 0); ctx.restore(); }
  // световой блик на стыках
  for (const tc of [50.8, 53.5]) { const k = Math.max(0, 1 - Math.abs(t - tc) / .35); if (k > 0) { const lg = ctx.createRadialGradient(V.W * .8, V.H * .3, 0, V.W * .8, V.H * .3, V.W * .7); lg.addColorStop(0, `rgba(255,214,160,${.5 * k})`); lg.addColorStop(1, 'rgba(255,214,160,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, V.W, V.H); } }
  // грейдинг: приглушённые цвета
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#d8cfc0'; ctx.fillRect(0, 0, V.W, V.H); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.35)'; ctx.fillRect(0, 0, V.W, V.H); ctx.restore();
  // заголовок
  const ta = V.win(t, 49.0, 55.3, .8, .6);
  if (ta > 0) {
    ctx.save(); const gr = ctx.createLinearGradient(0, 620, 0, V.H); gr.addColorStop(0, 'rgba(10,10,12,0)'); gr.addColorStop(.55, `rgba(10,10,12,${.55 * ta})`); gr.addColorStop(1, `rgba(10,10,12,${.85 * ta})`); ctx.fillStyle = gr; ctx.fillRect(0, 620, V.W, V.H - 620);
    V.text(ctx, '07 · ЛЮДИ', V.W / 2, 788, { size: 22, weight: 600, color: 'rgba(255,225,190,0.9)', align: 'center', track: 6, p: inv(49, 49.7, t), alpha: ta, rise: 6 });
    V.text(ctx, 'ЗА КАЖДЫМ РЕШЕНИЕМ —', V.W / 2, 872, { size: 72, weight: 700, align: 'center', p: inv(49.2, 50.3, t), alpha: ta, stagger: .4, blurIn: 8 });
    V.text(ctx, 'ЧЕЛОВЕЧЕСКИЕ СУДЬБЫ', V.W / 2, 952, { size: 72, weight: 700, align: 'center', color: '#FFE3BF', p: inv(49.6, 50.7, t), alpha: ta, stagger: .4, blurIn: 8 });
    ctx.restore();
  }
  // кашетирование
  const lb = 64 * smooth(inv(47.9, 48.6, t)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, V.W, lb); ctx.fillRect(0, V.H - lb, V.W, lb);
};

// ---------------------------------------------------------------- СЦЕНА 8. Экономика
let SNAP = null; // частицы, полученные из кадра сцены 7
const BARS = []; { const r = V.rng(808); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) BARS.push({ x: -5 + i * 2, z: -2.6 + j * 2, h: 2 + r() * 6, ph: r() }); }
const ANCH = { budget: [0, 9.5, -1], prod: [-15, 6.5, -4], energy: [14, 9, -5], trans: [17, 1.2, -15], intl: [-22, 7, -20], pol: [3, 12.5, 4] };
const TARGETS = (() => { // точки на объектах — цели частиц
  const r = V.rng(818), pts = [];
  for (let i = 0; i < 40000; i++) {
    const k = r();
    if (k < .35) { const b = BARS[Math.floor(r() * BARS.length)]; pts.push([b.x - .7 + r() * 1.4, r() * b.h, b.z - .7 + r() * 1.4]); }
    else if (k < .55) pts.push([-18 + r() * 8, r() * 3.5, -7 + r() * 6]);
    else if (k < .68) { const a = r() * 6.28, y = r() * 7, rad = 2.6 - Math.sin(y / 7 * Math.PI) * .9; pts.push([14 + Math.cos(a) * rad, y, -5 + Math.sin(a) * rad]); }
    else if (k < .8) pts.push([-24 + r() * 48, .3, -15 + (r() - .5) * .6]);
    else pts.push([-26 + r() * 52, 0, -20 + r() * 30]);
  }
  return pts;
})();
V.makeSnap = img => { // img: canvas кадра сцены 7 (1920×1080)
  const cs = 8, cols = V.W / cs, rows = Math.ceil(V.H / cs);
  const c = document.createElement('canvas'); c.width = cols; c.height = rows; const g = c.getContext('2d'); g.drawImage(img, 0, 0, cols, rows);
  const d = g.getImageData(0, 0, cols, rows).data, P = [], r = V.rng(99);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const k = (j * cols + i) * 4; P.push({ x: i * cs + cs / 2, y: j * cs + cs / 2, r: d[k], g: d[k + 1], b: d[k + 2], tg: TARGETS[(j * cols + i) % TARGETS.length], dl: (i / cols) * .5 + r() * .35, sw: r() * 6.28 }); }
  SNAP = { P, img };
};
S.s8cam = t => { const u = inv(55.6, 64.6, t), k = ease.io(u); const tgt = [0, 3.5, -6]; return V.camera(V.orbit(tgt, lerp(44, 34, k), lerp(-.55, .3, k), lerp(.52, .4, k)), tgt, 42, 0); };
const tag = (ctx, cam, t, t0, A, label, col) => {
  const p = cam.p(...A), a = smooth(inv(t0, t0 + .4, t)); if (!p || a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = V.rgba(col, .9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 46); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill();
  const w = V.measure(ctx, label, 22, 800, 3) + 30; ctx.fillStyle = 'rgba(8,13,24,0.8)'; ctx.fillRect(p.x - w / 2, p.y - 92, w, 44); ctx.strokeRect(p.x - w / 2, p.y - 92, w, 44);
  V.text(ctx, label, p.x, p.y - 62, { size: 22, weight: 800, align: 'center', track: 3, p: a, rise: 4 }); ctx.restore();
};
S.s8 = (ctx, t) => {
  const cam = S.s8cam(t);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, V.W, V.H);
  const bgG = ctx.createRadialGradient(V.W / 2, V.H * .55, 50, V.W / 2, V.H * .55, V.W * .7); bgG.addColorStop(0, '#0f1d36'); bgG.addColorStop(1, C.bg); ctx.fillStyle = bgG; ctx.fillRect(0, 0, V.W, V.H);
  const G = smooth(inv(56.9, 58.0, t)); // проявление геометрии
  ctx.save(); ctx.globalAlpha = G;
  ctx.strokeStyle = 'rgba(0,212,255,0.09)'; ctx.lineWidth = 1;
  for (let x = -28; x <= 28; x += 2) { V.line3(ctx, cam, [[x, 0, -22], [x, 0, 12]]); ctx.stroke(); }
  for (let z = -22; z <= 12; z += 2) { V.line3(ctx, cam, [[-28, 0, z], [28, 0, z]]); ctx.stroke(); }
  // транспорт
  ctx.strokeStyle = 'rgba(159,232,255,0.6)'; ctx.lineWidth = 2; V.line3(ctx, cam, [[-26, .05, -15], [26, .05, -15]]); ctx.stroke();
  for (let c = 0; c < 10; c++) { const x = ((t - 56) * 3 + c * 1.6) % 56 - 28; V.box(ctx, cam, x, .1, -15.4, x + 1.4, .9, -14.6, { top: 'rgba(159,232,255,0.6)', side: 'rgba(20,50,80,0.9)', front: 'rgba(15,40,70,0.9)', line: 'rgba(159,232,255,0.8)' }); }
  // заводы
  for (let i = 0; i < 3; i++) { const x = -19 + i * 3; V.box(ctx, cam, x, 0, -7, x + 2.6, 2.4 + i * .4, -1, { top: 'rgba(0,212,255,0.25)', side: 'rgba(10,30,55,0.95)', front: 'rgba(8,24,46,0.95)', line: 'rgba(0,212,255,0.7)' });
    V.box(ctx, cam, x + 1.8, 0, -6.2, x + 2.3, 5 + i, -5.7, { top: 'rgba(255,209,102,0.6)', side: 'rgba(30,30,40,0.95)', front: 'rgba(25,25,35,0.95)', line: 'rgba(255,209,102,0.6)' });
    for (let k = 0; k < 6; k++) { const ph = ((t * .5 + k / 6 + i * .3) % 1), p = cam.p(x + 2.05 + ph * 1.5, 5 + i + ph * 4, -5.95); if (p) { const rr = (10 + ph * 40) * p.s / 30; ctx.fillStyle = `rgba(190,210,230,${.12 * (1 - ph)})`; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.fill(); } } }
  // энергетика: градирня + опоры ЛЭП
  ctx.strokeStyle = 'rgba(0,212,255,0.75)'; ctx.lineWidth = 1.3;
  for (let y = 0; y <= 7; y += .7) { const rad = 2.6 - Math.sin(y / 7 * Math.PI) * .9, pts = []; for (let a = 0; a <= 6.3; a += .3) pts.push([14 + Math.cos(a) * rad, y, -5 + Math.sin(a) * rad]); V.line3(ctx, cam, pts); ctx.stroke(); }
  for (let k = 0; k < 4; k++) { const x = 9 - k * 4.5, z = -1 + k * .5; ctx.strokeStyle = 'rgba(255,209,102,0.7)'; V.line3(ctx, cam, [[x - .5, 0, z], [x, 4, z], [x + .5, 0, z]]); ctx.stroke(); V.line3(ctx, cam, [[x - .8, 3.4, z], [x + .8, 3.4, z]]); ctx.stroke(); }
  // бюджеты — объёмный график
  const rise = ease.out(inv(57.1, 58.6, t));
  const bs = BARS.map(b => ({ b, d: Math.hypot(b.x - cam.eye[0], b.z - cam.eye[2]) })).sort((a, b) => b.d - a.d);
  for (const { b } of bs) { const h = b.h * rise * (1 + .08 * Math.sin(t * 1.6 + b.ph * 6)); V.box(ctx, cam, b.x - .7, 0, b.z - .7, b.x + .7, Math.max(.05, h), b.z + .7, { top: b.h > 6 ? 'rgba(255,209,102,0.85)' : 'rgba(0,212,255,0.6)', side: 'rgba(0,80,130,0.55)', front: 'rgba(0,60,110,0.55)', line: 'rgba(160,235,255,0.8)' }); }
  // международная поддержка — дуги извне
  const ia = smooth(inv(59.4, 60.2, t));
  if (ia > 0) { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 7; k++) { const sx = -30 + k * 10, pts = []; for (let s = 0; s <= 20; s++) { const u = s / 20; pts.push([lerp(sx, 0, u), Math.sin(u * Math.PI) * 6 + lerp(2, 6, u), lerp(-30, -2, u)]); } V.line3(ctx, cam, pts.slice(0, Math.max(2, Math.round(21 * ease.out(inv(59.4 + k * .07, 60.4 + k * .07, t)))))); ctx.strokeStyle = V.rgba(C.gold, .5 * ia); ctx.lineWidth = 2; ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; }
  // сеть взаимосвязей
  const na = smooth(inv(58.6, 59.6, t)), keys = Object.keys(ANCH);
  if (na > 0) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const A = ANCH[keys[i]], B = ANCH[keys[j]]; V.line3(ctx, cam, [A, B]); ctx.strokeStyle = V.rgba(C.cyan, .35 * na); ctx.lineWidth = 1.4; ctx.stroke(); const u = (t * .5 + i * .17 + j * .11) % 1, p = cam.p(lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)); if (p) { ctx.fillStyle = V.rgba('#ffffff', .9 * na); ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); } } ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  // частицы из кадра «Люди»
  if (SNAP && t < 58.6) {
    if (t < 56.2) { ctx.save(); ctx.globalAlpha = 1 - smooth(inv(55.6, 56.2, t)); ctx.drawImage(SNAP.img, 0, 0); ctx.restore(); }
    const [lc, lg] = V.layer(7); const id = lg.createImageData(V.W, V.H), buf = new Uint32Array(id.data.buffer), fade = 1 - smooth(inv(57.8, 58.6, t));
    for (const q of SNAP.P) {
      const k = ease.io(inv(55.6 + q.dl, 57.2 + q.dl, t)); if (k <= 0 && t < 56.2) continue;
      const tp = cam.p(...q.tg); if (!tp) continue;
      const sw = Math.sin(k * Math.PI) * 120;
      const x = lerp(q.x, tp.x, k) + Math.cos(q.sw + k * 3) * sw, y = lerp(q.y, tp.y, k) + Math.sin(q.sw + k * 3) * sw * .6;
      const sz = Math.round(lerp(7, 2, smooth(k))), r = lerp(q.r, k > .5 ? 120 : 0, k) | 0, gg = lerp(q.g, 225, k) | 0, b = lerp(q.b, 255, k) | 0, al = (255 * fade * (k > 0 ? 1 : 0)) | 0;
      if (!al) continue; const px = x | 0, py = y | 0, col = (al << 24) | (b << 16) | (gg << 8) | r;
      for (let yy = 0; yy < sz; yy++) { const row = py + yy; if (row < 0 || row >= V.H) continue; for (let xx = 0; xx < sz; xx++) { const cx = px + xx; if (cx >= 0 && cx < V.W) buf[row * V.W + cx] = col; } }
    }
    lg.putImageData(id, 0, 0); ctx.drawImage(lc, 0, 0);
  }
  tag(ctx, cam, t, 57.27, ANCH.budget, 'ГОСБЮДЖЕТЫ', C.gold);
  tag(ctx, cam, t, 58.03, ANCH.prod, 'ПРОИЗВОДСТВО', C.cyan);
  tag(ctx, cam, t, 58.79, ANCH.energy, 'РЕСУРСЫ И ЭНЕРГЕТИКА', C.cyan);
  tag(ctx, cam, t, 58.4, ANCH.trans, 'ТРАНСПОРТ', C.cyan);
  tag(ctx, cam, t, 59.53, ANCH.intl, 'МЕЖДУНАРОДНАЯ ПОДДЕРЖКА', C.gold);
  tag(ctx, cam, t, 60.89, ANCH.pol, 'ПОЛИТИЧЕСКИЕ РЕШЕНИЯ', C.red);
  ctx.save(); ctx.globalAlpha = smooth(inv(57.5, 58.3, t)); ctx.font = V.font(16, 600); ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'right'; ctx.fillText('УСЛОВНАЯ ВИЗУАЛИЗАЦИЯ · БЕЗ РЕАЛЬНЫХ ДАННЫХ', V.W - 120, V.H - 70); ctx.restore();
  V.sceneTitle(ctx, t, 56.9, '08 · ЭКОНОМИКА', ['ЭКОНОМИКА И РЕСУРСЫ'], { size: 80, out: 63.6 });
  V.hud(ctx, t, '08', smooth(inv(56.4, 57.2, t)));
};

// ---------------------------------------------------------------- СЦЕНА 9. Система → карта Украины
const CARDS = [['ГЕОГРАФИЯ', 3.9], ['ПОЛИТИКА', 15.3], ['ФРОНТ', 20.6], ['ЛОГИСТИКА', 29.6], ['ИНФОРМАЦИЯ', 38.4], ['ТЕХНОЛОГИИ', 41.9], ['ЛЮДИ', 51.8], ['ЭКОНОМИКА', 61.6], ['УСЛОВИЯ МИРА', null]];
const HL = { 1: 66.77, 7: 67.27, 3: 67.27, 5: 67.81, 6: 68.53 };
V.thumbs = [];
V.makeThumbs = render => { CARDS.forEach(([, tt], i) => { const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d'); if (tt !== null) g.drawImage(render(tt), 0, 0, 480, 270); else { g.fillStyle = '#0b1a30'; g.fillRect(0, 0, 480, 270); g.strokeStyle = '#fff'; g.lineWidth = 6; g.shadowColor = C.gold; g.shadowBlur = 30; g.beginPath(); g.arc(240, 125, 60, 0, 7); g.stroke(); g.beginPath(); g.moveTo(195, 130); g.quadraticCurveTo(240, 165, 285, 130); g.stroke(); } V.thumbs[i] = c; }); };
const RR = 16, CW = 5.6, CH = 3.15;
const cardPos = (i, t) => { const a = (i - 7) * Math.PI * 2 / 9 + (t - 64) * .09; return [RR * Math.sin(a), 0, RR * Math.cos(a)]; };
S.s9cam = t => {
  const k = ease.io5(inv(64.0, 66.4, t)), fov = 40, f = (V.H / 2) / Math.tan(fov * Math.PI / 360);
  const fin = V.orbit([0, 0, 0], 39, .0 + (t - 64) * .01, .3);
  const c7 = cardPos(7, t), dir = [fin[0] - c7[0], fin[1] - c7[1], fin[2] - c7[2]], L = Math.hypot(...dir), d0 = f * CW / V.W;
  const start = [c7[0] + dir[0] / L * d0, c7[1] + dir[1] / L * d0, c7[2] + dir[2] / L * d0];
  return V.camera(V.mix3(start, fin, k), V.mix3(c7, [0, -1.2, 0], k), fov, 0);
};
const UAPTS = () => { if (V._uapts) return V._uapts; const rings = V.UA.rings.slice().sort((a, b) => b.length - a.length); const main = rings[0]; const k = 66, cx = 960, cy = 395, cl = Math.cos(48.4 * Math.PI / 180);
  V._uaRings = rings.map(r => r.map(([lo, la]) => [cx + (lo - 31.2) * cl * k, cy - (la - 48.4) * k])); const P = V._uaRings[0], out = []; for (let i = 0; i < 1080; i++) out.push(P[Math.floor(i / 1080 * P.length)]); V._uapts = out; void main; return out; };
S.s9 = (ctx, t, liveS8) => {
  const cam = S.s9cam(t);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, V.W, V.H);
  const bgG = ctx.createRadialGradient(V.W / 2, V.H / 2, 50, V.W / 2, V.H / 2, V.W * .7); bgG.addColorStop(0, '#0e1c34'); bgG.addColorStop(1, C.bg); ctx.fillStyle = bgG; ctx.fillRect(0, 0, V.W, V.H);
  const sysA = 1 - smooth(inv(69.7, 70.6, t));
  const cards = CARDS.map((c, i) => { const P = cardPos(i, t); return { i, P, d: Math.hypot(P[0] - cam.eye[0], P[1] - cam.eye[1], P[2] - cam.eye[2]) }; }).sort((a, b) => b.d - a.d);
  // связи
  const la = smooth(inv(65.0, 66.6, t)) * sysA;
  if (la > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) { const A = cardPos(i, t), B = cardPos(j, t), pr = ease.out(inv(65 + (i + j) * .05, 66 + (i + j) * .05, t)); if (pr <= 0) continue; V.line3(ctx, cam, [A, V.mix3(A, B, pr)]); ctx.strokeStyle = V.rgba(C.cyan, .22 * la); ctx.lineWidth = 1.2; ctx.stroke();
      const u = (t * .45 + i * .13 + j * .07) % 1, p = cam.p(...V.mix3(A, B, u)); if (p && pr >= 1) { ctx.fillStyle = V.rgba((i + j) % 3 ? '#BFF3FF' : C.gold, .9 * la); ctx.fillRect(p.x - 2, p.y - 2, 4, 4); } }
    const cc = cam.p(0, 0, 0); if (cc) { for (let i = 0; i < 9; i++) { V.line3(ctx, cam, [[0, 0, 0], cardPos(i, t)]); ctx.strokeStyle = V.rgba(C.gold, .3 * la); ctx.stroke(); } const g = ctx.createRadialGradient(cc.x, cc.y, 0, cc.x, cc.y, 120); g.addColorStop(0, V.rgba(C.gold, .55 * la)); g.addColorStop(1, 'rgba(255,209,102,0)'); ctx.fillStyle = g; ctx.fillRect(cc.x - 120, cc.y - 120, 240, 240); }
    ctx.restore();
  }
  // карточки
  const dissolve = inv(69.6, 70.4, t);
  for (const { i, P } of cards) {
    const c = cam.p(...P); if (!c) continue;
    const w = CW * c.s, h = CH * c.s, img = (i === 7 && t < 65.2 && liveS8) ? liveS8 : V.thumbs[i];
    const hl = HL[i] ? Math.max(0, 1 - Math.abs(t - HL[i] - .25) * 1.6) : 0;
    const tw = V.win(t, 66.0, 69.9, .5, .45), over = Math.abs(c.x - V.W / 2) < 500 + w / 2 && c.y + h / 2 > 380 && c.y - h / 2 < 690;
    ctx.save(); ctx.globalAlpha = sysA * (1 - dissolve) * (over ? 1 - .5 * tw : 1);
    if (img) ctx.drawImage(img, c.x - w / 2, c.y - h / 2, w, h);
    const fa = i === 7 ? smooth(inv(64.0, 64.6, t)) : 1;
    ctx.fillStyle = `rgba(8,13,24,${.35 * fa})`; ctx.fillRect(c.x - w / 2, c.y - h / 2, w, h);
    ctx.strokeStyle = hl > 0 ? V.rgba(C.gold, .6 + .4 * hl) : V.rgba(C.cyan, .8 * fa); ctx.lineWidth = 2 + 3 * hl; ctx.shadowColor = hl > 0 ? C.gold : C.cyan; ctx.shadowBlur = 18 + 30 * hl; ctx.strokeRect(c.x - w / 2, c.y - h / 2, w, h); ctx.shadowBlur = 0;
    const fs = clamp(c.s * .5, 12, 30);
    ctx.globalAlpha *= fa; ctx.fillStyle = 'rgba(8,13,24,0.85)'; ctx.fillRect(c.x - w / 2, c.y + h / 2 - fs * 1.7, w, fs * 1.7);
    V.text(ctx, CARDS[i][0], c.x, c.y + h / 2 - fs * .5, { size: fs, weight: 800, align: 'center', track: 3, p: 1, color: hl > .1 ? C.gold : '#fff' });
    V.text(ctx, `0${i + 1}`, c.x - w / 2 + fs * .5, c.y - h / 2 + fs * 1.2, { size: fs * .7, weight: 700, color: C.cyan, p: 1 });
    ctx.restore();
  }
  // центральная надпись
  const ta = V.win(t, 66.1, 69.9, .5, .45);
  if (ta > 0) {
    ctx.save(); const rg = ctx.createRadialGradient(V.W / 2, 540, 40, V.W / 2, 540, 640); rg.addColorStop(0, `rgba(8,13,24,${.86 * ta})`); rg.addColorStop(1, 'rgba(8,13,24,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, V.W, V.H);
    V.text(ctx, 'ВОЙНА — ЭТО', V.W / 2, 462, { size: 58, weight: 700, align: 'center', color: C.gold, track: 6, p: inv(66.1, 66.9, t), alpha: ta, stagger: .4 });
    V.text(ctx, 'ВЗАИМОСВЯЗАННАЯ', V.W / 2, 562, { size: 84, weight: 800, align: 'center', p: inv(66.3, 67.3, t), alpha: ta, stagger: .5, blurIn: 12, glow: 'rgba(0,212,255,0.5)', glowBlur: 30 });
    V.text(ctx, 'СИСТЕМА', V.W / 2, 658, { size: 84, weight: 800, align: 'center', p: inv(66.6, 67.5, t), alpha: ta, stagger: .5, blurIn: 12, glow: 'rgba(0,212,255,0.5)', glowBlur: 30 });
    ctx.restore();
  }
  // частицы от карточек к контуру Украины
  const pts = UAPTS();
  if (t > 69.6) {
    const pk = ease.io(inv(69.7, 71.2, t)), pa = 1 - smooth(inv(71.2, 71.8, t));
    if (pa > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = V.rng(3);
      for (let k = 0; k < pts.length; k++) { const ci = k % 9, P = cardPos(ci, Math.min(t, 69.7)), c = cam.p(...P); if (!c) continue; const sx = c.x + (r() - .5) * CW * c.s, sy = c.y + (r() - .5) * CH * c.s, kk = ease.io(clamp((pk - r() * .25) / .75));
        const x = lerp(sx, pts[k][0], kk), y = lerp(sy, pts[k][1], kk) - Math.sin(kk * Math.PI) * 80; ctx.fillStyle = V.rgba(k % 4 ? C.cyan : C.gold, .85 * pa); ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
      ctx.restore(); }
    // карта
    const ma = smooth(inv(70.6, 71.6, t)), dr = ease.io(inv(70.4, 71.6, t));
    if (ma > 0 || dr > 0) {
      const sc = 1 + (t - 70.4) * .008; ctx.save(); ctx.translate(960, 395); ctx.scale(sc, sc); ctx.translate(-960, -395);
      ctx.beginPath(); for (const r of V._uaRings) { r.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
      const fg = ctx.createLinearGradient(0, 130, 0, 660); fg.addColorStop(0, `rgba(0,212,255,${.16 * ma})`); fg.addColorStop(1, `rgba(0,212,255,${.04 * ma})`); ctx.fillStyle = fg; ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = `rgba(0,212,255,${.12 * ma})`; ctx.lineWidth = 1; for (let x = 500; x < 1420; x += 24) { ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x, 700); ctx.stroke(); } for (let y = 100; y < 700; y += 24) { ctx.beginPath(); ctx.moveTo(500, y); ctx.lineTo(1420, y); ctx.stroke(); } ctx.restore();
      // контур прорисовывается
      ctx.beginPath(); const P0 = V._uaRings[0], n = Math.floor(P0.length * dr); P0.slice(0, n).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = '#9FF2FF'; ctx.lineWidth = 2.6; ctx.shadowColor = C.cyan; ctx.shadowBlur = 22; ctx.stroke();
      if (dr >= 1) { ctx.beginPath(); for (const r of V._uaRings.slice(1)) { r.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); } ctx.stroke(); }
      ctx.restore();
      V.text(ctx, 'УКРАИНА', 960, 120, { size: 22, weight: 700, align: 'center', track: 12, color: 'rgba(191,243,255,0.85)', p: inv(71, 71.8, t), alpha: ma, rise: 6 });
    }
  }
  // финальный текст
  const words = [['РЕШЕНИЯ.', 71.0, 0], ['РЕСУРСЫ.', 71.45, 0], ['ЛЮДИ.', 71.9, 1], ['ПОСЛЕДСТВИЯ.', 72.35, 1]];
  const size = 82, gap = 30;
  for (const line of [0, 1]) {
    const ws = words.filter(w => w[2] === line), widths = ws.map(w => V.measure(ctx, w[0], size, 800, 2)), tot = widths.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
    let x = V.W / 2 - tot / 2; ws.forEach((w, i) => { V.text(ctx, w[0], x, line ? 912 : 812, { size, weight: 800, track: 2, p: inv(w[1], w[1] + .7, t), stagger: .35, blurIn: 12, color: i === ws.length - 1 && line ? C.gold : '#fff', glow: 'rgba(0,212,255,0.35)', glowBlur: 24 }); x += widths[i] + gap; });
  }
  V.hud(ctx, t, '09', smooth(inv(64.6, 65.4, t)) * (1 - smooth(inv(69.8, 70.6, t))));
};
})();
