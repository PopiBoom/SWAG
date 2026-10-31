// 1. Запуск неизвестной программы — terminal, retro installer, ERROR 404, toasts, button pressed by the cursor.
import { el, tf, kf, E, pop, prog, typed, txt, shake, clamp, life, hash } from '../core.js';
import { win, toast, cursor } from '../ui.js';
import { layer, clear, burst } from '../fx.js';
import { SCENES } from '../data.js';
import { POST } from '../post.js';

const LINE = 'Обнаружена неизвестная программа…';
const CHECKS = [[3.3, 'Проверка на адекватность…'], [4.3, 'Проверка на наличие здравого смысла…'], [5.3, 'Поиск правил поведения…']];
const T_TYPE = 0.8, CPS = 21, T_WIN = 2.7, T_STALL = 6.2, T_RED = 6.6, T_BTN = 9.0, T_PRESS = 10.22, T_POP = 10.5;
const TOASTS = [[7.4, '62', 'Обнаружено <b class="g">62</b> подозрительно общительных объекта'], [7.9, '21', '<b class="g">21</b> объект уже в сети'], [8.4, '!', 'Уровень хаоса: <b class="r">999%</b>']];

let R = {};
export default {
  name: 'boot', range: SCENES.boot, post: 0.6, z: 3,
  cues: [
    ...[...LINE].map((c, i) => [T_TYPE + i / CPS, c === ' ' ? 'key2' : 'key', 0.55]),
    [T_WIN, 'winopen', 0.8], ...CHECKS.map(([t]) => [t, 'tick', 0.7]),
    [T_STALL, 'stall', 0.8], [T_RED - 0.02, 'crit', 1.0], [T_RED, 'boomsoft', 0.7],
    ...TOASTS.map(([t]) => [t, 'toast', 0.8]), [T_BTN, 'popup', 0.8], [9.25, 'whoosh_s', 0.25],
    [T_PRESS, 'click', 1.0], [T_POP - 0.45, 'riser', 0.7], [T_POP, 'shatter', 1.0],
  ],
  build(root) {
    R.cam = el('div', 'cam', root);
    R.bg = el('div', 'boot-bg', R.cam);
    R.term = el('div', 'boot-term mono', R.cam);
    R.termTx = el('span', '', R.term); R.caret = el('span', 'caret', R.term, '█');
    R.win = win(R.cam, 'SWAG_ZOV_NEFOR.exe — Установка', '', { buttons: [], icon: '' , cls: 'boot-win' });
    R.win.style.left = '460px'; R.win.style.top = '400px';
    const body = R.win._text;
    body.innerHTML = '<div class="bw-file"><span class="bw-ic">EXE</span><div><div class="bw-name">SWAG_ZOV_NEFOR.exe</div><div class="bw-meta">Издатель: неизвестен · Размер: ∞ КБ</div></div></div>';
    R.bar = el('div', 'bw-bar', body); R.fill = el('div', 'bw-fill', R.bar);
    R.status = el('div', 'bw-status', body); R.pct = el('div', 'bw-pct', body);
    R.red = el('div', 'boot-red', root);
    R.err = el('div', 'boot-err', R.red);
    R.errA = el('div', 'title e1', R.err, 'ERROR 404:');
    R.errB = el('div', 'title e2', R.err, 'АДЕКВАТНОСТЬ НЕ НАЙДЕНА');
    R.slices = [0, 1, 2].map(i => { const s = el('div', 'boot-slice title', R.red, 'АДЕКВАТНОСТЬ НЕ НАЙДЕНА'); return s; });
    R.toasts = TOASTS.map(([, ic, tx], i) => { const t = toast(R.red, ic, tx, i === 2 ? 'red' : ''); t.style.left = '50%'; t.style.top = (520 + i * 104) + 'px'; return t; });
    R.btn = el('div', 'boot-btn', R.red, 'ВСЁ РАВНО ЗАЙТИ');
    R.cursor = cursor(root);
    R.g = layer(root);
  },
  update(t) {
    // camera: slow push-in with a gentle roll; kick on the error
    const kick = t > T_RED ? Math.exp(-(t - T_RED) * 5) : 0;
    const [sx, sy] = shake(t, 4 + kick * 40 + (t > T_STALL && t < T_RED ? 6 : 0));
    const s = kf(t, [[0, 1.12], [6.5, 1.0, E.outCubic], [6.6, 1.06], [10.5, 1.0, E.outCubic]]);
    tf(R.cam, { x: sx, y: sy, s, rz: kf(t, [[0, -1.2], [6.5, 0.6]]) });
    // terminal
    txt(R.termTx, '> ' + typed(LINE, t, T_TYPE, CPS));
    R.caret.style.opacity = Math.floor(t * 2.6) % 2 ? 0 : 1;
    tf(R.term, { y: kf(t, [[2.4, 0], [3.0, -230, E.inOutCubic]]), o: t < T_RED ? 1 : 0, s: kf(t, [[2.4, 1], [3.0, 0.8]]) });
    // installer window
    const wk = pop(t, T_WIN, 0.4);
    const stall = t > T_STALL && t < T_RED;
    const jx = stall ? (hash(Math.floor(t * 40)) - 0.5) * 30 : 0;
    tf(R.win, { s: (0.6 + 0.4 * wk) * 1.2, o: wk * (t < T_RED ? 1 : 0), rx: (1 - wk) * 30, x: jx });
    R.win.classList.toggle('rgb', stall);
    const p = kf(t, [[2.9, 0], [3.6, 0.18], [4.2, 0.24], [4.8, 0.43], [5.3, 0.47], [6.0, 0.66], [6.2, 0.67]]);
    R.fill.style.width = (p * 100).toFixed(1) + '%';
    const c = CHECKS.filter(([ct]) => t >= ct).pop();
    txt(R.status, c ? c[1] : 'Подготовка…');
    txt(R.pct, stall ? 'ОШИБКА' : Math.round(p * 100) + '%');
    R.pct.classList.toggle('bad', stall);
    // red screen
    const rk = t >= T_RED && t < T_POP ? 1 : 0;
    R.cam.style.visibility = t < T_POP ? 'visible' : 'hidden';
    R.red.style.opacity = rk;
    if (rk) {
      const lt = t - T_RED;
      const es = kf(lt, [[0, 2.4], [0.25, 1, E.outBack]]);
      tf(R.err, { s: es * kf(t, [[T_BTN, 1], [T_BTN + 0.4, 0.82]]), y: kf(t, [[T_BTN, 0], [T_BTN + 0.4, -40]]) });
      const gl = (hash(Math.floor(t * 24)) > 0.7 || lt < 0.4);
      R.errB.classList.toggle('rgb', gl);
      R.slices.forEach((sl, i) => {
        const on = gl && hash(Math.floor(t * 24) + i * 3) > 0.4;
        sl.style.opacity = on ? 0.85 : 0;
        sl.style.clipPath = `inset(${30 + i * 18}% 0 ${50 - i * 16}% 0)`;
        sl.style.transform = `translate(-50%, -50%) translateX(${(hash(Math.floor(t * 24) + i) - 0.5) * 120}px)`;
      });
      R.red.style.background = `radial-gradient(ellipse at 50% 40%, #ff2a3d ${0}%, #9a0014 60%, #2a0006 100%)`;
      R.red.style.filter = `brightness(${(1 + Math.max(0, 0.6 - lt) * 1.5 + 0.12 * Math.sin(t * 9)).toFixed(3)})`;
      R.toasts.forEach((el2, i) => {
        const k = pop(t, TOASTS[i][0], 0.4);
        tf(el2, { x: (1 - k) * 900, o: clamp(k * 3), y: kf(t, [[T_BTN, 0], [T_BTN + 0.4, -50]]) - 0, s: kf(t, [[T_BTN, 1], [T_BTN + 0.4, 0.9]]) });
        el2.style.transform = 'translateX(-50%) ' + el2.style.transform;
      });
      const bk = pop(t, T_BTN, 0.45);
      const hover = t > 9.95, down = t > T_PRESS && t < T_PRESS + 0.12;
      const glow = prog(t, T_PRESS + 0.1, T_POP);
      tf(R.btn, { s: bk * (down ? 0.94 : hover ? 1.06 : 1) * (1 + glow * 0.08), o: t < T_POP ? bk : 0 });
      R.btn.style.transform = `translate(-50%,-50%) ` + R.btn.style.transform;
      R.btn.classList.toggle('hover', hover);
      R.btn.style.background = glow > 0 ? `rgb(${57 + glow * 198},255,${20 + glow * 235})` : '';
    }
    // cursor: arc in, tip lands on button centre (960, 880)
    const ck = E.inOutCubic(prog(t, 9.2, 9.95));
    const cx = kf(ck, [[0, 1780], [1, 975]], E.lin), cy = 1150 - Math.sin(ck * Math.PI) * 220 * 0 + (880 - 1150) * E.outQuad(ck);
    const press = t > T_PRESS && t < T_PRESS + 0.12 ? 0.86 : 1;
    tf(R.cursor, { x: cx, y: cy, s: press, o: t > 9.15 && t < T_POP ? 1 : 0, rz: (1 - ck) * -14 });
    // particles
    clear(R.g);
    if (t >= T_POP - 0.02) {
      burst(R.g, t, T_POP, { x: 960, y: 880, n: 260, speed: 2600, size: 16, shape: 'digit', grav: 200, life: 1.2 });
      burst(R.g, t, T_POP, { x: 960, y: 880, n: 160, speed: 2000, size: 12, grav: 100, life: 1.0, colors: ['#39ff14', '#fff', '#b026ff'] });
      POST.flash = 0.55 * Math.max(0, 1 - (t - T_POP) * 7); POST.flashColor = '#b6ff00';
    }
  },
};
