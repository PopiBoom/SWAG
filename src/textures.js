import * as THREE from 'three';
import { C, drawMask } from './hud.js';
import { canvasTex } from './util3d.js';
import { hash, rng } from './util.js';

const cache = new Map();
export function maskTex(seed, color = C.green) {
  const key = seed + color;
  if (cache.has(key)) return cache.get(key);
  const { ctx, tex } = canvasTex(256, 256);
  drawMask(ctx, 128, 128, 236, seed, { color });
  cache.set(key, tex); return tex;
}

// панель светодиодов стойки
export function ledTex(seed = 1) {
  const { ctx: c, tex } = canvasTex(256, 512);
  c.fillStyle = '#060606'; c.fillRect(0, 0, 256, 512);
  const r = rng(seed);
  for (let u = 0; u < 14; u++) {
    const y = 14 + u * 35;
    c.fillStyle = '#111'; c.fillRect(10, y, 236, 28);
    c.fillStyle = '#1b1b1b'; for (let k = 0; k < 18; k++) c.fillRect(70 + k * 9, y + 6, 5, 16);
    for (let k = 0; k < 4; k++) {
      const v = r();
      c.fillStyle = v > 0.82 ? '#ff0033' : v > 0.3 ? '#39ff14' : '#0a2a06';
      c.fillRect(18 + k * 11, y + 10, 6, 6);
    }
  }
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// облачко сообщения для 3D (город, сеть)
export function bubbleTex(name, text, seed, o = {}) {
  const { ctx: c, tex, canvas } = canvasTex(1024, 220);
  c.font = '44px Mono';
  const w = Math.min(1000, Math.max(420, c.measureText(text).width + 210));
  const red = o.red;
  c.fillStyle = red ? 'rgba(40,0,6,0.92)' : 'rgba(10,22,8,0.92)';
  c.strokeStyle = red ? '#ff0033' : '#39ff14'; c.lineWidth = 4;
  c.beginPath(); c.roundRect(4, 4, w - 8, 212, 26); c.fill(); c.stroke();
  drawMask(c, 80, 110, 120, seed, { color: red ? C.red : C.green });
  c.fillStyle = red ? '#ff4d6d' : '#39ff14'; c.font = '36px MonoB'; c.fillText(name, 160, 80);
  c.fillStyle = '#ffffff'; c.font = '44px Mono'; c.fillText(text, 160, 150);
  c.fillStyle = '#777'; c.font = '26px Mono'; c.fillText(`${String(10 + Math.floor(hash(seed) * 13)).padStart(2, '0')}:${String(Math.floor(hash(seed * 3) * 59)).padStart(2, '0')}`, w - 110, 196);
  tex.userData = { aspect: w / 220, u: w / 1024 };
  tex.repeat.x = w / 1024;
  return tex;
}

// большая надпись для голограмм
export function wordTex(word, font = 'Glitch', size = 300, color = '#ffffff', w = 2048, h = 420) {
  const { ctx: c, tex } = canvasTex(w, h);
  c.font = `${size}px ${font}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = color; c.fillText(word, w / 2, h / 2 + size * 0.04);
  return tex;
}

// случайные «интерфейсные окна» для небоскрёбов
export function facadeTex(seed, red = false) {
  const { ctx: c, tex } = canvasTex(512, 1024);
  const r = rng(seed);
  c.fillStyle = '#030303'; c.fillRect(0, 0, 512, 1024);
  for (let y = 8; y < 1024; y += 26) {
    for (let x = 8; x < 512;) {
      const w = 20 + Math.floor(r() * 90);
      const v = r();
      if (v > 0.55) {
        const col = v > 0.93 ? (red ? '#ff0033' : '#ff0033') : v > 0.6 ? '#39ff14' : v > 0.5 ? '#d8ffd0' : '#145a08';
        c.globalAlpha = 0.25 + r() * 0.75; c.fillStyle = col; c.fillRect(x, y, Math.min(w, 504 - x), 16);
        // «строки текста» внутри окна
        if (w > 50 && r() > 0.5) { c.fillStyle = '#000'; c.globalAlpha = 0.5; c.fillRect(x + 4, y + 6, w * 0.6, 3); }
      }
      x += w + 6;
    }
  }
  c.globalAlpha = 1;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function noiseTex(n = 256) {
  const { ctx: c, tex } = canvasTex(n, n);
  const d = c.createImageData(n, n); const r = rng(9);
  for (let i = 0; i < n * n; i++) { const v = r() * 255; d.data[i * 4] = v * 0.8; d.data[i * 4 + 1] = v; d.data[i * 4 + 2] = v * 0.85; d.data[i * 4 + 3] = 255; }
  c.putImageData(d, 0, 0);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex;
}
