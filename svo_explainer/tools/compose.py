"""Офлайн-синтез саундтрека: музыка (ре минор, 80 BPM), звуковой дизайн, голос и сведение.
python3 tools/compose.py  ->  audio/soundtrack.wav (+ stems в audio/stems/)
Все события привязаны к тому же таймлайну, что и видео (js/*.js).
"""
import json, os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; DUR = 75.0; N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(2026)
t_all = np.arange(N) / SR

def bus(): return np.zeros((2, N))
def put(b, x, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); x = np.asarray(x)
    if x.ndim == 1: x = np.vstack([x * np.sqrt((1 - pan) / 2) * 1.414, x * np.sqrt((1 + pan) / 2) * 1.414]) * .7071
    n = min(x.shape[1], N - i)
    if n > 0 and i >= 0: b[:, i:i + n] += x[:, :n] * gain
def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos'); return sosfilt(sos, x, axis=-1)
def env(n, a, r, sus=None):
    e = np.ones(n); A = max(1, int(a * SR)); R = max(1, int(r * SR))
    e[:A] = np.linspace(0, 1, A) ** 2
    if R < n: e[-R:] *= np.linspace(1, 0, R) ** 2
    return e
def adsr_exp(n, a, dec):
    tt = np.arange(n) / SR; e = np.exp(-tt / dec); A = max(1, int(a * SR)); e[:A] *= np.linspace(0, 1, A); return e
def note(m): return 440.0 * 2 ** ((m - 69) / 12)
def reverb(x, sec=3.0, damp=4000, mix=.35, seed=1):
    r = np.random.default_rng(seed); n = int(sec * SR); tt = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-tt * 6.9 / sec); ir = filt(ir, 'low', damp); ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    wet = np.vstack([fftconvolve(x[0], ir[0])[:N], fftconvolve(x[1], ir[1])[:N]])
    return x * (1 - mix) + wet * mix * 3

# ------------------------------------------------------------------ гармония по сценам
# (начало, конец, аккорд midi, интенсивность электроники 0..1)
CH = [(0, 8, [38, 50, 53, 57], 0.0), (8, 16, [34, 50, 53, 58], .45), (16, 24, [31, 50, 55, 58], .8), (24, 32, [34, 50, 53, 58], .9),
      (32, 40, [29, 48, 53, 57], .7), (40, 48, [36, 48, 52, 55], .85), (48, 56, [34, 50, 53, 57, 60], 0.0), (56, 64, [31, 50, 55, 58], .8),
      (64, 70, [38, 50, 53, 57, 64], .6), (70, 75, [38, 50, 52, 57], 0.0)]
def chord_at(tt):
    for a, b, c, k in CH:
        if a <= tt < b: return c, k
    return CH[-1][2], 0

music = bus(); pad = bus(); pulse = bus(); ticks = bus(); sub = bus(); piano = bus()
# пэд: детюн-пилы аддитивно, кроссфейд аккордов 1.2 с
for si, (a, b, c, k) in enumerate(CH):
    a2 = max(0, a - .6); b2 = min(DUR, b + .6); n = int((b2 - a2) * SR); tt = np.arange(n) / SR
    e = env(n, 1.2 if a > 0 else 2.5, 1.2)
    sig = np.zeros((2, n))
    for m in c:
        f0 = note(m + 12 if m < 40 else m)
        for d, pan in [(-.08, -.6), (.07, .6), (0, 0)]:
            f = f0 * 2 ** (d / 12)
            ph = rng.uniform(0, 6.28)
            s = sum(np.sin(2 * np.pi * f * h * tt + ph * h) / h ** 1.6 for h in range(1, 7))
            sig[0] += s * (1 - pan) * .5; sig[1] += s * (1 + pan) * .5
    lfo = .75 + .25 * np.sin(2 * np.pi * tt / 5.3 + si)
    cut = 1400 if k > 0 else 900
    sig = filt(sig, 'low', cut) * e * lfo
    if si == 6: sig *= 1.15
    put(pad, sig, a2, .11)
# саб-бас: корень, пульс на долях в активных сценах
beat = 60 / 80
for a, b, c, k in CH:
    f = note(c[0] if c[0] >= 36 else c[0] + 12)
    n = int((b - a) * SR); tt = np.arange(n) / SR
    base = np.sin(2 * np.pi * f * tt) * .55 + np.sin(2 * np.pi * f * 2 * tt) * .12
    if k > 0:
        ph = ((tt + a) % beat) / beat; pump = .35 + .65 * (1 - np.exp(-ph * 6))
        hits = np.exp(-((tt + a) % beat) * 9) * k
        base = base * (pump * .6 + hits * .8)
    else: base = base * .55
    put(sub, base * env(n, .4, .5), a, .28)
# пульсирующее арпеджио (FM-плак), 1/8, только в цифровых сценах
pat = [0, 2, 1, 3, 2, 1, 3, 2]
for a, b, c, k in CH:
    if k <= 0: continue
    step = beat / 2; tt0 = np.ceil(a / step) * step; i = 0
    while tt0 < b - .05:
        m = c[1 + pat[i % 8] % (len(c) - 1)] + 12
        f = note(m); n = int(.35 * SR); tt = np.arange(n) / SR
        mod = np.sin(2 * np.pi * f * 2 * tt) * 1.6 * np.exp(-tt * 18)
        s = np.sin(2 * np.pi * f * tt + mod) * adsr_exp(n, .004, .09)
        acc = 1.0 if i % 4 == 0 else .6
        put(pulse, s, tt0, .075 * k * acc, pan=.35 * np.sin(i * 1.3))
        tt0 += step; i += 1
# тики хай-хэта
for a, b, c, k in CH:
    if k < .5: continue
    step = beat / 2; tt0 = np.ceil(a / step) * step + step / 2
    while tt0 < b - .05:
        n = int(.05 * SR); s = filt(rng.standard_normal(n), 'high', 7000) * np.exp(-np.arange(n) / SR * 90)
        put(ticks, s, tt0, .05 * k, pan=.3); tt0 += step
# фортепианные ноты в сцене «Люди» и в финале
def piano_note(m, dur=3.5):
    f = note(m); n = int(dur * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * h * tt * (1 + .0004 * h * h)) * np.exp(-tt * (1.2 + h * .9)) / h ** 1.3 for h in range(1, 8))
    s[: int(.003 * SR)] *= np.linspace(0, 1, int(.003 * SR)); return s
for tt0, m in [(48.4, 69), (49.9, 65), (51.4, 67), (52.9, 62), (54.4, 65), (55.2, 64)]: put(piano, piano_note(m), tt0, .16, pan=-.2)
for tt0, m in [(66.0, 74), (68.1, 69), (71.0, 62), (71.0, 69), (72.35, 74)]: put(piano, piano_note(m, 4.0), tt0, .13, pan=.15)

pad = reverb(pad, 3.5, 3000, .3, 1); pulse = reverb(pulse, 2.2, 5000, .3, 2); piano = reverb(piano, 3.8, 4500, .45, 3)
music = pad + pulse + ticks + sub + piano
# финал: мягкое затухание к 75 с
fo = np.clip((75.0 - t_all) / 2.6, 0, 1) ** 1.5; music *= fo

# ------------------------------------------------------------------ звуковой дизайн
sfx = bus()
def boom(gain=1.0, f0=70, f1=32, dur=2.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 5); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 1.6) + filt(rng.standard_normal(n), 'low', 900) * np.exp(-tt * 14) * .5
    return s * gain
def riser(dur=1.6, f0=300, f1=5000):
    # непрерывно: смесь низко- и высокочастотного шума с кроссфейдом + глиссандо синуса
    n = int(dur * SR); tt = np.arange(n) / SR; u = tt / dur
    lo = filt(rng.standard_normal(n), 'band', [f0 * .7, f0 * 3]); hi = filt(rng.standard_normal(n), 'band', [f1 * .4, min(f1 * 1.6, 20000)])
    lo /= np.abs(lo).max() + 1e-9; hi /= np.abs(hi).max() + 1e-9
    f = f0 * (f1 / f0) ** u; sw = np.sin(2 * np.pi * np.cumsum(f) / SR) * .15
    return (lo * (1 - u) + hi * u + sw) * u ** 2.2 * .8
def whoosh(dur=1.2, f0=200, f1=2500, rev=False):
    s = riser(dur, f0, f1); e = np.sin(np.linspace(0, np.pi, len(s))) ** 1.5; s = s / (np.abs(s).max() + 1e-9) * e
    return s[::-1] if rev else s
def blip(f=1400, dur=.12, f2=None):
    n = int(dur * SR); tt = np.arange(n) / SR; ff = f if f2 is None else f + (f2 - f) * tt / dur
    return np.sin(2 * np.pi * np.cumsum(np.full(n, 1.0) * ff) / SR) * adsr_exp(n, .002, dur / 4)
def click(dur=.03):
    n = int(dur * SR); return filt(rng.standard_normal(n), 'band', [2500, 9000]) * np.exp(-np.arange(n) / SR * 160)
def shimmer(dur=2.0, dens=220):
    n = int(dur * SR); out = np.zeros((2, n))
    for _ in range(int(dens * dur)):
        i = rng.integers(0, n - 4000); f = rng.uniform(2500, 7000); m = int(.06 * SR); tt = np.arange(m) / SR
        g = np.sin(2 * np.pi * f * tt) * np.hanning(m) * rng.uniform(.2, 1); p = rng.uniform(-1, 1)
        out[0, i:i + m] += g * (1 - p) / 2; out[1, i:i + m] += g * (1 + p) / 2
    return out * np.sin(np.linspace(0, np.pi, n)) ** .7
# переходы
for tt0, g in [(8.0, 1.0), (16.0, .8), (32.0, .9), (40.0, .95), (64.0, 1.0)]: put(sfx, boom(g), tt0, .55)
put(sfx, boom(.5, 55, 28, 3.5), 48.0, .45); put(sfx, boom(.6, 60, 30, 3), 24.0, .35); put(sfx, boom(.7, 80, 35, 2.5), 56.0, .35)
for tt0, d in [(6.4, 1.6), (30.4, 1.6), (38.4, 1.6), (62.4, 1.6)]: put(sfx, riser(d), tt0, .10)
put(sfx, whoosh(1.4, 150, 3000), 2.7, .14, -.3); put(sfx, whoosh(.9, 200, 4000), 7.4, .16, .3); put(sfx, whoosh(1.2), 31.2, .14)
put(sfx, whoosh(1.0, 300, 5000), 39.5, .14); put(sfx, whoosh(1.6, 120, 2400, True), 63.9, .17); put(sfx, whoosh(1.0, 200, 3000), 15.6, .1)
# glitch-склейка
g = np.concatenate([click(.02) * rng.uniform(.5, 1) if k % 2 else np.zeros(int(.015 * SR)) for k in range(14)]); put(sfx, g, 15.85, .25)
put(sfx, g, 47.8, .18)
# линия-вступление: тихий тон + сигнал
n = int(2.2 * SR); tt = np.arange(n) / SR; put(sfx, np.sin(2 * np.pi * 1760 * tt) * env(n, .8, 1.2) * .25, .35, .25)
put(sfx, blip(880, .5, 1320), 1.6, .12)
# цифровые сигналы на заголовках
for tt0 in [4.3, 8.6, 16.5, 24.9, 32.6, 40.4, 56.9, 66.1]: put(sfx, blip(1320, .14), tt0, .12, .2); put(sfx, blip(1980, .1), tt0 + .09, .08, -.2)
# щелчки на блоках и чипах
for tt0 in [9.74, 12.0, 13.8]: put(sfx, blip(660, .25, 990), tt0, .13); put(sfx, click(), tt0, .3)
for tt0 in [19.0, 19.8, 21.25, 22.3, 26.78, 27.42, 28.0, 28.64, 36.89, 37.57, 38.31, 33.1, 33.5, 33.9, 34.3]: put(sfx, click(), tt0, .28, rng.uniform(-.5, .5)); put(sfx, blip(2400, .05), tt0, .05)
for tt0 in [57.27, 58.03, 58.4, 58.79, 59.53, 60.89, 66.77, 67.27, 67.81, 68.53]: put(sfx, click(), tt0, .25, rng.uniform(-.5, .5)); put(sfx, blip(1760, .07), tt0, .05)
# сеть расходится (13.6–15.6) и линия фронта прорастает
put(sfx, shimmer(2.0, 120), 13.6, .05); put(sfx, shimmer(1.4, 60), 18.0, .03)
# раскрытие моделей
for tt0 in [41.2, 43.5, 45.7]: put(sfx, whoosh(.5, 600, 6000), tt0, .08); put(sfx, blip(520, .3, 780), tt0 + .1, .07)
# частицы 55.6–57.6 и финальная сборка карты
put(sfx, shimmer(2.2, 260), 55.5, .07); put(sfx, shimmer(1.8, 200), 69.6, .06)
for tt0 in [71.0, 71.45, 71.9, 72.35]: put(sfx, boom(.35, 90, 45, 1.2), tt0, .3)
# атмосфера: космос, улица (ветер), лаборатория (гул)
def noise_bed(a, b, lo, hi, gain):
    n = int((b - a) * SR); x = filt(rng.standard_normal((2, n)), 'band', [lo, hi]) * env(n, .8, .8); put(sfx, x, a, gain)
noise_bed(32, 40, 2000, 8000, .012); noise_bed(48, 56, 150, 900, .05); noise_bed(40, 48, 60, 200, .05); noise_bed(16, 24, 200, 1200, .02)
sfx = reverb(sfx, 2.0, 6000, .2, 4)

# ------------------------------------------------------------------ голос
words = json.load(open(os.path.join(ROOT, 'audio', 'vo_words.json')))
vo = np.zeros(N)
for i, w in enumerate(words, 1):
    x, sr = sf.read(os.path.join(ROOT, 'audio', f'vo_{i:02d}.wav'), dtype='float64')
    if x.ndim > 1: x = x.mean(axis=1)
    assert sr == SR, sr
    j = int(w['start'] * SR); n = min(len(x), N - j); vo[j:j + n] += x[:n]
vo = filt(vo, 'high', 80)
vo_st = np.vstack([vo, vo]); vo_st = reverb(vo_st, .8, 5000, .06, 5)
# огибающая речи → приглушение музыки (sidechain)
e = np.abs(vo); win = int(.05 * SR); e = np.convolve(e, np.ones(win) / win, mode='same')
ev = np.clip(e / (np.percentile(e[e > 1e-4], 70) + 1e-9), 0, 1)
duck = np.zeros(N); a_att, a_rel = np.exp(-1 / (.03 * SR)), np.exp(-1 / (.45 * SR)); y = 0.0
for k in range(0, N, 32):
    v = ev[k]; y = a_att * y + (1 - a_att) * v if v > y else a_rel * y + (1 - a_rel) * v; duck[k:k + 32] = y
gduck = 1 - .5 * duck   # ≈ −6 дБ под голосом

def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
mix_m = music * gduck; mix_s = sfx * (1 - .3 * duck)
# уровни: голос главный, музыка ниже
vo_st *= 10 ** ((-17 - rms_db(vo_st[:, vo != 0] if np.any(vo) else vo_st)) / 20)
mix_m *= 10 ** ((-31 - rms_db(mix_m)) / 20)
mix_s *= 10 ** ((-33 - rms_db(mix_s)) / 20)
mix = (vo_st + mix_m + mix_s) * 10 ** (-2.2 / 20)
# мягкий лимитер
peak = np.abs(mix).max(); lim = .89
mix = np.where(np.abs(mix) > lim * .8, np.sign(mix) * (lim * .8 + (lim * .2) * np.tanh((np.abs(mix) - lim * .8) / (lim * .2))), mix)
mix[:, -int(.02 * SR):] *= np.linspace(1, 0, int(.02 * SR))
os.makedirs(os.path.join(ROOT, 'audio', 'stems'), exist_ok=True)
sf.write(os.path.join(ROOT, 'audio', 'soundtrack.wav'), mix.T, SR, subtype='PCM_24')
for name, x in [('music', mix_m), ('sfx', mix_s), ('voice', vo_st)]: sf.write(os.path.join(ROOT, 'audio', 'stems', f'{name}.wav'), x.T, SR, subtype='PCM_24')
print('peak before limiter %.2f dBFS' % (20 * np.log10(peak)), 'final peak %.2f dBFS' % (20 * np.log10(np.abs(mix).max())))
print('rms voice %.1f, music %.1f, sfx %.1f dBFS' % (rms_db(vo_st), rms_db(mix_m), rms_db(mix_s)))
