"""Soundtrack builder: edits the licensed music track into the story structure and lays every synthesized SFX
on the shared cue sheet (build/cues.json, generated from js/scenes/* by tools/cues.mjs).

python3 tools/audio.py build/cues.json assets/audio/voxel_revolution_kevin_macleod.mp3 assets/audio/soundtrack.wav
All sound effects are synthesized here from scratch (no samples, no voice).
"""
import json, subprocess, sys, wave, zlib
import numpy as np

SR = 48000
rng = np.random.default_rng(7)


class Sig(np.ndarray):
    """1-D signal whose + pads the shorter operand with silence (SFX layers of different lengths)"""
    def __add__(self, o):
        if isinstance(o, np.ndarray) and o.ndim == 1 and self.ndim == 1 and len(o) != len(self):
            n = max(len(self), len(o)); a = np.zeros(n); a[:len(self)] = self; a[:len(o)] += o
            return a.view(Sig)
        return np.ndarray.__add__(self, o)
    __radd__ = __add__


def S(x):
    return np.asarray(x, float).view(Sig)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, d=None, curve=6.0):
    """attack + exponential decay envelope over n samples"""
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4))
    dur = n / SR
    return e * np.exp(-curve * x / dur) if d is None else e * np.exp(-x / d)


def sine(f, d, ph=0):
    tt = t_(d)
    f = np.broadcast_to(np.asarray(f, float), tt.shape) if np.ndim(f) else np.full(tt.shape, float(f))
    return S(np.sin(2 * np.pi * np.cumsum(f) / SR + ph))


def square(f, d, duty=0.5):
    tt = t_(d)
    f = np.broadcast_to(np.asarray(f, float), tt.shape) if np.ndim(f) else np.full(tt.shape, float(f))
    ph = np.cumsum(f) / SR % 1
    return S(np.where(ph < duty, 1.0, -1.0))


def saw(f, d):
    tt = t_(d)
    f = np.broadcast_to(np.asarray(f, float), tt.shape) if np.ndim(f) else np.full(tt.shape, float(f))
    return S(2 * (np.cumsum(f) / SR % 1) - 1)


def noise(d):
    return S(rng.standard_normal(int(d * SR)))


def sweep(f0, f1, d, curve='exp'):
    n = int(d * SR)
    k = np.linspace(0, 1, n)
    return f0 * (f1 / f0) ** k if curve == 'exp' else f0 + (f1 - f0) * k


def biquad(x, kind, f, q=0.707, gain_db=0):
    """RBJ biquad; f may be an array (time-varying, recomputed every 64 samples)"""
    x = np.asarray(x, float)
    y = np.zeros_like(x)
    fa = np.broadcast_to(np.asarray(f, float), x.shape) if np.ndim(f) else np.full(x.shape, float(f))
    x1 = x2 = y1 = y2 = 0.0
    blk = 64
    for s in range(0, len(x), blk):
        w0 = 2 * np.pi * min(max(fa[s], 20), SR * 0.45) / SR
        cw, sw = np.cos(w0), np.sin(w0)
        al = sw / (2 * q)
        if kind == 'lp':
            b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
        elif kind == 'hp':
            b0, b1, b2 = (1 + cw) / 2, -(1 + cw), (1 + cw) / 2
        else:  # band-pass (constant peak gain)
            b0, b1, b2 = al, 0, -al
        a0, a1, a2 = 1 + al, -2 * cw, 1 - al
        b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0
        for i in range(s, min(s + blk, len(x))):
            xi = x[i]
            yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2, x1, y2, y1 = x1, xi, y1, yi
            y[i] = yi
    return S(y)


def lp1(x, f):
    """cheap one-pole low-pass (vectorized via lfilter-like recursion in numpy loop over blocks)"""
    a = np.exp(-2 * np.pi * f / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return S(y)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def cat(*xs):
    return S(np.concatenate(xs))


def at(n_total, parts):
    """sum parts [(offset_s, signal)] into one buffer"""
    out = np.zeros(int(n_total * SR)).view(Sig)
    for off, s in parts:
        i = int(off * SR)
        j = min(len(out), i + len(s))
        out[i:j] += s[: j - i]
    return out


def kick(d=0.35, f0=150, f1=42, click=0.5):
    f = sweep(f0, f1, d)
    s = sine(f, d) * env(len(f), 0.001, d * 0.35)
    c = biquad(noise(0.01), 'hp', 3000) * click
    s[: len(c)] += c * np.linspace(1, 0, len(c))
    return s


def snare(d=0.2):
    n = biquad(noise(d), 'bp', 1800, 0.8) * env(int(d * SR), 0.001, d * 0.25)
    b = sine(190, d) * env(int(d * SR), 0.001, 0.04)
    return n * 1.2 + b * 0.6


def bell(freqs, d, decay=None):
    out = np.zeros(int(d * SR)).view(Sig)
    for k, f in enumerate(freqs):
        out += sine(f, d) * env(int(d * SR), 0.002, decay or d * 0.3) / (1 + k * 0.4)
    return out


def whoosh(d=0.5, f0=400, f1=3200, q=1.2):
    n = int(d * SR)
    k = np.linspace(0, 1, n)
    f = np.where(k < 0.5, f0 * (f1 / f0) ** (k * 2), f1 * (f0 / f1) ** ((k - 0.5) * 2))
    s = biquad(noise(d), 'bp', f, q)
    return s * np.sin(np.pi * k) ** 1.5


def reverb_ir(d=1.6, decay=0.45):
    n = int(d * SR)
    x = np.arange(n) / SR
    l = rng.standard_normal(n) * np.exp(-x / decay)
    r = rng.standard_normal(n) * np.exp(-x / decay)
    l[: int(0.01 * SR)] = 0; r[: int(0.013 * SR)] = 0
    return lp1(l, 6000) * 0.25, lp1(r, 6000) * 0.25


def conv(x, h):
    n = len(x) + len(h) - 1
    N = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(h, N), N)[:n]


# ---------------- SFX library ----------------
def SFX():
    L = {}
    L['key'] = biquad(noise(0.02), 'hp', 2500) * env(960, 0.0005, 0.004) * 0.6 + sine(2200, 0.02) * env(960, 0.0005, 0.003) * 0.3
    L['key2'] = biquad(noise(0.03), 'bp', 900, 1.0) * env(1440, 0.0005, 0.006) * 0.8
    L['winopen'] = cat(square(620, 0.06) * env(2880, 0.002), square(930, 0.12) * env(5760, 0.002)) * 0.18
    L['tick'] = sine(1250, 0.06) * env(2880, 0.001, 0.015) * 0.6
    L['blip'] = sine(sweep(900, 1500, 0.07), 0.07) * env(3360, 0.001, 0.025) * 0.6
    L['blip2'] = cat(sine(1000, 0.05) * env(2400, 0.001, 0.02), sine(1500, 0.08) * env(3840, 0.001, 0.03)) * 0.6
    f = sweep(320, 45, 0.4)
    L['stall'] = lp1(saw(f, 0.4), 1500) * np.linspace(1, 0, len(f)) * 0.5
    d = 0.9; n = int(d * SR)
    ch = sum(sine(fq, d) + 0.4 * square(fq, d) for fq in (196, 207.6, 293.7, 311.1))
    gate = (np.sin(2 * np.pi * 11 * t_(d)) > -0.2).astype(float)
    L['crit'] = lp1(ch * gate, 2500) * env(n, 0.003, 0.45) * 0.28
    L['err'] = (bell([440, 880], 0.35, 0.12) + bell([330, 660], 0.35, 0.12) * 0.7) * 0.4
    L['boomsoft'] = (sine(sweep(110, 35, 0.9), 0.9) * env(int(0.9 * SR), 0.002, 0.3) + lp1(noise(0.9), 300) * env(int(0.9 * SR), 0.002, 0.2) * 1.5) * 0.7
    L['toast'] = cat(sine(880, 0.06), sine(1320, 0.14)) * env(int(0.2 * SR), 0.003, 0.06) * 0.45
    L['popup'] = cat(*[sine(fq, 0.055) * env(2640, 0.002, 0.03) for fq in (1047, 1319, 1568)], np.zeros(2000)) * 0.4
    L['whoosh'] = whoosh(0.55) * 0.6
    L['whoosh_s'] = whoosh(0.3, 600, 4000) * 0.5
    L['whip'] = whoosh(0.2, 1200, 6000, 1.5) * 0.7
    L['click'] = at(0.08, [(0, biquad(noise(0.006), 'hp', 3000) * 0.9), (0.0, sine(3000, 0.01) * env(480, 0.0002, 0.002) * 0.5), (0.035, biquad(noise(0.005), 'hp', 2500) * 0.5)])
    d = 0.5; f = sweep(150, 2400, d)
    L['riser'] = (lp1(saw(f, d), 3000) * 0.25 + biquad(noise(d), 'bp', f * 1.5, 1.0) * 0.6) * np.linspace(0, 1, len(f)) ** 2
    d = 0.35; f = sweep(250, 2000, d)
    L['riser_s'] = biquad(noise(d), 'bp', f, 1.2) * np.linspace(0, 1, len(f)) ** 2 * 0.7
    parts = [(0, biquad(noise(0.25), 'hp', 2500) * env(12000, 0.001, 0.05))]
    for i in range(40):
        parts.append((rng.random() * 0.7, sine(2000 + rng.random() * 5000, 0.15) * env(7200, 0.001, 0.03) * 0.25))
    L['shatter'] = at(1.0, parts) * 0.8 + at(1.0, [(0, kick(0.4, 120, 40) * 0.6)])
    L['drop'] = at(1.6, [(0, kick(0.9, 110, 32, 1.0) * 1.1), (0, biquad(noise(1.2), 'lp', 1800) * env(int(1.2 * SR), 0.001, 0.3) * 0.5), (0, snare(0.25) * 0.6)])
    L['slam'] = at(0.5, [(0, kick(0.3, 140, 45)), (0, snare(0.22) * 0.9)]) * 0.8
    L['slam2'] = at(0.4, [(0, snare(0.18)), (0.012, snare(0.15) * 0.6), (0, kick(0.2, 120, 60) * 0.5)]) * 0.7
    L['hero'] = (bell([1200, 1870, 2650, 3480], 0.8, 0.25) * 0.5 + whoosh(0.25, 2000, 8000) * 0.4) * 0.6
    L['shine'] = bell([2637, 3951, 5274], 0.7, 0.2) * 0.35
    parts = [(i * 0.07, bell([2093 * 2 ** (i / 12 * 2), 4186], 0.4, 0.1) * 0.25) for i in range(6)]
    L['sparkle'] = at(1.0, parts)
    L['land'] = kick(0.25, 90, 40, 0.3) * 0.8 + lp1(noise(0.25), 400) * env(12000, 0.001, 0.05)
    L['notify'] = at(0.4, [(0, bell([1318.5, 2637], 0.12, 0.04) * 0.5), (0.085, bell([1760, 3520, 5274], 0.32, 0.09) * 0.55)])
    L['ding'] = at(0.9, [(0, bell([1318.5, 2637], 0.15, 0.05) * 0.6), (0.09, bell([1760, 3520, 5274], 0.8, 0.2) * 0.7)])
    parts = [(0, biquad(noise(0.06), 'bp', 1500, 0.7) * env(2880, 0.0005, 0.012) * 1.2)]
    for i in range(30):
        parts.append((0.03 + rng.random() * 0.8, biquad(noise(0.01), 'hp', 4000) * 0.5))
    L['confetti'] = at(1.0, parts) + whoosh(0.4, 1500, 6000) * 0.3
    seg = []
    for i in range(10):
        dd = 0.02 + rng.random() * 0.03
        s = square(80 + rng.random() * 900, dd) * 0.3 if rng.random() > 0.3 else np.zeros(int(dd * SR))
        seg.append(np.round(s * 4) / 4)
    L['glitch'] = cat(*seg)
    d = 1.6; n = int(d * SR)
    L['bossdrone'] = np.tanh(lp1(saw(55, d) + saw(55.7, d) + 0.6 * saw(82.4, d), 500) * 1.5) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.45
    L['join'] = cat(*[square(fq, 0.07) * env(3360, 0.002, 0.04) for fq in (523, 784, 1047)], square(1568, 0.2) * env(9600, 0.002, 0.08)) * 0.18
    d = 0.6; n = int(d * SR); k = np.linspace(0, 1, n)
    pitch = 520 + 220 * np.sin(np.pi * k ** 0.8) + 12 * np.sin(2 * np.pi * 6 * k * d)
    form = 900 + 1200 * np.sin(np.pi * k ** 0.6)
    L['meow'] = biquad(saw(pitch, d), 'bp', form, 2.0) * np.sin(np.pi * k) ** 0.7 * 2.0
    L['powerdown'] = square(sweep(880, 90, 0.6), 0.6, 0.3) * np.linspace(1, 0, int(0.6 * SR)) * 0.2
    parts = []; tt = 0.0; i = 0
    while i < 14:
        parts.append((tt, sine(800 + i * 60, 0.025) * env(1200, 0.0005, 0.006) * 0.5)); tt += 0.05 * (0.92 ** i); i += 1
    L['counter'] = at(0.8, parts)
    notes = [(392, 0.28), (370, 0.28), (349, 0.28), (330, 0.9)]
    sad = []
    for j, (fq, dd) in enumerate(notes):
        n = int(dd * SR); x = np.arange(n) / SR
        vib = 1 + (0.025 * np.sin(2 * np.pi * 6 * x) * (x / dd) if j == 3 else 0)
        s = lp1(saw(fq * vib, dd), 1200) * np.minimum(1, x / 0.03) * np.minimum(1, (dd - x) / 0.05)
        sad.append(s)
    L['sad'] = cat(*sad) * 0.35
    L['throne'] = (kick(0.6, 70, 35, 0.2) + bell([523, 784, 1047], 0.8, 0.3) * 0.2) * 0.8
    d = 0.4; x = t_(d)
    L['bigbutton'] = at(0.5, [(0, kick(0.15, 220, 90, 0.8) * 0.8), (0.04, sine(300 + 60 * np.sin(2 * np.pi * 18 * x) * np.exp(-x * 6), d) * env(len(x), 0.002, 0.12) * 0.4)])
    d = 0.4; x = t_(d)
    L['scratch'] = biquad(noise(d), 'bp', 1200 + 900 * np.sin(2 * np.pi * 5 * x), 3) * np.sin(np.pi * x / d) * 1.4
    L['spin'] = at(1.0, [(0, whoosh(0.35) * 0.6), (0.3, whoosh(0.35) * 0.6), (0.6, whoosh(0.35) * 0.5)])
    L['doorbust'] = at(0.9, [(0, kick(0.4, 100, 40, 1)), (0, lp1(noise(0.7), 2500) * env(int(0.7 * SR), 0.001, 0.15) * 1.2)]) * 0.8
    L['cardflip'] = at(0.3, [(0, biquad(noise(0.03), 'bp', 2500, 1) * env(1440, 0.001, 0.008)), (0.08, biquad(noise(0.03), 'bp', 3000, 1) * env(1440, 0.001, 0.008))]) * 1.2
    d = 0.5; k = np.linspace(0, 1, int(d * SR))
    L['reverse'] = (biquad(noise(d), 'hp', 3000) * k ** 3 * 0.6 + sine(sweep(200, 900, d), d) * k ** 2 * 0.3)
    L['powerup'] = cat(*[square(fq, 0.06) * env(2880, 0.002, 0.04) for fq in (523, 659, 784, 1047, 1319, 1568)]) * 0.18
    L['cash'] = at(1.0, [(0, biquad(noise(0.05), 'bp', 3000) * env(2400, 0.001, 0.01) * 1.2), (0.05, bell([2093, 2637, 4186], 0.9, 0.25) * 0.5)])
    L['scan'] = at(0.6, [(i * 0.15, sine(sweep(800, 1600, 0.1), 0.1) * env(4800, 0.002, 0.04) * 0.4) for i in range(3)])
    L['coin'] = cat(square(988, 0.06) * 0.15, square(1319, 0.3) * env(14400, 0.001, 0.1) * 0.15)
    L['hmm'] = at(0.9, [(0, bell([659, 1318], 0.3, 0.1) * 0.4), (0.18, bell([587, 1175], 0.3, 0.1) * 0.4), (0.4, bell([784, 1568], 0.5, 0.15) * 0.4)])
    d = 1.0; x = t_(d)
    L['tension'] = at(1.0, [(0, kick(0.2, 70, 40, 0) * 0.8), (0.18, kick(0.2, 65, 40, 0) * 0.6), (0, sine(1760, d) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * x)) * np.sin(np.pi * x / d) * 0.06)])
    d = 1.6; n = int(d * SR)
    L['boom'] = (lp1(noise(d), 900) * env(n, 0.002, 0.35) * 2.2 + sine(sweep(80, 28, d), d) * env(n, 0.002, 0.4) * 0.9 + biquad(noise(d), 'hp', 2000) * env(n, 0.001, 0.05) * 0.4)
    L['mega'] = at(2.4, [(0, L['drop'] * 1.0), (0, L['boom'] * 0.8), (0, whoosh(0.8, 300, 5000) * 0.4)])
    L['send'] = sine(sweep(300, 1400, 0.09), 0.09) * env(4320, 0.002, 0.04) * 0.4 + whoosh(0.2, 1500, 6000) * 0.3
    L['stack'] = bell([520, 1100], 0.09, 0.025) * 0.5 + kick(0.06, 200, 120, 0.3) * 0.3
    L['clank'] = bell([300, 731, 1190, 1850, 2600], 0.7, 0.18) * 0.5
    d = 0.6; x = t_(d)
    L['neon'] = lp1(square(120, d), 3000) * (rng.random(int(d * SR)) > 0.02) * (0.5 + 0.5 * (np.sin(2 * np.pi * 9 * x) > 0)) * 0.1
    d = 0.9; x = t_(d)
    L['creak'] = biquad(saw(40 + 25 * np.sin(2 * np.pi * 1.3 * x), d), 'bp', 700, 4) * np.sin(np.pi * x / d) * 2.5
    d = 0.55; f = sweep(2500, 250, d)
    L['zoom'] = (biquad(noise(d), 'bp', f, 1.5) * 0.8 + sine(f * 0.3, d) * 0.12) * np.sin(np.pi * np.linspace(0, 1, len(f))) ** 0.5
    L['snip'] = at(0.15, [(0, biquad(noise(0.01), 'hp', 4000) * 0.9 + 0), (0.0, bell([3200, 5100], 0.1, 0.02) * 0.3), (0.06, biquad(noise(0.008), 'hp', 4500) * 0.7)])
    L['pop'] = sine(sweep(380, 1100, 0.05), 0.05) * env(2400, 0.001, 0.015) * 0.6
    d = 0.7; x = t_(d)
    L['stretch'] = sine(sweep(160, 520, d) * (1 + 0.04 * np.sin(2 * np.pi * 9 * x)), d) * np.sin(np.pi * x / d) * 0.35
    d = 1.7; x = t_(d)
    tyre = biquad(noise(d), 'bp', 2600 + 500 * np.sin(2 * np.pi * 3 * x), 6) * 1.6
    eng = lp1(saw(90 + 70 * x / d + 6 * np.sin(2 * np.pi * 7 * x), d), 900) * 0.4
    L['drift'] = (tyre * np.minimum(1, x / 0.15) + eng) * np.minimum(1, (d - x) / 0.3)
    L['coins'] = at(1.2, [(rng.random() * 0.9, bell([3000 + rng.random() * 2500, 6200], 0.12, 0.03) * 0.25) for _ in range(28)])
    L['magic'] = at(1.0, [(i * 0.06, bell([1047 * 2 ** ([0, 2, 4, 7, 9][i % 5] / 12 + i // 5), 0], 0.35, 0.1) * 0.25) for i in range(12)])
    L['pageflip'] = at(0.35, [(0, biquad(noise(0.12), 'bp', 2200, 0.8) * np.sin(np.pi * np.linspace(0, 1, 5760)) * 0.6), (0.14, biquad(noise(0.12), 'bp', 2600, 0.8) * np.sin(np.pi * np.linspace(0, 1, 5760)) * 0.5)])
    L['bookslam'] = kick(0.3, 120, 50, 0.6) * 0.8 + lp1(noise(0.2), 1500) * env(9600, 0.001, 0.03)
    L['impact'] = at(1.4, [(0, kick(0.8, 90, 28, 1.0) * 1.1), (0, lp1(noise(1.2), 2000) * env(int(1.2 * SR), 0.001, 0.25) * 1.3), (0.02, snare(0.3) * 0.5)]) * 0.9
    L['birds'] = at(1.0, [(o, sine(sweep(3200 + rng.random() * 1500, 4800 + rng.random() * 1200, 0.07), 0.07) * env(3360, 0.003, 0.03) * 0.15) for o in (0.05, 0.14, 0.4, 0.48, 0.75)])
    d = 0.9
    L['bass'] = np.tanh(sine(sweep(70, 44, d), d) * 2.0) * env(int(d * SR), 0.002, 0.4) * 0.9 + kick(0.1, 300, 100, 1.0) * 0.4
    parts = []
    for i in range(9):
        o = i * 0.15 + rng.random() * 0.05
        parts.append((o, kick(0.12, 160, 70, 0.6) * 0.7 if i % 2 else whoosh(0.15, 1000, 5000) * 0.5))
    L['fight'] = at(1.5, parts)
    L['rec'] = cat(sine(1000, 0.07) * env(3360, 0.002), np.zeros(2400), sine(1000, 0.07) * env(3360, 0.002)) * 0.3
    L['shutter'] = at(0.2, [(0, biquad(noise(0.02), 'bp', 3000, 1) * env(960, 0.0005, 0.006)), (0.07, biquad(noise(0.03), 'bp', 2200, 1) * env(1440, 0.0005, 0.01))]) * 1.3
    L['save'] = at(0.6, [(i * 0.08, bell([fq, fq * 2], 0.3, 0.08) * 0.35) for i, fq in enumerate((784, 988, 1175))])
    L['install'] = at(0.9, [(i * 0.09, bell([fq, fq * 2], 0.4, 0.12) * 0.35) for i, fq in enumerate((659, 784, 988, 1319))])
    L['alarm'] = cat(*[square(fq, 0.2) * 0.12 for fq in (740, 990, 740, 990, 740)]) * np.minimum(1, np.linspace(5, 0, int(1.0 * SR)))
    L['alarm_s'] = cat(square(880, 0.08), np.zeros(1900), square(880, 0.08)) * 0.08
    d = 0.7; f = sweep(400, 40, d)
    L['freeze'] = (lp1(saw(f, d), 1200) * 0.3 + whoosh(d, 3000, 300) * 0.4) * np.linspace(1, 0, len(f)) ** 0.7
    d = 0.5; k = np.linspace(0, 1, int(d * SR))
    L['implode'] = (biquad(noise(d), 'bp', sweep(200, 6000, d), 1.2) * 0.7 + sine(sweep(60, 900, d), d) * 0.3) * k ** 2.5
    d = 1.6; n = int(d * SR)
    stab = sum(lp1(saw(fq, d), 2400) for fq in (130.8, 196, 261.6, 329.6, 392)) * env(n, 0.003, 0.18) * 0.22
    L['final'] = at(2.2, [(0, stab), (0, kick(0.7, 120, 32, 1.0)), (0, snare(0.3) * 0.7)])
    return L


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def fade(n, a, b):
    """gain curve of length n going a->b (cosine)"""
    return a + (b - a) * (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n)))


def main(cues_path, music_path, out_path):
    C = json.load(open(cues_path))
    N = int(C['DUR'] * SR)
    music = decode(music_path)
    mus = np.zeros((N, 2))

    def place(v0, v1, tr0, fin=0.004, fout=0.02):
        i0, i1 = int(v0 * SR), int(v1 * SR)
        j0 = int(tr0 * SR)
        seg = music[j0:j0 + (i1 - i0)].copy()
        n = len(seg)
        g = np.ones(n)
        a, b = int(fin * SR), int(fout * SR)
        g[:a] = np.linspace(0, 1, a); g[-b:] = np.linspace(1, 0, b)
        mus[i0:i0 + n] += seg * g[:, None]

    place(C['M0'], C['CLIMAX'], C['TRACK_A'], fout=0.03)
    place(C['B0'], C['MUSIC_END'], C['TRACK_B'], fout=0.012)
    # comedic mutes (track keeps running underneath, so the beat returns on the grid)
    for a, b in C['MUTES']:
        i0, i1 = int(a * SR), int(b * SR)
        r = int(0.012 * SR)
        mus[i0:i0 + r] *= fade(r, 1, 0)[:, None]
        mus[i0 + r:i1 - r] = 0
        mus[i1 - r:i1] *= fade(r, 0, 1)[:, None]

    # intro drone (0 .. M0): sub + detuned saws through a slowly opening filter, swelling to the drop
    d = C['M0']; x = t_(d)
    k = x / d
    sub = sine(41.2, d) * 0.5
    pad = saw(82.4, d) + saw(82.9, d) + saw(123.5, d) * 0.6 + saw(164.8 * (1 + 0.003 * np.sin(2 * np.pi * 0.3 * x)), d) * 0.4
    pad = biquad(pad, 'lp', 180 + 2200 * k ** 2, 0.9)
    pulse = (0.6 + 0.4 * np.sin(2 * np.pi * (BPM_INTRO := 123 / 60) * x * 0.5) ** 2)
    drone = (sub + pad * 0.18) * pulse * np.minimum(1, x / 1.5)
    # after the error the drone gets tense and distorted
    err = (x > 6.6).astype(float)
    drone = drone * (1 - err) + np.tanh(drone * 3) * 0.35 * err
    # pre-drop silence gap for the click
    gap = np.ones_like(x); g0, g1 = int(10.22 * SR), int(10.5 * SR)
    gap[g0:g1] = np.linspace(1, 0.15, g1 - g0)
    drone *= gap
    st = np.stack([drone, drone], 1) * 0.55
    mus[: len(st)] += st

    # SFX bus
    L = SFX()
    sfx = np.zeros((N, 2))
    missing = set()
    for c in C['cues']:
        s = L.get(c['name'])
        if s is None:
            missing.add(c['name']); continue
        s = np.asarray(s, float)
        pk, rm = np.max(np.abs(s)) + 1e-9, np.sqrt(np.mean(s ** 2)) + 1e-9
        s = s * min(0.55 / pk, 10 ** (-21 / 20) / rm)
        i = int(c['t'] * SR)
        if i >= N:
            continue
        j = min(N, i + len(s))
        pan = (zlib.crc32((c["name"] + str(c["t"])).encode()) % 1000 / 1000 - 0.5) * 0.5
        sfx[i:j, 0] += s[: j - i] * c['gain'] * (1 - pan)
        sfx[i:j, 1] += s[: j - i] * c['gain'] * (1 + pan)
    if missing:
        print('missing sfx:', sorted(missing))
    # light room reverb on SFX
    hl, hr = reverb_ir(1.2, 0.3)
    wet = np.stack([conv(sfx[:, 0], hl)[:N], conv(sfx[:, 1], hr)[:N]], 1)
    sfx = sfx + wet * 0.35

    # duck music slightly under big SFX moments
    env_s = np.abs(sfx).max(1)
    sm = np.convolve(env_s, np.ones(2400) / 2400, 'same')
    duck = 1 - np.clip(sm * 0.4, 0, 0.2)
    mix = mus * 0.8 * duck[:, None] + sfx * 0.75
    # hard silence after the cut (the final ding rings out under the black frame only until the end)
    # master: soft clip + peak normalize
    mix = np.tanh(mix * 0.9) / 0.9
    peak = np.max(np.abs(mix))
    mix = mix / peak * 0.93
    rms = np.sqrt(np.mean(mix ** 2))
    print(f'peak {20 * np.log10(np.max(np.abs(mix))):.2f} dBFS, rms {20 * np.log10(rms):.2f} dBFS, len {len(mix) / SR:.3f}s')
    pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    # stems for listening checks
    if len(sys.argv) > 4:
        for name, buf in (('music', mus), ('sfx', sfx)):
            b2 = (np.clip(buf / (np.max(np.abs(buf)) + 1e-9) * 0.9, -1, 1) * 32767).astype('<i2')
            with wave.open(sys.argv[4] + f'_{name}.wav', 'wb') as w:
                w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(b2.tobytes())


if __name__ == '__main__':
    main(*sys.argv[1:4])
