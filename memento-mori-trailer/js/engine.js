// Renderer + cinematic post pipeline: HDR scene -> half-res bokeh DOF -> dual-filter bloom ->
// AgX tone map, grade, chromatic aberration, vignette, grain, fades. Optional sub-frame motion blur.
import * as THREE from 'three';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DEPTH_FN = /* glsl */`
uniform float cameraNear; uniform float cameraFar;
float linDepth(float d){ float z = d * 2.0 - 1.0; return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear)); }`;

function fsQuad(material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  m.frustumCulled = false;
  return m;
}

export class Engine {
  constructor(canvas, { width, height, pixelRatio = 1, samples = 0 }) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    r.setPixelRatio(pixelRatio);
    r.setSize(width, height, false);
    r.outputColorSpace = THREE.LinearSRGBColorSpace; // we encode sRGB ourselves in the final pass
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = true;
    this.W = Math.round(width * pixelRatio);
    this.H = Math.round(height * pixelRatio);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.05, 200);
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fx = {
      exposure: 1.0, bloomStrength: 0.6, bloomThreshold: 1.0, bloomKnee: 0.6,
      focus: 3.0, aperture: 0.0, maxBlur: 14.0,
      vignette: 0.55, grain: 0.06, chroma: 0.0025, saturation: 0.92, contrast: 1.08,
      lift: [0.0, 0.0, 0.0], gain: [1, 1, 1], redKeep: 0.6,
      fade: 0.0, flash: 0.0, flashColor: [1, 1, 1], frame: 0,
    };
    this._buildTargets(samples);
    this._buildPasses();
  }

  _rt(w, h, opts = {}) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...opts,
    });
  }

  _buildTargets(samples) {
    const { W, H } = this;
    const depthTexture = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
    this.sceneRT = this._rt(W, H, { depthBuffer: true, depthTexture, samples });
    // keep the blur buffers near 1080p regardless of output size
    const div = Math.max(2, Math.round(2 * Math.max(1, W / 1080)));
    const hw = Math.ceil(W / div), hh = Math.ceil(H / div);
    this.dofDiv = div;
    this.dofPrepRT = this._rt(hw, hh);
    this.dofBlurRT = this._rt(hw, hh);
    this.bloomDown = []; this.bloomUp = [];
    let w = hw, h = hh;
    for (let i = 0; i < 6; i++) {
      this.bloomDown.push(this._rt(w, h));
      this.bloomUp.push(this._rt(w, h));
      w = Math.max(1, Math.ceil(w / 2)); h = Math.max(1, Math.ceil(h / 2));
    }
    this.accumRT = this._rt(W, H, { type: THREE.FloatType });
    this.finalRT = this._rt(W, H);
  }

  _buildPasses() {
    const depthUniforms = { cameraNear: { value: 0.1 }, cameraFar: { value: 100 } };
    this.prepMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      uniforms: { tColor: { value: null }, tDepth: { value: null }, ...depthUniforms },
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; ${DEPTH_FN}
        void main(){
          vec4 c = texture2D(tColor, vUv);
          float d = linDepth(texture2D(tDepth, vUv).x);
          gl_FragColor = vec4(min(c.rgb, vec3(60.0)), d);
        }`,
    });
    this.dofMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      uniforms: { tPrep: { value: null }, texel: { value: new THREE.Vector2() }, focus: { value: 3 }, aperture: { value: 0 }, maxBlur: { value: 12 } },
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tPrep; uniform vec2 texel; uniform float focus; uniform float aperture; uniform float maxBlur;
        const float GOLDEN = 2.39996323;
        float blurSize(float d){ float coc = clamp((d - focus) / max(d, 1e-3) * aperture, -1.0, 1.0); return abs(coc) * maxBlur; }
        void main(){
          vec4 c0 = texture2D(tPrep, vUv);
          float cd = c0.a; float cs = blurSize(cd);
          vec3 col = c0.rgb; float tot = 1.0; float radius = 0.6;
          for (int i = 0; i < 64; i++) {
            if (radius >= maxBlur) break;
            float ang = float(i) * GOLDEN;
            vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
            vec4 s = texture2D(tPrep, tc);
            float ss = blurSize(s.a);
            if (s.a > cd) ss = clamp(ss, 0.0, cs * 2.0);
            float m = smoothstep(radius - 0.5, radius + 0.5, ss);
            col += mix(col / tot, s.rgb, m); tot += 1.0;
            radius += 0.6 / radius * 1.6 + 0.35;
          }
          gl_FragColor = vec4(col / tot, cs);
        }`,
    });
    this.bloomPreMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      uniforms: { tColor: { value: null }, threshold: { value: 1 }, knee: { value: 0.5 } },
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tColor; uniform float threshold; uniform float knee;
        void main(){
          vec3 c = texture2D(tColor, vUv).rgb;
          float br = max(c.r, max(c.g, c.b));
          float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee); rq = rq * rq / (4.0 * knee + 1e-4);
          float w = max(rq, br - threshold) / max(br, 1e-4);
          gl_FragColor = vec4(min(c * w, vec3(30.0)), 1.0);
        }`,
    });
    this.downMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, texel: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 texel;
        void main(){
          vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
          s += texture2D(tSrc, vUv + texel * vec2( 1.0,  1.0)).rgb;
          s += texture2D(tSrc, vUv + texel * vec2(-1.0,  1.0)).rgb;
          s += texture2D(tSrc, vUv + texel * vec2( 1.0, -1.0)).rgb;
          s += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
          gl_FragColor = vec4(s / 8.0, 1.0);
        }`,
    });
    this.upMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, tAdd: { value: null }, texel: { value: new THREE.Vector2() }, mixAdd: { value: 1 } },
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 texel; uniform float mixAdd;
        void main(){
          vec2 o = texel;
          vec3 s = texture2D(tSrc, vUv + vec2(-2.0*o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(2.0*o.x, 0.0)).rgb
                 + texture2D(tSrc, vUv + vec2(0.0, -2.0*o.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, 2.0*o.y)).rgb;
          s += (texture2D(tSrc, vUv + o).rgb + texture2D(tSrc, vUv - o).rgb + texture2D(tSrc, vUv + vec2(o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x,o.y)).rgb) * 2.0;
          gl_FragColor = vec4(s / 12.0 + texture2D(tAdd, vUv).rgb * mixAdd, 1.0);
        }`,
    });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      uniforms: {
        tSharp: { value: null }, tBlur: { value: null }, tBloom: { value: null }, tDepth: { value: null }, ...depthUniforms,
        focus: { value: 3 }, aperture: { value: 0 }, maxBlurFull: { value: 24 },
        bloomStrength: { value: 0.6 }, exposure: { value: 1 }, vignette: { value: 0.5 }, chroma: { value: 0.002 },
        saturation: { value: 1 }, contrast: { value: 1 }, lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) }, redKeep: { value: 0.5 },
        fade: { value: 0 }, flash: { value: 0 }, flashColor: { value: new THREE.Vector3(1, 1, 1) }, aspect: { value: 1 }, uiExposure: { value: 1 }, glitch: { value: 0 }, glitchSeed: { value: 0 },
      },
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        uniform sampler2D tSharp; uniform sampler2D tBlur; uniform sampler2D tBloom; uniform sampler2D tDepth;
        uniform float focus; uniform float aperture; uniform float maxBlurFull;
        uniform float bloomStrength; uniform float exposure; uniform float vignette; uniform float chroma;
        uniform float saturation; uniform float contrast; uniform vec3 lift; uniform vec3 gain; uniform float redKeep;
        uniform float fade; uniform float flash; uniform vec3 flashColor; uniform float aspect; uniform float uiExposure;
        ${DEPTH_FN}
        const mat3 SRGB_TO_2020 = mat3(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956);
        const mat3 R2020_TO_SRGB = mat3(1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187);
        const mat3 AgXIn = mat3(0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859);
        const mat3 AgXOut = mat3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405);
        vec3 agxCurve(vec3 x){ vec3 x2 = x*x; vec3 x4 = x2*x2; return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
        vec3 agx(vec3 c){
          c = SRGB_TO_2020 * c; c = AgXIn * c; c = max(c, 1e-10); c = log2(c);
          c = (c + 12.47393) / (4.026069 + 12.47393); c = clamp(c, 0.0, 1.0); c = agxCurve(c);
          c = AgXOut * c; c = pow(max(vec3(0.0), c), vec3(2.2)); c = R2020_TO_SRGB * c; return clamp(c, 0.0, 1.0);
        }
        float dofMix(vec2 uv){
          if (aperture <= 0.0) return 0.0;
          float d = linDepth(texture2D(tDepth, uv).x);
          float coc = abs(clamp((d - focus) / max(d, 1e-3) * aperture, -1.0, 1.0)) * maxBlurFull;
          return smoothstep(0.8, 3.0, max(coc, texture2D(tBlur, uv).a * 2.0));
        }
        vec3 hdr(vec2 uv, float m){
          vec3 c = m > 0.001 ? mix(texture2D(tSharp, uv).rgb, texture2D(tBlur, uv).rgb, m) : texture2D(tSharp, uv).rgb;
          return c + texture2D(tBloom, uv).rgb * bloomStrength;
        }
        vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
        uniform float glitch; uniform float glitchSeed;
        float gh(float n){ return fract(sin(n * 91.3458 + glitchSeed * 17.17) * 47453.5453); }
        void main(){
          vec2 uv0 = vUv;
          if (glitch > 0.0) {
            float band = floor(vUv.y * 22.0 + gh(1.0) * 7.0);
            float sb = floor(vUv.y * 90.0);
            float on = step(0.62, gh(band)) * glitch;
            uv0.x += (gh(band + 3.1) - 0.5) * 0.16 * on + (gh(sb) - 0.5) * 0.01 * glitch;
          }
          vec2 dc = uv0 - 0.5; dc.x *= aspect;
          float r2 = dot(dc, dc);
          vec2 off = (uv0 - 0.5) * chroma * (0.4 + r2 * 3.0) + vec2(glitch * 0.012, 0.0);
          vec3 c;
          float m = dofMix(uv0);
          c.r = hdr(uv0 + off, m).r; c.g = hdr(uv0, m).g; c.b = hdr(uv0 - off, m).b;
          float uiW = clamp(1.0 - texture2D(tSharp, uv0).a, 0.0, 1.0);
          vec3 ui = clamp(c * uiExposure, 0.0, 1.0);
          c *= exposure;
          c = agx(c);
          // grade (display-referred, linear)
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float redness = clamp((c.r - max(c.g, c.b)) * 4.0, 0.0, 1.0);
          c = mix(vec3(l), c, mix(saturation, max(saturation, 1.25), redness * redKeep));
          c = (c - 0.18) * contrast + 0.18;
          c = max(c, 0.0) * gain + lift * (1.0 - c);
          c = mix(c, ui, uiW);
          float vig = smoothstep(0.85, 0.15, length(dc * vec2(0.9, 0.62)));
          c *= mix(1.0, vig, vignette);
          c = mix(c, flashColor, flash);
          c *= 1.0 - fade;
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
    });
    this.accumMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
      uniforms: { tSrc: { value: null }, weight: { value: 1 } },
      fragmentShader: `varying vec2 vUv; uniform sampler2D tSrc; uniform float weight; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, weight); }`,
    });
    this.presentMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, grain: { value: 0.05 }, frame: { value: 0 }, res: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tSrc; uniform float grain; uniform float frame; uniform vec2 res;
        uint ih(uint x){ x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
        float h(vec2 p){ uvec2 q = uvec2(max(p, 0.0)); return float(ih(q.x + ih(q.y + 0x9e3779b9U))) / 4294967295.0; }
        vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
        void main(){
          vec3 c = texture2D(tSrc, vUv).rgb;
          vec2 px = floor(vUv * res / max(1.0, res.x / 1080.0) / 1.5);
          float n = h(px + vec2(frame * 1931.0, frame * 7.0)) + h(px + vec2(frame * 389.0 + 5000.0, 9000.0)) - 1.0;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c += n * grain * (0.35 + 0.65 * (1.0 - l)) * (0.25 + l);
          c = toSRGB(clamp(c, 0.0, 1.0));
          c += (h(px + vec2(frame * 17.0 + 20000.0, 0.0)) - 0.5) / 255.0;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.quad = fsQuad(this.prepMat);
    this.quadScene.add(this.quad);
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  // Render the HDR scene + post into finalRT (display-linear, no grain).
  _renderOnce() {
    const { renderer: r, fx, camera } = this;
    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, camera);
    const near = camera.near, far = camera.far;
    const dofOn = fx.aperture > 0.0005;
    const half = this.dofPrepRT;
    if (dofOn) {
      this.prepMat.uniforms.tColor.value = this.sceneRT.texture;
      this.prepMat.uniforms.tDepth.value = this.sceneRT.depthTexture;
      this.prepMat.uniforms.cameraNear.value = near; this.prepMat.uniforms.cameraFar.value = far;
      this._pass(this.prepMat, half);
      const u = this.dofMat.uniforms;
      u.tPrep.value = half.texture; u.texel.value.set(1 / half.width, 1 / half.height);
      u.focus.value = fx.focus; u.aperture.value = fx.aperture; u.maxBlur.value = fx.maxBlur;
      this._pass(this.dofMat, this.dofBlurRT);
    }
    // bloom
    const bp = this.bloomPreMat.uniforms;
    bp.tColor.value = this.sceneRT.texture; bp.threshold.value = fx.bloomThreshold; bp.knee.value = fx.bloomKnee;
    this._pass(this.bloomPreMat, this.bloomDown[0]);
    for (let i = 1; i < this.bloomDown.length; i++) {
      const src = this.bloomDown[i - 1];
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this._pass(this.downMat, this.bloomDown[i]);
    }
    const n = this.bloomDown.length;
    let cur = this.bloomDown[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      const u = this.upMat.uniforms;
      u.tSrc.value = cur.texture; u.tAdd.value = this.bloomDown[i].texture; u.texel.value.set(1 / cur.width, 1 / cur.height);
      u.mixAdd.value = 1.0;
      this._pass(this.upMat, this.bloomUp[i]);
      cur = this.bloomUp[i];
    }
    const f = this.finalMat.uniforms;
    f.tSharp.value = this.sceneRT.texture;
    f.tBlur.value = dofOn ? this.dofBlurRT.texture : this.sceneRT.texture;
    f.tBloom.value = cur.texture;
    f.tDepth.value = this.sceneRT.depthTexture;
    f.cameraNear.value = near; f.cameraFar.value = far;
    f.focus.value = fx.focus; f.aperture.value = dofOn ? fx.aperture : 0; f.maxBlurFull.value = fx.maxBlur * this.dofDiv;
    f.bloomStrength.value = fx.bloomStrength / 5.0; f.exposure.value = fx.exposure; f.vignette.value = fx.vignette;
    f.chroma.value = fx.chroma; f.saturation.value = fx.saturation; f.contrast.value = fx.contrast;
    f.lift.value.set(...fx.lift); f.gain.value.set(...fx.gain); f.redKeep.value = fx.redKeep;
    f.fade.value = fx.fade; f.flash.value = fx.flash; f.flashColor.value.set(...fx.flashColor);
    f.aspect.value = this.W / this.H; f.uiExposure.value = fx.uiExposure ?? 1; f.glitch.value = fx.glitch || 0; f.glitchSeed.value = fx.frame % 97;
    this._pass(this.finalMat, this.finalRT);
  }

  present(src) {
    const p = this.presentMat.uniforms;
    p.tSrc.value = src.texture; p.grain.value = this.fx.grain; p.frame.value = this.fx.frame; p.res.value.set(this.W, this.H);
    this._pass(this.presentMat, null);
  }

  // update(t) must set scene + camera + fx for time t.
  render(t, update, { subframes = 1, shutter = 0.5, fps = 60, range = null } = {}) {
    if (subframes <= 1) {
      update(t);
      this._renderOnce();
      this.present(this.finalRT);
      return;
    }
    const r = this.renderer;
    r.setRenderTarget(this.accumRT); r.setClearColor(0x000000, 0); r.clear();
    for (let i = 0; i < subframes; i++) {
      const dt = ((i + 0.5) / subframes - 0.5) * shutter / fps;
      const ts = range ? Math.min(range[1], Math.max(range[0], t + dt)) : t + dt;
      update(ts);
      this._renderOnce();
      this.accumMat.uniforms.tSrc.value = this.finalRT.texture;
      this.accumMat.uniforms.weight.value = 1 / subframes;
      this._pass(this.accumMat, this.accumRT);
    }
    update(t); // leave the scene at the exact frame time (DOM overlays read it)
    this.present(this.accumRT);
  }
}
