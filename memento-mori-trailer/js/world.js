// World: builds every shot and maps a time t (seconds) to scene state, camera and post FX.
import * as THREE from 'three';
import { createAsh } from './particles.js';
import { createStatueShot } from './shots/statue.js';
import { createRevealShot } from './shots/reveal.js';
import { createContentShot, X0 as CX } from './shots/content.js';
import { createIdentityShot, X1 as IX } from './shots/identity.js';
import { createShowcaseShot, X2 as SX, SC_PHONE } from './shots/showcase.js';
import { createClimaxShot, X3 as KX, AV_POS, FREEZE } from './shots/climax.js';
import { createPhone, makeScreenTexture } from './phone.js';
import { createWings } from './wings.js';
import { track, smooth, clamp, lerp, fbm1, ease } from './util.js';

export const DURATION = 60;
const DBG = new URLSearchParams(location.search);

export function buildWorld(engine, A) {
  const { scene, camera, fx } = engine;
  scene.environment = A.envChurch;
  scene.environmentIntensity = 0.06;
  scene.fog = new THREE.FogExp2(0x07080a, 0.0);

  // one light rig for the whole film (constant light count = no shader recompiles between shots)
  const key = new THREE.SpotLight(0xffffff, 0, 0, 0.4, 0.8, 2.0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 1.0; key.shadow.camera.far = 16;
  const rimA = new THREE.SpotLight(0xffffff, 0, 0, 0.5, 0.9, 2.0);
  const rimB = new THREE.SpotLight(0xffffff, 0, 0, 0.5, 0.9, 2.0);
  const red = new THREE.PointLight(0xff2010, 0, 0, 2.0);
  const rig = { key, rimA, rimB, red };
  scene.add(key, key.target, rimA, rimA.target, rimB, rimB.target, red);

  const ash = createAsh({ count: 1800, seed: 11, size: 0.55 });
  scene.add(ash);

  const statueShot = createStatueShot(engine, A, rig);
  scene.add(statueShot.group);

  const screens = {
    profile: makeScreenTexture(A.tg.profile.image),
    feed: makeScreenTexture(A.tg.feed.image),
  };
  const phone = createPhone(A, screens.profile);
  scene.add(phone);
  const wings = createWings({ seed: 5 });
  scene.add(wings.group);

  const reveal = createRevealShot(engine, A, { phone, wings, rig });
  scene.add(reveal.group);

  const content = createContentShot(engine, A, { rig, wings });
  scene.add(content.group);

  const identity = createIdentityShot(engine, A, { rig });
  scene.add(identity.group);

  const showcase = createShowcaseShot(engine, A, { rig, phone });
  scene.add(showcase.group);
  const climax = createClimaxShot(engine, A, { rig, wings });
  scene.add(climax.group);

  const groups = [statueShot.group, phone, wings.group, reveal.group, content.group, identity.group, showcase.group, climax.group];

  const tmp = new THREE.Vector3();
  function setCam(pos, target, fov = 35, roll = 0) {
    camera.position.copy(pos.isVector3 ? pos : tmp.set(...pos));
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(target.isVector3 ? target : tmp.set(...target));
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
  const drift = (t, amt) => new THREE.Vector3(fbm1(t * 0.35, 3) * amt, fbm1(t * 0.31, 7) * amt, fbm1(t * 0.27, 11) * amt * 0.5);

  function baseFx() {
    Object.assign(fx, {
      exposure: 1.0, bloomStrength: 0.7, bloomThreshold: 1.0, bloomKnee: 0.6, aperture: 0, focus: 3, maxBlur: 14,
      vignette: 0.6, grain: 0.055, chroma: 0.0022, saturation: 0.86, contrast: 1.1, lift: [0.0, 0.0, 0.004], gain: [0.98, 1.0, 1.03],
      redKeep: 0.8, fade: 0, flash: 0, flashColor: [1, 1, 1], uiExposure: 1,
    });
  }
  function ashAt(center, box, opacity, fall = 0.18) {
    const u = ash.material.uniforms;
    u.uCenter.value.copy(center); u.uBox.value.copy(box); u.uOpacity.value = opacity; u.uFall.value = fall;
  }

  // ---------- 0-7 INTRO ----------
  function shotIntro(t) {
    statueShot.group.visible = true;
    statueShot.update(t, camera, fx);
    const k = ease.inOutSine(clamp(t / 7.0));
    const kk = Math.pow(k, 1.25);
    const ang = lerp(0.2, 0.03, kk);
    const dist = lerp(7.4, 2.9, kk);
    const tgt = new THREE.Vector3(0, lerp(0.1, 0.27, kk), lerp(0, 0.4, kk));
    const d = drift(t, 0.02 + 0.01 * kk);
    const pos = new THREE.Vector3(tgt.x + Math.sin(ang) * dist, tgt.y + lerp(0.55, 0.06, kk), tgt.z + Math.cos(ang) * dist).add(d);
    setCam(pos, tgt, lerp(34, 30, kk), lerp(-0.035, 0.0, kk));
    fx.focus = dist; fx.aperture = lerp(0.04, 0.16, kk); fx.maxBlur = 12;
    fx.fade = 1 - smooth(0.0, 1.2, t);
    scene.environmentIntensity = track([[0, 0], [2.0, 0], [4.0, 0.035], [7, 0.05]], t);
    ashAt(new THREE.Vector3(0, 0.5, 1.5), new THREE.Vector3(5, 5, 7), smooth(0.3, 2.5, t) * 0.55);
  }

  // ---------- 7-15 REVEAL ----------
  function shotReveal(t) {
    statueShot.group.visible = true;
    statueShot.update(t, camera, fx);
    phone.userData.screen.material.map = screens.profile;
    reveal.group.visible = true;
    const r = reveal.update(t, camera);
    const d = drift(t, 0.015);
    setCam(r.pos.clone().add(d), r.tgt, r.fov, Math.sin(t * 0.7) * 0.01);
    fx.focus = camera.position.distanceTo(t < 9.2 ? new THREE.Vector3(0, 0.3, 0.2) : phone.position);
    fx.aperture = t < 9.5 ? 0.22 : 0.12; fx.maxBlur = 14;
    // shatter impact: brief flash + chromatic kick
    const since = Math.max(0, t - 7.0);
    fx.flash = 0.35 * Math.exp(-since / 0.06);
    fx.flashColor = [1.0, 0.92, 0.88];
    fx.chroma = 0.0022 + 0.01 * Math.exp(-since / 0.25);
    scene.environmentIntensity = 0.05;
    ashAt(t < 10 ? new THREE.Vector3(0, 0.4, 0.6) : phone.position, new THREE.Vector3(6, 6, 8), 0.5);
  }

  // ---------- 15-24 CONTENT ----------
  function shotContent(t) {
    content.group.visible = true;
    const r = content.update(t);
    const d = r.flash ? new THREE.Vector3() : drift(t, 0.02);
    setCam(r.pos.clone().add(d), r.tgt, r.fov, r.flash ? 0 : Math.sin(t * 0.9) * 0.012);
    fx.focus = r.focus; fx.aperture = r.aperture; fx.maxBlur = 12;
    scene.environmentIntensity = r.flash ? 0.04 : 0.08;
    // glitch + chromatic hits on the beat cuts
    const hits = [15.0, 17.75, 18.0, 20.75, 21.0, 23.0, 23.25, 23.5, 23.75];
    let g = 0;
    for (const h of hits) if (t >= h) g = Math.max(g, Math.exp(-(t - h) / 0.07));
    fx.glitch = g * (r.flash ? 0.6 : 1.0);
    fx.chroma = 0.0022 + g * 0.012;
    fx.flash = r.flash ? 0.0 : 0.05 * Math.exp(-Math.max(0, t - 15.0) / 0.08);
    if (r.flash === 'black') { fx.fade = 1; }
    fx.contrast = r.flash ? 1.25 : 1.1;
    ashAt(r.flash ? camera.position : new THREE.Vector3(CX, 0.5, [0, -10, -20][r.seg] + 2), new THREE.Vector3(6, 6, 8), r.flash ? 0.25 : 0.45);
  }

  // ---------- 24-33 IDENTITY ----------
  function shotIdentity(t) {
    identity.group.visible = true;
    const r = identity.update(t);
    const shakeAmt = Math.exp(-Math.max(0, t - 29.0) / 0.25) * (t >= 29 ? 0.03 : 0) + (t > 28 && t < 28.3 ? 0.01 : 0);
    const d = drift(t, 0.012).add(new THREE.Vector3(fbm1(t * 40, 4) * shakeAmt, fbm1(t * 37, 8) * shakeAmt, 0));
    setCam(r.pos.clone().add(d), r.tgt, r.fov, t < 28 ? -0.04 : lerp(-0.04, 0.02, smooth(28, 29.5, t)));
    fx.focus = camera.position.distanceTo(r.tgt) * (t < 28 ? 0.95 : 1.0);
    fx.aperture = t < 28 ? 0.2 : lerp(0.2, 0.1, smooth(28, 29, t)); fx.maxBlur = 14;
    scene.environmentIntensity = 0.03;
    fx.flash = 0.18 * Math.exp(-Math.max(0, t - 24.0) / 0.07) + (t >= 29 ? 0.22 * Math.exp(-(t - 29) / 0.08) : 0);
    fx.flashColor = t >= 29 ? [1.0, 0.25, 0.18] : [1, 1, 1];
    fx.chroma = 0.0022 + 0.012 * Math.exp(-Math.abs(t - 28.15) / 0.12) + (t >= 29 ? 0.01 * Math.exp(-(t - 29) / 0.2) : 0);
    fx.saturation = 0.8; fx.contrast = 1.16;
    fx.glitch = t >= 32.36 && t < 32.5 ? 0.8 : 0;
    fx.fade = t >= 32.5 ? 1 : 0;
    ashAt(new THREE.Vector3(IX, 0.3, 1.2), new THREE.Vector3(4, 4, 5), 0.4, 0.1);
  }

  // ---------- 33-42 SHOWCASE ----------
  function shotShowcase(t) {
    showcase.group.visible = true;
    phone.userData.screen.material.map = screens.feed;
    const r = showcase.update(t);
    setCam(r.pos.clone().add(drift(t, 0.015)), r.tgt, r.fov, Math.sin(t * 0.8) * 0.015);
    fx.focus = r.focusTarget ? camera.position.distanceTo(r.focusTarget) : 1.9;
    fx.aperture = 0.1; fx.maxBlur = 12;
    scene.environmentIntensity = 0.12;
    scene.fog.density = 0.075; scene.fog.color.setRGB(0.028, 0.03, 0.036);
    fx.fade = 1 - smooth(33.0, 33.25, t);
    fx.flash = 0.12 * Math.exp(-Math.max(0, t - 40.62) / 0.1) * (t > 40.62 ? 1 : 0);
    fx.flashColor = [0.9, 0.92, 1.0];
    ashAt(camera.position.clone().add(new THREE.Vector3(0, 0, -2.5)), new THREE.Vector3(5, 5, 7), 0.4, 0.12);
  }

  // ---------- 42-60 CLIMAX + FINAL ----------
  function shotClimax(t) {
    climax.group.visible = true;
    const r = climax.update(t);
    const still = t >= FREEZE;
    setCam(r.pos.clone().add(still ? new THREE.Vector3() : drift(r.tt, 0.012 * (1 - smooth(54, 56.8, r.tt)))), r.tgt, r.fov, 0);
    fx.focus = camera.position.distanceTo(AV_POS); fx.aperture = 0.06; fx.maxBlur = 12;
    scene.environmentIntensity = 0.05;
    fx.flash = (t >= 42 ? 0.3 * Math.exp(-(t - 42) / 0.06) : 0) + (t >= 46 ? 0.12 * Math.exp(-(t - 46) / 0.1) : 0);
    fx.flashColor = [1.0, 0.18, 0.1];
    fx.chroma = 0.0022 + (t >= 42 ? 0.012 * Math.exp(-(t - 42) / 0.2) : 0);
    fx.frame = Math.round(Math.min(t, FREEZE) * 60) + (still ? 0 : 0);
    if (still) fx.grain = 0.04;
    ash.material.uniforms.uTime.value = r.tt;
    const u = ash.material.uniforms; u.uEmber.value = 0.25;
    ashAt(new THREE.Vector3(KX, 0.8, 2.5), new THREE.Vector3(6, 6, 8), 0.45, 0.14);
  }

  const shots = [
    { t0: 0, t1: 7, run: shotIntro },
    { t0: 7, t1: 15, run: shotReveal },
    { t0: 15, t1: 24, run: shotContent },
    { t0: 24, t1: 33, run: shotIdentity },
    { t0: 33, t1: 42, run: shotShowcase },
    { t0: 42, t1: 60.01, run: shotClimax },
  ];

  function update(t) {
    baseFx();
    fx.frame = Math.round(t * 60);
    for (const g of groups) g.visible = false;
    ash.visible = true;
    ash.material.uniforms.uTime.value = t;
    ash.material.uniforms.uPixel.value = engine.renderer.getPixelRatio();
    ash.material.uniforms.uEmber.value = 0;
    for (const l of Object.values(rig)) l.intensity = 0;
    scene.fog.density = 0;
    const s = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
    s.run(t);
    if (DBG.has('cam')) { const c = DBG.get('cam').split(',').map(Number); setCam(new THREE.Vector3(c[0], c[1], c[2]), new THREE.Vector3(c[3], c[4], c[5]), c[6] || 35); fx.aperture = 0; }
    if (DBG.has('bright')) { scene.environmentIntensity = 1.0; fx.exposure = 2.0; }
    if (DBG.has('noash')) ash.visible = false;
    if (DBG.has('nodof')) fx.aperture = 0;
    ash.material.uniforms.uFocus.value = fx.focus;
    ash.material.uniforms.uAperture.value = fx.aperture * 4;
  }

  async function prepare(t) { await climax.prepare(t); }

  // Sub-frame motion blur (180-degree shutter) only where the camera or debris move fast.
  const BLUR = [[7.0, 7.6, 4], [7.6, 10.6, 3], [14.15, 15.0, 4], [15.0, 15.45, 3], [18.0, 18.45, 3], [21.0, 21.5, 3], [28.0, 28.9, 4], [39.5, 41.0, 3], [42.0, 42.3, 3]];
  function motionBlurAt(t) {
    const shot = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
    for (const [a, b, n] of BLUR) if (t >= a && t < b) return { subframes: n, shutter: 0.5, range: [shot.t0, shot.t1 - 1e-4] };
    return { subframes: 1 };
  }

  return { update, prepare, motionBlurAt };
}
