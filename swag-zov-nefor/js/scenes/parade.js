// 6. Парад местных мемов — 10 коротких эпизодов на ленте, whip-переходы на сильные доли.
import { el, tf, kf, E, pop, prog, clamp, hash, txt } from '../core.js';
import { figure, emo, bubble, win, avatar, nick, toast } from '../ui.js';
import { layer, clear, burst, rain, fog, boom, speedLines, drawEmoji } from '../fx.js';
import { SCENES, b, MUTES } from '../data.js';
import { POST } from '../post.js';
import { backdrop, caption, popBubble, camera, placeFig, dropIn } from './common.js';

// vignette ranges in bars of segment A
const V = [
  ['rusa', 21, 22.25], ['satoshi', 22.25, 23.5], ['vedma', 23.5, 25], ['eva', 25, 25.75], ['dobrynya', 25.75, 27],
  ['puato', 27, 28.5], ['arni', 28.5, 29.75], ['dasha2', 29.75, 30.5], ['busenok', 30.5, 31.75], ['sanek', 31.75, 33],
].map(([id, x0, x1]) => ({ id, a: b(x0), e: b(x1) }));
const VI = Object.fromEntries(V.map(v => [v.id, v]));
const OUT = 0.2; // whip-out overlap

const P = {};
const BUILD = {}, UPDATE = {};

// ---------- rusa ----------
BUILD.rusa = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 50% 55%, #0b3a1a, #010603 70%)';
  o.g0 = layer(r);
  o.logo = el('div', 'tglogo', r, '<svg viewBox="0 0 100 100" width="300" height="300"><path d="M18 48 L80 24 L70 78 L50 64 L40 74 L39 60 L68 34 L34 56 Z" fill="#fff"/></svg>');
  o.car = el('div', 'car', r);
  o.carE = emo(o.car, '🏎️', 420); o.carE.classList.add('car-e');
  o.drv = el('div', 'driver', o.car); avatar('rusa', 90, o.drv); nick('rusa', o.drv);
  o.cap = caption(r, 'rusa: <b>Залетел на минутку</b>', 960, 120);
  o.lap = el('div', 'lap hud', r, 'КРУГ ПОЧЁТА <span>1</span>/1 ✓');
  o.lapN = o.lap.querySelector('span');
};
UPDATE.rusa = (o, lt, t, d) => {
  clear(o.g0);
  // car orbits the logo on an ellipse; the angle accelerates
  const ang = -Math.PI / 2 + E.inOutCubic(prog(lt, 0.0, d)) * Math.PI * 3.2 + lt * 0.6;
  const rx = 640, ry = 260, cx = 960, cy = 600;
  const x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry, depth = (Math.sin(ang) + 1) / 2;
  const dir = Math.cos(ang) > 0 ? -1 : 1; // facing direction along the tangent
  o.car.style.transform = `translate(${x - 210}px, ${y - 260}px) scale(${(0.75 + depth * 0.5).toFixed(3)}) `;
  o.carE.style.transform = `scaleX(${-dir}) rotate(${(Math.cos(ang) * 14).toFixed(1)}deg)`;
  o.car.style.zIndex = depth > 0.5 ? 6 : 2;
  o.logo.style.transform = `translate(-50%,-50%) rotateY(${Math.sin(lt * 2) * 15}deg) scale(${1 + Math.sin(lt * 8) * 0.02})`;
  // tyre smoke along the recent path
  for (let k = 1; k < 18; k++) {
    const a2 = ang - k * 0.09, sx = cx + Math.cos(a2) * rx, sy = cy + Math.sin(a2) * ry + 70;
    const rad = 40 + k * 8, gr = o.g0.createRadialGradient(sx, sy, 0, sx, sy, rad);
    gr.addColorStop(0, `rgba(220,255,220,${0.22 * (1 - k / 18)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    o.g0.fillStyle = gr; o.g0.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }
  o.g0.strokeStyle = 'rgba(57,255,20,0.25)'; o.g0.lineWidth = 10; o.g0.beginPath(); o.g0.ellipse(cx, cy + 80, rx, ry, 0, 0, 6.283); o.g0.stroke();
  o.cap.update(lt, 0.25, d + 1);
  const lk = pop(lt, 1.35, 0.3); o.lap.style.opacity = lk; o.lap.style.transform = `translate(-50%,0) scale(${lk})`;
};

// ---------- Satoshi ----------
BUILD.satoshi = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 50% 30%, #2a2206, #050402 70%)';
  o.g0 = layer(r);
  o.fig = figure(r, 'satoshi', { size: 170, body: '#5a4400', glow: '#ffd400' });
  o.chart = el('div', 'chart', r, '<div class="ch-h">MEME / НАСТРОЕНИЕ <b>▲</b></div><svg viewBox="0 0 600 360" width="600" height="360"><polyline class="ch-line" fill="none" stroke="#39ff14" stroke-width="10" stroke-linejoin="round" points="0,330 60,300 110,315 170,250 220,265 280,190 330,205 390,120 440,140 500,60 560,20 600,0"/></svg>');
  o.line = o.chart.querySelector('.ch-line');
  o.cat = emo(o.chart, '😹', 300); o.cat.classList.add('ch-cat');
  o.cap = caption(r, 'Инвестиция в мемы: <b>+1000% настроения</b>', 960, 980);
};
UPDATE.satoshi = (o, lt, t, d) => {
  clear(o.g0);
  // coin mountain
  const rise = E.outCubic(prog(lt, 0, 0.5));
  for (let i = 0; i < 110; i++) {
    const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), col = i - row * (row + 1) / 2;
    const rows = 14, rr = rows - 1 - row; if (rr < 0) continue;
    const x = 520 + (col - row / 2) * 62 + (hash(i) - 0.5) * 14, y = 1060 - rr * 46 * rise;
    drawEmoji(o.g0, '🪙', x, y + 400 * (1 - rise), 64, (hash(i + 3) - 0.5) * 0.8);
  }
  placeFig(o.fig, { x: 520, y: 1060 - 13 * 46 * rise + 30, s: 1, o: rise });
  const ck = pop(lt, 0.25, 0.4);
  o.chart.style.opacity = ck; o.chart.style.transform = `perspective(900px) rotateY(-14deg) scale(${0.6 + 0.4 * ck})`;
  const len = 1100; o.line.style.strokeDasharray = len; o.line.style.strokeDashoffset = len * (1 - E.inOutCubic(prog(lt, 0.35, 1.15)));
  const mk = prog(lt, 1.15, 1.45);
  o.line.style.opacity = 1 - mk;
  o.cat.style.opacity = mk; o.cat.style.transform = `translate(-50%,-50%) scale(${0.2 + E.outBack(mk) * 0.8}) rotate(${Math.sin(lt * 7) * 8}deg)`;
  o.cap.update(lt, 1.3, d + 1);
};

// ---------- Ведьма ----------
BUILD.vedma = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 40% 50%, #2a0a44, #05010a 70%)';
  o.g0 = layer(r);
  o.fig = figure(r, 'vedma', { size: 220, body: '#2a0a4a', glow: '#b026ff' });
  el('div', 'witchhat', o.fig._props);
  o.book = el('div', 'book', r, '<div class="pg l"><div class="pg-t">Как заставить людей перестать спорить</div><div class="pg-s">глава 1 из ∞</div></div><div class="pg r"><div class="rune">✶ ☾ ✷<br>⟁ ✦ ⟡</div></div><div class="cover"></div>');
  o.cover = o.book.querySelector('.cover');
  o.fail = win(r, 'Магия.exe', 'Заклинание<br>не подействовало', { buttons: ['ОК', 'Ещё раз'], icon: '✕', cls: 'err red' });
  o.fail.style.left = '1080px'; o.fail.style.top = '640px';
  o.g = layer(r, 'top');
};
UPDATE.vedma = (o, lt, t, d) => {
  clear(o.g0); clear(o.g);
  fog(o.g0, t, { n: 18, x: 600, y: 700, w: 1200, h: 600, r: 380, color: 'rgba(176,38,255,0.28)', seed: 11, drift: 0 });
  const appear = E.outCubic(prog(lt, 0, 0.35));
  placeFig(o.fig, { x: 520, y: 960, s: 0.6 + appear * 0.4, o: appear });
  const open = E.outBack(prog(lt, 0.3, 0.7)), shut = E.inBack(prog(lt, 2.3, 2.55));
  o.book.style.transform = `translate(-50%,-50%) perspective(1200px) rotateX(28deg) rotateZ(-4deg) translateY(${Math.sin(lt * 2) * 10}px)`;
  o.cover.style.transform = `rotateY(${(-180 * open + 180 * shut).toFixed(1)}deg) translateZ(4px)`;
  o.book.classList.toggle('glow', lt > 1.2 && lt < 1.95);
  const fk = pop(lt, 1.95, 0.25);
  o.fail.style.opacity = fk; o.fail.style.transform = `scale(${fk}) rotate(${(1 - fk) * 8}deg)`;
  if (lt > 1.2 && lt < 2.0) burst(o.g, t, o.a + 1.2, { x: 1150, y: 440, n: 60, speed: 900, size: 60, shape: 'emoji', chars: ['✨', '💫', '⭐'], grav: -100, life: 1.0, seed: 5 });
  if (lt > 2.0) burst(o.g, t, o.a + 2.0, { x: 1150, y: 440, n: 20, speed: 500, size: 70, shape: 'emoji', chars: ['💨'], grav: -300, life: 1.0, seed: 8 });
};

// ---------- ева ⭐ ----------
BUILD.eva = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 50% 20%, #3a1040, #050008 70%)';
  o.g0 = layer(r);
  o.spot = el('div', 'spotlight', r);
  o.ped = el('div', 'pedestal', r, '<div class="pd-top"></div><div class="pd-body">№1</div>');
  o.fig = figure(r, 'eva', { size: 220, body: '#6a1050', glow: '#ffd400' });
  o.cap = caption(r, 'Главная звезда <b>этого беспорядка</b>', 960, 110, 'white');
  o.g = layer(r, 'top');
};
UPDATE.eva = (o, lt, t, d) => {
  clear(o.g0); clear(o.g);
  rain(o.g0, t, { n: 46, speed: 420, chars: ['⭐', '💖', '✨', '🌟'], size: 64, seed: 4 });
  const up = E.outBack(prog(lt, 0, 0.4));
  o.ped.style.transform = `translate(-50%, ${(1 - up) * 400}px)`;
  placeFig(o.fig, { x: 960, y: 690 + (1 - up) * 400, s: 1 });
  o.spot.style.opacity = 0.6 + Math.sin(lt * 10) * 0.1;
  o.cap.update(lt, 0.25, d + 1, -1);
  burst(o.g, t, o.a + 0.4, { x: 960, y: 300, n: 24, speed: 900, size: 50, dir: -Math.PI / 2, spread: 3, shape: 'emoji', chars: ['⭐', '💖'], grav: 500, life: 1.4, seed: 2 });
};

// ---------- ДОБРЫНЯ.) ----------
BUILD.dobrynya = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 50% 70%, #0a2a5a, #01040a 70%)';
  o.g0 = layer(r);
  o.crack = el('div', 'crack', r);
  o.fig = figure(r, 'dobrynya', { size: 240, body: '#0a3a8a', glow: '#00c8ff' });
  o.cape = el('div', 'cape', o.fig); o.fig.insertBefore(o.cape, o.fig.firstChild);
  o.logoS = el('div', 'heroS', o.fig._body, 'Д');
  o.c1 = caption(r, 'Добрыня пришёл <b>спасать ситуацию</b>', 960, 110, 'neon');
  o.c2 = caption(r, 'Ситуация <b>спасению не подлежит</b>', 960, 990, 'red');
  o.g = layer(r, 'top');
};
UPDATE.dobrynya = (o, lt, t, d) => {
  clear(o.g0); clear(o.g);
  const dI = dropIn(lt, 0.0, 1100);
  const turn = E.inOutCubic(prog(lt, 1.1, 1.5));
  placeFig(o.fig, { x: 960, y: 900 + dI.y, sq: dI.sq, ry: turn * 180 });
  o.fig._name.style.opacity = 1 - clamp(turn * 3);
  o.cape.style.transform = `rotate(${Math.sin(lt * 6) * 4}deg) scaleY(${1 + Math.sin(lt * 9) * 0.04})`;
  const ck = prog(lt, 0.38, 0.5);
  o.crack.style.opacity = ck; o.crack.style.transform = `translate(-50%,-50%) scale(${0.3 + E.outCubic(ck) * 0.7})`;
  if (lt > 0.38) burst(o.g, t, o.a + 0.38, { x: 960, y: 900, n: 70, speed: 1300, size: 18, shape: 'dot', colors: ['#9fb4cc', '#c8d6e6', '#00c8ff'], grav: 1500, life: 1.0, dir: -Math.PI / 2, spread: 2.6, seed: 3 });
  o.c1.update(lt, 0.45, 1.25);
  o.c2.update(lt, 1.45, d + 1, 2);
  if (lt > 0.38 && lt < 0.5) POST.flash = 0.3;
};

// ---------- puato4ka 🌸 ----------
BUILD.puato = (r, o) => {
  r.style.background = 'linear-gradient(#ffd6ec, #ffb3d9 55%, #7ad67a 55.2%, #2e8a3e)';
  o.flowers = [];
  for (let i = 0; i < 26; i++) {
    const f = emo(r, ['🌸', '🌷', '🌼', '🌺', '🌸'][i % 5], 90 + (i % 3) * 30);
    f._x = (i * 79) % 1920; f._y = 640 + ((i * 53) % 400); f.style.zIndex = Math.floor(f._y / 100);
    o.flowers.push(f);
  }
  o.fig = figure(r, 'puato', { size: 220, body: '#ff7ac8', glow: '#ff7ac8' });
  o.fig.style.zIndex = 7;
  o.sign = el('div', 'sign', o.fig._props, 'Можно потише?');
  o.no = el('div', 'bigno title', r, 'Нет');
  o.sys = el('div', 'sysline mono', r, 'Система:');
  o.g = layer(r, 'top');
};
UPDATE.puato = (o, lt, t, d) => {
  clear(o.g);
  o.flowers.forEach((f, i) => { f.style.transform = `translate(${f._x}px, ${f._y}px) rotate(${Math.sin(t * 2 + i) * 8 + (lt > 0.9 ? Math.sin(t * 20 + i) * 14 : 0)}deg)`; });
  placeFig(o.fig, { x: 820, y: 1000, s: 1, rz: lt > 0.9 && lt < 1.4 ? Math.sin(lt * 30) * 3 : 0 });
  // chaos flying through the garden
  if (lt > 0.9) {
    for (let i = 0; i < 24; i++) {
      const sp = 1600 + hash(i) * 1400, y = 150 + hash(i + 9) * 650, x = 2100 - ((lt - 0.9) * sp + hash(i + 4) * 2400) % 3000;
      const ch = ['💬', '🤡', '😂', '🔥', '💀', '📢', '🗿'][i % 7];
      drawEmoji(o.g, ch, x, y + Math.sin(t * 6 + i) * 20, 70 + (i % 3) * 20, Math.sin(t * 4 + i) * 0.6);
    }
  }
  const sk = pop(lt, 1.35, 0.3);
  o.sign.style.opacity = sk; o.sign.style.transform = `translate(-50%,0) translateY(${(1 - sk) * 120}px) rotate(${-4 + Math.sin(lt * 3) * 2}deg)`;
  const nk = pop(lt, 2.2, 0.25, E.outBack);
  o.no.style.opacity = nk; o.no.style.transform = `translate(-50%,-50%) scale(${2.5 - nk * 1.5}) rotate(-6deg)`;
  o.sys.style.opacity = pop(lt, 2.05, 0.2);
  if (lt > 2.2 && lt < 2.35) POST.flash = 0.25;
};

// ---------- ПлохойАрни ⭐ ----------
BUILD.arni = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 50% 60%, #3a1a00, #050200 70%)';
  o.g0 = layer(r);
  o.fig = figure(r, 'arni', { size: 250, body: '#2a2a2a', glow: '#ff7a00' });
  o.shades = emo(o.fig._props, '🕶️', 200); o.shades.style.left = '25px'; o.shades.style.top = '10px';
  o.cap = caption(r, 'ПлохойАрни: <b>Я пришёл с миром</b>', 960, 110);
};
UPDATE.arni = (o, lt, t, d) => {
  clear(o.g0);
  boom(o.g0, lt - 0.05, 960, 620, 900, 1);
  boom(o.g0, lt - 1.6, 1500, 560, 1000, 4);
  boom(o.g0, lt - 1.75, 400, 640, 700, 6);
  placeFig(o.fig, { x: 960, y: 1020, s: 1 });
  const sk = E.outCubic(prog(lt, 0.45, 0.8));
  o.shades.style.transform = `translateY(${(1 - sk) * -500}px) rotate(${(1 - sk) * -20}deg)`;
  o.shades.style.opacity = lt > 0.45 ? 1 : 0;
  o.cap.update(lt, 0.8, d + 1);
  if (lt > 1.6 && lt < 1.75) POST.flash = 0.35;
};

// ---------- Даша (снова) ----------
BUILD.dasha2 = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 60% 60%, #3a0614, #050002 70%)';
  o.ped = el('div', 'redped', r, '<div class="rb-cap"></div><div class="rb-lbl">НЕ НАЖИМАТЬ</div>');
  o.ped.style.left = '1120px';
  o.fig = figure(r, 'dasha', { size: 220, body: '#5a0a2a', glow: '#ff7ac8' });
  o.cap = caption(r, 'Только <b>не опять…</b>', 960, 120, 'red');
};
UPDATE.dasha2 = (o, lt, t, d) => {
  const k = E.inOutCubic(prog(lt, 0, d));
  placeFig(o.fig, { x: 500 + k * 380, y: 1000 - Math.abs(Math.sin(lt * 9)) * 16, rz: 6 });
  o.cap.update(lt, 0.2, d + 1);
};

// ---------- Бусенок ----------
BUILD.busenok = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 50% 40%, #1a0a3a, #020008 70%)';
  o.g0 = layer(r);
  o.fig = figure(r, 'busenok', { size: 190, body: '#3a2a7a', glow: '#b6ff00' });
  o.hand = emo(o.fig._props, '✋', 120); o.hand.style.left = '170px'; o.hand.style.top = '120px';
  o.cap = caption(r, 'Кто тут <b>самый спокойный?</b>', 960, 110, 'violet');
  o.g = layer(r, 'top');
};
UPDATE.busenok = (o, lt, t, d) => {
  clear(o.g0); clear(o.g);
  // sticker battle behind
  if (lt > 0.9) {
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1, sp = 900 + hash(i) * 900, y = 120 + hash(i + 5) * 560;
      const x = 960 - side * (1100 - ((lt - 0.9) * sp + hash(i + 2) * 1100) % 2200);
      drawEmoji(o.g0, ['😡', '🤬', '💥', '😂', '🗡️', '🛡️', '🍅', '🧨'][i % 8], x, y + Math.sin(t * 8 + i) * 30, 80, t * 6 * side);
    }
    for (let j = 0; j < 4; j++) burst(o.g0, t, o.a + 1.0 + j * 0.3, { x: 400 + j * 360, y: 300 + (j % 2) * 200, n: 30, speed: 900, size: 14, shape: 'dot', colors: ['#ffd400', '#ff2a3d', '#fff'], grav: 0, life: 0.5, seed: j });
  }
  // meme throne (pile) + hero
  for (let i = 0; i < 60; i++) {
    const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), col = i - row * (row + 1) / 2, rr = 10 - row; if (rr < 0) continue;
    drawEmoji(o.g, ['😂', '🤡', '💀', '🗿', '🐸', '😭'][i % 6], 960 + (col - row / 2) * 92, 1090 - rr * 62, 100, (hash(i) - 0.5) * 0.6);
  }
  placeFig(o.fig, { x: 960, y: 1090 - 10 * 62 + 40, s: 1 });
  const hk = E.outBack(prog(lt, 0.9, 1.15));
  o.hand.style.transform = `translateY(${(1 - hk) * 120}px) rotate(${Math.sin(lt * 10) * 10}deg)`;
  o.hand.style.opacity = lt > 0.9 ? 1 : 0;
  o.fig._body.querySelector('.fig-arm.r').style.transform = `rotate(${-14 - hk * 150}deg)`;
  o.cap.update(lt, 0.2, d + 1);
};

// ---------- Санёк ----------
BUILD.sanek = (r, o) => {
  r.style.background = 'radial-gradient(ellipse at 50% 50%, #0a1a2a, #010205 70%)';
  o.phone = el('div', 'phone', r);
  o.scr = el('div', 'ph-scr', o.phone);
  o.pg = layer(o.scr); o.pg.canvas.style.width = '100%'; o.pg.canvas.style.height = '100%';
  o.rec = el('div', 'ph-rec mono', o.scr, '<i></i> REC <span>00:00:00</span>');
  o.recT = o.rec.querySelector('span');
  el('div', 'ph-frame', o.scr);
  o.fig = figure(r, 'sanek', { size: 200, body: '#1a3a5a', glow: '#00c8ff' });
  o.cap = caption(r, 'Санёк: <b>Это надо сохранить</b>', 520, 130, 'neon');
  o.save = toast(r, '✓', 'Компромат успешно сохранён<div class="sv-bar"><div></div></div>', '');
  o.save.style.left = '960px'; o.save.style.top = '900px';
  o.svf = o.save.querySelector('.sv-bar div');
};
UPDATE.sanek = (o, lt, t, d) => {
  const g = o.pg; clear(g);
  g.fillStyle = '#05080c'; g.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 36; i++) {
    const x = (hash(i) * 1920 + t * (300 + hash(i + 1) * 600) * (i % 2 ? 1 : -1)) % 2200 - 140, y = hash(i + 3) * 1080;
    drawEmoji(g, ['🤡', '😂', '💀', '🔥', '🗿', '💬'][i % 6], (x + 2200) % 2200 - 140, y, 160, t * 3);
  }
  txt(o.recT, '00:00:' + String(Math.floor(lt * 10)).padStart(2, '0'));
  o.rec.querySelector('i').style.opacity = Math.floor(lt * 3) % 2 ? 0.2 : 1;
  const pk = E.outCubic(prog(lt, 0, 0.3));
  o.phone.style.transform = `translate(-50%,-50%) translateX(${200}px) rotate(${-6 + Math.sin(lt * 2) * 2}deg) scale(${0.8 + pk * 0.2})`;
  placeFig(o.fig, { x: 420, y: 1020, s: 1 });
  o.cap.update(lt, 0.25, d + 1);
  const sk = pop(lt, 1.25, 0.3);
  o.save.style.opacity = sk; o.save.style.transform = `translate(-50%,-50%) scale(${0.6 + sk * 0.4})`;
  o.svf.style.width = (E.outCubic(prog(lt, 1.3, 1.8)) * 100) + '%';
  if (lt > 1.15 && lt < 1.3) { POST.flash = 0.7 * (1 - (lt - 1.15) / 0.15); }
};

const CUES = {
  rusa: [[0, 'drift', 0.9], [0.25, 'notify', 0.6], [1.35, 'coin', 0.7]],
  satoshi: [[0, 'coins', 0.8], [0.4, 'riser_s', 0.5], [1.15, 'meow', 0.8], [1.3, 'cash', 0.7]],
  vedma: [[0, 'magic', 0.7], [0.3, 'pageflip', 0.8], [1.2, 'magic', 0.9], [1.95, 'crit', 0.8], [2.0, 'sad', 0.8], [2.4, 'bookslam', 0.9]],
  eva: [[0, 'sparkle', 0.9], [0.25, 'slam', 0.6]],
  dobrynya: [[0, 'whoosh', 0.7], [0.38, 'impact', 1.0], [0.45, 'hero', 0.6], [1.1, 'whoosh_s', 0.6], [1.45, 'sad', 0.6]],
  puato: [[0, 'birds', 0.6], [0.9, 'zoom', 0.6], [1.0, 'notify', 0.4], [1.2, 'notify', 0.4], [1.35, 'pop', 0.8], [2.2, 'bass', 1.0], [2.2, 'crit', 0.5]],
  arni: [[0.05, 'boom', 1.0], [0.8, 'slam', 0.7], [1.6, 'boom', 0.9], [1.75, 'boom', 0.7]],
  dasha2: [[0.2, 'tension', 0.6]],
  busenok: [[0.2, 'slam', 0.6], [0.9, 'pop', 0.8], [1.0, 'fight', 0.9]],
  sanek: [[0.1, 'rec', 0.8], [1.15, 'shutter', 1.0], [1.3, 'save', 0.9]],
};

export const parade = {
  name: 'parade', range: SCENES.parade, z: 2,
  cues: V.flatMap(v => [[v.a - 0.02, 'whip', 0.55], ...CUES[v.id].map(([dt, n, g]) => [v.a + dt, n, g])]),
  build(root) {
    P.hud = el('div', 'parade-hud', root, '<div class="ph-t">ПАРАД МЕСТНЫХ МЕМОВ</div><div class="ph-dots">' + V.map(() => '<i></i>').join('') + '</div>');
    P.dots = [...P.hud.querySelectorAll('i')];
    P.v = V.map(v => {
      const r = el('div', 'vig', root); r.style.display = 'none';
      const o = { a: v.a, e: v.e, root: r };
      BUILD[v.id](r, o);
      return { ...v, o, r };
    });
  },
  update(t) {
    P.v.forEach((v, i) => {
      const on = t >= v.a && t < v.e + OUT;
      if (on !== v.on) { v.r.style.display = on ? '' : 'none'; v.on = on; }
      if (!on) return;
      const kin = E.outCubic(prog(t, v.a, v.a + 0.22)), kout = E.inCubic(prog(t, v.e, v.e + OUT));
      const x = (1 - kin) * 1920 - kout * 1920, blur = (1 - kin) * 14 + kout * 14;
      v.r.style.transform = `translateX(${x.toFixed(1)}px) skewX(${((1 - kin) * -8 + kout * 8).toFixed(2)}deg)`;
      v.r.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
      v.r.style.zIndex = t < v.e ? 2 : 1;
      UPDATE[v.id](v.o, t - v.a, t, v.e - v.a);
    });
    const cur = V.findIndex(v => t >= v.a && t < v.e);
    P.dots.forEach((d, i) => d.className = i < cur ? 'done' : i === cur ? 'on' : '');
    P.hud.style.zIndex = 30;
  },
};
