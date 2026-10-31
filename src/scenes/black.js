// 86 → 88 s: absolute black, silence, one sentence.
import { clamp, lerp, smooth, eOutCubic, hash } from '../core.js';
import { F, sprite, put } from '../ui.js';

export async function build(ctx) {
  const { E } = ctx;
  const l1 = sprite({ text: 'ТАК БУДЬ ИМ,', size: 112, family: F.head, weight: 900, color: '#ffffff', ls: 4, maxW: 960 });
  const l2 = sprite({ text: 'БЛЯТЬ.', size: 196, family: F.head, weight: 900, color: '#ffffff', ls: 6, maxW: 960 });
  function update(t, ui, fx, frame) {
    const a = t - E.black_text;
    fx.grain = .035; fx.vign = 0; fx.bloomStr = 0; fx.uiBloom = .08; fx.ca = .2;
    if (a < 0) return;
    const k1 = eOutCubic(clamp(a / .55)), k2 = eOutCubic(clamp((a - .32) / .5));
    const shake = t > E.drop - .18 ? (hash(frame) - .5) * 10 : 0;
    put(ui, l1, 540 + shake, 880, { alpha: k1, sx: lerp(1.08, 1, k1) });
    put(ui, l2, 540 - shake, 1035, { alpha: k2, scale: lerp(1.06, 1, k2) });
  }
  return { scene: null, camera: null, update };
}
