// MEMENTO MORI — orchestrator. One deterministic renderAt(t) for preview, playback and export.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Post, Q, SCALE, RW, RH, W, H } from './core.js';
import { MEMBERS, buildAvatarAtlas } from './data.js';
import { setNames } from './ui.js';

const FPS = 60;
const TL = await (await fetch('src/timeline.json')).json();
const E = TL.events;

// fonts (Cyrillic + Korean + emoji) must be ready before the first frame
const FONT_TESTS = ['900 40px Unbounded', '400 40px "Dela Gothic One"', '700 40px "JetBrains Mono"', '400 40px "Press Start 2P"',
  '400 40px "Rubik Glitch"', '500 40px Roboto', '700 40px Roboto', '700 40px "Noto Sans KR"', '400 40px "Russo One"', '700 40px Oswald', '40px "Noto Color Emoji"'];
await Promise.all(FONT_TESTS.map(f => document.fonts.load(f, 'AБЯжё예바⭐💀 ')));
await document.fonts.ready;
setNames(MEMBERS.map(m => m.name ?? ''));

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(RW, RH, false);
renderer.domElement.id = 'view';
document.getElementById('stage').appendChild(renderer.domElement);
renderer.toneMapping = THREE.NoToneMapping;

const post = new Post(renderer);
const atlas = await buildAvatarAtlas();
const gltf = await new GLTFLoader().loadAsync('assets/models/ScatteringSkull.glb');
let kicks = []; try { kicks = (await (await fetch('audio/audio_meta.json')).json()).kicks; } catch (e) { }
const ctx = { renderer, post, TL, E, atlas, gltf, FPS, MEMBERS, kicks };

const SCENES = [
  ['term', 0, E.impact], ['skull', E.impact, E.tunnel], ['tunnel', E.tunnel, E.city], ['city', E.city, E.network],
  ['universe', E.network, E.montage], ['montage', E.montage, E.black], ['black', E.black, E.drop], ['drop', E.drop, E.night],
  ['night', E.night, E.skull_match], ['skull', E.skull_match, E.join_ui], ['join', E.join_ui, E.cursor2_on], ['end', E.cursor2_on, E.end + 1],
];
const mods = {};
for (const name of new Set(SCENES.map(s => s[0]))) {
  try { const m = await import(`./scenes/${name}.js`); mods[name] = await m.build(ctx); }
  catch (e) { console.error('scene', name, e); mods[name] = null; }
}

function pick(t) { for (const s of SCENES) if (t >= s[1] && t < s[2]) return s; return SCENES[SCENES.length - 1]; }

window.renderAt = (t, frame = Math.round(t * FPS)) => {
  const [name] = pick(t);
  const S = mods[name];
  const ui = post.ui;
  ui.reset(); // full state reset (clip stack, filters, transforms) + clear — no state may leak between frames
  ui.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const fx = { time: t, frame, exposure: 1, bloomStr: .9, ca: .5, glitch: 0, scan: 0, vign: .6, grain: .05, flash: 0, fade: 0, sat: 1, crtOff: 0, curv: 0, uiCa: .6, contrast: 1.05, threshold: .7, uiBloom: .4 };
  ctx.frame = frame;
  if (S) S.update(t, ui, fx, frame);
  ui.setTransform(1, 0, 0, 1, 0, 0);
  post.render(S?.scene, S?.camera, fx);
  return name;
};
window.TL = TL; window.mods = mods; window.post = post;
window.ready = true;

// ---- interactive preview: ?t=12 renders a still; ?play plays with the soundtrack
if (Q.has('t')) window.renderAt(+Q.get('t'));
if (Q.has('play')) {
  const audio = new Audio('audio/mix.wav');
  const btn = document.createElement('button'); btn.textContent = '▶ PLAY'; btn.className = 'play'; document.body.appendChild(btn);
  btn.onclick = () => {
    btn.remove(); audio.currentTime = +(Q.get('from') || 0); audio.play();
    const loop = () => { window.renderAt(audio.currentTime); if (!audio.paused) requestAnimationFrame(loop); };
    loop();
  };
}
