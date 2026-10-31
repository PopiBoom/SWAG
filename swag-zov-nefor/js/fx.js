// Canvas particle systems. Every particle position is an analytic function of time (no accumulated state).
import { clamp, hash, el, E } from './core.js';

export const W = 1920, H = 1080;
export function layer(parent, cls = '') {
  const c = el('canvas', 'fx ' + cls, parent);
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  return g;
}
export const clear = g => g.clearRect(0, 0, W, H);

const sprites = {};
export function emojiSprite(ch, px) {
  const key = ch + '|' + px;
  if (sprites[key]) return sprites[key];
  const s = Math.ceil(px * 1.3), c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.font = `${px}px "Noto Color Emoji"`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, s / 2, s / 2 + px * 0.06);
  return (sprites[key] = c);
}
// draw emoji centred at x,y with size (picks a cached sprite bucket)
export function drawEmoji(g, ch, x, y, size, rot = 0, alpha = 1) {
  const bucket = size > 140 ? 256 : size > 70 ? 128 : 64;
  const sp = emojiSprite(ch, bucket), k = size / bucket, s = sp.width * k;
  g.save(); g.globalAlpha = alpha; g.translate(x, y); if (rot) g.rotate(rot);
  g.drawImage(sp, -s / 2, -s / 2, s, s); g.restore();
}

// explosion / burst. opts: x,y,n,speed,spread,grav,life,size,colors,shape('sq'|'dot'|'digit'|'confetti'|'emoji'),chars,seed,drag
export function burst(g, t, t0, o) {
  const lt = t - t0; if (lt < 0) return;
  const n = o.n || 120, life = o.life || 1.6, grav = o.grav ?? 900, drag = o.drag ?? 1.6;
  const cols = o.colors || ['#39ff14', '#b6ff00', '#e8ffe0'];
  for (let i = 0; i < n; i++) {
    const r = k => hash(i * 17.13 + k * 3.7 + (o.seed || 0) * 101.7);
    const lf = life * (0.5 + r(1) * 0.7); if (lt > lf) continue;
    const a = (o.dir ?? 0) + (r(2) - 0.5) * (o.spread ?? Math.PI * 2);
    const sp = (o.speed || 1400) * (0.25 + r(3) * 0.95);
    // velocity with exponential drag: x = v/d (1 - e^{-d t})
    const dd = (1 - Math.exp(-drag * lt)) / drag;
    const x = o.x + Math.cos(a) * sp * dd, y = o.y + Math.sin(a) * sp * dd + 0.5 * grav * lt * lt * (o.gravK ?? 1);
    const fade = 1 - clamp((lt - lf * 0.6) / (lf * 0.4));
    const sz = (o.size || 10) * (0.4 + r(4) * 1.1);
    g.globalAlpha = fade;
    const col = cols[Math.floor(r(5) * cols.length)];
    if (o.shape === 'emoji') { drawEmoji(g, o.chars[Math.floor(r(6) * o.chars.length)], x, y, sz, (r(7) - 0.5) * 6 * lt, fade); continue; }
    g.fillStyle = col;
    if (o.shape === 'digit') { g.font = `700 ${sz * 2}px "JetBrains Mono"`; g.fillText(r(6) > 0.5 ? '1' : '0', x, y); }
    else if (o.shape === 'confetti') {
      g.save(); g.translate(x, y); g.rotate(r(7) * 6 + lt * (r(8) * 14 - 7)); g.scale(1, Math.cos(lt * 9 + r(9) * 6));
      g.fillRect(-sz, -sz * 0.45, sz * 2, sz * 0.9); g.restore();
    } else if (o.shape === 'dot') { g.beginPath(); g.arc(x, y, sz * 0.5, 0, 6.283); g.fill(); }
    else g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  g.globalAlpha = 1;
}

// falling items (rain) from the top, looping. opts: n, speed, chars|colors, size, seed, sway, alpha
export function rain(g, t, o) {
  const n = o.n || 40;
  for (let i = 0; i < n; i++) {
    const r = k => hash(i * 9.71 + k * 5.3 + (o.seed || 0) * 77.1);
    const sp = (o.speed || 300) * (0.6 + r(1) * 0.8), span = H + 300;
    const y = ((r(2) * span + t * sp) % span) - 150, x = r(3) * W + Math.sin(t * 1.3 + r(4) * 6) * (o.sway ?? 30);
    const sz = (o.size || 40) * (0.6 + r(5) * 0.8);
    if (o.chars) drawEmoji(g, o.chars[Math.floor(r(6) * o.chars.length)], x, y, sz, Math.sin(t * 2 + r(7) * 6) * 0.5, o.alpha ?? 1);
    else { g.globalAlpha = o.alpha ?? 1; g.fillStyle = o.colors[Math.floor(r(6) * o.colors.length)]; g.fillRect(x, y, sz * 0.12, sz); g.globalAlpha = 1; }
  }
}

// 3D starfield flying toward camera; speed in units/s
export function stars(g, t, o = {}) {
  const n = o.n || 400, sp = o.speed || 1.2, cols = o.colors || ['#39ff14', '#b026ff', '#00c8ff', '#ffffff'];
  const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
  for (let i = 0; i < n; i++) {
    const r = k => hash(i * 3.17 + k * 11.3 + (o.seed || 0));
    const z = 1 - ((r(1) + t * sp * 0.25) % 1); // 1 far -> 0 near
    const z2 = Math.min(1, z + 0.02 * sp * (o.trail ?? 1));
    const px = (r(2) - 0.5) * 2600, py = (r(3) - 0.5) * 1600;
    const f = 0.08 + z * 2.2, f2 = 0.08 + z2 * 2.2;
    const x = cx + px / f, y = cy + py / f, x2 = cx + px / f2, y2 = cy + py / f2;
    if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
    g.strokeStyle = cols[i % cols.length]; g.globalAlpha = clamp((1 - z) * 1.4) * (o.alpha ?? 1);
    g.lineWidth = 1 + (1 - z) * 3.5;
    g.beginPath(); g.moveTo(x2, y2); g.lineTo(x, y); g.stroke();
  }
  g.globalAlpha = 1;
}

// soft smoke / fog blobs
export function fog(g, t, o) {
  const n = o.n || 14;
  for (let i = 0; i < n; i++) {
    const r = k => hash(i * 4.3 + k * 2.1 + (o.seed || 0) * 19);
    const x = (o.x ?? W / 2) + (r(1) - 0.5) * (o.w || W) + Math.sin(t * 0.4 + r(2) * 6) * 120 + t * (o.drift || 30) * (r(5) - 0.3);
    const y = (o.y ?? H * 0.75) + (r(3) - 0.5) * (o.h || 300) + Math.cos(t * 0.3 + r(4) * 6) * 40;
    const rad = (o.r || 340) * (0.6 + r(6) * 0.8);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, o.color || 'rgba(160,80,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = o.alpha ?? 1; g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalAlpha = 1;
}

// swarm of mini Telegram notifications orbiting a point. k = 0..1 intensity
const NOTES = ['Новое сообщение', '+99 сообщений', 'Вас упомянули', 'Голосовое (0:47)', 'Стикер', 'ответил(а) вам', 'АХАХАХА', 'кто тут?', '???', 'опять началось', 'Фото', 'закреп', 'ну и ну', '@all'];
export function noteSwarm(g, t, o) {
  const n = Math.floor((o.n || 160) * clamp(o.k ?? 1));
  g.font = '600 22px Inter';
  for (let i = 0; i < n; i++) {
    const r = k => hash(i * 7.77 + k * 1.9 + (o.seed || 0) * 3);
    const rad = (o.r || 500) * (0.25 + r(1) * 0.95), sp = (0.4 + r(2) * 1.2) * (r(3) > 0.5 ? 1 : -1) * (o.spin || 1);
    const a = r(4) * 6.283 + t * sp;
    const x = o.x + Math.cos(a) * rad * 1.6, y = o.y + Math.sin(a) * rad * 0.62 + Math.sin(t * 2 + i) * 10;
    const front = Math.sin(a) * 0.5 + 0.5, sc = 0.55 + front * 0.6;
    const label = NOTES[i % NOTES.length], w = (label.length * 11 + 70) * sc, h = 40 * sc;
    g.globalAlpha = (0.35 + front * 0.65) * clamp(o.k ?? 1);
    g.fillStyle = 'rgba(28,36,50,0.92)'; rr(g, x - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.fillStyle = i % 3 === 0 ? '#b026ff' : '#2aa7ff'; g.beginPath(); g.arc(x - w / 2 + h / 2, y, h * 0.32, 0, 6.283); g.fill();
    g.fillStyle = '#fff'; g.save(); g.translate(x - w / 2 + h * 0.95, y + 7 * sc); g.scale(sc, sc); g.fillText(label, 0, 0); g.restore();
  }
  g.globalAlpha = 1;
}
export function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// speed lines (radial or horizontal)
export function speedLines(g, t, o) {
  const n = o.n || 60;
  g.strokeStyle = o.color || 'rgba(255,255,255,0.5)';
  for (let i = 0; i < n; i++) {
    const r = k => hash(i * 2.9 + k * 7.1 + (o.seed || 0));
    g.lineWidth = 1 + r(1) * 4; g.globalAlpha = (o.alpha ?? 0.6) * r(2);
    if (o.radial) {
      const a = r(3) * 6.283, r0 = 300 + ((r(4) * 900 + t * 2600) % 900), len = 120 + r(5) * 300;
      g.beginPath(); g.moveTo(o.x + Math.cos(a) * r0, o.y + Math.sin(a) * r0); g.lineTo(o.x + Math.cos(a) * (r0 + len), o.y + Math.sin(a) * (r0 + len)); g.stroke();
    } else {
      const y = r(3) * H, len = 200 + r(4) * 700, x = W - ((r(5) * (W + len) + t * (o.speed || 4000)) % (W + len)) * (o.dir || 1);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * (o.dir || 1), y); g.stroke();
    }
  }
  g.globalAlpha = 1;
}

// fire / flame trail along a polyline of points [{x,y}] (newest last)
export function flame(g, t, pts, o = {}) {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], k = i / pts.length;
    for (let j = 0; j < 3; j++) {
      const r = q => hash(i * 5.1 + j * 1.7 + q * 9.3 + Math.floor(t * 30) * 0.13);
      const rad = (o.size || 60) * (0.3 + k * 0.9) * (0.6 + r(1) * 0.6);
      const x = p.x + (r(2) - 0.5) * 30, y = p.y + (r(3) - 0.5) * 30 - (1 - k) * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,240,180,${0.5 * k})`); gr.addColorStop(0.35, `rgba(255,130,20,${0.4 * k})`); gr.addColorStop(1, 'rgba(255,40,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  g.globalCompositeOperation = 'source-over';
}

// fireball explosion at x,y (lt seconds since start)
export function boom(g, lt, x, y, size = 500, seed = 0) {
  if (lt < 0 || lt > 2.2) return;
  g.globalCompositeOperation = 'lighter';
  const k = E.outCubic(clamp(lt / 0.9)), fade = 1 - clamp((lt - 0.4) / 1.8);
  for (let i = 0; i < 26; i++) {
    const r = q => hash(i * 3.3 + q * 7.7 + seed * 13);
    const a = r(1) * 6.283, d = size * 0.55 * k * (0.2 + r(2) * 0.9);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.75 - lt * 80 * r(3);
    const rad = size * (0.25 + r(4) * 0.35) * (0.4 + k * 0.8);
    const gr = g.createRadialGradient(px, py, 0, px, py, rad);
    gr.addColorStop(0, `rgba(255,250,210,${0.55 * fade})`); gr.addColorStop(0.3, `rgba(255,150,30,${0.45 * fade})`);
    gr.addColorStop(0.7, `rgba(200,30,0,${0.2 * fade})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  // smoke
  for (let i = 0; i < 12; i++) {
    const r = q => hash(i * 8.1 + q * 2.3 + seed * 5);
    const a = r(1) * 6.283, d = size * 0.6 * E.outCubic(clamp(lt / 1.6)) * (0.4 + r(2));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.6 - lt * 120;
    const rad = size * 0.4 * (0.5 + lt);
    const gr = g.createRadialGradient(px, py, 0, px, py, rad);
    gr.addColorStop(0, `rgba(30,25,35,${0.45 * clamp(lt * 2) * fade})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
}

// 0/1 digital rain columns
export function matrix(g, t, o = {}) {
  const cols = o.cols || 64, colW = W / cols;
  g.font = `700 ${o.size || 22}px "JetBrains Mono"`;
  for (let c = 0; c < cols; c++) {
    const r = k => hash(c * 13.1 + k * 3.3 + (o.seed || 0));
    const sp = 200 + r(1) * 500, len = 8 + Math.floor(r(2) * 18), head = ((r(3) * (H + 600) + t * sp) % (H + 600)) - 300;
    for (let j = 0; j < len; j++) {
      const y = head - j * (o.size || 22) * 1.1; if (y < -30 || y > H + 30) continue;
      g.globalAlpha = (1 - j / len) * (o.alpha ?? 0.5);
      g.fillStyle = j === 0 ? '#e8ffe0' : '#39ff14';
      g.fillText(hash(c * 7 + j * 3 + Math.floor(t * 10 + r(4) * 10)) > 0.5 ? '1' : '0', c * colW, y);
    }
  }
  g.globalAlpha = 1;
}
