// 10. Эпичный финал: сфера из аватаров, три фразы под удары, «успешно установлено», ВОЙТИ В ЧАТ, хвост с двумя сообщениями.
import { el, tf, kf, E, pop, prog, clamp, hash, letters } from '../core.js';
import { avatar, nick, cursor, toast, bubble, ASSETS } from '../ui.js';
import { layer, clear, stars, burst } from '../fx.js';
import { SCENES, MEMBERS, bb, B0, MUSIC_END, DUR } from '../data.js';
import { POST } from '../post.js';
import { camera } from './common.js';

const T = { title: bb(2), p1: bb(3), p2: bb(4), p3: bb(5), line: bb(6), inst: bb(6.5), click: bb(7.25), glow: bb(7.3), last: bb(7.75),
  end: MUSIC_END, m1: 117.55, m2: 118.7, ding: 119.62, cut: 119.7 };
const PHRASES = ['ЗДЕСЬ МОЖНО ОБСУЖДАТЬ <b>ЧТО УГОДНО</b>', 'ЗДЕСЬ КАЖДЫЙ <b>ПО-СВОЕМУ ЛЕГЕНДА</b>', 'ЗДЕСЬ НОРМАЛЬНОСТЬ <b>НЕ ПРОХОДИТ ПРОВЕРКУ</b>'];
const REACT = ['🔥', '😂', '👍', '❤️', '🤡', '💀', '🤯', '🗿', '😭', '💯', '👀', '🎉', '🫡', '🤝'];
const F = {};
export const finale = {
  name: 'finale', range: SCENES.finale, z: 2,
  cues: [[B0, 'mega', 1.0], [B0 + 0.1, 'whoosh', 0.6], [B0 + 0.6, 'riser_s', 0.5], [T.title, 'slam', 1.0], [T.title + 0.05, 'shine', 0.6],
    [T.p1, 'slam2', 0.8], [T.p2, 'slam2', 0.8], [T.p3, 'slam2', 0.8], [T.line, 'blip2', 0.7], [T.inst, 'install', 0.9], [T.inst + 0.35, 'popup', 0.6],
    [T.click, 'click', 1.0], [T.glow, 'riser_s', 0.6], [T.last, 'slam', 1.0], [T.end, 'final', 1.0],
    [T.m1, 'notify', 0.9], [T.m2, 'notify', 0.9], [T.ding, 'ding', 0.75]],
  build(root) {
    F.g0 = layer(root);
    F.cam = el('div', 'cam', root);
    F.sphere = el('div', 'sphere', F.cam);
    const n = MEMBERS.length + 1;
    F.nodes = [...MEMBERS, null].map((m, i) => {
      // Fibonacci sphere distribution
      const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      const nd = el('div', 'snode', F.sphere);
      if (m) avatar(m, 104, nd); else { const g = el('div', 'av snode-logo', nd); g.style.width = g.style.height = '104px'; if (ASSETS.logo) g.style.backgroundImage = 'url(assets/logo.jpg)'; else g.textContent = '62'; }
      nd._lon = Math.atan2(r * Math.sin(th), r * Math.cos(th)) * 180 / Math.PI; nd._lat = Math.asin(y) * 180 / Math.PI;
      nd._fx = (hash(i * 3.3) - 0.5) * 5000; nd._fy = (hash(i * 4.4) - 0.5) * 3000; nd._fz = -3000 + hash(i * 5.5) * 5000;
      return nd;
    });
    F.core = el('div', 'score', F.sphere);
    F.ring = el('div', 'rring', F.cam);
    F.reacts = REACT.map((r, i) => { const e = el('div', 'emo rr', F.ring, r); e.style.fontSize = '84px'; return e; });
    F.title = el('div', 'fin-title title', F.cam);
    F.ch = [...letters(F.title, 'SWAG_ZOV_NEFOR'), ...letters(F.title, '.exe', 'ch exe')];
    F.ph = PHRASES.map(p => el('div', 'fin-ph', root, p));
    F.line = el('div', 'fin-line', root, '<b>62</b> участника. <b>21</b> в сети. <b>0</b> причин скучать.');
    F.inst = toast(root, '✓', 'Приложение <b class="g">SWAG_ZOV_NEFOR.exe</b> успешно установлено', 'inst');
    F.btn = el('div', 'enter-btn', root, 'ВОЙТИ В ЧАТ');
    F.cur = cursor(root);
    F.green = el('div', 'fin-green', root);
    F.last = el('div', 'fin-last title', root, 'ЗАШЁЛ НА ПЯТЬ МИНУТ —<br><span>ОСТАЛСЯ НАВСЕГДА</span>');
    F.black = el('div', 'fin-black', root);
    F.m1 = bubble(F.black, 'junior', 'Кто-нибудь вообще читал описание группы?', { cls: 'big' });
    F.m2 = bubble(F.black, 'kevin', 'А тут читать надо было?', { cls: 'big' });
    F.m1.style.left = '220px'; F.m1.style.top = '380px'; F.m2.style.left = '220px'; F.m2.style.top = '600px';
    F.g = layer(root, 'top');
  },
  update(t, lt) {
    clear(F.g0); clear(F.g);
    const blast = Math.exp(-lt * 3);
    stars(F.g0, t, { n: 500, speed: 0.4 + blast * 6, alpha: 0.9 });
    // cinematic orbit around the sphere/logo
    const orbit = kf(t, [[B0, -28], [T.inst, 22]], E.inOutCubic);
    camera(F.cam, { ry: orbit, rx: kf(t, [[B0, 14], [T.title, 4], [T.inst, -4]], E.inOutCubic), s: kf(t, [[B0, 0.55], [T.title, 0.95, E.outCubic], [T.inst, 1.05]]), y: kf(t, [[T.inst - 0.3, 0], [T.inst + 0.3, -120]]), sh: 2 + blast * 30, t });
    // sphere assembly + spin
    const spin = t * 22;
    F.sphere.style.transform = `translate3d(960px, 560px, -200px) rotateY(${spin.toFixed(2)}deg) rotateX(-12deg)`;
    const R = 400;
    F.nodes.forEach((nd, i) => {
      const k = E.outCubic(prog(t, B0 + 0.1 + (i % 20) * 0.06, B0 + 1.6 + (i % 20) * 0.06));
      // fly in from scattered positions; parked on the sphere surface facing outward
      const ss = `rotateY(${nd._lon.toFixed(2)}deg) rotateX(${nd._lat.toFixed(2)}deg) translateZ(${R}px)`;
      nd.style.transform = k < 1 ? `translate3d(${(nd._fx * (1 - k)).toFixed(1)}px, ${(nd._fy * (1 - k)).toFixed(1)}px, ${(nd._fz * (1 - k)).toFixed(1)}px) ${ss} scale(${(0.6 + k * 0.4).toFixed(3)})` : ss;
      nd.style.opacity = clamp(k * 3);
    });
    F.core.style.opacity = prog(t, B0 + 1.2, B0 + 2);
    F.ring.style.transform = `translate3d(960px, 560px, -200px) rotateX(72deg) rotateZ(${(-t * 30).toFixed(1)}deg)`;
    F.reacts.forEach((e, i) => {
      const a = i / REACT.length * 360, k = pop(t, B0 + 1.4 + i * 0.05, 0.4);
      e.style.transform = `rotateZ(${a}deg) translateX(${(620 * k).toFixed(1)}px) rotateZ(${-a}deg) rotateX(-72deg) scale(${k})`;
    });
    // title slams letter by letter on the bar
    F.ch.forEach((c, i) => {
      const k = E.outBack(prog(t, T.title + i * 0.018, T.title + 0.3 + i * 0.018));
      c.style.transform = `translate3d(0, ${((1 - k) * -120).toFixed(1)}px, ${((1 - k) * 900).toFixed(1)}px)`;
      c.style.opacity = clamp(k * 2);
    });
    F.title.style.transform = `translate3d(-50%, 0, 260px) rotateY(${(-orbit * 0.6).toFixed(2)}deg)`;
    const outAll = prog(t, T.glow, T.glow + 0.4);
    F.cam.style.opacity = 1 - outAll;
    // phrases on consecutive bars
    [T.p1, T.p2, T.p3].forEach((pt, i) => {
      const k = pop(t, pt, 0.3), ko = i < 2 ? prog(t, pt + 1.85, pt + 1.95) : prog(t, T.line - 0.1, T.line);
      F.ph[i].style.opacity = k * (1 - ko);
      F.ph[i].style.transform = `translate(-50%,-50%) scale(${0.7 + k * 0.3}) translateY(${(1 - k) * 40}px)`;
      F.ph[i].style.letterSpacing = `${(1 - E.outCubic(prog(t, pt, pt + 0.5))) * 0.3}em`;
    });
    const lk = pop(t, T.line, 0.35);
    F.line.style.opacity = lk * (1 - prog(t, T.inst - 0.15, T.inst + 0.1)); F.line.style.transform = `translate(-50%,-50%) translateY(${(1 - lk) * 30}px)`;
    const ik = pop(t, T.inst, 0.35);
    F.inst.style.opacity = ik * (1 - outAll); F.inst.style.transform = `translate(-50%,-50%) scale(${0.6 + ik * 0.4})`;
    const bk = pop(t, T.inst + 0.35, 0.35), down = t > T.click - 0.02 && t < T.click + 0.12;
    F.btn.style.opacity = bk * (1 - outAll);
    F.btn.style.transform = `translate(-50%,-50%) scale(${bk * (down ? 0.94 : t > T.click - 0.3 ? 1.05 : 1)})`;
    F.btn.classList.toggle('hover', t > T.click - 0.3);
    // cursor: slow approach, tip on the button centre
    const ck = E.inOutCubic(prog(t, T.inst + 0.6, T.click - 0.08));
    tf(F.cur, { x: kf(ck, [[0, 1700], [1, 975]], E.lin), y: kf(ck, [[0, 1150], [1, 935]], E.outQuad), s: down ? 0.86 : 1, o: t > T.inst + 0.55 && t < T.glow + 0.3 ? 1 : 0 });
    // green glow takes the screen, last line
    const gk = prog(t, T.click, T.glow + 0.5);
    F.green.style.opacity = E.inOutCubic(gk);
    F.green.style.transform = `scale(${0.2 + E.outCubic(gk) * 1.8})`;
    const fk = pop(t, T.last, 0.4);
    F.last.style.opacity = fk * (t < T.end ? 1 : 0);
    F.last.style.transform = `translate(-50%,-50%) scale(${(0.6 + fk * 0.4) * (1 + prog(t, T.last, T.end) * 0.06)})`;
    burst(F.g, t, B0, { x: 960, y: 540, n: 300, speed: 3600, size: 16, shape: 'confetti', grav: 200, life: 2.0, colors: ['#39ff14', '#b026ff', '#00c8ff', '#fff'], seed: 21 });
    if (t > T.last) burst(F.g, t, T.last, { x: 960, y: 540, n: 120, speed: 2400, size: 14, shape: 'confetti', grav: 400, life: 1.6, colors: ['#000', '#fff', '#b026ff'], seed: 22 });
    if (lt < 0.25) { POST.flash = 1 - lt / 0.25; POST.flashColor = '#e8ffe0'; }
    // black tail with two messages and a hard cut
    F.black.style.display = t >= T.end ? '' : 'none';
    const m1 = pop(t, T.m1, 0.3), m2 = pop(t, T.m2, 0.3), cut = t >= T.cut;
    F.m1.style.opacity = cut ? 0 : m1; F.m1.style.transform = `translateY(${(1 - m1) * 50}px) scale(${0.8 + m1 * 0.2})`;
    F.m2.style.opacity = cut ? 0 : m2; F.m2.style.transform = `translateY(${(1 - m2) * 50}px) scale(${0.8 + m2 * 0.2})`;
    if (t > T.ding && !cut) { POST.flash = 0.15; POST.flashColor = '#2aa7ff'; }
    if (t >= T.end) { POST.vignette = 0; POST.grain = 0.5; }
  },
};
