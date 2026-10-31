// Единый таймлайн (секунды ролика). Используется и рендером, и сведением звука (tools/audio.py через tools/dump_timeline.mjs).
export const FPS = 60;
export const BEAT = 60 / 90;            // 90 BPM трека Heart of Machine
export const DROP = 66.0;               // дроп трека (58.79 с) в ролике
export const HOM_OFFSET = DROP - 58.79; // время ролика = время трека + offset
export const SLAM = 103.0;              // вход плотной секции трека (122.95 с)
export const SLAM_OFFSET = SLAM - 122.95;
export const DURATION = 117.0;

export const SCENES = [
  { id: 1, start: 0, end: 17.5 },
  { id: 2, start: 17.5, end: 35.2 },
  { id: 3, start: 35.2, end: 50.0 },
  { id: 4, start: 50.0, end: 66.0 },
  { id: 5, start: 66.0, end: 84.667 },
  { id: 6, start: 84.667, end: DURATION },
];

const bar = (n) => DROP + n * BEAT * 4;

export const T = {
  // I
  cursor: 1.6, typeStart: 2.6, typeFast: 5.2, errors: 6.4, zoomLine: 8.6, freeze: 10.2,
  err404: 10.9, glitchStart: 12.0, title: 13.8, subtitle: 14.7,
  // II
  room: 17.5, screenOn: 21.0, msgStart: 22.4, holo: 25.5, phrase2: 27.2, phrase2End: 31.0,
  pcErrors: 31.2, diveScreen: 33.6,
  // III
  void: 35.2, statsIn: 41.9, chaos: 45.6, diag: 46.4, diveLogo: 49.0,
  // IV
  hall: 50.0,
  lines: [52.0, 53.333, 54.667, 56.0, 57.333, 58.667, 60.0],
  redLight: 61.2, allowed: 62.4, crack: 64.9,
  // V
  city: DROP, words: [bar(1), bar(2), bar(3), bar(4)], warning: bar(5), collapse: bar(5) + 1.2,
  tower: bar(6) - 0.6, blackout: bar(7),
  // VI
  monitor: 86.4, reboot: [88.0, 89.4, 90.8, 92.4], monTitle: 93.8,
  q1: 95.2, q1End: 98.4, q2: 98.9, q2End: 102.6,
  status: [104.4, 105.4, 106.6], memento: 107.6, endGlitch: 109.4, black: 110.0,
  never: 110.5, neverEnd: 111.9, credits: 112.2,
};

export const MESSAGES = [
  { name: 'Ева', text: 'Достаньте наркотики мне для подруги надо', seed: 11 },
  { name: 'Вася', text: 'Маленькие негры?', seed: 23 },
  { name: 'Сеня АйТи', text: 'Э нефоры и не нефоры', seed: 37 },
  { name: 't9ctox7c', text: 'Жирные только', seed: 41 },
  { name: 'cold#inte2(t#o)', text: 'Вы все жирные', seed: 53 },
  { name: 'Даша Вкид', text: 'Он мне изменил, сука', seed: 67 },
  { name: 'KAPUSTKA', text: 'Ненавижу вас всех', seed: 79 },
];

export const LAW_LINES = [
  ['ARGUMENTS', 'ENABLED'], ['DARK HUMOR', 'ENABLED'], ['POLITICS', 'ENABLED'],
  ['SHITPOSTING', 'ENABLED'], ['MEMES', 'ENABLED'], ['CHAOS', 'UNLIMITED'], ['RULES', 'NOT FOUND'],
];

export const CITY_WORDS = ['СРАЧИ', 'МЕМЫ', 'ПОЛИТИКА', 'АБСУРД'];

// Реальные участники чата (ники и плашки со скриншотов списка участников).
export const MEMBERS = [
  ['kapustka [Бледный]', 'SwagZovNefor'], ['BunkerRP', 'админ'], ['cold#inte2(t#o)', 'Нашенская'], ['Сеня айТи', 'Неформалище'],
  ['Даша вкид', 'КОТЕНОК ^_^'], ['ева', 'Добрыня.)'], ['Вася Флеш', ''], ['#LXVECVLT t9ctox7c', 'Репа, ой рэпер'],
  ['Антон Дуброн', 'Любитель б*рдака'], ['Death', 'Big SnoopDogg'], ["sckal'pel'", 'Люблю капустку'], ['сглыпа)', 'Пидор'],
  ['пользователь прил...', 'Муж нашенской'], ['puato4ka', 'Пятка гашиша'], ['birds of Hiroshima', 'Оппенгеймер'], ['Ведьма', 'Феминистка'],
  ['True Mafia', 'Пидорас #2'], ['ДОБРЫНЯ.)', ''], ['Даня Круглый', 'Застройщик'], ['Celestiana', 'Пидораска'],
  ['Ян Брагин', 'Уникальный преф*'], ['Sharpilov', 'Близкий'], ['kevin', 'Пиздюк'], ['heckuн', 'Маляр травы'],
  ['Арина (свэг шмот)', 'Селебрити'], ['gera//stik', ''], ['Grab↑88', ''], ['Weakxxx', ''], ['Бусенок', ''], ['rusa', ''],
  ['Санёк', ''], ['no name', ''], ['junior', ''], ['timofey', ''], ['Satoshi', ''], ['Даня', ''], ['Mqkk', ''], ['кристина', ''],
  ['Lobanoff', ''], ['сашка янг', ''], ['ksuha', ''], ['ПлохойАрни', ''], ['Богдан Головин', ''], ['хик. | @hikaa', ''],
  ['дема', ''], ['Мила', ''], ['ксюня', ''], ['ямимару', ''], ['vladик', ''], ['Priem • Chermeta [Добби]', ''], ['Nesmotri • Nazad', ''],
];
