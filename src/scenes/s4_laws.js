import * as THREE from 'three';
import { T, LAW_LINES, DROP } from '../timeline.js';
import { C } from '../hud.js';
import { clamp, smooth, pulse, win, easeOutCubic, rng, hash, shake, stepNoise, noise1, scramble } from '../util.js';
import { applyCam, canvasTex, screenMaterial, beamMaterial } from '../util3d.js';
import { ledTex } from '../textures.js';

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 200);
export const SCREEN = { w: 7.2, h: 4.05, y: 4.2, z: -22 };
export const FINAL_DIST = (SCREEN.h / 2) / Math.tan((50 / 2) * Math.PI / 180);
export let lawScreen; // общий холст: сцена V строит из него осколки
let screenMat, sideMats = [], strips = [], stripMats = [], ledMats = [], beacons = [], beaconMats = [], beams = [], hallLights = [];

export function drawLaw(t, target = lawScreen) {
  const { ctx: c } = target; const W = 1600, H = 900;
  const red = smooth(T.redLight, T.redLight + 0.15, t);
  c.fillStyle = red > 0 ? '#0c0002' : '#020602'; c.fillRect(0, 0, W, H);
  c.strokeStyle = red > 0 ? 'rgba(255,0,51,0.25)' : 'rgba(57,255,20,0.12)'; c.lineWidth = 1;
  for (let y = 0; y < H; y += 6) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.fillStyle = red > 0 ? C.red : C.green; c.font = '30px MonoB';
  c.fillText('root@swag_zov_nefor:~# cat /etc/laws.cfg', 70, 90);
  c.fillRect(70, 112, 1460, 3);
  const allowed = t >= T.allowed;
  if (!allowed) {
    LAW_LINES.forEach(([k, v], i) => {
      const t0 = T.lines[i]; if (t < t0) return;
      const y = 190 + i * 92;
      const dec = clamp(1 - (t - t0) / 0.28);
      const last = i === LAW_LINES.length - 1;
      const pad = '.'.repeat(Math.max(2, 18 - k.length));
      c.font = '56px MonoB';
      c.fillStyle = '#e8ffe0'; c.fillText(scramble(`${k} ${pad}`, dec, i * 7 + Math.floor(t * 30)), 70, y);
      const vx = 70 + c.measureText(`${k} ${pad} `).width;
      const vc = last ? C.red : (v === 'UNLIMITED' ? '#ffffff' : C.green);
      c.fillStyle = vc; c.shadowColor = vc; c.shadowBlur = 24;
      c.fillText(scramble(`[ ${v} ]`, dec, i * 13 + Math.floor(t * 30)), vx, y);
      c.shadowBlur = 0;
    });
    if (Math.floor(t * 2.5) % 2 === 0) { const n = LAW_LINES.filter((_, i) => t >= T.lines[i]).length; c.fillStyle = red > 0 ? C.red : C.green; c.fillRect(70, 150 + n * 92, 30, 50); }
  } else {
    const k = t - T.allowed;
    const g = k < 0.3 ? 1 - k / 0.3 : 0;
    c.textAlign = 'center';
    c.fillStyle = '#e4e4e4'; c.font = '150px Dela'; c.shadowColor = C.red; c.shadowBlur = 10;
    c.fillText(scramble('РАЗРЕШЕНО', g, Math.floor(t * 30)), W / 2, 420);
    c.fillStyle = C.red; c.font = '128px Dela';
    c.fillText(scramble('АБСОЛЮТНО ВСЁ', g, 3 + Math.floor(t * 30)), W / 2, 600);
    c.shadowBlur = 0; c.textAlign = 'left';
    c.fillStyle = C.red; c.font = '28px MonoB';
    if (Math.floor(t * 3) % 2 === 0) c.fillText('!! ACCESS LEVEL: GOD MODE !!', 560, 720);
  }
  // трещины перед дропом
  const cr = smooth(T.crack, DROP, t);
  if (cr > 0) {
    const r = rng(77); c.strokeStyle = '#ffffff'; c.shadowColor = '#fff'; c.shadowBlur = 8;
    for (let i = 0; i < 9; i++) {
      let x = W * 0.5 + (r() - 0.5) * 200, y = H * 0.5 + (r() - 0.5) * 120; const a0 = r() * Math.PI * 2;
      c.lineWidth = 2 + r() * 3; c.beginPath(); c.moveTo(x, y);
      const len = (300 + r() * 700) * cr;
      for (let s = 0; s < len; s += 40) { const a = a0 + (r() - 0.5) * 0.9; x += Math.cos(a) * 40; y += Math.sin(a) * 40; c.lineTo(x, y); }
      c.stroke();
    }
    c.shadowBlur = 0;
  }
  target.tex.needsUpdate = true;
}

export default {
  async init() {
    lawScreen = canvasTex(1600, 900);
    scene.fog = new THREE.FogExp2(0x010201, 0.02);
    const r = rng(44);
    const metal = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.45, metalness: 0.8 });
    // пол с «отражениями»: полупрозрачный пол + зеркальные копии светящихся полос под ним
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), new THREE.MeshStandardMaterial({ color: 0x070807, roughness: 0.2, metalness: 0.9, transparent: true, opacity: 0.86 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -10; scene.add(floor);
    const grid = new THREE.GridHelper(120, 60, 0x1e3a18, 0x0f1a0d); grid.position.y = 0.01; grid.position.z = -10; scene.add(grid);
    // стойки
    const rack = new THREE.BoxGeometry(1.5, 6.5, 1.5);
    const racks = new THREE.InstancedMesh(rack, metal, 120); const d = new THREE.Object3D(); let n = 0;
    const ledGeo = new THREE.PlaneGeometry(1.2, 6.0);
    for (let i = 0; i < 3; i++) ledMats.push(new THREE.MeshBasicMaterial({ map: ledTex(90 + i), color: 0xffffff }));
    for (let side = -1; side <= 1; side += 2) for (let row = 0; row < 2; row++) for (let i = 0; i < 24; i++) {
      const x = side * (7 + row * 3.2), z = 22 - i * 1.7;
      d.position.set(x, 3.25, z); d.rotation.set(0, 0, 0); d.updateMatrix(); racks.setMatrixAt(n++, d.matrix);
      if (row === 0) { const l = new THREE.Mesh(ledGeo, ledMats[i % 3]); l.position.set(x - side * 0.76, 3.25, z); l.rotation.y = -side * Math.PI / 2; scene.add(l); }
    }
    racks.count = n; scene.add(racks);
    // потолочные полосы света + отражения
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 4.5;
      const m = new THREE.MeshBasicMaterial({ color: 0xd8ffd0 }); stripMats.push(m);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 60), m); s.position.set(x, 9, -8); scene.add(s); strips.push(s);
      const refl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 60), new THREE.MeshBasicMaterial({ color: 0xd8ffd0, transparent: true, opacity: 0.18 }));
      refl.position.set(x, -0.3, -8); scene.add(refl); stripMats.push(refl.material);
    }
    // объёмные лучи из-под потолка
    for (let i = 0; i < 6; i++) {
      const bm = beamMaterial([0.6, 1, 0.5], 0.08);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 2.2, 9, 32, 1, true), bm);
      b.position.set((i % 2 ? -1 : 1) * 4.5, 4.5, 12 - Math.floor(i / 2) * 12); scene.add(b); beams.push(bm);
    }
    // терминал: монолит, экран, боковые экраны, постамент
    const mono = new THREE.Mesh(new THREE.BoxGeometry(8.6, 6.8, 1.4), metal); mono.position.set(0, 4.0, SCREEN.z - 0.75); scene.add(mono);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(11, 0.6, 5), metal); plinth.position.set(0, 0.3, SCREEN.z + 0.5); scene.add(plinth);
    const step = new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 7), metal); step.position.set(0, 0.15, SCREEN.z + 1); scene.add(step);
    screenMat = screenMaterial(lawScreen.tex, { gain: 1.2 });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat); scr.position.set(0, SCREEN.y, SCREEN.z); scene.add(scr);
    for (const s of [-1, 1]) {
      const st = canvasTex(512, 768); const c = st.ctx;
      const sm = screenMaterial(st.tex, { gain: 1.1 }); sm.userData = st; sideMats.push(sm);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), sm); m.position.set(s * 6.4, 4.2, SCREEN.z + 0.9); m.rotation.y = -s * 0.45; scene.add(m);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.8, 0.2), metal); fr.position.copy(m.position); fr.rotation.copy(m.rotation); fr.translateZ(-0.12); scene.add(fr);
    }
    // маячки тревоги
    for (let i = 0; i < 8; i++) {
      const bm = new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 24, 1, true), bm);
      cone.geometry.translate(0, -3.5, 0); cone.geometry.rotateZ(Math.PI / 2);
      const holder = new THREE.Group(); holder.position.set((i % 2 ? -1 : 1) * 7, 6.7, 16 - Math.floor(i / 2) * 9); holder.add(cone); scene.add(holder);
      beacons.push(holder); beaconMats.push(bm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff0033 })); bulb.position.copy(holder.position); scene.add(bulb); beaconMats.push(bulb.material);
    }
    scene.add(new THREE.AmbientLight(0x101810, 2.0));
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0x9dff8a, 18, 22, 1.4); l.position.set(0, 8, 14 - i * 12); scene.add(l); hallLights.push(l); }
    const sl = new THREE.PointLight(0x7dff6a, 25, 16, 1.4); sl.position.set(0, 4.2, SCREEN.z + 3); scene.add(sl); hallLights.push(sl);
  },

  update(t) {
    drawLaw(t);
    const red = smooth(T.redLight, T.redLight + 0.12, t);
    const alarm = red * (0.6 + 0.4 * Math.sin(t * 12));
    screenMat.uniforms.time.value = t; screenMat.uniforms.gain.value = (t > T.allowed ? 0.82 : 1.2) + pulse(t, T.allowed, 6) * 0.35;
    screenMat.uniforms.flicker.value = red * 0.2;
    // боковые экраны: бегущий лог
    sideMats.forEach((sm, si) => {
      const { ctx: c, tex } = sm.userData; c.fillStyle = red > 0 ? '#100003' : '#010501'; c.fillRect(0, 0, 512, 768);
      c.font = '26px Mono';
      for (let i = 0; i < 26; i++) {
        const k = Math.floor(t * 9) + i + si * 13;
        c.fillStyle = red > 0 ? (hash(k) > 0.4 ? C.red : '#ff8099') : (hash(k) > 0.85 ? C.red : C.green);
        c.fillText(`${(k * 2654435761 >>> 0).toString(16).slice(0, 8).toUpperCase()} ${['OK', 'SYNC', 'PUSH', 'MEME', 'ARG', 'LOL', 'ERR'][k % 7]}`, 20, 32 + i * 28);
      }
      tex.needsUpdate = true; sm.uniforms.time.value = t;
    });
    stripMats.forEach((m, i) => {
      const base = i % 2 === 0 ? 1 : 0.18;
      if (red > 0) m.color.setRGB(1.0 * (0.5 + 0.5 * alarm), 0, 0.2 * alarm); else m.color.setRGB(0.85, 1, 0.82);
      if (m.opacity !== undefined && i % 2 === 1) m.opacity = base;
    });
    ledMats.forEach((m, i) => { m.map.offset.y = Math.floor(t * (3 + i)) * 0.21; m.color.setRGB(1 + red * 0.8, 1 - red * 0.9, 1 - red * 0.8); });
    beams.forEach((b) => { b.uniforms.strength.value = 0.08 * (1 - red * 0.5); b.uniforms.color.value.set(0.6 + red * 0.6, 1 - red * 0.95, 0.5 - red * 0.3); b.uniforms.time.value = t; });
    beacons.forEach((b, i) => { b.rotation.y = t * 5 + i; });
    beaconMats.forEach((m, i) => { if (i % 2 === 0) m.opacity = red * 0.18; else m.color.setRGB(red * 1.2 + 0.15, 0, 0.05); });
    hallLights.forEach((l, i) => {
      if (red > 0) l.color.setRGB(1, 0.02, 0.12); else l.color.setRGB(0.62, 1, 0.55);
      l.intensity = (i === 3 ? 25 : 18) * (red > 0 ? 0.6 + 0.6 * alarm : 1);
    });
    const D = FINAL_DIST;
    const keys = [
      { t: 50.0, p: [0, 8.2, 26], l: [0, 4.2, -22], roll: -0.12, fov: 60 },
      { t: 52.0, p: [-1.5, 5.4, 7], l: [0, 4.2, -22], roll: -0.03, fov: 52 },
      { t: 54.6, p: [1.2, 4.4, -10.0], l: [0, 4.1, -22], roll: 0.02, fov: 50 },
      { t: 57.5, p: [-0.8, 4.2, -12.6], l: [0, 4.15, -22], roll: -0.015, fov: 50 },
      { t: 60.4, p: [0.5, 4.1, -13.3], l: [0, 4.2, -22], roll: 0.02, fov: 50 },
      { t: 62.4, p: [-0.3, 4.0, -14.0], l: [0, 4.2, -22], roll: -0.02, fov: 50 },
      { t: 64.4, p: [0.1, 4.2, -15.2], l: [0, 4.2, -22], roll: 0.01, fov: 50 },
      { t: 65.6, p: [0.0, 4.2, SCREEN.z + D + 0.35], l: [0, 4.2, -22], roll: 0, fov: 50 },
      { t: 66.0, p: [0.0, 4.2, SCREEN.z + D], l: [0, 4.2, -22], roll: 0, fov: 50 },
    ];
    let lp = 0; for (const lt of T.lines) lp = Math.max(lp, pulse(t, lt, 9));
    const sh = lp * 0.04 + pulse(t, T.redLight, 3) * 0.12 + red * 0.02 + smooth(T.crack, DROP, t) * 0.06;
    const fade = 1 - smooth(65.5, 65.9, t);
    applyCam(cam, keys, t, { dx: shake(t, 31) * sh * fade, dy: shake(t, 32) * sh * fade, roll: shake(t, 33) * sh * 0.3 * fade });
    return { scene, camera: cam };
  },

  fx(t) {
    const red = smooth(T.redLight, T.redLight + 0.12, t);
    let lp = 0; for (const lt of T.lines) lp = Math.max(lp, pulse(t, lt, 8));
    const enter = 1 - smooth(50, 50.45, t);
    const cr = smooth(T.crack, DROP, t);
    return {
      flash: pulse(t, 50, 12) * 0.25, radial: enter * 0.9 + cr * 0.3, samples: enter > 0.15 ? 4 : 1,
      ca: 0.2 + lp * 0.7 + red * 0.5 * (1 - win(t, T.allowed + 0.4, T.crack, 0.2, 0.1)) + pulse(t, T.allowed, 5) * 1.5 + cr * 1.2,
      glitch: lp * 0.15 + pulse(t, T.redLight, 4) * 0.6 + pulse(t, T.allowed, 5) * 0.5 + cr * 0.4 * (stepNoise(t, 16, 4) > 0.4 ? 1 : 0),
      rgbSplit: pulse(t, T.allowed, 3) * 0.8 + cr * 0.6, redFlash: pulse(t, T.redLight, 4) * 0.6,
      noiseAmt: 0.2 + red * 0.3, tear: cr * 0.5,
      dof: 0.5 * (1 - smooth(63, 64.5, t)), focus: 48 - 40 * smooth(50, 61, t), focusRange: 12,
      bloom: 1.1 + red * 0.3 - win(t, T.allowed + 0.3, T.crack, 0.2, 0.1) * 0.6, bloomThreshold: t > T.allowed ? 0.6 : 0.4, vig: 0.85, exposure: t > T.allowed ? 1.0 : 1.2,
    };
  },

  hud(h, t) {
    const a = win(t, 50.4, 65.7, 0.4, 0.2);
    h.text('TERMINAL://LAWS.CFG', 60, 70, { font: 'MonoB', size: 20, color: t > T.redLight ? C.red : C.green, alpha: a * 0.85, track: 4 });
    const n = LAW_LINES.filter((_, i) => t >= T.lines[i]).length;
    h.text(`${n}/7 LOADED`, 1860, 70, { font: 'Tek', size: 28, align: 'right', color: t > T.redLight ? C.red : C.green, alpha: a * 0.85, track: 3 });
    if (t > T.redLight && t < 65.7) h.tag('ALERT: ALL RESTRICTIONS REMOVED', 60, 1030, C.red, t, a, 22);
  },
};
