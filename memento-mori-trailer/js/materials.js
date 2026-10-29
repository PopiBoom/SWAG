// Physically based materials patched with custom GLSL: triplanar marble (scans have no UVs),
// procedural Voronoi cracks with red ember glow, cavity grime, and analytic shard explosion.
import * as THREE from 'three';

export const GLSL_NOISE = /* glsl */`
vec3 mm_hash33(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
float mm_vhash(vec3 p){ return fract(sin(p.x * 17.1 + p.y * 113.7 + p.z * 57.3) * 43758.5453); }
float mm_vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mm_vhash(i), b = mm_vhash(i + vec3(1,0,0)), c = mm_vhash(i + vec3(0,1,0)), d = mm_vhash(i + vec3(1,1,0));
  float e = mm_vhash(i + vec3(0,0,1)), f1 = mm_vhash(i + vec3(1,0,1)), g = mm_vhash(i + vec3(0,1,1)), h = mm_vhash(i + vec3(1,1,1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
vec3 mm_warp(vec3 x){
  const float w = 0.32;
  return x + w * (vec3(mm_vnoise(x * 1.7), mm_vnoise(x * 1.7 + vec3(31.4, 0.0, 0.0)), mm_vnoise(x * 1.7 + vec3(0.0, 17.2, 5.1))) - 0.5) * 2.0;
}
// single pass cellular noise: x = F2-F1 edge metric, yzw = feature point of the nearest cell
vec4 mm_voronoi(vec3 x){
  vec3 n = floor(x); vec3 f = fract(x);
  float d1 = 8.0, d2 = 8.0; vec3 c1 = vec3(0.0);
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = mm_hash33(n + g); vec3 r = g + o - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; c1 = n + g + o; } else if (d < d2) { d2 = d; }
  }
  return vec4((sqrt(d2) - sqrt(d1)) * 0.5, c1);
}
`;

// options: { textures:{color,rough,normal}, scale, cracks:bool, shards:bool, tint }
export function createMarbleMaterial(opts) {
  const { textures, scale = 1.1, tint = new THREE.Color(1, 1, 1), roughness = 1.0, cracks = true, shards = false, side = THREE.FrontSide, instanced = false } = opts;
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness, metalness: 0.0, side, envMapIntensity: 0.6 });
  const u = mat.userData.uniforms = {
    tMarbleColor: { value: textures.color }, tMarbleRough: { value: textures.rough }, tMarbleNormal: { value: textures.normal },
    uTriScale: { value: scale }, uNormalStrength: { value: 0.6 },
    uCrackOrigin: { value: new THREE.Vector3(0, 0.5, 0.6) }, uCrackGrowth: { value: -1 }, uCrackFine: { value: 0 },
    uCrackScale: { value: 3.4 }, uCrackWidth: { value: 0.013 }, uCrackGlow: { value: 0 }, uCrackGlowColor: { value: new THREE.Color(1.0, 0.07, 0.04) },
    uTime: { value: 0 }, uCavity: { value: 0.7 }, uDirt: { value: 0.35 }, uSheen: { value: 0.12 },
    uShatter: { value: 0 }, uShatterOrigin: { value: new THREE.Vector3() }, uShatterPower: { value: 1 }, uFall: { value: 0 },
  };
  mat.customProgramCacheKey = () => `marble-${cracks}-${shards}-${instanced}`;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float cavity;
        varying vec3 vObjPos; varying vec3 vObjNormal; varying float vCavity;
        uniform float uShatter; uniform vec3 uShatterOrigin; uniform float uShatterPower; uniform float uFall;
        ${shards ? 'attribute vec3 aShardCenter; attribute vec4 aShardRand;' : ''}
        mat3 mm_rot(vec3 axis, float a){ axis = normalize(axis); float s = sin(a), c = cos(a), oc = 1.0 - c;
          return mat3(oc*axis.x*axis.x + c, oc*axis.x*axis.y + axis.z*s, oc*axis.z*axis.x - axis.y*s,
                      oc*axis.x*axis.y - axis.z*s, oc*axis.y*axis.y + c, oc*axis.y*axis.z + axis.x*s,
                      oc*axis.z*axis.x + axis.y*s, oc*axis.y*axis.z - axis.x*s, oc*axis.z*axis.z + c); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vObjNormal = objectNormal; vCavity = ${instanced ? '0.0' : 'cavity'};
        ${shards ? `
        vec3 sDir = normalize(aShardCenter - uShatterOrigin + (aShardRand.xyz - 0.5) * 0.9);
        float sDist = length(aShardCenter - uShatterOrigin);
        float sSpeed = mix(0.7, 1.9, aShardRand.w) * uShatterPower / (0.6 + sDist);
        float sAng = uShatter * mix(1.5, 5.5, fract(aShardRand.w * 7.31)) * uShatterPower;
        mat3 sRot = mm_rot(aShardRand.xyz - 0.5 + vec3(0.01), sAng);
        objectNormal = sRot * objectNormal;` : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vObjPos = position;
        ${shards ? `transformed = aShardCenter + sRot * (position - aShardCenter) + sDir * sSpeed * uShatter + vec3(0.0, -0.22, 0.0) * uShatter * uShatter - vec3(0.0, uFall * (0.6 + 0.8 * fract(aShardRand.w * 13.7)), 0.0);` : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        ${GLSL_NOISE}
        uniform sampler2D tMarbleColor; uniform sampler2D tMarbleRough; uniform sampler2D tMarbleNormal;
        uniform float uTriScale; uniform float uNormalStrength; uniform mat3 normalMatrix;
        uniform vec3 uCrackOrigin; uniform float uCrackGrowth; uniform float uCrackFine; uniform float uCrackScale; uniform float uCrackWidth;
        uniform float uCrackGlow; uniform vec3 uCrackGlowColor; uniform float uTime; uniform float uCavity; uniform float uDirt; uniform float uSheen;
        varying vec3 vObjPos; varying vec3 vObjNormal; varying float vCavity;
        vec3 mmTriW(vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
        vec4 mmTri(sampler2D t, vec3 p, vec3 w){
          return texture2D(t, p.zy) * w.x + texture2D(t, p.xz + 0.37) * w.y + texture2D(t, p.xy + 0.71) * w.z;
        }
        float mmCrack(out float glowMask){
          glowMask = 0.0;
          if (uCrackGrowth <= 0.0) return 0.0;
          if (length(vObjPos - uCrackOrigin) * 0.85 - 0.2 > uCrackGrowth) return 0.0;
          vec3 p = mm_warp(vObjPos * uCrackScale);
          vec4 v = mm_voronoi(p);
          vec3 cellCenter = v.yzw / uCrackScale;
          float cellRand = fract(sin(dot(v.yzw, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float dist = length(vObjPos - uCrackOrigin) * (0.85 + 0.3 * cellRand) + 0.18 * mm_vnoise(vObjPos * 5.0);
          float grow = uCrackGrowth - dist;
          float on = smoothstep(0.0, 0.08, grow);
          float w = uCrackWidth * (0.35 + 0.65 * clamp(grow * 1.5, 0.0, 1.0)) * (0.6 + 0.8 * mm_vnoise(vObjPos * 9.0));
          float line = 1.0 - smoothstep(w * 0.35, w, v.x);
          float core = 1.0 - smoothstep(w * 0.02, w * 0.3, v.x);
          float halo = 1.0 - smoothstep(w, w * 2.6, v.x);
          float fine = 0.0;
          if (uCrackFine > 0.0) {
            vec4 v2 = mm_voronoi(mm_warp(vObjPos * uCrackScale * 2.7 + 11.0));
            float w2 = uCrackWidth * 0.45;
            fine = (1.0 - smoothstep(w2 * 0.4, w2, v2.x)) * smoothstep(0.0, 0.2, grow - 0.15) * uCrackFine * step(0.45, cellRand + 0.3 * mm_vnoise(vObjPos * 3.0));
          }
          float c = max(line * on, fine);
          glowMask = max(core * on, fine * 0.5) * (0.55 + 0.45 * mm_vnoise(vec3(vObjPos * 6.0) + uTime * 0.7));
          return clamp(c + halo * on * 0.22, 0.0, 1.0);
        }`)
      .replace('#include <map_fragment>', `
        vec3 mmP = vObjPos * uTriScale;
        vec3 mmW = mmTriW(normalize(vObjNormal));
        vec3 mmCol = mmTri(tMarbleColor, mmP, mmW).rgb;
        float mmLarge = mm_vnoise(vObjPos * 2.3) * 0.6 + mm_vnoise(vObjPos * 6.1) * 0.4;
        mmCol *= mix(0.86, 1.04, mmLarge);
        mmCol = mix(mmCol, mmCol * vec3(0.78, 0.74, 0.68), uDirt * smoothstep(0.35, 0.8, mm_vnoise(vObjPos * 3.3 + 4.0)));
        float mmCav = clamp(vCavity, 0.0, 1.0) * uCavity;
        mmCol *= 1.0 - 0.62 * mmCav;
        float mmGlow; float mmCr = mmCrack(mmGlow);
        mmCol *= 1.0 - 0.93 * mmCr;
        // inside faces of broken shards read as raw, darker fractured stone
        if (!gl_FrontFacing) mmCol *= vec3(0.42, 0.4, 0.38) * (0.8 + 0.4 * mm_vnoise(vObjPos * 40.0));
        diffuseColor.rgb *= mmCol;`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness * mix(0.32, 0.72, mmTri(tMarbleRough, mmP, mmW).g);
        roughnessFactor = mix(roughnessFactor, 0.95, max(mmCr, mmCav * 0.6));`)
      .replace('#include <normal_fragment_maps>', `
        {
          vec3 n0 = normalize(vObjNormal);
          vec3 nx = texture2D(tMarbleNormal, mmP.zy).xyz * 2.0 - 1.0;
          vec3 ny = texture2D(tMarbleNormal, mmP.xz + 0.37).xyz * 2.0 - 1.0;
          vec3 nz = texture2D(tMarbleNormal, mmP.xy + 0.71).xyz * 2.0 - 1.0;
          nx = vec3(nx.xy * uNormalStrength + n0.zy, abs(nx.z) * n0.x);
          ny = vec3(ny.xy * uNormalStrength + n0.xz, abs(ny.z) * n0.y);
          nz = vec3(nz.xy * uNormalStrength + n0.xy, abs(nz.z) * n0.z);
          vec3 objN = normalize(nx.zyx * mmW.x + ny.xzy * mmW.y + nz.xyz * mmW.z);
          objN = mix(n0, objN, 1.0 - mmCr * 0.5);
          normal = normalize(normal + normalMatrix * (objN - n0) * faceDirection);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uCrackGlowColor * mmGlow * uCrackGlow;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          float mmFres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
          reflectedLight.indirectDiffuse += diffuseColor.rgb * uSheen * mmFres * (1.0 - mmCr);
          reflectedLight.directDiffuse *= 1.0 + 0.25 * uSheen;
        }`);
  };
  return mat;
}

// Per-vertex concavity estimate from the 1-ring (scans ship without AO); smoothed a few times.
export function computeCavity(geometry, iterations = 3, strength = 1.0) {
  const pos = geometry.attributes.position, nrm = geometry.attributes.normal, idx = geometry.index;
  const n = pos.count;
  const sum = new Float32Array(n * 3), cnt = new Float32Array(n), edge = new Float32Array(n);
  const a = idx.array;
  for (let i = 0; i < a.length; i += 3) {
    for (let e = 0; e < 3; e++) {
      const v0 = a[i + e], v1 = a[i + (e + 1) % 3];
      for (const [p, q] of [[v0, v1], [v1, v0]]) {
        sum[p * 3] += pos.getX(q); sum[p * 3 + 1] += pos.getY(q); sum[p * 3 + 2] += pos.getZ(q); cnt[p]++;
        const dx = pos.getX(q) - pos.getX(p), dy = pos.getY(q) - pos.getY(p), dz = pos.getZ(q) - pos.getZ(p);
        edge[p] += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
    }
  }
  let cav = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!cnt[i]) continue;
    const mx = sum[i * 3] / cnt[i] - pos.getX(i), my = sum[i * 3 + 1] / cnt[i] - pos.getY(i), mz = sum[i * 3 + 2] / cnt[i] - pos.getZ(i);
    const el = edge[i] / cnt[i] + 1e-6;
    cav[i] = (mx * nrm.getX(i) + my * nrm.getY(i) + mz * nrm.getZ(i)) / el; // >0 concave
  }
  // smooth over the 1-ring
  const adj = [];
  for (let it = 0; it < iterations; it++) {
    const next = new Float32Array(n), c2 = new Float32Array(n);
    for (let i = 0; i < a.length; i += 3) {
      for (let e = 0; e < 3; e++) { const p = a[i + e]; for (let f = 0; f < 3; f++) { const q = a[i + f]; next[p] += cav[q]; c2[p]++; } }
    }
    for (let i = 0; i < n; i++) next[i] = c2[i] ? next[i] / c2[i] : 0;
    cav = next;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, cav[i] * 3.2 * strength));
  geometry.setAttribute('cavity', new THREE.BufferAttribute(out, 1));
  return adj;
}
