// 5. Хаос набирает обороты: Даша вкид, Даня Круглый, Вася Флеш, sckal’pel’.
import { el, tf, kf, E, pop, prog, clamp, hash, txt, fmt } from '../core.js';
import { figure, emo, bubble } from '../ui.js';
import { layer, clear, burst, noteSwarm, speedLines, flame } from '../fx.js';
import { SCENES, b, MEMBERS as ALL } from '../data.js';
import { POST } from '../post.js';
import { backdrop, heroCard, whipIn, caption, popBubble, camera, placeFig, dropIn } from './common.js';

export const CHATTER = ['ну и?', 'а ты кто', 'это база', 'не согласен', 'спорим?', '😂😂😂', 'кто админ?', 'так я и сказал', 'пруфы?', 'сам такой',
  'ахахах', 'вот именно', 'стоп что', 'а при чём тут это', 'не понял', 'ну начинается', 'лол', 'я ушёл', 'вернулся', 'кто звал?'];
const pickM = i => ALL[Math.floor(hash(i * 3.3) * 54)];

// ---------------- Даша вкид ♛ ----------------
const T_THINK = b(14.92), T_PRESS = b(15.5), T_LAUNCH = b(15.9);
const Q = {};
export const dasha = {
  name: 'dasha', range: SCENES.dasha, z: 2,
  cues: (() => { const a = SCENES.dasha[0]; const n = []; for (let i = 0; i < 22; i++) n.push([T_PRESS + 0.1 + i * 0.06 + hash(i + 3) * 0.04, 'notify', 0.2 + (i % 4) * 0.05]);
    return [[a, 'whip', 0.6], [a + 0.15, 'hero', 0.6], [T_THINK, 'hmm', 0.8], [T_THINK + 0.3, 'tension', 0.45], [T_PRESS - 0.02, 'bigbutton', 1.0], [T_PRESS, 'boom', 0.7], [T_PRESS + 0.05, 'send', 0.9], ...n,
      [T_PRESS + 0.2, 'counter', 0.8], [T_LAUNCH, 'slam', 0.8]]; })(),
  build(root) {
    Q.bd = backdrop(root, { top: '#2a0612', floor: '#ff2a3d' });
    Q.cam = el('div', 'cam', root);
    Q.ped = el('div', 'redped', Q.cam, '<div class="rb-cap"></div><div class="rb-lbl">НЕ НАЖИМАТЬ</div>');
    Q.cap = Q.ped.querySelector('.rb-cap');
    Q.fig = figure(Q.cam, 'dasha', { size: 230, body: '#5a0a2a', glow: '#ff7ac8' });
    Q.crown = emo(Q.fig._props, '👑', 110); Q.crown.style.left = '60px'; Q.crown.style.top = '-60px';
    Q.card = heroCard(root, 'dasha', 'КЛАСС: ВКИДЫВАЕТ ТЕМЫ', '#ff7ac8');
    Q.think = el('div', 'thought', root, 'А что, если…');
    Q.q = popBubble(root, 'dasha', 'У меня есть один вопрос…', 960, 200, { cls: 'big' });
    Q.ctr = el('div', 'msgctr', root, '<div class="mc-l">сообщений</div><div class="mc-v">0</div>');
    Q.cv = Q.ctr.querySelector('.mc-v');
    Q.cap2 = caption(root, 'Запущено обсуждение, <b>которое никто не просил</b>', 960, 980, 'red');
    Q.g = layer(root, 'top');
  },
  update(t, lt) {
    const [a, e] = SCENES.dasha, D = e - a;
    const w = whipIn(lt, 0.3, 1);
    const tense = prog(t, T_THINK, T_PRESS), hit = t > T_PRESS ? Math.exp(-(t - T_PRESS) * 3) : 0;
    camera(Q.cam, { x: w.x + tense * 160, y: tense * 120, s: 1 + tense * 0.35 - (t > T_PRESS ? E.outCubic(prog(t, T_PRESS, T_PRESS + 0.4)) * 0.4 : 0), ry: kf(lt, [[0, -6], [D, 6]]), blur: w.blur,
      sh: 2 + hit * 30 + (t > T_PRESS ? 6 : 0), t });
    POST.vignette = 1 + tense * 0.8 * (t < T_PRESS ? 1 : 0);
    Q.bd.update(t, { speed: t > T_PRESS ? 300 : 60 });
    const d = dropIn(lt, 0.2, 700);
    placeFig(Q.fig, { x: 720, y: 880 + d.y, sq: d.sq, rz: t > T_PRESS - 0.1 && t < T_PRESS + 0.2 ? 8 : 0 });
    Q.fig._body.querySelector('.fig-arm.r').style.transform = `rotate(${t > T_PRESS - 0.1 && t < T_PRESS + 0.25 ? -95 : -14 - tense * 40}deg)`;
    Q.ped.style.transform = `translate3d(0,0,40px)`;
    Q.cap.classList.toggle('down', t > T_PRESS - 0.03 && t < T_PRESS + 0.25);
    Q.card.update(lt, 0.12, 0.95);
    const tk = pop(t, T_THINK, 0.4);
    Q.think.style.opacity = tk * (1 - prog(t, T_PRESS - 0.1, T_PRESS));
    Q.think.style.transform = `translate(-50%,-50%) scale(${0.6 + tk * 0.4 + tense * 0.1})`;
    Q.q.update(t - a, T_PRESS + 0.05 - a, D + 1);
    const ck = pop(t, T_PRESS + 0.15, 0.3);
    Q.ctr.style.opacity = ck;
    Q.ctr.style.transform = `scale(${ck}) rotate(${(1 - ck) * 30}deg)`;
    const n = Math.floor(Math.pow(prog(t, T_PRESS + 0.15, e), 1.6) * 48000 + hash(Math.floor(t * 30)) * 99 * (t > T_PRESS ? 1 : 0));
    txt(Q.cv, fmt(n));
    Q.cap2.update(t - a, T_LAUNCH - a, D + 1);
    clear(Q.g);
    if (t > T_PRESS) {
      noteSwarm(Q.g, t, { x: 960, y: 540, r: 600, k: prog(t, T_PRESS, T_PRESS + 0.6), n: 220, seed: 7, spin: 2 });
      POST.flash = Math.max(0, 0.5 - (t - T_PRESS) * 3); POST.flashColor = '#ff2a3d';
    }
  },
};

// ---------------- Даня Круглый ----------------
const F = {};
const FLOORS = 17;
export const danya = {
  name: 'danya', range: SCENES.danya, z: 2,
  cues: (() => { const a = SCENES.danya[0]; const n = []; for (let i = 0; i < FLOORS; i++) n.push([a + 0.25 + i * 0.075, 'stack', 0.45]);
    return [[a - 0.05, 'whip', 0.6], ...n, [a + 1.55, 'clank', 0.9], [a + 1.6, 'neon', 0.7], [a + 1.75, 'slam', 0.8], [a + 2.2, 'creak', 0.7]]; })(),
  build(root) {
    F.bd = backdrop(root, { top: '#1a1406', floor: '#ffd400', wall: false });
    F.cam = el('div', 'cam', root);
    F.bld = el('div', 'bld', F.cam);
    F.floors = [];
    for (let i = 0; i < FLOORS; i++) {
      const f = el('div', 'bld-floor', F.bld);
      for (let j = 0; j < 3; j++) el('div', 'bld-win' + ((i + j) % 3 === 1 ? ' out' : ''), f, `<i></i><i style="width:${40 + ((i * 7 + j * 5) % 45)}%"></i>`);
      el('span', 'bld-no', f, String(i + 1));
      F.floors.push(f);
    }
    F.sign = el('div', 'bld-sign', F.bld, 'ЖК «БЕСКОНЕЧНЫЙ СРАЧ»');
    F.crane = el('div', 'crane', F.cam, '<div class="cr-mast"></div><div class="cr-jib"></div><div class="cr-cab"></div>');
    F.cable = el('div', 'cr-cable', F.crane);
    F.load = bubble(F.crane, pickM(5), 'последнее слово', {}); F.load.classList.add('cr-load');
    F.fig = figure(F.cam, 'danyak', { size: 210, body: '#5a4a0a', glow: '#ffd400' });
    F.hat = emo(F.fig._props, '⛑️', 150); F.hat.style.left = '30px'; F.hat.style.top = '-80px';
    F.plan = emo(F.fig._props, '📐', 110); F.plan.style.left = '190px'; F.plan.style.top = '300px';
    F.cap = caption(root, 'Даня Круглый:<br><b>Построил 17 этажей<br>обсуждения за один вечер</b>', 1420, 860);
    F.cap.el.style.textAlign = 'left';
  },
  update(t, lt) {
    const [a, e] = SCENES.danya, D = e - a;
    const w = whipIn(lt, 0.25, 1);
    const tilt = E.inOutCubic(prog(lt, 0.2, 1.6));
    camera(F.cam, { x: w.x, y: 60 + tilt * 100, s: kf(lt, [[0, 0.76], [D, 0.7]]), rx: kf(lt, [[0, 8], [D, 2]]), ry: kf(lt, [[0, 10], [D, -8]], E.inOutCubic), blur: w.blur, sh: 2 + (lt > 2.2 ? 4 : 0), t });
    F.bd.update(t, { speed: 30 });
    F.floors.forEach((f, i) => {
      const k = E.outBack(prog(lt, 0.25 + i * 0.075, 0.45 + i * 0.075));
      f.style.transform = `translateY(${(1 - k) * -300}px) scale(${k})`; f.style.opacity = clamp(k * 2);
    });
    const sw = lt > 2.0 ? Math.sin((lt - 2.0) * 9) * 2.6 * prog(lt, 2.0, 2.3) : 0;
    F.bld.style.transform = `translateX(-50%) skewX(${sw.toFixed(2)}deg)`;
    const sk = pop(lt, 1.6, 0.3);
    F.sign.style.opacity = sk * (Math.floor(lt * 14) % 7 === 0 && lt < 2.0 ? 0.4 : 1);
    F.sign.style.transform = `translateX(-50%) scale(${sk})`;
    // crane: hook carries the last message to the roof
    const hk = E.inOutCubic(prog(lt, 0.3, 1.55));
    F.cable.style.height = (120 + hk * 300) + 'px';
    F.load.style.transform = `translate(-50%, ${hk * 300}px) rotate(${Math.sin(lt * 4) * 6 * (1 - hk)}deg)`;
    F.load.style.opacity = lt < 1.6 ? 1 : 0;
    placeFig(F.fig, { x: 470, y: 1060, z: 200, s: 1.25 });
    F.cap.update(lt, 1.75, D + 1, -2);
  },
};

// ---------------- Вася Флеш ----------------
const V = {};
export const vasya = {
  name: 'vasya', range: SCENES.vasya, z: 2,
  cues: (() => { const a = SCENES.vasya[0]; return [[a - 0.05, 'whip', 0.5], [a + 0.15, 'zoom', 1.0], [a + 0.85, 'zoom', 0.9], [a + 1.25, 'slam', 0.7], [a + 2.0, 'sad', 0.6]]; })(),
  build(root) {
    V.bd = backdrop(root, { top: '#1a0a02', floor: '#ff7a00', wall: false });
    V.g0 = layer(root);
    V.cam = el('div', 'cam', root);
    V.msgs = [];
    for (let i = 0; i < 14; i++) {
      const m = bubble(V.cam, pickM(i + 20), CHATTER[i % CHATTER.length], { out: i % 4 === 2 });
      m.classList.add('vas-msg'); m._x = 120 + (i % 7) * 260; m._y = 180 + Math.floor(i / 7) * 520 + (i % 2) * 120;
      V.msgs.push(m);
    }
    V.fig = figure(V.cam, 'vasya', { size: 220, body: '#8a1a00', glow: '#ffb000' });
    V.bolt = emo(V.fig._props, '⚡', 120); V.bolt.style.left = '150px'; V.bolt.style.top = '-60px';
    V.what = emo(V.fig._props, '❓', 140); V.what.style.left = '40px'; V.what.style.top = '-200px';
    V.c1 = caption(root, 'Вася Флеш <b>прочитал всё</b> ✓✓', 960, 140);
    V.c2 = caption(root, 'Но ничего <b>не запомнил</b>', 960, 980, 'violet');
    V.g = layer(root, 'top');
  },
  update(t, lt) {
    const [a, e] = SCENES.vasya, D = e - a;
    camera(V.cam, { s: 1, ry: kf(lt, [[0, -4], [D, 4]]), sh: 2 + (lt < 1.3 ? 8 : 0), t });
    V.bd.update(t, { speed: 80 });
    // path: left -> right (0.15..0.6), right -> left (0.85..1.25), stop centre
    const p1 = E.inOutQuad(prog(lt, 0.15, 0.6)), p2 = E.inOutQuad(prog(lt, 0.85, 1.25));
    const x = lt < 0.85 ? -300 + p1 * 2500 : 2200 - p2 * 1240;
    const lean = lt < 0.6 ? 18 : lt < 0.85 ? 0 : lt < 1.25 ? -18 : 0;
    placeFig(V.fig, { x, y: 900, rz: lean, sq: lt > 1.25 ? Math.exp(-(lt - 1.25) * 8) * Math.sin((lt - 1.25) * 30) * 0.12 : 0 });
    V.msgs.forEach((m, i) => {
      const passA = clamp((x - m._x) / 300), flut = Math.sin(lt * 20 + i) * 8 * (lt < 1.4 ? 1 : 0);
      m.style.transform = `translate(${m._x}px, ${m._y + flut}px) rotate(${(lt < 1.4 ? Math.sin(lt * 14 + i) * 6 : 0).toFixed(1)}deg)`;
      m.classList.toggle('read', lt > 0.15 + (m._x / 2500) * 0.45);
    });
    V.what.style.opacity = lt > 1.95 ? 1 : 0;
    V.what.style.transform = `scale(${pop(lt, 1.95, 0.3)}) rotate(${Math.sin(lt * 5) * 10}deg)`;
    V.c1.update(lt, 1.25, D + 1, -2);
    V.c2.update(lt, 2.0, D + 1, 2);
    clear(V.g0); clear(V.g);
    const trail = [];
    if (lt > 0.1 && lt < 1.45) {
      for (let k = 0; k < 14; k++) {
        const tt = lt - k * 0.025;
        const q1 = E.inOutQuad(prog(tt, 0.15, 0.6)), q2 = E.inOutQuad(prog(tt, 0.85, 1.25));
        const xx = tt < 0.85 ? -300 + q1 * 2500 : 2200 - q2 * 1240;
        trail.unshift({ x: xx, y: 800 + Math.sin(k) * 10 });
      }
      flame(V.g0, t, trail, { size: 110 });
      speedLines(V.g, t, { n: 50, speed: 6000, dir: lt < 0.85 ? -1 : 1, color: 'rgba(255,190,80,0.7)', seed: 6 });
    }
  },
};

// ---------------- sckal’pel’ ----------------
const C = {};
export const scalpel = {
  name: 'scalpel', range: SCENES.scalpel, z: 2,
  cues: (() => { const a = SCENES.scalpel[0]; return [[a - 0.05, 'whip', 0.5], [a + 0.45, 'snip', 1.0], [a + 0.55, 'snip', 0.8], [a + 0.95, 'notify', 0.8], [a + 1.8, 'pop', 0.8], [a + 1.95, 'stretch', 0.9], [a + 2.25, 'slam', 0.6]]; })(),
  build(root) {
    C.bd = backdrop(root, { top: '#06101e', floor: '#00c8ff', wall: false });
    C.cam = el('div', 'cam', root);
    C.top = el('div', 'feed', C.cam); C.bot = el('div', 'feed', C.cam);
    for (let i = 0; i < 16; i++) { const m = bubble(i < 8 ? C.top : C.bot, pickM(i + 40), CHATTER[(i * 3) % CHATTER.length], { out: i % 3 === 1 }); m.classList.add('fd-msg'); }
    C.ext = el('div', 'feed ext', C.cam);
    for (let i = 0; i < 16; i++) { const m = bubble(C.ext, pickM(i + 70), CHATTER[(i * 7 + 2) % CHATTER.length], { out: i % 3 === 2 }); m.classList.add('fd-msg'); }
    C.why = bubble(C.cam, pickM(91), 'А почему?', {}); C.why.classList.add('why');
    C.cut = el('div', 'cutline', C.cam);
    C.sc = emo(root, '✂️', 360);
    C.fig = figure(C.cam, 'scalpel', { size: 200, body: '#0a3a4a', glow: '#00c8ff' });
    C.say = popBubble(root, 'scalpel', 'Хватит спорить', 1480, 300, { cls: 'big' });
    C.len = el('div', 'lenmeter', root, '<div class="lm-l">Длина переписки</div><div class="lm-v">×2</div>');
  },
  update(t, lt) {
    const [a, e] = SCENES.scalpel, D = e - a;
    const pull = E.inOutCubic(prog(lt, 1.9, 2.5));
    camera(C.cam, { x: -pull * 200, s: 1 - pull * 0.55, ry: kf(lt, [[0, 6], [D, -6]]), rx: 4, sh: 2 + (lt > 0.45 && lt < 0.8 ? 12 : 0), t });
    C.bd.update(t, { speed: 70 });
    const split = E.outCubic(prog(lt, 0.5, 0.9));
    const scroll = lt * 60;
    C.top.style.transform = `translate(-50%, ${(-scroll - split * 120 - 660).toFixed(1)}px)`;
    C.bot.style.transform = `translate(-50%, ${(-scroll + split * 120 + 60).toFixed(1)}px)`;
    const ex = E.outCubic(prog(lt, 1.95, 2.6));
    C.ext.style.transform = `translate(-50%, ${(-scroll + split * 120 + 60 + 1500).toFixed(1)}px) scaleY(${ex})`;
    C.ext.style.opacity = ex;
    C.why.style.opacity = pop(lt, 1.8, 0.3);
    C.why.style.transform = `translate(-50%, -50%) scale(${pop(lt, 1.8, 0.3) * 1.3})`;
    C.cut.style.opacity = lt > 0.45 && lt < 1.0 ? 1 - prog(lt, 0.7, 1.0) : 0;
    C.cut.style.transform = `translate(-50%,-50%) scaleX(${E.outCubic(prog(lt, 0.42, 0.6))})`;
    // scissors sweep across the middle
    const sk = E.inOutCubic(prog(lt, 0.25, 0.75));
    const snap = Math.abs(Math.sin(lt * 26)) * (lt > 0.3 && lt < 0.75 ? 1 : 0);
    C.sc.style.transform = `translate(${-500 + sk * 2400}px, ${540 - 180}px) rotate(${-90 + snap * 14}deg)`;
    C.sc.style.opacity = lt > 0.2 && lt < 0.8 ? 1 : 0;
    placeFig(C.fig, { x: 330, y: 960, z: 200 });
    C.say.update(lt, 0.95, 1.85);
    const lk = pop(lt, 2.25, 0.3);
    C.len.style.opacity = lk; C.len.style.transform = `translate(-50%,-50%) scale(${0.5 + lk * 0.5})`;
  },
};
