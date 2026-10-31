"""Single source of truth for timing. Writes src/timeline.json for the visuals
and is imported by compose.py for the soundtrack. 120 BPM: beat = 0.5 s, bar = 2 s."""
import json, math, os

BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
DURATION = 135.0

E = {
    # intro
    "cursor_on": 2.0, "terminal_on": 4.0,
    "type1": 4.6, "type1_dt": 0.12, "type2": 6.25, "type2_dt": 0.055,
    "error": 8.0, "freeze": 15.5, "dialog": 16.0,
    # skull
    "impact": 18.0, "eyes": 21.0, "smoke": 22.5, "title": 24.0, "subtitle": 25.0,
    "voice": 26.0, "dive": 28.0, "tunnel": 30.0,
    # city
    "city": 32.0, "bill1": 34.0, "bill2": 36.0, "bill3": 38.0, "bill4": 40.0,
    "tg_approach": 42.0, "ph1": 44.0, "ph2": 46.0, "ph3": 48.0, "ph4": 50.0, "ph5": 52.0,
    # network
    "network": 54.0, "count62": 58.0, "count21": 62.0, "names_tunnel": 64.0,
    # kapustka
    "kapustka": 68.0, "throne": 69.0, "crown": 71.0, "k_title": 71.0, "k_sub": 72.0,
    "wave": 75.0, "screens": 76.0,
    # montage
    "montage": 78.0, "q1": 78.0, "a1": 79.0, "q2": 80.0, "a2": 81.0, "q3": 82.0, "a3": 83.0,
    "q4": 84.0, "black": 86.0, "black_text": 86.35,
    # drop
    "drop": 88.0, "alive": 92.0, "your1": 96.0, "your2": 97.0, "your3": 98.0,
    # night
    "night": 100.0, "mm_night": 102.0, "scratch": 106.0, "dissolve": 110.0,
    "rise": 110.0, "city_eyes": 113.5, "skull_match": 114.0,
    # final
    "logo": 116.0, "logo_by": 116.6, "logo_group": 117.2, "welcome": 118.5,
    "join_ui": 122.0, "join_click": 123.75, "exe": 124.0, "exe_t1": 124.5, "exe_dt": 0.035,
    "one_of_us": 128.0, "crt_off": 131.0, "cursor2_on": 131.6, "cursor2_off": 133.6,
    "end": DURATION,
}

TYPE1 = "WORLD.exe"
TYPE2 = "CONNECTING TO REALITY…"
EXE_LINES = ["STATUS: ONLINE", "OWNER: KAPUSTKA", "WELCOME TO THE UNDERGROUND"]


def window_times():
    """Exponentially accelerating window spawns between error and freeze."""
    A, k = 1.8, 0.6
    span = E["freeze"] - E["error"]
    n = int(A * (math.exp(k * span) - 1))
    ts = [E["error"] + 0.02]
    for i in range(1, n):
        ts.append(E["error"] + math.log(i / A + 1) / k)
    return [round(x, 4) for x in ts if x < E["freeze"]]


def typing_times():
    out = []
    for i, _ in enumerate(TYPE1):
        out.append(round(E["type1"] + i * E["type1_dt"], 4))
    for i, ch in enumerate(TYPE2):
        out.append(round(E["type2"] + i * E["type2_dt"], 4))
    # exe window lines (typed in sequence with a small gap between lines)
    t = E["exe_t1"]
    for line in EXE_LINES:
        for ch in line:
            if ch != " ":
                out.append(round(t, 4))
            t += E["exe_dt"]
        t += 0.35
    return out


def exe_line_starts():
    t = E["exe_t1"]
    res = []
    for line in EXE_LINES:
        res.append(round(t, 4))
        t += len(line) * E["exe_dt"] + 0.35
    return res


def data():
    return {
        "bpm": BPM, "duration": DURATION, "events": E,
        "type1": TYPE1, "type2": TYPE2, "exeLines": EXE_LINES,
        "exeLineStarts": exe_line_starts(),
        "windows": window_times(), "keys": typing_times(),
    }


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "src", "timeline.json")
    with open(out, "w") as f:
        json.dump(data(), f, ensure_ascii=False, indent=1)
    d = data()
    print("windows:", len(d["windows"]), "keys:", len(d["keys"]), "->", os.path.abspath(out))
