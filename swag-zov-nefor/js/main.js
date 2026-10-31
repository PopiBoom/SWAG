// Timeline + player. renderAt(t) is the single entry point used by the preview player and the frame exporter.
import { el, hash, clamp } from './core.js';
import { DUR } from './data.js';
import { ASSETS, tickNicks } from './ui.js';
import { SCENE_LIST } from './scenes/index.js';

const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const stage = document.getElementById('stage');
if (RENDER) document.body.classList.add('render');

// post layer
const post = el('div', '', stage); post.id = 'post';
const grain = el('canvas', '', post); grain.id = 'grain'; grain.width = 512; grain.height = 304;
el('div', '', post).id = 'scan';
el('div', '', post).id = 'vig';
const flashEl = el('div', '', post); flashEl.id = 'flash';
const grainTiles = [];
function makeGrain() {
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 304;
    const g = c.getContext('2d'), d = g.createImageData(512, 304);
    for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * 0.37 + k * 911) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); grainTiles.push(c);
  }
}
const gctx = grain.getContext('2d');

// global post controls scenes may set during update
import { POST } from './post.js';
export { POST };

async function loadManifest() {
  try {
    const r = await fetch('assets/manifest.json', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); (j.avatars || []).forEach(a => ASSETS.avatars.add(a)); (j.nicks || []).forEach(a => ASSETS.nicks.add(a)); ASSETS.logo = !!j.logo; }
  } catch (e) { /* placeholders */ }
}

let scenes = [];
async function init() {
  await loadManifest();
  await document.fonts.load('900 40px Unbounded'); await document.fonts.load('40px "Russo One"');
  await document.fonts.load('700 40px "JetBrains Mono"'); await document.fonts.load('600 40px Inter');
  await document.fonts.load('40px "Press Start 2P"'); await document.fonts.load('40px "Noto Color Emoji"', '🐱');
  await document.fonts.load('700 40px "Noto Sans KR"', '에바'); await document.fonts.load('500 40px "Noto Sans Malayalam"', 'മ');
  await document.fonts.ready;
  makeGrain();
  for (const S of SCENE_LIST) {
    const root = el('div', 'scene ' + S.name, stage);
    root.style.zIndex = S.z || 1;
    root.style.display = 'none';
    const sc = { ...S, root, built: false };
    scenes.push(sc);
  }
  // build everything up front so first frames of each scene are not slower
  for (const s of scenes) { s.build(s.root); s.built = true; }
  stage.appendChild(post);
  window.__ready = true;
}

let lastT = -1;
function renderAt(t) {
  t = clamp(t, 0, DUR);
  POST.flash = 0; POST.flashColor = '#fff'; POST.vignette = 1; POST.grain = 1;
  for (const s of scenes) {
    const [a, b] = s.range, pre = s.pre || 0, post = s.post || 0;
    const on = t >= a - pre && t < b + post;
    if (on !== s.on) { s.root.style.display = on ? '' : 'none'; s.on = on; }
    if (on) s.update(t, t - a);
  }
  tickNicks(t);
  // post
  flashEl.style.opacity = POST.flash.toFixed(3); flashEl.style.background = POST.flashColor;
  const f = Math.floor(t * 30);
  gctx.drawImage(grainTiles[f % grainTiles.length], 0, 0);
  grain.style.transform = `translate(${(hash(f) * 64) | 0}px,${(hash(f + 7) * 64) | 0}px) scale(4)`;
  grain.style.transformOrigin = '0 0';
  grain.style.opacity = (0.06 * POST.grain).toFixed(3);
  document.getElementById('vig').style.opacity = POST.vignette;
  lastT = t;
}
window.renderAt = renderAt;

// ---------- player ----------
function fit() {
  if (RENDER) { stage.style.transform = 'none'; return; }
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `scale(${k})`;
}
addEventListener('resize', fit); fit();

await init();
if (!RENDER) {
  const audio = new Audio('assets/audio/soundtrack.m4a');
  audio.preload = 'auto';
  const ui = el('div', '', document.body); ui.id = 'ui';
  ui.innerHTML = '<button id="play">▶</button><input id="seek" type="range" min="0" max="120" step="0.01" value="0"><span id="tc">0.00</span>';
  const play = ui.querySelector('#play'), seek = ui.querySelector('#seek'), tc = ui.querySelector('#tc');
  let t = +(params.get('t') || 0), playing = false, t0 = 0, wall = 0;
  const toggle = () => {
    playing = !playing; play.textContent = playing ? '❚❚' : '▶';
    if (playing) { audio.currentTime = t; audio.play().catch(() => {}); t0 = t; wall = performance.now(); } else audio.pause();
  };
  play.onclick = toggle;
  addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle(); } });
  seek.oninput = () => { t = +seek.value; if (playing) { audio.currentTime = t; t0 = t; wall = performance.now(); } };
  const loop = () => {
    if (playing) {
      t = audio.readyState >= 2 && !audio.paused ? audio.currentTime : t0 + (performance.now() - wall) / 1000;
      if (t >= DUR) { t = DUR; toggle(); }
      seek.value = t;
    }
    renderAt(t); tc.textContent = t.toFixed(2);
    requestAnimationFrame(loop);
  };
  loop();
} else {
  renderAt(+(params.get('t') || 0));
}
