import * as THREE from 'three';
import { T, MESSAGES } from '../timeline.js';
import { C } from '../hud.js';
import { clamp, smooth, pulse, win, easeOutBack, easeOutCubic, easeOutExpo, rng, hash, shake, stepNoise, noise1, scramble } from '../util.js';
import { applyCam, canvasTex, holoMaterial, pointsMaterial } from '../util3d.js';
import { maskTex, wordTex } from '../textures.js';

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 200);
let nodes = [], lines, linePairs = [], pulses, logo, ring1, ring2, ico, logoMat, figures = [], membrane, membraneMat, floorGrid;
const N = 62;
const DIAG = [['62', ' ЧЕЛОВЕКА.'], ['0', ' ФИЛЬТРОВ.'], ['1', ' ОБЩИЙ ДИАГНОЗ.']];
const DIAG_T = [46.4, 47.3, 48.2];

// фигура с френелевым свечением
const figMat = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Vector3(0.22, 1, 0.08) }, red: { value: 0 } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 color; uniform float red; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); vec3 c = mix(color, vec3(1.0,0.0,0.2), red); gl_FragColor = vec4(c * f * 1.4 + vec3(0.01), 1.0); }',
});

function makeFigure() {
  const g = new THREE.Group();
  const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, figMat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.32, 0.24, 1.0, 10), 0, 1.45, 0);
  add(new THREE.CylinderGeometry(0.11, 0.09, 0.95, 8), -0.14, 0.48, 0);
  add(new THREE.CylinderGeometry(0.11, 0.09, 0.95, 8), 0.14, 0.48, 0);
  const la = add(new THREE.CylinderGeometry(0.08, 0.07, 0.85, 8), -0.42, 1.4, 0); la.rotation.z = -0.15;
  const ra = add(new THREE.CylinderGeometry(0.08, 0.07, 0.85, 8), 0.42, 1.4, 0); ra.rotation.z = 0.15;
  add(new THREE.CylinderGeometry(0.07, 0.08, 0.15, 8), 0, 2.0, 0);
  return g;
}

export default {
  async init() {
    scene.fog = new THREE.FogExp2(0x000000, 0.028);
    const r = rng(33);
    floorGrid = new THREE.GridHelper(160, 120, 0x39ff14, 0x1a6a0c);
    floorGrid.position.y = -4; floorGrid.material.transparent = true; floorGrid.material.opacity = 0.35; scene.add(floorGrid);
    // узлы
    const names = MESSAGES.map((m) => m);
    for (let i = 0; i < N; i++) {
      const named = i < names.length;
      const seed = named ? names[i].seed : 300 + i * 7;
      const red = !named && r() < 0.12;
      const mat = holoMaterial(maskTex(seed, red ? C.red : C.green), red ? [1, 0.1, 0.25] : [0.35, 1, 0.25]);
      const s = named ? 1.2 : 0.55 + r() * 0.45;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
      // распределение: оболочка сферы, приплюснутая
      const u = r() * 2 - 1, a = r() * Math.PI * 2, rad = named ? 4.2 + r() * 1.5 : 5 + r() * 8;
      const base = new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(a) * rad, u * rad * 0.45, Math.sqrt(1 - u * u) * Math.sin(a) * rad);
      m.userData = { base, mat, seed, named, phase: r() * 10, chaosDir: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize() };
      if (named) {
        const { ctx: c, tex } = canvasTex(512, 80); c.font = '42px MonoB'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(names[i].name, 256, 56);
        const lm = holoMaterial(tex, [0.6, 1, 0.5]);
        const l = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.25), lm); l.position.y = -0.85; m.add(l); m.userData.lm = lm;
      }
      nodes.push(m); scene.add(m);
    }
    // связи: ближайшие соседи + к центру
    for (let i = 0; i < N; i++) {
      const d = nodes.map((n, j) => [n.userData.base.distanceTo(nodes[i].userData.base), j]).sort((a, b) => a[0] - b[0]);
      for (let k = 1; k <= 2; k++) linePairs.push([i, d[k][1]]);
      if (nodes[i].userData.named || r() < 0.25) linePairs.push([i, -1]);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePairs.length * 6), 3));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(linePairs.length * 6), 3));
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false; scene.add(lines);
    // импульсы данных вдоль связей
    const pn = linePairs.length;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pn * 3), 3));
    const ps = new Float32Array(pn).fill(1.5), pc = new Float32Array(pn * 3); for (let i = 0; i < pn; i++) pc.set([0.8, 1, 0.7], i * 3);
    pg.setAttribute('aSize', new THREE.BufferAttribute(ps, 1)); pg.setAttribute('aColor', new THREE.BufferAttribute(pc, 3));
    pulses = new THREE.Points(pg, pointsMaterial({ size: 0.12 })); pulses.frustumCulled = false; scene.add(pulses);
    // логотип
    logo = new THREE.Group(); scene.add(logo);
    logoMat = holoMaterial(wordTex('SWAG_ZOV_NEFOR.exe', 'Unb', 150, '#ffffff', 2048, 300), [0.5, 1, 0.4], { gain: '1.3' });
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.94), logoMat); logo.add(lp);
    ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.012, 6, 120), new THREE.MeshBasicMaterial({ color: 0x39ff14 })); logo.add(ring1);
    ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.008, 6, 120), new THREE.MeshBasicMaterial({ color: 0xff0033 })); logo.add(ring2);
    ico = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.7, 1)), new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending }));
    logo.add(ico);
    // фигуры на полу
    for (let i = 0; i < 34; i++) {
      const f = makeFigure();
      const a = (i / 34) * Math.PI * 2 + r() * 0.1, rad = 11 + r() * 6;
      f.position.set(Math.cos(a) * rad, -4, Math.sin(a) * rad); f.rotation.y = -a - Math.PI / 2; f.scale.setScalar(1.1 + r() * 0.3);
      const hm = holoMaterial(maskTex(400 + i * 11, r() < 0.2 ? C.red : C.green), [0.4, 1, 0.3]);
      const head = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), hm); head.position.y = 2.45; f.add(head);
      f.userData = { head, hm, a, rad }; figures.push(f); scene.add(f);
    }
    // мембрана экрана, через которую камера влетает
    const mt = canvasTex(512, 512); const c = mt.ctx;
    c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512); c.strokeStyle = '#39ff14'; c.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.moveTo(0, i); c.lineTo(512, i); c.stroke(); }
    mt.tex.wrapS = mt.tex.wrapT = THREE.RepeatWrapping; mt.tex.repeat.set(8, 8);
    membraneMat = new THREE.MeshBasicMaterial({ map: mt.tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    membrane = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), membraneMat); membrane.position.z = 26; scene.add(membrane);
    // звёздная пыль
    const sn = 2500, sp = new Float32Array(sn * 3), ss = new Float32Array(sn), sc = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) { sp.set([(r() - 0.5) * 120, (r() - 0.5) * 60, (r() - 0.5) * 120], i * 3); ss[i] = 0.3 + r() * 1.2; const red = r() < 0.05; sc.set(red ? [1, 0, 0.2] : [0.4, 1, 0.3], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(ss, 1)); sg.setAttribute('aColor', new THREE.BufferAttribute(sc, 3));
    scene.add(new THREE.Points(sg, pointsMaterial({ size: 0.12, opacity: 0.7 })));
  },

  update(t) {
    const chaos = smooth(T.chaos, T.chaos + 1.2, t);
    const intro = smooth(T.void, T.void + 2.5, t);
    // узлы
    nodes.forEach((m, i) => {
      const { base, mat, lm, phase, chaosDir } = m.userData;
      const appear = clamp((t - (T.void + 0.6 + (i % 20) * 0.08)) / 0.6);
      const p = base.clone().multiplyScalar(0.6 + 0.4 * easeOutExpo(appear));
      p.y += Math.sin(t * 0.8 + phase) * 0.25;
      if (chaos > 0) {
        const j = stepNoise(t, 3 + (i % 4), i);
        p.addScaledVector(chaosDir, chaos * (Math.sin(t * 2.3 + phase) * 2.2 + (j - 0.5) * 3));
        p.x += noise1(t * 4 + i) * chaos * 0.8;
      }
      m.position.copy(p);
      m.quaternion.copy(cam.quaternion);
      m.visible = appear > 0;
      const a = clamp(appear * 2) * (1 - 0.6 * chaos * (stepNoise(t, 12, i) > 0.8 ? 1 : 0));
      mat.uniforms.opacity.value = a; mat.uniforms.time.value = t; mat.uniforms.glitch.value = 0.1 + chaos;
      if (lm) { lm.uniforms.opacity.value = a; lm.uniforms.time.value = t; }
    });
    // связи
    const pos = lines.geometry.attributes.position.array, col = lines.geometry.attributes.color.array;
    const pp = pulses.geometry.attributes.position.array;
    linePairs.forEach(([a, b], k) => {
      let bb = b;
      // в хаосе связи перепутываются
      if (chaos > 0 && hash(k * 3.3 + Math.floor(t * 4)) < chaos * 0.5) bb = Math.floor(hash(k + Math.floor(t * 4) * 7) * N);
      const A = nodes[a].position, B = bb < 0 ? logo.position : nodes[bb].position;
      pos.set([A.x, A.y, A.z, B.x, B.y, B.z], k * 6);
      const vis = clamp((t - (T.void + 1.2 + (k % 30) * 0.05)) / 0.5);
      const red = chaos > 0 && hash(k * 1.7 + Math.floor(t * 6)) < chaos * 0.35;
      const g = vis * (bb < 0 ? 0.55 : 0.4);
      const cc = red ? [g * 1.8, 0, g * 0.4] : [g * 0.35, g, g * 0.15];
      col.set([...cc, ...cc], k * 6);
      const u = (t * (0.35 + hash(k) * 0.5) + hash(k * 9)) % 1;
      pp.set([A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u, A.z + (B.z - A.z) * u], k * 3);
    });
    lines.geometry.attributes.position.needsUpdate = true; lines.geometry.attributes.color.needsUpdate = true;
    pulses.geometry.attributes.position.needsUpdate = true;
    pulses.material.uniforms.opacity.value = smooth(T.void + 2, T.void + 3, t);
    // логотип
    logo.quaternion.copy(cam.quaternion);
    ring1.rotation.set(t * 0.4, t * 0.7, 0); ring2.rotation.set(-t * 0.3, 0.6, t * 0.5); ico.rotation.set(t * 0.2, t * 0.31, 0);
    logoMat.uniforms.time.value = t; logoMat.uniforms.opacity.value = smooth(T.void + 1.0, T.void + 2.0, t) * (0.85 + 0.15 * Math.sin(t * 30));
    logoMat.uniforms.glitch.value = 0.2 + chaos * 1.5;
    logo.scale.setScalar(0.8 + 0.2 * intro + pulse(t, T.statsIn, 4) * 0.08);
    // фигуры
    figMat.uniforms.red.value = chaos * (stepNoise(t, 8, 3) > 0.5 ? 0.8 : 0.3);
    figures.forEach((f, i) => {
      const { head, hm } = f.userData;
      head.quaternion.copy(cam.quaternion); f.updateMatrixWorld();
      head.quaternion.premultiply(f.quaternion.clone().invert());
      hm.uniforms.time.value = t; hm.uniforms.opacity.value = smooth(T.void + 1.5 + (i % 10) * 0.1, T.void + 2.5 + (i % 10) * 0.1, t); hm.uniforms.glitch.value = 0.3 + chaos;
      f.position.y = -4 + (chaos > 0 ? Math.abs(Math.sin(t * 9 + i)) * 0.25 * chaos : 0);
      f.rotation.z = chaos * Math.sin(t * 7 + i) * 0.08;
    });
    floorGrid.material.opacity = 0.3 * smooth(T.void, T.void + 2, t) + chaos * 0.15 * stepNoise(t, 20, 1);
    membraneMat.opacity = 1 - smooth(T.void + 0.5, T.void + 1.2, t);
    const keys = [
      { t: T.void, p: [0, 0.6, 30], l: [0, 0.3, 0], roll: 0.15, fov: 70 },
      { t: 37.6, p: [-2.5, 1.6, 17], l: [0, 0.2, 0], roll: 0.02, fov: 55 },
      { t: 41.9, p: [-11.5, 2.8, 8.5], l: [0, 0.2, 0], roll: -0.04, fov: 50 },
      { t: 45.6, p: [-12.5, -1.0, -6.5], l: [0, 0.0, 0], roll: 0.06, fov: 52 },
      { t: 48.2, p: [-3.5, 1.2, -13.5], l: [0, 0.2, 0], roll: -0.05, fov: 55 },
      { t: 49.3, p: [-1.4, 0.5, -6.5], l: [0, 0, 0], roll: 0.1, fov: 62 },
      { t: 50.0, p: [0, 0.05, -0.4], l: [0, 0, 1], roll: 0.4, fov: 85 },
    ];
    const sh = chaos * 0.25 + pulse(t, T.chaos, 3) * 0.3;
    applyCam(cam, keys, t, { dx: shake(t, 21) * sh, dy: shake(t, 22) * sh, roll: shake(t, 23) * sh * 0.1 });
    return { scene, camera: cam };
  },

  fx(t) {
    const chaos = smooth(T.chaos, T.chaos + 1.2, t);
    const enter = 1 - smooth(T.void, T.void + 0.8, t);
    const dive = smooth(49.0, 50.0, t);
    let slam = 0; for (const d of DIAG_T) slam = Math.max(slam, pulse(t, d, 6));
    return {
      flash: enter * 0.7 + smooth(49.75, 50.0, t) * 0.9,
      ca: 0.25 + chaos * 0.8 + slam * 1.5 + enter * 2, glitch: chaos * 0.3 * (stepNoise(t, 8, 31) > 0.55 ? 1 : 0.15) + slam * 0.4 + enter * 0.4,
      rgbSplit: chaos * 0.5 + slam * 0.6, tear: chaos * 0.3, noiseAmt: 0.2 + chaos * 0.5,
      radial: enter * 0.8 + dive * 1.0 + slam * 0.3, samples: enter > 0.2 || dive > 0.15 ? 4 : 1, shutter: 0.7,
      dof: 0.7, focus: 14, focusRange: 10, bloom: 1.2, bloomThreshold: 0.35, vig: 0.8,
    };
  },

  hud(h, t, camera) {
    // статистика с выноской к логотипу
    if (t >= T.statsIn && t < T.diag) {
      const a = win(t, T.statsIn, T.diag, 0.2, 0.25);
      const k = t - T.statsIn;
      const users = Math.round(62 * easeOutCubic(clamp(k / 0.9)));
      const online = Math.round(21 * easeOutCubic(clamp((k - 0.4) / 0.9)));
      const x = 110, y = 300;
      h.rect(x - 30, y - 80, 640, 400, '#000', 0.45 * a);
      h.corners(x - 30, y - 80, 640, 400, 30, C.green, 3, a);
      h.text('// NETWORK SCAN', x, y - 30, { font: 'MonoB', size: 22, color: C.green, alpha: a, track: 4 });
      const row = (lab, val, yy, col, d) => {
        const aa = a * clamp((k - d) / 0.2);
        h.text(lab, x, yy, { font: 'Mono', size: 26, color: '#9aa69a', alpha: aa, track: 3 });
        h.text(val, x + 560, yy + 4, { font: 'Tek', size: 64, align: 'right', color: col, alpha: aa, glow: 18, track: 2 });
      };
      row('TOTAL USERS:', String(users), y + 60, C.white, 0);
      row('ONLINE:', String(online), y + 160, C.green, 0.4);
      const crit = k > 1.3;
      row('CHAOS LEVEL:', crit ? 'CRITICAL' : scramble('CRITICAL', 1 - clamp((k - 0.8) / 0.5), Math.floor(t * 20)), y + 260, C.red, 0.8);
      if (crit && Math.floor(t * 4) % 2 === 0) h.frame(x - 14, y + 200, 600, 80, C.red, 3, a);
      // выноска к проекции центра сети
      const v = new THREE.Vector3(0, 0, 0).project(camera);
      if (v.z < 1) {
        const sx = (v.x * 0.5 + 0.5) * 1920, sy = (-v.y * 0.5 + 0.5) * 1080;
        const c = h.ctx; c.save(); c.globalAlpha = a * 0.8; c.strokeStyle = C.green; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 610, y - 80); c.lineTo(x + 700, y - 80); c.lineTo(sx, sy); c.stroke();
        c.beginPath(); c.arc(sx, sy, 10 + 4 * Math.sin(t * 8), 0, Math.PI * 2); c.stroke(); c.restore();
      }
    }
    // «62 ЧЕЛОВЕКА. 0 ФИЛЬТРОВ. 1 ОБЩИЙ ДИАГНОЗ.»
    if (t >= DIAG_T[0] && t < 49.6) {
      const out = 1 - smooth(49.1, 49.6, t);
      DIAG.forEach(([num, word], i) => {
        const k = t - DIAG_T[i];
        if (k < 0) return;
        const e = easeOutExpo(clamp(k / 0.35));
        const y = 390 + i * 150;
        const sc = 1 + (1 - e) * 0.6;
        const numCol = i === 2 ? C.red : C.green;
        const w1 = h.measure(num, { font: 'Dela', size: 120 }), w2 = h.measure(word, { font: 'Dela', size: 96 });
        const x0 = 960 - (w1 + w2) / 2;
        const jit = k < 0.25 ? (hash(Math.floor(t * 60)) - 0.5) * 20 : 0;
        h.text(num, x0 + jit, y, { font: 'Dela', size: 120, color: numCol, alpha: e * out, scale: sc, glow: 30, split: (1 - e) * 14 + (1 - out) * 10 });
        h.text(word, x0 + w1 + jit, y, { font: 'Dela', size: 96, color: '#fff', alpha: e * out, scale: sc, glow: 10, glowColor: 'rgba(255,255,255,0.4)', split: (1 - e) * 10 + (1 - out) * 10, slices: { amt: (1 - out) * 80 + (k < 0.2 ? 30 : 0), seed: Math.floor(t * 20) + i } });
      });
    }
  },
};
