// 8. Все участники — часть одной вселенной; 9. Кульминация — последний день адекватности.
import { el, tf, kf, E, pop, prog, clamp, hash, txt, fmt } from '../core.js';
import { card, figure, win, bubble, avatar } from '../ui.js';
import { layer, clear, stars, burst, speedLines, noteSwarm } from '../fx.js';
import { SCENES, MEMBERS, BEAT, B0, byId } from '../data.js';
import { POST } from '../post.js';
import { camera, caption, popBubble, placeFig } from './common.js';

// groups of the 61 nicknames (order mixes the symbol-only nicks in)
const ORDER = MEMBERS.map(m => m.id);
const GROUPS = [0, 10, 20, 30, 40, 50, 61].slice(0, -1).map((s, i, arr) => ORDER.slice(s, i === arr.length - 1 ? 61 : arr[i + 1]));
const [M0_, M1_] = SCENES.members;
const GT = i => M0_ + 0.55 + i * 1.55;        // group i in focus
const GAP = 2200;
// cloud position for card i (shared by the members finale and the frozen climax)
export function cloudPos(i) {
  const a = hash(i * 1.7) * Math.PI * 2, r = 380 + hash(i * 2.3) * 520, y = (hash(i * 3.1) - 0.5) * 760;
  return { x: Math.cos(a) * r * 1.5, y, z: Math.sin(a) * r - 300, ry: (hash(i * 5.3) - 0.5) * 60, rz: (hash(i * 4.1) - 0.5) * 20 };
}
const M = {};
export const members = {
  name: 'members', range: SCENES.members, z: 2,
  cues: [[M0_, 'whoosh', 0.7], [M0_ + 0.1, 'hero', 0.5], ...GROUPS.map((g, i) => [GT(i) - 0.5, 'whoosh_s', 0.6]), ...GROUPS.flatMap((g, i) => g.map((id, j) => [GT(i) - 0.38 + j * 0.035, 'tick', 0.18])),
    [M1_ - 0.9, 'riser', 0.8]],
  build(root) {
    M.g0 = layer(root);
    M.title = el('div', 'uni-title title', root, '62 УЧАСТНИКА — <span>ОДНА ВСЕЛЕННАЯ</span>');
    M.cam = el('div', 'cam', root);
    M.layers = GROUPS.map((g, gi) => {
      const L = el('div', 'layer3d', M.cam);
      const n = g.length, perRow = Math.ceil(n / 2);
      const cards = g.map((id, j) => {
        const c = card(L, byId[id]);
        const row = j < perRow ? 0 : 1, col = row ? j - perRow : j, cnt = row ? n - perRow : perRow;
        c._x = 960 - 150 + (col - (cnt - 1) / 2) * 340; c._y = 540 - 165 + (row ? 190 : -190);
        c._i = ORDER.indexOf(id);
        return c;
      });
      return { L, cards, gi };
    });
    M.g = layer(root, 'top');
  },
  update(t, lt) {
    const D = M1_ - M0_;
    clear(M.g0); clear(M.g);
    stars(M.g0, t, { n: 320, speed: 0.5, alpha: 0.8 });
    // camera dolly: hold on each group, glide between them
    let camZ = 0;
    for (let i = 1; i < GROUPS.length; i++) camZ += E.inOutCubic(prog(t, GT(i) - 0.55, GT(i) - 0.05)) * GAP;
    const cloud = E.inOutCubic(prog(t, M1_ - 1.0, M1_ - 0.1));
    camera(M.cam, { rx: Math.sin(t * 0.7) * 3, ry: Math.sin(t * 0.5) * 6 + cloud * 10, s: 1 - cloud * 0.35, sh: 1.5, t });
    M.layers.forEach(({ L, cards, gi }) => {
      const z = -gi * GAP + camZ;
      const vis = z > -2 * GAP && z < 1200;
      L.style.display = vis || cloud > 0 ? '' : 'none';
      cards.forEach((c, j) => {
        const k = E.outBack(prog(t, GT(gi) - 0.45 + j * 0.035, GT(gi) - 0.05 + j * 0.035));
        const wob = Math.sin(t * 2 + j) * 6;
        const cp = cloudPos(c._i);
        const x = c._x + cp.x * cloud, y = c._y + (1 - k) * 200 + cp.y * cloud, zz = z * (1 - cloud) + (1 - k) * -600 + cp.z * cloud;
        c.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${zz.toFixed(1)}px) rotateY(${(wob + (1 - k) * 70 + cp.ry * cloud).toFixed(1)}deg) rotateZ(${(cp.rz * cloud).toFixed(1)}deg) scale(${(1 - cloud * 0.45).toFixed(3)})`;
        c.style.opacity = clamp(k * 2) * (z > 900 && cloud === 0 ? clamp(1 - (z - 900) / 300) : 1);
      });
    });
    const tk = pop(t, M0_ + 0.05, 0.35);
    M.title.style.opacity = tk * (1 - prog(t, GT(0) - 0.2, GT(0) + 0.1));
    M.title.style.transform = `translate(-50%,-50%) scale(${0.6 + tk * 0.4})`;
  },
};

// ---------------- climax ----------------
const [C0, C1] = SCENES.climax;
const CT = { warn: C0 + 0.35, c1: C0 + 1.15, c2: C0 + 1.55, c3: C0 + 1.95, ask: C0 + 2.7, flood: C0 + 3.3, spin: C0 + 4.3, bunker: C0 + 4.55, press: C0 + 5.25, err: C0 + 5.6, implode: C0 + 6.55 };
const REPLIES = [['kevin', 'Ничего.'], ['mila', 'А ты?'], ['arina', 'А что случилось?'], ['grab', 'Кто кого звал?'], ['dema', 'Опять начинается'],
  ['sharpilov', 'Я вообще спать собирался'], ['weak', 'Скиньте мем'], ['mqkk', 'А кто админ?'], ['celestiana', 'Где я?'], ['hik', 'АХАХАХА']];
const RPOS = [[330, 170], [1560, 210], [290, 440], [1620, 470], [420, 720], [1500, 760], [760, 140], [1180, 120], [700, 930], [1240, 950]];
const X = {};
export const climax = {
  name: 'climax', range: SCENES.climax, z: 3,
  cues: [[C0, 'freeze', 0.9], [CT.warn, 'alarm', 1.0], [CT.c1, 'tick', 0.8], [CT.c2, 'tick', 0.8], [CT.c3, 'tick', 0.8], [CT.ask - 0.05, 'notify', 1.0],
    ...REPLIES.map((r, i) => [CT.flood + i * 0.1, 'notify', 0.5 + (i % 3) * 0.12]), [CT.flood + 0.5, 'counter', 0.8], [CT.spin, 'riser', 0.9], [CT.spin + 0.1, 'spin', 0.8],
    [CT.bunker, 'whoosh', 0.8], [CT.press - 0.03, 'bigbutton', 1.0], [CT.err, 'crit', 1.0], [CT.err + 0.05, 'glitch', 0.7], [CT.implode, 'implode', 1.0]],
  build(root) {
    X.g0 = layer(root);
    X.cam = el('div', 'cam', root);
    X.cards = ORDER.map((id, i) => { const c = card(X.cam, byId[id], false); c._p = cloudPos(i); c._x = 960 - 150; c._y = 540 - 165; return c; });
    X.hang = [['senya', 'перезагрузите меня'], ['dasha', 'вопрос всё ещё в силе'], ['satoshi', 'купил мем'], ['vedma', '✶ ☾ ✷']].map(([id, tx], i) => {
      const bb = bubble(X.cam, id, tx); bb.style.left = [180, 1300, 260, 1380][i] + 'px'; bb.style.top = [120, 140, 860, 880][i] + 'px'; return bb;
    });
    X.red = el('div', 'alarm-red', root);
    X.warn = win(root, 'ВНИМАНИЕ!', '<div class="w-big">ВНИМАНИЕ!</div>Обнаружена попытка<br>начать нормальный разговор<div class="checks"><div>Проверка пользователей… <b></b></div><div>Проверка сообщений… <b></b></div><div>Поиск серьёзного обсуждения… <b></b></div></div>', { buttons: [], icon: '!', cls: 'err red warnwin' });
    X.checks = [...X.warn.querySelectorAll('.checks div')];
    X.ask = popBubble(root, 'junior', 'Чё делаете?', 960, 540, { cls: 'big askb' });
    X.rep = REPLIES.map(([id, tx], i) => popBubble(root, id, tx, RPOS[i][0], RPOS[i][1]));
    X.unread = el('div', 'unread2', root, '<small>непрочитанных</small><b>0</b>');
    X.uv = X.unread.querySelector('b');
    X.bunker = figure(root, 'bunker', { size: 200, body: '#0f3a6b', glow: '#39ff14' });
    el('div', 'admin-badge', X.bunker._props, 'ADMIN');
    X.btn = el('div', 'stopbtn', root, 'ОСТАНОВИТЬ ХАОС');
    X.err = win(root, 'SWAG_ZOV_NEFOR.exe', 'Ошибка.<br><b>Хаос является основной<br>функцией приложения.</b>', { buttons: ['Понятно'], icon: '✕', cls: 'err red' });
    X.g = layer(root, 'top');
  },
  update(t, lt) {
    clear(X.g0); clear(X.g);
    stars(X.g0, t, { n: 300, speed: lt < 4.3 ? 0.02 : 0.02 + prog(t, CT.spin, CT.implode) * 4, alpha: 0.7 });
    const spin = E.inCubic(prog(t, CT.spin, C1)), imp = E.inExpo(prog(t, CT.implode, C1 - 0.05));
    camera(X.cam, { ry: 10 + spin * 260, rz: spin * 70, rx: spin * 20, s: (0.65 + Math.sin(lt * 0.3) * 0.005) * (1 - imp * 0.9), sh: lt < 0.35 ? 0 : 2 + spin * 12, t });
    // frozen: cards hold still and slowly desaturate; then fly outward
    const out = E.inCubic(prog(t, CT.spin, CT.implode));
    X.cards.forEach((c, i) => {
      const p = c._p, f = 1 + out * 2.5;
      c.style.transform = `translate3d(${(c._x + p.x * f).toFixed(1)}px, ${(c._y + p.y * f).toFixed(1)}px, ${(p.z * f).toFixed(1)}px) rotateY(${(p.ry + out * 200 * (i % 2 ? 1 : -1)).toFixed(1)}deg) rotateZ(${p.rz.toFixed(1)}deg) scale(0.55)`;
    });
    X.cam.style.filter = lt < 4.3 ? `saturate(${1 - prog(lt, 0, 0.4) * 0.6})` : 'none';
    X.hang.forEach((h, i) => { h.style.transform = `translateZ(300px) rotate(${(i % 2 ? 4 : -4)}deg)`; h.style.opacity = 1 - prog(t, CT.spin, CT.spin + 0.3); });
    // alarm
    const wk = pop(t, CT.warn, 0.3), wo = prog(t, CT.ask - 0.25, CT.ask);
    X.warn.style.opacity = wk * (1 - wo); X.warn.style.transform = `translate(-50%,-50%) scale(${(0.6 + wk * 0.4) * (1 - wo * 0.3)})`;
    X.red.style.opacity = t > CT.warn && t < CT.ask ? (0.35 + 0.25 * Math.sin((t - CT.warn) * 14)) : 0;
    [CT.c1, CT.c2, CT.c3].forEach((ct, i) => {
      X.checks[i].style.opacity = t > ct ? 1 : 0;
      txt(X.checks[i].querySelector('b'), t < ct + 0.3 ? '◐◓◑◒'[Math.floor(t * 12) % 4] : i < 2 ? 'подозрительно' : 'НЕ НАЙДЕНО');
      X.checks[i].querySelector('b').className = t < ct + 0.3 ? '' : i < 2 ? 'warn' : 'bad';
    });
    X.ask.update(t - C0, CT.ask - C0, CT.spin + 0.3 - C0);
    X.rep.forEach((r, i) => r.update(t - C0, CT.flood - C0 + i * 0.1, CT.spin + 0.25 - C0));
    const uk = pop(t, CT.flood + 0.3, 0.3);
    X.unread.style.opacity = uk * (1 - prog(t, CT.spin + 0.2, CT.spin + 0.4));
    const nv = Math.pow(prog(t, CT.flood + 0.3, CT.spin), 3) * 999999999;
    txt(X.uv, t > CT.spin - 0.15 ? '∞' : fmt(Math.floor(nv)));
    // BunkerRP with the stop button
    const bk = E.outBack(prog(t, CT.bunker, CT.bunker + 0.4));
    placeFig(X.bunker, { x: 720, y: 980, s: bk, o: t > CT.bunker && t < CT.implode + 0.2 ? 1 - imp : 0 });
    X.bunker._body.querySelector('.fig-arm.r').style.transform = `rotate(${t > CT.press - 0.1 && t < CT.press + 0.2 ? -100 : -14}deg)`;
    const btk = pop(t, CT.bunker + 0.2, 0.3);
    X.btn.style.opacity = btk * (1 - imp); X.btn.classList.toggle('down', t > CT.press && t < CT.press + 0.2);
    X.btn.style.transform = `translate(-50%,-50%) scale(${btk * (t > CT.press && t < CT.press + 0.2 ? 0.92 : 1)})`;
    const ek = pop(t, CT.err, 0.25);
    const ex = t > CT.err ? Math.sin(t * 60) * 12 * Math.exp(-(t - CT.err) * 4) : 0;
    X.err.style.opacity = ek * (1 - imp); X.err.style.transform = `translate(-50%,-50%) translateX(${ex}px) scale(${ek * (1 - imp)})`;
    X.err.classList.toggle('rgb', t > CT.err && t < CT.err + 0.3);
    if (t > CT.spin) { noteSwarm(X.g, t, { x: 960, y: 540, r: 700 * (1 - imp), k: 1 - imp, n: 160, spin: 4, seed: 12 }); speedLines(X.g, t, { radial: true, x: 960, y: 540, n: 70, alpha: 0.5 + imp * 0.5, seed: 3 }); }
    if (t > C1 - 0.12) { POST.flash = prog(t, C1 - 0.12, C1); POST.flashColor = '#ffffff'; }
    if (t > CT.err && t < CT.err + 0.15) { POST.flash = 0.35; POST.flashColor = '#ff2a3d'; }
  },
};
