// Shared scene furniture: backdrop with neon floor, hero title card, whip-in camera, caption timing.
import { el, tf, kf, E, pop, prog, clamp, shake, life } from '../core.js';
import { bubble, plate, nick } from '../ui.js';

// background: gradient + perspective neon floor + far chat wall
export function backdrop(root, { top = '#0a0614', bottom = '#000', floor = '#39ff14', wall = true } = {}) {
  const bg = el('div', 'bd', root);
  bg.style.background = `radial-gradient(ellipse at 50% 30%, ${top}, ${bottom} 75%)`;
  const fl = el('div', 'bd-floor', root);
  fl.style.setProperty('--fc', floor);
  let w = null;
  if (wall) {
    w = el('div', 'bd-wall', root);
    for (let i = 0; i < 18; i++) {
      const r = el('div', 'bd-row' + (i % 3 === 1 ? ' out' : ''), w);
      r.style.width = (220 + ((i * 137) % 420)) + 'px';
    }
  }
  return {
    update(t, { fx = 0, fy = 0, speed = 120 } = {}) {
      fl.style.backgroundPosition = `${fx}px ${(t * speed) % 120}px`;
      if (w) w.style.transform = `translate(-50%, ${(-((t * 40) % 140)).toFixed(1)}px) translateZ(-1400px)`;
    }, bg, fl, wall: w,
  };
}

// GTA-style character intro: diagonal colour band + huge nick + class line
export function heroCard(root, m, role, color = '#39ff14') {
  const c = el('div', 'herocard', root);
  c.style.setProperty('--hc', color);
  const band = el('div', 'hc-band', c);
  const nm = el('div', 'hc-name title', c); nick(m, nm);
  const rl = el('div', 'hc-role', c, role);
  return {
    update(lt, tin = 0.1, tout = 1.25) {
      const k = E.outExpo(prog(lt, tin, tin + 0.35)), ko = E.inCubic(prog(lt, tout - 0.3, tout));
      band.style.transform = `skewX(-18deg) scaleX(${(k * (1 - ko)).toFixed(3)})`;
      tf(nm, { x: (1 - k) * -500 + ko * 900, o: k * (1 - ko), sk: -8 });
      tf(rl, { x: (1 - k) * 500 - ko * 900, o: k * (1 - ko) });
      c.style.visibility = lt < tout + 0.05 ? 'visible' : 'hidden';
    },
  };
}

// camera entry: horizontal whip from the side with blur; returns {x, blur}
export function whipIn(lt, dur = 0.32, dir = 1, dist = 1400) {
  const k = E.outCubic(prog(lt, 0, dur));
  return { x: (1 - k) * dist * dir, blur: (1 - k) * 18 };
}
export function whipOut(lt, end, dur = 0.22, dir = -1, dist = 1400) {
  const k = E.inCubic(prog(lt, end - dur, end));
  return { x: k * dist * dir, blur: k * 18 };
}

// caption plate placed at x,y (centre), with pop-in and optional exit
export function caption(root, html, x, y, cls = '') {
  const p = plate(root, html, cls);
  p.style.left = x + 'px'; p.style.top = y + 'px';
  return {
    el: p,
    update(lt, tin, tout = 1e9, rz = -2) {
      const k = pop(lt, tin, 0.32), ko = prog(lt, tout - 0.15, tout);
      p.style.transform = `translate(-50%,-50%) rotate(${(rz + (1 - k) * 8).toFixed(2)}deg) scale(${(0.4 + 0.6 * k) * (1 - ko * 0.3)})`;
      p.style.opacity = (clamp(k * 2) * (1 - ko)).toFixed(3);
      p.style.visibility = lt >= tin && lt < tout ? 'visible' : 'hidden';
    },
  };
}

// Telegram bubble that pops from a point
export function popBubble(root, m, text, x, y, opts = {}) {
  const w = bubble(root, m, text, opts);
  w.style.left = x + 'px'; w.style.top = y + 'px';
  return {
    el: w,
    update(lt, tin, tout = 1e9) {
      const k = pop(lt, tin, 0.35), ko = prog(lt, tout - 0.15, tout);
      w.style.transform = `translate(-50%,-50%) translateY(${(1 - k) * 60}px) scale(${(0.5 + 0.5 * k) * (1 - 0.2 * ko)})`;
      w.style.opacity = (clamp(k * 2) * (1 - ko)).toFixed(3);
      w.style.visibility = lt >= tin && lt < tout ? 'visible' : 'hidden';
    },
  };
}

// telegram service pill ("X вошёл в чат")
export function servicePill(root, html, x, y) {
  const p = el('div', 'svc', root, html);
  p.style.left = x + 'px'; p.style.top = y + 'px';
  return {
    el: p,
    update(lt, tin, tout = 1e9) {
      const k = pop(lt, tin, 0.3), ko = prog(lt, tout - 0.15, tout);
      p.style.transform = `translate(-50%,-50%) scale(${0.6 + 0.4 * k})`;
      p.style.opacity = (k * (1 - ko)).toFixed(3);
      p.style.visibility = lt >= tin && lt < tout ? 'visible' : 'hidden';
    },
  };
}

// camera transform helper on a .cam element: position, orbit, zoom, plus shake
export function camera(cam, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, blur = 0, sh = 0, t = 0 }) {
  const [sx, sy] = sh ? shake(t, sh) : [0, 0];
  cam.style.transform = `translate3d(${(x + sx).toFixed(1)}px,${(y + sy).toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${s.toFixed(4)})`;
  cam.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
}

// figure placement: anchor at feet (x, y), with bob/squash
export function placeFig(f, { x, y, z = 0, s = 1, ry = 0, rz = 0, o = 1, sq = 0 }) {
  const sz = parseFloat(f.style.getPropertyValue('--sz'));
  f.style.left = (x - sz / 2) + 'px'; f.style.top = (y - sz * 2) + 'px';
  f.style.transformOrigin = '50% 100%';
  f.style.transform = `translateZ(${z}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${(s * (1 + sq)).toFixed(4)}, ${(s * (1 - sq)).toFixed(4)})`;
  f.style.opacity = o; f.style.visibility = o > 0.01 ? 'visible' : 'hidden';
}
// drop-in from above with squash on landing; returns {y offset, sq}
export function dropIn(lt, tin, h = 900) {
  const k = prog(lt, tin, tin + 0.38);
  const y = -h * (1 - E.inQuad(k));
  const land = lt - (tin + 0.38);
  const sq = land > 0 ? Math.exp(-land * 9) * Math.sin(land * 30) * 0.18 : -0.08 * k;
  return { y, sq };
}
