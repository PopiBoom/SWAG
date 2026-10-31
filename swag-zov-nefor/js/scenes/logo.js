// 2. Логотип вылетает из цифрового портала; камера ныряет в интерфейс Telegram.
import { el, tf, kf, E, pop, prog, letters, clamp, shake, hash } from '../core.js';
import { layer, clear, burst, stars, matrix } from '../fx.js';
import { SCENES, b, M0 } from '../data.js';
import { ASSETS } from '../ui.js';
import { POST } from '../post.js';

const T_TAG = b(0.875), T_DIVE = b(1.55);
let R = {};
export default {
  name: 'logo', range: SCENES.logo, z: 2,
  cues: [[M0, 'drop', 1.0], [M0 + 0.15, 'whoosh', 0.6], [T_TAG, 'slam', 0.9], [T_TAG + 0.25, 'slam2', 0.6], [T_DIVE - 0.1, 'whoosh', 0.8]],
  build(root) {
    R.g0 = layer(root);
    R.cam = el('div', 'cam', root);
    R.rings = [];
    for (let i = 0; i < 9; i++) {
      const r = el('div', 'portal-ring', R.cam);
      r.style.width = r.style.height = (900 + i * 10) + 'px';
      r.style.borderColor = ['#39ff14', '#b026ff', '#00c8ff'][i % 3];
      R.rings.push(r);
    }
    R.core = el('div', 'portal-core', R.cam);
    R.logo = el('div', 'logo3d', R.cam);
    if (ASSETS.logo) { R.emb = el('div', 'logo-emb', R.logo); R.emb.style.backgroundImage = 'url(assets/logo.jpg)'; }
    R.word = el('div', 'logo-word title', R.logo);
    R.ch = [...letters(R.word, 'SWAG_ZOV_NEFOR'), ...letters(R.word, '.exe', 'ch exe')];
    R.tag = el('div', 'logo-tag', R.cam);
    R.tagA = el('span', 'plate', R.tag, 'Это не чат.');
    R.tagB = el('span', 'plate violet', R.tag, 'Это <b>диагноз интернета.</b>');
    R.tg = el('div', 'tgwin logo-tg', root);
    R.tg.innerHTML = '<div class="tg-head"><div class="tg-logo">SZN</div><div><div class="ttl">SWAG_ZOV_NEFOR.exe</div><div class="sub">62 участника, 21 в сети</div></div></div>';
    R.g = layer(root);
  },
  update(t, lt) {
    const T1 = SCENES.logo[1];
    clear(R.g0); clear(R.g);
    matrix(R.g0, t, { alpha: 0.18 * (1 - prog(t, T_DIVE, T1)), cols: 70 });
    stars(R.g0, t, { n: 260, speed: 0.6 + prog(t, T_DIVE - 0.3, T1) * 6, alpha: 0.8 });
    // camera orbit + dive
    const dive = E.inExpo(prog(t, T_DIVE, T1));
    const [sx, sy] = shake(t, 3 + Math.exp(-lt * 4) * 30);
    R.cam.style.transform = `translate3d(${sx}px,${sy}px,${dive * 1500}px) rotateY(${kf(lt, [[0, -12], [3.2, 9]], E.inOutCubic).toFixed(2)}deg) rotateX(${kf(lt, [[0, 8], [3.2, -3]]).toFixed(2)}deg)`;
    // portal rings: tilted, spinning, receding tunnel
    R.rings.forEach((r, i) => {
      const open = E.outBack(prog(t, M0 + i * 0.03, M0 + 0.6 + i * 0.03));
      const z = -300 - i * 260 + ((t * 300) % 260);
      r.style.transform = `translate(-50%,-50%) translateZ(${z}px) rotateZ(${(t * (40 + i * 12) * (i % 2 ? -1 : 1)).toFixed(1)}deg) scale(${(open * (1 - i * 0.04)).toFixed(3)})`;
      r.style.opacity = (0.9 - i * 0.08) * (1 - dive);
    });
    R.core.style.transform = `translate(-50%,-50%) translateZ(-1400px) scale(${(1 + Math.sin(t * 6) * 0.05) * pop(t, M0, 0.5)})`;
    R.core.style.opacity = 1 - dive;
    // logo letters fly out of the portal
    R.ch.forEach((c, i) => {
      const k = E.outBack(prog(t, M0 + 0.12 + i * 0.035, M0 + 0.75 + i * 0.035));
      const z = (1 - k) * -2600, y = (1 - k) * (hash(i) - 0.5) * 300, rx = (1 - k) * 120;
      const wob = Math.sin(t * 5 + i * 0.6) * 6 * prog(t, M0 + 1, M0 + 1.5);
      c.style.transform = `translate3d(0,${(y + wob).toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(1)}deg)`;
      c.style.opacity = clamp(k * 2);
    });
    tf(R.logo, { x: 0, y: kf(t, [[T_TAG - 0.2, 0], [T_TAG + 0.2, -60, E.outCubic]]), z: 0, s: 1 + dive * 0.4, o: 1 - prog(t, T_DIVE, T_DIVE + 0.35) });
    R.logo.style.transform = 'translate(-50%,-50%) ' + R.logo.style.transform;
    // tagline: two plates slam in on consecutive beats
    const ka = pop(t, T_TAG, 0.3), kb = pop(t, T_TAG + 0.2439, 0.3);
    tf(R.tagA, { s: 0.3 + 0.7 * ka, o: ka, rz: -3 + (1 - ka) * -20 });
    tf(R.tagB, { s: 0.3 + 0.7 * kb, o: kb, rz: 2 + (1 - kb) * 20 });
    R.tag.style.opacity = 1 - prog(t, T_DIVE, T_DIVE + 0.3);
    // telegram window rushing toward camera
    const tk = prog(t, T_DIVE - 0.6, T1);
    R.tg.style.transform = `translate(-50%,-50%) translateZ(${(-2600 + E.inCubic(tk) * 3300).toFixed(1)}px) rotateX(${(1 - tk) * 20}deg)`;
    R.tg.style.opacity = clamp(tk * 3);
    // the first-beat burst continues from the boot button
    burst(R.g, t, M0, { x: 960, y: 540, n: 220, speed: 3000, size: 14, shape: 'confetti', grav: 300, life: 1.6, colors: ['#39ff14', '#b026ff', '#00c8ff', '#fff'], seed: 3 });
    if (t > T1 - 0.12) { POST.flash = prog(t, T1 - 0.12, T1) * 0.8; POST.flashColor = '#0e1621'; }
  },
};
