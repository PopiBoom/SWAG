// Original soundtrack for the MEMENTO MORI trailer: dark phonk @120 BPM + sound design, rendered offline.
// No samples, no voice: every sound is synthesised here, so the track is free of third-party rights.
// Usage: node tools/compose.mjs out.wav        (48 kHz, stereo, 16-bit, exactly 60.000 s)
import fs from 'fs';

const SR = 48000, DUR = 60.0, N = Math.round(SR * DUR);
const BEAT = 0.5, S16 = BEAT / 4;

// ---------- buses ----------
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const B = { drums: bus(), bass: bus(), bell: bus(), pad: bus(), sfx: bus(), hits: bus(), roomSend: bus(), hallSend: bus() };

// ---------- helpers ----------
let seed = 1234567;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const n2m = s => { const m = s.match(/^([A-G]#?)(-?\d)$/); return NOTE[m[1]] + 12 * (+m[2] + 1); };
const nf = s => mtof(n2m(s));
const idx = t => Math.round(t * SR);

function write(b, i, l, r, sendRoom = 0, sendHall = 0) {
  if (i < 0 || i >= N) return;
  b.L[i] += l; b.R[i] += r;
  if (sendRoom) { B.roomSend.L[i] += l * sendRoom; B.roomSend.R[i] += r * sendRoom; }
  if (sendHall) { B.hallSend.L[i] += l * sendHall; B.hallSend.R[i] += r * sendHall; }
}
const panLR = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) {
    this.f = f; this.q = q;
    const w = 2 * Math.PI * clamp(f, 10, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = a; b1 = 0; b2 = -a; } // band-pass (constant peak)
    a0 = 1 + a; a1 = -2 * c; a2 = 1 - a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  p(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

// ---------- instruments ----------
function kick(t, vel = 1, b = B.drums) {
  const i0 = idx(t), len = idx(0.55);
  let ph = 0; const hp = new Biquad('hp', 3000);
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const f = 44 + 110 * Math.exp(-x / 0.035);
    ph += 2 * Math.PI * f / SR;
    let v = Math.sin(ph) * Math.exp(-x / 0.32) * (x < 0.002 ? x / 0.002 : 1);
    v = Math.tanh(v * 1.8) * 0.9;
    const click = hp.p(noise()) * Math.exp(-x / 0.004) * 0.35;
    write(b, i0 + k, (v + click) * vel, (v + click) * vel, 0.04);
  }
}
function clap(t, vel = 1, hall = 0.25) {
  const i0 = idx(t), len = idx(0.35);
  const bp = new Biquad('bp', 1300, 1.1), bp2 = new Biquad('bp', 2600, 1.4);
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    let env = 0;
    for (const o of [0, 0.011, 0.022]) if (x >= o) env = Math.max(env, Math.exp(-(x - o) / (o === 0.022 ? 0.09 : 0.008)));
    ph += 2 * Math.PI * 185 / SR;
    const body = Math.sin(ph) * Math.exp(-x / 0.05) * 0.35;
    const n = noise();
    const v = (bp.p(n) * 1.6 + bp2.p(n) * 0.8) * env + body;
    write(B.drums, i0 + k, v * vel * 0.9, v * vel * 0.9, 0.18, hall);
  }
}
function hat(t, vel = 0.5, open = false, pan = 0.15) {
  const i0 = idx(t), d = open ? 0.22 : 0.035, len = idx(d * 5);
  const hp = new Biquad('hp', 7500, 0.8), bp = new Biquad('bp', 10500, 1.2);
  const [pl, pr] = panLR(pan);
  for (let k = 0; k < len; k++) {
    const x = k / SR, n = noise();
    const v = (hp.p(n) * 0.6 + bp.p(n) * 0.8) * Math.exp(-x / d) * vel * 0.55;
    write(B.drums, i0 + k, v * pl, v * pr, 0.05);
  }
}
function crash(t, vel = 0.8, len = 2.2) {
  const i0 = idx(t), L = idx(len);
  const hpL = new Biquad('hp', 3800), hpR = new Biquad('hp', 3600);
  const parts = [457, 913, 1471, 2389, 3511].map(f => ({ f, ph: rnd() * 6 }));
  for (let k = 0; k < L; k++) {
    const x = k / SR, env = Math.exp(-x / (len * 0.35)) * (x < 0.003 ? x / 0.003 : 1);
    let m = 0; for (const p of parts) { p.ph += 2 * Math.PI * p.f / SR; m += Math.sin(p.ph); }
    const l = (hpL.p(noise()) + m * 0.015) * env * vel * 0.4, r = (hpR.p(noise()) + m * 0.015) * env * vel * 0.4;
    write(B.drums, i0 + k, l, r, 0.1, 0.25);
  }
}
// pitched 808 cowbell (two detuned squares, band-passed, saturated)
function cowbell(t, note, vel = 0.6, dur = 0.26, pan = 0) {
  const f = nf(note), i0 = idx(t), len = idx(dur * 4);
  const bp = new Biquad('bp', f * 2.6, 1.6), hp = new Biquad('hp', 380);
  let p1 = 0, p2 = 0;
  const [pl, pr] = panLR(pan);
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    p1 = (p1 + f / SR) % 1; p2 = (p2 + f * 1.4815 / SR) % 1;
    const sq = (p1 < 0.5 ? 1 : -1) * 0.6 + (p2 < 0.5 ? 1 : -1) * 0.4;
    const env = Math.exp(-x / dur) * (x < 0.001 ? x / 0.001 : 1) * (0.7 + 0.3 * Math.exp(-x / 0.02));
    let v = hp.p(bp.p(sq) * 2.2 + sq * 0.12) * env;
    v = Math.tanh(v * 2.2) * 0.42 * vel;
    write(B.bell, i0 + k, v * pl, v * pr, 0, 0.18);
  }
}
// 808 bass with pitch drop, glide and drive
function bass808(t, note, dur, { slideTo = null, slideAt = 0.7, vel = 1, drive = 2.2 } = {}) {
  const f0 = nf(note), f1 = slideTo ? nf(slideTo) : f0;
  const i0 = idx(t), len = idx(dur + 0.25);
  let ph = 0;
  const lp = new Biquad('lp', 900, 0.8);
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    let f = f0 * (1 + 1.0 * Math.exp(-x / 0.018));
    if (slideTo && x > dur * slideAt) f = f0 + (f1 - f0) * smooth(dur * slideAt, dur * slideAt + 0.09, x);
    ph += 2 * Math.PI * f / SR;
    const env = (x < 0.003 ? x / 0.003 : 1) * Math.exp(-x / 1.4) * (x > dur ? Math.exp(-(x - dur) / 0.05) : 1);
    let v = Math.sin(ph) + 0.25 * Math.sin(2 * ph);
    v = Math.tanh(v * drive) / Math.tanh(drive);
    v = lp.p(v) * env * vel * 0.62;
    write(B.bass, i0 + k, v, v);
  }
}
function pad(t0, t1, notes, { vel = 0.25, cutoff = 900, attack = 1.4, release = 1.6, bright = 0 } = {}) {
  const i0 = idx(t0), len = idx(t1 - t0 + release);
  const voices = [];
  for (const nt of notes) for (let d = 0; d < 4; d++) voices.push({ f: nf(nt) * (1 + (d - 1.5) * 0.0045), ph: rnd(), pan: (d / 3) * 2 - 1 });
  const lpL = new Biquad('lp', cutoff, 0.7), lpR = new Biquad('lp', cutoff, 0.7);
  for (let k = 0; k < len; k++) {
    const x = k / SR, tt = t0 + x;
    if (k % 64 === 0) { const c = cutoff * (1 + 0.25 * Math.sin(tt * 0.7) + bright * smooth(t0, t1, tt)); lpL.set(c); lpR.set(c * 1.04); }
    let l = 0, r = 0;
    for (const v of voices) {
      v.ph = (v.ph + v.f / SR) % 1;
      const s = 2 * v.ph - 1;
      l += s * (1 - v.pan) * 0.5; r += s * (1 + v.pan) * 0.5;
    }
    const env = smooth(0, attack, x) * (tt > t1 ? Math.exp(-(tt - t1) / (release * 0.4)) : 1);
    const g = vel * env / voices.length * 2.2;
    write(B.pad, i0 + k, lpL.p(l) * g, lpR.p(r) * g, 0, 0.3);
  }
}
function braam(t, { vel = 1, len = 3.2, root = 'E1' } = {}) {
  const i0 = idx(t), L = idx(len);
  const fs = [nf(root), nf(root) * 2, nf(root) * 3 * 0.999, nf(root) * 1.4983];
  const vs = []; for (const f of fs) for (let d = 0; d < 3; d++) vs.push({ f: f * (1 + (d - 1) * 0.006), ph: rnd() });
  const lp = new Biquad('lp', 200, 1.6), lp2 = new Biquad('lp', 200, 1.6);
  for (let k = 0; k < L; k++) {
    const x = k / SR;
    if (k % 32 === 0) { const c = 180 + 1700 * Math.exp(-x / 0.35) * (x < 0.04 ? x / 0.04 : 1) + 150; lp.set(c); lp2.set(c * 1.1); }
    let s = 0; for (const v of vs) { v.ph = (v.ph + v.f / SR) % 1; s += 2 * v.ph - 1; }
    s /= vs.length;
    let v = Math.tanh(lp2.p(lp.p(s)) * 3.0) * Math.exp(-x / (len * 0.4)) * (x < 0.01 ? x / 0.01 : 1) * vel * 0.55;
    write(B.hits, i0 + k, v, v, 0, 0.25);
  }
}
function subBoom(t, vel = 1, len = 2.6) {
  const i0 = idx(t), L = idx(len); let ph = 0;
  for (let k = 0; k < L; k++) {
    const x = k / SR, f = 27 + 38 * Math.exp(-x / 0.25);
    ph += 2 * Math.PI * f / SR;
    const v = Math.tanh(Math.sin(ph) * 1.4) * Math.exp(-x / (len * 0.38)) * (x < 0.004 ? x / 0.004 : 1) * vel * 0.85;
    write(B.hits, i0 + k, v, v);
  }
}
function metalHit(t, { f0 = 196, vel = 1, len = 3.0, pan = 0 } = {}) {
  const i0 = idx(t), L = idx(len);
  const ratios = [1, 2.756, 5.404, 8.933, 13.34, 17.8], dec = [1.6, 1.0, 0.7, 0.45, 0.3, 0.2];
  const ps = ratios.map(r => ({ f: f0 * r * (1 + (rnd() - 0.5) * 0.004), ph: rnd() * 6 }));
  const hp = new Biquad('hp', 1500);
  const [pl, pr] = panLR(pan);
  for (let k = 0; k < L; k++) {
    const x = k / SR; let s = 0;
    for (let j = 0; j < ps.length; j++) { ps[j].ph += 2 * Math.PI * ps[j].f / SR; s += Math.sin(ps[j].ph) * Math.exp(-x / (dec[j] * len / 3)) / (1 + j * 0.6); }
    const click = hp.p(noise()) * Math.exp(-x / 0.006) * 0.8;
    const v = (s * 0.32 + click) * vel * 0.6;
    write(B.hits, i0 + k, v * pl, v * pr, 0, 0.4);
  }
}
function bellFM(t, note, { vel = 0.5, len = 3.5, pan = 0 } = {}) {
  const f = nf(note), i0 = idx(t), L = idx(len);
  let pc = 0, pm = 0; const [pl, pr] = panLR(pan);
  for (let k = 0; k < L; k++) {
    const x = k / SR, I = 3.2 * Math.exp(-x / 0.4) + 0.3;
    pm += 2 * Math.PI * f * 3.5 / SR; pc += 2 * Math.PI * f / SR;
    const v = Math.sin(pc + I * Math.sin(pm)) * Math.exp(-x / (len * 0.3)) * (x < 0.002 ? x / 0.002 : 1) * vel * 0.3;
    write(B.bell, i0 + k, v * pl, v * pr, 0, 0.45);
  }
}
function whoosh(t, len = 0.9, { vel = 0.6, f0 = 250, f1 = 3200, pan0 = -0.7, pan1 = 0.7, peak = 0.6 } = {}) {
  const i0 = idx(t), L = idx(len);
  const bp = new Biquad('bp', f0, 0.9), bp2 = new Biquad('bp', f0 * 1.5, 0.9);
  for (let k = 0; k < L; k++) {
    const x = k / L;
    if (k % 32 === 0) { const f = f0 * Math.pow(f1 / f0, Math.sin(Math.PI * Math.min(1, x / (peak * 2))) * 0.5 + x * 0.5); bp.set(f); bp2.set(f * 1.6); }
    const env = Math.pow(Math.sin(Math.PI * Math.pow(x, peak < 0.5 ? 0.7 : 1.3)), 2);
    const n = noise();
    const v = (bp.p(n) + bp2.p(n) * 0.6) * env * vel;
    const p = pan0 + (pan1 - pan0) * x; const [pl, pr] = panLR(p);
    write(B.sfx, i0 + k, v * pl, v * pr, 0, 0.2);
  }
}
function riser(t0, t1, vel = 0.5) {
  const i0 = idx(t0), L = idx(t1 - t0);
  const hp = new Biquad('hp', 300), bp = new Biquad('bp', 800, 3);
  let ph = 0;
  for (let k = 0; k < L; k++) {
    const x = k / L;
    if (k % 32 === 0) { hp.set(300 + 5000 * x * x); bp.set(500 + 4500 * x * x); }
    ph += 2 * Math.PI * (180 + 900 * x * x) / SR;
    const env = Math.pow(x, 2.2);
    const v = (hp.p(noise()) * 0.6 + bp.p(noise()) * 0.8 + Math.sin(ph) * 0.12 * (Math.sin(ph * 0.5) > 0 ? 1 : 0.6)) * env * vel;
    write(B.sfx, i0 + k, v * (0.8 + 0.2 * Math.sin(k / SR * 9)), v * (0.8 - 0.2 * Math.sin(k / SR * 9)), 0, 0.15);
  }
}
function reverseSwell(tEnd, len = 1.0, vel = 0.5) {
  const i0 = idx(tEnd - len), L = idx(len);
  const hp = new Biquad('hp', 4000), lp = new Biquad('lp', 9000);
  for (let k = 0; k < L; k++) {
    const x = k / L, env = Math.pow(x, 3.2);
    const v = lp.p(hp.p(noise())) * env * vel;
    write(B.sfx, i0 + k, v, v * 0.95, 0, 0.1);
  }
}
function marbleShatter(t, vel = 1) {
  // crack transient + low thump
  const i0 = idx(t);
  let ph = 0; const lpT = new Biquad('lp', 2400);
  for (let k = 0; k < idx(0.9); k++) {
    const x = k / SR; ph += 2 * Math.PI * (55 + 90 * Math.exp(-x / 0.03)) / SR;
    const thump = Math.sin(ph) * Math.exp(-x / 0.22) * 0.9;
    const crack = lpT.p(noise()) * Math.exp(-x / 0.012) * 1.4 + noise() * Math.exp(-x / 0.003) * 0.6;
    write(B.sfx, i0 + k, (thump + crack) * vel, (thump + crack) * vel, 0, 0.3);
  }
  // debris shower: many small stone/marble clicks with resonances, density decaying
  for (let j = 0; j < 260; j++) {
    const dt = Math.pow(rnd(), 2.2) * 2.4;
    const f = 1800 + rnd() * 6500, d = 0.006 + rnd() * 0.05, a = (0.25 + rnd() * 0.75) * Math.exp(-dt / 1.1) * vel * 0.55;
    const bp = new Biquad('bp', f, 6 + rnd() * 10); const pan = rnd() * 2 - 1; const [pl, pr] = panLR(pan);
    const s0 = idx(t + 0.01 + dt);
    for (let k = 0; k < idx(d * 5); k++) { const x = k / SR; const v = bp.p(noise() * Math.exp(-x / d)) * a * 3; write(B.sfx, s0 + k, v * pl, v * pr, 0.2, 0.25); }
  }
  // gritty rumble tail
  const lp = new Biquad('lp', 500);
  for (let k = 0; k < idx(2.2); k++) { const x = k / SR; const v = lp.p(noise()) * Math.exp(-x / 0.6) * 0.5 * vel; write(B.sfx, i0 + k, v, v, 0, 0.2); }
}
function creaks(t0, t1, density = 25, vel = 0.4) {
  const L = t1 - t0;
  for (let j = 0; j < density * L; j++) {
    const tt = t0 + rnd() * L;
    const f = 900 + rnd() * 3500, d = 0.002 + rnd() * 0.01;
    const bp = new Biquad('bp', f, 4); const [pl, pr] = panLR(rnd() * 1.2 - 0.6);
    const a = vel * (0.3 + rnd() * 0.7) * smooth(t0, t0 + L * 0.7, tt);
    for (let k = 0; k < idx(d * 6); k++) { const x = k / SR; const v = bp.p(noise()) * Math.exp(-x / d) * a; write(B.sfx, idx(tt) + k, v * pl, v * pr, 0.3, 0.1); }
  }
  // low stone groan
  const bp = new Biquad('bp', 140, 3);
  for (let k = idx(t0); k < idx(t1); k++) {
    const x = (k - idx(t0)) / SR;
    if (k % 64 === 0) bp.set(110 + 60 * Math.sin(x * 2.3) + 40 * Math.sin(x * 5.1));
    const v = bp.p(noise()) * vel * 0.6 * smooth(0, L * 0.6, x) * (0.6 + 0.4 * Math.sin(x * 7.0));
    write(B.sfx, k, v, v);
  }
}
function drone(t0, t1, { vel = 0.3, root = 'E1' } = {}) {
  const fs = [nf(root), nf(root) * 1.498, nf(root) * 2.003];
  const ph = fs.map(() => rnd() * 6);
  const lp = new Biquad('lp', 180), lpN = new Biquad('lp', 120);
  for (let k = idx(t0); k < idx(t1); k++) {
    const tt = k / SR;
    let s = 0; fs.forEach((f, j) => { ph[j] += 2 * Math.PI * f * (1 + 0.002 * Math.sin(tt * (0.3 + j * 0.17))) / SR; s += Math.sin(ph[j]) / (1 + j); });
    const env = smooth(t0, t0 + 1.5, tt) * (1 - smooth(t1 - 0.6, t1, tt));
    const v = (lp.p(s) * 0.8 + lpN.p(noise()) * 1.3) * env * vel;
    write(B.pad, k, v, v);
  }
}
function wind(t0, t1, vel = 0.12) {
  const bpL = new Biquad('bp', 500, 0.7), bpR = new Biquad('bp', 600, 0.7);
  for (let k = idx(t0); k < idx(t1); k++) {
    const tt = k / SR;
    if (k % 64 === 0) { bpL.set(400 + 300 * Math.sin(tt * 0.31) + 200 * Math.sin(tt * 0.83)); bpR.set(450 + 300 * Math.sin(tt * 0.27 + 1) + 200 * Math.sin(tt * 0.71)); }
    const env = smooth(t0, t0 + 1.5, tt) * (1 - smooth(t1 - 1, t1, tt)) * (0.6 + 0.4 * Math.sin(tt * 0.5));
    write(B.sfx, k, bpL.p(noise()) * vel * env, bpR.p(noise()) * vel * env);
  }
}
function featherWhoosh(t, len = 1.6, vel = 0.5) {
  const i0 = idx(t), L = idx(len);
  const lp = new Biquad('lp', 700, 0.8), bp = new Biquad('bp', 1800, 1.5);
  for (let k = 0; k < L; k++) {
    const x = k / L, tt = k / SR;
    const env = Math.pow(Math.sin(Math.PI * Math.pow(x, 0.6)), 2) * (0.55 + 0.45 * Math.sin(tt * 2 * Math.PI * 13));
    const n = noise();
    const v = (lp.p(n) * 1.2 + bp.p(n) * 0.4) * env * vel;
    write(B.sfx, i0 + k, v, v * 0.9, 0, 0.25);
  }
}
function glassPluck(t, note, vel = 0.25, pan = 0) {
  const f = nf(note), i0 = idx(t), L = idx(1.2);
  let p1 = 0, p2 = 0; const [pl, pr] = panLR(pan);
  for (let k = 0; k < L; k++) {
    const x = k / SR; p1 += 2 * Math.PI * f / SR; p2 += 2 * Math.PI * f * 2.01 / SR;
    const v = (Math.sin(p1) + 0.35 * Math.sin(p2)) * Math.exp(-x / 0.35) * (x < 0.002 ? x / 0.002 : 1) * vel * 0.3;
    write(B.bell, i0 + k, v * pl, v * pr, 0, 0.5);
  }
}
function clicks(t0, t1, n, vel = 0.3) {
  for (let j = 0; j < n; j++) {
    const tt = t0 + (j / n) * (t1 - t0) + (rnd() - 0.5) * 0.02;
    const hp = new Biquad('hp', 2500); const [pl, pr] = panLR(rnd() * 1.4 - 0.7);
    for (let k = 0; k < idx(0.02); k++) { const x = k / SR; const v = hp.p(noise()) * Math.exp(-x / 0.002) * vel; write(B.sfx, idx(tt) + k, v * pl, v * pr, 0.3, 0.1); }
    metalTick(tt, 2400 + rnd() * 1800, vel * 0.5);
  }
}
function metalTick(t, f, vel) {
  const i0 = idx(t); let ph = 0;
  for (let k = 0; k < idx(0.15); k++) { const x = k / SR; ph += 2 * Math.PI * f / SR; const v = Math.sin(ph) * Math.exp(-x / 0.03) * vel; write(B.sfx, i0 + k, v, v, 0, 0.2); }
}
function heartbeat(t, vel = 0.6) { kick(t, vel * 0.7, B.hits); kick(t + 0.16, vel * 0.45, B.hits); }

// ---------- arrangement ----------
// cowbell riff (E phrygian), 2 bars of 16ths: [step, note]
const RIFF_A = [[0, 'E5'], [3, 'E5'], [6, 'G5'], [8, 'F5'], [10, 'E5'], [12, 'D5'], [14, 'E5']];
const RIFF_B = [[0, 'E5'], [3, 'E5'], [6, 'B5'], [8, 'A5'], [10, 'G5'], [12, 'F5'], [13, 'G5'], [14, 'E5']];
const BASS_A = [[0, 'E1', 5], [6, 'E1', 3.5], [10, 'G1', 2, 'F1']];
const BASS_B = [[0, 'E1', 5], [6, 'E1', 3.5], [10, 'D1', 2, 'E1']];

function grooveBar(t, { kickP = [0, 6, 10], clapP = [4, 12], hats = 16, roll = false, vel = 1, bassBar = BASS_A, bass = true, cow = null, cowVel = 0.6, openAt = 14, ghost = true } = {}) {
  for (const s of kickP) kick(t + s * S16, 0.95 * vel);
  for (const s of clapP) clap(t + s * S16, 0.85 * vel);
  if (ghost) clap(t + 15 * S16, 0.18 * vel, 0.1);
  if (hats) {
    const step = 16 / hats;
    for (let s = 0; s < 16; s += step) {
      if (roll && s >= 12) continue;
      if (s === openAt) { hat(t + s * S16, 0.45 * vel, true); continue; }
      hat(t + s * S16, (s % 4 === 0 ? 0.55 : s % 2 === 0 ? 0.42 : 0.3) * vel, false, (s % 2 ? 0.25 : -0.15));
    }
    if (roll) for (let j = 0; j < 6; j++) hat(t + 12 * S16 + j * (BEAT * 2 / 6) / 2, (0.25 + j * 0.06) * vel, false, -0.3 + j * 0.12);
  }
  if (bass) for (const [s, n, len, slide] of bassBar) bass808(t + s * S16, n, len * S16, { slideTo: slide, vel: 0.95 * vel });
  if (cow) for (const [s, n] of cow) cowbell(t + s * S16, n, cowVel, 0.24, (s % 4 === 0 ? -0.15 : 0.2));
}
function fourBars(t0, opts = {}, riffs = [RIFF_A, RIFF_B, RIFF_A, RIFF_B]) {
  for (let b = 0; b < 4; b++) grooveBar(t0 + b * 2, { ...opts, bassBar: b % 2 ? BASS_B : BASS_A, cow: opts.cowOn === false ? null : riffs[b], roll: opts.rollLast && b === 3 });
}
function snareRoll(t0, t1, vel = 0.6) {
  let tt = t0; let k = 0;
  while (tt < t1) {
    const x = (tt - t0) / (t1 - t0);
    clap(tt, vel * (0.35 + 0.65 * x), 0.15);
    const step = x < 0.5 ? S16 * 2 : x < 0.8 ? S16 : S16 / 2;
    tt += step; k++;
  }
}

// ===== 00:00-07:00 INTRO
drone(0.0, 7.05, { vel: 0.35 });
wind(0.0, 7.0, 0.1);
reverseSwell(4.0, 1.6, 0.35);
creaks(2.8, 6.95, 30, 0.35);
subBoom(4.0, 1.0, 3.0); braam(4.0, { vel: 1.0, len: 3.0 }); metalHit(4.0, { f0: 147, vel: 1.0, len: 3.5 }); crash(4.0, 0.5, 2.5);
pad(4.1, 6.8, ['E3', 'G3', 'B3'], { vel: 0.16, cutoff: 700, attack: 1.0, release: 0.4 });
bellFM(4.6, 'E5', { vel: 0.35, pan: -0.3 }); bellFM(5.6, 'G5', { vel: 0.28, pan: 0.3 }); bellFM(6.1, 'F5', { vel: 0.25, pan: 0.0 });
heartbeat(5.0, 0.5); heartbeat(6.0, 0.6);
riser(5.2, 6.85, 0.45);
reverseSwell(7.0, 0.5, 0.4);

// ===== 07:00-15:00 REVEAL
marbleShatter(7.0, 1.0); subBoom(7.0, 1.0, 2.2); kick(7.0, 1.0); crash(7.0, 0.8, 2.6); bass808(7.0, 'E1', 1.8, { vel: 1.0 });
drone(7.0, 9.1, { vel: 0.22, root: 'E1' });
pad(7.2, 9.0, ['E2', 'B2', 'E3'], { vel: 0.12, cutoff: 500 });
glassPluck(7.6, 'E6', 0.12, -0.5); glassPluck(8.1, 'B5', 0.1, 0.5); glassPluck(8.6, 'G6', 0.08, 0);
whoosh(8.7, 1.0, { vel: 0.35, f0: 200, f1: 2500 });
// 9-15: groove enters with a closing filter opening on the cowbell
for (let b = 0; b < 3; b++) {
  const t = 9 + b * 2;
  grooveBar(t, { kickP: [0, 10], clapP: [8], hats: 8, bassBar: b % 2 ? BASS_B : BASS_A, cow: b === 0 ? null : (b % 2 ? RIFF_B : RIFF_A), cowVel: 0.35 + b * 0.12, ghost: false, openAt: 14 });
}
bass808(9.5, 'E1', 0.4, { slideTo: 'G1', slideAt: 0.3, vel: 0.8 }); whoosh(9.3, 0.7, { vel: 0.4, f0: 300, f1: 4000, pan0: 0.6, pan1: -0.4 });
featherWhoosh(10.9, 2.2, 0.55); pad(11.0, 15.0, ['E3', 'G3', 'B3', 'D4'], { vel: 0.14, cutoff: 900, bright: 1.2 });
riser(13.4, 14.8, 0.4); snareRoll(14.0, 14.75, 0.55);
reverseSwell(15.0, 0.9, 0.45);

// ===== 15:00-24:00 CONTENT
fourBars(15.0, { vel: 1, cowVel: 0.62, rollLast: false });
crash(15.0, 0.75); subBoom(15.0, 0.6, 1.2);
metalHit(17.75, { f0: 330, vel: 0.5, len: 1.2, pan: -0.4 }); crash(18.0, 0.6); whoosh(17.6, 0.45, { vel: 0.4, f0: 600, f1: 5000 });
metalHit(20.75, { f0: 370, vel: 0.5, len: 1.2, pan: 0.4 }); crash(21.0, 0.6); whoosh(20.6, 0.45, { vel: 0.4, f0: 600, f1: 5000, pan0: 0.7, pan1: -0.7 });
// 23-24 break (2/4): four hard flash hits on the 8ths
[[23.0, 220, -0.5], [23.25, 247, 0.5], [23.5, 196, -0.3], [23.75, 165, 0.3]].forEach(([t, f, p]) => { metalHit(t, { f0: f, vel: 0.65, len: 0.9, pan: p }); kick(t, 0.7); whoosh(t - 0.08, 0.3, { vel: 0.3, f0: 800, f1: 6000, pan0: -p, pan1: p }); });
reverseSwell(24.0, 0.75, 0.5);

// ===== 24:00-33:00 IDENTITY
subBoom(24.0, 1.0, 3.0); braam(24.0, { vel: 0.9, len: 3.4, root: 'E1' }); crash(24.0, 0.5, 2.0);
for (let b = 0; b < 2; b++) {
  const t = 24 + b * 2;
  kick(t, 0.95); clap(t + 8 * S16, 0.8, 0.55);
  for (let s = 0; s < 16; s += 4) hat(t + s * S16 + 2 * S16, 0.28, false, 0.3);
  bass808(t, b ? 'C1' : 'E1', 1.6, { vel: 1.0, drive: 3.0 });
  cowbell(t + 6 * S16, 'E5', 0.22); cowbell(t + 14 * S16, 'F5', 0.2);
}
creaks(24.2, 28.0, 22, 0.32);
pad(24.0, 28.0, ['E2', 'G2', 'C3'], { vel: 0.13, cutoff: 600 });
riser(27.0, 28.0, 0.35);
whoosh(27.85, 0.7, { vel: 0.7, f0: 150, f1: 2200, pan0: 0.2, pan1: -0.2, peak: 0.25 }); bass808(28.0, 'G1', 0.9, { slideTo: 'E1', slideAt: 0.2, vel: 0.9 });
snareRoll(28.25, 28.95, 0.5);
metalHit(29.0, { f0: 110, vel: 1.0, len: 3.2 }); subBoom(29.0, 0.9, 2.0); crash(29.0, 0.8, 2.5); braam(29.0, { vel: 0.6, len: 2.2 });
for (let b = 0; b < 2; b++) grooveBar(29 + b * 2 >= 32.5 ? 99 : 29 + b * 2, { kickP: [0, 3, 6, 10], clapP: [8], hats: 16, bassBar: b ? BASS_B : BASS_A, cow: b ? RIFF_B : RIFF_A, cowVel: 0.5, vel: 1.0 });
// half bar 31-32.5 handled by the second groove bar (cut at 32.5 by the gate below)
reverseSwell(32.5, 0.4, 0.6);

// ===== 33:00-42:00 SHOWCASE (filtered groove, glassy)
fourBars(33.0, { vel: 0.85, cowVel: 0.45, kickP: [0, 6, 10], clapP: [4, 12] }, [RIFF_A, RIFF_B, RIFF_A, RIFF_B]);
pad(33.0, 41.5, ['E3', 'B3', 'D4', 'G4'], { vel: 0.12, cutoff: 1400 });
[33.55, 34.53, 35.51, 36.49, 37.47, 38.45].forEach((t, i) => { glassPluck(t, ['E6', 'B5', 'G6', 'D6', 'A5', 'E6'][i], 0.16, i % 2 ? 0.5 : -0.5); whoosh(t - 0.35, 0.5, { vel: 0.18, f0: 900, f1: 5000, pan0: i % 2 ? -0.6 : 0.6, pan1: i % 2 ? 0.6 : -0.6 }); });
riser(39.4, 41.5, 0.5); clicks(39.6, 40.6, 14, 0.25); snareRoll(40.75, 41.5, 0.5);
metalHit(40.62, { f0: 523, vel: 0.45, len: 1.5 }); kick(40.62, 0.7);
reverseSwell(42.0, 0.6, 0.55);

// ===== 42:00-51:00 CLIMAX (full power)
subBoom(42.0, 1.1, 3.0); braam(42.0, { vel: 1.0, len: 3.6 }); crash(42.0, 0.9, 3.0); metalHit(42.0, { f0: 98, vel: 0.8, len: 4 });
featherWhoosh(42.4, 3.0, 0.6);
fourBars(42.0, { vel: 1.05, cowVel: 0.7, kickP: [0, 3, 6, 10], clapP: [4, 12], rollLast: true });
for (let b = 0; b < 4; b++) for (const [s, n] of (b % 2 ? RIFF_B : RIFF_A)) cowbell(42 + b * 2 + s * S16, n.replace('5', '6'), 0.22, 0.18, 0.5);
pad(42.0, 51.0, ['E3', 'G3', 'B3', 'E4'], { vel: 0.17, cutoff: 1300, bright: 0.6 });
metalHit(46.0, { f0: 165, vel: 0.8, len: 3.2 }); bellFM(46.0, 'E5', { vel: 0.4 }); crash(46.0, 0.7);
grooveBar(50.0, { kickP: [0, 3], clapP: [], hats: 16, roll: true, bassBar: [[0, 'E1', 3, 'G1']], cow: null });
riser(50.0, 50.95, 0.45);

// ===== 51:00-60:00 FINAL (calm, notes for each line of the end card)
subBoom(51.0, 0.9, 3.2); crash(51.0, 0.6, 3.5); bass808(51.0, 'E1', 3.6, { vel: 0.9, drive: 1.8 }); metalHit(51.0, { f0: 147, vel: 0.6, len: 4.5 });
pad(51.0, 58.4, ['E3', 'G3', 'B3', 'D4'], { vel: 0.15, cutoff: 900, release: 1.5 });
drone(51.0, 59.8, { vel: 0.22 });
bellFM(52.0, 'E5', { vel: 0.38, pan: -0.2, len: 4 }); bellFM(53.0, 'B4', { vel: 0.3, pan: 0.2, len: 4 }); bellFM(53.8, 'G5', { vel: 0.26, pan: 0.0, len: 4 }); bellFM(54.5, 'E6', { vel: 0.24, pan: 0.0, len: 5 });
cowbell(52.5, 'E5', 0.2, 0.4, -0.5); cowbell(54.0, 'G5', 0.16, 0.4, 0.5);
wind(53.0, 59.9, 0.07);

// ---------- effects ----------
function freeverb(src, room = 0.84, damp = 0.35, width = 1) {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(x => Math.round(x * SR / 44100));
  const apT = [556, 441, 341, 225].map(x => Math.round(x * SR / 44100));
  const out = bus();
  for (const [ch, offs] of [['L', 0], ['R', 23]]) {
    const inp = src[ch], o = out[ch];
    const combs = combT.map(n => ({ buf: new Float32Array(n + offs), i: 0, f: 0 }));
    const aps = apT.map(n => ({ buf: new Float32Array(n + offs), i: 0 }));
    for (let k = 0; k < N; k++) {
      const x = inp[k] * 0.015;
      let s = 0;
      for (const c of combs) { const y = c.buf[c.i]; c.f = y * (1 - damp) + c.f * damp; c.buf[c.i] = x + c.f * room; c.i = (c.i + 1) % c.buf.length; s += y; }
      for (const a of aps) { const b = a.buf[a.i]; const y = -s + b; a.buf[a.i] = s + b * 0.5; a.i = (a.i + 1) % a.buf.length; s = y; }
      o[k] = s;
    }
  }
  return out;
}
function pingpong(src, time = 0.375, fb = 0.38, mix = 0.28) {
  const d = idx(time), out = bus();
  const bl = new Float32Array(d), br = new Float32Array(d); let i = 0;
  const lp = new Biquad('lp', 3500), lp2 = new Biquad('lp', 3500);
  for (let k = 0; k < N; k++) {
    const yl = bl[i], yr = br[i];
    bl[i] = src.L[k] + lp.p(yr) * fb; br[i] = src.R[k] + lp2.p(yl) * fb;
    out.L[k] = src.L[k] + yl * mix; out.R[k] = src.R[k] + yr * mix;
    i = (i + 1) % d;
  }
  return out;
}

// automation: section gains / filters for the music buses
function autoGain(t) {
  let g = 1;
  if (t >= 6.75 && t < 7.0) g = 0.0;                          // inhale before the shatter
  if (t >= 14.75 && t < 15.0) g *= 0.15;                       // gap before the content drop
  if (t >= 32.5 && t < 33.0) g = 0.0;                          // cut to darkness
  if (t >= 41.6 && t < 42.0) g *= 0.12;                        // breath before the climax
  if (t >= 58.4) g *= 1 - smooth(58.4, 59.95, t);              // final fade to silence
  return g;
}
const BUSGAIN = { drums: 0.85, bass: 0.9, bell: 0.75, pad: 0.8, sfx: 0.85, hits: 0.95 };

// showcase: muffle drums (low-pass) 33-39.4
{
  const lpL = new Biquad('lp', 1500), lpR = new Biquad('lp', 1500);
  for (let k = idx(33.0); k < idx(41.6); k++) {
    const t = k / SR, m = smooth(33.0, 33.2, t) * (1 - smooth(39.0, 40.6, t));
    if (k % 64 === 0) { const c = 1200 + (1 - m) * 15000; lpL.set(c); lpR.set(c); }
    const l = lpL.p(B.drums.L[k]), r = lpR.p(B.drums.R[k]);
    B.drums.L[k] = l; B.drums.R[k] = r;
  }
}
// reveal: cowbell filter opening 9-15
{
  const lpL = new Biquad('lp', 600), lpR = new Biquad('lp', 600);
  for (let k = idx(9.0); k < idx(15.0); k++) {
    const t = k / SR;
    if (k % 64 === 0) { const c = 500 + 9000 * Math.pow(smooth(9.0, 14.9, t), 2); lpL.set(c); lpR.set(c); }
    B.bell.L[k] = lpL.p(B.bell.L[k]); B.bell.R[k] = lpR.p(B.bell.R[k]);
  }
}

const bellDelayed = pingpong(B.bell, 0.375, 0.35, 0.3);
B.bell = bellDelayed;
console.log('reverbs...');
const room = freeverb(B.roomSend, 0.72, 0.4);
const hall = freeverb(B.hallSend, 0.9, 0.3);

// glitch stutters on the music: repeat a 1/32 slice several times
function stutter(buses, t, slice = S16 / 2, reps = 4, crush = 6) {
  const s0 = idx(t - slice), L = idx(slice);
  for (const b of buses) for (const ch of ['L', 'R']) {
    const src = b[ch].slice(s0, s0 + L);
    for (let r = 0; r < reps; r++) for (let k = 0; k < L; k++) {
      const q = Math.pow(2, crush);
      const v = Math.round(src[k] * q) / q;
      const edge = Math.min(1, k / 96, (L - k) / 96);
      const i = idx(t) + r * L + k; if (i < N) b[ch][i] = v * (1 - r * 0.12) * edge;
    }
  }
}
for (const t of [17.75, 20.75, 32.36, 49.75]) stutter([B.drums, B.bass, B.bell], t);

// ---------- mix ----------
const out = bus();
const hpL = new Biquad('hp', 24), hpR = new Biquad('hp', 24);
let env = 0, gs = 1, gsfx = 1;
const slew = 1 / (0.004 * SR); // 4 ms gain ramps: hard cuts without clicks
for (let k = 0; k < N; k++) {
  const t = k / SR, gt = autoGain(t);
  gs += clamp(gt - gs, -slew, slew);
  const g = gs;
  const st = (t >= 32.5 && t < 33.0) ? 0 : 1;
  gsfx += clamp(st - gsfx, -slew, slew);
  // sidechain duck on pads/bells from the kick energy
  let l = 0, r = 0;
  for (const [name, gain] of Object.entries(BUSGAIN)) {
    let gg = gain;
    if (name === 'sfx' || name === 'hits') gg *= gsfx;
    else gg *= g;
    l += B[name].L[k] * gg; r += B[name].R[k] * gg;
  }
  const rg = (t >= 32.52 && t < 33.0) ? 0.25 : 1;
  l += (room.L[k] * 0.9 + hall.L[k] * 1.1) * rg * (t >= 58.4 ? 1 - smooth(58.4, 59.97, t) : 1);
  r += (room.R[k] * 0.9 + hall.R[k] * 1.1) * rg * (t >= 58.4 ? 1 - smooth(58.4, 59.97, t) : 1);
  l = hpL.p(l); r = hpR.p(r);
  // glue compressor
  const lvl = Math.max(Math.abs(l), Math.abs(r));
  env = lvl > env ? env + (lvl - env) * 0.01 : env + (lvl - env) * 0.0002;
  const thr = 0.5, ratio = 3;
  const gr = env > thr ? Math.pow(env / thr, 1 / ratio - 1) : 1;
  out.L[k] = l * gr; out.R[k] = r * gr;
}
// normalise to -1 dBFS peak with a soft clipper
let peak = 0;
for (let k = 0; k < N; k++) peak = Math.max(peak, Math.abs(out.L[k]), Math.abs(out.R[k]));
const pre = 1.25 / peak;
const ceil = Math.pow(10, -1.2 / 20);
for (let k = 0; k < N; k++) {
  for (const ch of ['L', 'R']) out[ch][k] = Math.tanh(out[ch][k] * pre) * ceil / Math.tanh(1.25) * 0.999;
}
// hard silence at the very end
for (let k = idx(59.97); k < N; k++) { out.L[k] = 0; out.R[k] = 0; }

// ---------- write WAV ----------
const file = process.argv[2] || 'soundtrack.wav';
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let k = 0; k < N; k++) {
  buf.writeInt16LE(Math.round(clamp(out.L[k], -1, 1) * 32767), 44 + k * 4);
  buf.writeInt16LE(Math.round(clamp(out.R[k], -1, 1) * 32767), 46 + k * 4);
}
fs.writeFileSync(file, buf);
console.log('wrote', file, (N / SR).toFixed(3) + 's', 'peak before norm', peak.toFixed(3));
