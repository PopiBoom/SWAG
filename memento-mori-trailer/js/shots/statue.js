// Scenes 1-2: Seneca emerges from darkness, cracks spread, the bust shatters along those cracks.
import * as THREE from 'three';
import { createMarbleMaterial } from '../materials.js';
import { crackWarp, voronoiCell, mulberry32, track, smooth, clamp, fbm1, lerp } from '../util.js';

const CRACK_SCALE = 2.7;

// Split the scan into shards using the same warped Voronoi cells the crack shader draws.
function buildShards(geo) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal, cav = geo.attributes.cavity, idx = geo.index.array;
  const triCount = idx.length / 3;
  const cellOf = new Map();
  const triCell = new Int32Array(triCount);
  const centers = [];
  for (let t = 0; t < triCount; t++) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { const v = idx[t * 3 + k]; cx += pos.getX(v); cy += pos.getY(v); cz += pos.getZ(v); }
    cx /= 3; cy /= 3; cz /= 3;
    const w = crackWarp(cx * CRACK_SCALE, cy * CRACK_SCALE, cz * CRACK_SCALE);
    const c = voronoiCell(w[0], w[1], w[2]);
    const key = `${c[0]},${c[1]},${c[2]}`;
    let id = cellOf.get(key);
    if (id === undefined) { id = centers.length; cellOf.set(key, id); centers.push([0, 0, 0, 0]); }
    triCell[t] = id;
    const ce = centers[id]; ce[0] += cx; ce[1] += cy; ce[2] += cz; ce[3]++;
  }
  for (const c of centers) { c[0] /= c[3]; c[1] /= c[3]; c[2] /= c[3]; }
  const rnd = mulberry32(99);
  const rands = centers.map(() => [rnd(), rnd(), rnd(), rnd()]);
  const P = new Float32Array(triCount * 9), N = new Float32Array(triCount * 9), C = new Float32Array(triCount * 3);
  const SC = new Float32Array(triCount * 9), SR = new Float32Array(triCount * 12);
  for (let t = 0; t < triCount; t++) {
    const id = triCell[t], ce = centers[id], ra = rands[id];
    for (let k = 0; k < 3; k++) {
      const v = idx[t * 3 + k], o = t * 3 + k;
      P[o * 3] = pos.getX(v); P[o * 3 + 1] = pos.getY(v); P[o * 3 + 2] = pos.getZ(v);
      N[o * 3] = nrm.getX(v); N[o * 3 + 1] = nrm.getY(v); N[o * 3 + 2] = nrm.getZ(v);
      C[o] = cav.getX(v);
      SC[o * 3] = ce[0]; SC[o * 3 + 1] = ce[1]; SC[o * 3 + 2] = ce[2];
      SR.set(ra, o * 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('cavity', new THREE.BufferAttribute(C, 1));
  g.setAttribute('aShardCenter', new THREE.BufferAttribute(SC, 3));
  g.setAttribute('aShardRand', new THREE.BufferAttribute(SR, 4));
  g.computeBoundingSphere();
  g.boundingSphere.radius *= 6;
  return { geometry: g, shardCount: centers.length, centers };
}

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const rnd = mulberry32(seed);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    // displace shared corners consistently so the chip stays closed
    const k = Math.round(p.getX(i) * 97 + p.getY(i) * 57 + p.getZ(i) * 31);
    const r2 = mulberry32(seed * 131 + k)();
    const s = 0.6 + r2 * 0.7;
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.7, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  g.setAttribute('cavity', new THREE.BufferAttribute(new Float32Array(p.count), 1));
  return g;
}

export function createStatueShot(engine, A, rig) {
  const group = new THREE.Group();
  group.name = 'statue';
  const tex = A.marble;
  const geo = A.seneca;
  const mat = createMarbleMaterial({ textures: tex, scale: 1.25, cracks: true });
  const U = mat.userData.uniforms;
  U.uCrackScale.value = CRACK_SCALE;
  U.uCrackOrigin.value.set(0.02, 0.43, 0.62); // brow of Seneca's face (+z)
  const statue = new THREE.Mesh(geo, mat);
  statue.castShadow = true; statue.receiveShadow = true;
  const statueRig = new THREE.Group();
  statueRig.add(statue);
  statueRig.scale.setScalar(1.0);
  group.add(statueRig);

  // shards for the shatter
  const shards = buildShards(geo);
  const shardMat = createMarbleMaterial({ textures: tex, scale: 1.25, cracks: true, shards: true, side: THREE.DoubleSide });
  const SU = shardMat.userData.uniforms;
  SU.uCrackScale.value = CRACK_SCALE;
  SU.uCrackOrigin.value.copy(U.uCrackOrigin.value);
  SU.uShatterOrigin.value.set(0.0, 0.38, 0.35);
  const shardMesh = new THREE.Mesh(shards.geometry, shardMat);
  shardMesh.castShadow = true; shardMesh.receiveShadow = true; shardMesh.visible = false;
  shardMesh.frustumCulled = false;
  statueRig.add(shardMesh);

  // interior rubble so the shell reads as solid stone
  const rockMat = createMarbleMaterial({ textures: tex, scale: 3.0, cracks: false, instanced: true, roughness: 1.3 });
  rockMat.userData.uniforms.uCavity.value = 0;
  rockMat.flatShading = true;
  const ROCKS = 360;
  const rocks = new THREE.InstancedMesh(rockGeometry(5), rockMat, ROCKS);
  rocks.castShadow = true; rocks.frustumCulled = false; rocks.visible = false;
  const rnd = mulberry32(17);
  const rockData = [];
  const pa = geo.attributes.position, na = geo.attributes.normal;
  for (let i = 0; i < ROCKS; i++) {
    // sample just beneath the surface, biased to the face/upper half
    let v; do { v = Math.floor(rnd() * pa.count); } while (pa.getY(v) < -0.35 && rnd() < 0.7);
    const depth = 0.03 + rnd() * 0.22;
    const p = new THREE.Vector3(pa.getX(v) - na.getX(v) * depth, pa.getY(v) - na.getY(v) * depth, pa.getZ(v) - na.getZ(v) * depth);
    rockData.push({ p, s: 0.01 + Math.pow(rnd(), 2.6) * 0.05, fall: 0.6 + rnd() * 0.8, axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), w: 2 + rnd() * 7, sp: 0.6 + rnd() * 1.6, jit: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5) });
  }
  statueRig.add(rocks);

  const { key, rimA: rim, red } = rig;
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const origin = SU.uShatterOrigin.value;

  // bullet time: violent burst, then the debris hangs in the air
  const shatterTau = s => (s <= 0 ? 0 : 0.62 * (1 - Math.exp(-s / 0.16)) + 0.045 * s);

  function update(t, cam, fx) {
    const T = t;
    key.color.set(0xdfe6f0); key.angle = 0.3; key.penumbra = 0.85;
    key.position.set(-2.4, 4.4, 3.6); key.target.position.set(0, 0.5, 0.2);
    key.shadow.camera.near = 2; key.shadow.camera.far = 12;
    rim.color.set(0xc8d2e6); rim.angle = 0.45; rim.penumbra = 0.9;
    rim.position.set(3.0, 2.4, -3.2); rim.target.position.set(0, 0.4, 0);
    red.color.set(0xff1a10); red.position.set(-1.2, -1.3, 0.6);
    U.uSheen.value = SU.uSheen.value = smooth(1.5, 4.0, T) * 0.12;
    // --- lights: rim first, key later
    rim.intensity = track([[0, 0], [0.4, 0, 'linear'], [2.6, 70, 'inOutSine'], [6.9, 90], [7.4, 60], [15, 60]], T);
    key.intensity = track([[0, 0], [1.6, 0, 'linear'], [3.9, 26, 'inOutSine'], [4.05, 44, 'outQuad'], [5.0, 34], [6.9, 38], [7.05, 70, 'outQuad'], [7.8, 24], [15, 18]], T);
    red.intensity = track([[0, 0], [3, 0], [4.0, 0.35, 'outQuad'], [6.9, 0.6], [7.1, 2.5], [9, 0.4], [15, 0.3]], T);
    // --- cracks
    const growth = track([[0, -1], [2.8, -0.02, 'linear'], [3.95, 0.16, 'inQuad'], [4.12, 0.42, 'outExpo'], [6.6, 0.78, 'inOutSine'], [7.0, 1.25, 'inQuad']], T);
    const glow = track([[0, 0], [2.8, 0], [3.95, 0.4, 'inQuad'], [4.1, 1.8, 'outQuad'], [5.0, 0.7], [6.6, 0.9], [6.98, 3.2, 'inExpo'], [7.3, 1.0, 'outQuad'], [9, 0.4], [15, 0.2]], T);
    for (const uu of [U, SU]) {
      uu.uCrackGrowth.value = growth; uu.uCrackGlow.value = glow; uu.uTime.value = T;
      uu.uCrackFine.value = smooth(3.9, 6.5, T);
    }
    // --- shatter
    const s = T - 7.0;
    const tau = shatterTau(s);
    const broken = s >= 0;
    statue.visible = !broken; shardMesh.visible = broken; rocks.visible = broken;
    SU.uShatter.value = tau;
    SU.uFall.value = 0.05 * Math.pow(Math.max(0, s - 1.5), 2);
    // shake before the break
    const shake = smooth(6.55, 6.98, T) * (broken ? 0 : 1);
    statueRig.position.set(fbm1(T * 38, 1) * 0.006 * shake, fbm1(T * 41, 2) * 0.006 * shake, 0);
    if (broken) {
      for (let i = 0; i < ROCKS; i++) {
        const d = rockData[i];
        tmpV.copy(d.p).sub(origin).add(d.jit.clone().multiplyScalar(0.8)).normalize();
        const dist = d.p.distanceTo(origin);
        const sp = d.sp / (0.6 + dist);
        tmpV.multiplyScalar(sp * tau).add(d.p); tmpV.y -= 0.22 * tau * tau + d.fall * 0.05 * Math.pow(Math.max(0, s - 1.5), 2);
        tmpQ.setFromAxisAngle(d.axis, d.w * tau);
        tmpS.setScalar(d.s);
        tmpM.compose(tmpV, tmpQ, tmpS);
        rocks.setMatrixAt(i, tmpM);
      }
      rocks.instanceMatrix.needsUpdate = true;
    }
    return { tau, broken };
  }

  return { group, update, statue, shardMesh, rocks, uniforms: U, shardUniforms: SU, shardCount: shards.shardCount };
}
