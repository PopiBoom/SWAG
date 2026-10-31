// 0 → 18 s: darkness, cursor, CRT terminal, multiplying system windows, freeze, the question.
import * as THREE from 'three';
import { makeCanvas, canvasTex, glowTexture, clamp, lerp, inv, smooth, smoother, eOutCubic, eOutBack, eInOutCubic, rng, hash, wobble, track, W, H } from '../core.js';
import { F, C, sprite, put, sysWindow } from '../ui.js';

export const WIN_MSGS = ['БУДЬ НОРМАЛЬНЫМ', 'НЕ МАТЕРИСЬ', 'НЕ СПОРЬ', 'ВЕДИ СЕБЯ ПРИЛИЧНО'];

export function windowSpec(i) {
  const r = rng(i * 7919 + 13);
  if (i < 4) { // the four commands arrive first, large and readable, stacked down the frame
    const msg = WIN_MSGS[i];
    return { x: 540 + (i % 2 ? 46 : -46), y: 520 + i * 270, w: 760, h: 250, msg, scale: 1.18, theme: 'gray', icon: i === 2 ? 'warn' : 'x' };
  }
  const group = Math.floor(i / 9), k = i % 9, gr = rng(group * 31 + 7);
  // cascades: each group starts somewhere and steps diagonally (like a dragged, frozen window)
  const early = i < 10;
  const sx = early ? lerp(200, 880, gr()) : lerp(-60, 1140, gr());
  const sy = early ? lerp(700, 1220, gr()) : lerp(120, 1800, gr());
  const dir = gr() < .5 ? 1 : -1;
  const step = 22 + gr() * 26;
  const msg = WIN_MSGS[(i + group) % 4];
  const w = msg.length > 12 ? 700 : 560;
  return {
    x: sx + dir * k * step, y: sy + k * step * 1.1, w, h: 250, msg,
    scale: early ? 1 : lerp(.62, 1.08, r()), theme: r() < .12 ? 'black' : 'gray', icon: r() < .7 ? 'x' : 'warn',
  };
}

export function drawWindow(ctx, i, sc = 1, alpha = 1) {
  const s = windowSpec(i);
  sysWindow(ctx, s.x, s.y, s.w, s.h, 'WORLD.exe', s.msg, {
    scale: s.scale * sc, alpha, theme: s.theme, icon: s.icon,
    msgColor: s.theme === 'black' ? '#ff4d63' : '#0b0b0f', msgSize: s.msg.length > 14 ? 40 : 46,
  });
}

// Settled windows are accumulated into a cache canvas (deterministic for any seek order).
class WindowStack {
  constructor() { this.c = makeCanvas(W, H); this.x = this.c.getContext('2d'); this.n = 0; }
  upTo(n) {
    if (n < this.n) { this.x.clearRect(0, 0, W, H); this.n = 0; }
    for (; this.n < n; this.n++) drawWindow(this.x, this.n);
  }
}

export function dialog(ctx, x, y, s = 1, alpha = 1) {
  sysWindow(ctx, x, y, 700, 290, 'SYSTEM', 'А НАХУЙ НАДО?', {
    scale: s, alpha, theme: 'black', icon: null, msgColor: '#ff2a44', msgFont: F.dela, msgSize: 66, btn: null,
  });
}

export async function build(ctx) {
  const { E, TL } = ctx;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.06);
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 100);

  // --- CRT monitor
  const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: .55, metalness: .15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: .7, metalness: .1 });
  const mon = new THREE.Group(); scene.add(mon);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.62, 1.1), plastic); body.position.z = -.62; mon.add(body);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.15, 0.9), dark); back.position.z = -1.5; mon.add(back);
  const frameParts = [[1.9, .2, 0, .71], [1.9, .26, 0, -.68], [.24, 1.62, -.83, 0], [.24, 1.62, .83, 0]];
  frameParts.forEach(([w, h, x, y]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .14), plastic); m.position.set(x, y, -.02); mon.add(m); });
  // inner bevel (slanted ring around the glass)
  const bevel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.18, .08), dark); bevel.position.z = -.06; mon.add(bevel);
  // power LED + badge
  const led = new THREE.Mesh(new THREE.BoxGeometry(.05, .025, .02), new THREE.MeshBasicMaterial({ color: new THREE.Color(.2, 2.5, .8) })); led.position.set(.68, -.72, .06); mon.add(led);
  // screen
  const scrC = makeCanvas(1024, 768), scrX = scrC.getContext('2d'); const scrT = canvasTex(scrC);
  const sg = new THREE.PlaneGeometry(1.42, 1.07, 32, 24);
  const pa = sg.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) / .71, y = pa.getY(i) / .535; pa.setZ(i, .045 * (1 - .5 * x * x - .5 * y * y)); }
  sg.computeVertexNormals();
  const scrM = new THREE.MeshBasicMaterial({ map: scrT, color: new THREE.Color(1, 1, 1) });
  const screen = new THREE.Mesh(sg, scrM); screen.position.z = -.04; mon.add(screen);
  // desk + keyboard
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: .75, metalness: .1 }));
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, -.81, 0); scene.add(desk);
  const kb = new THREE.Group(); scene.add(kb); kb.position.set(0, -.78, 1.05); kb.rotation.x = .08;
  kb.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, .06, .55), plastic));
  const keyG = new THREE.BoxGeometry(.09, .04, .09); const keys = new THREE.InstancedMesh(keyG, new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: .6 }), 15 * 5);
  const dm = new THREE.Object3D(); let ki = 0;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 15; i++) { dm.position.set(-.7 + i * .1, .045, -.2 + j * .1); dm.updateMatrix(); keys.setMatrixAt(ki++, dm.matrix); }
  kb.add(keys);
  // light from the screen + cold rim
  const scrLight = new THREE.PointLight(0x39ff88, 0, 6, 1.6); scrLight.position.set(0, 0, .9); scene.add(scrLight);
  const rim = new THREE.DirectionalLight(0x2f5dff, .0); rim.position.set(-3, 2, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x10131a, .25));
  // dust in the air (foreground depth)
  const N = 500, dpos = new Float32Array(N * 3), r = rng(5);
  for (let i = 0; i < N; i++) { dpos[i * 3] = (r() - .5) * 6; dpos[i * 3 + 1] = (r() - .5) * 4; dpos[i * 3 + 2] = r() * 12 - 1; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: .025, map: glowTexture(64), transparent: true, depthWrite: false, opacity: .5, color: 0x6fffb0, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  const stack = new WindowStack();
  // exact snapshot of the frozen UI at the moment of impact (texture for the 3D shards)
  ctx.getFrozen = () => {
    if (ctx._frozen) return ctx._frozen;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    drawUI(g, E.impact - 1e-4, {}, new WindowStack());
    return (ctx._frozen = c);
  };

  // terminal screen content
  function drawScreen(t) {
    const x = scrX, w = 1024, h = 768;
    const on = smooth(E.terminal_on, E.terminal_on + .9, t);
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    if (on > 0) { // phosphor warm-up: a line opening vertically
      const open = smoother(E.terminal_on, E.terminal_on + .45, t);
      const g = x.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * .7);
      g.addColorStop(0, `rgba(10,60,30,${.55 * on})`); g.addColorStop(1, `rgba(0,12,6,${.8 * on})`);
      x.save(); x.beginPath(); x.rect(0, h / 2 - h / 2 * open - 2, w, h * open + 4); x.clip(); x.fillStyle = g; x.fillRect(0, 0, w, h); x.restore();
    }
    x.font = `700 44px ${F.mono}`; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.shadowColor = '#39ff88'; x.shadowBlur = 16; x.fillStyle = '#7dffb4';
    const L1 = '> ', y1 = 300, y2 = 380, x0 = 96;
    const n1 = TL.keys.filter((k, i) => i < TL.type1.length && k <= t).length;
    const n2 = TL.keys.filter((k, i) => i >= TL.type1.length && i < TL.type1.length + [...TL.type2].length && k <= t).length;
    let cx = x0, cy = y1;
    if (t >= E.terminal_on + .5 || n1 > 0) {
      const s1 = L1 + TL.type1.slice(0, n1); x.fillText(s1, x0, y1); cx = x0 + x.measureText(s1).width; cy = y1;
    } else { cx = x0; cy = y1; }
    if (n2 > 0) {
      const s2 = [...TL.type2].slice(0, n2).join(''); x.fillText(s2, x0, y2); cx = x0 + x.measureText(s2).width; cy = y2;
      const done = TL.keys[TL.type1.length + [...TL.type2].length - 1];
      if (t > done + .1) { // progress bar
        const p = clamp((t - done - .1) / (E.error - done - .25));
        x.strokeStyle = '#7dffb4'; x.lineWidth = 3; x.strokeRect(x0, 450, 820, 44);
        x.fillRect(x0 + 8, 458, 804 * eOutCubic(p) * .93, 28);
        cx = -100;
      }
    }
    // cursor (blinks on the beat)
    const blink = (Math.floor(t * 2) % 2 === 0) || (t > E.type1 - .1 && t < E.error);
    if (t >= E.cursor_on && blink && cx > 0 && t < E.error) { x.fillRect(cx + 6, cy - 24, 26, 48); }
    x.shadowBlur = 0;
    if (t >= E.error) { // error: screen floods red-white then the UI windows take over
      const e = 1 - smooth(E.error, E.error + .4, t);
      x.fillStyle = `rgba(255,40,60,${.6 * e + .15})`; x.fillRect(0, 0, w, h);
    }
    // scanlines
    x.fillStyle = 'rgba(0,0,0,.28)'; for (let j = 0; j < h; j += 4) x.fillRect(0, j, w, 2);
    scrT.needsUpdate = true;
  }

  const camKeys = [[0, [0.25, .35, 14]], [2, [0.2, .3, 12.5]], [4, [0.1, .2, 8.4]], [6, [0.03, .1, 4.9]], [8, [0, .04, 3.35]], [11, [0, .0, 2.3]], [15.5, [0, 0, 1.6]], [18, [0, 0, 1.5]]];


  const grayCache = new WeakMap();
  function grayOf(stack) {
    let g = grayCache.get(stack); if (g && g.n === stack.n) return g.c;
    const c = makeCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(stack.c, 0, 0);
    const im = x.getImageData(0, 0, W, H), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const l = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; const k = .12; d[i] = l + (d[i] - l) * k; d[i + 1] = l + (d[i + 1] - l) * k; d[i + 2] = l + (d[i + 2] - l) * k; }
    x.putImageData(im, 0, 0); grayCache.set(stack, { c, n: stack.n }); return c;
  }
  function drawUI(ui, t, fx, stack) {
    if (t >= E.error) {
      const ws = TL.windows; let n = 0; while (n < ws.length && ws[n] <= Math.min(t, E.freeze)) n++;
      const settled = t >= E.freeze ? n : Math.max(0, n - 3);
      stack.upTo(settled);
      const sat = t >= E.freeze ? 1 - smooth(E.freeze, E.freeze + .25, t) * .88 : 1;
      ui.save();
      // overall slow push-in (the frozen frame keeps creeping toward the viewer)
      const z = 1 + (t > E.freeze ? (t - E.freeze) * .018 : 0);
      ui.translate(540, 960); ui.scale(z, z); ui.translate(-540, -960);
      // freeze: crossfade to a desaturated copy, then darken (no ctx.filter — it breaks clearing in headless Chromium)
      if (sat < 1) {
        const g = grayOf(stack);
        ui.globalAlpha = 1; ui.drawImage(stack.c, 0, 0);
        ui.globalAlpha = clamp((1 - sat) / .88); ui.drawImage(g, 0, 0); ui.globalAlpha = 1;
        const dk = 1 - lerp(1, .38, smooth(E.freeze, E.dialog, t));
        if (dk > 0) { ui.fillStyle = `rgba(0,0,0,${dk})`; ui.fillRect(-200, -200, W + 400, H + 400); }
      } else ui.drawImage(stack.c, 0, 0);
      for (let i = settled; i < n; i++) { // popping windows
        const a = clamp((t - ws[i]) / .09); drawWindow(ui, i, lerp(.86, 1, eOutBack(a)), clamp(a * 3));
      }
      ui.restore();
      fx.glitch = t < E.freeze ? (t < E.error + .35 ? .6 : smooth(E.error + 3, E.freeze, t) * .22) + (hash(Math.floor(t * 30)) < .05 ? .25 : 0) : 0;
      fx.flash = t < E.error + .15 ? .35 * (1 - (t - E.error) / .15) : 0; fx.flashColor = 0xff2040;
      if (t >= E.freeze) { fx.grain = .09; fx.ca = .2; }
    }
    // ---- the question
    if (t >= E.dialog) {
      const a = clamp((t - E.dialog) / .12);
      const z = 1 + (t - E.freeze) * .018;
      ui.save(); ui.translate(540, 960); ui.scale(z, z); ui.translate(-540, -960);
      dialog(ui, 540, 900, lerp(.9, 1, eOutBack(a)) * (1 + (t - E.dialog) * .02), a);
      ui.restore();
      // tiny tremor right before the strike
      if (t > E.impact - .25) fx.glitch = (t - (E.impact - .25)) * 1.2;
    }
  }

  function update(t, ui, fx) {
    drawScreen(t);
    const on = smooth(E.terminal_on, E.terminal_on + .9, t);
    const tc = t < E.freeze ? t : E.freeze + (t - E.freeze) * 0.12; // camera nearly stops in the freeze
    const p = track(camKeys, tc);
    const shake = t > E.error && t < E.freeze ? smooth(E.error, E.freeze, t) * .02 : 0;
    camera.position.set(p[0] + wobble(t, 1, .4) * .03 + wobble(t, 9, 7) * shake, p[1] + wobble(t, 2, .4) * .02 + wobble(t, 8, 7) * shake, p[2]);
    camera.lookAt(0, -.02, -.1);
    camera.rotation.z += wobble(t, 3, .25) * .02;
    scrLight.intensity = on * 1.6 + (t > E.error ? 2 : 0);
    scrLight.color.set(t > E.error && t < E.error + .4 ? 0xff3355 : 0x39ff88);
    rim.intensity = .25 * on;
    led.visible = t > E.terminal_on;
    dust.position.z = -t * .05;
    fx.scan = .06; fx.vign = .75; fx.grain = .06; fx.ca = .5; fx.threshold = .45; fx.bloomStr = 1.1; fx.uiBloom = .15;
    fx.exposure = 1.2;

    drawUI(ui, t, fx, stack);
    if (t < 1.2) fx.fade = 1 - smooth(0.2, 1.2, t) * 1;
  }
  return { scene, camera, update };
}
