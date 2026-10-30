import * as THREE from 'three';
import { clamp } from './util.js';

// Камера по ключам с непрерывной скоростью (Catmull-Rom по времени).
// key: { t, p:[x,y,z], l:[x,y,z], fov, roll }
function cr(p0, p1, p2, p3, t0, t1, t2, t3, t) {
  // центростремительный вариант по времени: касательные из соседних ключей
  const m1 = (p2 - p0) / Math.max(1e-4, t2 - t0) * (t2 - t1);
  const m2 = (p3 - p1) / Math.max(1e-4, t3 - t1) * (t2 - t1);
  const u = t, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
}
export function sampleKeys(keys, t, field) {
  if (t <= keys[0].t) return keys[0][field];
  const n = keys.length;
  if (t >= keys[n - 1].t) return keys[n - 1][field];
  let i = 0; while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const u = clamp((t - k1.t) / (k2.t - k1.t));
  const a = k1[field], b = k2[field];
  if (typeof a === 'number') return cr(k0[field], a, b, k3[field], k0.t, k1.t, k2.t, k3.t, u);
  return a.map((_, j) => cr(k0[field][j], a[j], b[j], k3[field][j], k0.t, k1.t, k2.t, k3.t, u));
}
export function applyCam(cam, keys, t, extra = {}) {
  const p = sampleKeys(keys, t, 'p'), l = sampleKeys(keys, t, 'l');
  cam.position.set(p[0] + (extra.dx || 0), p[1] + (extra.dy || 0), p[2] + (extra.dz || 0));
  cam.up.set(0, 1, 0);
  cam.lookAt(l[0] + (extra.lx || 0), l[1] + (extra.ly || 0), l[2] + (extra.lz || 0));
  const roll = (keys[0].roll !== undefined ? sampleKeys(keys, t, 'roll') : 0) + (extra.roll || 0);
  cam.rotateZ(roll);
  if (keys[0].fov !== undefined) { cam.fov = sampleKeys(keys, t, 'fov'); cam.updateProjectionMatrix(); }
  return cam;
}

export function canvasTex(w, h) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
  return { canvas, ctx, tex };
}

// материал «экрана»: самосвечение + лёгкие линии развёртки + виньетка
export function screenMaterial(tex, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, gain: { value: o.gain ?? 1.4 }, time: { value: 0 }, flicker: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) }, opacity: { value: 1 } },
    transparent: !!o.transparent, depthWrite: !o.transparent, side: o.side ?? THREE.FrontSide,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float gain, time, flicker, opacity; uniform vec3 tint; varying vec2 vUv;
      void main(){ vec4 c = texture2D(map, vUv); float s = 0.82 + 0.18 * sin(vUv.y * 900.0);
        vec2 d = vUv - 0.5; float v = 1.0 - smoothstep(0.3, 0.75, length(d));
        float f = 1.0 - flicker * fract(sin(floor(time * 30.0) * 91.7) * 4375.5) ;
        gl_FragColor = vec4(c.rgb * gain * s * (0.6 + 0.4 * v) * f * tint, c.a * opacity); }`,
  });
}

// голографический материал: аддитивный, со сканлайнами и дрожанием
export function holoMaterial(tex, color = [0.22, 1, 0.08], o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, color: { value: new THREE.Vector3(...color) }, time: { value: 0 }, opacity: { value: 1 }, glitch: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float time, opacity, glitch; varying vec2 vUv;
      float h(float p){ return fract(sin(p*127.1)*43758.5453); }
      void main(){ vec2 uv = vUv; float row = floor(uv.y * 40.0);
        uv.x += (h(row + floor(time*20.0)) - 0.5) * 0.08 * glitch * step(0.7, h(row*3.0 + floor(time*12.0)));
        vec4 c = texture2D(map, uv);
        float scan = 0.65 + 0.35 * sin(vUv.y * 300.0 - time * 8.0);
        float a = c.a * opacity * scan;
        gl_FragColor = vec4(c.rgb * color * a * ${o.gain ?? '1.6'}, a); }`,
  });
}

// объёмный луч света: конус с затуханием к краям и по длине
export function beamMaterial(color = [0.6, 1, 0.5], strength = 0.25) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Vector3(...color) }, strength: { value: strength }, time: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vY = uv.y; vec4 wp = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-wp.xyz); gl_Position = projectionMatrix*wp; }`,
    fragmentShader: `uniform vec3 color; uniform float strength, time; varying vec3 vN; varying vec3 vV; varying float vY;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ float rim = pow(abs(dot(vN, vV)), 2.0); float fall = pow(vY, 1.6);
        float dust = 0.85 + 0.15 * h(floor(gl_FragCoord.xy / 3.0) + floor(time * 8.0));
        gl_FragColor = vec4(color * rim * fall * strength * dust, 1.0); }`,
  });
}

// точки-частицы с размером по глубине
export function pointsMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { size: { value: o.size ?? 3 }, opacity: { value: o.opacity ?? 1 }, color: { value: new THREE.Vector3(...(o.color || [0.22, 1, 0.08])) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float size; void main(){ vC = aColor; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size * aSize * (300.0 / -mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float opacity; uniform vec3 color; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)); gl_FragColor = vec4(color * vC * a * opacity, 1.0); }`,
  });
}

// сэмплирование точек по растру текста (для сборки заголовков из частиц)
export function textPoints(str, font, size, step = 4, maxW = 1800) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${size}px ${font}`;
  const w = Math.min(maxW, Math.ceil(ctx.measureText(str).width) + 20), h = Math.ceil(size * 1.4);
  c.width = w; c.height = h;
  ctx.font = `${size}px ${font}`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(str, w / 2, h / 2);
  const d = ctx.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] > 128) pts.push([(x - w / 2), (h / 2 - y)]);
  return { pts, w, h };
}

export function setOpacity(mat, a) { if (mat.uniforms && mat.uniforms.opacity) mat.uniforms.opacity.value = a; else { mat.opacity = a; mat.transparent = true; } }
