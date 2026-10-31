// 30 → 32 s: inside the eye socket — a tunnel of code rushing toward the city.
import * as THREE from 'three';
import { clamp, lerp, inv, smooth, eInCubic, eOutCubic, rng, wobble, W, H } from '../core.js';
import { glyphTexture } from './skull.js';

export async function build(ctx) {
  const { E } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, W / H, .05, 400);
  const glyph = glyphTexture(17);
  const U = { uT: { value: 0 }, uG: { value: glyph }, uRed: { value: 0 } };
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 400, 48, 1, true), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide,
    vertexShader: `varying vec2 vUv; varying float vZ; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uG; uniform float uT, uRed; varying vec2 vUv; varying float vZ;
      void main(){ vec2 uv = vec2(vUv.x * 6., vUv.y * 90. + uT * 3.); vec3 g = texture2D(uG, uv).rgb;
        float streak = texture2D(uG, vec2(vUv.x * 2., vUv.y * 6. + uT * .8)).g;
        vec3 col = vec3(.2, 1.6, .7) * g.r * (.4 + 1.4 * streak) + vec3(.5, .1, 1.) * g.b * .3;
        col = mix(col, vec3(1.6, .1, .25) * g.r, uRed * step(.6, streak));
        col *= exp(-vZ * .03) * 1.4; gl_FragColor = vec4(col, 1.); }`,
  }));
  tube.rotation.x = Math.PI / 2; scene.add(tube);
  // light rings
  const rings = new THREE.Group(); scene.add(rings);
  for (let i = 0; i < 60; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.7, .025, 6, 64), new THREE.MeshBasicMaterial({ color: i % 5 === 0 ? new THREE.Color(2.4, .15, .3) : new THREE.Color(.25, 2.2, .9) }));
    r.position.z = -i * 6; rings.add(r);
  }
  // speed streaks
  const N = 700, pos = new Float32Array(N * 6), r = rng(3);
  for (let i = 0; i < N; i++) {
    const a = r() * Math.PI * 2, rad = .4 + r() * 2.4, z = -r() * 300, l = 1 + r() * 4;
    pos.set([Math.cos(a) * rad, Math.sin(a) * rad, z, Math.cos(a) * rad, Math.sin(a) * rad, z - l], i * 6);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const streaks = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(.8, 2.4, 1.4) }));
  scene.add(streaks);

  function update(t, ui, fx) {
    const k = inv(E.tunnel, E.city, t);
    const z = -(k * 12 + eInCubic(k) * 140);
    camera.position.set(wobble(t, 1, 2) * .15, wobble(t, 2, 2) * .15, z);
    camera.lookAt(0, 0, z - 10); camera.rotation.z = t * 1.4;
    camera.fov = lerp(75, 95, eInCubic(k)); camera.updateProjectionMatrix();
    U.uT.value = t; U.uRed.value = smooth(30.6, 31.4, t);
    fx.flash = Math.max(.85 * (1 - smooth(E.tunnel, E.tunnel + .45, t)), smooth(31.6, 32, t) * .9);
    fx.flashColor = t < 31 ? 0x39ff88 : 0xeafff2;
    fx.ca = 2.5; fx.bloomStr = 1.2; fx.threshold = .5; fx.vign = 1; fx.glitch = t > 31.7 ? .3 : 0;
  }
  return { scene, camera, update };
}
