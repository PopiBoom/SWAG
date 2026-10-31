import * as THREE from 'three';
import { T, MESSAGES, CITY_WORDS, DROP } from '../timeline.js';
import { C } from '../hud.js';
import { clamp, smooth, pulse, win, easeOutBack, easeOutCubic, easeOutExpo, rng, hash, shake, stepNoise, noise1, scramble } from '../util.js';
import { applyCam, sampleKeys, canvasTex, holoMaterial, pointsMaterial } from '../util3d.js';
import { bubbleTex, facadeTex, wordTex } from '../textures.js';
import { drawLaw, SCREEN, FINAL_DIST } from './s4_laws.js';

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 900);
const START = [0, 30, 60];
let shards, shardMat, towersMats = [], towerMeshes = [], bldg = [], bubbles = [], bolts, sparks, words = [], tower, towerMat, towerName, towerNameMat, crowd, pixels, pixMat, ringB, ringMeshes = [];

const EXTRA = [
  ['Death', 'пруфы будут?'], ['BunkerRP', 'это база'], ['heckuн', 'кринж'], ['kevin', 'ты кто вообще'], ['Сеня айТи', 'слился'],
  ['kapustka [Бледный]', 'иди нахуй'], ['Даша вкид', 'ору'], ['t9ctox7c', 'это фейк'], ['Вася Флеш', 'докажи'], ['ева', 'лол'], ['Ведьма', 'ну и бред'],
  ['cold#inte2(t#o)', 'ты не прав'], ['Антон Дуброн', 'политота пошла'], ['Арина (свэг шмот)', 'мем дня'], ['True Mafia', 'бан? какой бан'],
  ['birds of Hiroshima', 'бахнем'], ['Sharpilov', 'база'], ['puato4ka', 'ахахах'], ['Ян Брагин', 'душнила'], ['Celestiana', 'фу'],
];

const shardVert = `
attribute vec3 aCen; attribute vec3 aDir; attribute vec3 aAxis; attribute float aRnd;
uniform float prog; varying vec2 vUv; varying float vA;
vec3 rot(vec3 v, vec3 a, float ang){ return v * cos(ang) + cross(a, v) * sin(ang) + a * dot(a, v) * (1.0 - cos(ang)); }
void main(){
  vUv = uv;
  float p = clamp((prog - aRnd * 0.18) / 0.82, 0.0, 1.0);
  float e = p * p * (1.6 - 0.6 * p);
  vec3 local = position - aCen;
  vec3 pos = aCen + rot(local, aAxis, e * (3.0 + aRnd * 6.0)) + aDir * e * (14.0 + aRnd * 20.0);
  vA = 1.0 - smoothstep(0.6, 1.0, p);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;
const shardFrag = `uniform sampler2D map; uniform float gain; varying vec2 vUv; varying float vA;
void main(){ vec3 c = texture2D(map, vUv).rgb * gain; float edge = 0.0; gl_FragColor = vec4(c + vec3(0.06, 0.0, 0.01), 1.0); if(vA <= 0.01) discard; }`;

function buildShards(tex) {
  const cols = 16, rows = 9, w = SCREEN.w, h = SCREEN.h, r = rng(12);
  const P = [];
  for (let j = 0; j <= rows; j++) { P.push([]); for (let i = 0; i <= cols; i++) { const edge = i === 0 || j === 0 || i === cols || j === rows; P[j].push([(i / cols - 0.5) * w + (edge ? 0 : (r() - 0.5) * w / cols * 0.8), (j / rows - 0.5) * h + (edge ? 0 : (r() - 0.5) * h / rows * 0.8)]); } }
  const pos = [], uv = [], cen = [], dir = [], axis = [], rnd = [];
  const tri = (a, b, c) => {
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
    const d = new THREE.Vector3(cx * 0.35 + (r() - 0.5) * 1.5, cy * 0.35 + (r() - 0.5) * 1.5, 2.5 + r() * 3).normalize();
    const ax = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    // от центра удара (центр экрана) осколки разлетаются раньше
    const rr = clamp(Math.hypot(cx / w, cy / h) * 1.6 + r() * 0.25);
    for (const p of [a, b, c]) { pos.push(p[0], p[1], 0); uv.push(p[0] / w + 0.5, p[1] / h + 0.5); cen.push(cx, cy, 0); dir.push(d.x, d.y, d.z); axis.push(ax.x, ax.y, ax.z); rnd.push(rr); }
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i], d = P[j + 1][i + 1];
    if (r() > 0.5) { tri(a, b, d); tri(a, d, c); } else { tri(a, b, c); tri(b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCen', new THREE.Float32BufferAttribute(cen, 3)); g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
  g.setAttribute('aAxis', new THREE.Float32BufferAttribute(axis, 3)); g.setAttribute('aRnd', new THREE.Float32BufferAttribute(rnd, 1));
  shardMat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, prog: { value: 0 }, gain: { value: 0.85 } }, vertexShader: shardVert, fragmentShader: shardFrag, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, shardMat); m.frustumCulled = false; return m;
}

const KEYS = [
  { t: DROP, p: [...START], l: [START[0], START[1], -100], roll: 0, fov: 50 },
  { t: 66.45, p: [START[0], START[1], START[2] - 0.6], l: [START[0], START[1] - 0.5, -100], roll: 0.01, fov: 51 },
  { t: 67.6, p: [2, 24, 8], l: [-4, 20, -120], roll: 0.08, fov: 62 },
  { t: 69.6, p: [-6, 17, -55], l: [-12, 32, -130], roll: 0.14, fov: 64 },
  { t: 72.2, p: [5, 22, -120], l: [10, 36, -200], roll: -0.12, fov: 64 },
  { t: 74.8, p: [-4, 16, -180], l: [-10, 40, -260], roll: 0.1, fov: 62 },
  { t: 77.4, p: [6, 26, -240], l: [8, 40, -320], roll: -0.08, fov: 60 },
  { t: 79.6, p: [0, 40, -265], l: [0, 80, -360], roll: 0.04, fov: 62 },
  { t: 82.2, p: [0, 95, -170], l: [0, 185, -360], roll: 0.0, fov: 64 },
  { t: T.blackout, p: [0, 120, -110], l: [0, 215, -360], roll: -0.03, fov: 66 },
];

const facadeMat = (tex, tint) => new THREE.ShaderMaterial({
  uniforms: { map: { value: tex }, tint: { value: new THREE.Vector3(...tint) }, red: { value: 0 }, time: { value: 0 }, fogC: { value: new THREE.Vector3(0.01, 0.02, 0.01) } },
  vertexShader: `attribute float aH; varying vec2 vUv; varying float vD; varying vec3 vN; varying float vH; void main(){ vUv = uv; vH = aH; vN = normal; 
      #ifdef USE_INSTANCING
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      #else
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      #endif
      vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 tint, fogC; uniform float red, time; varying vec2 vUv; varying float vD; varying vec3 vN; varying float vH;
    void main(){ vec2 uv = vUv * vec2(1.0, vH / 40.0); uv.y += floor(time * 2.0 + vH) * 0.031 * step(0.5, fract(vH * 7.3));
      vec3 c = texture2D(map, uv).rgb; float top = step(0.5, vN.y);
      c *= 0.75; c = mix(c, vec3(0.015), top); c *= tint;
      float ex = min(min(vUv.x, 1.0 - vUv.x), 1.0 - vUv.y);
      c *= smoothstep(0.0, 0.04, min(vUv.x, 1.0 - vUv.x));
      c += vec3(0.25, 1.0, 0.1) * 0.5 * (1.0 - smoothstep(0.0, 0.006 * 40.0 / vH, 1.0 - vUv.y)) * (1.0 - top);
      c = mix(c, vec3(c.g * 1.4, c.g * 0.05, c.g * 0.2) + vec3(0.04, 0.0, 0.0), red);
      float f = 1.0 - exp(-vD * 0.0065); gl_FragColor = vec4(mix(c, fogC, f), 1.0); }`,
});

export default {
  async init() {
    const r = rng(55);
    scene.fog = null;
    // осколки — из собственной копии финального кадра экрана сцены IV
    const own = canvasTex(1600, 900); drawLaw(DROP - 0.01, own);
    shards = buildShards(own.tex);
    shards.position.set(START[0], START[1], START[2] - FINAL_DIST); scene.add(shards);
    // небо-градиент
    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { red: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float red; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 g = mix(vec3(0.02,0.07,0.02), vec3(0.0), smoothstep(-0.05, 0.5, h)); g = mix(g, vec3(0.12, 0.0, 0.02) * (1.0 - smoothstep(-0.05, 0.5, h)), red); gl_FragColor = vec4(g, 1.0); }' }));
    sky.userData.mat = sky.material; scene.add(sky); this.sky = sky;
    // земля и улицы
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ color: 0x020302 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new THREE.GridHelper(1200, 120, 0x1b5a10, 0x0c2208); grid.position.y = 0.05; scene.add(grid);
    // здания: три инстанс-группы с разными фасадами
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const texs = [facadeTex(1), facadeTex(2), facadeTex(3, true)];
    const tints = [[1, 1, 1], [0.8, 1, 0.8], [1, 0.9, 0.9]];
    const per = [[], [], []];
    for (let gx = -14; gx <= 14; gx++) for (let gz = -48; gz <= 6; gz++) {
      const x = gx * 14 + (r() - 0.5) * 4, z = gz * 14 + (r() - 0.5) * 4;
      if (Math.abs(x) < 13) continue; // проспект для пролёта
      if (Math.hypot(x, z + 360) < 30) continue; // площадь башни
      if (r() < 0.12) continue;
      const far = Math.abs(x) > 60;
      const hgt = (far ? 25 : 18) + Math.pow(r(), 1.8) * (far ? 120 : 70);
      const w = 6 + r() * 6, d = 6 + r() * 6;
      const b = { x, z, w, d, h: hgt, k: Math.floor(r() * 3), rnd: r(), dist: Math.hypot(x, z + 340) };
      per[b.k].push(b); bldg.push(b);
    }
    per.forEach((list, k) => {
      const mat = facadeMat(texs[k], tints[k]); towersMats.push(mat);
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const aH = new Float32Array(list.length);
      list.forEach((b, i) => { b.mesh = im; b.idx = i; aH[i] = b.h; });
      im.geometry = geo.clone(); im.geometry.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 1));
      im.userData.list = list; towerMeshes.push(im); scene.add(im);
    });
    // башня SWAG_ZOV_NEFOR.exe
    const tg = new THREE.CylinderGeometry(9, 16, 190, 6, 1); tg.translate(0, 95, 0);
    towerMat = facadeMat(facadeTex(9), [1.2, 1.4, 1.2]); towersMats.push(towerMat);
    tower = new THREE.Mesh(tg, towerMat); tg.setAttribute('aH', new THREE.Float32BufferAttribute(new Array(tg.attributes.position.count).fill(190), 1)); tower.position.set(0, 0, -360); scene.add(tower);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(tg), new THREE.LineBasicMaterial({ color: 0x39ff14 })); tower.add(edges);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 6), new THREE.MeshBasicMaterial({ color: 0x39ff14 })); spire.position.y = 220; tower.add(spire);
    towerNameMat = holoMaterial(wordTex('SWAG_ZOV_NEFOR.exe', 'Unb', 150, '#ffffff', 2048, 300), [0.5, 1, 0.4], { gain: '2.0' });
    towerName = new THREE.Mesh(new THREE.PlaneGeometry(230, 34), towerNameMat); towerName.position.set(0, 270, -360); scene.add(towerName);
    // облачка сообщений
    const all = [...MESSAGES.map((m) => [m.name, m.text, m.seed]), ...EXTRA.map((e, i) => [e[0], e[1], 500 + i * 13])];
    const btex = all.map(([n, tx, sd], i) => [bubbleTex(n, tx, sd, { red: i % 4 === 1 }), bubbleTex(n, tx, sd, { red: true })]);
    for (let i = 0; i < 150; i++) {
      const k = i % all.length; const [tg2, tr] = btex[k];
      const red = r() < 0.3;
      const tex = red ? tr : tg2;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.95 });
      const s = 5 + r() * 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s * tex.userData.aspect * 0.6, s * 0.6), mat);
      const z = 40 - r() * 400, side = r() < 0.5 ? -1 : 1;
      const x = side * (4 + r() * 40) * (r() < 0.3 ? 0.4 : 1);
      m.userData = { base: new THREE.Vector3(x, 12 + r() * 50, z), ph: r() * 10, sp: 0.3 + r() * 0.6, red };
      bubbles.push(m); scene.add(m);
    }
    // молнии (обновляются каждый кадр) и искры
    bolts = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, vertexColors: true }));
    bolts.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 16 * 6), 3));
    bolts.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(40 * 16 * 6), 3));
    bolts.frustumCulled = false; scene.add(bolts);
    const sn = 1200, sp = new Float32Array(sn * 3), ss = new Float32Array(sn), sc = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) { ss[i] = 0.5 + r(); sc.set(r() < 0.5 ? [1, 0.2, 0.3] : [1, 1, 0.8], i * 3); }
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sgeo.setAttribute('aSize', new THREE.BufferAttribute(ss, 1)); sgeo.setAttribute('aColor', new THREE.BufferAttribute(sc, 3));
    sparks = new THREE.Points(sgeo, pointsMaterial({ size: 0.5, color: [1, 1, 1] })); sparks.frustumCulled = false; scene.add(sparks);
    // толпа на проспекте
    const cn = 900, cp = new Float32Array(cn * 3), cs = new Float32Array(cn), cc = new Float32Array(cn * 3);
    for (let i = 0; i < cn; i++) { cs[i] = 0.6 + r() * 0.6; cc.set(r() < 0.15 ? [1, 0, 0.2] : [0.4, 1, 0.3], i * 3); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('aSize', new THREE.BufferAttribute(cs, 1)); cg.setAttribute('aColor', new THREE.BufferAttribute(cc, 3));
    crowd = new THREE.Points(cg, pointsMaterial({ size: 1.4 })); crowd.frustumCulled = false; scene.add(crowd);
    // голо-слова над крышами
    const wcol = [[1, 0.05, 0.2], [0.35, 1, 0.2], [1, 1, 1], [0.35, 1, 0.2]];
    const wpos = [[-34, 95, -110], [30, 85, -175], [-26, 100, -245], [24, 92, -305]];
    CITY_WORDS.forEach((w, i) => {
      const mat = holoMaterial(wordTex(w, 'Dela', 300, '#ffffff', 2048, 420), wcol[i], { gain: '1.35' });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(175, 36), mat); mat.depthTest = false; m.renderOrder = 10;
      // тёмная подложка: слово читается поверх светящихся фасадов
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(190, 46), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
      plate.renderOrder = 9; m.add(plate);
      // слово встаёт по ходу взгляда камеры в момент своего такта
      const cp = new THREE.Vector3(...sampleKeys(KEYS, T.words[i] + 0.4, 'p')), cl = new THREE.Vector3(...sampleKeys(KEYS, T.words[i] + 0.4, 'l'));
      m.position.copy(cp).addScaledVector(cl.sub(cp).normalize(), 165).add(new THREE.Vector3(0, 16, 0));
      m.userData = { mat, plate, t0: T.words[i] }; words.push(m); scene.add(m);
    });
    // пиксельный распад
    const pn = 14000, pp = new Float32Array(pn * 3), ps = new Float32Array(pn), pc = new Float32Array(pn * 3), pv = new Float32Array(pn * 4);
    for (let i = 0; i < pn; i++) {
      const b = bldg[Math.floor(r() * bldg.length)];
      pp.set([b.x + (r() - 0.5) * b.w, r() * b.h, b.z + (r() - 0.5) * b.d], i * 3);
      ps[i] = 0.8 + r() * 1.5; const v = r(); pc.set(v < 0.2 ? [1, 0, 0.2] : v < 0.4 ? [1, 1, 1] : [0.3, 1, 0.2], i * 3);
      pv.set([(r() - 0.5) * 2, 1 + r() * 3, (r() - 0.5) * 2, b.dist], i * 4);
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('aSize', new THREE.BufferAttribute(ps, 1)); pg.setAttribute('aColor', new THREE.BufferAttribute(pc, 3)); pg.setAttribute('aVel', new THREE.BufferAttribute(pv, 4));
    pixMat = new THREE.ShaderMaterial({
      uniforms: { prog: { value: 0 }, size: { value: 2.0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSize; attribute vec3 aColor; attribute vec4 aVel; uniform float prog, size; varying vec3 vC; varying float vA;
        void main(){ float p = clamp(prog * 1.6 - (1.0 - clamp(aVel.w / 300.0, 0.0, 1.0)) * 0.6, 0.0, 1.0); vec3 pos = position + aVel.xyz * p * p * 60.0;
          vC = aColor; vA = smoothstep(0.0, 0.1, p) * (1.0 - smoothstep(0.7, 1.0, p)); vec4 mv = modelViewMatrix * vec4(pos, 1.0); gl_PointSize = size * aSize * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = abs(gl_PointCoord - 0.5); if(max(d.x, d.y) > 0.45) discard; gl_FragColor = vec4(vC * vA, 1.0); }',
    });
    pixels = new THREE.Points(pg, pixMat); pixels.frustumCulled = false; scene.add(pixels);
    // расширение: дальнее кольцо новых зданий поднимается
    const rg = new THREE.BoxGeometry(1, 1, 1); rg.translate(0, 0.5, 0);
    const ringList = [];
    for (let i = 0; i < 220; i++) { const a = r() * Math.PI * 2, d = 380 + r() * 300; ringList.push({ x: Math.cos(a) * d, z: -360 + Math.sin(a) * d, w: 10 + r() * 14, h: 60 + r() * 260, rnd: r() }); }
    const rmat = facadeMat(facadeTex(21), [0.9, 1.1, 0.9]); towersMats.push(rmat);
    ringB = new THREE.InstancedMesh(rg.clone(), rmat, ringList.length);
    const rh = new Float32Array(ringList.length); ringList.forEach((b, i) => { rh[i] = b.h; });
    ringB.geometry.setAttribute('aH', new THREE.InstancedBufferAttribute(rh, 1));
    ringB.userData.list = ringList; scene.add(ringB);
  },

  update(t) {
    const collapse = smooth(T.collapse, T.blackout - 0.4, t);
    const warn = smooth(T.warning, T.warning + 0.15, t);
    const d = new THREE.Object3D();
    // здания: в распаде проседают по мере удалённости от башни
    towerMeshes.forEach((im) => {
      im.userData.list.forEach((b, i) => {
        const k = clamp(collapse * 1.6 - (1 - clamp(b.dist / 300)) * 0.6);
        const sink = 1 - easeOutCubic(k);
        const hop = t < T.collapse ? 1 + 0.03 * Math.sin(t * 4 + b.rnd * 20) * smooth(T.warning, T.warning + 1, t) : 1;
        d.position.set(b.x + (k > 0 ? (hash(i + Math.floor(t * 20)) - 0.5) * 1.5 * (1 - sink) : 0), 0, b.z);
        d.scale.set(b.w, Math.max(0.01, b.h * sink * hop), b.d); d.rotation.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    });
    ringB.userData.list.forEach((b, i) => {
      const k = easeOutCubic(clamp((t - T.collapse - 0.4 - b.rnd * 1.5) / 1.6));
      d.position.set(b.x, 0, b.z); d.scale.set(b.w, Math.max(0.01, b.h * k), b.w); d.updateMatrix(); ringB.setMatrixAt(i, d.matrix);
    });
    ringB.instanceMatrix.needsUpdate = true;
    for (const m of towersMats) { m.uniforms.time.value = t; m.uniforms.red.value = warn * (0.55 + 0.45 * Math.sin(t * 10)); }
    this.sky.material.uniforms.red.value = warn;
    pixMat.uniforms.prog.value = collapse;
    // осколки
    shardMat.uniforms.prog.value = clamp((t - DROP) / 1.3);
    shards.visible = t < DROP + 1.4;
    // облачка
    const camP = new THREE.Vector3(...sampleKeys(KEYS, t, 'p'));
    bubbles.forEach((m, i) => {
      const { base, ph, sp } = m.userData;
      m.position.set(base.x + Math.sin(t * sp + ph) * 3, base.y + Math.sin(t * sp * 0.7 + ph) * 2 + collapse * (hash(i) * 40), base.z + Math.cos(t * sp * 0.5 + ph) * 3);
      m.quaternion.copy(cam.quaternion);
      // облачко у самой камеры растворяется, чтобы пролёт сквозь него не давал белый кадр
      const cd = m.position.distanceTo(camP);
      m.material.opacity = 0.95 * (1 - collapse * 0.8) * smooth(5, 16, cd);
      m.visible = cd > 4;
    });
    // молнии между соседними «спорщиками»
    const bp = bolts.geometry.attributes.position.array, bc = bolts.geometry.attributes.color.array; bp.fill(0); bc.fill(0);
    let seg = 0;
    const sparkP = sparks.geometry.attributes.position.array; let sp = 0;
    for (let k = 0; k < 40; k++) {
      const a = bubbles[(k * 7) % bubbles.length], b = bubbles[(k * 7 + 3) % bubbles.length];
      const active = stepNoise(t, 5, k) > 0.45 && a.position.distanceTo(b.position) < 70;
      if (!active) continue;
      const A = a.position, B = b.position; let prev = A.clone();
      const red = hash(k) < 0.6;
      for (let s = 1; s <= 16; s++) {
        const u = s / 16; const p = A.clone().lerp(B, u);
        if (s < 16) p.add(new THREE.Vector3(hash(k * 31 + s + Math.floor(t * 30)) - 0.5, hash(k * 17 + s + Math.floor(t * 30)) - 0.5, hash(k * 7 + s + Math.floor(t * 30)) - 0.5).multiplyScalar(5));
        bp.set([prev.x, prev.y, prev.z, p.x, p.y, p.z], seg * 6);
        const cc = red ? [1.6, 0.1, 0.35] : [1.4, 1.4, 1.2]; bc.set([...cc, ...cc], seg * 6); seg++; prev = p;
      }
      for (let q = 0; q < 28 && sp < 1200; q++, sp++) {
        const age = ((t * 2 + hash(k * 3 + q)) % 1);
        const o = (hash(k * 5 + q) > 0.5 ? A : B);
        sparkP.set([o.x + (hash(q + k) - 0.5) * age * 18, o.y + (hash(q * 3 + k) - 0.3) * age * 14 - age * age * 8, o.z + (hash(q * 7 + k) - 0.5) * age * 18], sp * 3);
      }
    }
    for (; sp < 1200; sp++) sparkP.set([0, -100, 0], sp * 3);
    bolts.geometry.attributes.position.needsUpdate = true; bolts.geometry.attributes.color.needsUpdate = true;
    sparks.geometry.attributes.position.needsUpdate = true;
    bolts.material.opacity = 1 - collapse;
    // толпа: потоки вдоль проспекта
    const cp = crowd.geometry.attributes.position.array;
    for (let i = 0; i < 900; i++) {
      const lane = (hash(i) - 0.5) * 22, dir = hash(i * 3) > 0.5 ? 1 : -1;
      const z = 40 - (((hash(i * 7) * 420 + dir * t * (6 + hash(i * 9) * 8)) % 420) + 420) % 420;
      cp.set([lane, 0.8 + collapse * hash(i * 2) * 40, z], i * 3);
    }
    crowd.geometry.attributes.position.needsUpdate = true;
    // голо-слова
    words.forEach((w) => {
      const k = t - w.userData.t0; const m = w.userData.mat;
      const e = easeOutBack(clamp(k / 0.4), 1.8);
      w.visible = k > -0.01;
      w.scale.set(e, e * (k < 0.08 ? 0.15 : 1), 1);
      w.quaternion.copy(cam.quaternion);
      const op = clamp(k / 0.1) * (1 - smooth(2.3, 2.65, k)) * (1 - smooth(T.collapse - 0.2, T.collapse + 0.5, t));
      m.uniforms.time.value = t; m.uniforms.opacity.value = op; m.uniforms.glitch.value = k < 0.3 ? 0.6 : 0.06 + warn * 0.4;
      w.userData.plate.material.opacity = op * 0.6;
    });
    towerNameMat.uniforms.time.value = t;
    towerNameMat.uniforms.opacity.value = smooth(T.tower, T.tower + 0.5, t);
    towerName.quaternion.copy(cam.quaternion);
    towerName.scale.setScalar(0.6 + 0.4 * easeOutExpo(clamp((t - T.tower) / 0.8)));
    let wp = 0; for (const wt of T.words) wp = Math.max(wp, pulse(t, wt, 5));
    const sh = 0.4 + wp * 1.2 + warn * 0.8 + pulse(t, DROP, 2) * 2;
    applyCam(cam, KEYS, t, { dx: shake(t, 51) * sh, dy: shake(t, 52) * sh, roll: shake(t, 53) * 0.01 * sh });
    return { scene, camera: cam };
  },

  fx(t) {
    const warn = smooth(T.warning, T.warning + 0.15, t);
    let wp = 0; for (const wt of T.words) wp = Math.max(wp, pulse(t, wt, 6));
    const drop = pulse(t, DROP, 2.5);
    const collapse = smooth(T.collapse, T.blackout - 0.4, t);
    const end = smooth(T.blackout - 0.25, T.blackout, t);
    return {
      flash: pulse(t, DROP, 14) * 0.18 + wp * 0.1, flashCol: t < DROP + 0.4 ? [0.45, 1, 0.35] : [1, 1, 1],
      ca: 0.4 + wp * 1.5 + drop * 1.2 + warn * 0.8 + end * 3, glitch: wp * 0.35 + drop * 0.5 + warn * 0.35 * (stepNoise(t, 12, 9) > 0.5 ? 1 : 0.2) + end,
      rgbSplit: wp * 0.6 + warn * 0.5 + end, tear: warn * 0.6, noiseAmt: 0.25 + warn * 0.4, redFlash: pulse(t, T.warning, 4) * 0.5,
      radial: drop * 0.3 + wp * 0.3 + 0.04, samples: 3, shutter: 0.5,
      dof: 0.2, focus: 60, focusRange: 60, bloom: 1.25, bloomThreshold: 0.38, vig: 0.8, exposure: 1.15,
      pixelate: collapse * collapse * 0.25 * (stepNoise(t, 8, 3) > 0.6 ? 1 : 0.3) + end * 0.5,
    };
  },

  hud(h, t) {
    if (t >= T.warning && t < T.blackout) {
      const k = t - T.warning;
      const on = Math.floor(t * 6) % 2 === 0;
      const a = clamp(k / 0.1) * (1 - smooth(T.collapse + 0.6, T.collapse + 1.2, t));
      h.rect(0, 440, 1920, 200, '#ff0033', a * (on ? 0.22 : 0.1));
      h.rect(0, 440, 1920, 6, '#ff0033', a); h.rect(0, 634, 1920, 6, '#ff0033', a);
      h.text('WARNING: CHAOS OVERLOAD', 960, 572, { font: 'Tek', size: 112, align: 'center', color: '#fff', alpha: a, track: 6, split: on ? 8 : 3, slices: { amt: k < 0.3 ? 40 : 8, seed: Math.floor(t * 20) } });
      for (let i = 0; i < 4; i++) h.text('⚠ SYSTEM UNSTABLE ⚠ CHAOS 999% ⚠ FILTERS: NULL ⚠ ', ((t * 400 + i * 700) % 2800) - 900, 425, { font: 'MonoB', size: 22, color: C.red, alpha: a });
    }
    if (t > DROP + 0.5 && t < T.warning) {
      const a = win(t, DROP + 0.5, T.warning, 0.3, 0.1);
      h.text('SECTOR: DIGITAL ANARCHY', 60, 70, { font: 'MonoB', size: 20, color: C.green, alpha: a * 0.8, track: 4 });
      h.text(`MSG/SEC ${Math.floor(4000 + 3000 * Math.abs(Math.sin(t * 3)) + t * 120)}`, 1860, 70, { font: 'Tek', size: 30, align: 'right', color: C.green, alpha: a * 0.85, track: 3 });
    }
  },
};
