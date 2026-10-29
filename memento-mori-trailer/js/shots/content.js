// Scene 3 (15-24s): real posts float in a dark corridor; giant chrome words MЫСЛИ / МЕМЫ / РЕАЛЬНОСТЬ
// stand behind them; hard flash cuts of marble statues and black wings between the posts.
import * as THREE from 'three';
import { createCard, createWord, setCardOpacity } from '../cards.js';
import { createMarbleMaterial } from '../materials.js';
import { track, smooth, clamp, lerp, ease, fbm1 } from '../util.js';

export const X0 = 100;
const FL = X0 + 40; // flash stage

export function createContentShot(engine, A, { rig, wings }) {
  const group = new THREE.Group();
  group.name = 'content';
  const cards = {
    A: createCard(A, A.tg.p37974, { width: 1.0, crop: 0.32 }),
    B1: createCard(A, A.tg.p38084, { width: 1.0 }),
    B2: createCard(A, A.tg.p37997, { width: 1.0 }),
    C: createCard(A, A.tg.p38089, { width: 1.0 }),
  };
  for (const c of Object.values(cards)) group.add(c);
  const words = {
    A: createWord('МЫСЛИ.', { height: 0.78 }),
    B: createWord('МЕМЫ.', { height: 0.82 }),
    C: createWord('РЕАЛЬНОСТЬ.', { height: 0.5 }),
  };
  words.A.position.set(X0, 1.12, -2.0);
  words.B.position.set(X0, 1.0, -12.0);
  words.C.position.set(X0, 0.98, -22.0);
  for (const w of Object.values(words)) group.add(w);

  // thin vertical light shafts for depth
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAmt: { value: 0.0 }, uColor: { value: new THREE.Color(0.55, 0.58, 0.66) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uAmt; uniform vec3 uColor; void main(){ float x = 1.0 - abs(vUv.x - 0.5) * 2.0; float a = pow(x, 6.0) * smoothstep(0.0, 0.6, vUv.y) * smoothstep(1.0, 0.75, vUv.y); gl_FragColor = vec4(uColor * a * uAmt, 1.0); }',
  });
  const beamGeo = new THREE.PlaneGeometry(0.5, 14);
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    const side = i % 2 ? 1 : -1;
    b.position.set(X0 + side * (1.8 + (i * 0.37) % 1.4), 2.5, -4 - i * 1.9);
    b.rotation.z = side * 0.08;
    group.add(b);
  }

  // flash subjects
  const flash = new THREE.Group();
  const marble = createMarbleMaterial({ textures: A.marble, scale: 1.25, cracks: false });
  marble.userData.uniforms.uSheen.value = 0.1;
  const aph = new THREE.Mesh(A.aphrodite, marble); aph.position.set(FL, 0, 0); aph.castShadow = true;
  const sir = new THREE.Mesh(A.siren, marble); sir.position.set(FL + 6, 0, 0); sir.castShadow = true;
  flash.add(aph, sir);
  group.add(flash);

  const tmp = new THREE.Vector3();
  function placeCard(card, pos, rot, scale, opacity) {
    card.position.copy(pos); card.rotation.set(rot[0], rot[1], rot[2]); card.scale.setScalar(scale);
    setCardOpacity(card, opacity);
  }

  function update(t) {
    const { key, rimA, rimB, red } = rig;
    // ---- cards
    const eA = ease.outExpo(clamp((t - 15.0) / 0.6));
    placeCard(cards.A, tmp.set(X0, -0.28, lerp(-3.2, 0, eA)), [0, lerp(0.7, 0.1, eA) + Math.sin(t * 0.9) * 0.03, lerp(-0.12, 0, eA)], lerp(0.8, 1, eA), smooth(15.0, 15.18, t));
    const eB1 = ease.outExpo(clamp((t - 18.0) / 0.55)), eB2 = ease.outExpo(clamp((t - 18.18) / 0.55));
    placeCard(cards.B1, tmp.set(lerp(X0 - 2.6, X0 - 0.06, eB1), 0.12, -10.0), [0.0, lerp(-0.9, -0.12, eB1) + Math.sin(t) * 0.02, 0.02], 1, smooth(18.0, 18.12, t));
    placeCard(cards.B2, tmp.set(lerp(X0 + 2.6, X0 + 0.08, eB2), -0.44, -9.75), [0.0, lerp(0.9, 0.1, eB2) + Math.sin(t * 1.1) * 0.02, -0.02], 1, smooth(18.18, 18.3, t));
    const eC = ease.outExpo(clamp((t - 21.0) / 0.65));
    placeCard(cards.C, tmp.set(X0, lerp(-2.6, -0.2, eC), -20.0), [lerp(0.8, 0.04, eC), Math.sin(t * 0.8) * 0.04, 0], 1, smooth(21.0, 21.15, t));
    // ---- words
    const wordAnim = (w, t0) => {
      const u = w.userData.mat.uniforms;
      u.uReveal.value = ease.outCubic(clamp((t - t0) / 0.55));
      u.uGlint.value = lerp(-0.3, 1.3, ease.inOutSine(clamp((t - t0 - 0.5) / 1.1)));
      u.uSlice.value = Math.max(0, 1 - (t - t0) / 0.25) * (t >= t0 ? 1 : 0);
      u.uSeed.value = Math.floor(t * 30);
      u.uRed.value = 1 - smooth(t0, t0 + 0.6, t);
      u.uOpacity.value = t >= t0 ? 1 : 0;
    };
    wordAnim(words.A, 15.08); wordAnim(words.B, 18.06); wordAnim(words.C, 21.06);
    beamMat.uniforms.uAmt.value = 0.05;

    // ---- shots
    let pos, tgt, fov = 35, focus = 3.8, aperture = 0.08, flashShot = null;
    const flashes = [[17.75, 18.0, 'aph'], [20.75, 21.0, 'wings'], [23.0, 23.25, 'siren'], [23.25, 23.5, 'wings2'], [23.5, 23.75, 'aph2'], [23.75, 24.0, 'black']];
    for (const f of flashes) if (t >= f[0] && t < f[1]) flashShot = f;
    flash.visible = !!flashShot;
    aph.visible = sir.visible = false;
    if (flashShot) {
      const lt = (t - flashShot[0]) / 0.25;
      key.color.set(0xf2f4f8); key.angle = 0.35; key.penumbra = 0.35;
      rimA.color.set(0xff2a1a); rimA.angle = 0.5; rimA.penumbra = 0.6;
      rimB.color.set(0xb8c4dc); rimB.angle = 0.5; rimB.penumbra = 0.8;
      if (flashShot[2] === 'aph' || flashShot[2] === 'aph2') {
        aph.visible = true;
        const side = flashShot[2] === 'aph' ? 1 : -1;
        key.position.set(FL - 2.5 * side, 3.0, 2.6); key.target.position.set(FL, 0.55, 0.2); key.intensity = 40;
        rimA.position.set(FL + 2.8 * side, 1.4, -2.4); rimA.target.position.set(FL, 0.5, 0); rimA.intensity = 90;
        pos = new THREE.Vector3(FL + (side > 0 ? 0.25 : 1.3) + lt * 0.08 * side, 0.6, side > 0 ? 1.65 - lt * 0.15 : 0.9);
        tgt = new THREE.Vector3(FL, 0.58, 0.25);
        fov = 32; focus = pos.distanceTo(tgt); aperture = 0.1;
      } else if (flashShot[2] === 'siren') {
        sir.visible = true;
        key.position.set(FL + 6 - 2.4, 3.4, 2.4); key.target.position.set(FL + 6, 0.3, 0); key.intensity = 45;
        rimA.position.set(FL + 6 + 2.6, 1.6, -2.6); rimA.target.position.set(FL + 6, 0.4, 0); rimA.intensity = 45;
        pos = new THREE.Vector3(FL + 6 + 0.35, 0.15 + lt * 0.1, 3.0 - lt * 0.2);
        tgt = new THREE.Vector3(FL + 6, 0.2, 0);
        fov = 34; focus = 3.0;
      } else if (flashShot[2] === 'wings' || flashShot[2] === 'wings2') {
        wings.group.visible = true;
        wings.group.position.set(FL + 12, -1.0, 0); wings.group.rotation.set(0, 0, 0); wings.group.scale.setScalar(1);
        wings.pose(1, t, 0.04, 0.5);
        wings.uniforms.uTime.value = t;
        wings.uniforms.uEdge.value.setRGB(0.22, 0.23, 0.27);
        wings.uniforms.uRimAmt.value = 0.2;
        key.position.set(FL + 12 + 2, 3, 3); key.target.position.set(FL + 12 + 1, 1, 0); key.intensity = 70;
        rimA.position.set(FL + 12 + 1, 3, -3); rimA.target.position.set(FL + 12 + 1, 1.2, 0); rimA.intensity = 120;
        const w2 = flashShot[2] === 'wings2';
        pos = new THREE.Vector3(FL + 12 + (w2 ? -1.4 : 1.5) + lt * 0.15, w2 ? 1.4 : 0.9, 1.9);
        tgt = new THREE.Vector3(FL + 12 + (w2 ? -1.5 : 1.3), w2 ? 1.6 : 1.1, 0);
        fov = 36; focus = 1.9;
      } else {
        pos = new THREE.Vector3(FL, 50, 0); tgt = new THREE.Vector3(FL, 60, 0);
      }
      return { pos, tgt, fov, focus, aperture, flash: flashShot[2] };
    }
    // corridor shots
    rimA.color.set(0xcfd6e6); rimA.angle = 0.6; rimA.penumbra = 1;
    let seg;
    if (t < 18.0) {
      const k = ease.outCubic(clamp((t - 15.0) / 2.75));
      pos = new THREE.Vector3(X0 + lerp(0.7, 0.1, k), lerp(0.35, 0.12, k), lerp(4.3, 3.35, k));
      tgt = new THREE.Vector3(X0, lerp(0.35, 0.22, k), lerp(0.0, -0.4, k));
      seg = 0;
    } else if (t < 21.0) {
      const k = ease.outCubic(clamp((t - 18.0) / 2.75));
      pos = new THREE.Vector3(X0 + lerp(-0.65, -0.1, k), lerp(-0.05, 0.08, k), lerp(-6.0, -6.75, k));
      tgt = new THREE.Vector3(X0, lerp(0.25, 0.18, k), -10.4);
      seg = 1;
    } else {
      const k = ease.outCubic(clamp((t - 21.0) / 2.0));
      pos = new THREE.Vector3(X0 + lerp(0.45, 0.05, k), lerp(0.2, 0.1, k), lerp(-16.1, -16.8, k));
      tgt = new THREE.Vector3(X0, 0.22, -20.4);
      seg = 2;
    }
    const zc = [0, -10, -20][seg];
    rimA.position.set(X0, 4, zc + 1.5); rimA.target.position.set(X0, 0, zc); rimA.intensity = 20;
    focus = pos.distanceTo(tmp.set(X0, 0, zc));
    return { pos, tgt, fov, focus, aperture: 0.035, flash: null, seg };
  }
  return { group, update };
}
