// 4. Админ и его непростая работа (BunkerRP, True Mafia) + kapustka [Бледный].
import { el, tf, kf, E, pop, prog, clamp, hash, txt } from '../core.js';
import { figure, emo, win, cursor } from '../ui.js';
import { layer, clear, burst, rain, speedLines } from '../fx.js';
import { SCENES, b, BEAT } from '../data.js';
import { POST } from '../post.js';
import { backdrop, heroCard, whipIn, caption, popBubble, camera, placeFig, dropIn } from './common.js';

const [A0] = SCENES.admin;
// absolute event times (bars of segment A)
const T = {
  press: b(9.25), confirm: b(9.5), yes: b(10), deny: b(10.25), spin: b(10.75), mafia: b(11.25), ask: b(11.4),
  badge: b(11.85), card: b(12.15), flip: b(12.5), flipEnd: b(12.5) + 0.45, coup: b(12.6),
};
const R = {};
const MEMES = ['🤡', '🎪', '🐸', '💀', '🗿', '😂', '🔥', '🤯', '🦆', '🍿', '😭', '🥴', '🐒', '🫠', '👀', '🚬', '💅', '🧌'];
export const admin = {
  name: 'admin', range: SCENES.admin, z: 2,
  cues: [[A0, 'whip', 0.6], [A0 + 0.15, 'hero', 0.6], [A0 + 0.35, 'throne', 0.6], [T.press - 0.05, 'bigbutton', 0.9], [T.confirm, 'popup', 0.8],
    [T.yes - 0.02, 'click', 1.0], [T.deny, 'crit', 0.9], [T.deny + 0.05, 'scratch', 0.6], [T.spin, 'spin', 0.8], [T.spin + 0.3, 'glitch', 0.4],
    [T.mafia - 0.1, 'doorbust', 0.9], [T.ask, 'notify', 0.8], [T.badge, 'shine', 0.8], [T.card, 'cardflip', 0.9], [T.flip, 'reverse', 1.0],
    [T.coup, 'slam', 0.8], [T.coup + 0.1, 'powerup', 0.5]],
  build(root) {
    R.bd = backdrop(root, { top: '#06142a', bottom: '#000', floor: '#00c8ff', wall: false });
    R.room = el('div', 'cam', root);          // the whole room flips
    R.cam = el('div', 'cam', R.room);
    R.wall = el('div', 'cmd-wall', R.cam);
    R.screens = [];
    for (let i = 0; i < 18; i++) {
      const s = el('div', 'cmd-scr', R.wall);
      s._chat = el('div', 'cmd-chat', s, Array.from({ length: 5 }, (_, j) => `<i style="width:${40 + ((i * 7 + j * 13) % 50)}%"></i>`).join(''));
      s._meme = emo(s, MEMES[i % MEMES.length], 110); s._meme.classList.add('cmd-meme');
      R.screens.push(s);
    }
    R.throne = el('div', 'throne', R.cam);
    el('div', 'throne-back', R.throne); el('div', 'throne-seat', R.throne);
    R.fig = figure(R.cam, 'bunker', { size: 230, body: '#0f3a6b', glow: '#39ff14' });
    R.badge = el('div', 'admin-badge', R.fig._props, 'ADMIN');
    R.mafia = figure(R.cam, 'mafia', { size: 230, body: '#111', glow: '#ffd400', cls: 'mafia' });
    el('div', 'tie', R.mafia._body);
    R.shades = emo(R.mafia._props, '🕶️', 150); R.shades.style.left = '40px'; R.shades.style.top = '40px';
    R.uno = el('div', 'revcard', R.cam, '<div class="rc-in"><span>⇄</span></div><div class="rc-t">REVERSE</div>');
    R.panel = el('div', 'order-btn', root, 'УСТАНОВИТЬ ПОРЯДОК');
    R.q = win(root, 'Подтверждение', 'Вы уверены?', { buttons: ['ДА', 'НЕТ'], icon: '?', cls: 'q' });
    R.q.style.left = '1080px'; R.q.style.top = '330px';
    R.no = win(root, 'Ошибка доступа', 'Недостаточно прав<br>для управления этим цирком', { buttons: ['OK'], icon: '✕', cls: 'err red' });
    R.no.style.left = '1000px'; R.no.style.top = '360px';
    R.cur = cursor(root);
    R.card = heroCard(root, 'bunker', 'КЛАСС: АДМИН (ПОЧТИ)', '#39ff14');
    R.ask = popBubble(root, 'mafia', 'Кто здесь главный?', 1360, 230, { cls: 'big' });
    R.coup = caption(root, 'Переворот власти <b>успешно выполнен</b>', 960, 960, 'violet');
    R.g = layer(root, 'top');
  },
  update(t, lt) {
    const [a, e] = SCENES.admin, D = e - a;
    const w = whipIn(lt, 0.3, 1);
    const flip = E.inOutCubic(prog(t, T.flip, T.flipEnd));
    const kick = t > T.deny ? Math.exp(-(t - T.deny) * 6) * 16 : 0;
    // camera: dolly from wide to the throne, then turn toward the door when Mafia arrives
    const toDoor = E.inOutCubic(prog(t, T.mafia - 0.2, T.mafia + 0.4));
    camera(R.cam, { x: w.x - toDoor * 120, s: kf(t, [[a, 0.86], [T.press, 1.0], [T.spin, 1.0], [T.mafia, 0.9]], E.inOutCubic), ry: kf(t, [[a, 8], [T.press, 0], [T.mafia, -6]]), rx: 2, blur: w.blur, sh: 2 + kick, t });
    R.room.style.transform = `rotateZ(${(flip * 180).toFixed(2)}deg)`;
    R.room.style.filter = flip > 0.02 && flip < 0.98 ? `blur(${(Math.sin(flip * Math.PI) * 10).toFixed(1)}px)` : 'none';
    R.bd.update(t, { speed: 50 });
    // monitors: chat feeds -> memes after the denial
    const memes = t > T.spin;
    R.screens.forEach((s, i) => {
      const on = memes && t > T.spin + (i % 6) * 0.04;
      s._chat.style.opacity = on ? 0 : 1;
      s._meme.style.opacity = on ? 1 : 0;
      s._meme.style.transform = `translate(-50%,-50%) rotate(${Math.sin(t * 6 + i) * 12}deg) scale(${1 + Math.sin(t * 9 + i) * 0.08})`;
      s.classList.toggle('alarm', t > T.deny && t < T.spin && (Math.floor(t * 8) + i) % 2 === 0);
    });
    // throne spins after the denial
    const spin = E.inOutCubic(prog(t, T.spin, T.spin + 0.9)) * 720;
    R.throne.style.transform = `translate3d(calc(-50% - 200px),0,-200px) rotateY(${spin}deg)`;
    placeFig(R.fig, { x: 760, y: 820, z: -120, ry: spin, s: 1 });
    const bk = prog(t, T.badge, T.badge + 0.35);
    R.badge.style.transform = `translate(-50%,0) scale(${1 + E.outBack(bk) * 0.6 * (1 - prog(t, T.card, T.card + 0.3))})`;
    R.badge.classList.toggle('shine', t > T.badge && t < T.card + 0.2);
    // mafia slides in from the door at the right
    const mk = E.outCubic(prog(t, T.mafia, T.mafia + 0.5));
    placeFig(R.mafia, { x: 2300 - mk * 760, y: 860, z: 80, o: mk > 0 ? 1 : 0, rz: (1 - mk) * -8 });
    // the reverse card
    const ck = E.outBack(prog(t, T.card, T.card + 0.35));
    R.uno.style.transform = `translate3d(${1350 - ck * 60}px, ${520 - ck * 120}px, 200px) rotateY(${(1 - ck) * 540 + Math.sin(t * 3) * 10}deg) rotateZ(${-12 + ck * 6}deg) scale(${ck * 1.2})`;
    R.uno.style.opacity = t > T.card ? 1 : 0;
    // button + dialogs + cursor
    const pk = pop(t, a + 0.5, 0.35);
    R.panel.style.transform = `translate(-50%,-50%) scale(${(0.5 + pk * 0.5) * (t > T.press && t < T.press + 0.15 ? 0.92 : 1)})`;
    R.panel.style.opacity = pk * (1 - prog(t, T.confirm, T.confirm + 0.2));
    R.panel.classList.toggle('down', t > T.press && t < T.press + 0.15);
    const qk = pop(t, T.confirm, 0.3);
    R.q.style.transform = `scale(${qk})`; R.q.style.opacity = t < T.deny ? qk : 0;
    R.q._btns[0].classList.toggle('hover', t > T.yes - 0.3);
    R.q._btns[0].classList.toggle('down', t > T.yes - 0.02 && t < T.yes + 0.1);
    const nk = pop(t, T.deny, 0.25);
    const shakeX = t > T.deny ? Math.sin(t * 70) * 14 * Math.exp(-(t - T.deny) * 5) : 0;
    R.no.style.transform = `translateX(${shakeX}px) scale(${nk})`; R.no.style.opacity = t < T.spin + 0.15 ? nk * (1 - prog(t, T.spin - 0.05, T.spin + 0.15)) : 0;
    // cursor: from right to the "press" button, then to ДА
    const c1 = E.inOutCubic(prog(t, a + 0.7, T.press - 0.08)), c2 = E.inOutCubic(prog(t, T.confirm + 0.15, T.yes - 0.1));
    const bx = 760 + 10, by = 930 + 10, yx = R.q.offsetLeft + R.q._btns[0].offsetLeft + 90, yy = R.q.offsetTop + R.q._btns[0].offsetTop + 30;
    const cx = kf(c1, [[0, 1750], [1, bx]], E.lin) + (yx - bx) * c2, cy = kf(c1, [[0, 1150], [1, by]], E.lin) + (yy - by) * c2;
    const down = (t > T.press - 0.04 && t < T.press + 0.1) || (t > T.yes - 0.04 && t < T.yes + 0.1);
    tf(R.cur, { x: cx, y: cy, s: down ? 0.86 : 1, o: t > a + 0.65 && t < T.deny ? 1 : 0 });
    R.card.update(lt, 0.1, 0.95);
    R.ask.update(t - a, T.ask - a, T.card + 0.2 - a);
    R.coup.update(t - a, T.coup - a, D + 1, 2);
    clear(R.g);
    if (t > T.flip) speedLines(R.g, t, { radial: true, x: 960, y: 540, n: 50, alpha: 0.6 * (1 - prog(t, T.flipEnd, T.flipEnd + 0.3)), seed: 4 });
    if (t > T.spin) burst(R.g, t, T.spin, { x: 960, y: 500, n: 30, speed: 1200, size: 80, shape: 'emoji', chars: MEMES, grav: 600, life: 1.6, seed: 9 });
  },
};

// ---------------- kapustka [Бледный] ----------------
const K = {};
export const kapustka = {
  name: 'kapustka', range: SCENES.kapustka, z: 2,
  cues: (() => { const a = SCENES.kapustka[0]; return [[a - 0.05, 'whoosh', 0.8], [a + 0.3, 'cash', 1.0], [a + 0.35, 'boomsoft', 0.5], [a + 0.75, 'scan', 0.8], [a + 1.25, 'coin', 0.7], [a + 1.95, 'slam', 0.8]]; })(),
  build(root) {
    K.bd = backdrop(root, { top: '#06240a', bottom: '#000', floor: '#39ff14', wall: false });
    K.g0 = layer(root);
    K.cam = el('div', 'cam', root);
    K.fig = figure(K.cam, 'kapustka', { size: 250, body: '#0c3d12', glow: '#39ff14' });
    K.case = el('div', 'case', K.cam, '<div class="case-lid"></div><div class="case-box"><span>💵💵💵</span></div>');
    K.scan = el('div', 'scanbox', root, '<i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><div class="scan-l">SWAG обнаружен</div>');
    K.cap = caption(root, 'Капуста есть. <b>Порядка нет.</b>', 960, 980);
    K.name = el('div', 'kap-name title', root); K.name.textContent = 'kapustka [Бледный]';
    K.g = layer(root, 'top');
  },
  update(t, lt) {
    const [a, e] = SCENES.kapustka, D = e - a;
    const fly = E.outCubic(prog(lt, 0, 0.45));
    // orbit around the hero
    camera(K.cam, { ry: kf(lt, [[0, -30], [D, 25]], E.inOutCubic), rx: kf(lt, [[0, 10], [D, -4]]), s: kf(lt, [[0, 1.25], [0.5, 1.0, E.outCubic], [D, 1.05]]), sh: 3 + (1 - fly) * 20, t });
    K.bd.update(t, { speed: 200 });
    placeFig(K.fig, { x: 900 + (1 - fly) * -1400, y: 860 + (1 - fly) * -300 + Math.sin(lt * 5) * 10, z: 0, rz: (1 - fly) * 25 });
    const ok = E.outBack(prog(lt, 0.25, 0.55));
    K.case.style.transform = `translate3d(${1090 + (1 - fly) * -1400}px, ${560 + Math.sin(lt * 5) * 10}px, 120px) rotateY(-20deg)`;
    K.case.querySelector('.case-lid').style.transform = `rotateX(${-ok * 110}deg)`;
    const sk = pop(lt, 0.75, 0.3);
    K.scan.style.opacity = sk * (1 - prog(lt, 1.9, 2.05));
    K.scan.style.transform = `translate(-50%,-50%) scale(${1.6 - sk * 0.6})`;
    K.name.style.opacity = pop(lt, 0.2, 0.3) * (1 - prog(lt, 1.8, 2.0));
    K.name.style.transform = `translate(-50%,0) skewX(-8deg) scale(${0.8 + pop(lt, 0.2, 0.3) * 0.2})`;
    K.cap.update(lt, 1.95, D + 1);
    clear(K.g0); clear(K.g);
    rain(K.g0, t, { n: 30, speed: 500, chars: ['🥬', '💵'], size: 70, seed: 2, alpha: 0.6 * prog(lt, 0.3, 0.8) });
    burst(K.g, t, a + 0.3, { x: 1150, y: 560, n: 60, speed: 1100, size: 90, shape: 'emoji', chars: ['🥬', '💵', '💸', '🥬'], grav: 700, life: 2.2, seed: 3, dir: -Math.PI / 2, spread: 2.4 });
    if (lt < 0.45) speedLines(K.g, t, { n: 50, speed: 5000, dir: -1, color: 'rgba(57,255,20,0.7)', seed: 2 });
  },
};
