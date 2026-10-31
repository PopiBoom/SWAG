// 100 → 114 s: the night megapolis under a red moon; "ПОМНИ О СМЕРТИ"; a sentence scratched into the glass;
// the camera rises — the whole city is a skull, its eyes ignite.
import * as THREE from 'three';
import { makeCanvas, canvasTex, glowTexture, smokeTexture, clamp, lerp, inv, smooth, smoother, eOutCubic, eInOutCubic, eInOutSine, eOutExpo, rng, hash, wobble, track, W, H } from '../core.js';
import { F, C, sprite, put, putGlitch, letters } from '../ui.js';
import { buildingMaterial, makeBuildings, screenAtlas, makeScreens, skyDome, gridGround, tokenAtlas, flyingTokens } from '../citylib.js';
import { MEMBERS } from '../data.js';

// front-view skull mask, 300×400 px → world (x = (px-150)*S, z = (py-200)*S)
export const SKM = { S: 1.1, eyeL: [117, 205], eyeR: [183, 205] };
function skullMask() {
  const c = makeCanvas(300, 400), x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff';
  x.beginPath(); x.ellipse(150, 150, 122, 136, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(150, 228, 118, 58, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(78, 236); x.lineTo(222, 236); x.lineTo(206, 330); x.lineTo(178, 372); x.lineTo(122, 372); x.lineTo(94, 330); x.closePath(); x.fill();
  x.globalCompositeOperation = 'destination-out';
  x.beginPath(); x.ellipse(SKM.eyeL[0], SKM.eyeL[1], 33, 30, -.15, 0, Math.PI * 2); x.ellipse(SKM.eyeR[0], SKM.eyeR[1], 33, 30, .15, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(150, 238); x.quadraticCurveTo(128, 275, 136, 292); x.lineTo(164, 292); x.quadraticCurveTo(172, 275, 150, 238); x.fill();
  x.fillRect(96, 321, 108, 5);
  for (let i = 0; i < 8; i++) x.fillRect(101 + i * 14, 304, 3, 46);
  x.fillRect(40, 60, 3, 0); // (sutures could go here)
  const d = x.getImageData(0, 0, 300, 400).data;
  return (px, py) => { px |= 0; py |= 0; if (px < 0 || py < 0 || px >= 300 || py >= 400) return 0; return d[(py * 300 + px) * 4 + 3] / 255; };
}

function moonTexture() {
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d'); const r = rng(6);
  const g = x.createRadialGradient(S * .45, S * .42, S * .05, S / 2, S / 2, S * .48); g.addColorStop(0, '#ff6a5a'); g.addColorStop(.7, '#c0121e'); g.addColorStop(1, '#5a0008');
  x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S * .48, 0, 7); x.fill();
  x.save(); x.beginPath(); x.arc(S / 2, S / 2, S * .48, 0, 7); x.clip();
  for (let i = 0; i < 90; i++) { const px = r() * S, py = r() * S, rr = 4 + r() * 38; x.fillStyle = `rgba(60,0,6,${.1 + r() * .25})`; x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); x.strokeStyle = `rgba(255,140,120,${r() * .15})`; x.lineWidth = 2; x.stroke(); }
  x.restore();
  return canvasTex(c);
}
function silhouetteTexture() {
  const c = makeCanvas(128, 256), x = c.getContext('2d');
  const body = () => { x.beginPath(); x.arc(64, 34, 20, 0, 7); x.fill(); x.beginPath(); x.moveTo(36, 70); x.quadraticCurveTo(64, 56, 92, 70); x.lineTo(98, 150); x.lineTo(84, 152); x.lineTo(82, 250); x.lineTo(68, 250); x.lineTo(64, 170); x.lineTo(60, 250); x.lineTo(46, 250); x.lineTo(44, 152); x.lineTo(30, 150); x.closePath(); x.fill(); };
  x.fillStyle = 'rgba(255,40,70,1)'; x.save(); x.translate(3, -2); body(); x.restore();
  x.fillStyle = 'rgba(60,140,255,1)'; x.save(); x.translate(-3, -2); body(); x.restore();
  x.fillStyle = '#020204'; body();
  return canvasTex(c);
}

export async function build(ctx) {
  const { E, atlas } = ctx;
  const scene = new THREE.Scene();
  const FOG = 0x12030a;
  const camera = new THREE.PerspectiveCamera(50, W / H, .5, 4000);
  scene.add(skyDome({ top: 0x050106, hor: 0x3a0610, glow: 0x2a0306 }));
  const ground = gridGround({ col: 0xff2244, fog: FOG, fogK: .0026, i: .18 }); scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xff3355, 0x100018, .5));
  const mask = skullMask();
  const S = SKM.S, R = rng(100);
  const list = [], scr = [], roofs = [];
  for (let gz = -230; gz <= 260; gz += 10) for (let gx = -200; gx <= 200; gx += 10) {
    if (Math.abs(gx) < 9) continue; // the central avenue
    const px = gx / S + 150, py = gz / S + 200; const m = mask(px, py);
    const w = 7 + R() * 1.6, d = 7 + R() * 1.6;
    if (m > .5) {
      const h = 16 + R() * 34 + (py < 200 ? 10 : 0);
      const kind = R() < .7 ? 0 : R() < .5 ? 1 : 2;
      list.push({ x: gx, z: gz, w, d, h, kind, tint: [[.9, .95, 1.1], [.15, .55, 1.6], [1.4, .1, .2], [.16, .67, .93]][(R() * 4) | 0], seed: R() * 99, edge: .6, lit: 1 });
      if (Math.abs(gx) < 20 && R() < .5) scr.push({ x: Math.sign(gx) * (Math.abs(gx) - w / 2 - .15), y: 6 + R() * (h - 14), z: gz, w: d * .8, h: d * .8 * 1.2, ry: -Math.sign(gx) * Math.PI / 2, cell: [1, 5, 11, 9][(R() * 4) | 0], delay: R() });
      if (R() < .12) roofs.push(new THREE.Vector3(gx, h + 2.5, gz));
    } else if (R() < .35 && mask(px, py) < .1) {
      list.push({ x: gx, z: gz, w: w * .8, d: d * .8, h: 2 + R() * 5, kind: 0, tint: [.3, .05, .08], seed: R() * 99, edge: 0, lit: .08 });
    }
  }
  const bmat = buildingMaterial({ fog: FOG, fogK: .0026, night: 1, roof: .55 });
  scene.add(makeBuildings(list, bmat));
  const screens = makeScreens(scr, screenAtlas(atlas)); screens.U.uFog.value.set(FOG); screens.U.uFogK.value = .0026; screens.U.uBright.value = 1.3; scene.add(screens);
  // avatars glowing on the roofs (seen from above)
  const gTex = glowTexture(64);
  const roofAv = roofs.slice(0, 44).map((p, i) => {
    const id = (i * 7 + 2) % 63; const t = atlas.tex.clone(); t.needsUpdate = true; const [u, v, du, dv] = atlas.uv(id); t.offset.set(u, v); t.repeat.set(du, dv);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, color: new THREE.Color(1.2, 1.2, 1.2) })); s.position.copy(p); s.scale.setScalar(6.5); scene.add(s);
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(.3, 1.4, .7) })); g.position.copy(p); g.scale.setScalar(13); scene.add(g);
    return { s, g };
  });
  // eye pools (green)
  const eyeMat = new THREE.MeshBasicMaterial({ map: gTex, color: new THREE.Color(.3, 3.2, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const eyes = [SKM.eyeL, SKM.eyeR].map(([px, py]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(95, 90), eyeMat); m.rotation.x = -Math.PI / 2; m.position.set((px - 150) * S, 1, (py - 200) * S); scene.add(m); return m; });
  const eyeLights = eyes.map(e => { const l = new THREE.PointLight(0x39ff88, 0, 180, 1.2); l.position.copy(e.position).add(new THREE.Vector3(0, 20, 0)); scene.add(l); return l; });
  // red moon
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), color: new THREE.Color(1.5, 1.2, 1.2), fog: false })); moon.position.set(-40, 330, -1300); moon.scale.setScalar(300); scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(.9, .05, .1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); moonGlow.position.copy(moon.position).add(new THREE.Vector3(0, 0, -5)); moonGlow.scale.setScalar(900); scene.add(moonGlow);
  // walking silhouettes
  const silT = silhouetteTexture(); const people = [];
  for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: silT, transparent: true, depthWrite: true, alphaTest: .3 })); const side = i % 2 ? 1 : -1; s.scale.set(2.2, 4.4, 1); s.center.set(.5, 0); s.userData = { x: side * (3.5 + R() * 3), z0: 120 + R() * 140, v: (R() < .5 ? -1 : 1) * (1.1 + R() * .6), ph: R() * 6 }; scene.add(s); people.push(s); }
  // messages still appearing over the night city
  const tokens = flyingTokens(tokenAtlas(), { n: 160, y0: 14, spanY: 50, spanX: 120, z0: 260, spanZ: 260, seed: 21 }); tokens.U.uO.value = .7; scene.add(tokens);

  const P = [[100, [0, 8, 245]], [104, [0, 8, 205]], [108, [0, 10, 165]], [110, [0, 20, 140]], [112, [0, 260, 150]], [114, [0, 640, 107]]];
  function update(t, ui, fx, frame) {
    bmat.U.uTime.value = t; screens.U.uTime.value = t; tokens.U.uT.value = t;
    const p = new THREE.Vector3(...track(P, t));
    camera.position.copy(p);
    const up = smooth(110, 113.6, t);
    camera.up.set(0, 1, 0).lerp(new THREE.Vector3(0, 0, -1), smooth(110.5, 113, t)).normalize();
    const look = new THREE.Vector3(0, lerp(26, 0, up), lerp(p.z - 120, 107, up));
    camera.lookAt(look);
    camera.rotation.z += (1 - up) * Math.sin(t * .4) * .02 + up * (1 - up) * .5 * Math.sin(Math.PI * up);
    camera.position.x += wobble(t, 3, .3) * (1 - up) * .4;
    people.forEach(s => { const u = s.userData; const z = u.z0 + u.v * (t - 100); s.position.set(u.x, Math.abs(Math.sin((t + u.ph) * 4)) * .08, z); });
    const eon = smooth(E.city_eyes, E.city_eyes + .35, t);
    eyeMat.opacity = eon * (.9 + .1 * Math.sin(t * 30)); eyes.forEach(e => e.visible = eon > 0); eyeLights.forEach(l => l.intensity = eon * 400);
    roofAv.forEach(a => { a.s.material.opacity = smooth(110.5, 112.5, t); a.g.material.opacity = smooth(110.5, 112.5, t) * .6; });
    fx.vign = .8; fx.grain = .06; fx.ca = .5; fx.bloomStr = 1.0; fx.threshold = .62; fx.exposure = 1.15; fx.uiBloom = .2;
    fx.tint = [1.04, .96, .98];
    const s = t - E.night; if (s < .5) { fx.flash = .7 * (1 - s / .5); fx.flashColor = 0xff1f3d; }
    if (t > E.skull_match - .35) { fx.flash = smooth(E.skull_match - .35, E.skull_match, t) * .75; fx.flashColor = 0x39ff88; }
    if (t > E.scratch - .1 && t < E.dissolve + .4) { fx.scan = .05; fx.curv = .06; }
    nightUI(ui, t, fx, frame);
  }

  // ---------------- UI
  const mm = sprite({ text: 'MEMENTO MORI', size: 120, family: F.head, weight: 900, metal: true, glow: 18, glowColor: 'rgba(255,30,60,.45)', damage: 1, seed: 31, ls: 4, maxW: 980 });
  const pom = sprite({ text: 'ПОМНИ О СМЕРТИ', size: 60, family: F.head, weight: 700, color: '#f4f6fb', ls: 16, glow: 10, glowColor: 'rgba(255,255,255,.5)', maxW: 960 });
  // scratched sentence
  function scratchSprite(text, size, col) {
    const m = makeCanvas(8, 8).getContext('2d'); m.font = `900 ${size}px ${F.head}`; m.letterSpacing = '6px';
    const tw = m.measureText(text).width, pad = 40; const c = makeCanvas(Math.ceil(tw + pad * 2), Math.ceil(size * 1.5)), x = c.getContext('2d', { willReadFrequently: true });
    x.font = m.font; x.letterSpacing = '6px'; x.textBaseline = 'middle';
    const r = rng(size); x.lineJoin = 'round';
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillText(text, pad, c.height / 2);
    for (let k = 0; k < 7; k++) { x.strokeStyle = k < 2 ? col : `rgba(255,255,255,${.35 + r() * .4})`; x.lineWidth = 1 + r() * 2.2; x.strokeText(text, pad + (r() - .5) * 5, c.height / 2 + (r() - .5) * 5); }
    x.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 220; k++) { x.fillRect(r() * c.width, r() * c.height, 1 + r() * 10, 1 + r() * 2); }
    x.globalCompositeOperation = 'source-over';
    // per-character extents
    const xs = []; let acc = pad; [...text].forEach(ch => { const w = m.measureText(ch).width; xs.push([acc, w, ch]); acc += w; });
    const d = x.getImageData(0, 0, c.width, c.height).data; const pts = [];
    for (let j = 0; j < c.height; j += 3) for (let i = 0; i < c.width; i += 3) if (d[(j * c.width + i) * 4 + 3] > 140) pts.push([i, j, r(), r()]);
    return { c, w: c.width, h: c.height, xs, pts };
  }
  const SC = [scratchSprite('НО ПОКА ТЫ ЖИВ —', 92, '#ffffff'), scratchSprite('ЖИВИ ОХУЕННО', 124, '#ff2a44')];
  const fitS = SC.map(s => Math.min(1, 1000 / s.w));
  const SY = [860, 1030];
  function backing(ui, y, a, k) { if (a <= 0) return; ui.save(); ui.globalAlpha = a * .8; const g = ui.createLinearGradient(0, y - 300, 0, y + 300); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.3, 'rgba(4,0,2,.85)'); g.addColorStop(.7, 'rgba(4,0,2,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ui.fillStyle = g; ui.fillRect(0, y - 300, 1080, 600); ui.restore(); }
  function nightUI(ui, t, fx, frame) {
    const a = t - E.mm_night, out = smooth(105.4, 105.9, t);
    if (a > 0 && out < 1) {
      backing(ui, 600, 1 - out, a);
      putGlitch(ui, mm, 540, 560, a < .3 ? 1 - a / .3 : 0, frame, { alpha: clamp(a / .1) * (1 - out), scale: lerp(1.3, 1, eOutExpo(clamp(a / .35))) });
      letters(ui, 'ПОМНИ О СМЕРТИ', 540, 700, { size: 60, family: F.head, weight: 700, color: '#f4f6fb', ls: 16, glow: 10, glowColor: 'rgba(255,255,255,.5)' }, clamp((a - .5) / 1.0), { rise: 20, alpha: 1 - out });
    }
    // scratched in, letter by letter (in sync with the scratch strokes of the soundtrack)
    let idx = 0; const t0 = E.scratch + .12, dt = .11;
    const diss = smooth(E.dissolve, E.dissolve + .25, t);
    if (t > E.scratch - .2 && t < E.dissolve + 1.4) backing(ui, 945, smooth(E.scratch - .2, E.scratch + .2, t) * (1 - smooth(E.dissolve + .6, E.dissolve + 1.4, t)), 1);
    SC.forEach((s, li) => {
      const sc = fitS[li]; const X0 = 540 - s.w * sc / 2, Y0 = SY[li] - s.h * sc / 2;
      ui.save(); ui.translate(X0, Y0); ui.scale(sc, sc);
      let reveal = 0; let head = null; let prevDone = false;
      s.xs.forEach(([x0, w, ch]) => { if (ch === ' ') { if (prevDone) reveal = x0 + w; return; } const p = clamp((t - (t0 + idx * dt)) / .12); prevDone = p >= 1; if (p > 0) { reveal = x0 + w * p; if (p < 1) head = [x0 + w * p, s.h / 2]; } idx++; });
      if (reveal > 0 && diss < 1) {
        ui.globalAlpha = 1 - diss; ui.beginPath(); ui.rect(0, 0, reveal, s.h); ui.clip(); ui.drawImage(s.c, 0, 0);
      }
      ui.restore();
      if (head && diss < 1) { // sparks at the scratching point
        for (let k = 0; k < 8; k++) { const hx = X0 + head[0] * sc + (hash(frame * 3 + k) - .5) * 30, hy = Y0 + (head[1] + (hash(frame * 7 + k) - .5) * s.h * .8) * sc; ui.fillStyle = k % 2 ? '#ffffff' : '#7dffb4'; ui.shadowColor = '#7dffb4'; ui.shadowBlur = 10; ui.fillRect(hx, hy, 3, 3); }
        ui.shadowBlur = 0;
      }
      // dissolve into particles
      const dt2 = t - E.dissolve;
      if (dt2 > 0 && dt2 < 1.6) {
        ui.save(); ui.fillStyle = li ? '#ff5a6e' : '#f4f6fb';
        for (const [px, py, r1, r2] of s.pts) {
          const k = clamp((dt2 - r1 * .35) / 1.2); if (k <= 0) { continue; }
          const x = X0 + px * sc + (r2 - .3) * 260 * k + Math.sin(dt2 * 5 + r1 * 20) * 12 * k, y = Y0 + py * sc - 300 * k * k * (0.4 + r2);
          ui.globalAlpha = (1 - k) * .9; ui.fillRect(x, y, 3, 3);
        }
        ui.restore();
      }
    });
  }
  return { scene, camera, update };
}
