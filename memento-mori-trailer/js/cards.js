// Telegram screenshots as physical glass tiles, and giant chrome words rendered from web fonts.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { uiMaterial } from './phone.js';

function roundedRectGeo(w, h, r, seg = 10) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, seg);
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / w + 0.5; uv[i * 2 + 1] = p.getY(i) / h + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// crop: fraction of the image height to keep from the top (screenshots are never redrawn, only framed)
export function createCard(A, tex, { width = 1.0, crop = 1.0, thickness = 0.035, envMap = null } = {}) {
  const img = tex.image;
  const aspect = (img.height * crop) / img.width;
  const h = width * aspect;
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(1, crop); t.offset.set(0, 1 - crop);
  t.anisotropy = 4;
  const g = new THREE.Group();
  const r = Math.min(0.045, width * 0.05);
  const face = new THREE.Mesh(roundedRectGeo(width, h, r), uiMaterial(t));
  face.position.z = thickness / 2 + 0.001;
  face.renderOrder = 3;
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.9, roughness: 0.18, envMap: envMap || A.envRoom, envMapIntensity: 1.4 });
  const slab = new THREE.Mesh(new RoundedBoxGeometry(width + 0.03, h + 0.03, thickness, 4, Math.min(0.03, thickness * 0.45)), slabMat);
  slab.castShadow = true;
  const gloss = new THREE.Mesh(roundedRectGeo(width + 0.02, h + 0.02, r), new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1, roughness: 0.05, transparent: true, opacity: 0.16, envMap: envMap || A.envRoom, envMapIntensity: 1.8, depthWrite: false }));
  gloss.position.z = thickness / 2 + 0.003;
  gloss.renderOrder = 4;
  g.add(slab, face, gloss);
  g.userData = { width, height: h, face, slab, gloss };
  return g;
}

export function setCardOpacity(card, o) {
  const { face, slab, gloss } = card.userData;
  face.material.opacity = o;
  face.visible = slab.visible = gloss.visible = o > 0.002;
  slab.material.transparent = o < 0.999; slab.material.opacity = o;
  gloss.material.opacity = 0.16 * o;
}

// Big chrome word: text rasterised with the loaded web font, shaded as polished metal with a moving glint.
export function createWord(text, { font = '900 400px "Sofia Sans Extra Condensed"', height = 0.6, spacing = 0.02 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const m = g.measureText(text);
  const pad = 40;
  const fontPx = parseInt(font.match(/(\d+)px/)[1], 10);
  c.width = Math.ceil(m.width + pad * 2 + spacing * fontPx * text.length);
  c.height = Math.ceil(fontPx * 1.08 + pad * 2);
  g.font = font; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing * fontPx}px`;
  g.fillText(text, pad, pad + fontPx * 0.86);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
  const w = height * (c.width / c.height);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tText: { value: tex }, uReveal: { value: 0 }, uGlint: { value: -0.5 }, uBright: { value: 1.6 }, uOpacity: { value: 1 }, uRed: { value: 0 }, uSlice: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tText; uniform float uReveal; uniform float uGlint; uniform float uBright; uniform float uOpacity; uniform float uRed; uniform float uSlice; uniform float uSeed;
      float h(float n){ return fract(sin(n * 78.233 + uSeed) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float band = floor(uv.y * 9.0);
        uv.x += (h(band) - 0.5) * uSlice * 0.12;
        float a = texture2D(tText, uv).a;
        float edge = uReveal * 1.25 - 0.12;
        float m = smoothstep(edge, edge - 0.12, uv.x + (h(band + 7.0) - 0.5) * 0.08);
        float y = uv.y;
        vec3 chrome = mix(vec3(0.16, 0.17, 0.19), vec3(1.0), smoothstep(0.32, 0.62, y));
        chrome = mix(chrome, vec3(0.35, 0.37, 0.4), smoothstep(0.6, 0.66, y) * 0.8);
        chrome = mix(chrome, vec3(0.92, 0.94, 0.97), smoothstep(0.66, 0.85, y));
        float glint = exp(-pow((uv.x - uGlint) * 6.0 - (y - 0.5) * 2.0, 2.0) * 3.0);
        vec3 col = chrome * uBright + vec3(1.0, 0.98, 0.95) * glint * 2.5;
        col = mix(col, vec3(1.0, 0.12, 0.06) * 2.2, uRed * (1.0 - smoothstep(0.0, 0.03, abs(uv.x - edge + 0.06))));
        float edgeGlow = (1.0 - smoothstep(0.0, 0.025, abs(uv.x - (edge - 0.06)))) * step(uReveal, 0.99);
        col += vec3(1.0, 0.25, 0.15) * edgeGlow * 3.0;
        gl_FragColor = vec4(col, a * m * uOpacity);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat);
  mesh.userData = { width: w, height, mat };
  mesh.renderOrder = 1;
  return mesh;
}
