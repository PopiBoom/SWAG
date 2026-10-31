// Core: deterministic helpers, canvas textures, post-processing pipeline.
import * as THREE from 'three';

export const Q = new URLSearchParams(location.search);
export const SCALE = +(Q.get('scale') || 1);
export const W = 1080, H = 1920;               // design units (UI coordinates)
export const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE); // render size

// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const smoother = (a, b, x) => { const t = inv(a, b, x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const eOutCubic = t => 1 - Math.pow(1 - clamp(t), 3);
export const eInCubic = t => Math.pow(clamp(t), 3);
export const eInOutCubic = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const eOutExpo = t => { t = clamp(t); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
export const eInExpo = t => { t = clamp(t); return t <= 0 ? 0 : Math.pow(2, 10 * t - 10); };
export const eOutBack = (t, s = 1.70158) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
export const eInOutSine = t => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); }
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function noise1(x) { const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
// smooth multi-octave wobble used for handheld camera feel
export function wobble(t, seed = 0, freq = 1) { return noise1(t * freq + seed * 17.3) * 0.6 + noise1(t * freq * 2.3 + seed * 5.1) * 0.3 + noise1(t * freq * 5.1 + seed * 2.7) * 0.1; }
// a camera path value that keeps velocity across keys (Catmull–Rom over [t,v] keys)
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
  let i = 0; while (t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]);
  const cr = (a, b, c, d) => {
    if (Array.isArray(b)) return b.map((_, k) => cr(a[k], b[k], c[k], d[k]));
    const m1 = (c - a) / ((p2[0] - p0[0]) || 1) * (p2[0] - p1[0]), m2 = (d - b) / ((p3[0] - p1[0]) || 1) * (p2[0] - p1[0]);
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * b + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * c + (u3 - u2) * m2;
  };
  return cr(p0[1], p1[1], p2[1], p3[1]);
}

// ---------------------------------------------------------------- canvas
// All 2D canvases are CPU-backed (willReadFrequently): GPU-backed 2D contexts can be silently lost under the
// software-GL renderer after very heavy frames, freezing their content.
export function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const orig = c.getContext.bind(c); c.getContext = (type, opts) => orig(type, type === '2d' ? { willReadFrequently: true, ...opts } : opts);
  return c;
}
export function canvasTex(c, { mip = true, aniso = 8, srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = mip; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function radial(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
}
// soft round sprite (for glows / smoke / particles)
export function glowTexture(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]) {
  const c = makeCanvas(size, size), x = c.getContext('2d');
  x.fillStyle = radial(x, size / 2, size / 2, size / 2, stops); x.fillRect(0, 0, size, size);
  return canvasTex(c, { mip: true });
}
export function smokeTexture(size = 256, seed = 1) {
  const c = makeCanvas(size, size), x = c.getContext('2d'); const r = rng(seed);
  for (let i = 0; i < 60; i++) {
    const px = size / 2 + (r() - .5) * size * .5, py = size / 2 + (r() - .5) * size * .5, rr = size * (.08 + r() * .22);
    x.fillStyle = radial(x, px, py, rr, [[0, `rgba(255,255,255,${.08 + r() * .1})`], [1, 'rgba(255,255,255,0)']]);
    x.fillRect(0, 0, size, size);
  }
  const m = x.getImageData(0, 0, size, size); // circular falloff mask
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const d = Math.hypot(i - size / 2, j - size / 2) / (size / 2); const k = (j * size + i) * 4 + 3;
    m.data[k] *= clamp(1 - d) ** 1.5;
  }
  x.putImageData(m, 0, 0);
  return canvasTex(c);
}

// ---------------------------------------------------------------- post-processing
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const FS_BRIGHT = `
uniform sampler2D tScene; uniform sampler2D tUI; uniform float threshold; uniform float uiBloom; uniform vec2 texel;
varying vec2 vUv;
vec3 pick(vec2 uv){ vec3 s = texture2D(tScene, uv).rgb; float l = max(max(s.r, s.g), s.b);
  vec3 b = s * smoothstep(threshold, threshold + 0.8, l);
  vec4 u = texture2D(tUI, uv); b += pow(u.rgb, vec3(2.2)) * u.a * uiBloom; return b; }
void main(){ vec2 o = texel * 0.5;
  gl_FragColor = vec4((pick(vUv + vec2(-o.x, -o.y)) + pick(vUv + vec2(o.x, -o.y)) + pick(vUv + vec2(-o.x, o.y)) + pick(vUv + o)) * 0.25, 1.); }`;
const FS_DOWN = `
uniform sampler2D t; uniform vec2 texel; varying vec2 vUv;
void main(){ vec2 h = texel; vec4 s = texture2D(t, vUv) * 4.;
  s += texture2D(t, vUv - h) + texture2D(t, vUv + h) + texture2D(t, vUv + vec2(h.x, -h.y)) + texture2D(t, vUv + vec2(-h.x, h.y));
  gl_FragColor = s / 8.; }`;
const FS_UP = `
uniform sampler2D tLow; uniform sampler2D tCur; uniform vec2 texel; uniform float mixCur; varying vec2 vUv;
void main(){ vec2 h = texel; vec4 s = vec4(0.);
  s += texture2D(tLow, vUv + vec2(-h.x * 2., 0.)); s += texture2D(tLow, vUv + vec2(-h.x, h.y)) * 2.;
  s += texture2D(tLow, vUv + vec2(0., h.y * 2.)); s += texture2D(tLow, vUv + vec2(h.x, h.y)) * 2.;
  s += texture2D(tLow, vUv + vec2(h.x * 2., 0.)); s += texture2D(tLow, vUv + vec2(h.x, -h.y)) * 2.;
  s += texture2D(tLow, vUv + vec2(0., -h.y * 2.)); s += texture2D(tLow, vUv + vec2(-h.x, -h.y)) * 2.;
  gl_FragColor = s / 12. + texture2D(tCur, vUv) * mixCur; }`;
const FS_FINAL = `
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tUI;
uniform vec2 res; uniform float time, frame, exposure, bloomStr, ca, glitch, scan, vign, grain, flash, fade, sat, crtOff, curv, uiCa, contrast;
uniform vec3 flashColor, tint, lift;
varying vec2 vUv;
float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main(){
  vec2 uv = vUv; float boost = 1.;
  if (curv > 0.) { vec2 c = uv * 2. - 1.; c *= 1. + curv * vec2(c.y * c.y, c.x * c.x) * .5; uv = c * .5 + .5; }
  if (crtOff > 0.) {
    float sy = mix(1., .003, smoothstep(0., .5, crtOff)); float sx = mix(1., .004, smoothstep(.5, 1., crtOff));
    uv = (uv - .5) / vec2(sx, sy) + .5; boost = 1. + 4. * smoothstep(0., .5, crtOff);
  }
  // glitch: horizontal block displacement
  float gt = floor(frame / 3.);
  if (glitch > 0.) {
    float bh = mix(18., 90., h11(gt * 1.7)) / res.y;
    float row = floor(uv.y / bh);
    float g = h21(vec2(row, gt));
    if (g < glitch * .55) uv.x += (h21(vec2(row * 3.1, gt + 7.)) - .5) * glitch * .22;
    if (h21(vec2(gt, 4.)) < glitch * .3) uv.y += (h11(gt) - .5) * .02 * glitch;
  }
  vec2 d = uv - .5; float k = ca * .0035 + glitch * .012;
  vec3 sc; sc.r = texture2D(tScene, uv + d * k).r; sc.g = texture2D(tScene, uv).g; sc.b = texture2D(tScene, uv - d * k).b;
  vec3 bl = texture2D(tBloom, uv).rgb;
  vec3 col = aces((sc * exposure + bl * bloomStr) * boost);
  col = toSRGB(col);
  float ku = k * uiCa;
  vec4 u = texture2D(tUI, uv); float ur = texture2D(tUI, uv + d * ku).r, ub = texture2D(tUI, uv - d * ku).b;
  vec3 uc = vec3(mix(u.r, ur, .85), u.g, mix(u.b, ub, .85));
  col = mix(col, uc * boost, u.a);
  // grade
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, sat);
  col = (col - .5) * contrast + .5;
  col = col * tint + lift * (1. - col);
  // scanlines + vignette + grain
  col *= 1. - scan * (.5 + .5 * sin(uv.y * res.y * 3.14159 * .5));
  vec2 vv = (vUv - .5) * vec2(1., 1.25); col *= mix(1., smoothstep(.95, .25, length(vv)), vign);
  col += (h21(vUv * res + frame * 1.37) - .5) * grain;
  col = mix(col, flashColor, flash);
  col *= 1. - fade;
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) col = vec3(0.);
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true, samples: +(Q.get('msaa') ?? 0) };
    this.rtScene = new THREE.WebGLRenderTarget(RW, RH, rtOpts);
    this.levels = [];
    let w = Math.round(RW / 2), h = Math.round(RH / 2);
    for (let i = 0; i < 5; i++) {
      this.levels.push({ w, h, down: new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false }), up: new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false }) });
      w = Math.max(2, Math.round(w / 2)); h = Math.max(2, Math.round(h / 2));
    }
    this.uiCanvas = makeCanvas(RW, RH);
    this.ui = this.uiCanvas.getContext('2d');
    this.uiTex = new THREE.CanvasTexture(this.uiCanvas); this.uiTex.colorSpace = THREE.NoColorSpace;
    this.uiTex.generateMipmaps = false; this.uiTex.minFilter = THREE.LinearFilter;
    this.quadScene = new THREE.Scene(); this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    const mk = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.mBright = mk(FS_BRIGHT, { tScene: { value: null }, tUI: { value: this.uiTex }, threshold: { value: 0.7 }, uiBloom: { value: 0.5 }, texel: { value: new THREE.Vector2(1 / RW, 1 / RH) } });
    this.mDown = mk(FS_DOWN, { t: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mUp = mk(FS_UP, { tLow: { value: null }, tCur: { value: null }, texel: { value: new THREE.Vector2() }, mixCur: { value: 1 } });
    this.u = {
      tScene: { value: this.rtScene.texture }, tBloom: { value: this.levels[0].up.texture }, tUI: { value: this.uiTex },
      res: { value: new THREE.Vector2(RW, RH) }, time: { value: 0 }, frame: { value: 0 }, exposure: { value: 1 }, bloomStr: { value: 0.9 },
      ca: { value: 0.6 }, glitch: { value: 0 }, scan: { value: 0 }, vign: { value: 0.6 }, grain: { value: 0.05 }, flash: { value: 0 },
      fade: { value: 0 }, sat: { value: 1 }, crtOff: { value: 0 }, curv: { value: 0 }, uiCa: { value: 0.6 }, contrast: { value: 1.05 },
      flashColor: { value: new THREE.Color(1, 1, 1) }, tint: { value: new THREE.Color(1, 1, 1) }, lift: { value: new THREE.Color(0.012, 0.006, 0.03) },
    };
    this.mFinal = mk(FS_FINAL, this.u);
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.quadScene, this.quadCam); }
  render(scene, camera, fx) {
    const r = this.r;
    r.setRenderTarget(this.rtScene); r.setClearColor(0x000000, 1); r.clear();
    if (scene && camera) r.render(scene, camera);
    this.uiTex.needsUpdate = true;
    // bloom chain
    this.mBright.uniforms.tScene.value = this.rtScene.texture;
    this.mBright.uniforms.threshold.value = fx.threshold ?? 0.7;
    this.mBright.uniforms.uiBloom.value = fx.uiBloom ?? 0.5;
    this.pass(this.mBright, this.levels[0].down);
    for (let i = 1; i < this.levels.length; i++) {
      const src = this.levels[i - 1].down; this.mDown.uniforms.t.value = src.texture;
      this.mDown.uniforms.texel.value.set(1 / src.width, 1 / src.height); this.pass(this.mDown, this.levels[i].down);
    }
    for (let i = this.levels.length - 2; i >= 0; i--) {
      const low = i === this.levels.length - 2 ? this.levels[i + 1].down : this.levels[i + 1].up;
      this.mUp.uniforms.tLow.value = low.texture; this.mUp.uniforms.tCur.value = this.levels[i].down.texture;
      this.mUp.uniforms.texel.value.set(0.5 / low.width, 0.5 / low.height); this.pass(this.mUp, this.levels[i].up);
    }
    const u = this.u;
    for (const k of ['exposure', 'bloomStr', 'ca', 'glitch', 'scan', 'vign', 'grain', 'flash', 'fade', 'sat', 'crtOff', 'curv', 'uiCa', 'contrast', 'time', 'frame'])
      if (fx[k] !== undefined) u[k].value = fx[k];
    u.flashColor.value.set(fx.flashColor ?? 0xffffff);
    if (fx.tint) u.tint.value.setRGB(...fx.tint); else u.tint.value.setRGB(1, 1, 1);
    if (fx.lift) u.lift.value.setRGB(...fx.lift); else u.lift.value.setRGB(0.012, 0.006, 0.03);
    this.pass(this.mFinal, null);
  }
}
