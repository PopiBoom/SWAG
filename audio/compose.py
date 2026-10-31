"""MEMENTO MORI — original soundtrack + sound design (dark phonk / industrial / dark ambient).
Everything is synthesised here from scratch (numpy/scipy) and placed on the shared timeline,
so musical accents land exactly on the visual events. Output: audio/mix.wav (48 kHz, stereo)."""
import json, os, subprocess, wave, sys
import numpy as np
import scipy.signal as ss
from scipy.ndimage import maximum_filter1d, minimum_filter1d
from timeline import E, BEAT, BAR, DURATION, data as tl_data

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
N = int((DURATION + 0.5) * SR)
rng = np.random.default_rng(1337)
TL = tl_data()

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def m(s):
    return 12 * (int(s[-1]) + 1) + NOTE[s[:-1]]


def hz(x):
    if isinstance(x, str):
        x = m(x)
    return 440.0 * 2 ** ((x - 69) / 12)


# ---------------------------------------------------------------- buses
BUS = {k: np.zeros((2, N)) for k in ['amb', 'pad', 'bass', 'drums', 'lead', 'sfx', 'voice', 'impact']}
KICKS = []  # kick times for sidechain


def put(bus, sig, t, gain=1.0, pan=0.0):
    sig = np.asarray(sig, dtype=np.float64)
    if sig.ndim == 1:
        a = np.pi / 4 * (pan + 1)
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    i0 = int(round(t * SR))
    if i0 >= N:
        return
    s0 = 0
    if i0 < 0:
        s0, i0 = -i0, 0
    n = min(sig.shape[1] - s0, N - i0)
    if n > 0:
        BUS[bus][:, i0:i0 + n] += gain * sig[:, s0:s0 + n]


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def lp(x, fc, order=2):
    return ss.sosfilt(ss.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return ss.sosfilt(ss.butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return ss.sosfilt(ss.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)


def sweep(x, f_of_t, kind='low', order=2, block=256):
    """time-varying butterworth filter; f_of_t: array of cutoff per sample (or (lo,hi) for band)"""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        fc = f_of_t[min(i, len(f_of_t) - 1)]
        if kind == 'band':
            lo, hi = fc
            sos = ss.butter(order, [max(20, lo), min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
        else:
            sos = ss.butter(order, min(max(fc, 20), SR * 0.45), kind, fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y[i:i + block], zi = ss.sosfilt(sos, x[i:i + block], zi=zi)
    return y


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def phase_of(f):
    return 2 * np.pi * np.cumsum(f) / SR


def saw(ph):
    return 2 * ((ph / (2 * np.pi)) % 1.0) - 1


def sq(ph, duty=0.5):
    return np.where(((ph / (2 * np.pi)) % 1.0) < duty, 1.0, -1.0)


def env_ar(n, a, r, total=None):
    """attack/release envelope over n samples (a, r in seconds)"""
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na)
    nr = min(nr, n)
    e[n - nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def sat(x, d=2.0):
    return np.tanh(d * x) / np.tanh(d)


# ---------------------------------------------------------------- instruments
def kick(drive=2.2, f0=170, f1=46, dec=0.32, dur=0.6):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.028)
    s = np.sin(phase_of(f)) * np.exp(-t / dec)
    click = hp(noise(dur), 2500) * np.exp(-t / 0.004) * 0.35
    return sat(s + click, drive) * env_ar(len(t), 0.0005, 0.03)


def snare(dur=0.45, tone=185, bright=1.0):
    t = tt(dur)
    body = np.sin(phase_of(tone * (1 + 0.6 * np.exp(-t / 0.01)))) * np.exp(-t / 0.07)
    nz = bp(noise(dur), 1200, 9000) * np.exp(-t / (0.11 * bright))
    return sat(0.7 * body + 0.9 * nz, 1.6)


def clap(dur=0.4):
    t = tt(dur)
    e = np.zeros_like(t)
    for d in (0, 0.011, 0.022, 0.031):
        e += np.where(t >= d, np.exp(-(t - d) / 0.0055), 0)
    e += np.where(t >= 0.031, 0.6 * np.exp(-(t - 0.031) / 0.09), 0)
    return bp(noise(dur), 900, 4200) * e * 1.4


HAT_F = [263, 400, 421, 474, 587, 845]


def hat(open_=False, dur=None):
    dur = dur or (0.45 if open_ else 0.09)
    t = tt(dur)
    s = sum(sq(phase_of(np.full(len(t), f * 2.6))) for f in HAT_F)
    s = hp(bp(s / 6, 6500, 16000), 7000) + 0.25 * hp(noise(dur), 9000)
    return s * np.exp(-t / (0.16 if open_ else 0.022))


def cowbell(f, dur=0.32, drive=2.5):
    t = tt(dur)
    s = sq(phase_of(np.full(len(t), f))) + 0.8 * sq(phase_of(np.full(len(t), f * 1.481)))
    s = bp(s, f * 0.9, min(f * 5, 12000))
    e = 0.65 * np.exp(-t / 0.018) + 0.45 * np.exp(-t / 0.13)
    return lp(sat(s * e * 0.8, drive), 7500) * env_ar(len(t), 0.0008, 0.02)


def b808(f, dur, glide_to=None, glide_at=None, drive=2.8, punch=0.9, rel=0.08):
    t = tt(dur + rel)
    ff = np.full(len(t), float(f))
    if glide_to:
        ga = glide_at if glide_at is not None else dur * 0.6
        g = np.clip((t - ga) / 0.09, 0, 1)
        g = g * g * (3 - 2 * g)
        ff = f * (glide_to / f) ** g
    ff = ff * (1 + punch * np.exp(-t / 0.014))
    s = np.sin(phase_of(ff))
    e = np.ones(len(t))
    e *= np.exp(-np.maximum(t - 0.02, 0) / (dur * 2.2 + 0.2))
    n_d = int(dur * SR)
    e[n_d:] *= np.linspace(1, 0, len(t) - n_d) ** 2
    e[:48] *= np.linspace(0, 1, 48)
    return sat(s * e, drive) * 0.9


def supersaw(freqs, dur, voices=6, detune=0.12, a=0.6, r=1.2, fc=1800, vib=0.0):
    t = tt(dur + r)
    out = np.zeros(len(t))
    for f in freqs:
        for v in range(voices):
            d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            fv = f * 2 ** (d / 12) * (1 + vib * np.sin(2 * np.pi * 5.1 * t + v))
            ph = phase_of(fv) + rng.uniform(0, 2 * np.pi)
            out += saw(ph)
    out /= (len(freqs) * voices) ** 0.5
    out = lp(out, fc, 2)
    e = np.ones(len(t))
    na = int(a * SR)
    e[:na] = np.linspace(0, 1, na) ** 2
    nd = int(dur * SR)
    e[nd:] = np.linspace(1, 0, len(t) - nd) ** 2
    return out * e


VOWEL = {'a': [(800, 1.0), (1150, 0.6), (2900, 0.25)], 'o': [(450, 1.0), (800, 0.5), (2830, 0.15)],
         'u': [(325, 1.0), (700, 0.3), (2530, 0.1)]}


def choir(freqs, dur, vowel='a', a=1.2, r=1.8):
    t = tt(dur + r)
    src = np.zeros(len(t))
    for f in freqs:
        for v in range(4):
            fv = f * 2 ** ((v - 1.5) * 0.09 / 12) * (1 + 0.006 * np.sin(2 * np.pi * (4.6 + v * 0.3) * t + v))
            src += saw(phase_of(fv) + rng.uniform(0, 6))
    out = np.zeros(len(t))
    for fc, g in VOWEL[vowel]:
        out += g * bp(src, fc * 0.88, fc * 1.12, 2)
    out = out / (len(freqs) * 4) ** 0.5 * 1.8
    e = np.ones(len(t))
    na = int(a * SR)
    e[:na] = np.linspace(0, 1, na) ** 2
    nd = int(dur * SR)
    e[nd:] = np.linspace(1, 0, len(t) - nd) ** 2
    return out * e


def bell(f, dur=4.0, ratio=1.4, index=5.0):
    t = tt(dur)
    I = index * np.exp(-t / 0.6)
    mod = np.sin(2 * np.pi * f * ratio * t)
    s = np.sin(2 * np.pi * f * t + I * mod) * np.exp(-t / 1.4)
    s += 0.3 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / 0.5)
    return s * env_ar(len(t), 0.002, 0.3)


def pluck(f, dur=0.35):
    t = tt(dur)
    s = saw(phase_of(np.full(len(t), f))) + 0.5 * saw(phase_of(np.full(len(t), f * 1.006)))
    fc = 300 + 5200 * np.exp(-t / 0.07)
    s = sweep(s, fc, 'low', 2, 128)
    return s * np.exp(-t / 0.16) * env_ar(len(t), 0.001, 0.03)


def riser(dur, f0=300, f1=9000, tone=True):
    t = tt(dur)
    x = t / dur
    fc = f0 * (f1 / f0) ** x
    s = sweep(noise(dur), np.stack([fc * 0.7, fc * 1.3], 1), 'band', 2, 256)
    out = s * x ** 2
    if tone:
        ft = 110 * 2 ** (x * 3.0)
        out += 0.25 * saw(phase_of(ft)) * x ** 3
        out = lp(out, 9000)
    return out


def whoosh(dur=0.9, f0=400, f1=3500):
    t = tt(dur)
    x = t / dur
    fc = f0 * (f1 / f0) ** np.sin(np.pi * x)
    s = sweep(noise(dur), np.stack([fc * 0.6, fc * 1.5], 1), 'band', 2, 256)
    return s * np.sin(np.pi * x) ** 2


def impact(dur=3.5, f0=62, f1=28, metal=0.5):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    sub = np.sin(phase_of(f)) * np.exp(-t / 1.1)
    body = lp(noise(dur), 900) * np.exp(-t / 0.18)
    crack = hp(noise(dur), 1500) * np.exp(-t / 0.05)
    mt = sum(np.sin(2 * np.pi * fr * t) * np.exp(-t / dc) for fr, dc in
             [(523, 0.9), (811, 0.7), (1244, 0.5), (1873, 0.35), (2690, 0.25)]) / 5
    return sat(1.0 * sub + 0.6 * body + 0.35 * crack + metal * mt, 1.8)


def glass(dur=2.4, n=260):
    out = np.zeros(int(dur * SR))
    out[:int(0.5 * SR)] += hp(noise(0.5), 2500) * np.exp(-tt(0.5) / 0.09) * 0.8
    for i in range(n):
        st = (rng.uniform(0, 1) ** 2.2) * (dur - 0.3)
        f = rng.uniform(2600, 9500)
        d = rng.uniform(0.015, 0.11)
        L = int(d * 5 * SR)
        tk = np.arange(L) / SR
        s = np.sin(2 * np.pi * f * tk + rng.uniform(0, 6)) * np.exp(-tk / d)
        s += 0.5 * np.sin(2 * np.pi * f * 1.63 * tk) * np.exp(-tk / (d * 0.6))
        i0 = int(st * SR)
        g = rng.uniform(0.1, 0.45) * (1 - st / dur) ** 1.3
        out[i0:i0 + L] += g * s[:len(out) - i0]
    return out


def crackle(dur, density=120, buzz=0.35):
    out = np.zeros(int(dur * SR))
    k = int(density * dur)
    for _ in range(k):
        i = rng.integers(0, len(out) - 400)
        L = rng.integers(40, 380)
        out[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.2, 1)
    out = bp(out, 1800, 9000)
    t = tt(dur)
    bz = sq(phase_of(np.full(len(t), 60.0)), 0.3) * (rng.standard_normal(len(t)) > 0.6)
    out += buzz * lp(bz, 2500) * 0.3
    return out


def key_click(i):
    d = 0.06
    t = tt(d)
    s = bp(noise(d), 1800 + 300 * (i % 5), 6500) * np.exp(-t / 0.006)
    s += 0.6 * np.sin(2 * np.pi * (140 + 15 * (i % 3)) * t) * np.exp(-t / 0.012)
    return s


def blip(f, d=0.06):
    t = tt(d)
    return lp(sq(phase_of(np.full(len(t), f)), 0.3), 4000) * np.exp(-t / (d / 3)) * env_ar(len(t), 0.001, 0.01)


def heartbeat():
    out = np.zeros(int(0.9 * SR))
    for o, g in ((0, 1.0), (0.24, 0.7)):
        t = tt(0.5)
        s = np.sin(phase_of(42 + 30 * np.exp(-t / 0.03))) * np.exp(-t / 0.12)
        i = int(o * SR)
        out[i:i + len(s)] += g * s
    return out


def reverse_swell(dur=1.0):
    s = hp(noise(dur), 600) * np.exp(-tt(dur) / (dur / 3))
    s = s + 0.5 * impact(dur, metal=0.8)[:len(s)]
    return lp(s[::-1], 7000)


# ---------------------------------------------------------------- helpers for patterns
def step_t(bar_start, step):  # 16th steps from a bar start time
    return bar_start + step * BEAT / 4


PROG_A = [('F', ['F3', 'Ab3', 'C4'], 'F1'), ('Db', ['Db3', 'F3', 'Ab3'], 'Db2'),
          ('Bbm', ['Bb2', 'Db3', 'F3'], 'Bb1'), ('C', ['C3', 'E3', 'G3'], 'C2')]
COW = {'F': ['C6', 'Ab5', 'F5', 'Ab5', 'C6'], 'Db': ['Db6', 'Ab5', 'F5', 'Ab5', 'Db6'],
       'Bbm': ['Db6', 'Bb5', 'F5', 'Bb5', 'Db6'], 'C': ['C6', 'G5', 'E5', 'G5', 'Bb5']}
COW_STEPS = [0, 3, 6, 10, 13]


def chord_at(t, t0=E['city']):
    i = int(np.floor((t - t0) / BAR + 1e-6)) % 4
    return PROG_A[i]


def place_kick(t, g=1.0, **kw):
    put('drums', kick(**kw), t, 0.95 * g)
    KICKS.append(t)


def beat_bar(t0, style, g=1.0, cow=True, cow_oct=0, bass=True, hats=True):
    """one bar of phonk groove starting at t0. style: 'half' | 'full' | 'drop' | 'light'"""
    name, pad, root = chord_at(t0)
    r = hz(root)
    # kicks
    if style == 'half':
        ks, sn = [0, 7, 10], [8]
    elif style == 'full':
        ks, sn = [0, 6, 10], [4, 12]
    elif style == 'drop':
        ks, sn = [0, 3, 6, 10, 14], [4, 12]
    else:  # light
        ks, sn = [0, 10], []
    for k in ks:
        place_kick(step_t(t0, k), g * (1.0 if k == 0 else 0.85), drive=3.0 if style == 'drop' else 2.2)
    for s_ in sn:
        put('drums', snare(), step_t(t0, s_), 0.55 * g, 0.05)
        put('drums', clap(), step_t(t0, s_) + 0.004, 0.5 * g, -0.08)
    # hats
    if hats:
        dens = 4 if style in ('full', 'drop') else 2
        for s_ in range(0, 16, 4 // dens * 1 if dens == 4 else 2):
            vel = 0.22 if s_ % 4 == 0 else 0.15
            put('drums', hat(), step_t(t0, s_), vel * g, 0.25 if s_ % 8 else -0.2)
        # triplet roll at the end of the bar
        if style in ('half', 'full', 'drop'):
            for j in range(6):
                put('drums', hat(), step_t(t0, 12) + j * BEAT / 6, (0.10 + 0.02 * j) * g, 0.3)
        put('drums', hat(True), step_t(t0, 14), 0.12 * g, -0.3)
    # 808
    if bass:
        if style == 'drop':
            put('bass', b808(r, 0.7, drive=4.5), t0, 0.95 * g)
            put('bass', b808(r * 2, 0.22, drive=4.5), step_t(t0, 6), 0.6 * g)
            put('bass', b808(r, 0.5, glide_to=r * 1.5, glide_at=0.3, drive=4.5), step_t(t0, 10), 0.85 * g)
        else:
            put('bass', b808(r, 0.85), t0, 0.95 * g)
            put('bass', b808(r, 0.25), step_t(t0, 7), 0.7 * g)
            put('bass', b808(r, 0.55, glide_to=r * 2 ** (7 / 12), glide_at=0.35), step_t(t0, 10), 0.85 * g)
    if cow:
        notes = COW[name]
        steps = COW_STEPS if style != 'drop' else [0, 2, 3, 6, 8, 10, 11, 13, 14]
        for i, s_ in enumerate(steps):
            nn = notes[i % len(notes)]
            f = hz(nn) * 2 ** cow_oct
            put('lead', cowbell(f, drive=3.5 if style == 'drop' else 2.5), step_t(t0, s_),
                (0.30 if i == 0 else 0.24) * g, 0.12 * ((i % 3) - 1))


def snare_roll(t0, dur, g=0.5, start_div=4, end_div=32):
    t = t0
    while t < t0 + dur - 1e-6:
        x = (t - t0) / dur
        div = start_div * (end_div / start_div) ** x
        put('drums', snare(0.25), t, g * (0.35 + 0.65 * x), (x - 0.5) * 0.4)
        t += BAR / div
    return t


# ---------------------------------------------------------------- arrangement
def arrange():
    T = E
    # ---- room tone / old PC fan (0 → 20 s, returns at the very end)
    def fan(d, g_in=1.5, g_out=1.5):
        t = tt(d)
        br = np.cumsum(rng.standard_normal(len(t)))
        br = hp(br - np.mean(br), 25)
        br = lp(br, 380) / (np.std(lp(br, 380)) + 1e-9)
        hum = 0.25 * np.sin(2 * np.pi * 100 * t) + 0.12 * np.sin(2 * np.pi * 50 * t)
        blade = 0.18 * np.sin(2 * np.pi * 118 * t + 0.4 * np.sin(2 * np.pi * 0.7 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.3 * t))
        whisper = bp(noise(d), 1800, 4200) * 0.08
        s = 0.5 * br + hum + blade + whisper
        e = np.ones(len(t))
        e[:int(g_in * SR)] = np.linspace(0, 1, int(g_in * SR))
        e[-int(g_out * SR):] *= np.linspace(1, 0, int(g_out * SR))
        return s * e
    f1 = fan(T['freeze'] + 0.05, 1.2, 0.05)
    put('amb', f1, 0, 0.09)
    put('amb', fan(4.0, 0.4, 3.0), T['freeze'], 0.05)  # faint hum in the frozen silence
    put('amb', fan(5.0, 0.3, 2.5), T['cursor2_on'] - 0.5, 0.07)
    # hard-drive seeks
    for tt_ in (1.3, 2.9, 3.4, 5.2):
        put('amb', bp(noise(0.03), 900, 3500) * np.exp(-tt(0.03) / 0.006), tt_, 0.25, 0.4)

    # ---- dark ambient drone + slow electronic pulses (2 → 8)
    put('pad', supersaw([hz('F1'), hz('C2')], 14.0, a=4.0, r=2.0, fc=420), 1.5, 0.28)
    for i in range(12):
        t = T['cursor_on'] + i * BEAT
        put('pad', blip(hz('F5') if i % 4 == 0 else hz('C5'), 0.05) * 0.5, t, 0.10 if i % 2 == 0 else 0.0, 0.3)
    for i in range(3):
        put('bass', b808(hz('F1'), 1.2, drive=1.4, punch=0.3), T['cursor_on'] + i * BAR, 0.35)
    # CRT power-on: thump + static + whine
    t = tt(1.4)
    crt_on = np.sin(phase_of(55 + 40 * np.exp(-t / 0.05))) * np.exp(-t / 0.25)
    crt_on += hp(noise(1.4), 3000) * np.exp(-t / 0.12) * 0.5
    crt_on += 0.05 * np.sin(2 * np.pi * 9800 * t) * np.exp(-t / 0.9)
    put('sfx', crt_on, T['terminal_on'], 0.45)
    # typing
    for i, k in enumerate(TL['keys']):
        put('sfx', key_click(i), k, 0.32, rng.uniform(-0.2, 0.2))

    # ---- error + multiplying windows (8 → 15.5)
    for j, (f, d) in enumerate([(hz('E5'), 0.0), (hz('Bb4'), 0.13)]):
        tn = tt(0.35)
        s = (sq(phase_of(np.full(len(tn), f)), 0.25) * 0.6 + np.sin(2 * np.pi * f * 2 * tn) * 0.3) * np.exp(-tn / 0.12)
        put('sfx', lp(s, 5000), T['error'] + d, 0.35)
    put('impact', impact(1.5, 80, 40, 0.2), T['error'], 0.35)
    wins = TL['windows']
    for i, w in enumerate(wins):
        dt_ = wins[i] - wins[i - 1] if i else 1.0
        if dt_ < 0.03 and i % 3:
            continue
        f = 600 * 2 ** (min(i, 120) / 60.0)
        put('sfx', blip(f, 0.05), w, 0.16 if i < 40 else 0.11, rng.uniform(-0.7, 0.7))
    # rising tension: distorted pulses + shepard-ish riser
    span = T['freeze'] - T['error']
    put('sfx', riser(span, 200, 7000), T['error'], 0.35)
    tension = supersaw([hz('F2'), hz('Gb2')], span, voices=4, a=span * 0.8, r=0.02, fc=900)
    put('pad', tension, T['error'], 0.22)
    t = T['error']
    i = 0
    while t < T['freeze'] - 0.05:
        x = (t - T['error']) / span
        put('bass', b808(hz('F1'), 0.18, drive=3.5), t, 0.5 + 0.3 * x)
        t += BEAT * (1.0 - 0.75 * x)
        i += 1

    # ---- freeze & dialog (15.5 → 18): almost silence
    t = tt(1.8)
    ding = (np.sin(2 * np.pi * hz('F3') * t) + 0.4 * np.sin(2 * np.pi * hz('F4') * 1.002 * t)) * np.exp(-t / 0.6)
    put('sfx', ding, T['dialog'], 0.35)
    put('sfx', heartbeat(), T['dialog'] + 0.8, 0.6)
    put('impact', reverse_swell(1.0), T['impact'] - 1.0, 0.55)

    # ---- IMPACT + skull (18 → 28)
    put('impact', impact(4.5, 70, 26, 0.6), T['impact'], 1.0)
    put('sfx', glass(2.6), T['impact'] + 0.01, 0.55)
    place_kick(T['impact'], 1.0, drive=3.0)
    put('pad', choir([hz('F3'), hz('C4'), hz('Ab3')], 6.0, 'o', a=2.0, r=2.0), T['impact'] + 0.3, 0.40)
    put('pad', supersaw([hz('F2'), hz('C3')], 6.2, a=2.5, r=1.0, fc=700), T['impact'], 0.20)
    for i in range(3):
        put('bass', b808(hz('F1'), 1.6, drive=2.0, punch=0.4), T['impact'] + i * BAR, 0.55)
    # eyes ignite: electric zap + rising tone
    put('sfx', crackle(0.8, 200), T['eyes'], 0.45)
    t = tt(1.2)
    put('sfx', np.sin(phase_of(200 + 900 * (1 - np.exp(-t / 0.15)))) * np.exp(-t / 0.4) * 0.5, T['eyes'], 0.3)
    # skull servo turn
    t = tt(4.0)
    servo = saw(phase_of(68 + 6 * np.sin(2 * np.pi * 0.8 * t)))
    servo = bp(servo, 120, 900) * np.sin(np.pi * t / 4.0) ** 2
    put('sfx', servo, 20.0, 0.12)
    # digital smoke hiss
    t = tt(3.5)
    put('sfx', bp(noise(3.5), 900, 5000) * np.sin(np.pi * t / 3.5) ** 2 * 0.5, T['smoke'], 0.25, 0.1)

    # ---- TITLE (24 → 28): music gains volume and power
    put('impact', impact(4.0, 66, 30, 0.9), T['title'], 1.0)
    put('lead', supersaw([hz('F2'), hz('C3'), hz('F3'), hz('Ab3')], 1.6, voices=5, a=0.005, r=1.4, fc=2600), T['title'], 0.45)
    put('pad', choir([hz('F3'), hz('Ab3'), hz('C4'), hz('F4')], 3.8, 'a', a=0.3, r=2.5), T['title'], 0.55)
    put('sfx', crackle(4.0, 90, 0.5), T['title'], 0.30, -0.2)
    put('impact', impact(2.0, 90, 40, 0.5), T['subtitle'], 0.45)
    for b in range(2):
        t0 = T['title'] + b * BAR
        place_kick(t0, 1.0)
        put('drums', snare(0.8, bright=2.0), t0 + 2 * BEAT, 0.75)
        put('drums', clap(), t0 + 2 * BEAT, 0.6)
        put('bass', b808(hz('F1') if b == 0 else hz('Db2'), 1.6, drive=3.0), t0, 0.9)
    # ---- dive into the eye (28 → 32)
    put('sfx', riser(4.0, 250, 11000), T['dive'], 0.55)
    put('sfx', whoosh(2.2, 300, 5000), T['tunnel'] - 0.4, 0.5)
    place_kick(T['dive'], 0.9)
    put('bass', b808(hz('Bb1'), 1.6, drive=3.0), T['dive'], 0.8)
    place_kick(T['tunnel'], 0.9)
    put('bass', b808(hz('C2'), 1.6, drive=3.0), T['tunnel'], 0.8)
    snare_roll(T['tunnel'], 2.0, 0.45, 8, 32)
    put('pad', supersaw([hz('C3'), hz('E3'), hz('G3')], 4.0, a=3.0, r=0.1, fc=1500), T['dive'], 0.2)

    # ---- CITY + CHAT (32 → 54): phonk groove
    put('impact', impact(3.0, 70, 32, 0.4), T['city'], 0.8)
    for b in range(11):
        t0 = T['city'] + b * BAR
        style = 'half'
        g = 1.0
        if T['tg_approach'] <= t0 < T['ph1']:
            g = 0.75
        beat_bar(t0, style, g, cow=(t0 >= T['bill1']))
        name, padn, root = chord_at(t0)
        put('pad', supersaw([hz(x) for x in padn], BAR * 0.98, voices=5, a=0.05, r=0.4, fc=1400), t0, 0.16)
    for k in ('bill1', 'bill2', 'bill3', 'bill4'):
        put('sfx', whoosh(1.0, 500, 4500), E[k] + 1.2, 0.30, 0.3)
        put('impact', impact(1.4, 80, 40, 0.3), E[k], 0.25)
    for k in ('ph1', 'ph2', 'ph3', 'ph4', 'ph5'):
        put('impact', impact(2.0, 75, 32, 0.5), E[k], 0.5)
        put('bass', b808(hz('F1') / 2 ** 0, 0.4, drive=4.0), E[k], 0.3)
    put('sfx', riser(2.0, 400, 6000, tone=False), T['tg_approach'], 0.35)

    # ---- NETWORK (54 → 68)
    put('sfx', whoosh(1.6, 200, 6000), T['network'] - 0.6, 0.5)
    put('impact', impact(3.0, 60, 30, 0.3), T['network'], 0.6)
    ARP = {'F': ['F4', 'Ab4', 'C5', 'F5'], 'Db': ['Db4', 'F4', 'Ab4', 'Db5'], 'Bbm': ['Bb3', 'Db4', 'F4', 'Bb4'], 'C': ['C4', 'E4', 'G4', 'C5']}
    for b in range(7):
        t0 = T['network'] + b * BAR
        style = 'light' if t0 < T['count62'] else 'half'
        beat_bar(t0, style, 0.9, cow=(t0 >= T['count21']), cow_oct=0)
        name, padn, root = chord_at(t0)
        put('pad', choir([hz(x) for x in padn], BAR, 'o', a=0.3, r=0.6), t0, 0.22)
        for s_ in range(16):
            nn = ARP[name][[0, 1, 2, 3, 2, 1][s_ % 6] if s_ % 6 < 6 else 0]
            put('lead', pluck(hz(nn) * (2 if s_ % 8 >= 4 else 1)), step_t(t0, s_), 0.10, 0.4 * np.sin(s_))
    put('impact', impact(2.5, 70, 30, 0.8), T['count62'], 0.7)
    put('impact', impact(2.5, 80, 35, 0.8), T['count21'], 0.7)
    put('sfx', riser(4.0, 300, 10000), T['names_tunnel'], 0.45)
    snare_roll(66.0, 2.0, 0.45, 8, 32)

    # ---- KAPUSTKA (68 → 78)
    put('impact', impact(5.0, 60, 25, 1.0), T['kapustka'], 1.0)
    for i, nn in enumerate(['F4', 'C5', 'Ab4']):
        put('lead', bell(hz(nn), 5.0), T['kapustka'] + i * 0.0, 0.25, (i - 1) * 0.4)
    put('pad', choir([hz('F3'), hz('C4'), hz('F4'), hz('Ab4')], 9.0, 'a', a=0.6, r=2.5), T['kapustka'], 0.45)
    put('sfx', crackle(5.0, 160, 0.6), T['crown'], 0.35, 0.2)
    put('impact', impact(2.0, 90, 40, 1.0), T['k_title'], 0.5)
    for b in range(5):
        t0 = T['kapustka'] + b * BAR
        beat_bar(t0, 'half', 1.0, cow=b >= 1, cow_oct=0)
        if b % 2 == 0:
            put('lead', bell(hz(['F5', 'Db5', 'C5'][b // 2 % 3]), 3.0), t0, 0.15, 0.3)
    put('sfx', whoosh(2.0, 150, 7000), T['wave'] - 0.3, 0.5)
    put('impact', impact(2.0, 85, 40, 1.2), T['screens'], 0.55)

    # ---- MONTAGE Q/A (78 → 86)
    for b in range(3):
        t0 = T['montage'] + b * BAR
        beat_bar(t0, 'full', 1.0, cow=True, cow_oct=0)
    for q, a_ in (('q1', 'a1'), ('q2', 'a2'), ('q3', 'a3')):
        put('sfx', whoosh(0.7, 800, 5000), E[q] - 0.1, 0.25, -0.3)
        put('impact', impact(1.6, 90, 40, 0.7), E[a_], 0.65)
        put('bass', b808(hz('F1'), 0.6, drive=4.0), E[a_], 0.6)
        for j in range(4):  # stutter
            put('lead', cowbell(hz('F6') * (1 if j % 2 == 0 else 1.189), 0.12), E[a_] + j * BEAT / 4, 0.18)
    # 84 → 86: "be yourself?" — the beat drains away through a closing filter
    t0 = E['q4']
    tmp_start = len(KICKS)
    seg = np.zeros((2, int(2 * BAR * SR)))
    save = {k: BUS[k].copy() for k in ('drums', 'bass', 'lead')}
    beat_bar(t0, 'full', 1.0, cow=True)
    beat_bar(t0 + BAR, 'half', 0.9, cow=False, hats=True)
    i0, i1 = int(t0 * SR), int((t0 + 2 * BAR) * SR)
    fc = 9000 * (250 / 9000) ** np.linspace(0, 1, i1 - i0)
    for k in ('drums', 'bass', 'lead'):
        diff = BUS[k][:, i0:i1] - save[k][:, i0:i1]
        for ch in range(2):
            diff[ch] = sweep(diff[ch], fc, 'low', 2, 256)
        BUS[k][:, i0:i1] = save[k][:, i0:i1] + diff
    put('pad', choir([hz('C4'), hz('E4'), hz('G4')], 2.0, 'u', a=0.5, r=0.05), t0, 0.35)
    put('sfx', riser(2.0, 200, 9000), t0, 0.45)
    snare_roll(t0 + BAR, BAR, 0.35, 8, 32)

    # ---- BLACK (86 → 88): silence, then the inhale before the drop
    put('impact', reverse_swell(0.9), T['drop'] - 0.9, 0.9)

    # ---- DROP (88 → 100)
    put('impact', impact(4.0, 55, 22, 1.0), T['drop'], 1.1)
    put('sfx', glass(1.5, 120), T['drop'], 0.25)
    for b in range(6):
        t0 = T['drop'] + b * BAR
        beat_bar(t0, 'drop', 1.0, cow=True, cow_oct=0)
        name, padn, root = chord_at(t0)
        put('pad', supersaw([hz(x) * 2 for x in padn], BAR, voices=6, a=0.02, r=0.3, fc=3000), t0, 0.14)
    put('impact', impact(2.0, 80, 35, 0.9), T['alive'], 0.7)
    for k in ('your1', 'your2', 'your3'):
        put('impact', impact(1.4, 95, 40, 0.8), E[k], 0.55)
    put('sfx', riser(1.5, 500, 9000, tone=False), T['night'] - 1.5, 0.3)

    # ---- NIGHT (100 → 110): deeper, slower
    put('impact', impact(5.0, 50, 24, 0.6), T['night'], 0.9)
    night_prog = [('F', ['F3', 'Ab3', 'C4'], 'F1'), ('Db', ['Db3', 'F3', 'Ab3'], 'Db2'),
                  ('Bbm', ['Bb2', 'Db3', 'F3'], 'Bb1'), ('C', ['C3', 'E3', 'G3'], 'C2'), ('F', ['F3', 'Ab3', 'C4'], 'F1')]
    for b, (name, padn, root) in enumerate(night_prog):
        t0 = T['night'] + b * BAR
        put('pad', choir([hz(x) for x in padn], BAR, 'o', a=0.5, r=0.8), t0, 0.32)
        put('pad', supersaw([hz(x) for x in padn], BAR, voices=5, a=0.4, r=0.6, fc=900), t0, 0.16)
        put('bass', b808(hz(root), 1.7, drive=1.8, punch=0.4), t0, 0.8)
        put('drums', heartbeat(), t0 + 0.02, 0.6)
    melody = [('C5', 0), ('Ab4', 1.0), ('F4', 1.5), ('G4', 2.0), ('Ab4', 3.0), ('F4', 3.5), ('Db5', 4.0),
              ('C5', 5.0), ('Bb4', 6.0), ('G4', 7.0), ('E4', 7.5), ('F4', 8.0)]
    for nn, o in melody:
        put('lead', bell(hz(nn), 3.0, ratio=2.0, index=2.5), T['night'] + o, 0.16, 0.25)
    # city at night: distant hum + far sirens
    t = tt(10.0)
    city = lp(noise(10.0), 300) * 0.4 + bp(noise(10.0), 400, 1200) * 0.08
    siren = np.sin(phase_of(700 + 120 * np.sin(2 * np.pi * 0.35 * t))) * 0.04
    put('amb', lp(city + siren, 2000) * env_ar(len(t), 1.5, 2.0), T['night'], 0.35)
    put('impact', impact(3.0, 55, 28, 0.5), T['mm_night'], 0.6)
    # scratch strokes for the scratched sentence
    for i in range(23):
        st = T['scratch'] + 0.12 + i * 0.11
        d = rng.uniform(0.07, 0.12)
        t = tt(d)
        fc = 2600 + 1600 * np.sin(np.linspace(0, 3, len(t)))
        s = sweep(noise(d), np.stack([fc * 0.8, fc * 1.25], 1), 'band', 2, 64) * np.sin(np.pi * t / d)
        put('sfx', s, st, 0.35, rng.uniform(-0.4, 0.4))
    sp = np.zeros(int(1.8 * SR))
    for _ in range(180):  # dust sparkle on dissolve
        i = int((rng.uniform() ** 1.5) * (len(sp) - 2000))
        L = 1500
        tk = np.arange(L) / SR
        sp[i:i + L] += np.sin(2 * np.pi * rng.uniform(3000, 11000) * tk) * np.exp(-tk / 0.008) * rng.uniform(0.1, 0.4)
    put('sfx', sp, T['dissolve'], 0.35)
    put('sfx', whoosh(1.6, 2000, 300), T['dissolve'], 0.3)

    # ---- RISE (110 → 116): the city is a skull
    put('sfx', riser(6.0, 150, 9000), T['rise'], 0.4)
    put('pad', choir([hz('F3'), hz('C4'), hz('Ab4')], 6.0, 'a', a=4.0, r=0.3), T['rise'], 0.45)
    put('bass', b808(hz('F1'), 3.8, drive=1.6, punch=0.2), T['rise'], 0.7)
    for b in range(3):
        t0 = T['rise'] + b * BAR
        if t0 >= 112:
            for s_ in range(0, 16, 2):
                put('drums', hat(), step_t(t0, s_), 0.15)
        if t0 >= 114:
            place_kick(t0, 0.9)
            put('bass', b808(hz('C2'), 1.6, drive=3.0), t0, 0.8)
    put('sfx', crackle(1.0, 250), T['city_eyes'], 0.45)
    put('impact', impact(2.0, 80, 36, 0.6), T['city_eyes'], 0.45)
    snare_roll(115.0, 1.0, 0.4, 16, 32)

    # ---- FINAL LOGO (116 → 124): epic
    put('impact', impact(5.0, 58, 24, 1.2), T['logo'], 1.1)
    put('pad', choir([hz('F3'), hz('C4'), hz('F4'), hz('Ab4'), hz('C5')], 7.5, 'a', a=0.2, r=3.0), T['logo'], 0.5)
    put('lead', supersaw([hz('F2'), hz('C3'), hz('F3'), hz('Ab3')], 2.0, voices=5, a=0.005, r=2.0, fc=2400), T['logo'], 0.35)
    for i, nn in enumerate(['F4', 'C5', 'Ab4']):
        put('lead', bell(hz(nn), 5.0), T['logo'], 0.2, (i - 1) * 0.5)
    for b in range(3):
        t0 = T['logo'] + b * BAR
        beat_bar(t0, 'half', 0.95, cow=True)
    put('impact', impact(2.0, 90, 40, 0.8), T['welcome'], 0.5)
    put('lead', bell(hz('F5'), 4.0), T['welcome'], 0.18)
    put('pad', supersaw([hz('F2'), hz('C3'), hz('Ab3')], 6.0, a=0.5, r=3.0, fc=700), T['join_ui'], 0.22)
    put('bass', b808(hz('F1'), 3.0, drive=1.5, punch=0.3), T['join_ui'], 0.6)

    # ---- JOIN → exe → one of us → CRT off
    t = tt(0.12)
    click = bp(noise(0.12), 1500, 7000) * np.exp(-t / 0.01) + 0.6 * np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.02)
    put('sfx', click, T['join_click'], 0.45)
    put('sfx', blip(hz('C6'), 0.12), T['join_click'] + 0.05, 0.25)
    put('sfx', crackle(0.35, 300, 0.8), T['exe'] - 0.05, 0.45)
    put('impact', impact(1.5, 100, 45, 0.6), T['exe'], 0.4)
    for j, nn in enumerate(['F5', 'C6', 'Ab5', 'F6']):  # original start-up chime
        put('sfx', bell(hz(nn), 1.5, ratio=2.0, index=1.2), T['exe'] + 0.1 + j * 0.12, 0.10, (j - 1.5) * 0.3)
    put('impact', impact(6.0, 48, 22, 0.7), T['one_of_us'], 1.0)
    put('pad', choir([hz('F2'), hz('C3'), hz('F3'), hz('Ab3')], 3.0, 'o', a=0.4, r=2.0), T['one_of_us'], 0.4)
    put('bass', b808(hz('F1'), 2.5, drive=1.6, punch=0.5), T['one_of_us'], 0.8)
    t = tt(0.7)
    off = np.sin(phase_of(3800 * np.exp(-t / 0.05) + 60)) * np.exp(-t / 0.12) * 0.6
    off += np.sin(phase_of(70 + 30 * np.exp(-t / 0.02))) * np.exp(-t / 0.15)
    off += hp(noise(0.7), 2500) * np.exp(-t / 0.25) * 0.4
    put('sfx', off, T['crt_off'], 0.55)
    # final cursor blinks: tiny ticks
    for i in range(4):
        put('sfx', blip(hz('C7'), 0.02), T['cursor2_on'] + i * BEAT, 0.035)


def voice():
    """'WELCOME TO MEMENTO MORI' — espeak-ng rendered, then turned into a distorted machine voice
    (vocoder on an F-minor saw chord + pitched-down dry + bitcrush + delay)."""
    tmp = os.path.join(HERE, '_voice_raw.wav')
    subprocess.run(['espeak-ng', '-v', 'en-us', '-s', '118', '-p', '25', '-a', '180', '-w', tmp,
                    'Welcome to Memento Mori'], check=True)
    with wave.open(tmp) as w:
        sr0 = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    os.remove(tmp)
    nz = np.nonzero(np.abs(x) > 0.02)[0]
    x = x[max(0, nz[0] - 200): nz[-1] + 400]
    # slow & lower (tape-style): 0.84
    x = ss.resample_poly(x, int(SR / 0.84 / 10), sr0 // 10)
    x = x / (np.max(np.abs(x)) + 1e-9)
    n = len(x)
    t = np.arange(n) / SR
    # channel vocoder
    carrier = sum(saw(phase_of(np.full(n, hz(nn)))) for nn in ('F2', 'C3', 'F3', 'Ab3')) / 4
    carrier += 0.3 * rng.standard_normal(n)
    edges = np.geomspace(120, 7000, 19)
    voc = np.zeros(n)
    for lo, hi in zip(edges[:-1], edges[1:]):
        envm = lp(np.abs(bp(x, lo, hi)), 40)
        voc += bp(carrier, lo, hi) * envm
    voc = voc / (np.max(np.abs(voc)) + 1e-9)
    ring = x * (0.6 + 0.4 * np.sin(2 * np.pi * 47 * t))
    v = 0.7 * voc + 0.45 * ring
    v = np.round(v * 24) / 24  # bitcrush
    v = lp(hp(v, 120), 6500)
    v = sat(v * 1.4, 1.5)
    out = np.zeros(n + int(1.2 * SR))
    out[:n] += v
    for k, g in ((0.18, 0.35), (0.36, 0.18), (0.54, 0.08)):
        i = int(k * SR)
        out[i:i + n] += g * lp(v, 3000)
    return out, n / SR


def reverb_ir(dur=2.8, damp=5000, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for ch in range(2):
        x = r.standard_normal(n) * np.exp(-t / (dur / 6.9))
        x = 0.6 * lp(x, damp) + 0.4 * lp(x, damp / 4)
        x[:int(0.02 * SR)] = 0
        ir[ch] = x
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def conv(x, ir):
    return np.vstack([ss.fftconvolve(x[c], ir[c])[:x.shape[1]] for c in range(2)])


def sidechain(depth=0.55, tau=0.16):
    g = np.ones(N)
    for k in KICKS:
        i0 = int(k * SR)
        L = min(int(0.6 * SR), N - i0)
        if L <= 0:
            continue
        tk = np.arange(L) / SR
        att = np.clip(tk / 0.004, 0, 1)
        g[i0:i0 + L] = np.minimum(g[i0:i0 + L], 1 - depth * att * np.exp(-tk / tau))
    return g


def stutter(x, t0, dur, slice_len):
    i0, L = int(t0 * SR), int(slice_len * SR)
    sl = x[:, i0:i0 + L].copy()
    fade = np.ones(L)
    fade[-64:] = np.linspace(1, 0, 64)
    for k in range(int(dur / slice_len)):
        j = i0 + k * L
        x[:, j:j + L] = sl * fade
    return x


def tape_stop(x, t0, dur):
    i0, L = int(t0 * SR), int(dur * SR)
    seg = x[:, i0:i0 + L].copy()
    rate = np.linspace(1, 0, L) ** 1.3
    pos = np.cumsum(rate)
    for c in range(2):
        x[c, i0:i0 + L] = np.interp(pos, np.arange(L), seg[c]) * np.linspace(1, 0.2, L)
    return x


def limiter(x, ceiling=0.89, look=0.004, release=0.12):
    L = int(look * SR)
    peak = maximum_filter1d(np.max(np.abs(x), 0), size=2 * L + 1)
    g = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    g = minimum_filter1d(g, size=2 * L + 1)
    a = np.exp(-1 / (release * SR))
    # smooth: instant attack (already looked-ahead), exponential release
    gs = ss.lfilter([1 - a], [1, -a], g - 1) + 1
    gs = np.minimum(gs, g)
    return x * gs


def main():
    arrange()
    vox, vdur = voice()
    put('voice', vox, E['voice'], 0.95)
    put('voice', lp(vox, 600) * 0.6, E['voice'] - 0.0, 0.5)  # weight/body

    sc = sidechain()
    music = {}
    music['pad'] = BUS['pad'] * sc * 0.9
    music['bass'] = BUS['bass'] * (0.4 + 0.6 * sc)
    music['lead'] = BUS['lead'] * (0.5 + 0.5 * sc)
    music['drums'] = BUS['drums']
    mbus = music['pad'] + music['bass'] + music['lead'] * 0.9 + music['drums']
    # duck music under the voice
    vi0, vi1 = int(E['voice'] * SR), int((E['voice'] + vdur + 0.4) * SR)
    duck = np.ones(N)
    duck[vi0:vi1] = 0.55
    duck = lp(duck, 6)
    mbus *= duck
    # section dynamics: leave headroom so the drop and the finale hit harder
    keys = [(0, 1.0), (31.8, 1.0), (32.2, .8), (67.8, .8), (68.2, .92), (87.8, .92), (88.0, 1.0), (99.8, 1.0), (100.2, .9), (115.8, .9), (116.0, 1.0)]
    tt_ = np.arange(N) / SR
    mbus *= np.interp(tt_, [k[0] for k in keys], [k[1] for k in keys])
    # "резкий переход": tape-stop + stutter right before phrase 2; stutters in the drop
    mbus = tape_stop(mbus, E['ph2'] - 0.25, 0.25)
    mbus = stutter(mbus, 95.5, 0.5, BEAT / 4)
    mbus = stutter(mbus, 91.75, 0.25, BEAT / 8)
    # silence the black pause (86 → 88) except tails of the reverse swell
    i0, i1 = int(E['black'] * SR), int(E['drop'] * SR)
    fade = np.ones(N)
    fade[i0:i1] = 0.0
    fade[i0 - 240:i0] = np.linspace(1, 0, 240)
    mbus *= fade
    # freeze (15.5 → 18): hard cut of everything musical
    j0, j1 = int(E['freeze'] * SR), int(E['impact'] * SR)
    fz = np.ones(N)
    fz[j0:j1] = 0.0
    fz[j0 - 120:j0] = np.linspace(1, 0, 120)
    mbus *= fz
    sfx = BUS['sfx'].copy()
    sfx[:, j0:int(E['dialog'] * SR) - 10] *= 0.0

    ir_big = reverb_ir(3.2, 4500, 1)
    ir_small = reverb_ir(1.2, 7000, 2)
    wet = conv(BUS['pad'] * 0.35 + BUS['lead'] * 0.35 + BUS['drums'] * 0.12 + BUS['voice'] * 0.45 + BUS['impact'] * 0.3, ir_big) * 0.30
    wet2 = conv(sfx * 0.3 + BUS['drums'] * 0.15, ir_small) * 0.25
    wet[:, j0:j1] *= 0.15  # keep the freeze almost silent
    mix = mbus + sfx * 0.9 + BUS['amb'] + BUS['voice'] * 1.0 + BUS['impact'] * 0.85 + wet + wet2
    mix = hp(mix, 22)
    # gentle glue + limiter
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 1.35
    mix = 0.75 * mix + 0.25 * np.tanh(mix)
    mix = limiter(mix, 0.89)
    # final fade-out tail
    e_end = int((E['cursor2_off'] + 1.0) * SR)
    mix[:, e_end:] *= np.linspace(1, 0, N - e_end) ** 2 if N > e_end else 1
    mix = mix[:, :int(DURATION * SR)]
    pcm = np.clip(mix.T, -1, 1)
    pcm = (pcm * 32767).astype(np.int16)
    out = os.path.join(HERE, 'mix.wav')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', out, mix.shape[1] / SR, 's; peak', np.max(np.abs(mix)), 'voice dur', round(vdur, 2))
    json.dump({'kicks': sorted(KICKS), 'voice_dur': vdur}, open(os.path.join(HERE, 'audio_meta.json'), 'w'))


if __name__ == '__main__':
    main()
