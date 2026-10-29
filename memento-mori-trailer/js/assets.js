// Asset loading: scanned statues, CC0 marble textures + HDRIs, real Telegram screenshots, fonts, avatar frames.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { computeCavity } from './materials.js';

export const TG_FILES = {
  profile: 'profile.png', feed: 'feed_38087.png',
  p37974: 'post_37974.png', p38084: 'post_38084.png', p37997: 'post_37997.png', p38089: 'post_38089.png',
  p38049: 'post_38049.png', p37980: 'post_37980.png', p38092: 'post_38092.png', p38087: 'post_38087.png',
  p37996: 'post_37996.png', p37938: 'post_37938.png', c38089: 'comments_38089.png',
};

export const FONTS = [
  '700 100px "Cinzel"', '400 100px "UnifrakturMaguntia"', '900 100px "Sofia Sans Extra Condensed"',
  '900 100px "Playfair Display SC"', '700 100px "Cormorant Garamond"', '500 100px "IBM Plex Mono"', '600 100px "IBM Plex Mono"',
];

export async function loadAssets(engine, onProgress = () => {}) {
  const r = engine.renderer;
  const maxAniso = r.capabilities.getMaxAnisotropy();
  const tl = new THREE.TextureLoader();
  const jobs = [];
  let done = 0;
  const track = p => { jobs.push(p); p.then(() => onProgress(++done / jobs.length)); return p; };
  const tex = (url, srgb = true, repeat = false, aniso = 1) => track(tl.loadAsync(url).then(t => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = Math.min(aniso, maxAniso);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }));
  const gltf = new GLTFLoader();
  const model = (name) => track(gltf.loadAsync(`assets/models/${name}.glb`).then(g => {
    let geo = null;
    g.scene.traverse(o => { if (o.isMesh && !geo) geo = o.geometry; });
    geo.deleteAttribute('normal');
    geo.computeVertexNormals();
    computeCavity(geo, 3, 1.0);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    return geo;
  }));
  const hdr = (url) => track(new RGBELoader().loadAsync(url).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; return t; }));

  const A = {};
  const p = {
    seneca: model('seneca'), bearded: model('bearded'), aphrodite: model('aphrodite'), siren: model('siren'),
    marble: Promise.all([tex('assets/tex/marble_white_color.jpg', true, true), tex('assets/tex/marble_white_rough.jpg', false, true), tex('assets/tex/marble_white_normal.jpg', false, true)]),
    blackMarble: Promise.all([tex('assets/tex/marble_black_color.jpg', true, true), tex('assets/tex/marble_black_rough.jpg', false, true), tex('assets/tex/marble_black_normal.jpg', false, true)]),
    church: hdr('assets/hdr/church_1k.hdr'), studio: hdr('assets/hdr/studio_1k.hdr'),
    fonts: track(Promise.all(FONTS.map(f => document.fonts.load(f, 'MEMENTO МЫСЛИ')))),
    avatarFrames: track(loadAvatarFrames()),
  };
  const tg = {};
  for (const [k, f] of Object.entries(TG_FILES)) tg[k] = tex(`assets/tg/${f}`, true, false, 4);
  const entries = await Promise.all(Object.entries(p).map(async ([k, v]) => [k, await v]));
  for (const [k, v] of entries) A[k] = v;
  A.tg = {};
  for (const [k, v] of Object.entries(tg)) A.tg[k] = await v;
  const [mc, mr, mn] = A.marble; A.marble = { color: mc, rough: mr, normal: mn };
  const [bc, br, bn] = A.blackMarble; A.blackMarble = { color: bc, rough: br, normal: bn };
  const pm = new THREE.PMREMGenerator(r);
  A.envChurch = pm.fromEquirectangular(A.church).texture;
  A.envStudio = pm.fromEquirectangular(A.studio).texture;
  A.envRoom = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return A;
}

// The channel avatar is an animated clip; frames are decoded on demand so every render time maps to an exact frame.
async function loadAvatarFrames() {
  const N = 147;
  const blobs = await Promise.all(Array.from({ length: N }, (_, i) => fetch(`assets/avatar/f_${String(i + 1).padStart(3, '0')}.jpg`).then(r => r.blob())));
  return { blobs, fps: 30, count: N };
}
