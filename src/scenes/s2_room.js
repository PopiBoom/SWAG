import * as THREE from 'three';
import { T, MESSAGES } from '../timeline.js';
import { C, drawMask } from '../hud.js';
import { clamp, smooth, pulse, win, easeOutBack, easeOutCubic, rng, hash, shake, scramble, stepNoise, noise1 } from '../util.js';
import { applyCam, canvasTex, screenMaterial, holoMaterial, beamMaterial, pointsMaterial } from '../util3d.js';
import { ledTex, maskTex, noiseTex } from '../textures.js';

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.03, 80);
let chat, chatMat, ledMats = [], roomLight, screenLight, lampLight, beam, beamMat, holos = [], holoLines, staticMats = [], dust, redLight;

const SCR = { x: 0, y: 1.5, z: -6.12, w: 1.6, h: 1.0 };
const JOIN = ['KAPUSTKA', 'Даша Вкид', 't9ctox7c', 'cold#inte2(t#o)'];
const MSG_T = [22.6, 23.25, 23.9, 24.55, 25.2, 25.85, 26.5];
const membersAt = (t) => Math.round(3 + 59 * smooth(21.6, 26.6, t));

function drawChat(t) {
  const { ctx: c } = chat; const W = 1280, H = 800;
  const err = clamp((t - T.pcErrors) / 1.5);
  c.fillStyle = '#0b0d0b'; c.fillRect(0, 0, W, H);
  // боковая панель
  c.fillStyle = '#111411'; c.fillRect(0, 0, 340, H);
  c.fillStyle = '#1a1e1a'; c.beginPath(); c.roundRect(16, 16, 308, 44, 22); c.fill();
  c.fillStyle = '#5b665b'; c.font = '20px Mono'; c.fillText('Поиск', 60, 45);
  const chats = [
    ['SWAG_ZOV_NEFOR.exe', 'KAPUSTKA: Ненавижу вас всех', 101, true],
    ['Memento Mori', 'канал · новый пост', 202, false],
    ['Избранное', 'rules.txt (удалён)', 303, false],
    ['Мама', 'Ты покушал?', 404, false],
    ['Работа', 'Созвон в 10:00', 505, false],
    ['unknown_user', 'кто ты', 606, false],
  ];
  chats.forEach(([n, last, seed, sel], i) => {
    const y = 80 + i * 86;
    if (sel) { c.fillStyle = 'rgba(57,255,20,0.14)'; c.fillRect(0, y, 340, 86); c.fillStyle = C.green; c.fillRect(0, y, 4, 86); }
    drawMask(c, 48, y + 43, 56, seed, { color: sel ? C.green : '#2c6b1c' });
    c.fillStyle = sel ? '#fff' : '#bbb'; c.font = '21px MonoB'; c.fillText(n, 88, y + 36);
    c.fillStyle = '#6c776c'; c.font = '18px Mono'; c.fillText(last.slice(0, 24), 88, y + 64);
    const unread = sel ? Math.max(0, Math.floor(smooth(22, 31, t) * 999)) : (i === 1 ? 3 : 0);
    if (unread) {
      const s = String(unread); c.font = '16px MonoB'; const w = c.measureText(s).width + 18;
      c.fillStyle = sel ? C.green : '#3a423a'; c.beginPath(); c.roundRect(326 - w, y + 48, w, 26, 13); c.fill();
      c.fillStyle = '#000'; c.fillText(s, 335 - w, y + 67);
    }
  });
  // шапка чата
  c.fillStyle = '#131613'; c.fillRect(340, 0, W - 340, 76);
  drawMask(c, 384, 38, 52, 101, { color: C.green });
  c.fillStyle = '#fff'; c.font = '24px MonoB'; c.fillText('SWAG_ZOV_NEFOR.exe', 424, 34);
  const m = membersAt(t), on = Math.min(21, Math.round(m / 3));
  c.fillStyle = '#7d8a7d'; c.font = '18px Mono'; c.fillText(`${m} участник${m % 10 === 1 && m !== 11 ? '' : 'а'}, ${on} в сети`, 424, 60);
  // закреп
  c.fillStyle = '#0f120f'; c.fillRect(340, 76, W - 340, 44);
  c.fillStyle = C.green; c.fillRect(352, 84, 3, 28);
  c.fillStyle = C.green; c.font = '17px MonoB'; c.fillText('Закреплённое сообщение', 366, 96);
  c.fillStyle = '#cfd8cf'; c.font = '17px Mono'; c.fillText('Чат канала Memento Mori. Правил нет.', 366, 114);
  // сообщения снизу вверх
  const items = [];
  JOIN.forEach((n, i) => { const tt = 21.7 + i * 0.22; if (t >= tt) items.push({ sys: `${n} присоединился(-ась) к группе`, tt }); });
  MESSAGES.forEach((mm, i) => { if (t >= MSG_T[i]) items.push({ ...mm, tt: MSG_T[i] }); });
  if (err > 0) {
    // повторы сообщений — чат «заедает»
    for (let k = 0; k < Math.floor(err * 8); k++) { const mm = MESSAGES[k % MESSAGES.length]; items.push({ ...mm, tt: T.pcErrors + k * 0.15, dup: true }); }
  }
  let y = H - 84;
  c.save(); c.beginPath(); c.rect(340, 120, W - 340, H - 196); c.clip();
  for (let i = items.length - 1; i >= 0 && y > 120; i--) {
    const it = items[i]; const k = clamp((t - it.tt) / 0.25);
    const slide = (1 - easeOutCubic(k)) * 40;
    if (it.sys) {
      c.font = '17px Mono'; const w = c.measureText(it.sys).width + 30;
      c.globalAlpha = k; c.fillStyle = '#1a1e1a'; c.beginPath(); c.roundRect(810 - w / 2, y - 34 + slide, w, 30, 15); c.fill();
      c.fillStyle = '#9aa69a'; c.textAlign = 'center'; c.fillText(it.sys, 810, y - 13 + slide); c.textAlign = 'left';
      y -= 44; c.globalAlpha = 1; continue;
    }
    c.font = '24px Mono'; const tw = c.measureText(it.text).width;
    const bw = Math.max(tw, c.measureText(it.name).width) + 40, bh = 82;
    const bx = 430, by = y - bh + slide;
    c.globalAlpha = k;
    const dx = it.dup ? (hash(i + Math.floor(t * 12)) - 0.5) * 60 * err : 0;
    c.fillStyle = it.dup ? 'rgba(60,0,10,0.9)' : '#1a1f1a'; c.beginPath(); c.roundRect(bx + dx, by, bw, bh, 16); c.fill();
    drawMask(c, 394 + dx, by + bh - 24, 44, it.seed, { color: it.dup ? C.red : C.green });
    const nameCol = ['#39ff14', '#ff4d6d', '#c6ff9e', '#7dff5a', '#ffffff', '#ff8099', '#9dff7a'][it.seed % 7];
    c.fillStyle = it.dup ? C.red : nameCol; c.font = '19px MonoB'; c.fillText(it.name, bx + 20 + dx, by + 30);
    c.fillStyle = '#f2f2f2'; c.font = '24px Mono'; c.fillText(it.dup ? scramble(it.text, err * 0.5, i) : it.text, bx + 20 + dx, by + 64);
    c.fillStyle = '#5d695d'; c.font = '14px Mono'; c.fillText('23:5' + (it.seed % 10), bx + bw - 54 + dx, by + 74);
    c.globalAlpha = 1;
    y -= bh + 12;
  }
  c.restore();
  // поле ввода и «печатает…»
  c.fillStyle = '#121512'; c.fillRect(340, H - 76, W - 340, 76);
  c.fillStyle = '#5b665b'; c.font = '21px Mono'; c.fillText('Написать сообщение…', 372, H - 30);
  if (t > 22 && t < 27) { const d = '.'.repeat(1 + (Math.floor(t * 4) % 3)); c.fillStyle = C.green; c.font = '17px Mono'; c.fillText(`${MESSAGES[Math.min(6, Math.floor((t - 22) / 0.65))].name} печатает${d}`, 424, 60 + 0 * 0); }
  // ошибки
  if (err > 0) {
    const n = Math.floor(err * 6);
    for (let i = 0; i < n; i++) {
      const x = 380 + hash(i * 3.7) * 620, yy = 160 + hash(i * 5.1) * 420;
      c.fillStyle = '#0a0000'; c.fillRect(x, yy, 400, 150); c.strokeStyle = C.red; c.lineWidth = 3; c.strokeRect(x, yy, 400, 150);
      c.fillStyle = C.red; c.fillRect(x, yy, 400, 34); c.fillStyle = '#000'; c.font = '18px MonoB'; c.fillText(['chat.exe', 'telegram.dll', 'sanity.sys', 'filter.dll', 'admin.exe', 'brain.exe'][i], x + 12, yy + 24);
      c.fillStyle = '#fff'; c.font = '20px Mono'; c.fillText(['Не отвечает', 'Слишком много сообщений', 'Модерация: 404', 'Фильтр отключён', 'Администратор сбежал', 'Переполнение'][i], x + 16, yy + 80);
      c.fillStyle = '#888'; c.font = '16px Mono'; c.fillText('0x' + (0xdead0000 + i * 4097).toString(16).toUpperCase(), x + 16, yy + 116);
    }
    // срезовое смещение
    for (let i = 0; i < 5 * err; i++) {
      const yy = Math.floor(hash(i * 7 + Math.floor(t * 15)) * 760);
      c.drawImage(chat.canvas, 0, yy, W, 26, (hash(i + Math.floor(t * 15)) - 0.5) * 140 * err, yy, W, 26);
    }
  }
  // включение экрана: линия → кадр
  const on2 = clamp((t - T.screenOn) / 0.5);
  if (on2 < 1) {
    const hh = Math.max(4, H * Math.pow(on2, 2.5));
    c.save(); c.globalCompositeOperation = 'destination-in'; c.fillStyle = '#fff'; c.fillRect(0, H / 2 - hh / 2, W, hh); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(200,255,200,${1 - on2})`; c.fillRect(0, H / 2 - hh / 2, W, hh); c.restore();
  }
  chat.tex.needsUpdate = true;
}

function labelTex(name) {
  const { ctx: c, tex } = canvasTex(512, 96);
  c.font = '44px MonoB'; c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.fillText(name, 256, 62);
  return tex;
}

export default {
  async init() {
    scene.fog = new THREE.FogExp2(0x030503, 0.06);
    const metal = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.55, metalness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.8, metalness: 0.2 });
    // пол, потолок, стены
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 40), new THREE.MeshStandardMaterial({ color: 0x0b0c0b, roughness: 0.28, metalness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -4; scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 40), dark); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.2, -4); scene.add(ceil);
    // плитка пола: тонкие швы
    const seams = new THREE.GridHelper(40, 40, 0x1a2a16, 0x121812); seams.position.set(0, 0.002, -4); scene.add(seams);
    // стойки
    const rackGeo = new THREE.BoxGeometry(1.2, 2.5, 1.0);
    const racks = new THREE.InstancedMesh(rackGeo, metal, 40);
    const ledGeo = new THREE.PlaneGeometry(0.9, 2.2);
    const d = new THREE.Object3D(); let n = 0;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 14; i++) {
        const z = 9 - i * 1.25; if (Math.abs(z + 6) < 1.2 && side > 0) continue;
        d.position.set(side * 4.0, 1.25, z); d.rotation.set(0, 0, hash(i + side) > 0.85 ? side * 0.04 : 0); d.updateMatrix(); racks.setMatrixAt(n++, d.matrix);
        const lm = new THREE.MeshBasicMaterial({ map: ledTex(i * 7 + side * 3), color: 0xffffff });
        lm.map.offset.y = hash(i * 9 + side); ledMats.push(lm);
        const led = new THREE.Mesh(ledGeo, lm); led.position.set(side * 3.39, 1.25, z); led.rotation.y = -side * Math.PI / 2; scene.add(led);
      }
    }
    for (let i = 0; i < 6; i++) { d.position.set(-3.5 + i * 1.4, 1.25, -15); d.rotation.set(0, 0, 0); d.updateMatrix(); racks.setMatrixAt(n++, d.matrix); }
    racks.count = n; scene.add(racks);
    // мёртвые ЭЛТ-мониторы и системники
    const crt = new THREE.BoxGeometry(0.7, 0.55, 0.6), scrG = new THREE.PlaneGeometry(0.56, 0.42);
    const nt = noiseTex(128);
    const r = rng(5);
    const spots = [[-2.4, 0.28, 3], [-2.2, 0.83, 3.1], [2.5, 0.28, 1], [2.3, 0.28, -1.5], [-2.6, 0.28, -3], [-2.5, 0.83, -3.05], [2.6, 0.28, -9], [-2.2, 0.28, -10], [1.9, 0.28, 5.5], [-1.9, 0.28, 7], [2.2, 0.83, 1.02], [-1.4, 0.28, -12]];
    for (const [x, y, z] of spots) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = (x > 0 ? -1 : 1) * (0.5 + r() * 0.6) + (r() - 0.5) * 0.4;
      g.add(new THREE.Mesh(crt, dark));
      const live = r() > 0.45;
      const sm = live ? screenMaterial(nt, { gain: 0.35 }) : new THREE.MeshStandardMaterial({ color: 0x050605, roughness: 0.15, metalness: 0.4 });
      if (live) staticMats.push(sm);
      const s = new THREE.Mesh(scrG, sm); s.position.z = 0.301; g.add(s); scene.add(g);
    }
    // кабели
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.6, metalness: 0.3 });
    for (let i = 0; i < 26; i++) {
      const side = r() > 0.5 ? 1 : -1, z0 = 9 - r() * 22;
      const pts = [new THREE.Vector3(side * 3.4, 4.2, z0), new THREE.Vector3(side * (2.6 - r() * 2), 2.6 + r() * 1.2, z0 - 0.5 - r()), new THREE.Vector3((r() - 0.5) * 3, r() < 0.5 ? 0.03 : 3.0 + r(), z0 - 1.5 - r() * 2), new THREE.Vector3(-side * (1 + r() * 2), 0.03, z0 - 3 - r() * 2)];
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.022 + r() * 0.02, 6), cableMat));
    }
    // стол и рабочий компьютер
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.3), metal); desk.position.set(0, 0.78, -6.1); scene.add(desk);
    for (const [x, z] of [[-1.4, -5.6], [1.4, -5.6], [-1.4, -6.6], [1.4, -6.6]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), metal); leg.position.set(x, 0.39, z); scene.add(leg); }
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.86, 1.28, 0.14), new THREE.MeshStandardMaterial({ color: 0x1b1b1a, roughness: 0.5, metalness: 0.3 }));
    bezel.position.set(0, 1.5, -6.22); scene.add(bezel);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.9), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 }));
    back.position.set(0, 1.5, -6.75); scene.add(back);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.5), metal); stand.position.set(0, 0.88, -6.4); scene.add(stand);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.32), dark); kb.position.set(0, 0.84, -5.65); kb.rotation.x = 0.06; scene.add(kb);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 1.0), dark); tower.position.set(1.1, 0.5, -6.0); scene.add(tower);
    const pled = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0x39ff14 })); pled.position.set(1.1, 0.85, -5.49); scene.add(pled);
    chat = canvasTex(1280, 800);
    chatMat = screenMaterial(chat.tex, { gain: 1.25 });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(SCR.w, SCR.h), chatMat); scr.position.set(SCR.x, SCR.y, SCR.z); scene.add(scr);
    // свет
    scene.add(new THREE.AmbientLight(0x1a221a, 2.2)); const hemi = new THREE.HemisphereLight(0x2a3a2a, 0x050505, 1.2); scene.add(hemi);
    for (const z of [6, 0, -11]) { const fl = new THREE.PointLight(0x6aff4a, 4, 9, 1.6); fl.position.set(0, 3.8, z); scene.add(fl); }
    screenLight = new THREE.PointLight(0x7dff6a, 6, 7, 1.6); screenLight.position.set(0, 1.5, -5.4); scene.add(screenLight);
    lampLight = new THREE.SpotLight(0xd8ffd0, 70, 10, 0.5, 0.6, 1.4); lampLight.position.set(0, 4.15, -5.6); lampLight.target.position.set(0, 0.8, -6.1); scene.add(lampLight, lampLight.target);
    roomLight = new THREE.PointLight(0x39ff14, 3, 12, 1.8); roomLight.position.set(0, 3.6, 2); scene.add(roomLight);
    redLight = new THREE.PointLight(0xff0033, 0, 14, 1.5); redLight.position.set(0, 3.0, -4); scene.add(redLight);
    const lampBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: 0xe8ffe0 })); lampBox.position.set(0, 4.16, -5.6); scene.add(lampBox);
    beamMat = beamMaterial([0.75, 1, 0.7], 0.22);
    beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.7, 3.4, 40, 1, true), beamMat);
    beam.position.set(0, 2.45, -5.9); scene.add(beam);
    // пыль в луче
    const dn = 700, dp = new Float32Array(dn * 3), ds = new Float32Array(dn), dc = new Float32Array(dn * 3);
    for (let i = 0; i < dn; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 1.5; dp.set([Math.cos(a) * rr, 0.8 + r() * 3.3, -5.9 + Math.sin(a) * rr], i * 3); ds[i] = 0.4 + r(); dc.set([0.7, 1, 0.7], i * 3); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aSize', new THREE.BufferAttribute(ds, 1)); dg.setAttribute('aColor', new THREE.BufferAttribute(dc, 3));
    dust = new THREE.Points(dg, pointsMaterial({ size: 0.035, opacity: 0.6 })); scene.add(dust);
    // голограммы участников
    const extra = [['nefor_' + 13, 131], ['ZOV', 141], ['анон', 151], ['???', 161], ['user_404', 171], ['swag', 181], ['ERR', 191], ['memento', 201]];
    const list = [...MESSAGES.map((m) => [m.name, m.seed]), ...extra];
    list.forEach(([name, seed], i) => {
      const g = new THREE.Group();
      const mat = holoMaterial(maskTex(seed), [0.35, 1, 0.25]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat); g.add(m);
      const lm = holoMaterial(labelTex(name), [0.5, 1, 0.4]);
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.11), lm); l.position.y = -0.3; g.add(l);
      const a = (i / list.length) * Math.PI * 2 + 0.3;
      const rad = 1.3 + hash(i * 3) * 1.2;
      g.userData = { i, mats: [mat, lm], target: new THREE.Vector3(Math.cos(a) * rad, 2.0 + hash(i * 7) * 1.4, -6.2 + Math.sin(a) * rad * 0.55), t0: 26.6 + i * 0.09 };
      holos.push(g); scene.add(g);
    });
    holoLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
    holoLines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(holos.length * 12), 3));
    holoLines.frustumCulled = false; scene.add(holoLines);
  },

  update(t) {
    drawChat(t);
    const err = clamp((t - T.pcErrors) / 1.5);
    chatMat.uniforms.time.value = t; chatMat.uniforms.flicker.value = 0.05 + err * 0.4;
    chatMat.uniforms.gain.value = 1.25 * (t < T.screenOn ? 0 : 1);
    for (const sm of staticMats) { sm.uniforms.time.value = t; sm.uniforms.map.value.offset.set(stepNoise(t, 24, 1), stepNoise(t, 24, 2)); }
    // мигание светодиодов + краснота при ошибках
    ledMats.forEach((m, i) => {
      m.map.offset.y = hash(i * 9) + Math.floor(t * (2 + (i % 3))) * 0.137;
      const red = err > 0 && hash(i + Math.floor(t * 8)) < err * 0.8;
      m.color.setRGB(red ? 1.6 : 1, red ? 0.1 : 1, red ? 0.2 : 1);
    });
    const flick = t > 19 && t < 19.4 ? stepNoise(t, 30, 3) : 1;
    lampLight.intensity = 70 * smooth(17.6, 19.0, t) * flick * (1 - err * 0.5 * stepNoise(t, 16, 4));
    beamMat.uniforms.strength.value = 0.22 * smooth(17.6, 19.0, t) * flick; beamMat.uniforms.time.value = t;
    screenLight.intensity = t < T.screenOn ? 0 : 6 * (1 + err * 0.6 * stepNoise(t, 20, 6));
    screenLight.color.setRGB(1 - err * 0.0 + err * 0.6, 1 - err * 0.7, 0.4 - err * 0.2);
    redLight.intensity = err * 12 * (0.5 + 0.5 * Math.sin(t * 14));
    dust.position.y = -t * 0.03; dust.rotation.y = t * 0.02;
    // голограммы
    const pos = holoLines.geometry.attributes.position.array;
    holos.forEach((g, i) => {
      const { target, t0, mats } = g.userData;
      const k = clamp((t - t0) / 1.1);
      const e = easeOutBack(k, 1.2);
      const from = new THREE.Vector3(SCR.x + (hash(i) - 0.5) * 1.2, SCR.y + (hash(i * 2) - 0.5) * 0.6, SCR.z + 0.05);
      g.position.lerpVectors(from, target, e);
      g.position.y += Math.sin(t * 1.3 + i) * 0.05 * k;
      g.position.x += err * (hash(i + Math.floor(t * 10)) - 0.5) * 0.3;
      g.visible = k > 0;
      g.scale.setScalar(0.2 + 0.8 * easeOutCubic(k));
      g.quaternion.copy(cam.quaternion);
      for (const m of mats) { m.uniforms.time.value = t; m.uniforms.opacity.value = clamp(k * 3) * (0.9 + 0.1 * Math.sin(t * 20 + i)); m.uniforms.glitch.value = 0.2 + err * 1.5; }
      const o = i * 6;
      pos[o] = g.position.x; pos[o + 1] = g.position.y - 0.21 * g.scale.y; pos[o + 2] = g.position.z;
      pos[o + 3] = from.x; pos[o + 4] = from.y; pos[o + 5] = from.z;
      if (k <= 0) for (let j = 0; j < 6; j++) pos[o + j] = from.x;
    });
    holoLines.geometry.attributes.position.needsUpdate = true;
    holoLines.material.opacity = 0.35 * smooth(26.6, 27.4, t);
    const keys = [
      { t: 17.5, p: [0.7, 1.45, 11.5], l: [0.1, 1.25, -6], roll: 0.03, fov: 52 },
      { t: 20.8, p: [-0.5, 1.6, 4.6], l: [0, 1.4, -6], roll: -0.01, fov: 50 },
      { t: 22.4, p: [0.55, 1.58, -1.4], l: [0.05, 1.5, -6.2], roll: 0.015, fov: 46 },
      { t: 23.6, p: [0.32, 1.52, -4.35], l: [0.08, 1.47, -6.2], roll: 0.0, fov: 44 },
      { t: 26.0, p: [-0.12, 1.5, -4.5], l: [0.06, 1.45, -6.2], roll: -0.01, fov: 44 },
      { t: 28.0, p: [-1.9, 2.25, -2.3], l: [0, 2.0, -6.2], roll: 0.04, fov: 50 },
      { t: 30.3, p: [1.6, 2.0, -2.6], l: [0, 1.85, -6.2], roll: -0.03, fov: 50 },
      { t: 32.2, p: [0.5, 1.6, -3.8], l: [0, 1.5, -6.2], roll: 0.0, fov: 46 },
      { t: 33.8, p: [0.15, 1.52, -4.6], l: [0, 1.5, -6.2], roll: 0.02, fov: 44 },
      { t: 35.2, p: [0.0, 1.5, -6.05], l: [0, 1.5, -6.5], roll: 0.15, fov: 70 },
    ];
    const sh = err * 0.03 + pulse(t, T.pcErrors, 4) * 0.04;
    applyCam(cam, keys, t, { dx: shake(t, 11) * sh + noise1(t * 0.5) * 0.04, dy: shake(t, 12) * sh + noise1(t * 0.4 + 9) * 0.03, roll: shake(t, 13) * sh });
    return { scene, camera: cam };
  },

  fx(t) {
    const err = clamp((t - T.pcErrors) / 1.5);
    const dive = smooth(33.8, 35.2, t);
    return {
      staticAmt: (1 - smooth(17.5, 18.4, t)) * 0.9 + dive * dive * 0.15,
      ca: 0.2 + err * 0.8 + dive * 1.5, glitch: err * 0.35 * (stepNoise(t, 10, 21) > 0.5 ? 1 : 0.2) + pulse(t, T.pcErrors, 5) * 0.5 + dive * 0.3,
      tear: err * 0.4, rgbSplit: err * 0.4, redFlash: pulse(t, T.pcErrors, 5) * 0.3,
      radial: dive * 0.9, samples: dive > 0.1 ? 4 : 1, shutter: 0.7,
      dof: t > 22 && t < 27 ? 0.85 : 0.55, focus: t > 22.5 && t < 27 ? 1.9 : t < 22.5 ? 9 : 4.0, focusRange: t > 22.5 && t < 27 ? 1.0 : 4,
      bloom: 1.1, bloomThreshold: 0.4, noiseAmt: 0.2, scan: 0.25, vig: 0.8, exposure: 1.35,
      flash: smooth(34.9, 35.2, t) * 0.7,
    };
  },

  hud(h, t) {
    if (t >= T.phrase2 && t < T.phrase2End + 0.4) {
      const str = 'ВСЁ НАЧИНАЛОСЬ КАК ОБЫЧНЫЙ ЧАТ…';
      const k = t - T.phrase2;
      const n = Math.min(str.length, Math.floor(k * 26));
      const a = 1 - smooth(T.phrase2End - 0.2, T.phrase2End + 0.3, t);
      const g = smooth(T.phrase2End - 0.6, T.phrase2End + 0.3, t);
      h.rect(0, 860, 1920, 120, '#000', 0.35 * a);
      h.text(str.slice(0, n) + (n < str.length || Math.floor(t * 3) % 2 ? '▌' : ''), 960, 940, { font: 'UnbR', size: 52, align: 'center', track: 4, color: '#ffffff', alpha: a, glow: 16, glowColor: 'rgba(57,255,20,0.5)', slices: { amt: g * 60, seed: Math.floor(t * 15) }, split: g * 8 });
    }
    if (t > 21.5 && t < 33.5) {
      const m = membersAt(t);
      h.text(`MEMBERS ${String(m).padStart(3, '0')}`, 1860, 70, { font: 'Tek', size: 34, align: 'right', color: C.green, alpha: 0.85 * win(t, 21.5, 33.5, 0.3, 0.3), track: 4 });
      h.text('LIVE · SWAG_ZOV_NEFOR.exe', 1860, 100, { font: 'Mono', size: 18, align: 'right', color: C.white, alpha: 0.5 * win(t, 21.5, 33.5, 0.3, 0.3), track: 2 });
      if (t > T.pcErrors) h.tag('SYSTEM FAILURE', 60, 80, C.red, t, 1, 26);
    }
  },
};
