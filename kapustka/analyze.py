import librosa, numpy as np, json, sys
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
bt = librosa.frames_to_time(beats, sr=sr)
onset = librosa.onset.onset_strength(y=y, sr=sr)
on = librosa.onset.onset_detect(onset_envelope=onset, sr=sr, units='time')
rms = librosa.feature.rms(y=y)[0]
t = librosa.times_like(rms, sr=sr)
# per-second loudness
sec = [float(rms[(t>=i)&(t<i+1)].mean()) for i in range(int(t[-1]))]
mx=max(sec)
print("tempo", tempo, "beats", len(bt), "onsets", len(on))
print("loudness per 4s:", [round(np.mean(sec[i:i+4])/mx,2) for i in range(0,len(sec),4)])
# low band (kick) energy
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
f = librosa.fft_frequencies(sr=sr)
low = S[f<150].mean(0); mid=S[(f>=150)&(f<2000)].mean(0); hi=S[f>=2000].mean(0)
n=lambda a:(a/np.percentile(a,99)).clip(0,1)
json.dump({"tempo":float(np.atleast_1d(tempo)[0]),"beats":bt.tolist(),"onsets":on.tolist(),
 "fps_hop":sr/512,"low":n(low).round(3).tolist(),"mid":n(mid).round(3).tolist(),"hi":n(hi).round(3).tolist(),
 "rms":(rms/rms.max()).round(3).tolist()}, open("feat.json","w"))
