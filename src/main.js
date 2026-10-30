import * as THREE from 'three';
import { SCENES, DURATION, FPS } from './timeline.js';
import { HUD } from './hud.js';
import scene1 from './scenes/s1_file.js';
import scene2 from './scenes/s2_room.js';
import scene3 from './scenes/s3_network.js';
import scene4 from './scenes/s4_laws.js';
import scene5 from './scenes/s5_city.js';
import scene6 from './scenes/s6_reboot.js';

const W = 1920, H = 1080;

const FONTS = [
  ['Unb', 'Unbounded-900.ttf'], ['UnbR', 'Unbounded-400.ttf'], ['Mono', 'JetBrainsMono-500.ttf'],
  ['MonoB', 'JetBrainsMono-800.ttf'], ['Tek', 'Tektur-900.ttf'], ['TekM', 'Tektur-500.ttf'],
  ['Dela', 'DelaGothicOne.ttf'], ['Glitch', 'RubikGlitch.ttf'], ['RMono', 'RubikMonoOne.ttf'],
  ['Russo', 'RussoOne.ttf'], ['Pix', 'PressStart2P.ttf'],
];

const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BLUR_FRAG = `
uniform sampler2D tex; uniform vec2 dir; uniform float threshold; varying vec2 vUv;
vec3 pre(vec2 uv){ vec4 c4 = texture2D(tex, uv); vec3 c = c4.rgb; if(threshold < 0.0) c *= c4.a; if(threshold > 0.0){ float l = max(c.r, max(c.g, c.b)); c *= smoothstep(threshold, threshold + 0.25, l); } return c; }
void main(){
  vec3 s = pre(vUv) * 0.227;
  s += (pre(vUv + dir * 1.385) + pre(vUv - dir * 1.385)) * 0.316;
  s += (pre(vUv + dir * 3.231) + pre(vUv - dir * 3.231)) * 0.070;
  gl_FragColor = vec4(s, 1.0);
}`;

const ACC_FRAG = `uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * w, 1.0); }`;

// Композиция: сцена + DOF + bloom + HUD
const COMP_FRAG = `
uniform sampler2D tScene, tDepth, tDof, tBloom, tHud;
uniform float near, far, focus, focusRange, dofAmt, bloomAmt, hudAlpha, exposure;
uniform vec3 tint;
varying vec2 vUv;
float linDepth(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  if(dofAmt > 0.0){
    float z = linDepth(texture2D(tDepth, vUv).r);
    float coc = clamp(abs(z - focus) / focusRange, 0.0, 1.0) * dofAmt;
    c = mix(c, texture2D(tDof, vUv).rgb, coc);
  }
  c += texture2D(tBloom, vUv).rgb * bloomAmt;
  c *= exposure * tint;
  vec4 h = texture2D(tHud, vUv);
  c = c * (1.0 - h.a * hudAlpha) + h.rgb * hudAlpha;
  gl_FragColor = vec4(c, 1.0);
}`;

// Финальные эффекты: глитч-смещение, CA, радиальный blur, VHS, шум, виньетка
const FX_FRAG = `
uniform sampler2D tComp, tHudBloom; uniform float time, ca, glitch, tear, noiseAmt, scan, vig, grain, radial, flash, fade, rgbSplit, hudGlow, curve, staticAmt, redFlash, pixelate;
uniform vec2 radialCenter; varying vec2 vUv;
float h11(float p){ return fract(sin(p * 127.1) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 sampleCA(vec2 uv, float amt){
  vec2 d = (uv - 0.5) * amt;
  return vec3(texture2D(tComp, uv + d).r, texture2D(tComp, uv).g, texture2D(tComp, uv - d).b);
}
void main(){
  vec2 uv = vUv;
  // кривизна CRT
  if(curve > 0.0){ vec2 cc = uv - 0.5; uv = 0.5 + cc * (1.0 + curve * dot(cc, cc)); }
  if(pixelate > 0.0){ vec2 px = vec2(1920.0, 1080.0) / (1.0 + pixelate * 40.0); uv = (floor(uv * px) + 0.5) / px; }
  float tf = floor(time * 24.0);
  // блочный глитч
  if(glitch > 0.0){
    float row = floor(uv.y * mix(14.0, 60.0, h11(tf * 1.7)));
    float r = h11(row * 3.1 + tf);
    if(r < glitch * 0.55){ uv.x += (h11(row + tf * 7.0) - 0.5) * 0.25 * glitch; }
    vec2 blk = floor(uv * vec2(18.0, 10.0));
    if(h21(blk + tf) < glitch * 0.12){ uv = fract(uv + vec2(h11(tf + blk.x) - 0.5, 0.0) * 0.1); }
  }
  // горизонтальный разрыв VHS
  if(tear > 0.0){
    float band = smoothstep(0.0, 0.02, abs(uv.y - fract(time * 0.37))) ;
    uv.x += (1.0 - band) * 0.03 * tear * sin(uv.y * 900.0);
    uv.x += sin(uv.y * 40.0 + time * 13.0) * 0.0015 * tear;
  }
  float caAmt = ca * 0.012 + rgbSplit * 0.03 * (h11(tf * 3.3) - 0.5);
  vec3 col = sampleCA(uv, caAmt);
  if(radial > 0.0){
    vec3 acc = col; float wsum = 1.0;
    for(int i = 1; i < 12; i++){
      float k = float(i) / 12.0;
      vec2 u2 = radialCenter + (uv - radialCenter) * (1.0 - radial * 0.18 * k);
      acc += texture2D(tComp, u2).rgb * (1.0 - k * 0.6); wsum += 1.0 - k * 0.6;
    }
    col = acc / wsum;
  }
  col += texture2D(tHudBloom, uv).rgb * hudGlow;
  // статика ТВ
  float n = h21(uv * vec2(1920.0, 1080.0) * 0.5 + tf * 13.7);
  col = mix(col, vec3(n) * vec3(0.85, 1.0, 0.9), staticAmt);
  col += (n - 0.5) * grain;
  // линии развёртки
  col *= 1.0 - scan * (0.5 + 0.5 * sin(uv.y * 1080.0 * 3.14159)) * 0.35;
  // шумовая полоса VHS
  float bandY = fract(time * 0.21);
  col += noiseAmt * smoothstep(0.03, 0.0, abs(uv.y - bandY)) * (h21(uv * 900.0 + tf) - 0.3) * 0.18;
  col += noiseAmt * (h21(vec2(uv.y * 400.0, tf)) - 0.5) * 0.08;
  // виньетка
  vec2 vv = vUv - 0.5; col *= 1.0 - vig * smoothstep(0.25, 0.85, length(vv * vec2(1.25, 1.0)));
  if(curve > 0.0 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) col = vec3(0.0);
  col = mix(col, vec3(1.0), flash);
  col = mix(col, vec3(1.0, 0.0, 0.2), redFlash * 0.6);
  col *= 1.0 - fade;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const DEFAULT_FX = {
  ca: 0.15, glitch: 0, tear: 0, noiseAmt: 0.15, scan: 0.25, vig: 0.65, grain: 0.05, radial: 0,
  radialCenter: [0.5, 0.5], flash: 0, fade: 0, rgbSplit: 0, hudGlow: 1.1, curve: 0, staticAmt: 0, redFlash: 0, pixelate: 0,
  bloom: 0.9, bloomThreshold: 0.45, dof: 0, focus: 10, focusRange: 8, exposure: 1, tint: [1, 1, 1], hudAlpha: 1,
  samples: 1, shutter: 0.5,
};

class Engine {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1); r.setSize(W, H, false);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    this.r = r;
    const mk = (w, h, opts = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, ...opts });
    const depthTexture = new THREE.DepthTexture(W, H);
    const q = new URLSearchParams(location.search);
    this.rtScene = mk(W, H, { samples: +(q.get('msaa') ?? 4), depthTexture });
    this.rtAcc = mk(W, H);
    this.rtComp = mk(W, H);
    this.rtHalfA = mk(W / 2, H / 2); this.rtHalfB = mk(W / 2, H / 2);
    this.rtQA = mk(W / 4, H / 4); this.rtQB = mk(W / 4, H / 4);
    this.rtHudA = mk(W / 4, H / 4); this.rtHudB = mk(W / 4, H / 4);
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: BLUR_FRAG, uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() }, threshold: { value: 0 } }, depthTest: false, depthWrite: false });
    this.accMat = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: ACC_FRAG, uniforms: { tex: { value: null }, w: { value: 1 } }, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: COMP_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tDepth: { value: depthTexture }, tDof: { value: null }, tBloom: { value: null }, tHud: { value: null },
        near: { value: 0.1 }, far: { value: 100 }, focus: { value: 10 }, focusRange: { value: 8 }, dofAmt: { value: 0 },
        bloomAmt: { value: 1 }, hudAlpha: { value: 1 }, exposure: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) },
      },
    });
    const fxU = { tComp: { value: this.rtComp.texture }, tHudBloom: { value: this.rtHudB.texture }, time: { value: 0 }, radialCenter: { value: new THREE.Vector2(0.5, 0.5) } };
    for (const k of ['ca', 'glitch', 'tear', 'noiseAmt', 'scan', 'vig', 'grain', 'radial', 'flash', 'fade', 'rgbSplit', 'hudGlow', 'curve', 'staticAmt', 'redFlash', 'pixelate']) fxU[k] = { value: 0 };
    this.fxMat = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: FX_FRAG, uniforms: fxU, depthTest: false, depthWrite: false });
    this.hud = new HUD(W, H);
    this.hudTex = new THREE.CanvasTexture(this.hud.canvas);
    this.hudTex.colorSpace = THREE.NoColorSpace;
    this.hudTex.minFilter = THREE.LinearFilter; this.hudTex.generateMipmaps = false;
    this.hudTex.premultiplyAlpha = false;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.fsScene, this.fsCam); }
  blur(src, a, b, px, threshold = 0) {
    const m = this.blurMat;
    m.uniforms.tex.value = src; m.uniforms.threshold.value = threshold; m.uniforms.dir.value.set(px / a.width, 0); this.pass(m, a);
    m.uniforms.tex.value = a.texture; m.uniforms.threshold.value = 0; m.uniforms.dir.value.set(0, px / a.height); this.pass(m, b);
  }
  frame(t, scenes) {
    const sc = scenes.find((s) => t >= s.start && t < s.end) || scenes[scenes.length - 1];
    const fx = { ...DEFAULT_FX, ...(sc.mod.fx ? sc.mod.fx(t) : {}) };
    const r = this.r;
    const N = Math.max(1, Math.round(fx.samples));
    let sceneTex;
    if (N === 1) {
      const { scene, camera } = sc.mod.update(t);
      r.setRenderTarget(this.rtScene); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, camera);
      this.camera = camera; sceneTex = this.rtScene.texture;
    } else {
      // субкадровое накопление (motion blur) — затвор fx.shutter кадра
      r.setRenderTarget(this.rtAcc); r.setClearColor(0x000000, 1); r.clear();
      for (let i = 0; i < N; i++) {
        const ts = t - (fx.shutter / FPS) * (i / (N - 1) - 0.5);
        const { scene, camera } = sc.mod.update(ts);
        r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, camera);
        this.accMat.uniforms.tex.value = this.rtScene.texture; this.accMat.uniforms.w.value = 1 / N;
        this.quad.material = this.accMat; r.setRenderTarget(this.rtAcc); r.autoClear = false; r.render(this.fsScene, this.fsCam); r.autoClear = true;
        this.camera = camera;
      }
      // последний сэмпл — t (для глубины и HUD-якорей)
      const { scene, camera } = sc.mod.update(t);
      r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, camera);
      this.camera = camera; sceneTex = this.rtAcc.texture;
    }
    // bloom: порог → половина → четверть
    this.blur(sceneTex, this.rtHalfA, this.rtHalfB, 1.5, fx.bloomThreshold);
    this.blur(this.rtHalfB.texture, this.rtQA, this.rtQB, 2.5);
    // DOF-размытие: половинное разрешение без порога
    let dofTex = this.rtHalfB.texture;
    if (fx.dof > 0) { this.blur(sceneTex, this.rtHalfA, this.rtHalfB, 2.2); this.blur(this.rtHalfB.texture, this.rtHalfA, this.rtHalfB, 3.0); dofTex = this.rtHalfB.texture; }
    // HUD
    this.hud.clear();
    if (sc.mod.hud) sc.mod.hud(this.hud, t, this.camera);
    this.hudTex.needsUpdate = true;
    this.blur(this.hudTex, this.rtHudA, this.rtHudB, 2.0, -1);
    this.blur(this.rtHudB.texture, this.rtHudA, this.rtHudB, 3.0);
    const cu = this.compMat.uniforms;
    cu.tScene.value = sceneTex; cu.tDof.value = dofTex; cu.tBloom.value = this.rtQB.texture; cu.tHud.value = this.hudTex;
    cu.near.value = this.camera.near; cu.far.value = this.camera.far; cu.focus.value = fx.focus; cu.focusRange.value = fx.focusRange;
    cu.dofAmt.value = fx.dof; cu.bloomAmt.value = fx.bloom; cu.hudAlpha.value = fx.hudAlpha; cu.exposure.value = fx.exposure;
    cu.tint.value.set(...fx.tint);
    this.pass(this.compMat, this.rtComp);
    const fu = this.fxMat.uniforms;
    fu.time.value = t;
    for (const k of ['ca', 'glitch', 'tear', 'noiseAmt', 'scan', 'vig', 'grain', 'radial', 'flash', 'fade', 'rgbSplit', 'hudGlow', 'curve', 'staticAmt', 'redFlash', 'pixelate']) fu[k].value = fx[k];
    fu.radialCenter.value.set(...fx.radialCenter);
    this.pass(this.fxMat, null);
  }
}

async function loadFonts() {
  await Promise.all(FONTS.map(async ([fam, file]) => {
    const f = new FontFace(fam, `url(assets/fonts/${file})`);
    await f.load(); document.fonts.add(f);
  }));
}

export async function boot(canvas) {
  await loadFonts();
  const engine = new Engine(canvas);
  const mods = [scene1, scene2, scene3, scene4, scene5, scene6];
  const ctx = { THREE, renderer: engine.r, W, H };
  const scenes = [];
  for (let i = 0; i < SCENES.length; i++) {
    await mods[i].init(ctx);
    scenes.push({ ...SCENES[i], mod: mods[i] });
  }
  const renderAt = (t) => { engine.frame(Math.min(t, DURATION - 1e-4), scenes); return true; };
  return { renderAt, duration: DURATION };
}
