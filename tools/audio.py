"""Сведение саундтрека SWAG_ZOV_NEFOR.exe по общему таймлайну (src/timeline.js).
Запуск: python3 -I tools/audio.py  →  out/soundtrack.wav
Музыка и сэмплы — из assets/ (CC0 / CC-BY, см. CREDITS.md); остальное синтезируется здесь."""
import json, os, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TL = json.loads(subprocess.run(['node', os.path.join(ROOT, 'tools/dump_timeline.mjs')], capture_output=True, text=True, check=True).stdout)
T = TL['T']; DUR = TL['DURATION']; BEAT = TL['BEAT']; DROP = TL['DROP']; SLAM = TL['SLAM']
rng = np.random.default_rng(7)
N = int(DUR * SR) + SR

music = np.zeros((N, 2), np.float32)
sfx = np.zeros((N, 2), np.float32)
send = np.zeros((N, 2), np.float32)  # шина реверберации

A = lambda *p: os.path.join(ROOT, 'assets', *p)
PS = lambda n: A('sfx/src/packsmithy-sfx-sampler/packsmithy-sfx-sampler', n + '.wav')
KEYS = [A('sfx/src/unicae_games_keyboard_soundpack_1_0/Single Keys', f'keypress-{i:03d}.wav') for i in range(1, 33)]
GLASS = [A('sfx/src/sfx_breaking_and_falling', f'bfh1_glass_breaking_0{i}.ogg') for i in range(1, 7)]

_cache = {}
def load(path, start=0.0, dur=None):
    key = (path, start, dur)
    if key in _cache: return _cache[key]
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start)] + (['-t', str(dur)] if dur else []) + ['-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
    x = np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).copy()
    _cache[key] = x
    return x

def place(bus, sig, t, gain=1.0, pan=0.0, rev=0.0):
    if sig.ndim == 1: sig = np.stack([sig, sig], 1)
    i = int(round(t * SR))
    if i >= len(bus): return
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), len(bus) - i)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    s = sig[:n] * gain * np.array([l, r], np.float32) * 1.4142
    bus[i:i + n] += s
    if rev > 0: send[i:i + n] += s * rev

def env(n, a=0.005, r=0.1):
    e = np.ones(n, np.float32)
    na, nr = min(n // 2, int(a * SR)), min(n // 2, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e

def lp(x, f, o=4): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x, axis=0).astype(np.float32)
def hp(x, f, o=4): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x, axis=0).astype(np.float32)
def bp(x, f1, f2, o=4): return sosfilt(butter(o, [f1, f2], 'band', fs=SR, output='sos'), x, axis=0).astype(np.float32)
def tt(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR)).astype(np.float32)

# ---------- синтез ----------
def sub_boom(d=2.5, f0=70, f1=32):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * 6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 1.6) * np.minimum(1, t * 400)).astype(np.float32)

def impact(d=1.6):
    t = tt(d)
    body = sub_boom(d, 120, 38)
    crack = hp(noise(d), 1500) * np.exp(-t * 30) * 0.5
    mid = bp(noise(d), 200, 900) * np.exp(-t * 9) * 0.6
    return np.tanh((body + crack + mid) * 1.5) * 0.8

def whoosh(d=1.2, up=True):
    t = tt(d); n = noise(d)
    out = np.zeros_like(n); seg = int(0.02 * SR)
    for i in range(0, len(n), seg):
        u = i / len(n); f = 300 + (u if up else 1 - u) ** 2 * 6000
        out[i:i + seg] = bp(n[max(0, i - 2048):i + seg], max(80, f * 0.5), min(20000, f * 1.5), 2)[-len(n[i:i + seg]):]
    e = (t / d) ** 2.2 if up else np.exp(-t * 3)
    return (out * e * 0.9).astype(np.float32)

def riser(d=2.0):
    t = tt(d); f = 80 * (1 + 7 * (t / d) ** 2)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    return (lp(saw, 3000) * 0.35 * (t / d) ** 2 + whoosh(d) * 0.8).astype(np.float32)

def hum(d, f=50, amp=1.0):
    t = tt(d)
    s = sum(np.sin(2 * np.pi * f * k * t + k) / k ** 1.3 for k in range(1, 9))
    crackle = hp(noise(d), 3000) * (rng.random(len(t)) > 0.9995) * 3
    return ((s * 0.25 + lp(noise(d), 200) * 0.15 + crackle) * amp).astype(np.float32)

def fans(d):
    n = noise(d)
    return (lp(n, 900) * 0.25 + bp(n, 2000, 4000) * 0.03 + np.sin(2 * np.pi * 120 * tt(d)) * 0.02).astype(np.float32)

def beep(f=1000, d=0.12, wave='sq'):
    t = tt(d); ph = 2 * np.pi * f * t
    s = np.sign(np.sin(ph)) * 0.5 if wave == 'sq' else np.sin(ph)
    return (lp(s, 6000) * env(len(t), 0.002, 0.02)).astype(np.float32)

def err_chord(base=330):
    # оригинальная «ошибка»: два диссонирующих тона и щелчок
    d = 0.35; t = tt(d)
    s = (np.sin(2 * np.pi * base * t) + 0.7 * np.sin(2 * np.pi * base * 1.414 * t) + 0.3 * np.sign(np.sin(2 * np.pi * base * 0.5 * t)))
    return (s * np.exp(-t * 7) * 0.35).astype(np.float32)

def modem(d=1.4):
    t = tt(d); out = np.zeros(len(t), np.float32)
    seg = lambda a, b: slice(int(a * SR), int(b * SR))
    out[seg(0, 0.18)] = np.sin(2 * np.pi * 2100 * t[seg(0, 0.18)]) * 0.5
    out[seg(0.22, 0.42)] = (np.sin(2 * np.pi * 1300 * t[seg(0.22, 0.42)]) + np.sin(2 * np.pi * 2100 * t[seg(0.22, 0.42)])) * 0.3
    sl = seg(0.45, d); k = t[sl] - 0.45
    out[sl] = (np.sign(np.sin(2 * np.pi * (1200 + 1200 * (np.sin(k * 90) > 0)) * k)) * 0.15 + bp(noise(d - 0.45), 600, 3500, 2)[:len(k)] * 0.5) * (0.6 + 0.4 * np.sin(k * 37))
    return lp(out, 7000) * env(len(t), 0.01, 0.05)

def siren(d, f1=650, f2=900, rate=2.2):
    t = tt(d); f = np.where(np.sin(2 * np.pi * rate * t) > 0, f2, f1)
    s = 2 * ((np.cumsum(f) / SR) % 1) - 1
    return (lp(s, 3500) * 0.22 * env(len(t), 0.02, 0.1)).astype(np.float32)

def stutter(x, grain=0.04, reps=8):
    g = x[:int(grain * SR)]
    return np.concatenate([g * (1 - i / reps) for i in range(reps)])

def crush(x, bits=5, down=8):
    y = np.repeat(x[::down], down, axis=0)[:len(x)]
    q = 2 ** bits
    return (np.round(y * q) / q).astype(np.float32)

def tape_stop(x, d=0.5):
    n = int(d * SR); seg = x[-n:] if len(x) >= n else x
    pos = np.cumsum(np.linspace(1, 0, n) ** 1.5); pos = pos / pos[-1] * (n * 0.45)
    idx = np.clip(pos.astype(int), 0, len(seg) - 1)
    return seg[idx] * np.linspace(1, 0, n)[:, None] ** 0.5

def glints(d=1.5, seed=0):
    r = np.random.default_rng(seed); out = np.zeros(int(d * SR), np.float32)
    for _ in range(14):
        t0 = r.random() * (d - 0.3); f = r.choice([880, 1320, 1760, 2640, 1980])
        s = np.sin(2 * np.pi * f * tt(0.3)) * np.exp(-tt(0.3) * 12) * 0.2
        i = int(t0 * SR); out[i:i + len(s)] += s
    return out

def zap(d=0.25, seed=0):
    r = np.random.default_rng(seed); t = tt(d)
    s = hp(r.standard_normal(len(t)).astype(np.float32), 1800) * (r.random(len(t)) > 0.6) * np.exp(-t * 14)
    return (s + np.sign(np.sin(2 * np.pi * 70 * t)) * 0.2 * np.exp(-t * 20)).astype(np.float32)

def key(i, g=1.0): return load(KEYS[i % 32])[:, 0] * g

# ---------- МУЗЫКА ----------
amb = load(A('audio/src/dark_ambient13.wav'))
def put_amb(t0, t1, gain, fi=1.5, fo=1.5, src_off=0.0):
    n = int((t1 - t0) * SR); s = amb[int(src_off * SR):int(src_off * SR) + n]
    if len(s) < n: s = np.concatenate([s, amb[:n - len(s)]])
    e = env(len(s), fi, fo)[:, None]
    place(music, s * e, t0, gain)

put_amb(0.0, 17.6, 2.2, fi=2.5, fo=0.3)
put_amb(T['reboot'][3], 103.0, 1.7, fi=3.0, fo=0.05, src_off=40)
put_amb(110.4, DUR, 1.4, fi=1.0, fo=2.5, src_off=70)

off = TL['HOM_OFFSET']
hom_start_v = T['title'] - 0.05
hom = load(A('audio/src/heart_of_machine.ogg'), hom_start_v - off, T['blackout'] - hom_start_v)
e = np.ones(len(hom), np.float32); fi = int(1.2 * SR); e[:fi] = np.linspace(0, 1, fi) ** 2
hom = hom * e[:, None]
ts = tape_stop(hom, 0.45); hom[-len(ts):] = ts
place(music, hom, hom_start_v, 1.0)
# финальный повторный вход трека (82.85 с) точно в SLAM
so = TL['SLAM_OFFSET']
RE = 122.95   # вход самой плотной секции трека; три доли-«отсчёта» до него
PRE = 2.05
fin = load(A('audio/src/heart_of_machine.ogg'), RE - PRE, T['endGlitch'] - (SLAM - PRE) + 0.1)
fin = fin * env(len(fin), 0.25, 0.01)[:, None]
place(music, fin, SLAM - PRE, 1.3)
# конечный глитч: заикание последней доли
stut = stutter(load(A('audio/src/heart_of_machine.ogg'), RE + (T['endGlitch'] - SLAM) - 0.1, 0.2), 0.06, 10)
place(music, crush(stut, 6, 4), T['endGlitch'], 1.0)

# ---------- СЦЕНА I ----------
place(sfx, hum(12.0, 50, 0.5) * env(int(12 * SR), 1.2, 0.01), 0.2, 0.55)   # электрический гул
place(sfx, stutter(hum(0.2, 50, 0.6), 0.03, 22) * 0.8, T['freeze'], 0.6)   # зависание
for k in range(3): place(sfx, beep(2600, 0.008, 'sine'), T['cursor'] + k * 0.45, 0.15)
# набор кода: ускоряющиеся нажатия
t = T['typeStart']; i = 0
while t < 8.0:
    u = (t - T['typeStart']) / (8.0 - T['typeStart'])
    place(sfx, key(i, 0.5 + 0.4 * rng.random()), t, 0.55, pan=rng.uniform(-0.3, 0.3))
    t += max(0.022, 0.11 * (1 - u) ** 1.4 + rng.uniform(-0.01, 0.01)); i += 1
fast = load(A('sfx/src/unicae_games_keyboard_soundpack_1_0/Generated Typing/generated-006_faster.wav'), 0, 3.0)
place(sfx, fast * np.linspace(0, 1, len(fast))[:, None] ** 2, 5.0, 0.6)
for k in range(30):  # строка запуска — медленно и тяжело
    place(sfx, key(k * 5, 0.9), 8.05 + k / 34, 0.8, rev=0.05)
for k, t0 in enumerate([6.4, 6.75, 7.05, 7.3, 7.52, 7.72, 7.9]):
    place(sfx, err_chord(300 + 40 * k) if k % 2 else load(PS('mobile-app-ui-error')), t0, 0.5, pan=[-0.5, 0.4, -0.2, 0.6, -0.6, 0.3, 0.0][k], rev=0.15)
place(sfx, riser(1.6), 8.6, 0.6)
place(sfx, whoosh(1.0), 9.2, 0.5)
place(sfx, load(PS('scifi-ui-alarm')), T['err404'], 0.7, rev=0.3)
place(sfx, err_chord(220), T['err404'], 0.8, rev=0.3)
place(sfx, impact(1.4), T['err404'], 0.6)
place(sfx, load(PS('glitch-transitions-data-scramble')), T['glitchStart'], 0.8)
place(sfx, load(PS('glitch-transitions-digital-tear')), T['glitchStart'] + 0.5, 0.7)
st = load(A('sfx/src/static1.wav'), 10, 2.0)
place(sfx, st * np.linspace(0, 1, len(st))[:, None] ** 2, T['glitchStart'] - 0.2, 0.35)
for k in range(10): place(sfx, crush(noise(0.05) * 0.4, 4, 12), 12.2 + k * 0.15 + rng.random() * 0.05, 0.5, pan=rng.uniform(-0.7, 0.7))
place(sfx, riser(1.6), T['title'] - 1.6, 0.6)
place(sfx, load(PS('cinematic-trailer-hits-braam')), T['title'], 1.0, rev=0.35)
place(sfx, sub_boom(3.0), T['title'], 1.0)
place(sfx, impact(2.0), T['title'], 0.7, rev=0.2)
for k in range(8): place(sfx, beep(1800 + k * 140, 0.025, 'sine'), T['subtitle'] + k * 0.1, 0.12, pan=-0.4 + k * 0.1)
place(sfx, load(A('sfx/src/static1.wav'), 30, 1.0) * np.linspace(0, 1, SR)[:, None] ** 2, 16.6, 0.5)

# ---------- СЦЕНА II ----------
place(sfx, load(A('sfx/src/static1.wav'), 31, 1.0) * np.linspace(1, 0, SR)[:, None], 17.5, 0.4)
place(sfx, fans(17.8) * env(int(17.8 * SR), 1.0, 0.3), 17.5, 0.45)
place(sfx, hum(17.8, 60, 0.25) * env(int(17.8 * SR), 1.0, 0.3), 17.5, 0.3)
place(sfx, load(A('sfx/src/crackleelectricityloop.wav')), 19.0, 0.35)
place(sfx, sub_boom(0.4, 90, 50) * 0.6 + hp(noise(0.4), 6000) * np.exp(-tt(0.4) * 10) * 0.1, T['screenOn'], 0.6)
place(sfx, modem(1.35), T['screenOn'] + 0.1, 0.35, rev=0.1)
for k in range(4): place(sfx, load(PS('retro-ui-click')), 21.7 + k * 0.22, 0.4)
notif = load(PS('mobile-app-ui-notification'))
for k, t0 in enumerate([22.6, 23.25, 23.9, 24.55, 25.2, 25.85, 26.5]): place(sfx, notif, t0, 0.35, pan=0.2 * ((k % 3) - 1), rev=0.1)
place(sfx, glints(1.8, 1), 26.6, 0.8, rev=0.4)
place(sfx, glints(1.5, 2), 27.4, 0.6, rev=0.4, pan=0.3)
for k in range(6): place(sfx, err_chord(260 + 37 * k) if k % 2 else load(PS('mobile-app-ui-error')), T['pcErrors'] + k * 0.25, 0.45, pan=rng.uniform(-0.6, 0.6), rev=0.2)
place(sfx, load(A('sfx/src/chargestart.wav'), 0, 2.0), T['pcErrors'], 0.3)
place(sfx, zap(0.3, 3), T['pcErrors'] + 0.4, 0.5)
place(sfx, siren(2.0, 900, 1200, 6), T['pcErrors'] + 0.6, 0.12)
place(sfx, riser(1.6), T['diveScreen'], 0.7)
place(sfx, impact(1.2), T['void'], 0.6, rev=0.3)

# ---------- СЦЕНА III ----------
place(sfx, whoosh(1.4, False), T['void'], 0.7, rev=0.4)
for k in range(24): place(sfx, beep(rng.choice([660, 990, 1320, 1760]), 0.03, 'sine'), 35.8 + k * 0.1 + rng.random() * 0.05, 0.08, pan=rng.uniform(-0.8, 0.8), rev=0.5)
for k in range(30): place(sfx, load(PS('retro-ui-click')), T['statsIn'] + k * 0.035, 0.25)
place(sfx, load(PS('scifi-ui-alarm')), T['statsIn'] + 1.3, 0.5, rev=0.2)
place(sfx, load(PS('glitch-transitions-glitch-hit')), T['chaos'], 0.8)
for k in range(8): place(sfx, crush(noise(0.08) * 0.5, 3, 16), T['chaos'] + 0.2 + k * 0.22 + rng.random() * 0.08, 0.45, pan=rng.uniform(-0.8, 0.8))
for t0 in [46.4, 47.3, 48.2]:
    place(sfx, impact(1.0), t0, 0.75, rev=0.25)
    place(sfx, load(PS('glitch-transitions-glitch-hit')), t0, 0.5)
place(sfx, riser(1.0), 49.0, 0.7)
place(sfx, load(PS('cinematic-trailer-hits-boom-hit')), T['hall'], 0.8, rev=0.4)

# ---------- СЦЕНА IV ----------
place(sfx, fans(16.0) * env(int(16 * SR), 0.5, 0.2), 50.0, 0.35)
place(sfx, hum(16.0, 45, 0.3) * env(int(16 * SR), 0.5, 0.2), 50.0, 0.35)
for k, t0 in enumerate(T['lines']):
    last = k == 6
    place(sfx, key(k * 3, 1.0), t0 - 0.06, 0.8)
    if last:
        place(sfx, err_chord(180), t0 + 0.05, 0.9, rev=0.3); place(sfx, load(PS('mobile-app-ui-error')), t0 + 0.05, 0.6)
    else:
        place(sfx, load(PS('scifi-ui-confirm')) if k % 2 == 0 else beep(880 * 2 ** (k / 12), 0.09), t0 + 0.05, 0.45, pan=(k - 3) * 0.1, rev=0.2)
place(sfx, impact(2.0), T['redLight'], 0.9, rev=0.4)
place(sfx, load(PS('scifi-ui-alarm')), T['redLight'], 0.7, rev=0.3)
place(sfx, siren(DROP - T['redLight'] - 0.05), T['redLight'] + 0.1, 0.35, rev=0.15)
place(sfx, sub_boom(3.0, 55, 28), T['allowed'], 1.1)
place(sfx, load(PS('cinematic-trailer-hits-braam')), T['allowed'], 0.7, rev=0.4)
for k in range(5): place(sfx, load(GLASS[1]) * 0.6, T['crack'] + k * 0.2, 0.3 + k * 0.08, pan=rng.uniform(-0.5, 0.5))
place(sfx, riser(DROP - T['crack']), T['crack'], 0.8)
for k in range(4): place(sfx, load(GLASS[k % 6 if k != 1 else 4]), DROP + k * 0.03, 0.8, pan=[-0.6, 0.6, -0.2, 0.3][k], rev=0.3)
place(sfx, load(PS('cinematic-trailer-hits-finale-hit')), DROP, 0.6, rev=0.3)
place(sfx, sub_boom(2.0), DROP, 0.9)

# ---------- СЦЕНА V ----------
cam_moves = [67.4, 69.6, 72.2, 74.8, 77.4]
for k, t0 in enumerate(cam_moves): place(sfx, whoosh(1.1), t0 - 0.9, 0.45, pan=[-0.5, 0.5, -0.4, 0.4, 0][k])
for k, t0 in enumerate(T['words']):
    place(sfx, load(PS('glitch-transitions-glitch-hit')), t0, 0.7)
    place(sfx, impact(1.2), t0, 0.5, rev=0.3)
r2 = np.random.default_rng(5)
t0 = 67.0
while t0 < T['collapse']:
    place(sfx, zap(0.2 + r2.random() * 0.2, int(t0 * 100)), t0, 0.22 + r2.random() * 0.2, pan=r2.uniform(-0.8, 0.8), rev=0.2)
    t0 += 0.25 + r2.random() * 0.5
place(sfx, load(PS('scifi-ui-alarm')), T['warning'], 0.8, rev=0.3)
place(sfx, siren(T['collapse'] - T['warning'] + 0.6, 500, 760, 3), T['warning'], 0.35)
place(sfx, err_chord(160), T['warning'], 0.9)
dis = crush(noise(T['blackout'] - T['collapse']) * np.linspace(0.1, 0.6, int((T['blackout'] - T['collapse']) * SR)), 3, 24)
place(sfx, hp(dis, 400), T['collapse'], 0.35)
for k in range(16): place(sfx, crush(noise(0.06), 4, 8) * 0.5, T['collapse'] + k * 0.24 + r2.random() * 0.1, 0.3, pan=r2.uniform(-0.9, 0.9))
place(sfx, riser(2.5), T['blackout'] - 2.5, 0.5)

# ---------- СЦЕНА VI ----------
pc = fans(DUR - T['blackout']) * 0.6 + hum(DUR - T['blackout'], 50, 0.15)
pc = pc * env(len(pc), 0.4, 0.05)
cut = int((SLAM - T['blackout']) * SR)
place(sfx, pc[:cut], T['blackout'] + 0.15, 0.45)
for k in range(9): place(sfx, hp(noise(0.03), 2500) * np.exp(-tt(0.03) * 80), 85.4 + k * 0.33 + rng.random() * 0.2, 0.35, pan=0.3)  # головки HDD
place(sfx, sub_boom(0.5, 90, 45) * 0.8 + hp(noise(0.5), 5000) * np.exp(-tt(0.5) * 8) * 0.15, T['monitor'], 0.6)
place(sfx, np.sin(2 * np.pi * 7800 * tt(6.0)) * env(int(6 * SR), 0.3, 2.0) * 0.015, T['monitor'], 1.0)
place(sfx, beep(1000, 0.18, 'sq'), T['reboot'][0], 0.25)  # POST-бип
for k, t0 in enumerate(T['reboot']):
    for j in range(5): place(sfx, key(k * 7 + j, 0.7), t0 + j * 0.05, 0.4)
place(sfx, modem(0.9), T['reboot'][2] + 0.4, 0.25)
place(sfx, sub_boom(2.5, 60, 30), T['reboot'][3], 0.7)
place(sfx, glints(1.2, 9), T['reboot'][3], 0.6, rev=0.5)
place(sfx, load(PS('glitch-transitions-data-scramble')), T['monTitle'], 0.5)
for k in range(3): place(sfx, sub_boom(1.2, 55, 30), T['q1'] + k * 1.6, 0.35)
for k in range(3): place(sfx, sub_boom(1.0, 55, 30), T['q2'] + k * 0.8, 0.4)
place(sfx, riser(2.2), SLAM - 2.2, 0.9)
place(sfx, load(PS('cinematic-trailer-hits-braam')), SLAM, 1.0, rev=0.4)
place(sfx, sub_boom(3.0, 70, 30), SLAM, 1.1)
place(sfx, impact(2.0), SLAM, 0.8, rev=0.3)
for t0 in T['status']: place(sfx, load(PS('glitch-transitions-glitch-hit')), t0, 0.55); place(sfx, key(int(t0), 1.0), t0, 0.5)
place(sfx, load(PS('glitch-transitions-digital-tear')), T['endGlitch'], 0.9)
place(sfx, load(A('sfx/src/static1.wav'), 50, 0.6) * env(int(0.6 * SR), 0.05, 0.02)[:, None], T['endGlitch'], 0.5)
place(sfx, sub_boom(3.5, 50, 25), T['black'], 1.0)
place(sfx, impact(1.5), T['black'], 0.6, rev=0.6)
for k in range(31): place(sfx, key(k, 0.6), T['never'] + k / 40, 0.35)

# ---------- реверберация и мастер ----------
ir_t = tt(2.8); ir = rng.standard_normal((len(ir_t), 2)).astype(np.float32) * np.exp(-ir_t * 2.4)[:, None]
ir = lp(ir, 6000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], 1).astype(np.float32)
mix = music * 0.85 + sfx * 0.9 + wet * 0.6
# мягкий лимитер
peak_target = 0.89
g = peak_target / max(1e-6, np.percentile(np.abs(mix), 99.95))
mix = np.tanh(mix * g * 1.1)
mix = mix / np.abs(mix).max() * 0.93
mix = mix[:int(DUR * SR)]
out = os.path.join(ROOT, 'out'); os.makedirs(out, exist_ok=True)
import wave
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(os.path.join(out, 'soundtrack.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', mix.shape, 'peak', float(np.abs(mix).max()), 'rms dB', 20 * np.log10(np.sqrt((mix ** 2).mean())))
