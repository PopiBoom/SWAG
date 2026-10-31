// Reusable visual parts: avatars, nick labels, Telegram bubbles, retro system windows, toasts, cursor, character tokens.
import { el, hash } from './core.js';
import { byId } from './data.js';

export const ASSETS = { avatars: new Set(), nicks: new Set(), logo: false };

// Telegram's own palette for users without a photo
const PAL = [['#ff885e', '#ff516a'], ['#ffcd6a', '#ffa85c'], ['#82b1ff', '#665fff'], ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'], ['#72d5fd', '#2a9ef1'], ['#e0a2f3', '#d669ed']];
export const NAMECOL = ['#ff7a6b', '#ffb157', '#9d8cff', '#6fd36a', '#3fd8c8', '#55b6ff', '#e080f0'];
const idx = id => Math.floor(hash([...id].reduce((a, c) => a + c.charCodeAt(0) * 7, 3)) * 7);
export const nameColor = m => NAMECOL[idx(m.id)];

function initials(m) {
  if (m.glitch) return { blue: '✦', at: '@', dots: '•••', ml: 'മ' }[m.glitch];
  const s = m.nick;
  const emo = s.match(/\p{Extended_Pictographic}/u);
  const words = s.replace(/[^\p{L}\p{N}¹\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return emo ? emo[0] : s.trim().slice(0, 1) || '?';
  const a = [...words[0]][0], c = words[1] ? [...words[1]][0] : '';
  return (a + c).toUpperCase();
}

const cache = {};
export function avatarURL(m) {
  if (ASSETS.avatars.has(m.id)) return `assets/avatars/${m.id}.jpg`;
  if (cache[m.id]) return cache[m.id];
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), [c1, c2] = PAL[idx(m.id)];
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const ini = initials(m);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const emoji = /\p{Extended_Pictographic}/u.test(ini);
  g.font = `${emoji ? 120 : ini.length > 2 ? 78 : 104}px ${emoji ? 'Noto Color Emoji' : 'Inter, "Noto Sans KR", "Noto Sans Malayalam"'}`;
  g.font = (emoji ? '' : '600 ') + g.font;
  g.fillText(ini, S / 2, S / 2 + 6);
  return (cache[m.id] = c.toDataURL('image/jpeg', 0.92));
}

export function avatar(m, size, parent, cls = '') {
  if (typeof m === 'string') m = byId[m];
  const a = el('div', 'av ' + cls, parent);
  a.style.width = a.style.height = size + 'px';
  a.style.backgroundImage = `url(${avatarURL(m)})`;
  return a;
}

// nick label; glitch nicks get decoded per frame by tickNick()
const GL = { blue: '✦✧❖✶✷✸❂✺✹❋', at: '✦☆♡✧⚡♢✿❀', dots: '.·•‥…', ml: 'അആഇഈഉഎഏഒകഖഗചജടഡതദനപബമയരലവശസഹ' };
export function nick(m, parent, cls = '') {
  if (typeof m === 'string') m = byId[m];
  const s = el('span', 'nick ' + cls, parent);
  if (m.glitch && ASSETS.nicks.has(m.id)) { el('img', 'nickimg', s).src = `assets/nicks/${m.id}.png`; return s; }
  if (m.glitch) { s.classList.add('glitch-' + m.glitch); s._m = m; GLITCHES.push(s); }
  else s.textContent = m.nick;
  if (m.blue) s.classList.add('bluestar');
  return s;
}
export const GLITCHES = [];
export function tickNicks(t) {
  const f = Math.floor(t * 12);
  for (const s of GLITCHES) {
    if (!s.isConnected || s.offsetParent === null) continue;
    const m = s._m, set = [...GL[m.glitch]], n = m.glitch === 'ml' ? 4 : m.glitch === 'at' ? 2 : 3;
    let out = m.glitch === 'at' ? '@' : '';
    for (let i = 0; i < n - (m.glitch === 'at' ? 1 : 0); i++) out += set[Math.floor(hash(f * 13 + i * 7 + m.id.length) * set.length)];
    if (m.glitch === 'dots') out = out.split('').join(' ');
    if (s._t !== out) { s._t = out; s.textContent = out; }
  }
}

// Telegram message bubble
export function bubble(parent, m, text, { cls = '', time = '23:59', out = false, sticker = null } = {}) {
  if (typeof m === 'string') m = byId[m];
  const w = el('div', 'tgmsg ' + (out ? 'out ' : '') + cls, parent);
  if (!out && m) avatar(m, 64, w, 'tgav');
  const bb = el('div', 'tgb', w);
  if (m && !out) { const n = nick(m, bb, 'tgname'); n.style.color = nameColor(m); }
  const body = el('div', 'tgtext', bb);
  if (sticker) { body.classList.add('sticker'); body.innerHTML = sticker; }
  else body.textContent = text;
  el('div', 'tgtime', bb, time + (out ? ' <span class="ticks">✓✓</span>' : ''));
  w._body = body;
  return w;
}

// retro OS window
export function win(parent, title, body, { buttons = ['OK'], icon = '⚠', cls = '' } = {}) {
  const w = el('div', 'win ' + cls, parent);
  const bar = el('div', 'win-bar', w);
  el('span', 'win-title', bar, title);
  el('span', 'win-x', bar, '<i>_</i><i>□</i><i>✕</i>');
  const c = el('div', 'win-body', w);
  if (icon) el('div', 'win-icon', c, icon);
  const tx = el('div', 'win-text', c); tx.innerHTML = body;
  w._text = tx;
  if (buttons.length) {
    const br = el('div', 'win-btns', w);
    w._btns = buttons.map(b => el('div', 'win-btn', br, b));
  }
  return w;
}

export function toast(parent, icon, text, cls = '') {
  const t = el('div', 'toast ' + cls, parent);
  el('div', 'toast-ic', t, icon);
  const x = el('div', 'toast-tx', t); x.innerHTML = text;
  return t;
}

export function plate(parent, text, cls = '') {
  const p = el('div', 'plate ' + cls, parent);
  p.innerHTML = text;
  return p;
}

const CURSOR_SVG = `<svg viewBox="0 0 28 40" width="56" height="80"><path d="M2 2 L2 31 L9.5 24.5 L14.5 36 L20 33.5 L15 22.5 L25 22.5 Z" fill="#fff" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
export function cursor(parent) { const c = el('div', 'cursor', parent, CURSOR_SVG); return c; }

// character token: avatar head + glossy capsule body + nameplate. Props are appended into .fig-props
export function figure(parent, m, { size = 260, body = '#1b1f2a', glow = '#39ff14', cls = '' } = {}) {
  if (typeof m === 'string') m = byId[m];
  const f = el('div', 'fig ' + cls, parent);
  f.style.setProperty('--sz', size + 'px');
  f.style.setProperty('--body', body);
  f.style.setProperty('--glow', glow);
  el('div', 'fig-shadow', f);
  const bd = el('div', 'fig-body', f);
  el('div', 'fig-arm l', bd); el('div', 'fig-arm r', bd);
  const head = el('div', 'fig-head', f);
  avatar(m, size, head, 'fig-av');
  el('div', 'fig-ring', head);
  const np = el('div', 'fig-name', f); nick(m, np);
  f._head = head; f._body = bd; f._name = np;
  f._props = el('div', 'fig-props', f);
  return f;
}

// small member card (gallery)
export function card(parent, m, withCap = true) {
  if (typeof m === 'string') m = byId[m];
  const c = el('div', 'mcard', parent);
  avatar(m, 128, c, 'mcard-av');
  const n = el('div', 'mcard-nick', c); nick(m, n);
  if (withCap && m.cap) el('div', 'mcard-cap', c, m.cap);
  else el('div', 'mcard-status', c, hash(m.id.length * 3.1 + m.id.charCodeAt(0)) > 0.66 ? '<b>в сети</b>' : 'был(а) недавно');
  return c;
}

// big emoji as a prop
export function emo(parent, ch, size, cls = '') {
  const e = el('div', 'emo ' + cls, parent, ch);
  e.style.fontSize = size + 'px';
  return e;
}
