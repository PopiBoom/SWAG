# MEMENTO MORI [off.KAPUSTKA] — кинематографичный трейлер Telegram-канала

60 секунд, вертикаль 9:16, HTML + CSS + JavaScript (three.js / WebGL), оригинальный звук без голоса.
Канал: **t.me/memento_mori_osn**

## Что внутри

| Путь | Что это |
|---|---|
| `index.html` | плеер трейлера: открыть через локальный сервер, нажать ▶ (пробел — пауза) |
| `css/trailer.css` | вся типографика и CSS-анимации (@keyframes; JS только перематывает их по таймлайну) |
| `js/` | движок (`engine.js`), материалы мрамора и трещин, крылья, смартфон, карточки постов, сцены `js/shots/*` |
| `assets/` | 3D-сканы статуй, текстуры, HDRI, реальные скриншоты канала, аватар, шрифты, саундтрек |
| `tools/compose.mjs` | офлайн-синтезатор саундтрека (dark phonk 120 BPM + звуковой дизайн) |
| `tools/render.mjs` | покадровый экспорт: каждый кадр `i/60` → FFmpeg (H.264) |
| `tools/mux.mjs` | сведение видео и звука + проверка параметров файла |
| `STORYBOARD.md` | раскадровка: единая нить, варианты для каждой сцены, карта синхронизации с музыкой |
| `export/` | готовые MP4 (в git не входят из-за размера) |
| `REVIEW.md` | журнал итераций и проверки готового файла |

## Запуск

```bash
node tools/serve.mjs 8130          # затем открыть http://localhost:8130/
```

Плеер синхронизирует картинку со звуком (время берётся из аудио). Параметр `?t=42` открывает нужный момент.

## Экспорт видео

```bash
node tools/serve.mjs 8130 &
node tools/compose.mjs assets/audio/soundtrack.wav
tools/render_chunks.sh export/frames 1 60     # 1080×1920, 60 fps, motion blur, куски по 10 с (возобновляемо)
node tools/mux.mjs export/frames/picture.mp4 assets/audio/soundtrack.wav export/memento_mori_1080x1920_60fps.mp4
node tools/mux.mjs export/frames/picture.mp4 assets/audio/soundtrack.wav export/memento_mori_2160x3840_60fps.mp4 --size 2160x3840 --maxrate 70M
node tools/verify.mjs export/memento_mori_1080x1920_60fps.mp4 export/check.jpg
# нативный 4K-рендер на машине с GPU: tools/render_chunks.sh export/frames4k 2 60
```

Рендер детерминирован: каждое состояние (камера, обломки, частицы, трещины, CSS-анимации, кадр аватара)
вычисляется из времени `t`, поэтому перемотка и экспорт дают одинаковую картинку.

## Источники и лицензии (проверено 29.10.2026)

| Ресурс | Источник | Условия |
|---|---|---|
| Бюст Сенеки (двойная герма «Сократ и Сенека») | Three D Scans (threedscans.com), через датасет huggingface.co/datasets/alecjacobson/threedscans | сканы публичного достояния, автор не заявляет авторских прав; упрощено до 100 тыс. треугольников, половина с Сократом удалена |
| «Portrait of a Man», мрамор, ~150 до н. э. | Three D Scans | то же |
| «Aphrodite», мрамор, II в. | Three D Scans | то же |
| «Siren», мрамор (надгробная сирена) | Three D Scans | то же |
| Мрамор Marble005 (белый), Marble016 (чёрный) | ambientCG.com | CC0 |
| HDRI graaff_reinet_groote_kerk, ferndale_studio_07 | polyhaven.com | CC0 |
| Нейтральное окружение RoomEnvironment | three.js | MIT |
| three.js r170 | threejs.org | MIT (`vendor/three/LICENSE`) |
| Шрифты Cinzel, UnifrakturMaguntia, Sofia Sans Extra Condensed, Playfair Display SC, Cormorant Garamond, IBM Plex Mono | Google Fonts | SIL Open Font License |
| Скриншоты постов, профиля, ленты и комментариев | публичные страницы t.me/memento_mori_osn и t.me/s/memento_mori_osn (тёмная тема Telegram), сняты 29.10.2026 | контент канала, текст не перерисовывался |
| Аватар канала | предоставлен владельцем | — |
| Музыка и все звуки | синтезированы с нуля в `tools/compose.mjs` | оригинальная работа, без сэмплов и без голоса |

Крылья, смартфон, пепел, дым, стальные частицы и готические арки построены процедурно.
