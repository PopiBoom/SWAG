// DOM typography driven by CSS @keyframes. All CSS animations are paused and seeked to the
// timeline time, so realtime playback and frame export show exactly the same state.
import { mulberry32 } from './util.js';

export class Typography {
  constructor(root) {
    this.root = root;
    const rnd = mulberry32(2024);
    root.querySelectorAll('[data-split]').forEach(el => {
      const text = el.textContent;
      el.textContent = '';
      el.setAttribute('aria-label', text);
      [...text].forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch === ' ' ? ' ' : ch;
        s.style.setProperty('--i', i);
        s.style.setProperty('--n', text.length);
        s.style.setProperty('--dx', ((rnd() - 0.5) * 2).toFixed(3));
        s.style.setProperty('--dy', ((rnd() - 0.5) * 2).toFixed(3));
        s.style.setProperty('--r', ((rnd() - 0.5) * 2).toFixed(3));
        s.setAttribute('aria-hidden', 'true');
        el.appendChild(s);
      });
    });
    this.root.offsetWidth; // force style resolution so CSS animations exist
    this.anims = document.getAnimations().filter(a => this.root.contains(a.effect && a.effect.target));
    for (const a of this.anims) a.pause();
  }
  seek(t) {
    const ms = t * 1000;
    for (const a of this.anims) a.currentTime = ms;
  }
}
