// Scene 2 (7-15s): camera flies through the frozen debris; the phone emerges from darkness with the
// real channel profile on screen; huge feathered wings unfold behind it; orbit; dive into the screen.
import * as THREE from 'three';
import { track, smooth, spring, clamp, lerp, ease } from '../util.js';

export const PHONE_POS = new THREE.Vector3(0, 0.25, -2.7);

export function createRevealShot(engine, A, { phone, wings, rig }) {
  const group = new THREE.Group();
  group.name = 'reveal';
  // a faint black-marble floor far below catches reflections of the rim lights
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.22, metalness: 0.0, map: A.blackMarble.color, roughnessMap: A.blackMarble.rough });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -2.6, -4);
  floor.receiveShadow = true;
  group.add(floor);

  // soft backlight glow behind the wings so the black feathers read as a silhouette
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0.5, 0.52, 0.6) }, uRed: { value: new THREE.Color(0.9, 0.05, 0.02) }, uAmt: { value: 0 }, uRedAmt: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform vec3 uRed; uniform float uAmt; uniform float uRedAmt;
      void main(){ vec2 c = vUv - vec2(0.5, 0.36); c.x *= 1.25; float r = length(c);
        float g = exp(-r * r * 16.0); float core = exp(-r * r * 60.0);
        vec3 col = uColor * g * uAmt + uRed * (g * 0.6 + core * 0.8) * uRedAmt;
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 11), haloMat);
  halo.position.set(PHONE_POS.x, PHONE_POS.y + 1.4, PHONE_POS.z - 2.4);
  group.add(halo);

  function update(t, cam) {
    const { key, rimA, rimB, red } = rig;
    const s = t - 7;
    // phone placement + gentle float
    phone.visible = true; wings.group.visible = true;
    const yaw = track([[9.0, -0.5], [11.0, -0.12, 'outCubic'], [14.0, 0.14, 'inOutSine'], [15, 0.05]], t);
    phone.position.set(PHONE_POS.x, PHONE_POS.y + Math.sin(t * 1.1) * 0.015 + track([[9.0, -0.35], [10.8, 0, 'outCubic']], t), PHONE_POS.z);
    phone.rotation.set(Math.sin(t * 0.8) * 0.02, yaw, Math.sin(t * 0.6) * 0.015);
    // screen powers on
    const on = smooth(9.7, 10.25, t);
    phone.userData.screenMat.userData.uniforms.uUiGain.value = on * (0.96 + 0.04 * Math.sin(t * 50.0) * (1 - smooth(10.2, 10.5, t)));
    // wings unfold behind the phone (spring overshoot)
    const open = clamp(spring(t, 11.0, 0.42, 0.62) * 1.0, -0.1, 1.12) * smooth(10.9, 11.3, t);
    wings.group.position.set(PHONE_POS.x, PHONE_POS.y - 0.25, PHONE_POS.z - 0.8);
    wings.group.rotation.set(0.05, yaw * 0.35, 0);
    wings.group.scale.setScalar(0.85);
    wings.pose(lerp(-0.05, 1, open), t, 0.03, lerp(0.9, 0.45, clamp(open)));
    haloMat.uniforms.uAmt.value = 0.035 * smooth(10.5, 13, t);
    haloMat.uniforms.uRedAmt.value = 0.05 * smooth(11.5, 14.5, t);
    wings.uniforms.uTime.value = t;
    wings.uniforms.uRimAmt.value = 0.35 * smooth(10.8, 12.5, t);
    wings.uniforms.uBackAmt.value = 0.4 * smooth(11.5, 14, t);
    wings.uniforms.uFlutter.value = 0.025;
    const e = 0.55 * smooth(10.8, 12.8, t);
    wings.uniforms.uEdge.value.setRGB(0.62 * e, 0.66 * e, 0.75 * e);
    // lights: phone key from above-right, silver rims from behind on the wings
    const L = smooth(8.6, 10.8, t);
    key.color.set(0xe8eef8); key.angle = 0.42; key.penumbra = 0.9;
    key.position.set(PHONE_POS.x + 2.2, PHONE_POS.y + 3.6, PHONE_POS.z + 3.0); key.target.position.copy(PHONE_POS);
    key.intensity = 34 * L;
    rimA.color.set(0xcfd8ea); rimA.angle = 0.55; rimA.penumbra = 1;
    rimA.position.set(PHONE_POS.x - 3.0, PHONE_POS.y + 3.2, PHONE_POS.z - 3.6); rimA.target.position.set(PHONE_POS.x, PHONE_POS.y + 1.0, PHONE_POS.z - 0.8);
    rimA.intensity = 160 * smooth(10.6, 12.6, t);
    rimB.color.set(0xb8c4dc); rimB.angle = 0.55; rimB.penumbra = 1;
    rimB.position.set(PHONE_POS.x + 3.2, PHONE_POS.y + 2.4, PHONE_POS.z - 3.8); rimB.target.position.set(PHONE_POS.x, PHONE_POS.y + 0.8, PHONE_POS.z - 0.8);
    rimB.intensity = 140 * smooth(11.0, 13.0, t);
    red.color.set(0xff2414); red.position.set(PHONE_POS.x, PHONE_POS.y - 1.2, PHONE_POS.z - 1.6);
    red.intensity = 3.0 * smooth(11.5, 14.0, t);

    // camera: through the debris -> arrive at the phone -> orbit -> dive into the screen
    let pos, tgt, fov = 32;
    if (t < 10.6) {
      const k = ease.inOutCubic(invl(7.0, 10.6, t));
      const p0 = new THREE.Vector3(0.09, 0.33, 3.25), p1 = new THREE.Vector3(0.42, 0.62, 0.95), p2 = new THREE.Vector3(-0.5, 0.45, PHONE_POS.z + 4.3);
      pos = bez(p0, p1, p2, k);
      tgt = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0.28, 0.3), PHONE_POS, ease.inOutSine(invl(7.6, 10.4, t)));
      fov = lerp(32, 34, k);
    } else if (t < 14.15) {
      const k = ease.inOutSine(invl(10.6, 14.15, t));
      const ang = lerp(-0.12, 0.3, k), rad = lerp(4.3, 4.9, Math.sin(k * Math.PI) * 0.6 + k * 0.4);
      pos = new THREE.Vector3(PHONE_POS.x + Math.sin(ang) * rad, PHONE_POS.y + lerp(0.2, 0.7, k), PHONE_POS.z + Math.cos(ang) * rad);
      tgt = new THREE.Vector3(PHONE_POS.x, PHONE_POS.y + lerp(0.35, 0.75, k), PHONE_POS.z - 0.3 * k);
      fov = lerp(34, 38, k);
    } else {
      const k = ease.inExpo(invl(14.15, 15.0, t));
      // into the screen: end square-on, screen filling the frame
      const end = new THREE.Vector3(0, 0, 1.18).applyEuler(phone.rotation).add(phone.position);
      const startPos = new THREE.Vector3(PHONE_POS.x + Math.sin(0.3) * 4.9, PHONE_POS.y + 0.7, PHONE_POS.z + Math.cos(0.3) * 4.9);
      pos = startPos.lerp(end, ease.inOutCubic(invl(14.15, 15.0, t)));
      tgt = new THREE.Vector3(PHONE_POS.x, PHONE_POS.y + 0.75, PHONE_POS.z - 0.3).lerp(phone.position, ease.outCubic(invl(14.15, 14.8, t)));
      fov = lerp(38, 46, k);
    }
    return { pos, tgt, fov, focus: cam.position.distanceTo(phone.position) };
  }
  return { group, update };
}

function invl(a, b, x) { return clamp((x - a) / (b - a)); }
function bez(a, b, c, t) {
  const u = 1 - t;
  return new THREE.Vector3().addScaledVector(a, u * u).addScaledVector(b, 2 * u * t).addScaledVector(c, t * t);
}
