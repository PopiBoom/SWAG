# MEMENTO MORI — ЧАТ ОТ KAPUSTKA · `SWAG_ZOV_NEFOR.exe`

Вертикальный кинематографичный трейлер Telegram-сообщества: HTML / CSS / JavaScript (three.js + Canvas 2D),
собственный детерминированный таймлайн, оригинальный саундтрек.

Готовое видео:
- `out/MEMENTO_MORI_telegram.mp4`: для публикации, 1080×1920, 60 fps, ~10,4 Мбит/с, 180 МБ
- `out/MEMENTO_MORI_1080x1920_60fps.mp4`: мастер высокого качества, ~27 Мбит/с, 462 МБ
- `out/preview_v2.mp4`: лёгкое превью 360×640 / 30 fps

- 1080 × 1920 (9:16), 60 fps, H.264 High / yuv420p, AAC 320 kbps 48 kHz, 2:15
- Раскадровка и выбор вариантов по сценам: [`STORYBOARD.md`](STORYBOARD.md)

## Структура

| Путь | Что это |
|---|---|
| `index.html` | страница-плеер: шрифты, import map, холст |
| `src/main.js` | оркестратор: сцены по таймлайну, `window.renderAt(t)` |
| `src/core.js` | математика, текстуры, пост-обработка (bloom, аберрация, глитч, зерно, ЭЛТ) |
| `src/ui.js` | типографика: металл, глитч, буквенные появления, молнии, окна Y2K, интерфейс Telegram |
| `src/data.js` | 63 ника из брифа, аватарки-заглушки в стиле Telegram |
| `src/citylib.js` | цифровой город: здания-мониторы, серверные стойки, экраны, облака, сообщения |
| `src/scenes/*.js` | сцены: term → skull → tunnel → city → universe → montage → black → drop → night → skull (финал) → join → end |
| `audio/timeline.py` | единый таймлайн (пишет `src/timeline.json`) |
| `audio/compose.py` | синтез музыки и звукового дизайна → `audio/mix.wav` |
| `tools/render.mjs` | покадровый экспорт → FFmpeg → MP4 со звуком |
| `tools/frames.mjs` | рендер отдельных кадров для проверки |

## Запуск

```bash
npm install                       # three@0.169.0
python3 audio/timeline.py && python3 audio/compose.py   # нужны numpy, scipy, espeak-ng
python3 -m http.server 8123       # из корня проекта
# превью со звуком:  http://127.0.0.1:8123/index.html?play
# стоп-кадр:         http://127.0.0.1:8123/index.html?t=71.5
# экспорт (нужен playwright + chromium):
node tools/render.mjs --scale 1 --fps 60 --workers 3 --out out/MEMENTO_MORI_1080x1920_60fps.mp4
```

## Настоящие аватарки

Скриншоты группы не были приложены к заданию, поэтому аватарки — стандартные заглушки Telegram
(цвет + первая буква ника). Чтобы подставить настоящие: положите квадратные изображения в
`assets/avatars/NN.jpg`, где `NN` — двузначный номер участника по порядку из `src/data.js` (01…63),
и перерендерьте. Три позиции из брифа, описанные словами («участник с синим декоративным символом»,
«@ с декоративным символом», «ник на малаялам»), показаны без выдуманного написания: аватарка без подписи
или только «@». Сообщения в интерфейсе чата скрыты (█▒), участникам не приписаны вымышленные реплики.

## Источники и лицензии

| Ресурс | Источник | Лицензия |
|---|---|---|
| 3D-модель черепа «ScatteringSkull» (Vladimir Petkovic, © Adobe) | [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ScatteringSkull) | CC0 1.0 (проверено 30.10.2026). Материал заменён на свой: металл + код + неон |
| Шрифты Unbounded, Dela Gothic One, JetBrains Mono, Press Start 2P, Rubik Glitch, Roboto, Noto Sans KR, Russo One, Oswald | [google/fonts](https://github.com/google/fonts) | SIL OFL 1.1 / Apache 2.0 |
| Эмодзи | Noto Color Emoji (системный) | SIL OFL 1.1 |
| three.js 0.169.0 | npm | MIT |
| Музыка и звуковые эффекты | **оригинальные**, синтезированы в `audio/compose.py` | права у автора проекта |
| Голос «WELCOME TO MEMENTO MORI» | синтез espeak-ng + вокодер/обработка в `compose.py` | GPL-инструмент, результат — собственная запись |

Поиск готового dark phonk под CC0/CC-BY не дал трека с подтверждённой лицензией и прямой загрузкой
(Pixabay недоступен из среды), поэтому саундтрек написан с нуля: 120 BPM, фа минор, 808, фонк-ковбелл,
хор, колокола, индастриал-удары; все акценты привязаны к событиям изображения через общий таймлайн.
