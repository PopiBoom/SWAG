// 88 → 100 s: the drop — a billion neon particles, a vortex of avatars around the logo, monitors igniting,
// buildings crumbling into code, message streams, and the loudest lines of the trailer.
import * as THREE from 'three';
import { makeCanvas, canvasTex, glowTexture, clamp, lerp, inv, smooth, eOutCubic, eOutExpo, eInCubic, eOutBack, rng, hash, wobble, W, H } from '../core.js';
import { F, C, sprite, put, putGlitch, arc, letters } from '../ui.js';
import { buildingMaterial, makeBuildings, TINTS, screenAtlas, makeScreens, tokenAtlas, skyDome } from '../citylib.js';

function glyphAtlas() {
  const S = 128, c = makeCanvas(S * 4, S * 4), x = c.getContext('2d');
  const g = ['0', '1', '#', '@', '$', '%', '&', '<', '>', '/', '\\', '{', '}', 'Ж', 'Я', '☠'];
  x.font = `800 96px ${F.mono}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
  g.forEach((ch, i) => x.fillText(ch, (i % 4) * S + S / 2, Math.floor(i / 4) * S + S / 2 + 6));
  return canvasTex(c, { srgb: false });
}

export async function build(ctx) {
  const { E, atlas } = ctx;
  const kicks = (ctx.kicks || []).filter(k => k >= E.drop - .01 && k < E.night);
  const scene = new THREE.Scene();
  scene.add(skyDome({ top: 0x030108, hor: 0x1d0833, glow: 0x061f18 }));
  const camera = new THREE.PerspectiveCamera(55, W / H, .1, 3000);
  const R = rng(88);
  const PX = (H / 1920).toFixed(4);

  // ---- explosion particles (two bursts)
  const BN = 7000, bp = new Float32Array(BN * 3), ba = new Float32Array(BN * 4);
  for (let i = 0; i < BN; i++) { const v = new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize(); bp.set([v.x, v.y, v.z], i * 3); ba.set([R(), R(), R() < .78 ? 0 : 1, R()], i * 4); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.setAttribute('aA', new THREE.BufferAttribute(ba, 4));
  const burstU = { uT: { value: 0 }, uT2: { value: -1 } };
  const burst = new THREE.Points(bg, new THREE.ShaderMaterial({ uniforms: burstU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aA; uniform float uT, uT2; varying vec3 vC; varying float vA;
      void main(){ float t = aA.z > .5 ? uT2 : uT; if (t < 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
        float sp = mix(40., 120., pow(aA.x, 1.5)); float k = 1.4; float d = sp * (1. - exp(-k * t)) / k;
        vec3 p = position * d + vec3(sin(t * 2. + aA.y * 20.), cos(t * 1.7 + aA.w * 20.), sin(t * 1.3 + aA.x * 9.)) * t * 1.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.5 + aA.w * 3.) * ${PX} * 90. / max(-mv.z, 1.), 1., 9.);
        float h = aA.y; vC = h < .45 ? vec3(.05, 1.8, .5) : h < .75 ? vec3(1.1, .05, 2.4) : vec3(2.2, .05, .25);
        vA = (1. - smoothstep(1., 4.5, t)) * (.3 + .2 * sin(t * 30. * aA.w + aA.x * 50.)) * smoothstep(.0, .12, t) * smoothstep(3., 9., d); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vC * vA * smoothstep(.5, .0, d), 1.); }` }));
  burst.frustumCulled = false; scene.add(burst);

  // ---- vortex of avatars (instanced points sampling the avatar atlas)
  const VN = 900, vp = new Float32Array(VN * 3), va = new Float32Array(VN * 4);
  for (let i = 0; i < VN; i++) { const rad = 7 + Math.pow(R(), .8) * 30; vp.set([rad, (R() - .5) * (4 + rad * .5), R() * Math.PI * 2], i * 3); va.set([i % 63, R(), .6 + R() * 1.2, R()], i * 4); }
  const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.BufferAttribute(vp, 3)); vg.setAttribute('aA', new THREE.BufferAttribute(va, 4));
  const vU = { uT: { value: 0 }, uMap: { value: atlas.tex }, uO: { value: 0 }, uR: { value: 1 } };
  const vortex = new THREE.Points(vg, new THREE.ShaderMaterial({ uniforms: vU, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 aA; uniform float uT, uR; varying float vCell; varying float vB;
      void main(){ float rad = position.x * uR; float a = position.z + uT * (2.2 / sqrt(position.x)) * 1.6;
        vec3 p = vec3(cos(a) * rad, position.y + sin(a * 2. + aA.y * 6.) * .8, sin(a) * rad);
        p.xy = mat2(cos(.35), -sin(.35), sin(.35), cos(.35)) * p.xy;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = aA.z * ${PX} * 470. / max(-mv.z, 1.); vCell = aA.x; vB = .7 + .5 * aA.w; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uO; varying float vCell; varying float vB;
      void main(){ vec2 uv = (gl_PointCoord * vec2(1., -1.) + vec2(0., 1.) + vec2(mod(vCell, 8.), 7. - floor(vCell / 8.))) / 8.; vec4 c = texture2D(uMap, uv);
        if (c.a < .1) discard; gl_FragColor = vec4(pow(c.rgb, vec3(2.2)) * vB * .8, c.a * uO * .85); }` }));
  vortex.frustumCulled = false; scene.add(vortex);

  // ---- ring of old monitors lighting up one by one
  const blackT = canvasTex(makeCanvas(4, 4));
  const monMat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: .5, metalness: .4 });
  const MN = 44, mons = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 4, 4), monMat, MN); mons.frustumCulled = false; scene.add(mons);
  const monScr = []; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < MN; i++) {
    const a = (i / MN) * Math.PI * 2, rad = 46 + (i % 2) * 6, y = -8 + (i % 3) * 8;
    const pos = new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad); const ry = Math.atan2(-pos.x, -pos.z);
    q.setFromEuler(new THREE.Euler(0, ry, 0)); m4.compose(pos, q, new THREE.Vector3(1, 1, 1)); mons.setMatrixAt(i, m4);
    monScr.push({ x: pos.x + Math.sin(ry) * 2.05, y, z: pos.z + Math.cos(ry) * 2.05, w: 4.2, h: 3.2, ry, cell: i % 16, delay: ((i * 7) % MN) / MN });
  }
  const screens = makeScreens(monScr, blackT, screenAtlas(atlas, true)); screens.U.uFogK.value = 0; scene.add(screens);
  const screens2 = makeScreens(monScr, blackT, screenAtlas(atlas)); screens2.U.uFogK.value = 0; scene.add(screens2);
  scene.add(new THREE.HemisphereLight(0x8a4cff, 0x1bff7a, 1.2));

  // ---- buildings crumbling into glyph particles
  const GN = 30000, gp = new Float32Array(GN * 3), ga = new Float32Array(GN * 4); let gi = 0;
  for (let b = 0; b < 30 && gi < GN; b++) {
    const a = (b / 30) * Math.PI * 2 + R() * .1, rad = 90 + R() * 70, w = 8 + R() * 10, h = 30 + R() * 90;
    const cx = Math.cos(a) * rad, cz = Math.sin(a) * rad;
    for (let y = 0; y < h && gi < GN; y += 1.6) for (let s = -w / 2; s < w / 2 && gi < GN; s += 1.6) {
      const face = R() < .5; const px = cx + (face ? s : (R() < .5 ? -w / 2 : w / 2)), pz = cz + (face ? (R() < .5 ? -w / 2 : w / 2) : s);
      gp.set([px, y - 40, pz], gi * 3); ga.set([(R() * 16) | 0, y / h, R(), b % 5], gi * 4); gi++;
    }
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp.slice(0, gi * 3), 3)); gg.setAttribute('aA', new THREE.BufferAttribute(ga.slice(0, gi * 4), 4));
  const gU = { uT: { value: 0 }, uMap: { value: glyphAtlas() } };
  const glyphs = new THREE.Points(gg, new THREE.ShaderMaterial({ uniforms: gU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aA; uniform float uT; varying float vCell; varying vec3 vC; varying float vA;
      void main(){ float st = 1. + (1. - aA.y) * 6. + aA.z * 2.; float t = max(uT - st, 0.);
        vec3 p = position + vec3(sin(aA.z * 30.) * t * 3., t * t * 1.8 + t * 2., cos(aA.z * 40.) * t * 3.);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = ${PX} * 1500. / max(-mv.z, 1.); vCell = aA.x;
        int k = int(aA.w); vC = (k == 0 || k == 4 ? vec3(.1, 1.1, .45) : k == 1 ? vec3(1.3, .08, .2) : k == 2 ? vec3(.7, .15, 1.4) : vec3(.15, .55, 1.5)) * .7;
        vA = (1. - smoothstep(0., 3., t)) * (.55 + .45 * step(.5, fract(aA.z * 13. + uT * 2.))); }`,
    fragmentShader: `uniform sampler2D uMap; varying float vCell; varying vec3 vC; varying float vA;
      void main(){ vec2 uv = (gl_PointCoord * vec2(1., -1.) + vec2(0., 1.) + vec2(mod(vCell, 4.), 3. - floor(vCell / 4.))) / 4.; float a = texture2D(uMap, uv).r; gl_FragColor = vec4(vC * a * vA, 1.); }` }));
  glyphs.frustumCulled = false; scene.add(glyphs);

  // ---- message streams on spirals
  const TN = 900, tp = new Float32Array(TN * 3), ta = new Float32Array(TN * 4);
  for (let i = 0; i < TN; i++) { const s = i % 6; tp.set([s * Math.PI / 3, (R() - .5) * 90, 18 + R() * 20], i * 3); ta.set([8 + ((R() * 8) | 0), R(), .5 + R(), R() < .5 ? 1 : -1], i * 4); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setAttribute('aA', new THREE.BufferAttribute(ta, 4));
  const tU = { uT: { value: 0 }, uMap: { value: tokenAtlas() }, uO: { value: 0 } };
  const streams = new THREE.Points(tg, new THREE.ShaderMaterial({ uniforms: tU, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 aA; uniform float uT; varying float vCell;
      void main(){ float y = mod(position.y + uT * 9. * aA.w + 45., 90.) - 45.; float a = position.x + y * .09 * aA.w + uT * .4;
        vec3 p = vec3(cos(a) * position.z, y, sin(a) * position.z);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aA.z * ${PX} * 1300. / max(-mv.z, 1.); vCell = aA.x; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uO; varying float vCell;
      void main(){ vec2 uv = (gl_PointCoord * vec2(1., -1.) + vec2(0., 1.) + vec2(mod(vCell, 4.), 3. - floor(vCell / 4.))) / 4.; vec4 c = texture2D(uMap, uv); if (c.a < .05) discard; gl_FragColor = vec4(pow(c.rgb, vec3(2.2)) * 1.4, c.a * uO); }` }));
  streams.frustumCulled = false; scene.add(streams);

  // core glow behind the logo
  const gTex = glowTexture(128);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(1.4, .15, .3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); core.scale.setScalar(26); scene.add(core);
  const core2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(.15, 1.2, .5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); core2.scale.setScalar(14); scene.add(core2);

  const kickEnv = t => { let v = 0; for (const k of kicks) { if (k > t) break; v = Math.max(v, Math.exp(-(t - k) * 9)); } return v; };

  function update(t, ui, fx, frame) {
    const s = t - E.drop;
    burstU.uT.value = s; burstU.uT2.value = t - E.alive;
    vU.uT.value = s; vU.uO.value = smooth(0, .5, s); vU.uR.value = lerp(.2, 1, eOutExpo(clamp(s / 1.2)));
    gU.uT.value = s; tU.uT.value = s; tU.uO.value = smooth(.6, 1.6, s);
    screens.U.uSwitch.value = lerp(-.05, 1.1, inv(.2, 7, s)); screens.U.uTime.value = t;
    screens2.U.uSwitch.value = lerp(-.05, 1.1, inv(.2, 7, s)); screens2.visible = false;
    const kk = kickEnv(t);
    core.material.opacity = .45 + kk * .4; core2.material.opacity = .4 + kk * .3; core.scale.setScalar(24 + kk * 6);
    // camera orbit with punches
    const a = s * .42 + .3, rad = lerp(34, 26, smooth(0, 10, s));
    camera.position.set(Math.sin(a) * rad, 4 + Math.sin(s * .7) * 5, Math.cos(a) * rad);
    camera.lookAt(0, 0, 0);
    camera.rotation.z += Math.sin(s * .9) * .1 + (hash(frame) - .5) * .02 * kk;
    camera.fov = 55 - kk * 7 + (s < .6 ? (1 - s / .6) * 25 : 0); camera.updateProjectionMatrix();

    fx.vign = .7; fx.grain = .06; fx.ca = .8 + kk * 2.2; fx.bloomStr = 1.1; fx.threshold = .6; fx.exposure = 1.1; fx.uiBloom = .25;
    if (s < .5) { fx.flash = .8 * Math.exp(-s * 9); fx.flashColor = s < .1 ? 0xffffff : 0xb24bff; fx.glitch = .6 * (1 - s / .5); }
    if (t > E.alive && t < E.alive + .3) { fx.flash = Math.max(fx.flash, .4 * (1 - (t - E.alive) / .3)); fx.flashColor = 0x39ff88; }
    if (t > 95.5 && t < 96) fx.glitch = .5; if (t > 91.75 && t < 92) fx.glitch = .45;
    if (t > E.night - .12) { fx.flash = (t - (E.night - .12)) / .12 * .8; fx.flashColor = 0xff1f3d; }
    dropUI(ui, t, fx, frame, kk);
  }

  const logo = sprite({ lines: ['MEMENTO', 'MORI'], size: 168, family: F.head, weight: 900, metal: true, glow: 14, glowColor: 'rgba(255,40,80,.35)', damage: 1, seed: 13, lh: 1.0, ls: 4, maxW: 960 });
  const alive = [['ЗДЕСЬ', '#f4f6fb', 150], ['ПИЗДЕЦ', '#7dff2f', 196], ['КАК ЖИВО', '#f4f6fb', 150]].map(([s, c, z]) => sprite({ text: s, size: z, family: F.dela, color: c, glow: c === '#f4f6fb' ? 12 : 36, glowColor: c, ls: 2, maxW: 1000 }));
  const yours = [['ТВОЙ ЧАТ', '#f4f6fb', 120], ['ТВОИ ЛЮДИ', '#39ff88', 120], ['ТВОЙ ЕБАНУТЫЙ', '#ff1f3d', 110], ['ИНТЕРНЕТ', '#ff1f3d', 150]].map(([s, c, z]) => sprite({ text: s, size: z, family: F.head, weight: 900, color: c, glow: c === '#f4f6fb' ? 12 : 30, glowColor: c, ls: 4, maxW: 1000 }));
  function dropUI(ui, t, fx, frame, kk) {
    const s = t - E.drop;
    // dark centre backing so type always reads over the chaos
    const back = smooth(E.alive - .2, E.alive, t) * .3 + .65;
    ui.save(); ui.globalAlpha = back; const g = ui.createRadialGradient(540, 960, 80, 540, 960, 820); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ui.fillStyle = g; ui.fillRect(0, 0, 1080, 1920); ui.restore();
    // logo: slams in with the drop, then steps back behind the lines
    const la = clamp(s / .08) * lerp(1, .0, smooth(E.alive - .3, E.alive, t));
    if (la > 0) {
      const sc = lerp(1.7, 1, eOutExpo(clamp(s / .35))) * (1 + kk * .05);
      putGlitch(ui, logo, 540, 960, s < .3 ? 1 - s / .3 : (hash(Math.floor(frame / 2)) < .06 ? .4 : 0), Math.floor(frame / 2), { alpha: la, scale: sc });
      const fr = Math.floor(frame / 3);
      for (let k = 0; k < 3; k++) { const sd = fr * 17 + k * 71; if (hash(sd) < .3) continue; const x1 = 540 + (hash(sd + 1) - .5) * logo.tw, x2 = x1 + (hash(sd + 2) - .5) * 360; arc(ui, x1, 960 - logo.th * .45, x2, 960 + (hash(sd + 3) - .5) * logo.th, sd, { color: k % 2 ? '#7dffb4' : '#ff5468', width: 2.4, glow: 16, alpha: la * .9 }); }
    }
    // ЗДЕСЬ ПИЗДЕЦ КАК ЖИВО
    const b = t - E.alive, bout = smooth(95.4, 95.75, t);
    if (b > 0 && bout < 1) alive.forEach((sp, i) => {
      const k = clamp((b - i * .18) / .16); const y = [770, 960, 1150][i];
      putGlitch(ui, sp, 540, y, (k < 1 ? 1 - k : 0) + bout + (i === 1 ? kk * .25 : 0), frame + i * 5, { alpha: clamp(k * 3) * (1 - bout), scale: lerp(1.5, 1, eOutExpo(k)) * (1 + (i === 1 ? kk * .06 : 0)) });
    });
    // ТВОЙ ЧАТ / ТВОИ ЛЮДИ / ТВОЙ ЕБАНУТЫЙ ИНТЕРНЕТ
    const starts = [E.your1, E.your2, E.your3, E.your3 + .22]; const ys = [700, 860, 1040, 1180];
    const fin = smooth(E.night - .15, E.night, t);
    yours.forEach((sp, i) => {
      const c = t - starts[i]; if (c < 0) return; const k = clamp(c / .14);
      putGlitch(ui, sp, 540, ys[i], (k < 1 ? 1 - k : 0) + fin, frame + i * 3, { alpha: clamp(k * 3) * (1 - fin * .5), scale: lerp(1.45, 1, eOutExpo(k)) * (1 + kk * .03) });
    });
  }
  return { scene, camera, update };
}
