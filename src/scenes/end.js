// 131.6 → end: a small blinking green cursor remains… then it is gone. Total darkness.
import { clamp } from '../core.js';

export async function build(ctx) {
  const { E } = ctx;
  function update(t, ui, fx) {
    fx.bloomStr = 1; fx.uiBloom = .9; fx.grain = .03; fx.vign = 0; fx.ca = 0; fx.threshold = .5;
    if (t >= E.cursor2_off) return;
    const on = Math.floor((t - E.cursor2_on) * 2) % 2 === 0;
    if (!on) return;
    ui.save(); ui.fillStyle = '#39ff88'; ui.shadowColor = '#39ff88'; ui.shadowBlur = 24; ui.fillRect(540 - 13, 960 - 24, 26, 48); ui.restore();
  }
  return { scene: null, camera: null, update };
}
