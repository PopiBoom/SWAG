// 3. Знакомство с местными легендами: Сеня айТи, Death, Антон Дуброн.
import { el, tf, kf, E, pop, prog, clamp, hash, txt, fmt } from '../core.js';
import { figure, emo, win } from '../ui.js';
import { layer, clear, burst, fog, noteSwarm, rain } from '../fx.js';
import { SCENES, BEAT } from '../data.js';
import { POST } from '../post.js';
import { backdrop, heroCard, whipIn, caption, popBubble, servicePill, camera, placeFig, dropIn } from './common.js';

// ---------------- Сеня айТи ----------------
const S = {};
export const senya = {
  name: 'senya', range: SCENES.senya, z: 2,
  cues: (() => { const a = SCENES.senya[0]; return [[a, 'whip', 0.7], [a + 0.15, 'hero', 0.7], [a + 0.55, 'land', 0.8], [a + 0.9, 'err', 0.45], [a + 1.0, 'notify', 0.8],
    [a + 2.0, 'click', 1.0], [a + 2.12, 'confetti', 1.0], [a + 2.6, 'glitch', 0.6], [a + 2.8, 'slam', 0.7]]; })(),
  build(root) {
    S.bd = backdrop(root, { top: '#0b1630', floor: '#00c8ff' });
    S.cam = el('div', 'cam', root);
    S.mons = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
      const m = el('div', 'mon', S.cam);
      const a = (c - 2) * 17;
      m._a = a; m._r = r; m._i = r * 5 + c;
      m.style.left = (960 - 170) + 'px'; m.style.top = (120 + r * 250) + 'px';
      const scr = el('div', 'mon-scr', m);
      m._err = el('div', 'mon-err', scr, '<div class="me-bar">Ошибка</div><div class="me-x">✕</div><div class="me-t">ERROR 0x' + (1000 + m._i * 731).toString(16).toUpperCase() + '</div>');
      m._bsod = el('div', 'mon-bsod', scr, '<div class="bs-face">:(</div><div class="bs-t">ВСЁ СЛОМАЛОСЬ</div>');
      S.mons.push(m);
    }
    S.desk = el('div', 'desk', S.cam);
    S.key = el('div', 'bigkey', S.desk, '↻');
    S.fig = figure(S.cam, 'senya', { size: 210, body: '#16325c', glow: '#00c8ff' });
    S.glasses = emo(S.fig._props, '🤓', 90); S.glasses.style.left = '60px'; S.glasses.style.top = '-40px'; S.glasses.style.opacity = 0;
    S.card = heroCard(root, 'senya', 'КЛАСС: ТЕХПОДДЕРЖКА', '#00c8ff');
    S.q = popBubble(root, 'senya', 'Пробовал перезагрузить?', 1380, 250, { cls: 'big' });
    S.cap = caption(root, 'Перезагрузил. <b>Теперь сломалось вообще всё.</b>', 960, 960, 'neon');
    S.g = layer(root, 'top');
  },
  update(t, lt) {
    const [a, e] = SCENES.senya, D = e - a;
    const w = whipIn(lt, 0.3, 1);
    const kick = lt > 2.1 ? Math.exp(-(lt - 2.1) * 6) : 0;
    camera(S.cam, { x: w.x, s: kf(lt, [[0, 1.08], [D, 0.94], ], E.inOutCubic), ry: kf(lt, [[0, -9], [D, 7]], E.inOutCubic), rx: 4, blur: w.blur, sh: 3 + kick * 22, t });
    S.bd.update(t, { speed: 60 });
    const boomT = 2.12, broke = lt > 2.55;
    S.mons.forEach(m => {
      const k = E.outBack(prog(lt, 0.05 + m._i * 0.03, 0.45 + m._i * 0.03));
      const ang = m._a * Math.PI / 180, R = 1300;
      const x = Math.sin(ang) * R, z = -Math.cos(ang) * R + R - 500 - m._r * 60;
      m.style.transform = `translate3d(${x.toFixed(1)}px, ${((1 - k) * -600).toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${-m._a}deg) scale(${k.toFixed(3)})`;
      const flick = hash(Math.floor(t * 10) + m._i * 7) > 0.15;
      m._err.style.opacity = !broke && flick ? 1 : 0;
      m._bsod.style.opacity = broke && lt > 2.55 + m._i * 0.03 ? 1 : 0;
      m.classList.toggle('white', lt > boomT - 0.04 && lt < boomT + 0.18);
    });
    const d = dropIn(lt, 0.25, 800);
    placeFig(S.fig, { x: 960, y: 900 + d.y, z: 300, sq: d.sq });
    S.desk.style.transform = `translate3d(-50%, 0, 360px) rotateX(58deg)`;
    const press = lt > 1.95 && lt < 2.2;
    S.key.classList.toggle('down', press);
    S.fig._body.querySelector('.fig-arm.r').style.transform = `rotate(${press ? -70 : -14}deg)`;
    S.glasses.style.opacity = lt > 0.6 ? 1 : 0;
    S.card.update(lt, 0.15, 1.15);
    S.q.update(lt, 1.0, 2.15);
    S.cap.update(lt, 2.8, D + 1);
    clear(S.g);
    for (let i = 0; i < 5; i++) burst(S.g, t, a + boomT + i * 0.04, { x: 360 + i * 300, y: 300, n: 90, speed: 1500, size: 14, shape: 'confetti', grav: 1300, life: 2.0, seed: i * 7, colors: ['#39ff14', '#b026ff', '#00c8ff', '#fff', '#ffd400'] });
    if (lt > boomT && lt < boomT + 0.2) { POST.flash = 0.5 * (1 - (lt - boomT) / 0.2); }
  },
};

// ---------------- Death ----------------
const D_ = {};
export const death = {
  name: 'death', range: SCENES.death, z: 2,
  cues: (() => { const a = SCENES.death[0]; return [[a, 'whip', 0.6], [a + 0.05, 'bossdrone', 0.9], [a + 0.15, 'hero', 0.7], [a + 1.05, 'join', 0.9], [a + 1.9, 'whoosh_s', 0.4],
    [a + 2.45, 'notify', 0.9], [a + 2.6, 'meow', 0.9], [a + 3.25, 'powerdown', 0.8]]; })(),
  build(root) {
    D_.bd = backdrop(root, { top: '#1a0516', bottom: '#000', floor: '#ff2a3d', wall: false });
    D_.g0 = layer(root);
    D_.cam = el('div', 'cam', root);
    D_.rim = el('div', 'death-rim', D_.cam);
    D_.fig = figure(D_.cam, 'death', { size: 300, body: '#0c0c10', glow: '#ff2a3d', cls: 'boss' });
    D_.phone = emo(D_.fig._props, '📱', 120); D_.phone.style.left = '270px'; D_.phone.style.top = '330px';
    D_.hp = el('div', 'bosshp', root, '<div class="bh-name">ФИНАЛЬНЫЙ БОСС</div><div class="bh-bar"><div class="bh-fill"></div></div>');
    D_.hpFill = D_.hp.querySelector('.bh-fill');
    D_.card = heroCard(root, 'death', 'КЛАСС: ФИНАЛЬНЫЙ БОСС', '#ff2a3d');
    D_.join = servicePill(root, '<b>Death</b> вошёл в чат', 960, 160);
    D_.cat = popBubble(root, 'death', '', 1430, 520, { sticker: '🐱' });
    D_.meter = el('div', 'danger', root, '<div class="dg-l">Уровень опасности:</div><div class="dg-v">100%</div><div class="dg-bar"><div class="dg-fill"></div></div>');
    D_.dv = D_.meter.querySelector('.dg-v'); D_.df = D_.meter.querySelector('.dg-fill');
    D_.g = layer(root, 'top');
  },
  update(t, lt) {
    const [a, e] = SCENES.death, D = e - a;
    const w = whipIn(lt, 0.3, 1);
    camera(D_.cam, { x: w.x, y: 40, s: kf(lt, [[0, 0.92], [D, 1.06]], E.inOutCubic), rx: kf(lt, [[0, -8], [D, -2]]), ry: kf(lt, [[0, 6], [D, -5]]), blur: w.blur, sh: 2, t });
    D_.bd.update(t, { speed: 30 });
    clear(D_.g0);
    fog(D_.g0, t, { n: 16, y: 820, h: 400, r: 420, color: 'rgba(150,40,200,0.22)', seed: 2 });
    fog(D_.g0, t, { n: 10, y: 980, h: 200, r: 360, color: 'rgba(255,40,60,0.12)', seed: 5 });
    // boss walk out of the fog
    const wk = E.outCubic(prog(lt, 0.0, 1.6));
    const bob = Math.abs(Math.sin(lt * 7)) * 14 * (1 - prog(lt, 1.4, 1.7));
    placeFig(D_.fig, { x: 820, y: 880 - bob, z: -900 + wk * 900, o: clamp(wk * 2.5) });
    const cute = prog(lt, 2.5, 3.3);
    D_.fig._head.querySelector('.fig-av').style.filter = `saturate(${0.35 + cute * 0.65}) brightness(${0.65 + cute * 0.35})`;
    D_.rim.style.opacity = 1 - cute * 0.6;
    // phone up
    const pk = E.outBack(prog(lt, 1.9, 2.25));
    D_.phone.style.transform = `translateY(${(1 - pk) * 160}px) rotate(${(1 - pk) * 40 - 10}deg)`;
    D_.phone.style.opacity = pk;
    D_.fig._body.querySelector('.fig-arm.r').style.transform = `rotate(${-14 - pk * 60}deg)`;
    // HUD
    const hk = pop(lt, 0.3, 0.4);
    D_.hp.style.opacity = hk * (1 - prog(lt, 3.1, 3.4));
    D_.hpFill.style.width = (kf(lt, [[0.3, 0], [1.0, 100, E.outCubic]])) + '%';
    D_.card.update(lt, 0.12, 1.0);
    D_.join.update(lt, 1.05);
    D_.cat.update(lt, 2.45);
    const mk = pop(lt, 3.2, 0.3);
    D_.meter.style.opacity = mk; D_.meter.style.transform = `translate(-50%,-50%) scale(${0.6 + 0.4 * mk})`;
    const lvl = kf(lt, [[3.3, 100], [3.75, 3, E.outCubic]]);
    txt(D_.dv, lt > 3.75 ? 'мяу' : Math.round(lvl) + '%');
    D_.dv.classList.toggle('cute', lt > 3.75);
    D_.df.style.width = lvl + '%';
    D_.df.style.background = lt > 3.6 ? '#ff7ac8' : '#ff2a3d';
    clear(D_.g);
    if (lt > 3.75) burst(D_.g, t, a + 3.75, { x: 820, y: 420, n: 26, speed: 700, size: 70, shape: 'emoji', chars: ['💖', '🐾', '✨'], grav: -200, life: 1.6, seed: 4 });
  },
};

// ---------------- Антон Дуброн ----------------
const A = {};
export const anton = {
  name: 'anton', range: SCENES.anton, z: 2,
  cues: (() => { const a = SCENES.anton[0]; const n = []; for (let i = 0; i < 16; i++) n.push([a + 1.5 + i * 0.09 + hash(i) * 0.05, 'notify', 0.25 + i * 0.03]);
    return [[a, 'whip', 0.6], [a + 0.15, 'hero', 0.6], [a + 0.7, 'notify', 0.8], ...n, [a + 1.8, 'whoosh_s', 0.4], [a + 2.2, 'whoosh', 0.6], [a + 2.35, 'counter', 0.9], [a + 3.05, 'slam', 0.8], [a + 3.15, 'sad', 0.5]]; })(),
  build(root) {
    A.bd = backdrop(root, { top: '#1a1206', bottom: '#020203', floor: '#b026ff' });
    A.g0 = layer(root);
    A.cam = el('div', 'cam', root);
    A.lamp = el('div', 'anton-lamp', A.cam);
    A.chair = el('div', 'anton-chair', A.cam);
    A.fig = figure(A.cam, 'anton', { size: 230, body: '#3b2a5c', glow: '#b6ff00' });
    A.cup = emo(A.cam, '☕', 120);
    A.counter = el('div', 'unread', A.cam, '<div class="ur-l">Непрочитанных сообщений:</div><div class="ur-v">0</div>');
    A.uv = A.counter.querySelector('.ur-v');
    A.card = heroCard(root, 'anton', 'КЛАСС: ЗАШЁЛ НА 5 МИНУТ', '#b6ff00');
    A.q = popBubble(root, 'anton', 'Я просто на пять минут зашёл', 1340, 300, { cls: 'big' });
    A.cap = caption(root, 'Антон Дуброн: <b>Я вообще ничего не понял</b>', 960, 980);
    A.g = layer(root, 'top');
  },
  update(t, lt) {
    const [a, e] = SCENES.anton, D = e - a;
    const w = whipIn(lt, 0.3, 1);
    const pull = E.inOutCubic(prog(lt, 2.1, 3.0));
    camera(A.cam, { x: w.x, y: pull * -60, s: 1.08 - pull * 0.42, ry: kf(lt, [[0, -5], [D, 4]]), rx: 3 + pull * 6, blur: w.blur, sh: 2 + prog(lt, 1.5, 2.5) * 6, t });
    A.bd.update(t, { speed: 40 });
    const d = dropIn(lt, 0.2, 700);
    placeFig(A.fig, { x: 820, y: 860 + d.y, z: 0, sq: d.sq });
    A.chair.style.transform = `translate3d(0,0,-40px)`;
    // the cup leaves his hand and hangs in the air
    const ck = E.inOutCubic(prog(lt, 1.7, 2.6));
    const cx = 1010 + ck * 60, cy = 560 - ck * 260 + Math.sin(lt * 3) * 12 * ck;
    A.cup.style.transform = `translate(${cx}px, ${cy}px) rotate(${ck * 28 + Math.sin(lt * 2) * 6 * ck}deg)`;
    A.lamp.style.opacity = 1 - prog(lt, 1.5, 2.4) * 0.7;
    // counter grows in the background as the camera pulls back
    const uk = pop(lt, 2.3, 0.4);
    A.counter.style.opacity = uk;
    A.counter.style.transform = `translate3d(-50%, 0, -700px) scale(${0.5 + uk * 0.5})`;
    const n = Math.floor(kf(lt, [[2.35, 0], [2.95, 9999, E.outCubic]]));
    txt(A.uv, lt > 2.95 ? '9999+' : fmt(n));
    A.card.update(lt, 0.12, 1.0);
    A.q.update(lt, 0.7, 2.2);
    A.cap.update(lt, 3.05, D + 1);
    clear(A.g0); clear(A.g);
    const sk = prog(lt, 1.4, 2.4);
    noteSwarm(A.g, t, { x: 960, y: 560, r: 520 + pull * 200, k: sk, n: 140, seed: 3, spin: 1.2 });
  },
};
