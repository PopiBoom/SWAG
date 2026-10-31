// 54 → 78 s: out of the chat into an endless dark universe — the network of real members,
// "62 УЧАСТНИКА / 21 В СЕТИ", a tunnel of nicknames, then KAPUSTKA on a throne of monitors and servers.
import * as THREE from 'three';
import { makeCanvas, canvasTex, glowTexture, smokeTexture, clamp, lerp, inv, smooth, smoother, eOutCubic, eInCubic, eOutBack, eInOutCubic, eOutExpo, eInOutSine, rng, hash, wobble, track, W, H } from '../core.js';
import { F, C, sprite, put, putGlitch, letters, decoded, arc, drawTelegram } from '../ui.js';
import { buildingMaterial, makeBuildings, TINTS, screenAtlas, makeScreens, gridGround, skyDome } from '../citylib.js';
import { MEMBERS, KAPUSTKA, NICK_FONT } from '../data.js';
import { labelTexture, FILL_D, TG } from './city.js';
import { cyberEnv } from './skull.js';

const FOV = 50;
const PZ = 300;                 // z of the dissolving chat plane
const NUMZ = 205;               // z of the numbers
export async function build(ctx) {
  const { E, atlas, renderer } = ctx;
  const scene = new THREE.Scene();
  scene.environment = cyberEnv(renderer);
  const camera = new THREE.PerspectiveCamera(FOV, W / H, .1, 3000);
  const gTex = glowTexture(64);
  const R = rng(54);

  // ---------------- dissolving chat → particles
  const tgC = makeCanvas(1080, 1920), tgX = tgC.getContext('2d', { willReadFrequently: true });
  drawTelegram(tgX, 1080, 1920, atlas, { t: 54, scroll: (54 - 40) * 14, msgs: 9, dimAvatars: 1 });
  const img = tgX.getImageData(0, 0, 1080, 1920).data;
  const step = 4, cols = 1080 / step, rows = 1920 / step;
  const ppos = new Float32Array(cols * rows * 3), pcol = new Float32Array(cols * rows * 3), pseed = new Float32Array(cols * rows * 4);
  let np = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = ((j * step + 2) * 1080 + i * step + 2) * 4;
    const r = img[k] / 255, g = img[k + 1] / 255, b = img[k + 2] / 255;
    ppos.set([(i / cols - .5) * TG.w, (.5 - j / rows) * TG.h, PZ], np * 3);
    pcol.set([Math.pow(r, 2.2) * .62, Math.pow(g, 2.2) * .62, Math.pow(b, 2.2) * .62], np * 3);
    pseed.set([R(), R(), R(), R()], np * 4); np++;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3)); pg.setAttribute('aCol', new THREE.BufferAttribute(pcol, 3)); pg.setAttribute('aS', new THREE.BufferAttribute(pseed, 4));
  const pU = { uT: { value: 0 }, uPx: { value: H / 1920 }, uSize: { value: (H / 1920) * step * 1.0 } };
  const chatPts = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 aCol; attribute vec4 aS; uniform float uT, uSize; varying vec3 vC; varying float vA;
      void main(){ float t = max(uT - aS.w * .35, 0.); vec3 p = position;
        vec3 dir = normalize(vec3(p.xy * .06 + (aS.xy - .5) * 1.6, (aS.z - .3) * 2.));
        p += dir * (t * t * 18. + t * 6.) + vec3(sin(t * 3. + aS.x * 9.), cos(t * 2. + aS.y * 9.), 0.) * t * 1.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        float base = uSize * ${FILL_D.toFixed(3)} / -mv.z;
        gl_PointSize = max(base, 1.) * (1. + t * .6);
        vC = aCol * (1. - smoothstep(.1, 1.2, t)) + vec3(.1, .9, .4) * step(.9, aS.z) * smoothstep(0., .3, t); vA = 1. - smoothstep(1.2, 2.4, uT); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ if (vA * dot(vC, vec3(1.)) < .004) discard; gl_FragColor = vec4(vC, vA); }`,
  }));
  chatPts.frustumCulled = false; scene.add(chatPts);

  // ---------------- stars + nebula
  const SN = 4000, sp = new Float32Array(SN * 3), ss = new Float32Array(SN);
  for (let i = 0; i < SN; i++) { const v = new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize().multiplyScalar(500 + R() * 900); sp.set([v.x, v.y, v.z], i * 3); ss[i] = R(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(ss, 1));
  const starU = { uT: { value: 0 }, uO: { value: 1 }, uPx: { value: H / 1920 } };
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aS; uniform float uT, uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = (1. + aS * 2.5) * uPx * 1.6; vA = .35 + .65 * (.5 + .5 * sin(uT * (1. + aS * 3.) + aS * 40.)); }`,
    fragmentShader: `uniform float uO; varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.75, .85, 1.) * vA * uO * smoothstep(.5, .1, d), 1.); }` }));
  stars.frustumCulled = false; scene.add(stars);
  const smk = smokeTexture(256, 9);
  const nebula = [];
  for (let i = 0; i < 7; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: smk, color: [0x4a1888, 0x0c2a66, 0x5a0a22][i % 3], transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set((R() - .5) * 500, (R() - .5) * 500, -100 - R() * 600); m.scale.setScalar(300 + R() * 300); scene.add(m); nebula.push(m); }

  // ---------------- member nodes (all 63 real nicknames)
  const nodes = []; const labelSet = [];
  const order = MEMBERS.map((m, i) => i).filter(i => i !== KAPUSTKA);
  // three compositions: network cloud (A), ring around the numbers (B), helix tunnel (C)
  const A = order.slice(0, 22), B = order.slice(22, 42), Cc = order.slice(42);
  function avatarSprite(id, size) {
    const t = atlas.tex.clone(); t.needsUpdate = true; const [u, v, du, dv] = atlas.uv(id); t.offset.set(u, v); t.repeat.set(du, dv);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
    s.scale.setScalar(size); return s;
  }
  function makeNode(id, pos, size = 2.2, labelCol = '#b8ffd9') {
    const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(.2, 1.6, .7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(size * 1.6); g.add(halo);
    const av = avatarSprite(id, size); g.add(av);
    const name = MEMBERS[id].name; let lab = null;
    if (name) { const lt = labelTexture(name, labelCol, 64); lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false, color: new THREE.Color(1.3, 1.3, 1.3) })); lab.scale.set(lt.userData.aspect * size * .46, size * .46, 1); lab.center.set(.5, 1.45); g.add(lab); }
    return { g, halo, av, lab, id, pos: pos.clone(), size };
  }
  // A: cloud along the first flight (z 230 → 290)
  A.forEach((id, i) => {
    const z = 288 - i * 1.6 - R() * 1.5; const a = R() * Math.PI * 2; const rad = 5 + R() * 9;
    const n = makeNode(id, new THREE.Vector3(Math.cos(a) * rad * .8, Math.sin(a) * rad * 1.2, z), 2.3 + R() * .6);
    n.ign = 55.0 + i * .12; nodes.push(n);
  });
  // extra background constellation (unlabelled repeats of avatars) for scale
  const bgN = [];
  for (let i = 0; i < 110; i++) { const id = order[i % order.length]; const s = avatarSprite(id, 1.4 + R()); s.position.set((R() - .5) * 140, (R() - .5) * 200, 120 + R() * 150); s.material.opacity = 0; scene.add(s); bgN.push({ s, ign: 55.5 + R() * 3 }); }
  // network lines between nearest A-nodes + background
  const pts = nodes.map(n => n.pos).concat(bgN.map(b => b.s.position));
  const ign = nodes.map(n => n.ign).concat(bgN.map(b => b.ign));
  const lp = [], la = [], lc = [];
  pts.forEach((p, i) => {
    const d = pts.map((q, j) => [p.distanceToSquared(q), j]).sort((a, b) => a[0] - b[0]).slice(1, 3);
    d.forEach(([dd, j]) => { if (j < i || dd > 600) return; const st = Math.max(ign[i], ign[j]) + .2; const red = (i + j) % 3 === 0;
      lp.push(p.x, p.y, p.z, pts[j].x, pts[j].y, pts[j].z); la.push(0, st, 1, st); const c = red ? [1.8, .12, .25] : [.2, 1.6, .7]; lc.push(...c, ...c); });
  });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('aT', new THREE.Float32BufferAttribute(la, 2)); lg.setAttribute('aC', new THREE.Float32BufferAttribute(lc, 3));
  const lineU = { uT: { value: 0 }, uO: { value: 1 } };
  const lines = new THREE.LineSegments(lg, new THREE.ShaderMaterial({ uniforms: lineU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 aT; attribute vec3 aC; varying float vT; varying float vS; varying vec3 vC; void main(){ vT = aT.x; vS = aT.y; vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uT, uO; varying float vT; varying float vS; varying vec3 vC; void main(){ float f = clamp((uT - vS) / .7, 0., 1.); if (vT > f) discard; gl_FragColor = vec4(vC * uO * .8, 1.); }` }));
  lines.frustumCulled = false; scene.add(lines);

  // B: ring of nicknames around the numbers
  const ring = new THREE.Group(); ring.position.set(0, -3.5, NUMZ - 4); scene.add(ring);
  const ringNodes = B.map((id, i) => { const n = makeNode(id, new THREE.Vector3(), 1.7, '#ffd0d8'); scene.remove(n.g); ring.add(n.g); n.a0 = (i / B.length) * Math.PI * 2; return n; });
  // C: helix tunnel of nicknames toward the throne
  const helix = Cc.map((id, i) => { const z = 150 - i * 6.2; const a = i * 2.25; const n = makeNode(id, new THREE.Vector3(Math.cos(a) * 6.5, Math.sin(a) * 6.5 + 2.5, z), 2.7, '#cfe3ff'); return n; });

  // ---------------- numbers from metal elements
  function sampleText(txt) {
    const c = makeCanvas(600, 320), x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.font = `900 300px ${F.head}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 300, 170);
    const d = x.getImageData(0, 0, 600, 320).data; const out = [];
    for (let j = 0; j < 320; j += 5) for (let i = 0; i < 600; i += 5) if (d[(j * 600 + i) * 4 + 3] > 128) out.push([(i - 300) / 600 * 15, (160 - j) / 320 * 8]);
    return out;
  }
  const T62 = sampleText('62'), T21 = sampleText('21');
  const NC = Math.max(T62.length, T21.length);
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0xc8ced8, metalness: 1, roughness: .28, emissive: 0x000000 });
  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(.24, .24, .24), cubeMat, NC); cubes.frustumCulled = false;
  const cubeData = Array.from({ length: NC }, (_, i) => ({ a: T62[i % T62.length], b: T21[i % T21.length], from: new THREE.Vector3((R() - .5) * 80, (R() - .5) * 80, (R() - .5) * 60), d: R(), rot: new THREE.Vector3(R() * 6, R() * 6, R() * 6), dir: new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize() }));
  const numG = new THREE.Group(); numG.position.set(0, 5.5, NUMZ); numG.add(cubes); scene.add(numG);
  const numLight = new THREE.PointLight(0x39ff88, 0, 40, 1.5); numLight.position.set(0, 0, 8); numG.add(numLight);
  const numLight2 = new THREE.PointLight(0xff1f3d, 0, 40, 1.5); numLight2.position.set(-8, 4, 4); numG.add(numLight2);

  // ---------------- KAPUSTKA throne at the origin + city ring
  const K = new THREE.Vector3(0, 0, 0);
  const throne = new THREE.Group(); scene.add(throne);
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, metalness: .92, roughness: .32 });
  const parts = [];
  const addPart = (geo, mat, pos, delay) => { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); throne.add(m); parts.push({ m, target: pos.clone(), from: pos.clone().add(new THREE.Vector3((R() - .5) * 30, (R() - .2) * 25, (R() - .5) * 30)), rot: new THREE.Vector3(R() * 4, R() * 4, R() * 4), d: delay }); return m; };
  addPart(new THREE.BoxGeometry(11, .6, 9), blackMetal, new THREE.Vector3(0, .3, -.5), 0);
  addPart(new THREE.BoxGeometry(8.4, .6, 7), blackMetal, new THREE.Vector3(0, .9, -.8), .08);
  addPart(new THREE.BoxGeometry(6.4, .6, 5.4), blackMetal, new THREE.Vector3(0, 1.5, -1), .16);
  addPart(new THREE.BoxGeometry(4.6, 1.0, 3.4), blackMetal, new THREE.Vector3(0, 2.3, -1.4), .24);
  // backrest: wall of monitors (frames + screens)
  const scrList = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
    const p = new THREE.Vector3((i - 1) * 1.75, 3.3 + j * 1.3, -3.0 - Math.abs(i - 1) * .25);
    addPart(new THREE.BoxGeometry(1.7, 1.25, .9), blackMetal, p, .3 + (j * 3 + i) * .05);
    scrList.push({ x: p.x, y: p.y, z: p.z + .46, w: 1.45, h: 1.02, ry: 0, cell: [1, 5, 11, 3, 2, 9, 15, 4, 6, 1, 8, 13][j * 3 + i], delay: .1 + (j * 3 + i) * .06, part: parts.length - 1 });
  }
  // top crest monitor
  addPart(new THREE.BoxGeometry(2.4, 1.6, 1), blackMetal, new THREE.Vector3(0, 8.65, -3.0), .95);
  scrList.push({ x: 0, y: 8.65, z: -2.48, w: 2.1, h: 1.35, ry: 0, cell: 3, delay: .9, part: parts.length - 1 });
  // server-rack pillars & armrests (lit with the building shader)
  const rackMat = buildingMaterial({ fog: 0x050309, fogK: .0 }); rackMat.U.uWin.value = 1;
  const racks = [
    { x: -3.6, z: -3.0, w: 1.1, d: 1.1, h: 10.5, kind: 1, tint: TINTS[1], seed: 3, edge: 1 }, { x: 3.6, z: -3.0, w: 1.1, d: 1.1, h: 10.5, kind: 1, tint: TINTS[1], seed: 7, edge: 1 },
    { x: -2.75, z: -1.0, w: .9, d: 3.0, h: 3.6, kind: 1, tint: TINTS[0], seed: 11, edge: .6 }, { x: 2.75, z: -1.0, w: .9, d: 3.0, h: 3.6, kind: 1, tint: TINTS[0], seed: 13, edge: .6 },
  ];
  const rackMesh = makeBuildings(racks, rackMat); throne.add(rackMesh);
  const throneAtlas = screenAtlas(atlas), altAtlas = screenAtlas(atlas, true);
  const thrScreens = makeScreens(scrList, throneAtlas, altAtlas); thrScreens.U.uFogK.value = 0; throne.add(thrScreens);
  // cables from the throne into the floor
  const cr = rng(31);
  for (let i = 0; i < 8; i++) { const s = i % 2 ? 1 : -1; const p0 = new THREE.Vector3(s * (1.8 + cr() * 1.5), 2.2 + cr() * 4, -3.4); const c = new THREE.CatmullRomCurve3([p0, p0.clone().add(new THREE.Vector3(s * 1.5, -1.5, -1.2)), new THREE.Vector3(s * (5 + cr() * 4), 0.05, -5 - cr() * 4)]); const tb = new THREE.Mesh(new THREE.TubeGeometry(c, 40, .06, 6), new THREE.MeshBasicMaterial({ color: i % 3 ? new THREE.Color(1.6, .1, .2) : new THREE.Color(.15, 1.4, .5) })); throne.add(tb); parts.push({ m: tb, target: tb.position.clone(), from: tb.position.clone().add(new THREE.Vector3(0, -8, 0)), rot: new THREE.Vector3(), d: .6 + i * .04 }); }
  const thrLightR = new THREE.PointLight(0xff1f3d, 0, 25, 1.4); thrLightR.position.set(0, 6.5, 2); scene.add(thrLightR);
  const thrLightG = new THREE.PointLight(0x39ff88, 0, 25, 1.4); thrLightG.position.set(0, 2, 6); scene.add(thrLightG);
  // KAPUSTKA avatar + glow
  const kG = new THREE.Group(); kG.position.set(0, 4.4, -.3); scene.add(kG);
  const kHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(2.2, .5, .6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); kHalo.scale.setScalar(5); kG.add(kHalo);
  const kAv = avatarSprite(KAPUSTKA, 3.0); kG.add(kAv);
  const kRing = new THREE.Mesh(new THREE.TorusGeometry(1.62, .05, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, .25, .35) })); kG.add(kRing);
  const kLab = (() => { const lt = labelTexture('kapustka [Бледный]', '#ffd6dc', 64); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false, color: new THREE.Color(1.3, 1.3, 1.3) })); s.scale.set(lt.userData.aspect * .75, .75, 1); s.center.set(.5, 3.0); kG.add(s); return s; })();
  // lightning crown
  const CR_N = 9, crownGeo = new THREE.BufferGeometry(); const crownPos = new Float32Array(2000 * 3); crownGeo.setAttribute('position', new THREE.BufferAttribute(crownPos, 3));
  const crown = new THREE.LineSegments(crownGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(3.2, .3, .4), transparent: true }));
  crown.frustumCulled = false; kG.add(crown);
  const crownGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(1.6, .1, .2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); crownGlow.position.y = 2.5; crownGlow.scale.set(6, 3, 1); kG.add(crownGlow);
  function buildCrown(seed, amp) {
    const r = rng(seed); let n = 0;
    const seg = (a, b) => { const steps = 6; let prev = a.clone(); for (let s = 1; s <= steps; s++) { const p = a.clone().lerp(b, s / steps); if (s < steps) p.add(new THREE.Vector3((r() - .5), (r() - .5), (r() - .5)).multiplyScalar(.28 * amp)); crownPos.set([prev.x, prev.y, prev.z, p.x, p.y, p.z], n * 6); n++; prev = p; } };
    const base = [], tips = [];
    for (let i = 0; i < CR_N; i++) { const a = (i / CR_N) * Math.PI * 2; base.push(new THREE.Vector3(Math.cos(a) * 1.75, 2.0 + Math.sin(a * 2) * .05, Math.sin(a) * .7)); tips.push(new THREE.Vector3(Math.cos(a) * 2.0, 2.0 + (i % 2 ? 1.0 : 1.6) * amp, Math.sin(a) * .8)); }
    for (let i = 0; i < CR_N; i++) { seg(base[i], base[(i + 1) % CR_N]); seg(base[i], tips[i]); if (r() < .5) seg(tips[i], base[(i + 1) % CR_N]); if (r() < .3) seg(tips[i], tips[i].clone().add(new THREE.Vector3((r() - .5) * 1.2, .5 + r(), 0))); }
    crownGeo.setDrawRange(0, n * 2); crownGeo.attributes.position.needsUpdate = true;
  }
  // the city around the throne (dark until it ignites)
  const cityMat = buildingMaterial({ fog: 0x07040f, fogK: .0032, waveAxis: 1 }); cityMat.U.uWin.value = 0;
  const cl = []; const cscr = []; const rr = rng(77);
  for (let i = 0; i < 260; i++) {
    const a = Math.PI + (rr() - .5) * Math.PI * 1.55; const rad = 45 + Math.pow(rr(), .7) * 230;
    const x = Math.cos(a) * rad * 1.1, z = Math.sin(a) * rad * .9 - 10; if (z > 25) continue;
    const kind = rr() < .6 ? 0 : rr() < .6 ? 1 : 2; const w = 6 + rr() * 12, h = kind === 2 ? 10 + rr() * 20 : 20 + rr() * 110;
    cl.push({ x, z, w, d: 6 + rr() * 12, h, kind, tint: TINTS[(rr() * 5) | 0], seed: rr() * 100, edge: 1 });
    if (kind !== 1 && rr() < .6) { const ry = Math.atan2(-x, -z); cscr.push({ x: x + Math.sin(ry) * (w / 2 + .3), y: Math.min(h * .6, 8 + rr() * (h - 14)), z: z + Math.cos(ry) * (w / 2 + .3), w: w * .9, h: w * .9 * .8, ry, cell: (rr() * 16) | 0, delay: rr() }); }
  }
  const city = makeBuildings(cl, cityMat); scene.add(city);
  const cityScreens = makeScreens(cscr, screenAtlas(atlas), altAtlas); cityScreens.U.uFogK.value = .0032; scene.add(cityScreens);
  const ground = gridGround({ fog: 0x07040f, fogK: .0032, i: .5, waveAxis: 1 }); scene.add(ground);
  scene.add(new THREE.HemisphereLight(0x6a3cff, 0x0c3a20, .6));

  // ---------------- camera path
  const P = [
    [54, [0, 0, PZ + FILL_D]], [55, [0, 0, PZ + 12]], [56, [.5, .3, PZ - 18]], [58, [1, 1, PZ - 48]], [60, [0, 2.5, NUMZ + 34]], [63.5, [-1, 3, NUMZ + 30]],
    [64.6, [0, 3.5, NUMZ - 2]], [66, [0, 3, 110]], [67.3, [0, 3.5, 30]], [68.2, [0, 4.6, 19]], [70, [0, 4.8, 13.5]],
  ];
  const orbit = t => { const k = eInOutSine(inv(70, 77.2, t)); const a = lerp(0, 1.15, k); const rad = lerp(13.5, 17.5, Math.sin(Math.PI * k)); return new THREE.Vector3(Math.sin(a) * rad, lerp(4.8, 2.6, k), Math.cos(a) * rad - .3); };

  // ---------------- update
  let lastCrown = -1;
  function update(t, ui, fx, frame) {
    pU.uT.value = Math.max(0, t - E.network);
    chatPts.visible = t < E.network + 2.8;
    starU.uT.value = t; lineU.uT.value = t;
    rackMat.U.uTime.value = t; cityMat.U.uTime.value = t; thrScreens.U.uTime.value = t; cityScreens.U.uTime.value = t;
    // camera
    let cp, look;
    if (t < 70) { cp = new THREE.Vector3(...track(P, t)); look = cp.clone().add(new THREE.Vector3(0, 0, -30)); if (t > 58.5 && t < 64.3) look.lerp(new THREE.Vector3(0, 3, NUMZ), smooth(58.5, 59.5, t) * (1 - smooth(63.8, 64.3, t))); if (t > 67) look.lerp(kG.position, smooth(67, 68.5, t)); }
    else { cp = orbit(t); look = kG.position.clone().add(new THREE.Vector3(0, lerp(0, .6, smooth(70, 72, t)), 0)); if (t > 77.2) { cp.lerp(kG.position.clone().add(new THREE.Vector3(0, 0, 2)), eInCubic(inv(77.2, 78, t)) * .7); } }
    camera.position.copy(cp); camera.position.x += wobble(t, 1, .35) * .3; camera.position.y += wobble(t, 2, .35) * .2;
    camera.lookAt(look);
    camera.rotation.z += (t < 58 ? Math.sin(t * .8) * .06 : 0) + (t > 64.3 && t < 68 ? Math.sin((t - 64.3) * 1.4) * .25 : 0);
    camera.fov = t > 64.3 && t < 67.5 ? lerp(FOV, 68, Math.sin(Math.PI * inv(64.3, 67.5, t))) : FOV; camera.updateProjectionMatrix();

    // network nodes ignite
    const recede = smooth(67.5, 69.5, t);
    nodes.forEach(n => { const k = smooth(n.ign, n.ign + .5, t); n.g.visible = k > 0; n.av.material.opacity = clamp(k * 2 - .6); n.av.scale.setScalar(n.size * lerp(.2, 1, eOutBack(k))); n.halo.material.opacity = (1 - k * .8) * k * .8; if (n.lab) n.lab.material.opacity = clamp(k * 2 - 1) * (1 - recede); });
    bgN.forEach(b => { b.s.material.opacity = smooth(b.ign, b.ign + .6, t) * .55 * (1 - recede); });
    lineU.uO.value = 1 - recede;
    // ring of names around the numbers
    ring.visible = t > 58.5 && t < 65;
    ring.rotation.set(.12, 0, -.08);
    ringNodes.forEach((n, i) => { const a = n.a0 + (t - 58) * .32; n.g.position.set(Math.cos(a) * 15, 0, Math.sin(a) * 11); const k = smooth(59 + i * .06, 59.6 + i * .06, t) * (1 - smooth(63.8, 64.4, t)); n.av.material.opacity = k; n.halo.material.opacity = k * .15; if (n.lab) n.lab.material.opacity = k; n.av.scale.setScalar(n.size * lerp(.3, 1, k)); });
    // helix tunnel
    helix.forEach((n, i) => { const k = smooth(63.6 + i * .08, 64.3 + i * .08, t) * (1 - recede); n.g.visible = k > 0; n.av.material.opacity = k; n.halo.material.opacity = k * .2; if (n.lab) n.lab.material.opacity = k; });
    // numbers
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    const pulse = t > E.count21 ? 1 + .06 * Math.exp(-((t - E.count21) % .5) * 8) : 1;
    cubes.visible = t > 57.6 && t < 65;
    if (cubes.visible) cubeData.forEach((c, i) => {
      const k1 = eOutCubic(clamp((t - (E.count62 - .3 + c.d * .9)) / 1.1));
      const k2 = eInOutCubic(clamp((t - (E.count21 - .15 + c.d * .35)) / .55));
      const k3 = eInCubic(clamp((t - (63.8 + c.d * .3)) / .7));
      const tx = lerp(c.a[0], c.b[0], k2), ty = lerp(c.a[1], c.b[1], k2);
      v.set(lerp(c.from.x, tx, k1), lerp(c.from.y, ty, k1), lerp(c.from.z, 0, k1));
      v.multiplyScalar(pulse); v.addScaledVector(c.dir, k3 * 45);
      e.set(c.rot.x * (1 - k1) + t * .2 * (1 - k1) + k2 * Math.PI * (c.d > .5 ? 1 : -1), c.rot.y * (1 - k1), 0); q.setFromEuler(e);
      sc.setScalar(lerp(.4, 1, k1) * (1 - k3 * .5)); m4.compose(v, q, sc); cubes.setMatrixAt(i, m4);
    });
    cubes.instanceMatrix.needsUpdate = true;
    numG.rotation.y = Math.sin(t * .6) * .18; numG.rotation.x = Math.sin(t * .4) * .05;
    cubeMat.emissive.setRGB(.0, lerp(.0, .35, t > E.count21 ? Math.exp(-((t - E.count21) % .5) * 6) : 0), .1 * (t > E.count21 ? 1 : 0));
    numLight.intensity = smooth(58, 59, t) * 60; numLight2.intensity = smooth(58, 59, t) * 40;
    // throne assembly
    const showThrone = t > 66;
    throne.visible = showThrone; kG.visible = t > 64;
    parts.forEach(p => { const k = eOutBack(clamp((t - (E.throne + p.d)) / .9), 1.2); p.m.position.lerpVectors(p.from, p.target, k); p.m.rotation.set(p.rot.x * (1 - k), p.rot.y * (1 - k), p.rot.z * (1 - k)); p.m.visible = t > E.throne + p.d - .05; });
    rackMesh.visible = t > E.throne + .5; rackMat.U.uWin.value = smooth(E.throne + .5, E.throne + 1.5, t);
    thrScreens.visible = t > E.throne + .9; thrScreens.U.uBright.value = smooth(E.throne + .9, E.throne + 1.6, t) * 1.6;
    thrScreens.U.uSwitch.value = lerp(-1, 1.2, inv(E.screens, E.screens + .9, t)); cityScreens.U.uSwitch.value = thrScreens.U.uSwitch.value;
    thrLightR.intensity = smooth(E.crown, E.crown + .4, t) * 18 * (.8 + .2 * hash(Math.floor(frame / 2))); thrLightG.intensity = smooth(69, 71, t) * 14;
    // KAPUSTKA glow
    const kk = smooth(64.5, 68, t);
    kAv.material.opacity = kk; kAv.material.color.setScalar(lerp(.8, .9, smooth(68, 69, t)));
    kHalo.material.opacity = kk * (.8 + .2 * Math.sin(t * 4)) * lerp(.12, .22, smooth(68, 69, t)); kHalo.scale.setScalar(lerp(4.6, 5.6, smooth(68, 68.6, t)));
    kRing.material.color.setRGB(3, .25, .35).multiplyScalar(kk); kRing.rotation.set(0, 0, t * .5);
    kLab.material.opacity = smooth(68.4, 69.2, t) * (1 - smooth(70.8, 71.2, t));
    kG.lookAt(camera.position);
    // crown
    const cr = smooth(E.crown - .2, E.crown + .3, t); crown.visible = cr > 0; crownGlow.material.opacity = cr * (.5 + .5 * hash(frame * .37));
    if (crown.visible && Math.floor(frame / 2) !== lastCrown) { lastCrown = Math.floor(frame / 2); buildCrown(lastCrown * 7 + 1, cr); }
    // the city ignites behind, the wave, the screens
    cityMat.U.uWin.value = smooth(71.5, 74.5, t);
    const wz = t > E.wave ? (t - E.wave) * 120 - 20 : -1e5; cityMat.U.uWaveZ.value = wz; ground.U.uWaveZ.value = wz;
    ground.visible = t > 68.5; ground.U.uI.value = smooth(69, 72, t) * .5; city.visible = t > 68; cityScreens.visible = t > 71.5; cityScreens.U.uBright.value = smooth(71.5, 74, t) * 1.6;
    // nebula / stars fade near the throne
    nebula.forEach(n => n.material.opacity = .55 * (1 - smooth(70, 74, t) * .7));

    fx.vign = .75; fx.grain = .05; fx.ca = .6; fx.bloomStr = 1.0; fx.threshold = t > 67 ? .85 : .62; fx.exposure = 1.15; fx.uiBloom = .2;
    if (t < 54.25) { fx.glitch = .4 * (1 - (t - 54) / .25); }
    if (t > 68 && t < 68.4) { fx.flash = .55 * (1 - (t - 68) / .4); fx.flashColor = 0xff2a44; }
    if (t > E.screens && t < E.screens + .2) fx.glitch = .35;
    numbersUI(ui, t, fx, frame);
    kapustkaUI(ui, t, fx, frame);
  }

  // ---------------- UI
  const uch = sprite({ text: 'УЧАСТНИКА', size: 92, family: F.head, weight: 900, color: '#f4f6fb', ls: 12, glow: 14, glowColor: 'rgba(255,255,255,.5)', maxW: 940 });
  const online = sprite({ text: 'В СЕТИ', size: 110, family: F.head, weight: 900, color: '#39ff88', ls: 14, glow: 24, glowColor: 'rgba(57,255,136,.9)' });
  function numbersUI(ui, t, fx, frame) {
    const a = t - (E.count62 + .6), b = t - E.count21;
    const out = smooth(63.6, 64.0, t);
    if (a > 0 && b < 0) { letters(ui, 'УЧАСТНИКА', 540, 1120, { size: 92, family: F.head, weight: 900, color: '#f4f6fb', ls: 12, glow: 14, glowColor: 'rgba(255,255,255,.5)' }, clamp(a / .6), { rise: 40, alpha: 1 - smooth(-.15, 0, b) }); }
    if (b > 0) {
      const k = clamp(b / .3); const p = 1 + .05 * Math.exp(-(b % .5) * 8);
      putGlitch(ui, online, 540 + 40, 1120, k < 1 ? (1 - k) * .7 : 0, frame, { alpha: k * (1 - out), scale: p });
      ui.save(); ui.globalAlpha = k * (1 - out); ui.fillStyle = '#39ff88'; ui.shadowColor = '#39ff88'; ui.shadowBlur = 30;
      ui.beginPath(); ui.arc(540 + 40 - online.tw / 2 - 34, 1120, 22 * p, 0, Math.PI * 2); ui.fill(); ui.restore();
    }
  }
  const kT = sprite({ text: 'KAPUSTKA', size: 190, family: F.head, weight: 900, metal: 'red', glow: 30, glowColor: 'rgba(255,30,60,.55)', damage: 1, seed: 21, ls: 6, maxW: 980 });
  function kapustkaUI(ui, t, fx, frame) {
    const a = t - E.k_title; if (a < 0 || t > E.montage) return;
    const out = smooth(77.4, 77.9, t);
    const slam = eOutExpo(clamp(a / .3));
    const gl = a < .3 ? (1 - a / .3) : (hash(Math.floor(frame / 2) + 1) < .05 ? .3 : 0);
    putGlitch(ui, kT, 540, 1430, gl, Math.floor(frame / 2), { alpha: clamp(a / .06) * (1 - out), scale: lerp(1.6, 1, slam) * (1 + a * .008) });
    if (a < .12) { fx.flash = Math.max(fx.flash, .4 * (1 - a / .12)); fx.flashColor = 0xff3050; }
    const fr = Math.floor(frame / 3);
    for (let k = 0; k < 2; k++) { const s = fr * 11 + k * 57; if (hash(s) < .4) continue; const x1 = 540 + (hash(s + 1) - .5) * kT.tw, x2 = x1 + (hash(s + 2) - .5) * 300; arc(ui, x1, 1430 - kT.th * .5, x2, 1430 + (hash(s + 3) - .5) * kT.th, s, { color: '#ff5468', width: 2.2, glow: 16, alpha: (1 - out) * .8 }); }
    const b = t - E.k_sub;
    if (b > 0) letters(ui, 'СОЗДАТЕЛЬ MEMENTO MORI', 540, 1585, { size: 40, family: F.head, weight: 800, color: '#f4f6fb', ls: 4, glow: 10, glowColor: 'rgba(255,255,255,.5)' }, clamp(b / .8), { rise: 30, alpha: 1 - out });
  }

  return { scene, camera, update };
}
