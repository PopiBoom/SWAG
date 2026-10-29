// Black titanium smartphone. The screen shows real Telegram screenshots; screen pixels are flagged
// (alpha = 0) so the post pipeline shows them untouched by tone mapping and grading.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PHONE = { w: 0.75, h: 1.56, d: 0.082, r: 0.105 };

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function planarUV(geo, w, h) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / w + 0.5; uv[i * 2 + 1] = p.getY(i) / h + 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Material for real UI imagery: unlit; its coverage is written into the render target alpha
// (dstAlpha *= 1 - srcAlpha) so the final pass shows these pixels without tone mapping or grading.
export function uiMaterial(map, { opacity = 1, side = THREE.FrontSide, depthWrite = true } = {}) {
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, opacity, side, depthWrite, fog: false });
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.userData.uniforms = { uUiGain: { value: 1.0 } };
  m.onBeforeCompile = sh => {
    sh.uniforms.uUiGain = m.userData.uniforms.uUiGain;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uUiGain;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= uUiGain;');
  };
  m.customProgramCacheKey = () => 'ui';
  return m;
}

// Compose the phone screen: status bar strip with the hardware island + a real screenshot below.
export function makeScreenTexture(img, { crop = 0 } = {}) {
  const W = 1572, H = 3408, bar = 196;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const s = W / img.width;
  g.drawImage(img, 0, crop, img.width, (H - bar) / s, 0, bar, W, H - bar);
  // status bar glyphs (device chrome, not Telegram UI)
  g.fillStyle = '#f2f2f2';
  g.font = '600 62px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
  g.fillText('9:41', 120, 112);
  const bx = W - 250, by = 92;
  for (let i = 0; i < 4; i++) g.fillRect(bx - 150 + i * 26, by + 30 - i * 10, 18, 12 + i * 10);
  g.strokeStyle = '#f2f2f2'; g.lineWidth = 5; g.beginPath(); g.roundRect(bx, by - 4, 110, 48, 12); g.stroke();
  g.fillRect(bx + 8, by + 4, 80, 32); g.fillRect(bx + 116, by + 10, 8, 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return t;
}

export function createPhone(A, screenTex) {
  const g = new THREE.Group();
  const { w, h, d, r } = PHONE;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111114, metalness: 0.92, roughness: 0.3, envMap: A.envRoom, envMapIntensity: 1.1 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 8, r * 0.6), bodyMat);
  body.castShadow = true;
  g.add(body);
  // black glass front with a thin bezel
  const sw = w - 0.03, sh = h - 0.03;
  const glassGeo = planarUV(new THREE.ShapeGeometry(roundedRectShape(sw, sh, r * 0.82), 12), sw, sh);
  const bezel = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.15, metalness: 0.0 }));
  bezel.position.z = d / 2 + 0.0006;
  g.add(bezel);
  const vw = sw - 0.034, vh = sh - 0.034;
  const screenGeo = planarUV(new THREE.ShapeGeometry(roundedRectShape(vw, vh, r * 0.72), 12), vw, vh);
  const screenMat = uiMaterial(screenTex);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = d / 2 + 0.0012;
  g.add(screen);
  // dynamic island
  const island = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(0.19, 0.055, 0.0275), 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  island.position.set(0, vh / 2 - 0.045, d / 2 + 0.0016);
  g.add(island);
  // reflective cover glass
  const cover = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.04, metalness: 1.0, transparent: true, opacity: 0.22, envMap: A.envRoom, envMapIntensity: 1.6, depthWrite: false }));
  cover.position.z = d / 2 + 0.0022;
  cover.renderOrder = 2;
  g.add(cover);
  // side buttons
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.95, roughness: 0.28, envMap: A.envRoom });
  const btn = (y, len, side) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.012, len, 0.03, 3, 0.005), btnMat); m.position.set(side * (w / 2 + 0.004), y, 0); g.add(m); };
  btn(0.38, 0.12, -1); btn(0.22, 0.12, -1); btn(0.46, 0.06, -1); btn(0.3, 0.2, 1);
  // camera plateau on the back
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.33, 0.33, 0.02, 4, 0.06), bodyMat);
  plate.position.set(-w / 2 + 0.2, h / 2 - 0.2, -d / 2 - 0.006);
  g.add(plate);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x050608, metalness: 0.6, roughness: 0.08, envMap: A.envRoom, envMapIntensity: 2 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 1.0, roughness: 0.25, envMap: A.envRoom });
  for (const [x, y] of [[-0.075, 0.075], [-0.075, -0.075], [0.08, 0.0]]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 32), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(plate.position.x + x, plate.position.y + y, -d / 2 - 0.022);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.032, 32), lensMat);
    lens.rotation.x = Math.PI / 2; lens.position.copy(ring.position); lens.position.z -= 0.002;
    g.add(ring, lens);
  }
  g.userData = { screen, screenMat, bodyMat, cover };
  return g;
}
