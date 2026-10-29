// Deterministic GPU particles: falling ash (with near-camera bokeh), embers, smoke billboards.
// Positions are pure functions of (seed, time) evaluated in the vertex shader.
import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { GLSL_NOISE } from './materials.js';

export function createAsh({ count = 2600, seed = 7, size = 1.0, color = new THREE.Color(0.85, 0.85, 0.88), ember = 0.0 } = {}) {
  const rnd = mulberry32(seed);
  const seeds = new Float32Array(count * 4), extra = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    extra.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  g.setAttribute('aExtra', new THREE.BufferAttribute(extra, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(8, 8, 8) },
      uSize: { value: size }, uColor: { value: color }, uEmber: { value: ember }, uEmberColor: { value: new THREE.Color(1.0, 0.18, 0.05) },
      uOpacity: { value: 1 }, uPixel: { value: 1 }, uFocus: { value: 3 }, uAperture: { value: 0.3 }, uFall: { value: 0.18 },
      uWind: { value: new THREE.Vector3(0.05, 0, 0) }, uBurst: { value: 0 }, uBurstOrigin: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed; attribute vec4 aExtra;
      uniform float uTime; uniform vec3 uCenter; uniform vec3 uBox; uniform float uSize; uniform float uPixel;
      uniform float uFocus; uniform float uAperture; uniform float uFall; uniform vec3 uWind; uniform float uEmber;
      uniform float uBurst; uniform vec3 uBurstOrigin;
      varying float vAlpha; varying float vEmber; varying float vBlur;
      void main(){
        float sp = mix(0.4, 1.4, aSeed.w);
        vec3 p = (aSeed.xyz - 0.5) * uBox;
        p.y = mod(p.y + uBox.y * 0.5 - uTime * uFall * sp, uBox.y) - uBox.y * 0.5;
        p.x += sin(uTime * (0.3 + aExtra.x * 0.5) + aExtra.y * 6.283) * 0.25 + uWind.x * uTime;
        p.z += cos(uTime * (0.25 + aExtra.z * 0.4) + aExtra.w * 6.283) * 0.2;
        p.x = mod(p.x + uBox.x * 0.5, uBox.x) - uBox.x * 0.5;
        p += normalize(aSeed.xyz - 0.5 + 0.001) * uBurst * mix(0.5, 2.0, aExtra.x);
        vec4 mv = modelViewMatrix * vec4(uCenter + p, 1.0);
        float d = -mv.z;
        float coc = abs(d - uFocus) / max(d, 0.01) * uAperture;
        vBlur = clamp(coc, 0.0, 1.0);
        float base = uSize * mix(0.6, 1.8, aExtra.z * aExtra.z) * uPixel;
        gl_PointSize = clamp(base * (26.0 / max(d, 0.05)) * (1.0 + vBlur * 5.0), 1.0, 70.0 * uPixel);
        vEmber = step(1.0 - uEmber, aExtra.w);
        vAlpha = mix(0.7, 0.06, vBlur) * smoothstep(0.15, 0.9, d) * mix(0.25, 1.0, aExtra.y);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform vec3 uEmberColor; uniform float uOpacity;
      varying float vAlpha; varying float vEmber; varying float vBlur;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = length(c);
        float soft = mix(0.18, 0.02, vBlur);
        float a = 1.0 - smoothstep(0.5 - soft - 0.12, 0.5, r);
        a *= mix(1.0, 0.65 + 0.35 * smoothstep(0.2, 0.48, r), vBlur);
        vec3 col = mix(uColor, uEmberColor * 4.0, vEmber);
        gl_FragColor = vec4(col * a * vAlpha * uOpacity, 1.0);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 10;
  return pts;
}

// Volumetric-looking smoke from camera-facing slabs with animated fbm; rises and curls.
export function createSmoke({ count = 26, seed = 3, color = new THREE.Color(0.03, 0.03, 0.035), lit = new THREE.Color(0.6, 0.05, 0.03) } = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uColor: { value: color }, uLit: { value: lit }, uLitAmt: { value: 0 }, uOpacity: { value: 1 },
      uRise: { value: 0.25 }, uSoft: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed; varying vec2 vUv; varying vec4 vSeed; uniform float uTime; uniform float uRise;
      void main(){
        vUv = uv; vSeed = aSeed;
        vec3 off = vec3(sin(uTime * 0.2 + aSeed.x * 6.28) * 0.3, mod(uTime * uRise * (0.5 + aSeed.y) + aSeed.z * 4.0, 4.0) - 1.0, 0.0);
        vec4 mvCenter = modelViewMatrix * vec4(instanceMatrix[3].xyz + off, 1.0);
        float s = length(instanceMatrix[0].xyz) * (1.0 + 0.25 * off.y);
        float a = uTime * 0.05 * (aSeed.w - 0.5) + aSeed.w * 6.28;
        vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy * s;
        mvCenter.xy += q;
        gl_Position = projectionMatrix * mvCenter;
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      varying vec2 vUv; varying vec4 vSeed; uniform float uTime; uniform vec3 uColor; uniform vec3 uLit; uniform float uLitAmt; uniform float uOpacity; uniform float uRise;
      float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * mm_vnoise(p); p *= 2.07; a *= 0.5; } return s; }
      void main(){
        vec2 c = vUv - 0.5; float r = length(c) * 2.0;
        float n = fbm(vec3(vUv * 2.2 + vSeed.xy * 10.0, uTime * 0.12 + vSeed.z * 5.0));
        float n2 = fbm(vec3(vUv * 5.0 - vec2(0.0, uTime * 0.15), vSeed.w * 7.0));
        float d = smoothstep(1.0, 0.15, r) * smoothstep(0.35, 0.8, n * 0.75 + n2 * 0.45);
        float riseLife = mod(uTime * uRise * (0.5 + vSeed.y) + vSeed.z * 4.0, 4.0);
        d *= smoothstep(0.0, 0.8, riseLife) * smoothstep(4.0, 2.4, riseLife);
        vec3 col = mix(uColor, uLit, uLitAmt * (1.0 - n2) * smoothstep(0.9, 0.0, r));
        gl_FragColor = vec4(col, d * uOpacity * 0.85);
      }`,
  });
  const geo = new THREE.PlaneGeometry(1, 1);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seeds.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const s = 1.2 + rnd() * 2.2;
    m.makeScale(s, s, s);
    m.setPosition((rnd() - 0.5) * 3.2, (rnd() - 0.5) * 1.0 - 0.8, (rnd() - 0.5) * 2.0);
    mesh.setMatrixAt(i, m);
  }
  mesh.renderOrder = 5;
  group.add(mesh);
  group.userData.mat = mat;
  return group;
}
