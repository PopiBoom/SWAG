// Shared digital-city kit: instanced buildings (monitor towers / server racks / system units),
// emissive screens, voxel clouds, flying messages, sky dome, grid ground.
import * as THREE from 'three';
import { makeCanvas, canvasTex, rng, hash, clamp, roundRect, H } from './core.js';
import { F, C } from './ui.js';
import { drawSkullGlyph } from './data.js';

const FOG_GLSL = `float fogF(float d, float k){ return 1. - exp(-d * d * k * k); }`;

export function buildingMaterial(o = {}) {
  const U = {
    uTime: { value: 0 }, uFog: { value: new THREE.Color(o.fog ?? 0x07040f) }, uFogK: { value: o.fogK ?? .006 },
    uWaveZ: { value: -1e5 }, uWaveCol: { value: new THREE.Color(.3, 3, 1.1) }, uNight: { value: o.night ?? 0 },
    uWin: { value: o.win ?? 1 }, uRoof: { value: o.roof ?? .25 }, uLight: { value: new THREE.Vector3(.4, .8, .45).normalize() },
    uWaveAxis: { value: o.waveAxis ?? 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `attribute vec4 aInfo; attribute vec3 aTint; varying vec3 vL; varying vec3 vN; varying vec3 vW; varying vec4 vInfo; varying vec3 vTint; varying vec3 vSize;
      void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.); vW = wp.xyz;
        vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vL = (position + vec3(0., .5, 0.)) * vSize; vN = normal; vInfo = aInfo; vTint = aTint;
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uTime, uFogK, uWaveZ, uNight, uWin, uRoof, uWaveAxis; uniform vec3 uFog, uWaveCol, uLight;
      varying vec3 vL; varying vec3 vN; varying vec3 vW; varying vec4 vInfo; varying vec3 vTint; varying vec3 vSize; ${FOG_GLSL}
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float kind = vInfo.x, seed = vInfo.y;
        vec3 n = normalize(vN);
        float diff = .35 + .65 * max(dot(n, uLight), 0.);
        vec3 base = mix(vec3(.018, .02, .028), vec3(.10, .095, .085), step(1.5, kind)) * diff;
        vec3 col = base; vec3 em = vec3(0.);
        bool side = abs(n.y) < .5;
        vec2 f = abs(n.x) > .5 ? vec2(vL.z, vL.y) : vec2(vL.x, vL.y);
        if (side) {
          if (kind < .5) { // tower: window grid
            vec2 cs = vec2(1.7, 2.3); vec2 c = floor(f / cs); vec2 g = fract(f / cs);
            float w = step(.18, g.x) * step(g.x, .82) * step(.22, g.y) * step(g.y, .78);
            float lit = step(.52 - .25 * uWin, h2(c + seed * 31.));
            float flick = .75 + .25 * step(.5, h2(c + floor(uTime * (.5 + h2(c) * 2.)) + seed));
            vec3 wc = mix(vTint, vec3(.16, .67, .93), uNight * step(.45, h2(c * 1.7 + seed)));
            em += wc * w * lit * flick * (.55 + .9 * h2(c * 3.1 + seed)) * uWin;
          } else if (kind < 1.5) { // server rack: slots + blinking LEDs
            float row = floor(f.y / .55); float gy = fract(f.y / .55);
            col *= .6 + .4 * step(.12, gy);
            vec2 c = vec2(floor(f.x / .35), row); vec2 g = fract(vec2(f.x / .35, f.y / .55));
            float led = step(length(g - vec2(.5, .55)), .16);
            float on = step(.55, h2(c + floor(uTime * (2. + 6. * h2(c + seed))) * 1.3 + seed));
            vec3 lc = h2(c * 7. + seed) < .7 ? vec3(.2, 1.6, .6) : (h2(c * 3. + seed) < .5 ? vec3(1.6, .15, .2) : vec3(.3, .6, 1.8));
            em += lc * led * on * 1.4 * uWin;
          } else { // system unit: drive bays + vents + power LED
            float bay = step(.7, fract(f.y / 1.6)) * step(.1, fract(f.x / (vSize.x + .001))) * step(fract(f.x / (vSize.x + .001)), .9);
            col = mix(col, col * .45, bay);
            float vent = step(.5, fract(f.y * 3.)) * step(f.y, vSize.y * .25);
            col *= 1. - vent * .4;
            float led = step(length(f - vec2(vSize.x * .82, vSize.y * .9)), .35);
            em += vec3(.3, 2.2, .8) * led * uWin;
            vec2 c = floor(f / vec2(2.4, 3.)); em += vTint * .25 * step(.9, h2(c + seed)) * step(.6, fract(f.y / 3.)) * uWin;
          }
        } else if (n.y > .5) { // roof
          vec2 c = floor(vL.xz / 2.); float sky = step(.6, h2(c + seed)) * step(.3, fract(vL.x / 2.)) * step(.3, fract(vL.z / 2.));
          em += vTint * uRoof * (.35 + sky);
        }
        // neon edge at the roof line
        float edge = smoothstep(.35, 0., vSize.y - vL.y) * (side ? 1. : 0.);
        em += vTint * edge * 1.6 * vInfo.z;
        em *= vInfo.w < .001 ? 1. : vInfo.w;
        // travelling wave
        float wpos = uWaveAxis < .5 ? -vW.z : length(vW.xz);
        float wd = (wpos - uWaveZ);
        float wave = exp(-wd * wd * .004) * step(-200., uWaveZ);
        em += uWaveCol * wave * (side ? .35 : .5);
        em *= 1. + wave * .8;
        col += em;
        float d = length(vW - cameraPosition);
        col = mix(col, uFog, fogF(d, uFogK));
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  m.U = U; return m;
}

// list: [{x, z, w, d, h, kind, tint:[r,g,b], seed, edge}]
export function makeBuildings(list, mat) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const info = new Float32Array(list.length * 4), tint = new Float32Array(list.length * 3);
  const m = new THREE.Matrix4();
  list.forEach((b, i) => {
    m.makeScale(b.w, b.h, b.d); m.setPosition(b.x, b.h / 2, b.z); mesh.setMatrixAt(i, m);
    info.set([b.kind, b.seed ?? i * .37, b.edge ?? 1, b.lit ?? 0], i * 4); tint.set(b.tint, i * 3);
  });
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
  mesh.frustumCulled = false;
  return mesh;
}

export const TINTS = [[.15, 1.2, .5], [1.3, .08, .18], [.55, .2, 1.4], [.15, .5, 1.5], [.9, .95, 1.1]];

// ---------------------------------------------------------------- screen atlas (4x4 cells of 512)
export function screenAtlas(atlasAv, alt = false) {
  const S = 512, c = makeCanvas(S * 4, S * 4), x = c.getContext('2d'); const r = rng(alt ? 99 : 42);
  const slogans = ['404', 'НОРМАЛЬНОСТЬ\nНЕ НАЙДЕНА', 'СВОБОДА\nОБЩЕНИЯ', 'ХАОС\nАКТИВИРОВАН', 'ЗДЕСЬ\nМОЖНО ВСЁ', 'MEMENTO\nMORI'];
  for (let k = 0; k < 16; k++) {
    const cx = (k % 4) * S, cy = Math.floor(k / 4) * S;
    x.save(); x.beginPath(); x.rect(cx, cy, S, S); x.clip();
    x.fillStyle = '#020304'; x.fillRect(cx, cy, S, S);
    const type = alt ? 'alt' : ['code', 'tg', 'slogan', 'skull', 'err', 'tg', 'slogan', 'code', 'slogan', 'avatars', 'slogan', 'tg', 'slogan', 'err', 'code', 'skull'][k];
    if (type === 'code') {
      x.font = `700 26px ${F.mono}`; x.fillStyle = '#39ff88';
      for (let j = 0; j < 17; j++) { let s = ''; const n = 4 + r() * 22 | 0; for (let q = 0; q < n; q++) s += '01{}<>#$=+;abcdefЖЯ'[r() * 19 | 0]; x.globalAlpha = .4 + r() * .6; x.fillText(s, cx + 20 + (r() * 6 | 0) * 18, cy + 40 + j * 28); }
      x.globalAlpha = 1;
    } else if (type === 'tg') {
      x.fillStyle = '#0e1621'; x.fillRect(cx, cy, S, S); x.fillStyle = '#17212b'; x.fillRect(cx, cy, S, 70);
      x.fillStyle = '#e8eef4'; x.font = `700 30px ${F.ui}`; x.fillText('SWAG_ZOV_NEFOR.exe', cx + 80, cy + 44);
      x.fillStyle = '#39ff88'; x.beginPath(); x.arc(cx + 40, cy + 35, 22, 0, 7); x.fill();
      for (let j = 0; j < 5; j++) { const w = 180 + r() * 220, mine = r() < .3; x.fillStyle = mine ? '#1f3a2a' : '#182533'; roundRect(x, mine ? cx + S - 20 - w : cx + 20, cy + 95 + j * 82, w, 64, 18); x.fill(); x.fillStyle = 'rgba(200,220,235,.18)'; x.fillRect(mine ? cx + S - w : cx + 40, cy + 118 + j * 82, w * .7, 16); }
    } else if (type === 'slogan') {
      const sl = slogans[(k * 3 + 1) % slogans.length].split('\n');
      const red = k % 2 === 0;
      x.fillStyle = red ? '#ff1f3d' : '#39ff88'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = x.fillStyle; x.shadowBlur = 18;
      const sz = sl[0].length > 8 ? 62 : 120;
      x.font = `900 ${sz}px ${F.head}`; sl.forEach((s, i) => x.fillText(s, cx + S / 2, cy + S / 2 + (i - (sl.length - 1) / 2) * sz * 1.15));
      x.shadowBlur = 0; x.textAlign = 'left';
    } else if (type === 'skull') { drawSkullGlyph(x, cx + S / 2, cy + S / 2, 360, k > 8 ? '#ff1f3d' : '#39ff88'); }
    else if (type === 'err') {
      x.fillStyle = '#c3c6cc'; x.fillRect(cx + 40, cy + 150, S - 80, 220); x.fillStyle = '#0d1a6e'; x.fillRect(cx + 46, cy + 156, S - 92, 40);
      x.fillStyle = '#d40d1d'; x.beginPath(); x.arc(cx + 100, cy + 270, 34, 0, 7); x.fill();
      x.fillStyle = '#000'; x.font = `700 40px ${F.oswald}`; x.fillText('ERROR 404', cx + 160, cy + 285);
    } else if (type === 'avatars' && atlasAv) {
      for (let j = 0; j < 9; j++) { const id = (j * 7 + 3) % 63; x.drawImage(atlasAv.canvas, (id % 8) * atlasAv.S, (id / 8 | 0) * atlasAv.S, atlasAv.S, atlasAv.S, cx + 26 + (j % 3) * 160, cy + 26 + (j / 3 | 0) * 160, 140, 140); }
    } else if (type === 'alt') { // every screen: MEMENTO MORI — ЧАТ ОТ KAPUSTKA
      x.fillStyle = '#050003'; x.fillRect(cx, cy, S, S);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = '#ff1f3d'; x.shadowBlur = 16; x.fillStyle = '#f2f4f8'; x.font = `900 86px ${F.head}`;
      x.fillText('MEMENTO', cx + S / 2, cy + 150); x.fillText('MORI', cx + S / 2, cy + 245);
      x.fillStyle = '#ff1f3d'; x.font = `800 38px ${F.head}`; x.fillText('ЧАТ ОТ KAPUSTKA', cx + S / 2, cy + 360);
      x.shadowBlur = 0; x.textAlign = 'left';
    }
    // bezel scanlines
    x.fillStyle = 'rgba(0,0,0,.25)'; for (let j = 0; j < S; j += 4) x.fillRect(cx, cy + j, S, 2);
    x.restore();
  }
  return canvasTex(c);
}

// screens: [{x, y, z, w, h, ry, cell}]
export function makeScreens(list, atlasTex, altTex) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const U = { uMap: { value: atlasTex }, uAlt: { value: altTex || atlasTex }, uSwitch: { value: -1 }, uTime: { value: 0 }, uBright: { value: 1.6 }, uFog: { value: new THREE.Color(0x07040f) }, uFogK: { value: .006 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide,
    vertexShader: `attribute vec2 aCell; attribute float aDelay; varying vec2 vUv; varying float vDelay; varying vec3 vW;
      void main(){ vUv = (uv + aCell) / 4.; vDelay = aDelay; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D uMap, uAlt; uniform float uSwitch, uTime, uBright, uFogK; uniform vec3 uFog; varying vec2 vUv; varying float vDelay; varying vec3 vW; ${FOG_GLSL}
      void main(){ float s = step(vDelay, uSwitch); vec3 a = texture2D(uMap, vUv).rgb; vec3 b = texture2D(uAlt, fract(vUv * 4.) / 4.).rgb;
        float glitch = step(abs(uSwitch - vDelay), .08);
        vec3 c = mix(a, b, s); c = pow(c, vec3(2.2)) * uBright; c += glitch * vec3(.5, 1.5, .8);
        float d = length(vW - cameraPosition); c = mix(c, uFog, fogF(d, uFogK)); gl_FragColor = vec4(c, 1.); }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const cell = new Float32Array(list.length * 2), delay = new Float32Array(list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((s, i) => {
    q.setFromEuler(e.set(0, s.ry || 0, 0)); m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.w, s.h, 1)); mesh.setMatrixAt(i, m);
    cell.set([s.cell % 4, 3 - Math.floor(s.cell / 4)], i * 2); delay[i] = s.delay ?? 0;
  });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  geo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(delay, 1));
  mesh.frustumCulled = false; mesh.U = U; return mesh;
}

// ---------------------------------------------------------------- sky + ground
export function skyDome(o = {}) {
  const U = { uTop: { value: new THREE.Color(o.top ?? 0x020108) }, uHor: { value: new THREE.Color(o.hor ?? 0x2a0b45) }, uGlow: { value: new THREE.Color(o.glow ?? 0x0a3a2a) } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uTop, uHor, uGlow; varying vec3 vD; void main(){ float h = vD.y; vec3 c = mix(uHor, uTop, smoothstep(0., .45, h)); c += uGlow * exp(-abs(h) * 14.); gl_FragColor = vec4(c, 1.); }`,
  }));
  m.U = U; return m;
}
export function gridGround(o = {}) {
  const U = { uCol: { value: new THREE.Color(o.col ?? 0x1bff7a) }, uFog: { value: new THREE.Color(o.fog ?? 0x07040f) }, uFogK: { value: o.fogK ?? .006 }, uI: { value: o.i ?? .5 }, uWaveZ: { value: -1e5 }, uWaveAxis: { value: o.waveAxis ?? 0 } };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uCol, uFog; uniform float uFogK, uI, uWaveZ, uWaveAxis; varying vec3 vW; ${FOG_GLSL}
      void main(){ vec2 g = abs(fract(vW.xz / 8. - .5) - .5) / fwidth(vW.xz / 8.); float l = 1. - min(min(g.x, g.y), 1.);
        float wpos = uWaveAxis < .5 ? -vW.z : length(vW.xz); float wd = wpos - uWaveZ; float wave = exp(-wd * wd * .002) * step(-200., uWaveZ);
        vec3 c = vec3(.006, .006, .012) + uCol * l * uI * .35 + uCol * wave * (.12 + l * 1.2);
        float d = length(vW - cameraPosition); c = mix(c, uFog, fogF(d, uFogK)); gl_FragColor = vec4(c, 1.); }`,
  }));
  m.rotation.x = -Math.PI / 2; m.U = U; return m;
}

// voxel clouds
export function pixelClouds(o = {}) {
  const r = rng(o.seed ?? 8); const N = o.n ?? 900; const cubes = [];
  const clusters = o.clusters ?? 14;
  for (let c = 0; c < clusters; c++) {
    const cx = (r() - .5) * (o.spanX ?? 500), cz = (o.z0 ?? 0) - r() * (o.spanZ ?? 500), cy = (o.y ?? 85) + r() * 30;
    const n = N / clusters | 0;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rr = Math.pow(r(), .6) * 26;
      cubes.push([cx + Math.cos(a) * rr * 1.6, cy + (r() - .3) * 7 - rr * .12, cz + Math.sin(a) * rr * .8]);
    }
  }
  const s = o.size ?? 4;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: o.color ?? 0x241538, roughness: .9, emissive: o.emissive ?? 0x0a0614 }), cubes.length);
  const m = new THREE.Matrix4();
  cubes.forEach((p, i) => { m.makeTranslation(Math.round(p[0] / s) * s, Math.round(p[1] / s) * s, Math.round(p[2] / s) * s); mesh.setMatrixAt(i, m); });
  mesh.frustumCulled = false; return mesh;
}

// atlas of flying message tokens (bubbles, reactions, glyphs)
export function tokenAtlas() {
  const S = 256, c = makeCanvas(S * 4, S * 4), x = c.getContext('2d'); const r = rng(5);
  const em = ['🔥', '😂', '💀', '❤️', '👍', '🤡', '⚡', '😈'];
  for (let k = 0; k < 16; k++) {
    const cx = (k % 4) * S, cy = Math.floor(k / 4) * S;
    x.save(); x.translate(cx + S / 2, cy + S / 2);
    if (k < 8) { x.font = `150px "Noto Color Emoji"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(em[k], 0, 10); }
    else if (k < 13) { // redacted chat bubble
      const w = 210, h = 120; x.fillStyle = k % 2 ? 'rgba(24,37,51,.95)' : 'rgba(31,58,42,.95)'; roundRect(x, -w / 2, -h / 2, w, h, 30); x.fill();
      x.strokeStyle = k % 2 ? '#3a8dff' : '#39ff88'; x.lineWidth = 4; x.stroke();
      x.fillStyle = 'rgba(210,230,240,.35)'; x.fillRect(-w / 2 + 24, -22, w * .65, 14); x.fillRect(-w / 2 + 24, 6, w * .4, 14);
    } else { x.font = `900 120px ${F.head}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ['#39ff88', '#ff1f3d', '#9fd8ff'][k - 13]; x.shadowColor = x.fillStyle; x.shadowBlur = 20; x.fillText(['@', '#', '+1'][k - 13], 0, 6); }
    x.restore();
  }
  return canvasTex(c);
}
export function flyingTokens(tex, o = {}) {
  const N = o.n ?? 420, r = rng(o.seed ?? 3);
  const pos = new Float32Array(N * 3), a = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos.set([(r() - .5) * (o.spanX ?? 300), (o.y0 ?? 40) + r() * (o.spanY ?? 70), (o.z0 ?? 0) - r() * (o.spanZ ?? 500)], i * 3);
    a.set([Math.floor(r() * 16), r(), (r() < .5 ? -1 : 1) * (6 + r() * 14), 4 + r() * 6], i * 4);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 4));
  const U = { uT: { value: 0 }, uMap: { value: tex }, uPx: { value: H / 1920 }, uO: { value: 1 }, uSpan: { value: o.spanX ?? 300 } };
  const p = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 aA; uniform float uT, uPx, uSpan; varying float vCell; varying float vA;
      void main(){ vec3 p = position; p.x = mod(p.x + aA.z * uT + uSpan * .5, uSpan) - uSpan * .5; p.y += sin(uT * .7 + aA.y * 6.) * 2.;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aA.w * 260. * uPx / -mv.z; vCell = aA.x;
        vA = smoothstep(uSpan * .5, uSpan * .38, abs(p.x)); }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uO; varying float vCell; varying float vA;
      void main(){ vec2 uv = (gl_PointCoord * vec2(1., -1.) + vec2(0., 1.) + vec2(mod(vCell, 4.), 3. - floor(vCell / 4.))) / 4.; vec4 c = texture2D(uMap, uv);
        if (c.a < .02) discard; gl_FragColor = vec4(pow(c.rgb, vec3(2.2)) * 1.3, c.a * vA * uO); }`,
  }));
  p.frustumCulled = false; p.U = U; return p;
}
