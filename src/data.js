// Real participant nicknames of SWAG_ZOV_NEFOR.exe, exactly as provided in the brief.
// Three positions were described in words only (no exact glyphs available) — they are shown as
// unnamed avatars, never with invented text. Avatars are Telegram-style placeholders (colour + initial)
// unless a real picture is supplied in assets/avatars/NN.jpg (NN = index below, 01..63).
import { makeCanvas, canvasTex, rng, clamp } from './core.js';

export const MEMBERS = [
  'cold#inte2(t#o)', 'Сеня айТи', 'Антон Дуброн', 'Death', 'ева ⭐', 'vладик 🇺🇸', 'sckal’pel’',
  { name: null, note: 'участник с синим декоративным символом', hue: 'blue' },
  'сглыпа)', 'kapustka [Бледный]', 'пользователь прил…', 'Даша вкид 👑', 'puato4ka 🌸', 'Вася Флеш',
  '#LXVECVLT t9ctox7c', { name: '@', note: '@ с декоративным символом' }, 'gera//stik', 'birds of Hiroshima',
  'Grab↑88', '⭐', '* 💀', 'Ведьма', 'Nesmotri · Nazad[Пы…', 'Priem · Chermeta [Добби]', 'True Mafia', 'BunkerRP',
  'ДОБРЫНЯ.)', 'Даня Круглый', 'ксюня', 'ямимару', '¹', 'Celestiana', 'Ян Брагин',
  { name: null, note: 'участник с никнеймом на языке малаялам' }, 'Мила', 'Sharpilov', 'kevin', 'дема💔', '•', '.',
  'хик.', '@hikaa', 'Weakxxx', 'Бусенок', 'rusa', 'нескин', '예바 🤍', 'Арина (свэг шмот)', 'Санёк', 'no name',
  'junior', 'timofey ⭐', 'Satoshi', 'Даня', 'Mqkk', 'кристина💎', 'Lobanoff', 'á', 'сашка янг', '.', 'ksuha',
  'ПлохойАрни ⭐', 'Богдан Головин ⭐',
].map((m, i) => {
  const o = typeof m === 'string' ? { name: m } : { ...m };
  o.id = i; o.num = String(i + 1).padStart(2, '0');
  return o;
});
export const KAPUSTKA = MEMBERS.findIndex(m => m.name === 'kapustka [Бледный]');

// Telegram placeholder palette (top → bottom gradient)
const PALETTE = [['#ff885e', '#ff516a'], ['#ffcd6a', '#ffa85c'], ['#82b1ff', '#665fff'], ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'], ['#72d5fd', '#2a9ef1'], ['#e0a2f3', '#d669ed']];

const seg = new Intl.Segmenter('ru', { granularity: 'grapheme' });
export function initial(name) {
  if (!name) return '';
  const g = [...seg.segment(name.trim())].map(s => s.segment);
  const first = g[0];
  if (/\p{L}/u.test(first)) return first.toUpperCase();
  return first;
}

export const NICK_FONT = '"Roboto", "Noto Sans KR", "Noto Color Emoji", sans-serif';

// 8x8 atlas of 256px avatars; cell 63 = the group avatar (skull)
export async function buildAvatarAtlas() {
  const S = 256, A = makeCanvas(S * 8, S * 8), x = A.getContext('2d');
  const imgs = {};
  await Promise.all(MEMBERS.map(async m => {
    try {
      const r = await fetch(`assets/avatars/${m.num}.jpg`, { method: 'HEAD' });
      if (r.ok) { const im = new Image(); im.src = `assets/avatars/${m.num}.jpg`; await im.decode(); imgs[m.id] = im; }
    } catch (e) { /* no real avatar supplied */ }
  }));
  MEMBERS.forEach((m, i) => {
    const cx = (i % 8) * S, cy = Math.floor(i / 8) * S;
    x.save(); x.beginPath(); x.arc(cx + S / 2, cy + S / 2, S / 2 - 6, 0, Math.PI * 2); x.clip();
    if (imgs[m.id]) x.drawImage(imgs[m.id], cx, cy, S, S);
    else {
      let pal = PALETTE[(m.id * 5 + 3) % PALETTE.length];
      if (m.hue === 'blue') pal = PALETTE[5];
      const g = x.createLinearGradient(0, cy, 0, cy + S); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
      x.fillStyle = g; x.fillRect(cx, cy, S, S);
      const ini = initial(m.name);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `500 ${ini.length > 1 || /\p{Extended_Pictographic}/u.test(ini) ? 104 : 118}px ${NICK_FONT}`;
      if (ini) x.fillText(ini, cx + S / 2, cy + S / 2 + 6);
      else { // unnamed: a soft symbol-less glyph mark
        x.globalAlpha = .9; x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(cx + S / 2, cy + S / 2, 40, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
      }
    }
    x.restore();
  });
  // group avatar (skull glyph) in the last cell
  const cx = 7 * S, cy = 7 * S;
  x.save(); x.beginPath(); x.arc(cx + S / 2, cy + S / 2, S / 2 - 6, 0, Math.PI * 2); x.clip();
  const g = x.createLinearGradient(0, cy, 0, cy + S); g.addColorStop(0, '#1a0f22'); g.addColorStop(1, '#050208');
  x.fillStyle = g; x.fillRect(cx, cy, S, S); drawSkullGlyph(x, cx + S / 2, cy + S / 2 + 4, S * 0.62, '#39ff88');
  x.restore();
  const tex = canvasTex(A);
  return { canvas: A, tex, S, uv(i) { return [(i % 8) / 8, 1 - (Math.floor(i / 8) + 1) / 8, 1 / 8, 1 / 8]; } };
}

// simple front-view skull glyph (used for the group avatar & icons)
export function drawSkullGlyph(x, cx, cy, s, col) {
  x.save(); x.translate(cx, cy); x.scale(s / 100, s / 100);
  x.fillStyle = col;
  x.beginPath(); x.ellipse(0, -12, 40, 38, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.roundRect(-24, 10, 48, 30, 8); x.fill();
  x.globalCompositeOperation = 'destination-out';
  x.beginPath(); x.ellipse(-16, -6, 11, 12, -.2, 0, Math.PI * 2); x.ellipse(16, -6, 11, 12, .2, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(0, 6); x.lineTo(-5, 16); x.lineTo(5, 16); x.closePath(); x.fill();
  for (let i = -2; i <= 2; i++) x.fillRect(i * 9 - 1.5, 26, 3, 14);
  x.restore();
}

export function drawAvatar(ctx, atlas, i, x, y, r) {
  const S = atlas.S; const sx = (i % 8) * S, sy = Math.floor(i / 8) * S;
  ctx.drawImage(atlas.canvas, sx, sy, S, S, x - r, y - r, r * 2, r * 2);
}
