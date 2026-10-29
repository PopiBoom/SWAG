// Scene 4 (24-33s): extreme close-up of a damaged ancient head (Portrait of a Man, ~150 BC scan),
// cracks crawl and glow blood-red from inside, a violent pull-back reveals black smoke, then darkness.
import * as THREE from 'three';
import { createMarbleMaterial } from '../materials.js';
import { createSmoke } from '../particles.js';
import { track, smooth, clamp, lerp, ease, fbm1 } from '../util.js';

export const X1 = 200;

export function createIdentityShot(engine, A, { rig }) {
  const group = new THREE.Group();
  group.name = 'identity';
  const mat = createMarbleMaterial({ textures: A.marble, scale: 1.3, cracks: true });
  const U = mat.userData.uniforms;
  U.uCrackScale.value = 3.1; U.uCrackWidth.value = 0.016; U.uDirt.value = 0.55; U.uCavity.value = 0.85;
  U.uCrackOrigin.value.set(-0.06, -0.1, 0.62); // cheekbone under the left eye (nose tip is at -0.195,-0.204,0.736)
  U.uCrackGlowColor.value.setRGB(1.0, 0.06, 0.03);
  const head = new THREE.Mesh(A.bearded, mat);
  head.castShadow = true; head.receiveShadow = true;
  head.position.set(X1, 0, 0);
  group.add(head);
  const smoke = createSmoke({ count: 30, seed: 9, color: new THREE.Color(0.012, 0.011, 0.012), lit: new THREE.Color(0.22, 0.02, 0.01) });
  smoke.position.set(X1, -0.4, -0.2);
  group.add(smoke);
  const sm = smoke.userData.mat.uniforms;

  function update(t) {
    const { key, rimA, rimB, red } = rig;
    const lt = t - 24;
    // cracks
    U.uCrackGrowth.value = track([[24, 0.18], [28.0, 0.62, 'inOutSine'], [29.0, 0.95, 'outExpo'], [32.3, 1.25, 'inOutSine'], [32.5, 1.6, 'inQuad']], t);
    U.uCrackFine.value = smooth(25, 29, t);
    U.uCrackGlow.value = track([[24, 0.6], [27.8, 2.4, 'inOutSine'], [28.95, 4.0, 'inQuad'], [29.1, 9.0, 'outQuad'], [30.0, 4.0], [32.2, 4.5], [32.48, 14, 'inExpo']], t);
    U.uTime.value = t; U.uSheen.value = 0.08;
    // light
    key.color.set(0xd8dfec); key.angle = 0.32; key.penumbra = 0.7;
    key.position.set(X1 - 2.6, 3.2, 2.8); key.target.position.set(X1, 0.3, 0.3);
    key.intensity = track([[24, 18], [28, 20], [29, 26], [32.4, 22]], t);
    rimA.color.set(0xff2414); rimA.angle = 0.5; rimA.penumbra = 0.8;
    rimA.position.set(X1 + 2.6, 1.2, -2.6); rimA.target.position.set(X1, 0.3, 0);
    rimA.intensity = track([[24, 6], [27.9, 10], [28.4, 40], [28.9, 45], [29.1, 120, 'outQuad'], [30, 70], [32.4, 80]], t);
    rimB.color.set(0x9aa6be); rimB.angle = 0.5; rimB.penumbra = 0.9;
    rimB.position.set(X1 - 2.8, 2.0, -2.4); rimB.target.position.set(X1, 0.5, 0);
    rimB.intensity = 30;
    red.color.set(0xff1a0c); red.position.set(X1 + 0.1, 0.25, 1.0);
    red.intensity = U.uCrackGlow.value * 0.12;
    // smoke rises after the pull-back
    smoke.visible = t > 27.6;
    sm.uTime.value = t; sm.uOpacity.value = smooth(27.8, 29.5, t) * 0.9; sm.uLitAmt.value = 0.35 + 0.25 * smooth(29, 30, t); sm.uRise.value = 0.22;
    // camera: ECU drift across the cheek/eye -> whip pull-back on 28.0 -> slow orbit
    let pos, tgt, fov;
    if (t < 28.0) {
      const k = ease.inOutSine(clamp(lt / 4.0));
      pos = new THREE.Vector3(X1 + lerp(0.18, 0.02, k), lerp(0.08, 0.02, k), lerp(1.55, 1.42, k));
      tgt = new THREE.Vector3(X1 + lerp(-0.02, -0.08, k), lerp(-0.02, -0.04, k), 0.56);
      fov = lerp(26, 24, k);
    } else {
      const k = ease.outExpo(clamp((t - 28.0) / 1.15));
      const k2 = ease.inOutSine(clamp((t - 29.0) / 3.5));
      const ang = lerp(0.1, -0.28, k) + k2 * 0.12;
      const dist = lerp(0.88, 3.5, k) + k2 * 0.25;
      pos = new THREE.Vector3(X1 - 0.08 + Math.sin(ang) * dist, lerp(0.02, 0.45, k) + k2 * 0.05, Math.cos(ang) * dist + 0.56);
      tgt = new THREE.Vector3(X1 + lerp(-0.08, -0.12, k), lerp(-0.04, -0.02, k), lerp(0.56, 0.15, k));
      fov = lerp(25, 36, k);
    }
    return { pos, tgt, fov, head };
  }
  return { group, update };
}
