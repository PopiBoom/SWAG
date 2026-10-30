export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t) => Math.pow(clamp(t), 3);
export const easeInOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const easeInExpo = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10));
export const easeOutBack = (t, s = 1.7) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
// мягкий «удар»: 0 до t0, мгновенный пик, экспоненциальное затухание
export const pulse = (t, t0, decay = 6) => (t < t0 ? 0 : Math.exp(-(t - t0) * decay));
export const win = (t, a, b, fi = 0.3, fo = 0.3) => smooth(a, a + fi, t) * (1 - smooth(b - fo, b, t));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const hash2 = (a, b) => hash(a * 57.0 + b * 131.0);
// гладкий 1D шум
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}
// ступенчатый шум: значение меняется rate раз в секунду (для глитчей)
export const stepNoise = (t, rate, seed = 0) => hash(Math.floor(t * rate) + seed * 1000);

// камера-тряска: сумма октав
export const shake = (t, seed) => noise1(t * 7 + seed) * 0.6 + noise1(t * 17 + seed * 3) * 0.3 + noise1(t * 41 + seed * 7) * 0.1;

// печать текста: сколько символов видно при скорости cps с ускорением
export const typed = (str, t, t0, cps) => str.slice(0, Math.max(0, Math.floor((t - t0) * cps)));

const GL = '█▓▒░#@$%&*+=<>/\\|_-01ЖЩЫЮЯ';
export function scramble(str, k, seed = 0) {
  // k: 0 — исходная строка, 1 — полностью «битая»
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c !== ' ' && hash(i * 13.1 + seed) < k) out += GL[Math.floor(hash(i * 7.7 + seed * 3.3) * GL.length)];
    else out += c;
  }
  return out;
}
