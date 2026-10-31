// 18 → 30 s: impact, shards, the code-and-metal skull, title, dive into the eye.
// 114 → 122 s: the same skull returns for the final logo.
import * as THREE from 'three';
import { makeCanvas, canvasTex, glowTexture, smokeTexture, clamp, lerp, inv, smooth, smoother, eOutCubic, eInCubic, eOutExpo, eInExpo, eInOutCubic, eOutBack, rng, hash, wobble, track, W, H, Q } from '../core.js';
import { F, C, sprite, put, putGlitch, arc, letters, decoded } from '../ui.js';

// Skull model placement (model: Khronos glTF-Sample-Assets "ScatteringSkull", CC0)
export const SKULL = { yaw0: 0, eyeL: new THREE.Vector3(-0.30, 0.30, 0.78), eyeR: new THREE.Vector3(0.30, 0.30, 0.78), mouth: new THREE.Vector3(0, -0.5, 0.95) };

export function glyphTexture(seed = 3) {
  const S = 1024, c = makeCanvas(S, S), x = c.getContext('2d'); const r = rng(seed);
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  // G: blurry noise mask
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) { const px = r() * S, py = r() * S, rr = 30 + r() * 160; const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(0,${(90 + r() * 165) | 0},0,1)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  // B: panel seams
  x.strokeStyle = 'rgb(0,0,255)'; x.lineWidth = 3;
  for (let i = 0; i < 70; i++) { x.strokeRect((r() * 16 | 0) * 64, (r() * 16 | 0) * 64, (1 + r() * 4 | 0) * 64, (1 + r() * 3 | 0) * 64); }
  // R: code glyphs
  const chars = '01#$%&{}<>;=+*/\\|ABCDEFЖЯФ01010110MEMENTOMORI';
  x.font = `700 26px ${F.mono}`; x.textBaseline = 'top';
  for (let j = 0; j < 36; j++) for (let i = 0; i < 48; i++) {
    if (r() < .35) continue; const v = (60 + r() * 195) | 0; x.fillStyle = `rgb(${v},0,0)`;
    x.fillText(chars[(r() * chars.length) | 0], i * 21.3, j * 28.4);
  }
  x.globalCompositeOperation = 'source-over';
  const t = canvasTex(c, { srgb: false, repeat: true }); return t;
}

export function cyberEnv(renderer) {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x020204);
  const add = (col, w, h, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  add(new THREE.Color(3.5, .15, .3), 2, 14, -8, 0, -2);   // red strip left
  add(new THREE.Color(.2, .9, 3.2), 2, 14, 8, 1, -3);     // blue strip right
  add(new THREE.Color(1.2, .5, 3), 14, 1.5, 0, 9, 0);     // violet top
  add(new THREE.Color(.3, 2.5, .9), 10, 1, 0, -8, 3);     // green floor bounce
  add(new THREE.Color(1.6, 1.7, 2), 4, 4, -3, 4, 8);      // soft key (front)
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.02); return rt.texture;
}

export function makeSkullMesh(ctx, glyph) {
  const src = ctx.gltf.scene.getObjectByProperty('isMesh', true);
  const geo = src.geometry.clone();
  geo.applyMatrix4(src.matrixWorld);
  geo.computeBoundingBox(); const bb = geo.boundingBox; const c = bb.getCenter(new THREE.Vector3()); const sz = bb.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z); geo.scale(2 / sz.y, 2 / sz.y, 2 / sz.y);
  geo.rotateY(SKULL.yaw0);
  geo.computeBoundingBox();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d96a8, metalness: 1, roughness: .3, envMapIntensity: 1.1 });
  const U = { uGlyph: { value: glyph }, uTime: { value: 0 }, uCode: { value: 0 }, uScan: { value: -5 }, uSeam: { value: .6 }, uCodeCol: { value: new THREE.Color(.25, 1.6, .7) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP; varying vec3 vLN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLP = position; vLN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLP; varying vec3 vLN; uniform sampler2D uGlyph; uniform float uTime, uCode, uScan, uSeam; uniform vec3 uCodeCol;
      vec3 tri(vec2 a, vec2 b, vec2 c, vec3 w){ return texture2D(uGlyph, a).rgb * w.x + texture2D(uGlyph, b).rgb * w.y + texture2D(uGlyph, c).rgb * w.z; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 w = pow(abs(vLN), vec3(4.)); w /= (w.x + w.y + w.z);
        vec2 sc = vec2(0., -uTime * .06);
        vec3 g = tri(vLP.zy * 1.3 + sc, vLP.xz * 1.3 + sc, vLP.xy * 1.3 + sc, w);
        vec3 m = tri(vLP.zy * .35 + vec2(uTime * .015, 0.), vLP.xz * .35, vLP.xy * .35 + vec2(0., uTime * .01), w);
        float mask = smoothstep(.35, .75, m.g);
        float band = exp(-pow((vLP.y - uScan) * 5., 2.));
        float code = g.r * (mask * uCode + band * 2.5);
        totalEmissiveRadiance += uCodeCol * code + vec3(.4, 1.5, .8) * band * .35;
        totalEmissiveRadiance += vec3(.5, .1, 1.2) * g.b * uSeam * .25;
        diffuseColor.rgb *= 1. - g.b * .55;
      }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, U, size: geo.boundingBox.getSize(new THREE.Vector3()), box: geo.boundingBox };
}

export async function build(ctx) {
  const { E, renderer } = ctx;
  const scene = new THREE.Scene();
  scene.environment = cyberEnv(renderer);
  scene.fog = new THREE.FogExp2(0x030208, 0.035);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.02, 200);
  const glyph = glyphTexture();
  const sk = makeSkullMesh(ctx, glyph);
  const pivot = new THREE.Group(); scene.add(pivot); pivot.add(sk.mesh);

  // eyes: green lights + layered glows
  const gTex = glowTexture(128);
  const eyeMat = new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(.25, 1.9, .7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const coreMat = new THREE.SpriteMaterial({ map: gTex, color: new THREE.Color(1.2, 3.2, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, depthTest: false });
  const eyes = [SKULL.eyeL, SKULL.eyeR].map(p => {
    const g = new THREE.Group(); g.position.copy(p); pivot.add(g);
    const s1 = new THREE.Sprite(eyeMat); s1.scale.setScalar(.34); g.add(s1);
    const s2 = new THREE.Sprite(coreMat); s2.scale.setScalar(.07); s2.position.z = -.05; g.add(s2);
    const l = new THREE.PointLight(0x39ff88, 0, 3.5, 1.5); l.position.z = .15; g.add(l);
    return { g, s1, s2, l };
  });

  // neon wires: hanging cables + orbiting halo rings
  const wires = new THREE.Group(); pivot.add(wires);
  const wr = rng(11);
  const wireCols = [new THREE.Color(1.6, .06, .16), new THREE.Color(.7, .12, 1.7), new THREE.Color(.1, .6, 1.6), new THREE.Color(.12, 1.4, .45)];
  for (let i = 0; i < 6; i++) {
    const sx = (wr() - .5) * 1.0, sz = (wr() - .5) * 1.4 - .3;
    const pts = [new THREE.Vector3(sx, -.78 + Math.abs(sz) * .1, sz), new THREE.Vector3(sx * 1.4, -1.6, sz + (wr() - .5)), new THREE.Vector3(sx * 2.4 + (wr() - .5) * 2, -3.6, sz - 1 - wr() * 2), new THREE.Vector3(sx * 4 + (wr() - .5) * 4, -9, sz - 4 - wr() * 4)];
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, .012 + wr() * .018, 6), new THREE.MeshBasicMaterial({ color: wireCols[i % 4] }));
    wires.add(tube);
  }
  for (let i = 0; i < 4; i++) { // temple sockets → cables going back into the dark
    const side = i % 2 ? 1 : -1;
    const pts = [new THREE.Vector3(side * .78, .25 - i * .12, -.1), new THREE.Vector3(side * 1.3, .4 - i * .2, -.9), new THREE.Vector3(side * 2.4, .2 + i * .3, -3.2), new THREE.Vector3(side * 5, -1 + i, -8)];
    wires.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, .016, 6), new THREE.MeshBasicMaterial({ color: wireCols[(i + 1) % 4] })));
  }
  const halos = []; const pivotHalo = new THREE.Group(); scene.add(pivotHalo);
  for (let i = 0; i < 2; i++) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(1.05 + i * .32, .007, 6, 200), new THREE.MeshBasicMaterial({ color: i ? new THREE.Color(3, .2, .4) : new THREE.Color(.3, 2.8, 1.2) }));
    h.position.y = 1.25 + i * .12; pivotHalo.add(h); halos.push(h);
  }

  // lights
  const key = new THREE.SpotLight(0xdde6ff, 0, 20, .5, .8, 1.2); key.position.set(-2, 4, 5); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  const rimR = new THREE.PointLight(0xff1f3d, 0, 12, 1.3); rimR.position.set(-3, .8, -2.5); scene.add(rimR);
  const rimB = new THREE.PointLight(0x2f7dff, 0, 12, 1.3); rimB.position.set(3.2, 1.2, -2); scene.add(rimB);
  const under = new THREE.PointLight(0x7a2cff, 0, 8, 1.5); under.position.set(0, -2.4, 1.5); scene.add(under);

  // background: volumetric haze sprites + data rain
  const smk = smokeTexture(256, 4);
  const haze = [];
  const hr = rng(21);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.SpriteMaterial({ map: smk, color: [0x3b1166, 0x10204a, 0x2a0610][i % 3], transparent: true, opacity: .0, depthWrite: false });
    const s = new THREE.Sprite(m); s.position.set((hr() - .5) * 16, (hr() - .5) * 12, -5 - hr() * 12); s.scale.setScalar(8 + hr() * 10); s.userData = { o: .25 + hr() * .3, rot: (hr() - .5) * .1 };
    scene.add(s); haze.push(s);
  }
  const rainN = 1600, rp = new Float32Array(rainN * 3), rs = new Float32Array(rainN);
  for (let i = 0; i < rainN; i++) { rp[i * 3] = (hr() - .5) * 26; rp[i * 3 + 1] = (hr() - .5) * 30; rp[i * 3 + 2] = -3 - hr() * 22; rs[i] = hr(); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setAttribute('aS', new THREE.BufferAttribute(rs, 1));
  const rainU = { uT: { value: 0 }, uO: { value: 0 }, uPx: { value: H / 960 } };
  const rain = new THREE.Points(rg, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aS; uniform float uT, uPx; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y - uT * (0.6 + aS * 1.4) + 15., 30.) - 15.;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = (1.5 + aS * 2.) * uPx * (10. / -mv.z); vA = .25 + .75 * step(.85, fract(aS * 37. + floor(uT * 6. * aS)));}`,
    fragmentShader: `uniform float uO; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; if (abs(c.x) > .2) discard; gl_FragColor = vec4(vec3(.2, 1.4, .6) * vA * uO, 1.); }`,
  }));
  scene.add(rain);

  // digital smoke from the mouth
  const SN = 200, sa = new Float32Array(SN * 4), sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sa.set([hr(), hr(), hr(), hr()], i * 4); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aSeed', new THREE.BufferAttribute(sa, 4));
  const smokeU = { uT: { value: 0 }, uO: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, 1) }, uTex: { value: smk }, uPx: { value: H / 1920 } };
  const smoke = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: smokeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aSeed; uniform float uT, uPx; uniform vec3 uOrigin, uDir; varying float vA; varying float vK; varying float vSq;
      void main(){ float life = 3.2; float b = aSeed.x * life; float age = mod(uT - b, life); float k = age / life;
        float alive = step(b, uT);
        vec3 side = normalize(cross(uDir, vec3(0., 1., 0.)));
        vec3 p = uOrigin + uDir * (age * .75 + age * age * .05) + side * (aSeed.y - .5) * age * .9 + vec3(0., 1., 0.) * ((aSeed.z - .35) * age * .55 + age * age * .06)
               + vec3(sin(age * 2.3 + aSeed.w * 6.28), cos(age * 1.7 + aSeed.y * 6.28), 0.) * .12 * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        vSq = step(.82, aSeed.w);
        gl_PointSize = mix(26. + k * 130., 4. + k * 5., vSq) * uPx * (8. / -mv.z);
        vA = alive * smoothstep(0., .08, k) * (1. - k) * (1. - k); vK = k; }`,
    fragmentShader: `uniform float uO; uniform sampler2D uTex; varying float vA; varying float vK; varying float vSq;
      void main(){ vec3 col;
        if (vSq > .5) { col = vec3(.2, 1.4, .6) * (1. - vK); gl_FragColor = vec4(col * vA * uO, 1.); return; }
        float s = texture2D(uTex, gl_PointCoord).a; col = mix(vec3(.12, .6, .3), vec3(.12, .14, .2), vK) * s * .5;
        gl_FragColor = vec4(col * vA * uO, 1.); }`,
  }));
  smoke.frustumCulled = false; scene.add(smoke);

  // ---- shards of the frozen UI
  const D = 3.0, camAt18 = new THREE.Vector3(0, .25, 11.5);
  const fh = 2 * D * Math.tan(THREE.MathUtils.degToRad(35 / 2)), fw = fh * W / H;
  let shards = null, shardU = null;
  function buildShards() {
    const tex = canvasTex(ctx.getFrozen(), { mip: true });
    const nx = 9, ny = 16, r = rng(77);
    const grid = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const jx = i > 0 && i < nx ? (r() - .5) * .8 : 0, jy = j > 0 && j < ny ? (r() - .5) * .8 : 0;
      grid.push([(i + jx) / nx, (j + jy) / ny]);
    }
    const P = [], UV = [], CEN = [], VEL = [], AX = [], SP = [], BAR = [];
    const g = (i, j) => grid[j * (nx + 1) + i];
    const impactPt = [.5, 1 - 900 / 1920];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = g(i, j), b = g(i + 1, j), c = g(i + 1, j + 1), d = g(i, j + 1);
      const tris = r() < .5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const tr of tris) {
        const cx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3, cy = (tr[0][1] + tr[1][1] + tr[2][1]) / 3;
        const wx = (cx - .5) * fw + camAt18.x, wy = (cy - .5) * fh + camAt18.y, wz = camAt18.z - D;
        const dx = cx - impactPt[0], dy = cy - impactPt[1]; const dist = Math.hypot(dx, dy) + .05;
        const sp = .35 + r() * .9 + dist * .6;
        const vel = [dx / dist * sp, dy / dist * sp, .15 + r() * .9];
        const ax = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize();
        const spin = (r() - .5) * 9;
        tr.forEach((v, k) => {
          P.push((v[0] - .5) * fw + camAt18.x, (v[1] - .5) * fh + camAt18.y, wz);
          UV.push(v[0], v[1]); CEN.push(wx, wy, wz); VEL.push(...vel); AX.push(ax.x, ax.y, ax.z); SP.push(spin);
          BAR.push(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
        });
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute('aC', new THREE.Float32BufferAttribute(CEN, 3)); geo.setAttribute('aV', new THREE.Float32BufferAttribute(VEL, 3));
    geo.setAttribute('aAx', new THREE.Float32BufferAttribute(AX, 3)); geo.setAttribute('aSp', new THREE.Float32BufferAttribute(SP, 1)); geo.setAttribute('aB', new THREE.Float32BufferAttribute(BAR, 3));
    shardU = { uT: { value: 0 }, uMap: { value: tex }, uFlash: { value: 0 } };
    shards = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: shardU, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      vertexShader: `attribute vec3 aC, aV, aAx, aB; attribute float aSp; uniform float uT; varying vec2 vUv; varying vec3 vB; varying float vF;
        vec3 rot(vec3 v, vec3 k, float a){ return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1. - cos(a)); }
        void main(){ float t = uT; float e = 1. - exp(-t * 1.6);
          vec3 p = rot(position - aC, aAx, aSp * e * .7) + aC + aV * (e * 1.25 + t * .35) + vec3(0., -.12, 0.) * t * t;
          vUv = uv; vB = aB; vF = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uFlash; varying vec2 vUv; varying vec3 vB; varying float vF;
        void main(){ vec4 c = texture2D(uMap, vUv); float edge = 1. - smoothstep(0., .035, min(vB.x, min(vB.y, vB.z)));
          vec3 col = pow(c.rgb, vec3(2.2)) * (1. + uFlash * 2.) + vec3(.6, 1., .8) * edge * (1.2 + uFlash * 3.);
          float a = max(c.a, edge * .8) * (1. - smoothstep(1.6, 2.6, vF));
          gl_FragColor = vec4(col, a); }`,
    }));
    shards.frustumCulled = false; scene.add(shards);
  }

  // dive camera target: the left eye in world space
  const eyeW = new THREE.Vector3();

  const camKeys1 = [[18, [0, .25, 11.5]], [20, [.35, .3, 10.2]], [22.5, [.2, .2, 9.0]], [24, [0, .1, 8.5]], [26, [-.12, .05, 8.1]], [28, [0, 0, 7.8]]];
  const camKeys2 = [[114, [.0, -.05, 8.6]], [118, [.05, 0, 8.0]], [122, [0, 0, 7.6]]];

  function update(t, ui, fx, frame) {
    const final = t >= E.skull_match;
    fx.threshold = .8; fx.bloomStr = 1.0; fx.vign = .8; fx.grain = .055; fx.ca = .7; fx.exposure = 1.25; fx.uiBloom = .12;
    if (!final && !shards) buildShards();
    if (shards) shards.visible = !final && t < E.impact + 3;
    // skull pose
    let yaw, pitch = 0, roll = 0;
    if (!final) {
      const turn = eInOutCubic(inv(19.6, 24.0, t));
      yaw = lerp(-2.15, 0, turn) + wobble(t, 4, .3) * .03;
      pitch = lerp(.25, -.04, turn) + wobble(t, 5, .25) * .02; roll = lerp(-.12, 0, turn);
    } else { yaw = wobble(t, 6, .2) * .06; pitch = -.03 + wobble(t, 7, .2) * .02; }
    pivot.rotation.set(pitch, yaw, roll);
    pivot.position.y = final ? 0 : lerp(-.3, 0, smooth(18, 24, t));
    // reveal from darkness
    const lit = final ? 1 : smooth(E.impact + .3, E.eyes + .5, t);
    key.intensity = 14 * lit; rimR.intensity = 9 * lit; rimB.intensity = 8 * lit; under.intensity = 3 * lit;
    scene.environmentIntensity = lerp(.05, 1, lit);
    sk.U.uTime.value = t;
    sk.U.uCode.value = final ? .6 : smooth(19.2, 21.5, t) * (t > E.title ? .75 : .65);
    sk.U.uScan.value = final ? lerp(-1.4, 1.6, inv(114, 116, t)) : lerp(-1.4, 1.5, inv(19.0, 21.2, t));
    // eyes
    const eyeOn = final ? 1 : smooth(E.eyes, E.eyes + .35, t);
    const flick = .9 + .1 * Math.sin(t * 37) * Math.sin(t * 23);
    eyes.forEach((e, i) => {
      e.s1.material.opacity = eyeOn * flick; e.s1.scale.setScalar(.34 + .05 * Math.sin(t * 3 + i));
      e.l.intensity = 2.2 * eyeOn * flick;
    });
    eyeMat.opacity = eyeOn * flick; coreMat.opacity = eyeOn;
    // halos + wires
    pivotHalo.position.y = pivot.position.y; halos.forEach((h, i) => { h.rotation.z = t * (.12 + i * .07); h.rotation.x = Math.PI / 2 + .32 + Math.sin(t * .6 + i * 2) * .12; h.rotation.y = Math.sin(t * .4 + i) * .15; h.material.color.setScalar(1); h.material.color.copy(i ? new THREE.Color(1.5, .1, .2) : new THREE.Color(.15, 1.4, .6)).multiplyScalar((smooth(21.5, 23, t) || (final ? 1 : 0)) * (final ? 1 : 1 - .82 * smooth(24.6, 25.0, t) * (1 - smooth(28.2, 28.8, t)))); });
    wires.children.forEach((w, i) => { w.visible = final ? i >= 6 : t > 20.5 + i * .12; });
    // haze + rain
    haze.forEach((s, i) => { s.material.opacity = s.userData.o * lit; s.material.rotation = t * s.userData.rot; });
    rainU.uT.value = t; rainU.uO.value = lit * .8;
    // smoke from the mouth
    sk.mesh.updateWorldMatrix(true, false);
    smokeU.uOrigin.value.copy(SKULL.mouth).applyMatrix4(pivot.matrixWorld);
    smokeU.uDir.value.set(0, .1, 1).applyQuaternion(pivot.quaternion).normalize();
    smokeU.uT.value = Math.max(0, t - (final ? 110 : E.smoke));
    smokeU.uO.value = final ? .55 : smooth(E.smoke, E.smoke + .6, t) * (1 - smooth(28.5, 29.2, t));
    // camera
    let cp;
    if (!final) {
      cp = new THREE.Vector3(...track(camKeys1, Math.min(t, 28)));
      const look = new THREE.Vector3(0, lerp(.25, .62, smooth(21, 24, t)), 0);
      if (t > E.dive) { // accelerate into the left eye
        eyeW.copy(SKULL.eyeL).applyMatrix4(pivot.matrixWorld);
        const k = eInExpo(inv(E.dive, E.tunnel, t)) * .985 + inv(E.dive, E.tunnel, t) * .0;
        const k2 = eInCubic(inv(E.dive, E.tunnel, t));
        cp.lerp(eyeW.clone().add(new THREE.Vector3(0, 0, .12)), Math.max(k, k2 * .92));
        look.lerp(eyeW.clone().add(new THREE.Vector3(0, 0, -1)), smooth(E.dive, E.dive + 1.2, t));
        camera.fov = lerp(35, 55, eInCubic(inv(E.dive + .8, E.tunnel, t)));
      } else camera.fov = 35;
      camera.position.copy(cp); camera.position.x += wobble(t, 1, .5) * .03; camera.position.y += wobble(t, 2, .5) * .02;
      camera.lookAt(look);
      camera.rotation.z += wobble(t, 3, .3) * .015 + (t > E.dive ? eInCubic(inv(E.dive, E.tunnel, t)) * .5 : 0);
    } else {
      cp = new THREE.Vector3(...track(camKeys2, t));
      camera.fov = 35; camera.position.copy(cp); camera.position.x += wobble(t, 1, .4) * .025;
      camera.lookAt(0, -.82, 0); camera.rotation.z += wobble(t, 3, .3) * .01;
    }
    camera.updateProjectionMatrix();
    // shards + impact flash
    if (shards) {
      shardU.uT.value = Math.max(0, t - E.impact);
      shardU.uFlash.value = Math.exp(-(t - E.impact) * 5);
    }
    if (!final) {
      const f = t - E.impact;
      fx.flash = f < .5 ? .85 * Math.exp(-f * 9) : 0; fx.flashColor = 0xffffff;
      fx.glitch = f < .35 ? .7 * (1 - f / .35) : 0;
      fx.ca = .7 + (f < .6 ? 3 * (1 - f / .6) : 0);
      titleUI(ui, t, fx, frame);
      // dive: light floods the frame
      const fl = smooth(29.35, 30.0, t); if (fl > 0) { fx.flash = fl * .85; fx.flashColor = 0x39ff88; }
      fx.glitch += t > 29.5 ? (t - 29.5) * .5 : 0;
    } else {
      finalUI(ui, t, fx, frame);
      const s = t - E.skull_match; // arriving from the green eyes of the city
      if (s < .6) { fx.flash = .7 * (1 - s / .6); fx.flashColor = 0x39ff88; }
    }
  }

  // ---------------------------------------------------------------- UI: title
  const mm = sprite({ lines: ['MEMENTO', 'MORI'], size: 168, family: F.head, weight: 900, metal: true, glow: 14, glowColor: 'rgba(120,255,190,.3)', damage: 1, seed: 5, lh: 1.0, ls: 4, maxW: 960 });
  const sub1 = sprite({ text: 'ЧАТ ОТ', size: 58, family: F.head, weight: 700, color: '#e9edf5', ls: 10, glow: 12, glowColor: 'rgba(255,255,255,.5)' });
  const sub2 = sprite({ text: 'KAPUSTKA', size: 58, family: F.head, weight: 900, color: '#ff2a44', ls: 10, glow: 22, glowColor: 'rgba(255,30,60,.9)' });
  const sheenC = makeCanvas(mm.w, mm.h); const sheenX = sheenC.getContext('2d');
  const titleSprite = { c: sheenC, w: mm.w, h: mm.h };
  function drawSheen(p) {
    sheenX.clearRect(0, 0, mm.w, mm.h); sheenX.globalCompositeOperation = 'source-over'; sheenX.drawImage(mm.c, 0, 0);
    sheenX.globalCompositeOperation = 'source-atop';
    const x0 = lerp(-mm.w * .4, mm.w * 1.4, p); const g = sheenX.createLinearGradient(x0 - 120, 0, x0 + 120, mm.h * .4);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    sheenX.fillStyle = g; sheenX.fillRect(0, 0, mm.w, mm.h); sheenX.globalCompositeOperation = 'source-over';
  }
  function titleArcs(ui, cx, cy, sw, sh, frame, alpha, seed0 = 0) {
    const fr = Math.floor(frame / 3);
    for (let k = 0; k < 3; k++) {
      const s = fr * 13 + k * 101 + seed0; if (hash(s) < .35) continue;
      const side = Math.floor(hash(s + 1) * 4);
      const ax = cx + (hash(s + 2) - .5) * sw, bx = ax + (hash(s + 3) - .5) * sw * .5;
      const ay = cy + (side < 2 ? -1 : 1) * sh * (.25 + hash(s + 4) * .25), by = cy + (hash(s + 5) - .5) * sh * .9;
      arc(ui, ax, ay, bx, by, s, { color: k % 2 ? '#7dffb4' : '#9fd8ff', width: 2.2, glow: 16, alpha: alpha * (.6 + .4 * hash(s + 6)) });
    }
  }
  function titleUI(ui, t, fx, frame) {
    if (t < E.title - .05 || t > E.tunnel) return;
    const a = t - E.title;
    const out = smooth(E.dive, E.dive + .7, t);
    const slam = eOutExpo(clamp(a / .28));
    const sc = lerp(1.55, 1, slam) * (1 + a * .012) * (1 + out * .7);
    const alpha = clamp(a / .06) * (1 - out);
    drawSheen(clamp((a - .2) / 1.4));
    const gl = a < .35 ? (1 - a / .35) * .8 : (hash(Math.floor(frame / 2) + 3) < .06 ? .35 : 0);
    const ty = 470 - out * 120;
    putGlitch(ui, titleSprite, 540, ty, gl, Math.floor(frame / 2), { alpha, scale: sc });
    if (a > .1) titleArcs(ui, 540, ty, mm.tw * sc, mm.th * sc, frame, alpha);
    // subtitle
    const b = t - E.subtitle;
    if (b > 0) {
      const p = eOutCubic(clamp(b / .5));
      const y = 735 - out * 60, gap = 26;
      const totalW = sub1.tw + gap + sub2.tw;
      const x1 = 540 - totalW / 2 + sub1.tw / 2, x2 = 540 + totalW / 2 - sub2.tw / 2;
      put(ui, sub1, x1 - (1 - p) * 60, y, { alpha: p * (1 - out) });
      putGlitch(ui, sub2, x2 + (1 - p) * 60, y, b < .3 ? .6 : 0, frame, { alpha: p * (1 - out) });
    }
    if (a < .12) { fx.flash = Math.max(fx.flash, .5 * (1 - a / .12)); fx.flashColor = 0xcfe8ff; }
    if (a >= 0 && a < .4) fx.ca = Math.max(fx.ca, 3 * (1 - a / .4));
  }

  // ---------------------------------------------------------------- UI: final logo
  const fmm = sprite({ lines: ['MEMENTO', 'MORI'], size: 150, family: F.head, weight: 900, metal: true, glow: 14, glowColor: 'rgba(120,255,190,.3)', damage: 1, seed: 9, lh: 1.0, ls: 4, maxW: 900 });
  const by = sprite({ text: 'BY KAPUSTKA', size: 62, family: F.head, weight: 900, color: '#ff2a44', ls: 14, glow: 24, glowColor: 'rgba(255,30,60,.9)' });
  const grp = sprite({ text: 'SWAG_ZOV_NEFOR.exe', size: 52, family: F.mono, weight: 800, color: '#7dffb4', ls: 2, glow: 18, glowColor: 'rgba(57,255,136,.9)' });
  const wel1 = sprite({ text: 'ДОБРО ПОЖАЛОВАТЬ', size: 60, family: F.head, weight: 800, color: '#f4f6fb', ls: 4, glow: 10, glowColor: 'rgba(255,255,255,.5)' });
  const wel2 = sprite({ text: 'В НАШ ХАОС', size: 92, family: F.dela, weight: 400, color: '#f4f6fb', ls: 6, glow: 18, glowColor: 'rgba(255,40,70,.85)' });
  function finalUI(ui, t, fx, frame) {
    const a = t - E.logo;
    const leave = smooth(E.join_ui - .5, E.join_ui, t);
    if (a > 0) {
      const slam = eOutExpo(clamp(a / .3));
      const gl = a < .35 ? (1 - a / .35) * .8 : (hash(Math.floor(frame / 2) + 9) < .05 ? .3 : 0);
      putGlitch(ui, fmm, 540, 1185, gl, Math.floor(frame / 2), { alpha: clamp(a / .06) * (1 - leave), scale: lerp(1.5, 1, slam) * (1 + a * .01) });
      titleArcs(ui, 540, 1185, fmm.tw, fmm.th, frame, (1 - leave) * .8, 77);
      if (a < .12) { fx.flash = .45 * (1 - a / .12); fx.flashColor = 0xffffff; }
    }
    const b = t - E.logo_by; if (b > 0) put(ui, by, 540, 1395 + (1 - eOutCubic(clamp(b / .4))) * 40, { alpha: clamp(b / .3) * (1 - leave) });
    const c = t - E.logo_group;
    if (c > 0) { const s = decoded('SWAG_ZOV_NEFOR.exe', clamp(c / .9), 3, frame); const sp = sprite({ text: s, size: 52, family: F.mono, weight: 800, color: '#7dffb4', ls: 2, glow: 18, glowColor: 'rgba(57,255,136,.9)' }); put(ui, sp, 540, 1485, { alpha: clamp(c / .2) * (1 - leave) }); }
    const d = t - E.welcome;
    if (d > 0) {
      letters(ui, 'ДОБРО ПОЖАЛОВАТЬ', 540, 1600, { size: 60, family: F.head, weight: 800, color: '#f4f6fb', ls: 4, glow: 10, glowColor: 'rgba(255,255,255,.5)' }, clamp(d / .8), { alpha: 1 - leave, rise: 30 });
      const e = clamp((d - .45) / .35);
      putGlitch(ui, wel2, 540, 1700, e < 1 ? (1 - e) * .7 : 0, frame, { alpha: e * (1 - leave), scale: lerp(1.3, 1, eOutExpo(e)) });
    }
    fx.fade = leave * .0;
  }

  return { scene, camera, update, dbg: { sk, smoke, rain, haze, wires, halos, eyes, key, rimR, rimB, under, get shards() { return shards; } } };
}
