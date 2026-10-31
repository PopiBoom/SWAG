# SWAG_ZOV_NEFOR.exe — мемный трейлер Telegram-группы

120 секунд, 1920×1080, 60 fps, HTML + CSS + JavaScript (DOM, CSS 3D, Canvas 2D). Без голоса: юмор передаётся
картинкой, надписями, музыкой и звуковыми эффектами. Раскадровка — `STORYBOARD.md`, журнал проверки — `REVIEW.md`.

## Запуск превью

```bash
node tools/serve.mjs 8140        # затем открыть http://localhost:8140/  (пробел — пауза, ?t=42 — перейти к 42 с)
```

Время плеера берётся из звуковой дорожки, поэтому картинка идёт синхронно со звуком.

## Экспорт MP4

```bash
node tools/serve.mjs 8140 &
node tools/cues.mjs > build/cues.json                                   # карта звуковых событий (из сцен)
python3 tools/audio.py build/cues.json assets/audio/voxel_revolution_kevin_macleod.mp3 assets/audio/soundtrack.wav
tools/render_all.sh                                                     # 7200 кадров × 2 субкадра (motion blur), 4 потока
node tools/mux.mjs build/picture.mkv assets/audio/soundtrack.wav export/SWAG_ZOV_NEFOR_1920x1080_60fps.mp4
node tools/verify.mjs export/SWAG_ZOV_NEFOR_1920x1080_60fps.mp4 build/check.jpg
```

Рендер детерминирован: состояние каждого кадра вычисляется только из времени `t` (`window.renderAt(t)`).

## Аватарки, ники-символы и логотип группы

К заданию не были приложены скриншоты Telegram, поэтому сейчас у всех 61 участника стоят аватарки-заглушки
в стиле Telegram (градиент + инициалы), а группа — без логотипа. Ники взяты точно из текста брифа.
Чтобы подставить оригиналы, положите файлы и пересоберите манифест:

| Файл | Что это |
|---|---|
| `assets/avatars/<id>.jpg` | аватарка участника; `id` — из списка `MEMBERS` в `js/data.js` (например `senya.jpg`, `bunker.jpg`) |
| `assets/nicks/<id>.png` | вырезка ника из скриншота для ников только из символов: `sym_blue`, `sym_at`, `sym_dot1`, `sym_dot2`, `sym_ml` |
| `assets/logo.jpg` | логотип группы (появится в портале, в центре финальной сферы) |

```bash
node tools/manifest.mjs     # затем перерендерить (tools/render_all.sh) и свести (tools/mux.mjs)
```

Пять ников из одних символов (синий декоративный символ, «@» с декоративным знаком, два ника из точек, ник на малаялам)
в брифе описаны, но не написаны — чтобы не выдумывать их, они показаны как «расшифровывающийся» глитч до получения вырезок.
Ники «★» (синяя звезда) и «* 💀» выведены как текст.

## Источники и лицензии

| Ресурс | Источник | Условия |
|---|---|---|
| Музыка «Voxel Revolution» — Kevin MacLeod | incompetech.com | Creative Commons Attribution 4.0 — нужна атрибуция: *"Voxel Revolution" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/* — укажите её в описании видео |
| Все звуковые эффекты, интро-дрон | синтезированы с нуля в `tools/audio.py` | оригинальная работа, без сэмплов и без голоса |
| Шрифты Unbounded, Russo One, JetBrains Mono, Inter, Press Start 2P, Noto Sans KR (подмножество «에바»), Noto Sans Malayalam | Google Fonts | SIL Open Font License |
| Эмодзи | Noto Color Emoji (системный шрифт) | SIL Open Font License |
| Интерфейсы (окна в стиле старой ОС, пузыри Telegram, иконка-самолётик, карта «REVERSE») | нарисованы в CSS/SVG | оригинальная работа, без чужих логотипов и ассетов |

Все статистические показатели, кроме «62 участника» и «21 в сети», — шуточные.
