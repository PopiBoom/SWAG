// Time-driven helpers: every visual state is a pure function of t, so seeking and frame export are exact.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
export const smooth = k => k * k * (3 - 2 * k);

export const E = {
  lin: k => k,
  inQuad: k => k * k,
  outQuad: k => 1 - (1 - k) * (1 - k),
  inOutQuad: k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  inCubic: k => k * k * k,
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outQuart: k => 1 - Math.pow(1 - k, 4),
  inOutQuart: k => (k < 0.5 ? 8 * k ** 4 : 1 - Math.pow(-2 * k + 2, 4) / 2),
  outExpo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inExpo: k => (k <= 0 ? 0 : Math.pow(2, 10 * k - 10)),
  inOutExpo: k => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2),
  outBack: k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  inBack: k => { const c = 1.7; return (c + 1) * k * k * k - c * k * k; },
  outElastic: k => (k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -9 * k) * Math.sin((k * 9 - 0.75) * (2 * Math.PI) / 3) + 1),
};

// keyframes: kf(t, [[t0, v0], [t1, v1, ease], ...]); values may be numbers or arrays
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ease] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const k = (ease || E.inOutCubic)(clamp((t - t0) / (t1 - t0)));
      return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], k)) : lerp(v0, v1, k);
    }
  }
  return keys[keys.length - 1][1];
}

// 0..1 entrance with overshoot, then optional exit
export function pop(t, t0, dur = 0.35, ease = E.outBack) { return ease(prog(t, t0, t0 + dur)); }
export function life(t, tin, tout, fin = 0.25, fout = 0.25) {
  return Math.min(prog(t, tin, tin + fin), 1 - prog(t, tout - fout, tout));
}

// deterministic random
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const noise1 = (x, seed = 0) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1;
};
// camera / shake helper: smooth wobble, amplitude a
export const shake = (t, a, freq = 18, seed = 1) => [noise1(t * freq, seed) * a, noise1(t * freq, seed + 9) * a];

export function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
export const css = (e, s) => { for (const k in s) e.style[k] = s[k]; return e; };

// set common transform/opacity quickly. o: {x,y,z,rx,ry,rz,s,sx,sy,o,blur,origin}
export function tf(e, o) {
  const s = o.s ?? 1;
  let tr = `translate3d(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px,${(o.z || 0).toFixed(2)}px)`;
  if (o.rz) tr += ` rotateZ(${o.rz.toFixed(3)}deg)`;
  if (o.ry) tr += ` rotateY(${o.ry.toFixed(3)}deg)`;
  if (o.rx) tr += ` rotateX(${o.rx.toFixed(3)}deg)`;
  if (o.sk) tr += ` skewX(${o.sk.toFixed(2)}deg)`;
  tr += ` scale(${((o.sx ?? 1) * s).toFixed(4)},${((o.sy ?? 1) * s).toFixed(4)})`;
  e.style.transform = tr;
  if (o.o != null) { const v = clamp(o.o); e.style.opacity = v.toFixed(3); e.style.visibility = v <= 0.001 ? 'hidden' : 'visible'; }
  if (o.blur != null) e.style.filter = o.blur > 0.15 ? `blur(${o.blur.toFixed(2)}px)` : 'none';
  return e;
}
export const show = (e, on) => { e.style.display = on ? '' : 'none'; };

// typed text: returns substring by chars per second
export const typed = (str, t, t0, cps = 30) => {
  const chars = [...str];
  const n = Math.floor(clamp((t - t0) * cps, 0, chars.length));
  return chars.slice(0, n).join('');
};
// set text only when changed (cheap per-frame)
export function txt(e, s) { if (e._t !== s) { e._t = s; e.textContent = s; } }
export function htm(e, s) { if (e._h !== s) { e._h = s; e.innerHTML = s; } }

// split text into spans for per-letter animation
export function letters(parent, str, cls = 'ch') {
  const out = [];
  for (const c of [...str]) { const s = el('span', cls, parent); s.textContent = c === ' ' ? ' ' : c; out.push(s); }
  return out;
}
export const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
