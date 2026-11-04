// Ядро: математика, детерминированный шум, 3D-камера, типографика, геоданные, пост-обработка.
'use strict';
const V = window.V = {};
V.W = 1920; V.H = 1080; V.FPS = 30; V.DUR = 75;
V.C = { bg: '#080D18', cyan: '#00D4FF', red: '#FF453A', white: '#FFFFFF', gold: '#FFD166' };
V.FONT = 'Montserrat';

// ---------- математика ----------
const clamp = V.clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = V.lerp = (a, b, t) => a + (b - a) * t;
const inv = V.inv = (a, b, x) => clamp((x - a) / (b - a));
const smooth = V.smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const ease = V.ease = {
  io: t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  io5: t => { t = clamp(t); return t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2; },
  out: t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); },
  outExpo: t => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  in: t => { t = clamp(t); return t * t * t; },
  outBack: t => { t = clamp(t); const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};
// окно видимости: плавный вход a→a+fi, выход b-fo→b
V.win = (t, a, b, fi = .5, fo = .5) => Math.min(smooth(inv(a, a + fi, t)), 1 - smooth(inv(b - fo, b, t)));

// ---------- seeded random ----------
V.rng = seed => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const hash2 = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
V.hash2 = hash2;
V.noise = (x, y, s = 0) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
};
V.fbm = (x, y, s = 0, o = 5) => { let f = 0, a = .5, k = 1; for (let i = 0; i < o; i++) { f += a * V.noise(x * k, y * k, s + i * 17); k *= 2.03; a *= .5; } return f; };

// ---------- 3D камера ----------
// мир: y вверх, x восток, z юг. Камера: eye, target, roll (рад), fov (град по вертикали).
V.camera = (eye, target, fov = 45, roll = 0) => {
  let fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = f × up(0,1,0)
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  let ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  if (roll) { const c = Math.cos(roll), s = Math.sin(roll);
    const nrx = rx * c + ux * s, nry = ry * c + uy * s, nrz = rz * c + uz * s;
    const nux = ux * c - rx * s, nuy = uy * c - ry * s, nuz = uz * c - rz * s;
    rx = nrx; ry = nry; rz = nrz; ux = nux; uy = nuy; uz = nuz; }
  const f = (V.H / 2) / Math.tan(fov * Math.PI / 360);
  const cam = { eye, target, f, fwd: [fx, fy, fz], right: [rx, ry, rz], up: [ux, uy, uz] };
  cam.p = (x, y, z) => {
    const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
    const zc = dx * fx + dy * fy + dz * fz;
    const xc = dx * rx + dy * ry + dz * rz, yc = dx * ux + dy * uy + dz * uz;
    if (zc < 0.05) return null;
    const s = f / zc;
    return { x: V.W / 2 + xc * s, y: V.H / 2 - yc * s, z: zc, s };
  };
  return cam;
};
V.orbit = (target, dist, az, el) => [target[0] + dist * Math.cos(el) * Math.sin(az), target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(el) * Math.cos(az)];
V.mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// сплайн Катмулла-Рома по ключам камеры: непрерывная скорость на стыках
V.spline = (pts, t) => {
  const n = pts.length - 1, x = clamp(t) * n, i = Math.min(n - 1, Math.floor(x)), u = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u));
};

// ключи по времени [[t, v], ...] с плавным переходом между ними
V.keys = (t, ks) => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 0; i < ks.length - 1; i++) if (t < ks[i + 1][0]) return lerp(ks[i][1], ks[i + 1][1], ease.io(inv(ks[i][0], ks[i + 1][0], t))); return ks[ks.length - 1][1]; };

// ---------- типографика ----------
V.font = (size, w = 800) => `${w} ${size}px ${V.FONT}`;
V.rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
// Покадровый вывод строки с появлением по буквам: fade + slide + лёгкий масштаб + проявление из размытия.
V.text = (ctx, str, x, y, o = {}) => {
  const size = o.size || 72, w = o.weight || 800, color = o.color || '#fff', p = o.p === undefined ? 1 : o.p;
  const track = o.track || 0, align = o.align || 'left', stagger = o.stagger === undefined ? .5 : o.stagger, alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0.002) return 0;
  ctx.save();
  ctx.font = V.font(size, w); ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '0px';
  const chars = [...str]; const widths = chars.map(c => ctx.measureText(c).width + track);
  const total = widths.reduce((a, b) => a + b, 0) - track;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const n = chars.length, baseA = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const local = stagger > 0 ? clamp((p * (1 + stagger) - (i / Math.max(1, n - 1)) * stagger)) : p;
    const e = ease.out(local);
    if (e > 0.001 && chars[i] !== ' ') {
      ctx.globalAlpha = baseA * alpha * e;
      const dy = (1 - e) * (o.rise === undefined ? size * .45 : o.rise);
      const sc = lerp(o.fromScale || 1.08, 1, e);
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 24; } else ctx.shadowBlur = 0;
      if (o.blurIn && e < .98) ctx.filter = `blur(${((1 - e) * o.blurIn).toFixed(2)}px)`; else ctx.filter = 'none';
      ctx.fillStyle = color;
      ctx.save(); ctx.translate(cx + widths[i] / 2, y + dy); ctx.scale(sc, sc);
      ctx.fillText(chars[i], -widths[i] / 2 + track / 2, 0);
      ctx.restore();
    }
    cx += widths[i];
  }
  ctx.restore();
  return total;
};
V.measure = (ctx, str, size, w = 800, track = 0) => { ctx.save(); ctx.font = V.font(size, w); let s = 0; for (const c of str) s += ctx.measureText(c).width + track; ctx.restore(); return s - track; };

// Заголовок сцены: индекс, акцентная линия, крупная строка (одна или две), подпись. Положение — нижний левый угол.
V.sceneTitle = (ctx, t, t0, idx, lines, o = {}) => {
  const out = o.out || t0 + 6.8, a = V.win(t, t0, out, .9, .6);
  if (a <= 0) return;
  const x = o.x || 120, size = o.size || 76;
  let y = o.y || (980 - (lines.length - 1) * size * 1.08);
  const p = inv(t0, t0 + 1.1, t);
  ctx.save();
  // подложка-градиент для читаемости
  const g = ctx.createLinearGradient(0, y - size * 2.2, 0, V.H);
  g.addColorStop(0, 'rgba(8,13,24,0)'); g.addColorStop(1, `rgba(8,13,24,${.75 * a})`);
  ctx.fillStyle = g; ctx.fillRect(0, y - size * 2.2, V.W, V.H);
  const ky = y - size - 26;
  ctx.globalAlpha = a;
  const lw = ease.io(inv(t0, t0 + .7, t)) * 64;
  ctx.fillStyle = o.accent || V.C.cyan; ctx.fillRect(x, ky - 8, lw, 3);
  V.text(ctx, idx, x + 84, ky, { size: 22, weight: 600, color: o.accent || V.C.cyan, track: 6, p: inv(t0 + .1, t0 + .8, t), stagger: .3, rise: 8 });
  lines.forEach((ln, i) => V.text(ctx, ln, x, y + i * size * 1.08, { size, weight: 800, color: '#fff', p: inv(t0 + .15 + i * .18, t0 + 1.25 + i * .18, t), stagger: .55, blurIn: 10, glow: 'rgba(0,212,255,0.25)', glowBlur: 18 }));
  if (o.sub) V.text(ctx, o.sub, x, y + (lines.length - 1) * size * 1.08 + 54, { size: 30, weight: 500, color: 'rgba(255,255,255,0.78)', p: inv(t0 + .6, t0 + 1.6, t), stagger: .3, rise: 10 });
  ctx.restore();
  void p;
};

// Чип-тег с иконкой (синхронно с голосом)
V.chip = (ctx, t, t0, x, y, label, color = V.C.gold, icon) => {
  const a = smooth(inv(t0, t0 + .35, t)); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const w = V.measure(ctx, label, 26, 700, 3) + (icon ? 74 : 44), h = 54;
  const dx = (1 - ease.out(inv(t0, t0 + .45, t))) * 40;
  ctx.translate(x + dx, y);
  ctx.fillStyle = 'rgba(8,13,24,0.72)'; ctx.strokeStyle = V.rgba(color, .9); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w - 12, 0); ctx.lineTo(w, 12); ctx.lineTo(w, h); ctx.lineTo(12, h); ctx.lineTo(0, h - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  // вспышка на появлении
  const fl = 1 - inv(t0, t0 + .5, t); if (fl > 0) { ctx.fillStyle = V.rgba(color, .35 * fl); ctx.fill(); }
  if (icon) { ctx.save(); ctx.translate(32, h / 2); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2; icon(ctx); ctx.restore(); }
  V.text(ctx, label, icon ? 60 : 22, 37, { size: 26, weight: 700, color: '#fff', track: 3, p: 1 });
  ctx.restore();
};

// ---------- геоданные (topojson без зависимостей) ----------
V.decodeTopo = (topo, objName, filter) => {
  const tr = topo.transform, arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return tr ? [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]] : [dx, dy]; }); });
  const ring = idx => { const pts = []; for (const i of idx) { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]); } return pts; };
  const res = [];
  for (const g of topo.objects[objName].geometries) {
    if (filter && !filter(g)) continue;
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    res.push({ id: g.id, name: g.properties && g.properties.name, rings: polys.flatMap(p => p.map(ring)) });
  }
  return res;
};
// плоская проекция карты: 1 единица ≈ 1 градус широты, центр — Украина
V.geo = (lon, lat) => [(lon - 32) * 0.66, -(lat - 49)];

// ---------- пост-обработка ----------
V.grainTiles = [];
V.initGrain = () => {
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const id = g.createImageData(256, 256), r = V.rng(900 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); V.grainTiles.push(c);
  }
};
V.post = (ctx, t, o = {}) => {
  // виньетка
  const vg = ctx.createRadialGradient(V.W / 2, V.H / 2, V.H * .35, V.W / 2, V.H / 2, V.H * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${o.vig || .55})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, V.W, V.H);
  // зерно (детерминировано по номеру кадра)
  const fi = Math.round(t * V.FPS), tile = V.grainTiles[fi % V.grainTiles.length];
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = o.grain || .07;
  const ox = (fi * 73) % 256, oy = (fi * 151) % 256;
  ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, V.W + 256, V.H + 256);
  ctx.restore();
};

// HUD-рамка (цифровые сцены)
V.hud = (ctx, t, idx, a = 1) => {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a * .8; ctx.strokeStyle = V.rgba(V.C.cyan, .55); ctx.lineWidth = 1.5;
  const m = 46, L = 36;
  [[m, m, 1, 1], [V.W - m, m, -1, 1], [m, V.H - m, 1, -1], [V.W - m, V.H - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke(); });
  ctx.font = V.font(15, 600); ctx.fillStyle = V.rgba(V.C.cyan, .7); ctx.letterSpacing = '3px';
  const s = t.toFixed(1).padStart(4, '0');
  ctx.textAlign = 'right'; ctx.fillText(`T+${s}  ·  ${idx}/09`, V.W - m - 4, m + 30);
  ctx.textAlign = 'left'; ctx.fillText('СИСТЕМНЫЙ АНАЛИЗ  ·  УСЛОВНАЯ СХЕМА', m + 4, m + 30);
  ctx.letterSpacing = '0px';
  ctx.restore();
};

// Цифровой glitch-переход: горизонтальные полосы со сдвигом и RGB-расщепление
V.glitch = (ctx, src, amt, seed) => {
  if (amt <= 0.01) return;
  const r = V.rng(seed), n = 14;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const y = Math.floor(r() * V.H), h = Math.floor(6 + r() * 70 * amt), dx = (r() - .5) * 160 * amt;
    ctx.drawImage(src, 0, y, V.W, h, dx, y, V.W, h);
  }
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 * amt;
  ctx.filter = 'none';
  ctx.drawImage(src, 10 * amt, 0); ctx.drawImage(src, -10 * amt, 0);
  ctx.restore();
};
