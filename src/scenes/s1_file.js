import * as THREE from 'three';
import { T } from '../timeline.js';
import { C } from '../hud.js';
import { clamp, inv, smooth, pulse, win, easeOutExpo, easeInCubic, easeOutBack, rng, hash, shake, scramble, stepNoise, noise1 } from '../util.js';
import { applyCam, canvasTex, screenMaterial, pointsMaterial, textPoints } from '../util3d.js';

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 200);
let term, termMesh, termMat, errs = [], e404, titleGroup, titlePts, titlePlane, titleMat, dust;

const ROWS = 26, LH = 38, X0 = 60, Y0 = 70, FS = 30;
const LINES = [
  ['[    0.000000] BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable', 'g'],
  ['[    0.004211] kernel: Command line: root=/dev/void ro quiet nefor=1', 'g'],
  ['[    0.011873] loading module nefor_core.ko ............ OK', 'g'],
  ['[    0.019001] loading module zov_bridge.ko ............ OK', 'g'],
  ['[    0.020453] mount /dev/chat0 /mnt/underground --force', 'w'],
  ['0x7FFE0040  4E 45 46 4F 52 00 5A 4F 56 00 53 57 41 47  NEFOR.ZOV.SWAG', 'd'],
  ['0x7FFE0050  4D 45 4D 45 4E 54 4F 5F 4D 4F 52 49 00 00  MEMENTO_MORI..', 'd'],
  ['> resolve tg://memento_mori/chat ........ 62 peers', 'g'],
  ['filter.dll .............................. [ FAIL ]', 'r'],
  ['moderation.service ...................... [ NOT FOUND ]', 'r'],
  ['for (const user of chat) { censor(user) }   // TODO: удалить нахуй', 'd'],
  ['censor(): function is not defined', 'r'],
  ['[    0.031337] spawning 62 threads :: nefor[0..61]', 'g'],
  ['[    0.031338] thread 13: «а чё, так можно было?»', 'w'],
  ['[    0.031902] memory leak in /usr/lib/common_sense.so', 'r'],
  ['0x7FFE00A0  44 49 47 49 54 41 4C 20 41 4E 41 52 43 48 59  DIGITAL ANARCHY', 'd'],
  ['[    0.040000] firewall: disabled by user «KAPUSTKA»', 'g'],
  ['[    0.040116] safe_mode=0  shame=0  filters=0', 'g'],
  ['WARNING: chaos level exceeds 9000', 'r'],
  ['[    0.052411] heap: 0xDEADBEEF ... 0xFEEDFACE', 'd'],
  ['[    0.061009] allocating group chat ................. OK', 'g'],
  ['[    0.061010] admins online: 0', 'g'],
  ['[    0.070777] rules.txt: No such file or directory', 'r'],
  ['[    0.080000] ignoring all warnings', 'g'],
  ['[    0.090123] ready.', 'w'],
];
const EXEC = '> EXECUTING SWAG_ZOV_NEFOR.exe';
const TOTAL = LINES.reduce((s, l) => s + l[0].length, 0);
const COL = { g: C.green, r: C.red, w: '#e8ffe0', d: '#2f9a1c' };
const TYPE_END = 8.0;

function charsAt(t) {
  if (t < T.typeStart) return 0;
  const u = clamp((t - T.typeStart) / (TYPE_END - T.typeStart)), k = 3.4;
  return Math.floor(TOTAL * (Math.exp(k * u) - 1) / (Math.exp(k) - 1));
}
const execChars = (t) => clamp(Math.floor((t - 8.05) * 34), 0, EXEC.length);

function drawTerm(t) {
  const { ctx: c, canvas } = term;
  c.fillStyle = '#020402'; c.fillRect(0, 0, canvas.width, canvas.height);
  // фосфорное свечение
  const g = c.createRadialGradient(960, 540, 100, 960, 540, 1100); g.addColorStop(0, 'rgba(57,255,20,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, canvas.width, canvas.height);
  c.font = `${FS}px Mono`; c.textBaseline = 'alphabetic';
  let left = charsAt(t);
  const shown = [];
  for (const [s, k] of LINES) { if (left <= 0) break; shown.push([s.slice(0, left), k]); left -= s.length; }
  const ex = execChars(t);
  if (t >= 8.05) shown.push([EXEC.slice(0, ex), 'x']);
  const frozen = t >= T.freeze;
  // прогресс-точки после строки запуска
  if (ex >= EXEC.length && shown.length) {
    const dots = Math.min(12, Math.floor((Math.min(t, T.freeze) - 8.95) * 9));
    shown[shown.length - 1][0] = EXEC + ' ' + '.'.repeat(Math.max(0, dots));
  }
  const vis = shown.slice(-ROWS);
  vis.forEach(([s, k], i) => {
    const y = Y0 + i * LH;
    if (k === 'x') {
      c.fillStyle = 'rgba(57,255,20,0.16)'; c.fillRect(X0 - 12, y - FS, 1400, LH);
      c.shadowColor = C.green; c.shadowBlur = 18; c.fillStyle = '#eaffdf';
    } else { c.shadowBlur = 0; c.fillStyle = COL[k]; }
    c.fillText(s, X0, y);
  });
  c.shadowBlur = 0;
  // курсор
  const last = vis.length ? vis[vis.length - 1] : ['', 'g'];
  const blink = frozen ? 1 : (Math.floor(t * 2.2) % 2 === 0 ? 1 : 0);
  if (t >= T.cursor && blink) {
    const cy = Y0 + Math.max(0, vis.length - 1) * LH;
    const cx = X0 + c.measureText(last[0]).width + 4;
    c.fillStyle = C.green; c.shadowColor = C.green; c.shadowBlur = 20; c.fillRect(cx, cy - FS + 4, 16, FS);
    c.shadowBlur = 0;
  }
  // правый верхний индикатор
  if (t > T.errors) {
    const on = Math.floor(t * 4) % 2 === 0;
    c.fillStyle = on ? C.red : '#400010'; c.fillRect(1760, 40, 22, 22);
    c.fillStyle = C.red; c.font = `22px MonoB`; c.fillText('ERR', 1792, 60);
  }
  // заморозка: дублирование строк (зависание буфера)
  if (frozen) {
    const k = clamp((t - T.freeze) / 1.6);
    for (let i = 0; i < 6; i++) {
      const y = Math.floor(hash(i + Math.floor(t * 6)) * 1000);
      c.drawImage(canvas, 0, y, 1920, 30 + 40 * k, (hash(i * 3.1) - 0.5) * 80 * k, y + 8, 1920, 30 + 40 * k);
    }
  }
  term.tex.needsUpdate = true;
}

function errTexture(title, body, code, red) {
  const { canvas, ctx: c, tex } = canvasTex(640, 300);
  c.fillStyle = '#0c0c0c'; c.fillRect(0, 0, 640, 300);
  c.strokeStyle = red ? C.red : '#444'; c.lineWidth = 4; c.strokeRect(2, 2, 636, 296);
  c.fillStyle = red ? C.red : '#2a2a2a'; c.fillRect(4, 4, 632, 46);
  c.fillStyle = '#fff'; c.font = '24px MonoB'; c.fillText(title, 18, 36);
  c.fillText('✕', 600, 36);
  c.fillStyle = C.red; c.beginPath(); c.arc(70, 140, 34, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#000'; c.font = '48px MonoB'; c.textAlign = 'center'; c.fillText('!', 70, 157); c.textAlign = 'left';
  c.fillStyle = '#eee'; c.font = '26px Mono';
  body.split('\n').forEach((l, i) => c.fillText(l, 130, 120 + i * 36));
  c.fillStyle = '#777'; c.font = '20px Mono'; c.fillText(code, 130, 210);
  c.strokeStyle = '#666'; c.lineWidth = 2; c.strokeRect(470, 236, 140, 44);
  c.fillStyle = '#ccc'; c.font = '22px MonoB'; c.fillText('OK', 522, 266);
  return tex;
}

function e404Texture() {
  const { ctx: c, tex } = canvasTex(1280, 640);
  c.fillStyle = '#080000'; c.fillRect(0, 0, 1280, 640);
  c.strokeStyle = C.red; c.lineWidth = 8; c.strokeRect(4, 4, 1272, 632);
  c.fillStyle = C.red; c.fillRect(8, 8, 1264, 80);
  c.fillStyle = '#000'; c.font = '40px MonoB'; c.fillText('SWAG_ZOV_NEFOR.exe — СИСТЕМНАЯ ОШИБКА', 32, 64);
  c.fillStyle = C.red; c.font = '150px Tek'; c.fillText('ERROR 404', 60, 290);
  c.fillStyle = '#fff'; c.font = '64px MonoB'; c.fillText('RULES NOT FOUND', 64, 390);
  c.fillStyle = '#aaa'; c.font = '30px Mono';
  c.fillText('Файл rules.txt не найден. Модерация не отвечает.', 64, 460);
  c.fillText('Продолжить без правил?', 64, 502);
  c.lineWidth = 4; c.strokeStyle = '#fff'; c.strokeRect(780, 548, 200, 64); c.strokeRect(1010, 548, 230, 64);
  c.fillStyle = '#fff'; c.font = '30px MonoB'; c.fillText('[ ДА ]', 818, 592); c.fillText('[ ДА!!! ]', 1040, 592);
  return tex;
}

const ERRS = [
  ['chat.exe', 'Модерация не отвечает.\nЗавершить процесс?', '0xC0000005', true, [5.2, 2.6, 1.6], 6.4, -0.2],
  ['filter.dll', 'Фильтр не найден.\nПродолжить без фильтров?', 'E_FILTER_MISSING', false, [-3.6, 3.2, 1.0], 6.75, 0.15],
  ['WARNING', 'Обнаружен срач.\nМасштаб: неизвестен', 'CHAOS_OVERFLOW', true, [3.8, -2.6, 2.2], 7.05, 0.1],
  ['common_sense.so', 'Библиотека повреждена.', '0x0000DEAD', false, [-5.6, -0.4, 2.6], 7.3, -0.12],
  ['SYSTEM', 'Слишком много свободы.\nСистема нестабильна.', 'FREEDOM_LEVEL_MAX', true, [0.6, 1.4, 3.1], 7.52, 0.06],
  ['admin.exe', 'Администратор не найден.', 'NULL_ADMIN', false, [6.0, 0.2, 0.9], 7.72, -0.08],
  ['MEMORY', 'Выход за пределы приличий.', '0xFEEDFACE', true, [-2.0, -2.2, 3.4], 7.9, 0.2],
];

export default {
  async init() {
    term = canvasTex(1920, 1080);
    termMat = screenMaterial(term.tex, { gain: 1.25 });
    const geo = new THREE.PlaneGeometry(16, 9, 64, 36);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, -0.012 * x * x - 0.02 * y * y); }
    termMesh = new THREE.Mesh(geo, termMat);
    scene.add(termMesh);
    for (const [title, body, code, red, p, t0, rot] of ERRS) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.5), screenMaterial(errTexture(title, body, code, red), { gain: 1.1, transparent: true }));
      m.position.set(...p); m.rotation.z = rot * 0.3; m.rotation.y = -p[0] * 0.03;
      m.userData = { t0, p };
      errs.push(m); scene.add(m);
    }
    e404 = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), screenMaterial(e404Texture(), { gain: 1.25, transparent: true }));
    scene.add(e404);
    // заголовок: частицы + чёткий слой
    titleGroup = new THREE.Group(); titleGroup.position.set(0, 40, 0); scene.add(titleGroup);
    const tp = textPoints('SWAG_ZOV_NEFOR.exe', 'Unb', 150, 3, 2400);
    const S = 9.4 / tp.w; // мировая ширина 9.4
    const n = tp.pts.length; const r = rng(7);
    const from = new Float32Array(n * 3), to = new Float32Array(n * 3), del = new Float32Array(n), size = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      to[i * 3] = tp.pts[i][0] * S; to[i * 3 + 1] = tp.pts[i][1] * S; to[i * 3 + 2] = 0;
      from[i * 3] = (r() - 0.5) * 26; from[i * 3 + 1] = (r() - 0.5) * 14; from[i * 3 + 2] = -12 + r() * 19;
      del[i] = r(); size[i] = 0.5 + r() * 1.2;
      const red = r() < 0.08; col[i * 3] = red ? 1 : 0.6; col[i * 3 + 1] = red ? 0 : 1; col[i * 3 + 2] = red ? 0.2 : 0.55;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    pg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    titlePts = new THREE.Points(pg, pointsMaterial({ size: 0.17, color: [1.4, 1.4, 1.4] }));
    titlePts.userData = { from, to, del, n };
    titlePts.frustumCulled = false;
    titleGroup.add(titlePts);
    const tt = canvasTex(2400, 420);
    tt.ctx.font = '150px Unb'; tt.ctx.textAlign = 'center'; tt.ctx.textBaseline = 'middle';
    const tw = tt.ctx.measureText('SWAG_ZOV_NEFOR.exe').width;
    tt.ctx.fillStyle = '#fff'; tt.ctx.fillText('SWAG_ZOV_NEFOR.exe', 1200, 210);
    titleMat = screenMaterial(tt.tex, { gain: 0.95, transparent: true });
    titlePlane = new THREE.Mesh(new THREE.PlaneGeometry(2400 * (9.4 / tw), 420 * (9.4 / tw)), titleMat);
    titleGroup.add(titlePlane);
    // пыль переднего плана
    const dn = 600, dp = new Float32Array(dn * 3), ds = new Float32Array(dn), dc = new Float32Array(dn * 3); const r2 = rng(3);
    for (let i = 0; i < dn; i++) { dp[i * 3] = (r2() - 0.5) * 30; dp[i * 3 + 1] = (r2() - 0.5) * 18; dp[i * 3 + 2] = r2() * 12 - 2; ds[i] = 0.3 + r2(); dc.set([0.5, 1, 0.4], i * 3); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aSize', new THREE.BufferAttribute(ds, 1)); dg.setAttribute('aColor', new THREE.BufferAttribute(dc, 3));
    dust = new THREE.Points(dg, pointsMaterial({ size: 0.05, opacity: 0.35 })); scene.add(dust);
  },

  update(t) {
    const titleOn = t >= T.title - 1.25;
    termMesh.visible = !titleOn;
    drawTerm(t);
    termMat.uniforms.time.value = t;
    termMat.uniforms.flicker.value = t > T.freeze ? 0.25 : 0.05;
    termMat.uniforms.gain.value = 1.25 * smooth(0.3, 1.6, t) * (t > T.err404 ? 0.55 : 1);
    for (const m of errs) {
      const k = t - m.userData.t0;
      m.visible = k > 0 && !titleOn;
      const s = easeOutBack(clamp(k / 0.18), 2.2);
      m.scale.set(s, s * (k < 0.05 ? 0.2 : 1), 1);
      m.position.x = m.userData.p[0] + (t > T.freeze ? 0 : noise1(t * 3 + m.userData.t0) * 0.03);
    }
    // ERROR 404 — перед камерой у строки запуска
    e404.visible = t >= T.err404 && !titleOn;
    if (e404.visible) {
      const k = t - T.err404;
      const s = easeOutBack(clamp(k / 0.22), 2.6);
      e404.position.set(-5.13 + noise1(t * 30) * 0.004 * (t > T.glitchStart ? 4 : 1), -3.8, 0.18);
      e404.scale.set(s, s, 1);
    }
    titleGroup.visible = titleOn;
    if (titleOn) {
      const { from, to, del, n } = titlePts.userData;
      const p = titlePts.geometry.attributes.position.array;
      const tt = t - (T.title - 1.25);
      for (let i = 0; i < n; i++) {
        // каждая частица прилетает в 13.8 (с небольшим разбросом после); затем лёгкое дрожание и вынос части частиц
        const u = clamp(tt / (1.25 + del[i] * 0.05));
        const e = Math.pow(u, 3.2);
        const after = Math.max(0, t - T.title);
        const blow = del[i] > 0.75 ? after * after * 0.6 * (del[i] - 0.75) * 4 : 0;
        const jit = (t > T.title ? 0.006 : 0) * Math.sin(i * 12.9 + t * 40);
        for (let j = 0; j < 3; j++) p[i * 3 + j] = from[i * 3 + j] + (to[i * 3 + j] - from[i * 3 + j]) * e + (j === 2 ? blow * 3 : (j === 0 ? jit : blow * (to[i * 3 + j] > 0 ? 1 : -1) * 0.4));
      }
      titlePts.geometry.attributes.position.needsUpdate = true;
      titlePts.material.uniforms.opacity.value = 1 - 0.75 * smooth(T.title + 0.1, T.title + 1.4, t);
      titleMat.uniforms.opacity.value = smooth(T.title - 0.02, T.title + 0.06, t) * (1 - 0.5 * smooth(17.0, 17.5, t));
      titleMat.uniforms.gain.value = 0.95 + 1.5 * pulse(t, T.title, 4);
      titleMat.uniforms.time.value = t;
      // ключи камеры для заголовка (своё пространство над терминалом, y=40)
      const k = t - T.title;
      const z = 9.5 - 1.6 * easeOutExpo(clamp((t - (T.title - 1.25)) / 2.0)) - 0.35 * Math.max(0, k);
      const sh = pulse(t, T.title, 3) * 0.12;
      cam.position.set(0.25 * Math.sin(t * 0.4) + shake(t, 1) * sh, 40 - 0.25 + shake(t, 2) * sh, z);
      cam.up.set(0, 1, 0); cam.lookAt(0, 39.85, 0); cam.rotateZ(-0.03 + 0.03 * smooth(T.title, 17.5, t));
      cam.fov = 50; cam.updateProjectionMatrix();
    } else {
      const keys = [
        { t: 0, p: [-6.4, 3.0, 2.6], l: [-7.1, 3.75, 0], roll: 0.04, fov: 46 },
        { t: T.cursor, p: [-6.3, 3.1, 2.7], l: [-7.0, 3.75, 0], roll: 0.04, fov: 46 },
        { t: 4.4, p: [-3.2, 1.6, 6.4], l: [-2.6, 1.6, 0], roll: 0.06, fov: 48 },
        { t: 6.6, p: [1.0, 1.4, 9.4], l: [0, 1.0, 0], roll: -0.035, fov: 50 },
        { t: 8.1, p: [-0.6, -0.9, 9.0], l: [-2.4, -2.2, -0.3], roll: -0.02, fov: 48 },
        { t: 9.3, p: [-4.2, -3.3, 2.6], l: [-5.15, -3.85, -0.55], roll: 0.03, fov: 42 },
        { t: T.freeze, p: [-5.0, -3.72, 1.15], l: [-5.15, -3.86, -0.55], roll: 0.05, fov: 40 },
        { t: T.glitchStart, p: [-5.08, -3.76, 1.02], l: [-5.15, -3.86, -0.55], roll: 0.06, fov: 40 },
        { t: T.title, p: [-5.12, -3.8, 0.95], l: [-5.15, -3.86, -0.55], roll: 0.07, fov: 40 },
      ];
      const sh = (t > T.err404 ? 0.01 + 0.04 * smooth(T.glitchStart, T.title, t) : 0) + pulse(t, T.err404, 5) * 0.05;
      applyCam(cam, keys, t, { dx: shake(t, 4) * sh, dy: shake(t, 5) * sh, roll: shake(t, 6) * sh * 0.5 });
    }
    dust.position.y = t * 0.05;
    return { scene, camera: cam };
  },

  fx(t) {
    let errPulse = 0;
    for (const e of ERRS) errPulse = Math.max(errPulse, pulse(t, e[5], 9));
    const zoom = win(t, 8.4, 10.2, 0.4, 0.15);
    const g = smooth(T.glitchStart, T.title, t) * (1 - smooth(T.title, T.title + 0.35, t));
    const hit = pulse(t, T.title, 2.5);
    const late = t > T.title + 1 ? (stepNoise(t, 6, 5) > 0.88 ? 0.35 : 0) : 0;
    return {
      ca: 0.25 + errPulse * 0.8 + pulse(t, T.err404, 4) * 2 + g * 1.5 + hit * 3,
      glitch: errPulse * 0.25 + pulse(t, T.err404, 5) * 0.7 + g * g * 0.9 * (stepNoise(t, 14, 2) > 0.3 ? 1 : 0.2) + hit * 0.5 + late,
      rgbSplit: g * 0.8 + hit,
      tear: g * 0.8 + (t > T.freeze && t < T.err404 ? 0.4 : 0),
      staticAmt: g * 0.35 * stepNoise(t, 18, 3) + smooth(17.2, 17.5, t) * 0.8 + pulse(t, T.err404, 10) * 0.3,
      pixelate: g > 0.5 && stepNoise(t, 10, 8) > 0.75 ? 0.25 : 0,
      noiseAmt: 0.25 + g * 0.6, scan: 0.35, curve: t < T.title - 1.25 ? 0.12 : 0.02,
      radial: zoom * 0.55 + hit * 0.8, radialCenter: [0.5, 0.5],
      samples: zoom > 0.05 || (t > T.title - 1.25 && t < T.title + 0.1) ? 5 : 1, shutter: 0.6,
      flash: pulse(t, T.title, 7) * 0.55,
      redFlash: errPulse * 0.15 + pulse(t, T.err404, 6) * 0.35,
      bloom: (t > T.title ? 0.55 : 1.0) + hit * 1.2, bloomThreshold: t > T.title ? 0.6 : 0.35,
      fade: 1 - smooth(0.2, 1.4, t),
      dof: t > T.title - 1.25 ? 0 : 0.5, focus: t > T.title - 1.25 ? 8.5 : (t > 9 ? 1.1 : 7), focusRange: t > 9 && t < T.title ? 0.8 : 6,
      vig: 0.75,
    };
  },

  hud(h, t) {
    if (t >= T.subtitle) {
      const k = t - T.subtitle;
      const sub = 'МЕСТО, ГДЕ ИНТЕРНЕТ ПОТЕРЯЛ КОНТРОЛЬ';
      const dec = clamp(1 - k / 0.9);
      const a = clamp(k / 0.15) * (1 - smooth(16.9, 17.4, t));
      h.text(scramble(sub, dec, Math.floor(t * 20)), 960, 700, { font: 'UnbR', size: 36, align: 'center', track: 7, color: '#fff', alpha: a, glow: 14, glowColor: 'rgba(57,255,20,0.6)', split: dec * 6 });
    }
    if (t >= 15.5) {
      const a = clamp((t - 15.5) / 0.3) * (1 - smooth(16.9, 17.4, t));
      const tw = h.measure('// ЧАТ КАНАЛА MEMENTO MORI', { font: 'Mono', size: 24, track: 6 });
      h.avatar(t, 960 - tw / 2 - 18, 790, 30, a, 0.2 + pulse(t, 15.5, 6) * 1.5);
      h.text('// ЧАТ КАНАЛА MEMENTO MORI', 960 + 26, 798, { font: 'Mono', size: 24, align: 'center', track: 6, color: C.green, alpha: a * 0.9 });
    }
    if (t >= T.errors && t < T.title - 1.25) {
      // красные индикаторы по краям
      const on = Math.floor(t * 5) % 2 === 0;
      h.tag('SYS.INTEGRITY: 12%', 60, 1030, C.red, t, on ? 1 : 0.6, 20);
      h.text(`PID ${(31337 + Math.floor(t * 97) % 999)}`, 1860, 1030, { font: 'Mono', size: 20, align: 'right', color: C.red, alpha: 0.8 });
    }
  },
};
