# SWAG_ZOV_NEFOR.exe — DIGITAL ANARCHY

Кинематографичный трейлер чата канала Memento Mori. HTML/CSS/JS + Three.js, собственный детерминированный таймлайн,
покадровый рендер в MP4 1920×1080, 60 fps, H.264 + AAC.

- **Готовое видео:** `out/SWAG_ZOV_NEFOR_digital_anarchy.mp4`
- **Превью в браузере:** `index.html` (нужен локальный сервер, напр. `python3 -m http.server`, затем открыть `http://localhost:8000/`). Время берётся из `out/soundtrack.m4a`.
- **Раскадровка:** `docs/storyboard.md` · **Авторы ресурсов:** `CREDITS.md`

## Структура
- `src/timeline.js` — все таймкоды (общие для картинки и звука)
- `src/main.js` — рендерер, MSAA, motion blur (субкадры), DOF, bloom, пост-эффекты (глитч, CA, VHS, радиальный blur)
- `src/hud.js` — типографика поверх 3D
- `src/scenes/s1…s6` — шесть сцен
- `tools/audio.py` — сведение саундтрека → `out/soundtrack.wav`
- `tools/render.cjs` — рендер сегментами по 10 с (`node tools/render.cjs 3 [from] [to]`)
- `tools/assemble.sh` — склейка + звук → финальный MP4
