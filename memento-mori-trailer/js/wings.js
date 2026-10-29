// Procedural feathered wings: arm skeleton (shoulder/elbow/wrist), rows of instanced feathers
// (primaries, secondaries, tertials, coverts, scapulars) that fan out as the wing opens.
import * as THREE from 'three';
import { mulberry32, lerp, clamp } from './util.js';

function featherTexture(seed) {
  const W = 256, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  g.clearRect(0, 0, W, H);
  const cx = W * 0.44;
  // vane outline: asymmetric, rounded tip; root at bottom
  const left = y => { const t = y / H; return (Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.55) * 0.92 + 0.08) * W * 0.36 * (t < 0.06 ? t / 0.06 : 1); };
  const right = y => { const t = y / H; return (Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.03)), 0.5) * 0.9 + 0.1) * W * 0.54 * (t < 0.06 ? t / 0.06 : 1); };
  // solid vane base (keeps alpha coverage at every mip level)
  g.fillStyle = '#2b2b30';
  g.beginPath(); g.moveTo(cx, H);
  for (let y = 0; y <= H; y += 8) g.lineTo(cx - left(y), H - y);
  for (let y = H; y >= 0; y -= 8) g.lineTo(cx + right(y), H - y);
  g.closePath(); g.fill();
  // barbs
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 520; i++) {
      const y0 = H * (0.04 + 0.95 * (i / 520)) + rnd() * 2;
      const len = (side < 0 ? left(y0) : right(y0)) * 0.98;
      const x1 = cx + side * len, y1 = y0 + len * (0.55 + rnd() * 0.12); // barbs sweep toward the tip
      const v = 26 + rnd() * 46;
      g.strokeStyle = `rgba(${v},${v},${v + 4},0.85)`;
      g.lineWidth = 1.6 + rnd() * 1.2;
      g.beginPath(); g.moveTo(cx, H - y0); g.quadraticCurveTo(cx + (x1 - cx) * 0.5, H - y0 - (y1 - y0) * 0.2, x1, H - y1); g.stroke();
    }
  }
  // splits in the vane
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 7; k++) {
    const yy = H * (0.25 + rnd() * 0.65), y = H - yy, side = rnd() < 0.5 ? -1 : 1, len = (side < 0 ? left(yy) : right(yy));
    g.lineWidth = 3 + rnd() * 5;
    g.beginPath(); g.moveTo(cx + side * len * (0.25 + rnd() * 0.3), y); g.lineTo(cx + side * len * 1.2, y - len * 0.7); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  // rachis
  const grd = g.createLinearGradient(0, H, 0, 0);
  grd.addColorStop(0, 'rgba(150,150,155,1)'); grd.addColorStop(1, 'rgba(70,70,74,1)');
  g.strokeStyle = grd; g.lineWidth = 7;
  g.beginPath(); g.moveTo(cx, H); g.lineTo(cx, H * 0.03); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  // edge map: bright along the vane outline and the rachis (backlit barb tips)
  const e = document.createElement('canvas'); e.width = W / 2; e.height = H / 2;
  const eg = e.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, e.width, e.height);
  eg.scale(0.5, 0.5);
  eg.strokeStyle = '#fff'; eg.lineWidth = 7; eg.shadowColor = '#fff'; eg.shadowBlur = 18;
  eg.beginPath(); eg.moveTo(cx, H);
  for (let y = 0; y <= H; y += 8) eg.lineTo(cx - left(y), H - y);
  for (let y = H; y >= 0; y -= 8) eg.lineTo(cx + right(y), H - y);
  eg.stroke();
  eg.lineWidth = 3; eg.shadowBlur = 6; eg.strokeStyle = 'rgba(255,255,255,0.5)';
  eg.beginPath(); eg.moveTo(cx, H); eg.lineTo(cx, H * 0.03); eg.stroke();
  const et = new THREE.CanvasTexture(e);
  et.colorSpace = THREE.SRGBColorSpace;
  return { map: t, edge: et };
}

function featherGeometry() {
  // root at origin, length along +y (0..1), width along x (-0.44..0.56 to match the texture rachis)
  const g = new THREE.PlaneGeometry(1, 1, 2, 14);
  g.translate(0.06, 0.5, 0);
  return g;
}

export function createWings({ seed = 3, color = 0xa4a6ae, span = 1.0, shoulder = 0.2 } = {}) {
  const rnd = mulberry32(seed);
  const { map: tex, edge: edgeTex } = featherTexture(seed + 10);
  const geo = featherGeometry();
  const feathers = [];
  // arm segment lengths
  const L1 = 0.85 * span, L2 = 1.05 * span, L3 = 0.95 * span;
  const add = (bone, u, len, wid, angOpen, angFold, layer, row) => feathers.push({ bone, u, len, wid, angOpen, angFold, layer, row, phase: rnd() * 6.28, jit: (rnd() - 0.5) * 0.08, curl: 0.12 + rnd() * 0.12 });
  // primaries on the hand: outermost points along the hand, inner ones rotate downward
  for (let i = 0; i < 11; i++) { const k = i / 10; add(2, 1 - k * 0.92, lerp(1.75, 1.2, k) * span, lerp(0.2, 0.26, k) * span, lerp(-0.06, -1.25, Math.pow(k, 0.9)), lerp(-0.02, -0.18, k), 0, 0); }
  // secondaries on the forearm
  for (let i = 0; i < 15; i++) { const k = i / 14; add(1, 1 - k * 0.98, lerp(1.15, 1.02, k) * span, 0.27 * span, lerp(-1.35, -1.72, k), lerp(-0.2, -0.28, k), 0, 1); }
  // tertials near the body
  for (let i = 0; i < 5; i++) { const k = i / 4; add(0, 0.9 - k * 0.7, lerp(0.95, 0.7, k) * span, 0.26 * span, lerp(-1.8, -2.15, k), -0.3, 0, 2); }
  // greater coverts over primaries + secondaries
  for (let i = 0; i < 12; i++) { const k = i / 11; add(2, 0.95 - k * 0.9, lerp(0.72, 0.55, k) * span, 0.2 * span, lerp(-0.25, -1.3, k), -0.1, 1, 3); }
  for (let i = 0; i < 16; i++) { const k = i / 15; add(1, 0.98 - k * 0.98, 0.6 * span, 0.22 * span, lerp(-1.4, -1.75, k), -0.22, 1, 3); }
  // median coverts
  for (let i = 0; i < 30; i++) { const k = i / 29; const bone = k < 0.4 ? 2 : 1; const u = bone === 2 ? 0.9 - (k / 0.4) * 0.85 : 1 - ((k - 0.4) / 0.6) * 0.98; add(bone, u, 0.36 * span, 0.17 * span, lerp(-0.5, -1.7, k), -0.2, 2, 4); }
  // lesser / marginal coverts (scale-like rows along the leading edge)
  for (let r = 0; r < 3; r++) for (let i = 0; i < 28; i++) {
    const k = i / 27; const bone = k < 0.33 ? 2 : k < 0.8 ? 1 : 0; const lk = bone === 2 ? k / 0.33 : bone === 1 ? (k - 0.33) / 0.47 : (k - 0.8) / 0.2;
    add(bone, bone === 2 ? 0.85 - lk * 0.8 : 1 - lk * 0.95, (0.22 - r * 0.045) * span, (0.12 - r * 0.02) * span, lerp(-0.7, -1.8, k) + r * 0.15, -0.2, 3 + r, 5 + r);
  }
  // scapulars
  for (let i = 0; i < 10; i++) { const k = i / 9; add(0, 0.5 - k * 0.45, lerp(0.75, 0.5, k) * span, 0.22 * span, lerp(-2.0, -2.5, k), -0.35, 2, 8); }

  const mat = new THREE.MeshStandardMaterial({ color, map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.36, metalness: 0.25, envMapIntensity: 0.8, emissiveMap: edgeTex, emissive: new THREE.Color(0, 0, 0) });
  const U = mat.userData.uniforms = { uTime: { value: 0 }, uRim: { value: new THREE.Color(0.75, 0.78, 0.85) }, uRimAmt: { value: 0.25 }, uEdge: { value: new THREE.Color(0, 0, 0) }, uBack: { value: new THREE.Color(1.0, 0.08, 0.04) }, uBackAmt: { value: 0 }, uFlutter: { value: 0.02 } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aFeather; uniform float uTime; uniform float uFlutter; varying float vAlong;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        // mirrored (left) wing instances: compensate the winding flip so lighting stays on the visible side
        if (determinant(mat3(instanceMatrix)) < 0.0) objectNormal = -objectNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float along = position.y; vAlong = along;
        float bend = aFeather.x * along * along;
        transformed.z += bend + sin(uTime * 3.1 + aFeather.y + along * 2.5) * uFlutter * along * along;
        transformed.x += sin(along * 3.1) * 0.03 * aFeather.z;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uEdge; uniform vec3 uRim; uniform float uRimAmt; uniform vec3 uBack; uniform float uBackAmt; varying float vAlong;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = texture2D(emissiveMap, vEmissiveMapUv).rgb * uEdge * (0.25 + 0.75 * vAlong);
        {
          float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
          totalEmissiveRadiance += uRim * fres * uRimAmt * (0.4 + 0.6 * vAlong);
          totalEmissiveRadiance += uBack * uBackAmt * (1.0 - diffuseColor.a * 0.5) * fres * (0.3 + vAlong);
        }`);
  };
  mat.customProgramCacheKey = () => 'feather';
  const depthMat = new THREE.MeshDepthMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, depthPacking: THREE.RGBADepthPacking });

  const n = feathers.length;
  const featherAttr = new Float32Array(n * 2 * 4);
  for (let s = 0; s < 2; s++) for (let i = 0; i < n; i++) { const f = feathers[i]; featherAttr.set([-f.curl * f.len * 0.6, f.phase, rnd() - 0.5, 0], (s * n + i) * 4); }
  const igeo = geo.clone();
  igeo.setAttribute('aFeather', new THREE.InstancedBufferAttribute(featherAttr, 4));
  const mesh = new THREE.InstancedMesh(igeo, mat, n * 2);
  mesh.customDepthMaterial = depthMat;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const qz = new THREE.Quaternion(), qx = new THREE.Quaternion(), qy = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);

  // open: 0 folded .. 1 spread; sweep: extra fold backwards (z) when closed
  const qf = new THREE.Quaternion(), FWD = new THREE.Vector3();
  // forward: wing planes swing toward the viewer (radians) for depth in a vertical frame
  function pose(open, t = 0, breathe = 0, forward = 0.35) {
    const o = clamp(open, -0.1, 1.15);
    const br = Math.sin(t * 1.3) * breathe;
    // joint angles in the wing plane (radians, from +x axis)
    const a1 = lerp(-1.3, 0.78 + br * 0.4, o);           // humerus elevation (raised, heraldic pose)
    const a2 = a1 + lerp(2.55, 0.32 - br * 0.25, o);      // forearm (folds back on itself)
    const a3 = a2 + lerp(-2.7, 0.2 + br * 0.15, o);       // hand
    const sweep = lerp(0.95, 0.05, o);                    // fold toward the back when closed
    const j0 = new THREE.Vector3(0, 0, 0);
    const j1 = j0.clone().add(new THREE.Vector3(Math.cos(a1), Math.sin(a1), -sweep * 0.35).normalize().multiplyScalar(L1));
    const j2 = j1.clone().add(new THREE.Vector3(Math.cos(a2), Math.sin(a2), -sweep * 0.6).normalize().multiplyScalar(L2));
    const j3 = j2.clone().add(new THREE.Vector3(Math.cos(a3), Math.sin(a3), -sweep * 0.5).normalize().multiplyScalar(L3));
    const joints = [j0, j1, j2, j3], angles = [a1, a2, a3];
    for (let s = 0; s < 2; s++) {
      const mirror = s === 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const f = feathers[i];
        const a = joints[f.bone], b = joints[f.bone + 1];
        P.copy(a).lerp(b, f.u);
        const boneAng = angles[f.bone];
        // feathers fan out with the wing; folded they lie along the bone
        const fan = lerp(f.angFold, f.angOpen, Math.pow(clamp(o), 0.8)) + f.jit * o + (f.row === 0 ? br * 0.1 : 0);
        const ang = boneAng + fan - Math.PI / 2; // feather local +y points along (boneAng + fan)
        P.z += f.layer * 0.018 + (f.row === 0 ? 0 : 0.01);
        qf.setFromAxisAngle(AY, -forward);
        P.applyQuaternion(qf);
        P.x += shoulder;
        qz.setFromAxisAngle(AZ, ang);
        qx.setFromAxisAngle(AX, -0.08 - f.layer * 0.03 + sweep * 0.4); // slight dihedral / layering
        qy.setFromAxisAngle(AY, (f.row === 0 ? 0.15 : 0.08) * (1 - o * 0.5));
        Q.copy(qf).multiply(qz).multiply(qx).multiply(qy);
        S.set(f.wid, f.len, 1);
        M.compose(P, Q, S);
        if (mirror < 0) { const mm = new THREE.Matrix4().makeScale(-1, 1, 1); M.premultiply(mm); }
        mesh.setMatrixAt(s * n + i, M);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  pose(1);
  return { group, mesh, material: mat, uniforms: U, pose, count: n * 2 };
}
