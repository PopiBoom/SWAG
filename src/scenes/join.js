// 122 → 131.6 s: the real group interface, "ПРИСОЕДИНИТЬСЯ", the old window MEMENTO_MORI.exe,
// "ТЫ УЖЕ ОДИН ИЗ НАС", CRT power-off.
import * as THREE from 'three';
import { makeCanvas, canvasTex, glowTexture, clamp, lerp, inv, smooth, eOutCubic, eOutExpo, eOutBack, eInCubic, eInOutCubic, rng, hash, wobble, W, H } from '../core.js';
import { F, C, sprite, put, putGlitch, letters, drawTelegram } from '../ui.js';

export async function build(ctx) {
  const { E, TL, atlas } = ctx;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020203);
  const camera = new THREE.PerspectiveCamera(50, W / H, .1, 500);
  const tgC = makeCanvas(1080, 1920), tgX = tgC.getContext('2d'); const tgT = canvasTex(tgC);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(9, 16), new THREE.MeshBasicMaterial({ map: tgT, color: new THREE.Color(1.05, 1.05, 1.05) }));
  scene.add(panel);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(13, 20), new THREE.MeshBasicMaterial({ map: glowTexture(128, [[0, 'rgba(57,255,136,.35)'], [.6, 'rgba(57,255,136,.08)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.z = -.5; scene.add(glow);
  const r = rng(122); const N = 900, dp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) dp.set([(r() - .5) * 40, (r() - .5) * 60, -r() * 40 + 15], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: .06, map: glowTexture(32), color: new THREE.Color(.4, 1.6, .9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);
  const FILL = 8 / Math.tan(THREE.MathUtils.degToRad(25));
  const BTN = { x: 540, y: 1920 - 141 + 56 }; // centre of the join button in panel pixels

  let last = -1;
  function update(t, ui, fx, frame) {
    const a = t - E.join_ui;
    const k = eInOutCubic(clamp(a / 2.0));
    camera.position.set(lerp(-2.5, 0, k) + wobble(t, 1, .3) * .1, lerp(-1.2, -.4, k), lerp(FILL + 9, FILL + .2, k));
    camera.lookAt(0, lerp(-.6, -.4, k), 0);
    panel.rotation.y = lerp(.22, 0, k); glow.rotation.y = panel.rotation.y;
    dust.rotation.y = t * .02;
    const press = clamp((t - E.join_click) / .25);
    const fr = Math.floor(t * 30);
    if (fr !== last && t < E.exe) {
      last = fr;
      drawTelegram(tgX, 1080, 1920, atlas, { t, join: true, joinState: press, msgs: 8, scroll: 30 + a * 10 });
      if (t > E.join_click) { // tap ripple
        const rp = clamp((t - E.join_click) / .45);
        tgX.save(); tgX.globalAlpha = (1 - rp) * .8; tgX.strokeStyle = '#ffffff'; tgX.lineWidth = 8; tgX.beginPath(); tgX.arc(BTN.x, BTN.y, 30 + rp * 320, 0, 7); tgX.stroke();
        tgX.globalAlpha = (1 - rp) * .35; tgX.fillStyle = '#ffffff'; tgX.beginPath(); tgX.arc(BTN.x, BTN.y, 30 + rp * 200, 0, 7); tgX.fill(); tgX.restore();
      }
      tgT.needsUpdate = true;
    }
    panel.visible = glow.visible = t < E.exe;
    fx.vign = .7; fx.grain = .05; fx.ca = .5; fx.bloomStr = .9; fx.threshold = .75; fx.exposure = 1.1; fx.uiBloom = .2;
    if (a < .4) { fx.flash = .5 * (1 - a / .4); fx.flashColor = 0x39ff88; }
    // a hint of a hand cursor gliding to the button
    if (t > E.join_click - .9 && t < E.exe) {
      const v = new THREE.Vector3((BTN.x / 1080 - .5) * 9, (.5 - BTN.y / 1920) * 16, 0).project(camera);
      const bx = (v.x * .5 + .5) * 1080, by = (-v.y * .5 + .5) * 1920;
      const m = eOutCubic(clamp((t - (E.join_click - .9)) / .8));
      const cx = lerp(bx + 260, bx, m), cy = lerp(by + 320, by + 10, m);
      const s = 1 - Math.sin(Math.PI * press) * .15;
      ui.save(); ui.translate(cx, cy); ui.scale(s, s); ui.fillStyle = '#fff'; ui.strokeStyle = '#000'; ui.lineWidth = 4;
      ui.beginPath(); ui.moveTo(0, 0); ui.lineTo(0, 64); ui.lineTo(16, 50); ui.lineTo(28, 76); ui.lineTo(38, 71); ui.lineTo(26, 46); ui.lineTo(46, 46); ui.closePath(); ui.fill(); ui.stroke(); ui.restore();
    }
    // the transformation into an old window
    if (t > E.exe - .08 && t < E.exe + .18) fx.glitch = .9;
    if (t >= E.exe) exeUI(ui, t, fx, frame);
    // CRT power-off
    if (t >= E.crt_off) { fx.crtOff = clamp((t - E.crt_off) / .42); fx.scan = .1; if (t > E.crt_off + .45) fx.fade = 1; }
  }

  const one = [sprite({ text: 'ТЫ УЖЕ', size: 104, family: F.head, weight: 900, color: '#f4f6fb', ls: 6, glow: 14, glowColor: 'rgba(255,255,255,.55)' }),
    sprite({ text: 'ОДИН ИЗ НАС', size: 132, family: F.head, weight: 900, color: '#ff2a44', ls: 4, glow: 30, glowColor: 'rgba(255,30,60,.9)', maxW: 1000 })];
  function exeUI(ui, t, fx, frame) {
    const a = t - E.exe;
    const pop = eOutBack(clamp(a / .2));
    const lift = eInOutCubic(clamp((t - E.one_of_us + .2) / .5));
    const w = 940, h = 500, cx = 540, cy = lerp(880, 690, lift);
    ui.save(); ui.translate(cx, cy); ui.scale(lerp(.6, 1, pop), lerp(.2, 1, pop)); ui.translate(-w / 2, -h / 2);
    ui.fillStyle = 'rgba(0,0,0,.55)'; ui.fillRect(14, 16, w, h);
    ui.fillStyle = '#c3c6cc'; ui.fillRect(0, 0, w, h);
    ui.fillStyle = '#fff'; ui.fillRect(0, 0, w, 4); ui.fillRect(0, 0, 4, h); ui.fillStyle = '#4a4d55'; ui.fillRect(0, h - 4, w, 4); ui.fillRect(w - 4, 0, 4, h);
    const g = ui.createLinearGradient(8, 0, w - 8, 0); g.addColorStop(0, '#0d1a6e'); g.addColorStop(1, '#3b8ad6'); ui.fillStyle = g; ui.fillRect(8, 8, w - 16, 60);
    ui.fillStyle = '#fff'; ui.font = `800 32px ${F.mono}`; ui.textBaseline = 'middle'; ui.fillText('MEMENTO_MORI.exe', 26, 39);
    ['_', '□', '×'].forEach((s, i) => { const bx = w - 150 + i * 46; ui.fillStyle = '#c3c6cc'; ui.fillRect(bx, 16, 40, 40); ui.fillStyle = '#fff'; ui.fillRect(bx, 16, 40, 3); ui.fillStyle = '#000'; ui.font = `800 28px ${F.mono}`; ui.textAlign = 'center'; ui.fillText(s, bx + 20, 37); ui.textAlign = 'left'; });
    ui.fillStyle = '#030504'; ui.fillRect(24, 88, w - 48, h - 112);
    ui.fillStyle = 'rgba(57,255,136,.05)'; for (let y = 88; y < h - 24; y += 4) ui.fillRect(24, y, w - 48, 2);
    const cols = ['#39ff88', '#ff2a44', '#f4f6fb'];
    let cur = null;
    TL.exeLines.forEach((line, i) => {
      const st = TL.exeLineStarts[i]; const n = clamp(Math.floor((t - st) / E.exe_dt) + 1, 0, line.length);
      if (t < st) return;
      const y = 170 + i * 92;
      ui.font = `800 ${i === 2 ? 40 : 48}px ${F.mono}`; ui.fillStyle = cols[i]; ui.shadowColor = cols[i]; ui.shadowBlur = 14;
      ui.fillText('> ' + line.slice(0, n), 52, y); cur = [52 + ui.measureText('> ' + line.slice(0, n)).width + 8, y];
    });
    ui.shadowBlur = 0;
    if (cur && Math.floor(t * 2) % 2 === 0) { ui.fillStyle = '#39ff88'; ui.fillRect(cur[0], cur[1] - 24, 24, 46); }
    ui.restore();
    if (a < .2) fx.ca = 3;
    // ТЫ УЖЕ ОДИН ИЗ НАС
    const b = t - E.one_of_us;
    if (b > 0) {
      const k1 = clamp(b / .2), k2 = clamp((b - .3) / .22);
      put(ui, one[0], 540, 1180, { alpha: k1, scale: lerp(1.3, 1, eOutExpo(k1)) });
      putGlitch(ui, one[1], 540, 1340, k2 < 1 ? 1 - k2 : (hash(Math.floor(frame / 3)) < .05 ? .25 : 0), frame, { alpha: k2, scale: lerp(1.5, 1, eOutExpo(k2)) * (1 + b * .01) });
      if (b > .3 && b < .45) { fx.flash = .3 * (1 - (b - .3) / .15); fx.flashColor = 0xff2a44; }
    }
  }
  return { scene, camera, update };
}
