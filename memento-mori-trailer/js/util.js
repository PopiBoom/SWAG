// Shared math + timeline helpers. Everything here is pure: the same t always yields the same value.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = invLerp(a, b, x); return t * t * (3 - 2 * t); };
export const smoother = (a, b, x) => { const t = invLerp(a, b, x); return t * t * t * (t * (t * 6 - 15) + 10); };

export const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inQuart: t => t * t * t * t,
  inOutQuart: t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: t => Math.sin((t * Math.PI) / 2),
  outBack: (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

// Keyframe track: [[time, value, easeName?], ...]; ease applies to the segment that ends at that key.
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const k = (ease[e] || ease.inOutCubic)((t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((a, j) => lerp(a, v1[j], k));
      return lerp(v0, v1, k);
    }
  }
  return keys[keys.length - 1][1];
}

// Critically damped spring response to a unit step at t0 (overshoot via zeta < 1).
export function spring(t, t0, freq = 2.2, zeta = 0.55) {
  if (t <= t0) return 0;
  const x = t - t0, w = 2 * Math.PI * freq;
  if (zeta >= 1) return 1 - (1 + w * x) * Math.exp(-w * x);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + (zeta * w / wd) * Math.sin(wd * x));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise for camera handheld drift (deterministic).
function h1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h1(i), h1(i + 1), u) * 2 - 1;
}
export const fbm1 = (x, seed = 0) => noise1(x + seed) * 0.6 + noise1(x * 2.13 + seed * 1.7) * 0.28 + noise1(x * 4.37 + seed * 2.9) * 0.12;

// Same hash as the GLSL crack shader so shards split exactly along the drawn cracks.
const fr = x => x - Math.floor(x);
export function hash33(x, y, z) {
  const a = x * 127.1 + y * 311.7 + z * 74.7, b = x * 269.5 + y * 183.3 + z * 246.1, c = x * 113.5 + y * 271.9 + z * 124.6;
  return [fr(Math.sin(a) * 43758.5453123), fr(Math.sin(b) * 43758.5453123), fr(Math.sin(c) * 43758.5453123)];
}
function vhash(x, y, z) { return fr(Math.sin(x * 17.1 + y * 113.7 + z * 57.3) * 43758.5453); }
export function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => vhash(ix + a, iy + b, iz + d);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), ux), x10 = lerp(c(0, 1, 0), c(1, 1, 0), ux);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), ux), x11 = lerp(c(0, 1, 1), c(1, 1, 1), ux);
  return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
}
// Warp used by both the crack shader and the shard partition.
export function crackWarp(x, y, z) {
  const w = 0.32;
  return [
    x + w * (vnoise3(x * 1.7, y * 1.7, z * 1.7) - 0.5) * 2,
    y + w * (vnoise3(x * 1.7 + 31.4, y * 1.7, z * 1.7) - 0.5) * 2,
    z + w * (vnoise3(x * 1.7, y * 1.7 + 17.2, z * 1.7 + 5.1) - 0.5) * 2,
  ];
}
export function voronoiCell(x, y, z) {
  const nx = Math.floor(x), ny = Math.floor(y), nz = Math.floor(z);
  let best = 1e9, id = null;
  for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const o = hash33(nx + i, ny + j, nz + k);
    const rx = i + o[0] - (x - nx), ry = j + o[1] - (y - ny), rz = k + o[2] - (z - nz);
    const d = rx * rx + ry * ry + rz * rz;
    if (d < best) { best = d; id = [nx + i, ny + j, nz + k, nx + i + o[0], ny + j + o[1], nz + k + o[2]]; }
  }
  return id; // integer cell + feature point
}
