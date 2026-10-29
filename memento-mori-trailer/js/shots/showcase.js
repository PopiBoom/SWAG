// Scene 5 (33-42s): a vast dark nave of gothic arches over a black mirror floor; floating glass screens
// with real posts (text, photo, music, comments, reactions); they converge and collapse into the phone.
import * as THREE from 'three';
import { createCard, setCardOpacity } from '../cards.js';
import { track, smooth, clamp, lerp, ease } from '../util.js';
import { PHONE } from '../phone.js';

export const X2 = 300;
const FLOOR_Y = -1.55;
export const SC_PHONE = new THREE.Vector3(X2, 0.15, -13.2);

function pointedArchShape(w, h, t) {
  // gothic two-centred arch: outer and inner outlines
  const s = new THREE.Shape();
  const r = w * 0.85, half = w / 2;
  const cxL = -half + r, cxR = half - r;
  const spring = h - Math.sqrt(r * r - (r - half) * (r - half));
  s.moveTo(-half - t, -0.0);
  s.lineTo(-half - t, spring);
  s.absarc(cxL, spring, r + t, Math.PI, Math.acos((0 - cxL) / (r + t)), true);
  s.absarc(cxR, spring, r + t, Math.PI - Math.acos((0 - cxR) / (r + t)) * 1.0, 0, true);
  s.lineTo(half + t, 0);
  s.lineTo(half, 0);
  s.lineTo(half, spring);
  s.absarc(cxR, spring, r, 0, Math.PI - Math.acos((0 - cxR) / r), false);
  s.absarc(cxL, spring, r, Math.acos((0 - cxL) / r), Math.PI, false);
  s.lineTo(-half, 0);
  s.closePath();
  return s;
}

export function createShowcaseShot(engine, A, { rig, phone }) {
  const group = new THREE.Group();
  group.name = 'showcase';
  // --- architecture
  const stone = new THREE.MeshStandardMaterial({ color: 0x55565c, roughness: 0.7, metalness: 0.0, map: A.blackMarble.color, envMapIntensity: 0.5 });
  const archGeo = new THREE.ExtrudeGeometry(pointedArchShape(2.4, 5.2, 0.28), { depth: 0.5, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 24 });
  const colGeo = new THREE.CylinderGeometry(0.2, 0.24, 7, 16);
  for (let i = 0; i < 7; i++) {
    for (const side of [-1, 1]) {
      const a = new THREE.Mesh(archGeo, stone);
      a.position.set(X2 + side * 3.1, FLOOR_Y, 2 - i * 3.2);
      a.rotation.y = side * Math.PI / 2;
      a.receiveShadow = true;
      group.add(a);
      const c = new THREE.Mesh(colGeo, stone);
      c.position.set(X2 + side * 2.7, FLOOR_Y + 3.5, 2 - i * 3.2 - 1.6);
      group.add(c);
    }
  }
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(pointedArchShape(4.4, 8.5, 0.4), { depth: 0.6, bevelEnabled: false, curveSegments: 32 }), stone);
  back.position.set(X2, FLOOR_Y, -21);
  group.add(back);
  // black mirror floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 40), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.12, metalness: 0.2, map: A.blackMarble.color, roughnessMap: A.blackMarble.rough, envMapIntensity: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(X2, FLOOR_Y, -8);
  floor.receiveShadow = true;
  group.add(floor);
  // god rays from the back window
  const rayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uAmt: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uAmt; uniform float uTime;
      void main(){ float x = abs(vUv.x - 0.5) * 2.0; float a = (1.0 - smoothstep(0.0, 1.0, x)) * pow(vUv.y, 1.6);
        a *= 0.7 + 0.3 * sin(vUv.x * 40.0 + uTime * 0.5) * sin(vUv.x * 13.0 - uTime * 0.3);
        gl_FragColor = vec4(vec3(0.62, 0.66, 0.75) * a * uAmt, 1.0); }`,
  });
  const ray = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 16), rayMat);
  ray.position.set(X2, 4.0, -17); ray.rotation.set(-0.35, 0, 0);
  group.add(ray);

  // --- glass screens with real posts
  const defs = [
    { tex: A.tg.p37996, pos: [-0.42, 0.42, 0.0], ry: 0.32, crop: 1 },
    { tex: A.tg.p38049, pos: [0.44, 0.05, -2.0], ry: -0.34, crop: 0.62 },
    { tex: A.tg.p37980, pos: [-0.44, 0.5, -4.0], ry: 0.3, crop: 1 },
    { tex: A.tg.c38089, pos: [0.42, 0.0, -6.0], ry: -0.3, crop: 0.66 },
    { tex: A.tg.p38092, pos: [-0.4, 0.35, -8.0], ry: 0.28, crop: 1 },
    { tex: A.tg.p38087, pos: [0.38, 0.55, -9.8], ry: -0.26, crop: 1 },
  ];
  const VISIT_T0 = 33.25, VISIT_DT = 1.02;
  const visits = defs.map(d => {
    const c = new THREE.Vector3(X2 + d.pos[0], d.pos[1], d.pos[2]);
    const n = new THREE.Vector3(Math.sin(d.ry), 0, Math.cos(d.ry));
    return { c, p: c.clone().addScaledVector(n, 2.35).add(new THREE.Vector3(0, 0.05, 0)) };
  });
  const camCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(X2, 0.45, 3.4), ...visits.map(v => v.p)], false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(X2, 0.4, 0.5), ...visits.map(v => v.c)], false, 'centripetal');
  const cards = defs.map(d => {
    const c = createCard(A, d.tex, { width: 0.9, crop: d.crop, thickness: 0.05 });
    const { slab } = c.userData;
    slab.material.transparent = true; slab.material.opacity = 0.55; slab.material.color.set(0x0b0c10); slab.material.roughness = 0.06;
    group.add(c);
    // mirrored copy in the floor (faded reflection)
    const refl = c.clone(true);
    refl.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.depthWrite = false; o.material.side = THREE.DoubleSide; } });
    group.add(refl);
    return { card: c, refl, def: d };
  });

  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  function update(t) {
    const { key, rimA, rimB, red } = rig;
    const asm = ease.inOutCubic(clamp((t - 39.6) / 1.25));        // flight to the phone
    const collapse = smooth(40.55, 41.0, t);                         // layers vanish into the screen
    const phoneIn = ease.outBack(clamp((t - 40.45) / 0.7), 1.2);
    cards.forEach(({ card, refl, def }, i) => {
      const enter = ease.outExpo(clamp((t - 33.0 - i * 0.12) / 0.9));
      const float = Math.sin(t * 0.9 + i * 1.7) * 0.04;
      const p0 = new THREE.Vector3(X2 + def.pos[0] * lerp(2.4, 1, enter), def.pos[1] + float + (1 - enter) * 0.6, def.pos[2]);
      // target: stacked inside the phone screen
      const p1 = SC_PHONE.clone().add(new THREE.Vector3(0, 0, PHONE.d / 2 + 0.01 + (5 - i) * 0.012));
      const p = p0.lerp(p1, asm);
      const sTarget = (PHONE.w - 0.06) / 0.9;
      const s = lerp(1, sTarget, asm);
      card.position.copy(p);
      card.rotation.set(Math.sin(t * 0.7 + i) * 0.03 * (1 - asm), lerp(def.ry + Math.sin(t * 0.5 + i) * 0.04, 0, asm), lerp(Math.sin(t * 0.6 + i * 2.0) * 0.03, 0, asm));
      card.scale.set(s, s * lerp(1, 0.6, asm * (i % 2 ? 1 : 0.4)), s);
      setCardOpacity(card, smooth(33.0 + i * 0.12, 33.35 + i * 0.12, t) * (1 - collapse));
      // reflection: mirror across the floor plane
      refl.position.set(p.x, 2 * FLOOR_Y - p.y, p.z);
      refl.rotation.set(-card.rotation.x, card.rotation.y, -card.rotation.z);
      refl.scale.set(card.scale.x, -card.scale.y, card.scale.z);
      const ro = 0.18 * smooth(33.2, 34.0, t) * (1 - asm);
      refl.visible = ro > 0.002;
      refl.traverse(o => { if (o.isMesh) o.material.opacity = (o === refl.children[2] ? 0.05 : 1) * ro; });
    });
    // phone forms where the screens collapse
    phone.visible = t > 40.4;
    phone.position.copy(SC_PHONE);
    phone.rotation.set(0, Math.sin(t * 0.6) * 0.04, 0);
    phone.scale.setScalar(lerp(0.85, 1, phoneIn));
    phone.userData.screenMat.userData.uniforms.uUiGain.value = smooth(40.6, 41.05, t);
    rayMat.uniforms.uAmt.value = 0.08; rayMat.uniforms.uTime.value = t;
    // lights
    key.color.set(0xe6ecf6); key.angle = 0.5; key.penumbra = 0.9;
    key.position.set(X2 + 2.5, 3.5, SC_PHONE.z + 4.5); key.target.position.copy(SC_PHONE);
    key.intensity = 30 * smooth(39.8, 41, t);
    rimA.color.set(0xbcc6da); rimA.angle = 0.7; rimA.penumbra = 1;
    rimA.position.set(X2 - 2.0, 4.5, -18); rimA.target.position.set(X2, 0, -6); rimA.intensity = 160;
    rimB.color.set(0xa8b4cc); rimB.angle = 0.7; rimB.penumbra = 1;
    rimB.position.set(X2 + 2.0, 4.0, 5); rimB.target.position.set(X2, 0, -4); rimB.intensity = 90;
    red.color.set(0xff2414); red.position.set(X2, FLOOR_Y + 0.3, SC_PHONE.z - 1.5); red.intensity = 2.5 * smooth(40.4, 41.5, t);

    // camera visits each screen along a smooth spline, then settles on the phone
    let pos, tgt, fov = 36;
    // visit parameter: dwell on each screen (ease within each 1.02 s slot)
    const vt = clamp((t - VISIT_T0 + VISIT_DT * 0.55) / VISIT_DT, 0, defs.length);
    const vi = Math.floor(vt), vf = vt - vi;
    const u = clamp((vi + ease.inOutCubic(vf)) / defs.length);
    const slalomPos = camCurve.getPoint(u);
    const slalomTgt = tgtCurve.getPoint(clamp(u + 0.02));
    const endPos = new THREE.Vector3(X2 + 0.05, 0.32, SC_PHONE.z + 3.5);
    const endTgt = SC_PHONE.clone().add(new THREE.Vector3(0, 0.05, 0));
    const e = ease.inOutCubic(clamp((t - 39.3) / 1.6));
    pos = slalomPos.lerp(endPos, e);
    tgt = slalomTgt.lerp(endTgt, e);
    fov = lerp(38, 34, e);
    return { pos, tgt, fov, focusTarget: e > 0.5 ? SC_PHONE : null };
  }
  return { group, update };
}
