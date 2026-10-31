// 78 → 86 s: the most dynamic cut — a corridor of chats, notifications, memes and avatars; questions and answers on the beat.
import * as THREE from 'three';
import { makeCanvas, canvasTex, clamp, lerp, inv, smooth, eOutCubic, eOutExpo, eInCubic, eOutBack, rng, hash, wobble, roundRect, W, H } from '../core.js';
import { F, C, sprite, put, putGlitch, letters } from '../ui.js';
import { MEMBERS, KAPUSTKA, drawSkullGlyph } from '../data.js';

function cardTextures(atlas) {
  const r = rng(9); const out = [];
  const av = (x, id, cx, cy, rad) => { x.save(); x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.clip(); x.drawImage(atlas.canvas, (id % 8) * atlas.S, (id / 8 | 0) * atlas.S, atlas.S, atlas.S, cx - rad, cy - rad, rad * 2, rad * 2); x.restore(); };
  const redacted = (x, X, Y, w, n) => { for (let l = 0; l < n; l++) { const lw = (l === n - 1 ? .5 : .9) * w; x.fillStyle = 'rgba(210,230,240,.22)'; roundRect(x, X, Y + l * 34, lw, 20, 6); x.fillRect(X, Y + l * 34, lw, 20); } };
  const named = MEMBERS.filter(m => m.name).map(m => m.id);
  for (let k = 0; k < 14; k++) {
    const c = makeCanvas(512, 512), x = c.getContext('2d'); const type = k % 7;
    x.fillStyle = '#0d141c'; roundRect(x, 6, 6, 500, 500, 34); x.fill();
    x.lineWidth = 4; x.strokeStyle = ['#39ff88', '#ff1f3d', '#7a2cff', '#2fb6ff'][k % 4]; x.stroke();
    if (type === 0) { // chat card
      for (let j = 0; j < 3; j++) { const id = named[(k * 5 + j * 11) % named.length]; av(x, id, 62, 90 + j * 140, 36); x.fillStyle = '#182533'; roundRect(x, 112, 46 + j * 140, 360, 110, 22); x.fill(); x.fillStyle = '#7fe0b0'; x.font = `700 24px "Roboto","Noto Sans KR","Noto Color Emoji"`; x.fillText(MEMBERS[id].name, 134, 80 + j * 140); redacted(x, 134, 96 + j * 140, 300, 2); }
    } else if (type === 1) { // notifications
      for (let j = 0; j < 4; j++) { const id = named[(k * 3 + j * 7) % named.length]; x.fillStyle = 'rgba(30,40,52,.95)'; roundRect(x, 30, 40 + j * 116, 452, 96, 20); x.fill(); av(x, id, 80, 88 + j * 116, 30); x.fillStyle = '#fff'; x.font = `700 24px "Roboto"`; x.fillText('SWAG_ZOV_NEFOR.exe', 124, 78 + j * 116); x.fillStyle = '#8fa3b8'; x.font = `500 21px "Roboto","Noto Sans KR","Noto Color Emoji"`; x.fillText(MEMBERS[id].name + ': ████ ██', 124, 110 + j * 116); }
    } else if (type === 2) { // meme frame (abstract image + redacted captions)
      x.fillStyle = '#000'; x.fillRect(40, 40, 432, 330);
      for (let i = 0; i < 26; i++) { x.fillStyle = `hsl(${(r() * 360) | 0},90%,${30 + r() * 30}%)`; x.fillRect(40 + r() * 400, 40 + r() * 300, 20 + r() * 120, 6 + r() * 40); }
      drawSkullGlyph(x, 256, 210, 200, '#f4f6fb');
      x.fillStyle = '#fff'; x.font = `900 46px ${F.head}`; x.textAlign = 'center'; x.fillText('МЕМ.jpg', 256, 430); x.textAlign = 'left';
    } else if (type === 3) { // reactions
      const em = ['🔥', '😂', '💀', '❤️', '👍', '🤡', '⚡', '😈', '🫡'];
      x.font = `110px "Noto Color Emoji"`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let j = 0; j < 9; j++) x.fillText(em[(j + k) % em.length], 110 + (j % 3) * 146, 110 + (j / 3 | 0) * 146);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    } else if (type === 4) { // avatar grid
      for (let j = 0; j < 16; j++) av(x, named[(j * 3 + k * 7) % named.length], 82 + (j % 4) * 116, 82 + (j / 4 | 0) * 116, 50);
    } else if (type === 5) { // voice message
      x.fillStyle = '#1f3a2a'; roundRect(x, 30, 170, 452, 170, 40); x.fill(); x.fillStyle = '#39ff88'; x.beginPath(); x.arc(110, 255, 50, 0, 7); x.fill();
      x.fillStyle = '#0d141c'; x.beginPath(); x.moveTo(95, 230); x.lineTo(130, 255); x.lineTo(95, 280); x.fill();
      for (let i = 0; i < 40; i++) { const h = 10 + Math.abs(Math.sin(i * .7 + k)) * 60 * r(); x.fillStyle = '#7dffb4'; x.fillRect(180 + i * 7, 255 - h / 2, 4, h); }
    } else { // big sticker-like emoji
      x.font = `300px "Noto Color Emoji"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(['💀', '🔥', '😂', '🤘'][k % 4], 256, 270);
    }
    out.push(canvasTex(c));
  }
  return out;
}

export async function build(ctx) {
  const { E, atlas } = ctx;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x040208, 30, 140);
  scene.background = new THREE.Color(0x040208);
  const camera = new THREE.PerspectiveCamera(58, W / H, .1, 400);
  const tex = cardTextures(atlas);
  const r = rng(4); const cards = [];
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex[i % tex.length], transparent: true, side: THREE.DoubleSide, color: new THREE.Color(1.1, 1.1, 1.1) }));
    const s = 4 + r() * 3;
    m.scale.set(s, s, 1);
    m.position.set(side * (3.2 + r() * 4.5), (r() - .5) * 13, -i * 5.2 - r() * 2);
    m.rotation.set((r() - .5) * .5, -side * (.35 + r() * .5), (r() - .5) * .4);
    m.userData = { spin: (r() - .5) * .6, bob: r() * 6 };
    scene.add(m); cards.push(m);
  }
  // light streaks
  const N = 500, pos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) { const x = (r() - .5) * 26, y = (r() - .5) * 30, z = -r() * 480, l = 2 + r() * 6; pos.set([x, y, z, x, y, z - l], i * 6); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const streakMat = new THREE.LineBasicMaterial({ color: new THREE.Color(.3, 2, .9) });
  scene.add(new THREE.LineSegments(lg, streakMat));

  const zAt = t => { // speed ramps: fast, slows for "быть собой?"
    const a = Math.min(t, E.q4) - E.montage; const b = Math.max(0, t - E.q4);
    return -(a * 34 + b * 34 * (1 - Math.min(b, 2) / 4));
  };
  const ANS = [[E.q1, E.a1, 'ХОЧЕШЬ', 'ОБЩАТЬСЯ?', 'ОБЩАЙСЯ.', '#39ff88'], [E.q2, E.a2, 'ХОЧЕШЬ', 'РЖАТЬ?', 'РЖИ.', '#ff1f3d'], [E.q3, E.a3, 'ХОЧЕШЬ', 'СПОРИТЬ?', 'СПОРЬ.', '#b24bff']];
  const tintOf = { '#39ff88': [.3, 2, .9], '#ff1f3d': [2.2, .2, .35], '#b24bff': [1.4, .4, 2.4] };
  function update(t, ui, fx, frame) {
    const z = zAt(t);
    let punch = 0, col = '#39ff88';
    ANS.forEach(([q, a, , , , c]) => { if (t >= a) { punch = Math.max(punch, Math.exp(-(t - a) * 7)); } if (t >= q) col = c; });
    if (t >= E.q4) col = '#f4f6fb';
    camera.position.set(Math.sin(t * 1.7) * 1.2, Math.cos(t * 1.3) * .8, z);
    camera.lookAt(Math.sin(t * 1.7 + .4) * 1.5, Math.cos(t * 1.3 + .3) * .8, z - 20);
    camera.rotation.z += Math.sin(t * 2.2) * .12 + punch * .1;
    camera.fov = 58 + punch * 14 - (t > E.q4 ? smooth(E.q4, E.black, t) * 8 : 0); camera.updateProjectionMatrix();
    cards.forEach(c => { c.rotation.z += 0; c.position.y += Math.sin(t * 1.5 + c.userData.bob) * .002; });
    const tc = tintOf[col] || [1.5, 1.5, 1.6]; streakMat.color.setRGB(...tc);
    const be = t > E.q4 ? smooth(E.q4, E.black - .2, t) : 0;
    fx.vign = .8; fx.grain = .06; fx.ca = .8 + punch * 3; fx.bloomStr = 1.0; fx.threshold = .7; fx.exposure = 1.1 * (1 - be * .45); fx.uiBloom = .25; fx.sat = 1 - be * .7;
    fx.glitch = punch * .35;
    // dark backing behind the type
    ui.save(); ui.globalAlpha = .75; const bgG = ui.createRadialGradient(540, 900, 60, 540, 900, 760); bgG.addColorStop(0, 'rgba(0,0,0,.9)'); bgG.addColorStop(1, 'rgba(0,0,0,0)'); ui.fillStyle = bgG; ui.fillRect(0, 0, 1080, 1920); ui.restore();
    // questions & answers
    ANS.forEach(([q, a, q1, q2, ans, c]) => {
      const d = t - q, e = t - a; const end = a + 1;
      if (d < 0 || t >= end) return;
      const outQ = e > 0 ? 1 : 0;
      const qa = clamp(d / .15) * (1 - smooth(a - .02, a + .12, t) * .65);
      const qy = e > 0 ? 520 : 860;
      put(ui, sprite({ text: q1, size: 70, family: F.head, weight: 800, color: '#f4f6fb', ls: 10, glow: 8, glowColor: 'rgba(255,255,255,.5)' }), 540, qy - 70, { alpha: qa, scale: lerp(1.15, 1, eOutExpo(clamp(d / .25))) });
      put(ui, sprite({ text: q2, size: 112, family: F.head, weight: 900, color: '#f4f6fb', ls: 4, glow: 10, glowColor: 'rgba(255,255,255,.5)', maxW: 980 }), 540, qy + 40, { alpha: qa, scale: lerp(1.15, 1, eOutExpo(clamp(d / .25))) });
      if (e > 0) {
        const k = clamp(e / .1);
        const s = sprite({ text: ans, size: 230, family: F.dela, weight: 400, color: c, glow: 34, glowColor: c, maxW: 1000 });
        putGlitch(ui, s, 540, 1050, e < .2 ? (1 - e / .2) : 0, frame, { alpha: k * (1 - smooth(end - .1, end, t)), scale: lerp(1.6, 1, eOutExpo(clamp(e / .22))) * (1 + e * .05) });
        if (e < .1) { fx.flash = .35 * (1 - e / .1); fx.flashColor = new THREE.Color(c).getHex(); }
      }
    });
    // 84 → 86: the question that matters
    const d = t - E.q4;
    if (d >= 0) {
      letters(ui, 'ХОЧЕШЬ', 540, 820, { size: 80, family: F.head, weight: 800, color: '#f4f6fb', ls: 12, glow: 8, glowColor: 'rgba(255,255,255,.5)' }, clamp(d / .5), { rise: 30, alpha: 1 - smooth(E.black - .12, E.black, t) });
      letters(ui, 'БЫТЬ СОБОЙ?', 540, 960, { size: 96, family: F.head, weight: 900, color: '#f4f6fb', ls: 4, glow: 12, glowColor: 'rgba(255,255,255,.55)' }, clamp((d - .25) / .7), { rise: 40, alpha: 1 - smooth(E.black - .12, E.black, t) });
    }
  }
  return { scene, camera, update };
}
