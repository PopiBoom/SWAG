// Bootstrap: loads assets, builds the world, exposes window.renderAt(t) for frame-exact export,
// and runs a realtime player synced to the soundtrack.
import { Engine } from './engine.js';
import { loadAssets } from './assets.js';
import { buildWorld, DURATION } from './world.js';
import { Typography } from './typography.js';

const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const STAGE_W = 1080, STAGE_H = 1920;

const stage = document.getElementById('stage');
const canvas = document.getElementById('gl');
const loader = document.getElementById('loader');

function fitStage() {
  if (RENDER) { stage.style.transform = 'none'; return; }
  const s = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fitStage);
fitStage();
if (RENDER) document.body.classList.add('render');

const pixelRatio = RENDER ? +(params.get('scale') || 2) : Math.min(2, Math.max(1, devicePixelRatio * Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H)));
const engine = new Engine(canvas, { width: STAGE_W, height: STAGE_H, pixelRatio, samples: +(params.get('msaa') || 0) });
canvas.style.width = STAGE_W + 'px';
canvas.style.height = STAGE_H + 'px';

const bar = document.querySelector('#loader .bar i');
const assets = await loadAssets(engine, p => { if (bar) bar.style.width = (p * 100).toFixed(0) + '%'; });
const world = buildWorld(engine, assets);
const typo = new Typography(document.getElementById('type'));

// Compile shaders up-front so the first frames are not stalled.
engine.renderer.compile(engine.scene, engine.camera);

window.renderAt = async (t, opts = {}) => {
  await world.prepare(t);
  engine.render(t, world.update, opts);
  typo.seek(t);
  return true;
};
window.DURATION = DURATION;
window.motionBlurAt = t => world.motionBlurAt(t);
await window.renderAt(Number(params.get('t') || 0));
loader.classList.add('hidden');
window.__ready = true;

if (!RENDER) {
  const audio = document.getElementById('music');
  const play = document.getElementById('play');
  const prog = document.querySelector('#hudbar i');
  let playing = false;
  play.classList.add('show');
  const toggle = () => {
    if (!playing) { if (audio.ended || audio.currentTime >= DURATION - 0.05) audio.currentTime = 0; audio.play(); play.classList.remove('show'); }
    else { audio.pause(); play.classList.add('show'); }
    playing = !playing;
  };
  play.addEventListener('click', toggle);
  addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle(); } });
  stage.addEventListener('click', e => { if (e.target !== play) toggle(); });
  audio.addEventListener('ended', () => { playing = false; play.classList.add('show'); });
  let busy = false;
  const loop = async () => {
    requestAnimationFrame(loop);
    if (busy) return;
    if (!playing && !params.has('t')) return;
    busy = true;
    const t = Math.min(DURATION - 1 / 60, audio.currentTime);
    await window.renderAt(t);
    if (prog) prog.style.width = (t / DURATION * 100).toFixed(2) + '%';
    busy = false;
  };
  requestAnimationFrame(loop);
}
