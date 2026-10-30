import * as THREE from 'three';
import { T, SLAM, BEAT, DURATION } from '../timeline.js';
import { C } from '../hud.js';
import { clamp, smooth, pulse, win, easeOutBack, easeOutCubic, easeOutExpo, rng, hash, shake, stepNoise, noise1, scramble } from '../util.js';
import { applyCam, canvasTex, screenMaterial, pointsMaterial } from '../util3d.js';

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 400);
let mon, scr, scrMat, glow, warp, warpMat, rings = [], monitorGroup;

const REBOOT = ['SYSTEM REBOOTING...', 'RESTORING DATABASE...', 'CONNECTING USERS...', 'CHAOS RESTORED'];

function drawScreen(t) {
  const { ctx: c } = scr; const W = 1024, H = 768;
  c.fillStyle = '#010401'; c.fillRect(0, 0, W, H);
  const on = clamp((t - T.monitor) / 0.6);
  c.font = '34px MonoB';
  REBOOT.forEach((l, i) => {
    const t0 = T.reboot[i]; if (t < t0) return;
    const y = 150 + i * 70;
    const n = Math.min(l.length, Math.floor((t - t0) * 40));
    const last = i === 3;
    c.fillStyle = last ? '#ffffff' : C.green;
    c.fillText('> ' + l.slice(0, n), 70, y);
    if (!last && t > t0 + 0.5) {
      const p = clamp((t - t0 - 0.5) / 0.8);
      c.strokeStyle = C.green; c.lineWidth = 2; c.strokeRect(640, y - 26, 300, 28);
      c.fillStyle = C.green; c.fillRect(644, y - 22, 292 * p, 20);
      if (i === 2) { c.fillStyle = '#cfe'; c.font = '24px Mono'; c.fillText(`${Math.round(62 * p)}/62`, 860, y + 30); c.font = '34px MonoB'; }
    }
  });
  if (t >= T.monTitle) {
    const k = t - T.monTitle;
    c.textAlign = 'center';
    c.fillStyle = '#fff'; c.font = '56px Unb';
    c.fillText(scramble('SWAG_ZOV_NEFOR.exe', clamp(1 - k / 0.5), Math.floor(t * 25)), W / 2, 560);
    c.fillStyle = C.green; c.font = '26px Mono'; c.fillText('v∞ · ЧАТ КАНАЛА MEMENTO MORI', W / 2, 620);
    c.textAlign = 'left';
  }
  if (Math.floor(t * 2.5) % 2 === 0 && t < T.monTitle) {
    const n = REBOOT.filter((_, i) => t >= T.reboot[i]).length;
    c.fillStyle = C.green; c.fillRect(70, 120 + n * 70, 22, 34);
  }
  // включение: точка → линия → кадр
  if (on < 1) {
    c.save(); c.globalCompositeOperation = 'destination-in';
    const w = on < 0.4 ? W * Math.max(0.01, on / 0.4) : W, h = on < 0.4 ? 4 : Math.max(4, H * (on - 0.4) / 0.6);
    c.fillStyle = '#fff'; c.fillRect(W / 2 - w / 2, H / 2 - h / 2, w, h); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(220,255,220,${1 - on})`; c.fillRect(W / 2 - w / 2, H / 2 - h / 2, w, h); c.restore();
  }
  scr.tex.needsUpdate = true;
}

export default {
  async init() {
    const r = rng(66);
    monitorGroup = new THREE.Group(); scene.add(monitorGroup);
    const plastic = new THREE.MeshStandardMaterial({ color: 0x1c1c1a, roughness: 0.55, metalness: 0.15 });
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.85, 0.25), plastic); monitorGroup.add(bezel);
    const backBox = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.4, 1.4), plastic); backBox.position.z = -0.8; monitorGroup.add(backBox);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.6), plastic); neck.position.set(0, -1.05, -0.5); monitorGroup.add(neck);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.9), plastic); base.position.set(0, -1.22, -0.5); monitorGroup.add(base);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x39ff14 })); led.position.set(0.95, -0.8, 0.126); monitorGroup.add(led);
    scr = canvasTex(1024, 768);
    scrMat = screenMaterial(scr.tex, { gain: 1.3 });
    const sg = new THREE.PlaneGeometry(1.9, 1.42, 24, 18); const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); sp.setZ(i, 0.06 - 0.05 * (x * x + y * y)); }
    const s = new THREE.Mesh(sg, scrMat); s.position.z = 0.16; monitorGroup.add(s);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshStandardMaterial({ color: 0x0a0b0a, roughness: 0.3, metalness: 0.7 }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -1.26; scene.add(desk); this.desk = desk;
    glow = new THREE.PointLight(0x7dff6a, 0, 10, 1.2); glow.position.set(0, 0.2, 2.2); scene.add(glow);
    const rim = new THREE.SpotLight(0x9dff8a, 30, 14, 0.5, 0.8, 1.2); rim.position.set(-3, 3.5, -3); rim.target.position.set(0, 0, -0.5); scene.add(rim, rim.target); this.rim = rim;
    scene.add(new THREE.AmbientLight(0x0c100c, 0.6));
    // варп-поле после удара
    const n = 5000, p = new Float32Array(n * 3), sz = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = r() * 6.28, rr = 2 + Math.pow(r(), 0.6) * 40; p.set([Math.cos(a) * rr, Math.sin(a) * rr, -r() * 300], i * 3); sz[i] = 0.4 + r() * 1.4; const red = r() < 0.12; col.set(red ? [1, 0, 0.2] : r() < 0.2 ? [1, 1, 1] : [0.3, 1, 0.2], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    warpMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, opacity: { value: 0 }, speed: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSize; attribute vec3 aColor; uniform float time, speed; varying vec3 vC; void main(){ vec3 pos = position; pos.z = mod(position.z + speed, 300.0) - 300.0 + 20.0; vC = aColor; vec4 mv = modelViewMatrix * vec4(pos, 1.0); gl_PointSize = aSize * 3.0 * (300.0 / -mv.z) * 0.2; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform float opacity; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC * a * opacity, 1.0); }',
    });
    warp = new THREE.Points(g, warpMat); warp.frustumCulled = false; warp.position.z = -40; scene.add(warp);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.04, 128), new THREE.MeshBasicMaterial({ color: i % 3 === 2 ? 0xff0033 : 0x39ff14, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.z = -30; rings.push(m); scene.add(m);
    }
  },

  update(t) {
    drawScreen(t);
    const post = t >= SLAM;
    const on = smooth(T.monitor, T.monitor + 0.6, t);
    const dim = smooth(T.q1 - 0.3, T.q1 + 0.6, t) * 0.55;
    scrMat.uniforms.time.value = t; scrMat.uniforms.gain.value = 1.3 * on * (1 - dim) * (t < T.monitor ? 0 : 1);
    scrMat.uniforms.flicker.value = 0.08;
    glow.intensity = 14 * on * (1 - dim); this.rim.intensity = 30 * smooth(85.5, 87.5, t);
    monitorGroup.visible = !post; this.desk.visible = !post; if (post) { glow.intensity = 0; this.rim.intensity = 0; }
    warp.visible = post; rings.forEach((m) => (m.visible = post));
    if (post) {
      const k = t - SLAM;
      warpMat.uniforms.opacity.value = 1 - smooth(T.endGlitch, T.black, t);
      warpMat.uniforms.speed.value = 80 * k + 120 * (1 - Math.exp(-k * 3));
      rings.forEach((m, i) => {
        const age = ((k + i * BEAT) % (BEAT * 6)) / (BEAT * 6);
        m.scale.setScalar(2 + age * 60); m.material.opacity = (1 - age) * 0.8 * (1 - smooth(T.endGlitch, T.black, t)); m.rotation.z = t * 0.2 + i;
      });
      cam.position.set(shake(t, 61) * 0.3 * pulse(t, SLAM, 1.5), shake(t, 62) * 0.3 * pulse(t, SLAM, 1.5), 8);
      cam.up.set(0, 1, 0); cam.lookAt(0, 0, -30); cam.rotateZ(Math.sin(t * 0.5) * 0.03);
      cam.fov = 60 + 15 * pulse(t, SLAM, 2); cam.updateProjectionMatrix();
    } else {
      const keys = [
        { t: 84.67, p: [1.2, 0.5, 8.5], l: [0, 0, 0], roll: 0.03, fov: 40 },
        { t: 90.0, p: [0.6, 0.2, 4.4], l: [0, 0.05, 0], roll: 0.01, fov: 40 },
        { t: 95.0, p: [-0.4, 0.1, 3.4], l: [0, 0.05, 0], roll: -0.015, fov: 40 },
        { t: 102.6, p: [0.15, 0.05, 2.6], l: [0, 0.05, 0], roll: 0.01, fov: 40 },
        { t: SLAM, p: [0, 0.05, 1.2], l: [0, 0.05, 0], roll: 0, fov: 60 },
      ];
      applyCam(cam, keys, t, { dx: noise1(t * 0.3) * 0.05, dy: noise1(t * 0.25 + 5) * 0.03 });
    }
    return { scene, camera: cam };
  },

  fx(t) {
    const post = t >= SLAM;
    const slam = pulse(t, SLAM, 5);
    let st = 0; for (const s of T.status) st = Math.max(st, pulse(t, s, 7));
    const endG = t < T.black ? smooth(T.endGlitch, T.black, t) : 0;
    let beat = 0; if (post && t < T.endGlitch) beat = pulse(((t - SLAM) % (BEAT * 2)), 0, 9) * 0.5;
    const intro = 1 - smooth(84.67, 85.2, t);
    return {
      fade: (t >= T.black && t < T.never - 0.05) || (t > T.neverEnd + 0.35 && t < T.credits) ? 1 : 0,
      flash: pulse(t, SLAM, 16) * 0.3, ca: 0.2 + slam * 3 + st * 1.5 + endG * 4 + beat, glitch: slam * 0.6 + st * 0.4 + endG * 1.0 + beat * 0.3 + pulse(t, T.monTitle, 5) * 0.4,
      rgbSplit: slam + st * 0.6 + endG, tear: endG + (t < T.monitor + 1 && t > T.monitor ? 0.3 : 0), staticAmt: endG * 0.8 * stepNoise(t, 20, 3) + pulse(t, T.monitor, 5) * 0.3,
      noiseAmt: 0.3, scan: 0.35, curve: post ? 0 : 0.06, vig: 0.85, radial: slam * 1.2 + beat * 0.3, samples: slam > 0.3 ? 4 : 1,
      bloom: post ? 1.2 : 1.0, bloomThreshold: 0.4, dof: post ? 0 : 0.5, focus: 3.5, focusRange: 2.5, pixelate: endG > 0.5 ? (endG - 0.5) * 0.8 : 0,
    };
  },

  hud(h, t) {
    // две фразы — массивная кинотипографика
    const phrase = (str, t0, t1, y, col) => {
      if (t < t0 || t > t1 + 0.3) return;
      const k = t - t0;
      const words = str.split(' ');
      const SZ = Math.min(92, 92 * 1720 / h.measure(str, { font: 'Dela', size: 92, track: 2 }));
      const total = h.measure(str, { font: 'Dela', size: SZ, track: 2 });
      let x = 960 - total / 2;
      const out = smooth(t1 - 0.3, t1 + 0.2, t);
      words.forEach((w, i) => {
        const wk = clamp((k - i * 0.16) / 0.45);
        const e = easeOutExpo(wk);
        const ww = h.measure(w + ' ', { font: 'Dela', size: SZ, track: 2 });
        h.text(w, x, y + (1 - e) * 40, { font: 'Dela', size: SZ, color: col(i), alpha: e * (1 - out), track: 2, split: (1 - e) * 10 + out * 14, slices: { amt: out * 90, seed: Math.floor(t * 20) + i } });
        x += ww;
      });
    };
    phrase('МЫ НЕ СОЗДАВАЛИ ХАОС.', T.q1, T.q1End, 960, (i) => (i === 3 ? C.red : '#fff'));
    phrase('МЫ ПРОСТО ДАЛИ ЕМУ ГРУППОВОЙ ЧАТ.', T.q2, T.q2End, 960, (i) => (i >= 4 ? C.green : '#fff'));
    // название на весь экран
    if (t >= SLAM && t < T.black) {
      const k = t - SLAM;
      const e = easeOutExpo(clamp(k / 0.5));
      const sc = 1.1 - 0.1 * e + 0.015 * Math.sin(k * 2);
      const endG = smooth(T.endGlitch, T.black, t);
      const beat = pulse(((t - SLAM) % (BEAT * 2)), 0, 10);
      h.text('SWAG_ZOV_NEFOR.exe', 960, 520, { font: 'Unb', size: Math.min(168, 168 * 1700 / h.measure('SWAG_ZOV_NEFOR.exe', { font: 'Unb', size: 168 })), align: 'center', color: '#fff', alpha: clamp(k / 0.05) * (1 - endG), scale: sc, split: 6 + beat * 10 + endG * 30, slices: { amt: (k < 0.3 ? 120 * (1 - k / 0.3) : 0) + beat * 25 + endG * 200, seed: Math.floor(t * 24) } });
      const lines = [['SYSTEM STATUS: ', 'ACTIVE', C.green], ['SHUTDOWN: ', 'IMPOSSIBLE', C.red], ['WELCOME TO ', 'SWAG_ZOV_NEFOR.exe', '#fff']];
      lines.forEach(([a, b, col], i) => {
        const t0 = T.status[i]; if (t < t0) return;
        const kk = clamp((t - t0) / 0.3);
        const s = a + b, n = Math.floor(clamp((t - t0) / 0.4) * s.length);
        const shown = s.slice(0, n);
        const wa = h.measure(a, { font: 'TekM', size: 44, track: 6 }), wt = h.measure(s, { font: 'TekM', size: 44, track: 6 });
        const x0 = 960 - wt / 2, y = 680 + i * 70;
        h.text(shown.slice(0, a.length), x0, y, { font: 'TekM', size: 44, color: '#9aa69a', alpha: kk * (1 - endG), track: 6 });
        if (n > a.length) h.text(shown.slice(a.length), x0 + wa, y, { font: 'Tek', size: 44, color: col, alpha: kk * (1 - endG), track: 6, split: (1 - kk) * 8 });
      });
      if (t >= T.memento) h.text('ЧАТ КАНАЛА MEMENTO MORI', 960, 940, { font: 'Mono', size: 24, align: 'center', track: 10, color: C.green, alpha: clamp((t - T.memento) / 0.4) * (1 - endG) * 0.9 });
      h.corners(80, 80, 1760, 920, 50, C.green, 3, (1 - endG) * clamp(k / 0.3) * 0.7);
      h.text(`REC ● ${(t - SLAM).toFixed(2)}`, 120, 140, { font: 'MonoB', size: 20, color: C.red, alpha: (1 - endG) * (Math.floor(t * 2) % 2 ? 1 : 0.4) });
    }
    if (t >= T.never && t < T.neverEnd + 0.3) {
      const a = win(t, T.never, T.neverEnd + 0.3, 0.3, 0.3);
      const s = 'THE SYSTEM WILL NEVER BE FIXED.';
      h.text(s.slice(0, Math.floor((t - T.never) * 40)), 960, 548, { font: 'MonoB', size: 34, align: 'center', color: C.green, alpha: a, track: 8 });
    }
    if (t >= T.credits) {
      const a = win(t, T.credits, DURATION, 0.5, 0.6);
      const L = [
        ['MUSIC', ''],
        ['«Heart of Machine» — xezno', 'CC-BY 3.0 · opengameart.org'],
        ['«Dark Ambient Loop 13» — farcodev', 'CC-BY 3.0 · opengameart.org'],
        ['SFX', ''],
        ['SFX Sampler — Packsmithy (packsmithy.com)', 'CC-BY 4.0 · opengameart.org'],
        ['Keyboard, static, electricity, breaking SFX', 'CC0 · Unicae Games · Gena Sealov · PFNienow · frances'],
        ['FONTS', ''],
        ['Unbounded · Dela Gothic One · Tektur · JetBrains Mono · Rubik Glitch', 'SIL OFL 1.1 · Google Fonts'],
      ];
      L.forEach(([l, r2], i) => {
        const y = 330 + i * 56;
        const head = r2 === '';
        h.text(l, 960, y, { font: head ? 'Tek' : 'Mono', size: head ? 26 : 24, align: 'center', color: head ? C.green : '#ddd', alpha: a, track: head ? 8 : 1 });
        if (!head) h.text(r2, 960, y + 24, { font: 'Mono', size: 16, align: 'center', color: '#777', alpha: a, track: 1 });
      });
    }
  },
};
