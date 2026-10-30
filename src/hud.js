import { hash, clamp } from './util.js';

export const C = {
  black: '#050505', green: '#39FF14', red: '#FF0033', white: '#FFFFFF', gray: '#1A1A1A',
  dimGreen: '#1f8a0c', ghost: '#8a8a8a',
};

// Слой типографики поверх 3D (Canvas2D → текстура → пост-обработка: глитч/CA применяются ко всему кадру)
export class HUD {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
  }
  clear() { const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.clearRect(0, 0, this.w, this.h); }

  // текст с трекингом, свечением, CA-расслоением и срезовым глитчем
  text(str, x, y, o = {}) {
    const c = this.ctx;
    const size = o.size || 48;
    c.save();
    c.font = `${o.weight || ''} ${size}px ${o.font || 'Mono'}`;
    c.textAlign = o.align || 'left';
    c.textBaseline = o.baseline || 'alphabetic';
    c.letterSpacing = `${o.track || 0}px`;
    const alpha = o.alpha ?? 1;
    if (alpha <= 0.001) { c.restore(); return; }
    c.translate(x, y);
    if (o.scale) c.scale(o.scale, o.scaleY ?? o.scale);
    if (o.skew) c.transform(1, 0, o.skew, 1, 0, 0);
    const color = o.color || C.white;
    const split = o.split || 0;
    if (split > 0) {
      c.globalAlpha = alpha * 0.85;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = '#ff0033'; c.fillText(str, -split, 0);
      c.fillStyle = '#00e5ff'; c.fillText(str, split, 0);
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = alpha;
    if (o.slices && o.slices.amt > 0) {
      // горизонтальные срезы со смещением
      const n = o.slices.n || 9, seed = o.slices.seed || 0, amt = o.slices.amt;
      const m = c.measureText(str);
      const top = -size * 1.0, hh = size * 1.3;
      const wdt = m.width + 40;
      const x0 = c.textAlign === 'center' ? -wdt / 2 : c.textAlign === 'right' ? -wdt : -20;
      for (let i = 0; i < n; i++) {
        const y0 = top + (hh * i) / n, y1 = top + (hh * (i + 1)) / n;
        const dx = (hash(i * 9.1 + seed) - 0.5) * 2 * amt * (hash(i + seed * 2.3) > 0.45 ? 1 : 0.1);
        c.save(); c.beginPath(); c.rect(x0 - 400, y0, wdt + 800, y1 - y0); c.clip();
        c.fillStyle = color; c.fillText(str, dx, 0); c.restore();
      }
    } else {
      c.fillStyle = color; c.fillText(str, 0, 0);
    }
    if (o.stroke) { c.shadowBlur = 0; c.lineWidth = o.stroke; c.strokeStyle = o.strokeColor || color; c.strokeText(str, 0, 0); }
    c.restore();
  }
  measure(str, o = {}) {
    const c = this.ctx; c.save();
    c.font = `${o.weight || ''} ${o.size || 48}px ${o.font || 'Mono'}`; c.letterSpacing = `${o.track || 0}px`;
    const w = c.measureText(str).width; c.restore(); return w;
  }
  rect(x, y, w, h, color, alpha = 1) { const c = this.ctx; c.save(); c.globalAlpha = alpha; c.fillStyle = color; c.fillRect(x, y, w, h); c.restore(); }
  frame(x, y, w, h, color, lw = 2, alpha = 1) { const c = this.ctx; c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = lw; c.strokeRect(x, y, w, h); c.restore(); }
  // уголки-рамка «прицела»
  corners(x, y, w, h, len, color, lw = 2, alpha = 1) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = lw; c.beginPath();
    for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      c.moveTo(px, py + sy * len); c.lineTo(px, py); c.lineTo(px + sx * len, py);
    }
    c.stroke(); c.restore();
  }
  // плашка-индикатор: мигающая точка + подпись
  tag(str, x, y, color, t, alpha = 1, size = 18) {
    const on = Math.floor(t * 3) % 2 === 0;
    this.rect(x, y - size * 0.7, size * 0.6, size * 0.6, color, alpha * (on ? 1 : 0.25));
    this.text(str, x + size, y, { font: 'MonoB', size, color, alpha, track: 3 });
  }
}

// процедурная глитч-маска вместо аватарки: симметричное пиксельное «лицо» + искажения
export function drawMask(ctx, x, y, s, seed, o = {}) {
  const g = 8, cell = s / g;
  const col = o.color || C.green;
  ctx.save();
  ctx.translate(x - s / 2, y - s / 2);
  ctx.fillStyle = o.bg || '#0b0b0b';
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
  ctx.clip();
  const type = Math.floor(hash(seed * 1.3) * 4);
  for (let j = 0; j < g; j++) for (let i = 0; i < g / 2; i++) {
    let on = hash(seed * 31 + i * 7 + j * 13) > 0.52;
    // глаза и рот как опорные черты
    if (j === 3 && i === 1) on = type !== 2;
    if (j === 3 && i === 2) on = false;
    if (j === 5 && (type === 1 || type === 3)) on = i > 0;
    if (j === 0 || j === g - 1) on = on && hash(seed + i) > 0.7;
    if (!on) continue;
    const red = hash(seed * 17 + i * 3 + j) > 0.86;
    ctx.fillStyle = red ? C.red : col;
    ctx.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
    ctx.fillRect((g - 1 - i) * cell, j * cell, cell + 0.5, cell + 0.5);
  }
  if (type === 2) { // «ERR» вместо глаз
    ctx.fillStyle = C.red; ctx.font = `${s * 0.28}px MonoB`; ctx.textAlign = 'center'; ctx.fillText('ERR', s / 2, s * 0.55);
  }
  // горизонтальные сдвиги-полосы
  const sh = o.shift || 0;
  if (sh > 0) {
    for (let k = 0; k < 3; k++) {
      const yy = hash(seed * 5 + k + Math.floor(sh * 10)) * s;
      const dd = (hash(seed + k * 3.3) - 0.5) * s * 0.4 * sh;
      ctx.drawImage(ctx.canvas, x - s / 2, y - s / 2 + yy, s, s * 0.08, dd, yy, s, s * 0.08);
    }
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = o.ring || col; ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

export const fitAlpha = (a) => clamp(a, 0, 1);
