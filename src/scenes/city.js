// 32 → 54 s: the abandoned digital city, slogan gantries, the giant Telegram screen and its living interface.
import * as THREE from 'three';
import { makeCanvas, canvasTex, glowTexture, clamp, lerp, inv, smooth, smoother, eOutCubic, eOutBack, eInOutCubic, eOutExpo, rng, hash, wobble, track, W, H } from '../core.js';
import { F, C, sprite, put, putGlitch, letters, decoded, drawTelegram } from '../ui.js';
import { buildingMaterial, makeBuildings, TINTS, screenAtlas, makeScreens, skyDome, gridGround, pixelClouds, tokenAtlas, flyingTokens } from '../citylib.js';
import { NICK_FONT } from '../data.js';

export const TG = { zs: -175, cy: 48, w: 27, h: 48 };
const FOV = 50;
export const FILL_D = (TG.h / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

export function holoMaterial(atlas, id, col = new THREE.Color(.5, 2.2, 1.3)) {
  const [u, v, du, dv] = atlas.uv(id);
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atlas.tex }, uR: { value: new THREE.Vector4(u, v, du, dv) }, uT: { value: 0 }, uO: { value: 1 }, uCol: { value: col } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec4 uR; uniform float uT, uO; uniform vec3 uCol; varying vec2 vUv;
      void main(){ vec2 c = vUv - .5; float r = length(c); if (r > .5) discard;
        float jit = step(.97, fract(sin(floor(vUv.y * 40. + uT * 9.) * 91.7) * 4375.)) * .03;
        vec3 a = texture2D(uMap, uR.xy + (vUv + vec2(jit, 0.)) * uR.zw).rgb; a = pow(a, vec3(2.2));
        float scan = .65 + .35 * sin(vUv.y * 160. - uT * 12.);
        float rim = smoothstep(.36, .5, r) * (1. - smoothstep(.48, .5, r));
        vec3 col = (a * .8 + uCol * .06) * scan + uCol * rim * 1.1;
        gl_FragColor = vec4(col * uO, 1.); }`,
  });
}
export function labelTexture(text, color = '#9fffd0', size = 64) {
  const m = makeCanvas(8, 8).getContext('2d'); m.font = `500 ${size}px ${NICK_FONT}`;
  const w = Math.ceil(m.measureText(text).width + 40), h = Math.ceil(size * 1.5);
  const c = makeCanvas(w, h), x = c.getContext('2d'); x.font = m.font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = 14; x.fillStyle = color; x.fillText(text, w / 2, h / 2); x.shadowBlur = 0; x.fillStyle = '#fff'; x.globalAlpha = .85; x.fillText(text, w / 2, h / 2);
  const t = canvasTex(c); t.userData = { aspect: w / h }; return t;
}

const BILLS = [
  { key: 'bill1', lines: ['404', 'НОРМАЛЬНОСТЬ', 'НЕ НАЙДЕНА'], col: '#ff1f3d' },
  { key: 'bill2', lines: ['СВОБОДА', 'ОБЩЕНИЯ'], col: '#39ff88' },
  { key: 'bill3', lines: ['ХАОС', 'АКТИВИРОВАН'], col: '#b24bff' },
  { key: 'bill4', lines: ['ЗДЕСЬ', 'МОЖНО ВСЁ'], col: '#2fb6ff' },
];
function billboardTexture(b) {
  const c = makeCanvas(1024, 640), x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, 1024, 640);
  x.strokeStyle = b.col; x.lineWidth = 10; x.shadowColor = b.col; x.shadowBlur = 24; x.strokeRect(20, 20, 984, 600);
  x.lineWidth = 3; x.strokeRect(42, 42, 940, 556);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const L = b.lines;
  if (L[0] === '404') {
    x.fillStyle = b.col; x.font = `900 230px ${F.head}`; x.fillText('404', 512, 200);
    x.shadowBlur = 12; x.fillStyle = '#fff'; x.font = `900 76px ${F.head}`; x.fillText(L[1], 512, 400); x.fillText(L[2], 512, 495);
  } else {
    x.fillStyle = '#fff'; x.shadowBlur = 20;
    const sz = Math.min(170, 920 / Math.max(...L.map(s => s.length)) * 1.15);
    x.font = `900 ${sz}px ${F.head}`;
    L.forEach((s, i) => { x.fillStyle = i === L.length - 1 ? b.col : '#fff'; x.fillText(s, 512, 320 + (i - (L.length - 1) / 2) * sz * 1.12); });
  }
  x.shadowBlur = 0; x.fillStyle = 'rgba(0,0,0,.22)'; for (let j = 0; j < 640; j += 5) x.fillRect(0, j, 1024, 2);
  return canvasTex(c);
}

export async function build(ctx) {
  const { E, atlas } = ctx;
  const scene = new THREE.Scene();
  const FOG = 0x0a0518;
  const camera = new THREE.PerspectiveCamera(FOV, W / H, .5, 2000);
  scene.add(skyDome({ top: 0x020107, hor: 0x2b0c4a, glow: 0x0b3d2c }));
  const ground = gridGround({ fog: FOG, fogK: .0045, i: .55 }); scene.add(ground);
  scene.add(new THREE.HemisphereLight(0x6a3cff, 0x1bff7a, .9));
  const dl = new THREE.DirectionalLight(0xff3355, .5); dl.position.set(-1, -.4, .3); scene.add(dl);

  // --- camera path
  const ZF = TG.zs + 3.2 + FILL_D;
  const path = [[32, [0, 36, 50]], [34, [2.5, 29, 22]], [36, [-3, 26, -2]], [38, [3, 25, -26]], [40, [-2, 27, -50]], [42, [0, 36, -80]], [44, [0, TG.cy, ZF]], [48, [1.2, TG.cy + .4, ZF + 5]], [51, [-1, TG.cy - .2, ZF + 6]], [53.3, [0, TG.cy, ZF + 3]], [54, [0, TG.cy, ZF]]];
  const camAt = t => new THREE.Vector3(...track(path, t));

  // --- buildings along the avenue
  const r = rng(12); const list = []; const scr = [];
  for (let z = 70; z > -420; z -= 13 + r() * 6) {
    for (const side of [-1, 1]) {
      let x = 16 + r() * 4;
      for (let row = 0; row < 6; row++) {
        const kindR = r(); const kind = kindR < .55 ? 0 : kindR < .8 ? 1 : 2;
        const w = kind === 2 ? 12 + r() * 8 : 8 + r() * 10, d = 9 + r() * 7;
        let h = kind === 2 ? 16 + r() * 24 : (row === 0 ? 24 + r() * 48 : 18 + r() * 95);
        if (z < TG.zs + 40 && z > TG.zs - 30 && Math.abs(x) < 40) h = Math.min(h, 30);
        const bx = side * (x + w / 2);
        list.push({ x: bx, z: z - d / 2, w, d, h, kind, tint: TINTS[(r() * TINTS.length) | 0], seed: r() * 100, edge: r() < .5 ? 1 : .3 });
        if (row === 0 && kind !== 1 && r() < .75) { // screen facing the avenue
          const sw = Math.min(d * .82, 12), sh = sw * (r() < .5 ? 1.2 : .8);
          scr.push({ x: side * (x - .15), y: Math.min(h - sh / 2 - 2, 10 + r() * (h - sh - 8)), z: z - d / 2, w: sw, h: sh, ry: -side * Math.PI / 2, cell: (r() * 16) | 0, delay: r() });
        }
        if (r() < .25 && kind === 0) scr.push({ x: bx, y: h * .6, z: z + .15, w: w * .85, h: w * .85 * 1.1, ry: 0, cell: (r() * 16) | 0, delay: r() });
        x += w + 4 + r() * 8;
      }
    }
  }
  // the big plaza behind the Telegram tower
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI - Math.PI, rad = 70 + r() * 90; list.push({ x: Math.cos(a) * rad * 1.4, z: TG.zs - 40 + Math.sin(a) * rad, w: 10 + r() * 12, d: 10 + r() * 12, h: 30 + r() * 120, kind: r() < .7 ? 0 : 1, tint: TINTS[(r() * 5) | 0], seed: r() * 50, edge: 1 }); }
  const bmat = buildingMaterial({ fog: FOG, fogK: .0045 });
  scene.add(makeBuildings(list, bmat));
  const sAtlas = screenAtlas(atlas);
  const screens = makeScreens(scr, sAtlas); screens.U.uFog.value.set(FOG); screens.U.uFogK.value = .0045; scene.add(screens);

  // --- slogan gantries placed on the flight path (the camera passes under each)
  const bills = BILLS.map((b, i) => {
    const tp = E[b.key] + 2.75; const p = camAt(tp); const pr = camAt(E[b.key] + .7);
    const g = new THREE.Group(); g.position.set(pr.x, p.y + 2.6, p.z); scene.add(g);
    const tex = billboardTexture(b);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 5.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.0, 1.0, 1.0), depthWrite: false, side: THREE.DoubleSide }));
    g.add(m);
    const pyl = new THREE.MeshStandardMaterial({ color: 0x15151c, metalness: .8, roughness: .4 });
    [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.BoxGeometry(.5, p.y + 3.2, .5), pyl); c.position.set(s * 4.5, -(p.y + 3.2) / 2 + 2, -.3); g.add(c); });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(9.4, .25, .4), new THREE.MeshBasicMaterial({ color: new THREE.Color(b.col).multiplyScalar(2) })); bar.position.y = 2.9; g.add(bar);
    return { g, m, t0: E[b.key] };
  });

  // --- voxel clouds + flying messages
  scene.add(pixelClouds({ seed: 4, n: 1100, clusters: 16, y: 82, spanX: 520, spanZ: 520, z0: 60 }));
  const tokens = flyingTokens(tokenAtlas(), { n: 380, y0: 44, spanY: 80, spanX: 260, z0: 40, spanZ: 460 }); scene.add(tokens);

  // --- the Telegram tower
  const tgC = makeCanvas(1080, 1920), tgX = tgC.getContext('2d'); const tgT = canvasTex(tgC, { mip: true });
  const tower = new THREE.Group(); tower.position.set(0, 0, TG.zs); scene.add(tower);
  const metal = new THREE.MeshStandardMaterial({ color: 0x0c0c10, metalness: .9, roughness: .35 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(TG.w + 3, TG.h + 3, 5), metal); frame.position.y = TG.cy; tower.add(frame);
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(8, TG.cy - TG.h / 2, 6), metal); pillar.position.y = (TG.cy - TG.h / 2) / 2; tower.add(pillar);
  const scrMat = new THREE.MeshBasicMaterial({ map: tgT, color: new THREE.Color(1.15, 1.15, 1.15) });
  const tgScreen = new THREE.Mesh(new THREE.PlaneGeometry(TG.w, TG.h), scrMat); tgScreen.position.set(0, TG.cy, 2.6); tower.add(tgScreen);
  const edgeGlow = new THREE.Mesh(new THREE.PlaneGeometry(TG.w + 4.5, TG.h + 4.5), new THREE.MeshBasicMaterial({ map: glowTexture(128, [[0, 'rgba(57,255,136,.0)'], [.7, 'rgba(57,255,136,.0)'], [.85, 'rgba(57,255,136,.6)'], [1, 'rgba(57,255,136,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  edgeGlow.position.set(0, TG.cy, -2.6); tower.add(edgeGlow);
  const tgLight = new THREE.PointLight(0x5fd0ff, 30, 120, 1.3); tgLight.position.set(0, TG.cy, 30); tower.add(tgLight);
  ctx.tgCanvas = tgC;

  // --- holograms: avatars detaching from the screen
  let holos = null;
  function makeHolos(avs) {
    holos = avs.slice(0, 6).map((a, i) => {
      const g = new THREE.Group(); tower.add(g);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), holoMaterial(atlas, a.id)); g.add(m);
      const name = ctx.MEMBERS[a.id].name;
      let lab = null;
      if (name) { const lt = labelTexture(name); lab = new THREE.Mesh(new THREE.PlaneGeometry(lt.userData.aspect * .9, .9), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.4, 1.4, 1.4) })); g.add(lab); }
      const sx = (a.x / 1080 - .5) * TG.w, sy = TG.cy + (.5 - a.y / 1920) * TG.h;
      return { g, m, lab, sx, sy, i, td: E.ph1 + .25 + i * .45, side: i % 2 ? 1 : -1 };
    });
  }

  // ---------------------------------------------------------------- update
  let lastTg = -1;
  function update(t, ui, fx, frame) {
    bmat.U.uTime.value = t; screens.U.uTime.value = t; tokens.U.uT.value = t;
    // camera
    const p = camAt(t);
    camera.position.copy(p);
    const near = smooth(41, 44, t);
    const look = new THREE.Vector3(p.x * .3, lerp(p.y - 6, TG.cy, near), p.z - 40);
    if (near > 0) look.lerp(new THREE.Vector3(0, TG.cy, TG.zs), near);
    camera.lookAt(look);
    if (t < 42) { camera.rotation.z += Math.sin((t - 32) * .55) * .025 + wobble(t, 4, .5) * .008; camera.position.y += wobble(t, 5, .6) * .4; }
    else { camera.position.x += wobble(t, 6, .3) * .25 * smooth(44.5, 46, t) * (1 - smooth(53, 54, t)); camera.rotation.z += wobble(t, 7, .3) * .006; }
    // billboards: holographic flicker on arrival
    bills.forEach(b => { const a = smooth(b.t0 - .9, b.t0 - .2, t) * (1 - smooth(b.t0 + 1.7, b.t0 + 1.95, t)); const gl = t > b.t0 + 1.6 && t < b.t0 + 1.95 && hash(Math.floor(t * 30)) < .5 ? .2 : 1; b.m.material.opacity = a * gl * (.88 + .12 * Math.sin(t * 40)) * (hash(Math.floor(t * 20) + b.t0) < .04 ? .3 : 1); b.g.visible = a > 0; });
    // telegram screen
    if (t > 40) {
      const k = Math.floor(t * 30);
      if (k !== lastTg) {
        lastTg = k;
        const dim = smooth(E.ph1, E.ph1 + .3, t);
        const res = drawTelegram(tgX, 1080, 1920, atlas, { t, scroll: (t - 40) * 14, msgs: 9, dimAvatars: dim, holoMask: (kk) => holos && holos.find(h => h.i === kk) ? 1 : 0 });
        if (!holos) makeHolos(res.avatars);
        tgT.needsUpdate = true;
      }
    }
    const phr = smooth(E.ph1 - .2, E.ph1 + .2, t);
    scrMat.color.setScalar(lerp(1.15, .42, phr) * (t > 53.5 ? lerp(1, 1.4, smooth(53.5, 54, t)) : 1));
    if (holos) holos.forEach(h => {
      const k = smooth(h.td, h.td + 1.4, t); const out = smooth(53.3, 53.9, t);
      const z = 2.8 + eOutCubic(k) * (7 + h.i * 1.6) * (1 - out);
      const x = h.sx + h.side * eOutCubic(k) * (6.5 + (h.i % 3) * 1.6) * (1 - out);
      const y = h.sy + Math.sin(t * 1.3 + h.i) * .4 * k + (h.i % 3 === 0 ? 1 : -1) * (h.sy > TG.cy ? 1 : -1) * 0 + (h.sy > TG.cy ? 7 : -7) * eOutCubic(k) * (1 - out);
      h.g.position.set(x, y, z);
      const s = lerp(1.6, 2.6, eOutBack(k));
      h.m.scale.setScalar(s); h.g.visible = k > 0 && out < 1; h.m.material.uniforms.uT.value = t; h.m.material.uniforms.uO.value = clamp(k * 3) * (1 - out);
      if (h.lab) { h.lab.position.y = -s * .62 - .3; h.lab.scale.setScalar(lerp(.6, 1.2, k)); h.lab.material.opacity = clamp(k * 2 - .3) * (1 - out); }
      h.g.lookAt(camera.position);
    });

    fx.vign = .7; fx.grain = .05; fx.ca = .6; fx.bloomStr = 1.05; fx.threshold = .72; fx.exposure = 1.1; fx.uiBloom = .25;
    const e = t - E.city; if (e < .5) { fx.flash = .9 * (1 - e / .5); fx.flashColor = 0xeafff2; }
    phrasesUI(ui, t, fx, frame);
  }

  // ---------------------------------------------------------------- phrases over the chat (44 → 54)
  const S = (text, size, color, glow, family = F.dela, weight = 400, ls = 2) => sprite({ text, size, color, glow, glowColor: color, family, weight, ls, maxW: 980 });
  const PH = [
    { t: E.ph1, lines: [['ТЕБЯ', '#f4f6fb'], ['ЗАЕБАЛИ', '#ff1f3d'], ['СКУЧНЫЕ', '#f4f6fb'], ['ЧАТЫ?', '#f4f6fb']], size: 132 },
    { t: E.ph2, lines: [['ЗДЕСЬ', '#f4f6fb'], ['ДРУГАЯ', '#f4f6fb'], ['АТМОСФЕРА', '#39ff88']], size: 140 },
    { t: E.ph3, lines: [['НИКАКОГО', '#f4f6fb'], ['ПРИТВОРСТВА', '#ff1f3d']], size: 130 },
    { t: E.ph4, lines: [['НИКАКОГО', '#f4f6fb'], ['ВЫЛИЗАННОГО', '#f4f6fb'], ['ПИЗДЕЖА', '#ff1f3d']], size: 128 },
    { t: E.ph5, lines: [['ТОЛЬКО', '#f4f6fb'], ['ЛЮДИ,', '#39ff88'], ['МЕМЫ', '#2fb6ff'], ['И ХАОС', '#ff1f3d']], size: 140 },
  ];
  PH.forEach(p => { p.spr = p.lines.map(([s, c]) => S(s, p.size, c, c === '#f4f6fb' ? 10 : 26)); });
  function phrasesUI(ui, t, fx, frame) {
    PH.forEach((p, idx) => {
      const a = t - p.t; const dur = 2.0;
      if (a < 0 || a > dur) return;
      // dark backing for legibility
      ui.save(); ui.globalAlpha = .55 * clamp(a / .15) * clamp((dur - a) / .1);
      const g = ui.createRadialGradient(540, 960, 50, 540, 960, 760); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ui.fillStyle = g; ui.fillRect(0, 0, 1080, 1920); ui.restore();
      const n = p.spr.length, lh = p.size * 1.08;
      const outK = smooth(dur - .14, dur, a);
      p.spr.forEach((s, i) => {
        const delay = i * (idx === 4 ? .22 : .08);
        const k = clamp((a - delay) / .22);
        const y = 960 + (i - (n - 1) / 2) * lh;
        const gl = (k < 1 ? (1 - k) * .9 : 0) + outK * 1.2 + (idx === 0 && a > 1.75 ? .8 : 0);
        const sc = lerp(1.25, 1, eOutExpo(k)) * (1 + a * .015);
        putGlitch(ui, s, 540 + (idx === 4 ? (i % 2 ? 1 : -1) * (1 - eOutExpo(k)) * 200 : 0), y, gl, frame + i * 7, { alpha: clamp(k * 3) * (1 - outK) , scale: sc });
      });
      if (a < .08) { fx.ca = 2.5; }
      if (idx === 1 && a < .12) { fx.glitch = .5 * (1 - a / .12); }
    });
    // the abrupt cut between phrase 1 and 2
    if (t > E.ph2 - .25 && t < E.ph2 + .05) fx.glitch = Math.max(fx.glitch, .8);
  }

  return { scene, camera, update };
}
