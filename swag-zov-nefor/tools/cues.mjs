// Dump the SFX cue sheet (shared with the picture) to JSON: node tools/cues.mjs > build/cues.json
import { SCENE_LIST } from '../js/scenes/index.js';
import * as D from '../js/data.js';
const cues = SCENE_LIST.flatMap(s => (s.cues || []).map(([t, name, gain]) => ({ t: +t.toFixed(4), name, gain, scene: s.name }))).sort((a, b) => a.t - b.t);
const out = { DUR: D.DUR, M0: D.M0, TRACK_A: D.TRACK_A, CLIMAX: D.CLIMAX, B0: D.B0, TRACK_B: D.TRACK_B, MUSIC_END: D.MUSIC_END, BAR: D.BAR, MUTES: D.MUTES, cues };
process.stdout.write(JSON.stringify(out, null, 1));
