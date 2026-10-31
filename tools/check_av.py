"""Objective checks of the delivered MP4: stream parameters, and audio-vs-picture sync at the key hits.
For each event: audio onset = sharpest rise of short-term energy near t; picture event = largest frame-to-frame
luminance change near t. Usage: python3 tools/check_av.py out/MEMENTO_MORI_1080x1920_60fps.mp4"""
import json, subprocess, sys
import numpy as np

f = sys.argv[1]
info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]))
for s in info['streams']:
    keys = ['codec_name', 'profile', 'width', 'height', 'pix_fmt', 'r_frame_rate', 'avg_frame_rate', 'nb_frames', 'duration', 'sample_rate', 'channels', 'bit_rate']
    print(s['codec_type'], {k: s.get(k) for k in keys if k in s})
print('format duration', info['format']['duration'], 'size MB', round(int(info['format']['size']) / 1e6, 1))

sr = 48000
pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'])
a = np.frombuffer(pcm, np.int16).astype(np.float64) / 32768
hop = sr // 1000  # 1 ms
env = np.sqrt(np.convolve(a ** 2, np.ones(5 * hop) / (5 * hop), 'same'))[::hop]
denv = np.diff(np.log(env + 1e-4))

EVENTS = {'error 8.0': 8.0, 'impact 18.0': 18.0, 'title 24.0': 24.0, 'city 32.0': 32.0, 'phrase1 44.0': 44.0,
          'KAPUSTKA 68.0': 68.0, 'answer 79.0': 79.0, 'drop 88.0': 88.0, 'night 100.0': 100.0, 'logo 116.0': 116.0,
          'exe 124.0': 124.0, 'one of us 128.0': 128.0}
fps = eval([s for s in info['streams'] if s['codec_type'] == 'video'][0]['r_frame_rate'].replace('/', '/'))
print(f"{'event':18s} {'audio onset':>12s} {'picture cut':>12s} {'Δ ms':>7s}")
for name, t in EVENTS.items():
    i0, i1 = int((t - .12) * 1000), int((t + .12) * 1000)
    ta = (i0 + int(np.argmax(denv[i0:i1]))) / 1000
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', f'{t - .25:.3f}', '-i', f, '-t', '0.5', '-vf', 'scale=54:96,format=gray', '-f', 'rawvideo', '-'])
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 96, 54).astype(float)
    d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
    k = int(np.argmax(d)) + 1
    tv = round((t - .25) * fps) / fps + k / fps
    print(f"{name:18s} {ta:12.3f} {tv:12.3f} {1000 * (tv - ta):7.1f}")
