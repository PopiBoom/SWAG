// Scenes 6-7 (42-60s): wings unfold in darkness against a deep red backlight; the channel avatar
// (its real animated clip) sits at the heart with a steel ring and orbiting metal needles; final card.
import * as THREE from 'three';
import { uiMaterial } from '../phone.js';
import { track, smooth, spring, clamp, lerp, ease, mulberry32 } from '../util.js';

export const X3 = 400;
export const FREEZE = 57.0;          // last three seconds: the composition holds completely still
export const AV_POS = new THREE.Vector3(X3, 0.78, 0.15);
const AV_R = 0.6;

export function createClimaxShot(engine, A, { rig, wings }) {
  const group = new THREE.Group();
  group.name = 'climax';
  // red backlight behind the wings
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uRed: { value: 0 }, uCore: { value: 0 }, uSilver: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uRed; uniform float uCore; uniform float uSilver; uniform float uTime;
      void main(){ vec2 c = vUv - vec2(0.5, 0.52); c.x *= 1.15; float r = length(c);
        float g = exp(-r * r * 7.0); float core = exp(-r * r * 38.0);
        float ang = atan(c.y, c.x);
        float rays = 0.9 + 0.1 * sin(ang * 11.0 + uTime * 0.15) * sin(ang * 5.0 - uTime * 0.1);
        vec3 col = vec3(0.55, 0.012, 0.006) * (g * rays) * uRed + vec3(0.9, 0.08, 0.03) * core * uCore + vec3(0.6, 0.63, 0.7) * g * uSilver;
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), haloMat);
  halo.position.set(X3, 0.9, -3.2);
  group.add(halo);

  // avatar disc (real animated avatar), flagged as UI so its colours stay untouched
  const avCanvas = document.createElement('canvas'); avCanvas.width = avCanvas.height = 800;
  const avCtx = avCanvas.getContext('2d');
  const avTex = new THREE.CanvasTexture(avCanvas); avTex.colorSpace = THREE.SRGBColorSpace;
  avTex.minFilter = THREE.LinearFilter; avTex.generateMipmaps = false;
  const avMat = uiMaterial(avTex);
  const avatar = new THREE.Mesh(new THREE.CircleGeometry(AV_R, 96), avMat);
  avatar.position.copy(AV_POS);
  avatar.renderOrder = 6;
  group.add(avatar);
  // steel rings
  const steel = new THREE.MeshStandardMaterial({ color: 0xbfc4cc, metalness: 1.0, roughness: 0.22, envMap: A.envRoom, envMapIntensity: 1.5 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(AV_R + 0.035, 0.018, 16, 160), steel);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(AV_R + 0.11, 0.005, 8, 160), steel);
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.04, 0.006), steel, 72);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2);
    v.set(Math.cos(a) * (AV_R + 0.16), Math.sin(a) * (AV_R + 0.16), 0);
    sc.set(1, i % 6 === 0 ? 2.2 : 1, 1);
    m4.compose(v, q, sc); ticks.setMatrixAt(i, m4);
  }
  const ringGroup = new THREE.Group();
  ringGroup.add(ring1, ring2, ticks);
  ringGroup.position.copy(AV_POS);
  group.add(ringGroup);

  // orbiting steel needles
  const N = 170;
  const rnd = mulberry32(77);
  const needleData = Array.from({ length: N }, () => ({ r: AV_R + 0.25 + Math.pow(rnd(), 0.7) * 1.5, a: rnd() * Math.PI * 2, w: (0.12 + rnd() * 0.35) * (rnd() < 0.5 ? 1 : -1) * 0.6, y: (rnd() - 0.5) * 0.5, z: (rnd() - 0.5) * 0.9, len: 0.05 + rnd() * 0.14, tilt: rnd() * 6.28, spin: 0.5 + rnd() * 2 }));
  const needles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0045, 0.0045, 1), steel, N);
  needles.frustumCulled = false;
  group.add(needles);

  let lastFrame = -1, pending = null;
  async function prepare(t) {
    const tt = Math.min(t, FREEZE);
    if (t < 44.0) return;
    const F = A.avatarFrames;
    const raw = Math.floor(Math.max(0, tt - 44.0) * 0.8 * F.fps);
    const period = (F.count - 1) * 2;
    const m = raw % period;
    const idx = m < F.count ? m : period - m;           // ping-pong: no visible jump at the loop point
    if (idx === lastFrame) return;
    const bmp = await createImageBitmap(F.blobs[idx]);
    avCtx.drawImage(bmp, 0, 0, 800, 800);
    bmp.close && bmp.close();
    avTex.needsUpdate = true;
    lastFrame = idx;
  }

  function update(t) {
    const { key, rimA, rimB, red } = rig;
    const tt = Math.min(t, FREEZE);
    wings.group.visible = true;
    wings.group.position.set(X3, 0.05, -0.6);
    wings.group.rotation.set(0.06, 0, 0);
    wings.group.scale.setScalar(0.78);
    const open = clamp(spring(tt, 42.45, 0.3, 0.6), -0.1, 1.12) * smooth(42.3, 42.7, tt);
    wings.pose(lerp(-0.08, 1, open), tt, 0.035 * smooth(46, 48, tt), lerp(1.1, 0.42, clamp(open)));
    wings.uniforms.uTime.value = tt;
    wings.uniforms.uFlutter.value = 0.03;
    const edgeRed = smooth(42.0, 46.0, tt) * (1 - 0.8 * smooth(51, 54.5, tt));
    const flicker = tt < 42.6 ? (0.5 + 0.5 * Math.sin(tt * 90.0)) * Math.exp(-(tt - 42.0) / 0.25) : 0;
    wings.uniforms.uEdge.value.setRGB(0.25 + 0.9 * edgeRed + flicker, 0.24 + 0.05 * edgeRed, 0.28 + 0.03 * edgeRed);
    wings.uniforms.uRimAmt.value = 0.15;
    wings.uniforms.uBackAmt.value = 0.6 * edgeRed;
    haloMat.uniforms.uRed.value = 0.2 * smooth(42.6, 46.0, tt) * (1 - 0.88 * smooth(51, 55, tt)) + flicker * 0.15;
    haloMat.uniforms.uCore.value = 0.12 * smooth(44.5, 46.5, tt) * (1 - 0.9 * smooth(51, 55, tt));
    haloMat.uniforms.uSilver.value = 0.02;
    haloMat.uniforms.uTime.value = tt;
    // avatar + ring
    const av = ease.outBack(clamp((tt - 45.0) / 0.9), 1.3);
    avatar.visible = tt > 44.95;
    avatar.scale.setScalar(Math.max(0.001, lerp(0.55, 1, av)));
    avMat.opacity = smooth(44.95, 45.4, tt);
    ringGroup.visible = avatar.visible;
    ringGroup.scale.setScalar(lerp(1.6, 1, ease.outExpo(clamp((tt - 45.05) / 1.0))));
    ring2.rotation.z = tt * 0.15; ticks.rotation.z = -tt * 0.05;
    steel.opacity = 1;
    // needles orbit
    needles.visible = tt > 45.2;
    for (let i = 0; i < N; i++) {
      const d = needleData[i];
      const grow = smooth(45.2, 46.5, tt);
      const a = d.a + tt * d.w;
      const r = d.r * lerp(0.6, 1, grow);
      v.set(AV_POS.x + Math.cos(a) * r, AV_POS.y + Math.sin(a) * r * 0.92 + d.y * 0.3, AV_POS.z + d.z + Math.sin(a * 2.0) * 0.1);
      q.setFromEuler(new THREE.Euler(d.tilt + tt * d.spin * 0.3, a + Math.PI / 2, d.tilt));
      sc.set(1, 1, d.len * grow);
      m4.compose(v, q, sc); needles.setMatrixAt(i, m4);
    }
    needles.instanceMatrix.needsUpdate = true;
    // lights
    key.color.set(0xe8edf6); key.angle = 0.45; key.penumbra = 0.9;
    key.position.set(X3 + 2.4, 4.2, 4.6); key.target.position.copy(AV_POS);
    key.intensity = 40 * smooth(44.5, 46, tt) * (1 - 0.35 * smooth(51, 55, tt));
    rimA.color.set(0xff2a18); rimA.angle = 0.7; rimA.penumbra = 1;
    rimA.position.set(X3 - 1.2, 3.8, -4.8); rimA.target.position.set(X3, 1.2, -0.4);
    rimA.intensity = 200 * smooth(42.5, 46, tt) * (1 - 0.75 * smooth(51, 55, tt)) + flicker * 200;
    rimB.color.set(0xc2cbe0); rimB.angle = 0.7; rimB.penumbra = 1;
    rimB.position.set(X3 + 1.6, 4.2, -4.4); rimB.target.position.set(X3, 1.4, -0.4);
    rimB.intensity = 120 * smooth(43, 46, tt) * (1 - 0.3 * smooth(51, 55, tt));
    red.color.set(0xff1a0c); red.position.set(X3, 0.6, -1.4); red.intensity = 6 * smooth(43, 46, tt) * (1 - 0.6 * smooth(51, 55, tt));
    // camera: push forward through the climax, slow pull-back into the final card, then hold
    let pos, tgt, fov;
    if (tt < 51.0) {
      const k = ease.inOutSine(clamp((tt - 42.0) / 9.0));
      pos = new THREE.Vector3(X3 + lerp(0.25, -0.05, k), lerp(0.4, 0.75, k), lerp(11.5, 7.6, k));
      tgt = new THREE.Vector3(X3, lerp(0.9, 0.55, k), 0);
      fov = lerp(36, 34, k);
    } else {
      const k = ease.inOutCubic(clamp((tt - 51.0) / 5.8));
      pos = new THREE.Vector3(X3 + lerp(-0.05, 0.0, k), lerp(0.75, 0.6, k), lerp(7.6, 9.6, k));
      tgt = new THREE.Vector3(X3, lerp(0.55, -0.12, k), 0);
      fov = 34;
    }
    return { pos, tgt, fov, tt };
  }
  return { group, update, prepare };
}
