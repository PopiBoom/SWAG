// 2D typography / UI toolkit (drawn on the UI layer in 1080×1920 design units).
import { makeCanvas, clamp, lerp, rng, hash, roundRect, eOutCubic, eOutExpo, eOutBack, inv } from './core.js';

export const F = {
  head: '"Unbounded", "Noto Color Emoji", sans-serif',
  dela: '"Dela Gothic One", "Unbounded", sans-serif',
  mono: '"JetBrains Mono", "Noto Color Emoji", monospace',
  pixel: '"Press Start 2P", "JetBrains Mono", monospace',
  glitch: '"Rubik Glitch", "Unbounded", sans-serif',
  ui: '"Roboto", "Noto Sans KR", "Noto Color Emoji", sans-serif',
  russo: '"Russo One", "Unbounded", sans-serif',
  oswald: '"Oswald", "Roboto", sans-serif',
};
export const C = {
  black: '#030305', red: '#ff1f3d', blood: '#b3001b', green: '#39ff88', toxic: '#7dff2f', silver: '#cfd6e2',
  purple: '#7a2cff', violet: '#3b1166', blue: '#2f7dff', ice: '#9fd8ff', white: '#f4f6fb',
};

const cache = new Map();
// cached text sprite: returns {c, w, h, ax, ay} where (ax, ay) is the anchor (centre of text box)
export function sprite(spec) {
  const key = JSON.stringify(spec);
  if (cache.has(key)) return cache.get(key);
  const { text, size = 80, family = F.head, weight = 800, color = '#fff', glow = 0, glowColor = color, ls = 0,
    stroke = 0, strokeColor = '#000', metal = false, damage = 0, seed = 1, lines = null, lh = 1.08, align = 'center', italic = false } = spec;
  const L = lines || [text];
  if (spec.maxW) { // shrink to fit
    const mm = makeCanvas(8, 8).getContext('2d'); mm.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`; mm.letterSpacing = ls + 'px';
    const tw0 = Math.max(...(lines || [text]).map(s => mm.measureText(s).width));
    const { maxW, ...rest } = spec;
    return sprite({ ...rest, size: tw0 > maxW ? Math.floor(size * maxW / tw0) : size });
  }
  const m = makeCanvas(8, 8).getContext('2d');
  const font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
  m.font = font; m.letterSpacing = ls + 'px';
  const widths = L.map(s => m.measureText(s).width);
  const tw = Math.max(...widths), th = size * lh * L.length;
  const pad = Math.ceil(glow * 2.2 + stroke + size * 0.25);
  const c = makeCanvas(Math.ceil(tw + pad * 2), Math.ceil(th + pad * 2)), x = c.getContext('2d');
  x.font = font; x.letterSpacing = ls + 'px'; x.textBaseline = 'middle'; x.textAlign = align;
  const ax = align === 'center' ? c.width / 2 : align === 'left' ? pad : c.width - pad;
  const lineY = i => pad + size * lh * (i + 0.5);
  const drawAll = (fn) => L.forEach((s, i) => fn(s, ax, lineY(i)));
  if (metal) {
    // bevel shadow / highlight
    x.fillStyle = 'rgba(0,0,0,.85)'; drawAll((s, X, Y) => x.fillText(s, X + size * .02, Y + size * .035));
    if (glow) { x.shadowColor = glowColor; x.shadowBlur = glow; x.fillStyle = glowColor; drawAll((s, X, Y) => x.fillText(s, X, Y)); x.shadowBlur = 0; }
    const g = x.createLinearGradient(0, pad, 0, pad + th);
    const bands = metal === 'red' ? ['#ffd9dd', '#ff7a8a', '#7a0614', '#1c0004', '#ff4d63', '#ffc2c9', '#6b0010'] :
      ['#ffffff', '#c9d1de', '#6d7787', '#14171d', '#aab4c4', '#f2f5fa', '#4d5563'];
    const per = 1 / L.length;
    L.forEach((_, i) => {
      const o = i * per; const st = [0, .32, .47, .52, .62, .8, 1];
      st.forEach((s, k) => g.addColorStop(clamp(o + s * per), bands[k]));
    });
    x.fillStyle = g; drawAll((s, X, Y) => x.fillText(s, X, Y));
    // inner rim light
    x.lineWidth = Math.max(1, size * .012); x.strokeStyle = 'rgba(255,255,255,.55)';
    drawAll((s, X, Y) => x.strokeText(s, X, Y - size * .01));
    x.lineWidth = Math.max(1, size * .008); x.strokeStyle = 'rgba(0,0,0,.6)';
    drawAll((s, X, Y) => x.strokeText(s, X, Y + size * .012));
    // scratches + speckle, clipped to glyphs
    const r = rng(seed);
    x.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 160; i++) {
      const sx = r() * c.width, sy = pad + r() * th, len = 10 + r() * size * .6, a = (r() - .5) * .5;
      x.strokeStyle = r() < .5 ? `rgba(0,0,0,${.15 + r() * .35})` : `rgba(255,255,255,${.1 + r() * .3})`;
      x.lineWidth = .6 + r() * 1.4; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len); x.stroke();
    }
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${r() * .25})`; x.fillRect(r() * c.width, pad + r() * th, 1.5, 1.5); }
    x.globalCompositeOperation = 'source-over';
  } else {
    if (glow) { x.shadowColor = glowColor; x.shadowBlur = glow; }
    if (stroke) { x.lineWidth = stroke; x.strokeStyle = strokeColor; x.lineJoin = 'round'; drawAll((s, X, Y) => x.strokeText(s, X, Y)); }
    x.fillStyle = color; drawAll((s, X, Y) => x.fillText(s, X, Y));
    if (glow) { x.shadowBlur = glow * .4; drawAll((s, X, Y) => x.fillText(s, X, Y)); x.shadowBlur = 0; }
  }
  if (damage) { // digital damage: erased chips + displaced slices
    const r = rng(seed * 7 + 3);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26 * damage; i++) x.fillRect(r() * c.width, pad + r() * th, 4 + r() * size * .25, 2 + r() * size * .05);
    x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 6 * damage; i++) {
      const sy = pad + r() * th, sh = 3 + r() * size * .08, dx = (r() - .5) * size * .18;
      const d = x.getImageData(0, sy | 0, c.width, Math.max(1, sh | 0)); x.clearRect(0, sy | 0, c.width, sh | 0); x.putImageData(d, dx | 0, sy | 0);
    }
  }
  const out = { c, w: c.width, h: c.height, tw, th, pad };
  cache.set(key, out);
  return out;
}

// draw a sprite centred at (x, y)
export function put(ctx, s, x, y, o = {}) {
  const { alpha = 1, scale = 1, sx = 1, sy = 1, rot = 0, blend = null, ox = 0, oy = 0 } = o;
  if (alpha <= 0.002) return;
  ctx.save(); ctx.globalAlpha = clamp(alpha);
  if (blend) ctx.globalCompositeOperation = blend;
  ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(scale * sx, scale * sy);
  ctx.drawImage(s.c, -s.w / 2 + ox, -s.h / 2 + oy);
  ctx.restore();
}

// horizontal-slice glitch with RGB ghosting
export function putGlitch(ctx, s, x, y, amt, seed, o = {}) {
  const { alpha = 1, scale = 1, rgb = true } = o;
  if (amt <= 0.001) return put(ctx, s, x, y, o);
  const r = rng((seed * 9973) | 0);
  ctx.save(); ctx.globalAlpha = clamp(alpha); ctx.translate(x, y); ctx.scale(scale, scale);
  const n = 7 + Math.floor(r() * 7);
  let yy = 0; const cuts = [0];
  for (let i = 0; i < n; i++) cuts.push(r()); cuts.push(1); cuts.sort();
  for (let i = 0; i < cuts.length - 1; i++) {
    const y0 = cuts[i] * s.h, hh = (cuts[i + 1] - cuts[i]) * s.h; if (hh < 1) continue;
    const dx = (r() < .45 ? (r() - .5) * 2 : 0) * amt * s.w * .12;
    ctx.drawImage(s.c, 0, y0, s.w, hh, -s.w / 2 + dx, -s.h / 2 + y0, s.w, hh);
  }
  if (rgb) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(alpha) * .55 * clamp(amt * 2);
    const d = amt * 14;
    tinted(ctx, s, '#ff0040', -s.w / 2 - d, -s.h / 2); tinted(ctx, s, '#00e1ff', -s.w / 2 + d, -s.h / 2);
  }
  ctx.restore();
}
const tintCache = new WeakMap();
function tinted(ctx, s, col, x, y) {
  let m = tintCache.get(s); if (!m) { m = {}; tintCache.set(s, m); }
  if (!m[col]) { const c = makeCanvas(s.w, s.h), g = c.getContext('2d'); g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, s.w, s.h); m[col] = c; }
  ctx.drawImage(m[col], x, y);
}

// "decode" text: characters scramble then lock into place
const GLYPHS = '█▓▒░#@$%&01ЖЯФЩ<>/\\|=+*';
export function decoded(text, p, seed = 1, frame = 0) {
  const n = [...text].length; let out = '';
  [...text].forEach((ch, i) => {
    const lock = (i / n) * 0.7 + 0.25;
    if (ch === ' ' || p >= lock) out += ch;
    else if (p > lock - 0.4) out += GLYPHS[Math.floor(hash(i * 13 + Math.floor(frame / 2) * 7 + seed) * GLYPHS.length)];
    else out += ' ';
  });
  return out;
}

// per-letter staggered reveal of a single line, centred at (x, y)
export function letters(ctx, text, x, y, spec, p, o = {}) {
  const { stagger = 0.6, rise = 60, blurIn = false, scaleIn = 1, alpha = 1, color } = o;
  const chars = [...text];
  const sp = chars.map(ch => sprite({ ...spec, text: ch, ...(color ? { color } : {}) }));
  const m = makeCanvas(4, 4).getContext('2d'); m.font = `${spec.weight ?? 800} ${spec.size ?? 80}px ${spec.family ?? F.head}`; m.letterSpacing = (spec.ls ?? 0) + 'px';
  const adv = chars.map(ch => m.measureText(ch).width + (spec.ls ?? 0));
  const total = adv.reduce((a, b) => a + b, 0) - (spec.ls ?? 0);
  let cx = x - total / 2;
  chars.forEach((ch, i) => {
    const lp = clamp((p * (1 + stagger) - (i / chars.length) * stagger));
    const e = eOutCubic(lp);
    if (ch !== ' ') put(ctx, sp[i], cx + adv[i] / 2 - (spec.ls ?? 0) / 2, y + (1 - e) * rise, { alpha: alpha * clamp(lp * 2.5), scale: lerp(scaleIn, 1, e) });
    cx += adv[i];
  });
}

// jagged electric arc between two points (deterministic per seed)
export function arc(ctx, x1, y1, x2, y2, seed, o = {}) {
  const { color = '#bff', width = 2.5, glow = 18, jag = 0.18, branches = 2, alpha = 1 } = o;
  const r = rng(seed | 0);
  const pts = [[x1, y1]]; const n = 12; const len = Math.hypot(x2 - x1, y2 - y1); const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  for (let i = 1; i < n; i++) { const t = i / n; const off = (r() - .5) * len * jag * Math.sin(Math.PI * t) * 2; pts.push([lerp(x1, x2, t) + nx * off, lerp(y1, y2, t) + ny * off]); }
  pts.push([x2, y2]);
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'miter';
  const stroke = (P, w) => { ctx.beginPath(); P.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.lineWidth = w; ctx.stroke(); };
  ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = glow; stroke(pts, width * 2);
  ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; stroke(pts, width * .6);
  for (let b = 0; b < branches; b++) {
    const k = 2 + Math.floor(r() * (n - 4)); const [bx, by] = pts[k]; const P = [[bx, by]];
    let cx = bx, cy = by; const ang = Math.atan2(y2 - y1, x2 - x1) + (r() - .5) * 2.2;
    for (let j = 0; j < 4; j++) { cx += Math.cos(ang + (r() - .5)) * len * .07; cy += Math.sin(ang + (r() - .5)) * len * .07; P.push([cx, cy]); }
    ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = glow * .6; stroke(P, width * .9);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Y2K system window
export function sysWindow(ctx, x, y, w, h, title, msg, o = {}) {
  const { scale = 1, alpha = 1, theme = 'gray', icon = 'x', msgColor = '#0b0b0f', msgFont = F.oswald, msgSize = 44, btn = 'OK' } = o;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2);
  const dark = theme === 'black';
  // drop shadow
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 12, w, h);
  // outer bevel
  ctx.fillStyle = dark ? '#0a0a0c' : '#c3c6cc'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = dark ? '#3a0a12' : '#ffffff'; ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, 0, 3, h);
  ctx.fillStyle = dark ? '#000' : '#5b5e66'; ctx.fillRect(0, h - 3, w, 3); ctx.fillRect(w - 3, 0, 3, h);
  // title bar
  const tb = 52;
  const g = ctx.createLinearGradient(6, 0, w - 6, 0);
  if (dark) { g.addColorStop(0, '#5a0010'); g.addColorStop(1, '#120004'); } else { g.addColorStop(0, '#0d1a6e'); g.addColorStop(1, '#3b8ad6'); }
  ctx.fillStyle = g; ctx.fillRect(6, 6, w - 12, tb);
  ctx.fillStyle = dark ? '#ff4d63' : '#fff'; ctx.font = `700 28px ${F.mono}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(title, 20, 6 + tb / 2 + 1);
  // close box
  ctx.fillStyle = dark ? '#1b0b0e' : '#c3c6cc'; ctx.fillRect(w - 52, 13, 38, 36);
  ctx.strokeStyle = dark ? '#ff4d63' : '#111'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w - 43, 22); ctx.lineTo(w - 23, 40); ctx.moveTo(w - 23, 22); ctx.lineTo(w - 43, 40); ctx.stroke();
  // icon
  const iy = tb + 6 + (h - tb - 6 - 90) / 2;
  if (icon === 'x') {
    ctx.fillStyle = '#d40d1d'; ctx.beginPath(); ctx.arc(70, iy, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(56, iy - 14); ctx.lineTo(84, iy + 14); ctx.moveTo(84, iy - 14); ctx.lineTo(56, iy + 14); ctx.stroke();
  } else if (icon === 'warn') {
    ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(70, iy - 36); ctx.lineTo(108, iy + 30); ctx.lineTo(32, iy + 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = `900 46px ${F.oswald}`; ctx.textAlign = 'center'; ctx.fillText('!', 70, iy + 8);
  }
  // message
  ctx.fillStyle = msgColor; ctx.font = `700 ${msgSize}px ${msgFont}`; ctx.textAlign = icon ? 'left' : 'center';
  ctx.fillText(msg, icon ? 128 : w / 2, iy);
  // button
  if (btn) {
    const bw = 150, bh = 52, bx = w / 2 - bw / 2, by = h - bh - 22;
    ctx.fillStyle = dark ? '#16070a' : '#c3c6cc'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = dark ? '#ff4d63' : '#fff'; ctx.fillRect(bx, by, bw, 3); ctx.fillRect(bx, by, 3, bh);
    ctx.fillStyle = dark ? '#000' : '#5b5e66'; ctx.fillRect(bx, by + bh - 3, bw, 3); ctx.fillRect(bx + bw - 3, by, 3, bh);
    ctx.fillStyle = dark ? '#ff4d63' : '#111'; ctx.font = `700 28px ${F.mono}`; ctx.textAlign = 'center'; ctx.fillText(btn, w / 2, by + bh / 2 + 1);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Telegram-like group UI (dark theme, stylised)
// Message contents are deliberately redacted: no words are put into real members' mouths.
export function drawTelegram(ctx, w, h, atlas, o = {}) {
  const { t = 0, accent = '#39ff88', title = 'SWAG_ZOV_NEFOR.exe', sub = '62 участника, 21 в сети', join = false, joinState = 0, msgs = 7, scroll = 0, dimAvatars = 0, holoMask = null } = o;
  const s = w / 1080;
  ctx.save(); ctx.scale(s, s); const H = h / s;
  // wallpaper
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1016'); bg.addColorStop(1, '#06090d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, H);
  // subtle pattern
  ctx.globalAlpha = .06; ctx.fillStyle = accent;
  for (let j = 0; j < 30; j++) for (let i = 0; i < 12; i++) { if (hash(i * 31 + j * 7) < .35) ctx.fillText(['☠', '✦', '⌁', '#', '0', '1'][(i + j) % 6], 40 + i * 90 + (j % 2) * 45, 260 + j * 70); }
  ctx.globalAlpha = 1;
  // header
  ctx.fillStyle = '#121a23'; ctx.fillRect(0, 0, 1080, 210);
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 209, 1080, 2);
  ctx.strokeStyle = '#8fa3b8'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(78, 88); ctx.lineTo(48, 118); ctx.lineTo(78, 148); ctx.stroke();
  if (atlas) { ctx.save(); ctx.beginPath(); ctx.arc(175, 118, 58, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(atlas.canvas, 7 * atlas.S, 7 * atlas.S, atlas.S, atlas.S, 117, 60, 116, 116); ctx.restore(); }
  ctx.fillStyle = '#f2f6fa'; ctx.font = `700 50px ${F.ui}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(title, 262, 96);
  ctx.fillStyle = '#7f93a8'; ctx.font = `400 36px ${F.ui}`; ctx.fillText(sub, 262, 150);
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(262 + ctx.measureText(sub).width + 26, 150, 9, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 3; k++) { ctx.fillStyle = '#8fa3b8'; ctx.beginPath(); ctx.arc(1020, 92 + k * 26, 6, 0, Math.PI * 2); ctx.fill(); }
  // messages (redacted bubbles from real nicknames)
  const senders = o.senders || [0, 11, 9, 20, 3, 46, 27, 13, 41, 52];
  let y = 300 - scroll; const avs = [];
  for (let k = 0; k < msgs; k++) {
    const id = senders[k % senders.length]; const r = rng(k * 17 + 5);
    const lines = 1 + Math.floor(r() * 3), bw = 420 + r() * 380, bh = 96 + lines * 44;
    if (y > H - 220) break;
    const mine = k % 4 === 3;
    const bx = mine ? 1080 - 40 - bw : 150;
    if (!mine) avs.push({ id, x: 88, y: y + bh - 50, k });
    if (!mine && atlas) {
      ctx.save(); ctx.globalAlpha = 1 - dimAvatars * (holoMask ? holoMask(k) : 1);
      ctx.beginPath(); ctx.arc(88, y + bh - 50, 46, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(atlas.canvas, (id % 8) * atlas.S, Math.floor(id / 8) * atlas.S, atlas.S, atlas.S, 42, y + bh - 96, 92, 92); ctx.restore();
    }
    ctx.fillStyle = mine ? '#1f3a2a' : '#17212b'; roundRect(ctx, bx, y, bw, bh, 30); ctx.fill();
    if (!mine) {
      const pal = ['#ff7a8a', '#ffb35c', '#8fb4ff', '#7fe08a', '#5fe3d0', '#6fc8ff', '#e3a0f5'];
      ctx.fillStyle = pal[(id * 5 + 3) % 7]; ctx.font = `700 34px ${F.ui}`;
      ctx.fillText(MEMBERS_NAME(id), bx + 28, y + 44);
    }
    for (let l = 0; l < lines; l++) {
      const lw = (l === lines - 1 ? .45 + r() * .4 : .8 + r() * .15) * (bw - 60);
      const ly = y + (mine ? 44 : 92) + l * 44;
      ctx.fillStyle = 'rgba(200,220,235,.16)'; roundRect(ctx, bx + 28, ly - 13, lw, 26, 8); ctx.fill();
      ctx.fillStyle = 'rgba(200,220,235,.08)';
      for (let q = 0; q < lw; q += 34) if (hash(k * 99 + l * 7 + q) < .5) ctx.fillRect(bx + 28 + q, ly - 13, 16, 26);
    }
    ctx.fillStyle = '#6f8396'; ctx.font = `400 26px ${F.ui}`; ctx.textAlign = 'right';
    ctx.fillText(`${String(21 + (k % 3)).padStart(2, '0')}:${String(10 + k * 7 % 50).padStart(2, '0')}`, bx + bw - 24, y + bh - 26); ctx.textAlign = 'left';
    y += bh + 34;
  }
  // bottom: input or join button
  ctx.fillStyle = '#121a23'; ctx.fillRect(0, H - 170, 1080, 170);
  if (join) {
    const p = joinState; // 0 idle, 0..1 press
    const bw = 860, bh = 112, bx = 540 - bw / 2, by = H - 141;
    const press = Math.sin(Math.PI * clamp(p)) * .05;
    ctx.save(); ctx.translate(540, by + bh / 2); ctx.scale(1 - press, 1 - press); ctx.translate(-540, -(by + bh / 2));
    const gg = ctx.createLinearGradient(bx, 0, bx + bw, 0); gg.addColorStop(0, '#1fd16b'); gg.addColorStop(1, '#0fa3ff');
    ctx.fillStyle = gg; roundRect(ctx, bx, by, bw, bh, 56); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 46px ${F.head}`; ctx.textAlign = 'center'; ctx.letterSpacing = '4px';
    ctx.fillText('ПРИСОЕДИНИТЬСЯ', 540, by + bh / 2 + 2); ctx.letterSpacing = '0px';
    ctx.restore();
  } else {
    ctx.fillStyle = '#1a2430'; roundRect(ctx, 40, H - 140, 860, 100, 50); ctx.fill();
    ctx.fillStyle = '#5c6f82'; ctx.font = `400 38px ${F.ui}`; ctx.fillText('Сообщение', 90, H - 88);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(990, H - 90, 50, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  return { avatars: avs };
}
let _names = [];
export function setNames(n) { _names = n; }
function MEMBERS_NAME(id) { return _names[id] ?? ''; }
