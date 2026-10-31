// 7. Инфографика настоящего безумия — 3D-дашборд на дроп трека, затем круговая диаграмма.
import { el, tf, kf, E, pop, prog, clamp, hash, txt, fmt } from '../core.js';
import { avatar } from '../ui.js';
import { layer, clear, matrix, stars } from '../fx.js';
import { SCENES, BEAT, MEMBERS } from '../data.js';
import { POST } from '../post.js';
import { camera, caption } from './common.js';

const [S0, S1] = SCENES.stats;
const TILE_T = i => S0 + 0.15 + i * BEAT / 2;
const T_PIE = S0 + 3.66;
const PIE = [['Ради общения', 10, '#2aa7ff'], ['Ради мемов', 30, '#39ff14'], ['Ради споров', 20, '#ff2a3d'], ['Сами не знают', 40, '#b026ff']];
const R = {};
export const stats = {
  name: 'stats', range: SCENES.stats, z: 2,
  cues: [[S0, 'drop', 1.0], [S0 + 0.02, 'slam', 0.8], ...Array.from({ length: 7 }, (_, i) => [TILE_T(i), 'blip', 0.7]), [S0 + 2.0, 'alarm_s', 0.5],
    [T_PIE - 0.25, 'whoosh', 0.7], ...PIE.map((p, i) => [T_PIE + 0.3 + i * BEAT / 2, 'blip2', 0.7]), [T_PIE + 0.3 + 4 * BEAT / 2 + 0.1, 'slam', 0.7]],
  build(root) {
    R.g0 = layer(root);
    R.cam = el('div', 'cam', root);
    R.dash = el('div', 'dash', R.cam);
    R.head = el('div', 'dash-h title', R.dash, 'СТАТИСТИКА <span>SWAG_ZOV_NEFOR.exe</span>');
    const grid = el('div', 'dash-grid', R.dash);
    const tile = (cls, label, inner) => { const t = el('div', 'tile ' + cls, grid); el('div', 'tl-l', t, label); const b = el('div', 'tl-b', t, inner); return t; };
    R.tiles = [
      tile('t-members', 'Участников', '<div class="big n1">0</div><div class="avrow"></div>'),
      tile('t-online', 'В сети', '<div class="ring"><div class="ring-in"><b class="n2">0</b><small>из 62</small></div></div>'),
      tile('t-normal', 'Вероятность нормального разговора', '<div class="big red">1%</div><div class="bar"><div class="fill" style="background:#ff2a3d"></div></div>'),
      tile('t-topics', 'Количество неожиданных тем', '<div class="inf">∞</div>'),
      tile('t-memes', 'Скорость появления мемов', '<div class="gauge"><div class="g-arc"></div><div class="needle"></div></div><div class="crit">КРИТИЧЕСКАЯ</div>'),
      tile('t-irony', 'Уровень самоиронии', '<div class="ring violet"><div class="ring-in"><b class="n3">0%</b></div></div>'),
      tile('t-five wide', 'Зашли «на пять минут»', '<div class="bar long"><div class="fill"></div></div><div class="sus">подозрительно много</div>'),
    ];
    const row = R.tiles[0].querySelector('.avrow');
    MEMBERS.slice(0, 8).forEach(m => avatar(m, 54, row));
    R.n1 = R.dash.querySelector('.n1'); R.n2 = R.dash.querySelector('.n2'); R.n3 = R.dash.querySelector('.n3');
    R.ring2 = R.tiles[1].querySelector('.ring'); R.ring3 = R.tiles[5].querySelector('.ring');
    R.needle = R.dash.querySelector('.needle'); R.inf = R.dash.querySelector('.inf');
    R.normFill = R.tiles[2].querySelector('.fill'); R.fiveFill = R.tiles[6].querySelector('.fill');
    // pie
    R.pie = el('div', 'piepanel', R.cam);
    el('div', 'pie-h title', R.pie, 'Почему люди здесь сидят?');
    const body = el('div', 'pie-body', R.pie);
    R.donut = el('div', 'donut', body); el('div', 'donut-hole', R.donut, '<b>?</b>');
    R.slice = el('div', 'donut-pop', R.donut);
    const leg = el('div', 'legend', body);
    R.leg = PIE.map(([l, v, c]) => el('div', 'lg', leg, `<i style="background:${c}"></i><span>${l}</span><b style="color:${c}">${v}%</b>`));
    R.g = layer(root, 'top');
  },
  update(t, lt) {
    const D = S1 - S0;
    clear(R.g0); clear(R.g);
    matrix(R.g0, t, { alpha: 0.12, cols: 60 });
    const toPie = E.inOutCubic(prog(t, T_PIE - 0.3, T_PIE + 0.3));
    const kick = Math.exp(-lt * 5);
    camera(R.cam, { x: kf(lt, [[0, 50], [3.3, -50]], E.inOutCubic) * (1 - toPie), y: 30 - toPie * 1110, s: 0.86 + kick * 0.12 + toPie * 0.04,
      rx: 8 + toPie * 2, ry: kf(lt, [[0, -7], [3.3, 6]], E.inOutCubic) * (1 - toPie), sh: 2 + kick * 26, t });
    POST.flash = Math.max(0, 0.6 - lt * 4); POST.flashColor = '#39ff14';
    const hk = pop(t, S0, 0.3);
    R.head.style.transform = `scale(${0.5 + hk * 0.5})`; R.head.style.opacity = hk;
    R.tiles.forEach((tl, i) => {
      const k = E.outBack(prog(t, TILE_T(i), TILE_T(i) + 0.35));
      tl.style.transform = `translateZ(${((1 - k) * -800).toFixed(1)}px) rotateX(${((1 - k) * 50).toFixed(1)}deg)`;
      tl.style.opacity = clamp(k * 1.5);
    });
    txt(R.n1, String(Math.round(kf(t, [[TILE_T(0), 0], [TILE_T(0) + 0.7, 62, E.outCubic]]))));
    const on = kf(t, [[TILE_T(1), 0], [TILE_T(1) + 0.7, 21, E.outCubic]]);
    txt(R.n2, String(Math.round(on)));
    R.ring2.style.background = `conic-gradient(var(--acid) ${(on / 62 * 360).toFixed(1)}deg, #1a2230 0)`;
    R.normFill.style.width = kf(t, [[TILE_T(2), 0], [TILE_T(2) + 0.5, 1.2]]) + '%';
    R.inf.style.transform = `scale(${1 + Math.sin(t * 8) * 0.08}) rotate(${Math.sin(t * 3) * 6}deg)`;
    const nd = kf(t, [[TILE_T(4), -90], [TILE_T(4) + 0.5, 80, E.outBack]]) + Math.sin(t * 40) * 4 * (t > TILE_T(4) + 0.5 ? 1 : 0);
    R.needle.style.transform = `rotate(${nd}deg)`;
    const ir = kf(t, [[TILE_T(5), 0], [TILE_T(5) + 0.6, 100, E.outCubic]]);
    txt(R.n3, Math.round(ir) + '%');
    R.ring3.style.background = `conic-gradient(var(--violet) ${(ir * 3.6).toFixed(1)}deg, #1a2230 0)`;
    R.fiveFill.style.width = kf(t, [[TILE_T(6), 0], [TILE_T(6) + 0.9, 185, E.outCubic]]) + '%';
    R.dash.style.opacity = 1 - prog(t, T_PIE + 0.1, T_PIE + 0.4);
    // pie: sectors grow in sequence on half beats
    const pk = pop(t, T_PIE - 0.2, 0.4);
    R.pie.style.opacity = pk;
    let acc = 0; const stops = [];
    PIE.forEach(([l, v, c], i) => {
      const k = E.outCubic(prog(t, T_PIE + 0.3 + i * BEAT / 2, T_PIE + 0.3 + i * BEAT / 2 + 0.3));
      const a0 = acc, a1 = acc + v * 3.6 * k; acc += v * 3.6 * k;
      stops.push(`${c} ${a0.toFixed(1)}deg ${a1.toFixed(1)}deg`);
      R.leg[i].style.opacity = clamp(k * 2); R.leg[i].style.transform = `translateX(${(1 - k) * 80}px)`;
    });
    stops.push(`#141a24 ${acc.toFixed(1)}deg 360deg`);
    R.donut.style.background = `conic-gradient(${stops.join(',')})`;
    const popk = E.outBack(prog(t, T_PIE + 0.3 + 4 * BEAT / 2 + 0.1, T_PIE + 0.3 + 4 * BEAT / 2 + 0.45));
    R.slice.style.opacity = popk;
    R.slice.style.transform = `translate(${popk * 30}px, ${popk * -20}px)`;
    R.leg[3].classList.toggle('hi', popk > 0.5);
  },
};
