// Shared facts: musical grid, scene boundaries, the member roster. Used by the page and by tools/cues.mjs (audio).
export const DUR = 120, FPS = 60;
export const BPM = 123, BEAT = 60 / BPM, BAR = BEAT * 4;
export const M0 = 10.5;                  // video time of the first downbeat (music segment A)
export const b = x => M0 + x * BAR;      // video time of bar x of segment A
export const TRACK_A = 13.670;           // track time at M0 (Voxel Revolution, bar 7)
export const CLIMAX = b(42);             // music cuts to silence
export const B0 = 99.5;                  // music returns (segment B)
export const TRACK_B = 78.061;           // track bar 40 — the hardest hit
export const bb = x => B0 + x * BAR;     // bar x of segment B
export const MUSIC_END = bb(9);          // 117.06 — last hit
// comedic mutes of segment A: [from, to]
export const MUTES = [[b(10.25), b(10.75)], [b(15), b(15.5)], [b(24.5), b(24.75)]];

export const SCENES = {
  boot: [0, M0],
  logo: [M0, b(2)],
  senya: [b(2), b(4.25)],
  death: [b(4.25), b(6.5)],
  anton: [b(6.5), b(8.75)],
  admin: [b(8.75), b(13)],
  kapustka: [b(13), b(14.5)],
  dasha: [b(14.5), b(16.5)],
  danya: [b(16.5), b(18)],
  vasya: [b(18), b(19.5)],
  scalpel: [b(19.5), b(21)],
  parade: [b(21), b(33)],
  stats: [b(33), b(36.5)],
  members: [b(36.5), CLIMAX],
  climax: [CLIMAX, B0],
  finale: [B0, DUR],
};

// Members exactly as written in the brief (taken from the group's member list).
// cap — the joke caption from the brief. glitch — nick made only of symbols that is not spelled out in the brief:
// it is shown as a decoding glitch until the original screenshot crop (assets/nicks/<id>.png) is supplied.
export const MEMBERS = [
  { id: 'cold', nick: 'cold#inte2(t#o)', cap: 'подключён к хаосу' },
  { id: 'senya', nick: 'Сеня айТи' },
  { id: 'anton', nick: 'Антон Дуброн' },
  { id: 'death', nick: 'Death' },
  { id: 'eva', nick: 'ева ⭐' },
  { id: 'vladik', nick: 'владик 🇺🇸' },
  { id: 'scalpel', nick: 'sckal’pel’' },
  { id: 'sglypa', nick: 'сглыпа)' },
  { id: 'kapustka', nick: 'kapustka [Бледный]' },
  { id: 'polz', nick: 'пользователь прил…' },
  { id: 'dasha', nick: 'Даша вкид ♛' },
  { id: 'puato', nick: 'puato4ka 🌸' },
  { id: 'vasya', nick: 'Вася Флеш' },
  { id: 'lxve', nick: '#LXVECVLT t9ctox7c' },
  { id: 'gera', nick: 'gera//stik', cap: 'держит связь с реальностью' },
  { id: 'birds', nick: 'birds of Hiroshima', cap: 'музыкальное сопровождение апокалипсиса' },
  { id: 'grab', nick: 'Grab↑88', cap: 'сохраняет всё подозрительное' },
  { id: 'vedma', nick: 'Ведьма' },
  { id: 'nesmotri', nick: 'Nesmotri · Nazad[Пы…' },
  { id: 'priem', nick: 'Priem · Chermeta [Добби]', cap: 'свободный эльф чата' },
  { id: 'mafia', nick: 'True Mafia' },
  { id: 'bunker', nick: 'BunkerRP' },
  { id: 'dobrynya', nick: 'ДОБРЫНЯ.)' },
  { id: 'danyak', nick: 'Даня Круглый' },
  { id: 'ksyunya', nick: 'ксюня' },
  { id: 'yamimaru', nick: 'ямимару' },
  { id: 'sup1', nick: '¹' },
  { id: 'celestiana', nick: 'Celestiana', cap: 'связь с космосом установлена' },
  { id: 'bragin', nick: 'Ян Брагин', cap: 'редкий экземпляр' },
  { id: 'mila', nick: 'Мила', cap: 'наблюдает за происходящим' },
  { id: 'sharpilov', nick: 'Sharpilov', cap: 'уровень загадочности повышен' },
  { id: 'kevin', nick: 'kevin', cap: 'зашёл и уже пожалел' },
  { id: 'dema', nick: 'дема💔', cap: 'сердце разбито, мемы остались' },
  { id: 'hik', nick: 'хик. | @hikaa', cap: 'эксперт по неожиданным появлениям' },
  { id: 'weak', nick: 'Weakxxx', cap: 'сильнее, чем кажется' },
  { id: 'busenok', nick: 'Бусенок' },
  { id: 'rusa', nick: 'rusa' },
  { id: 'neskun', nick: 'нескuн' },
  { id: 'eba', nick: '에바 🤍' },
  { id: 'arina', nick: 'Арина (свэг шмот)', cap: 'максимальный уровень SWAG' },
  { id: 'sanek', nick: 'Санёк' },
  { id: 'noname', nick: 'no name' },
  { id: 'junior', nick: 'junior', cap: 'новичок в режиме выживания' },
  { id: 'timofey', nick: 'timofey ⭐', cap: 'звёздный статус активирован' },
  { id: 'satoshi', nick: 'Satoshi' },
  { id: 'danya', nick: 'Даня' },
  { id: 'mqkk', nick: 'Mqkk', cap: 'таинственный игрок подключился' },
  { id: 'kristina', nick: 'кристина💎♻️', cap: 'перерабатывает хаос в бриллианты' },
  { id: 'lobanoff', nick: 'Lobanoff', cap: 'легенда вернулась' },
  { id: 'a_acute', nick: 'á' },
  { id: 'sashka', nick: 'сашка янг' },
  { id: 'ksuha', nick: 'ksuha', cap: 'режим наблюдения' },
  { id: 'arni', nick: 'ПлохойАрни ⭐' },
  { id: 'bogdan', nick: 'Богдан Головин ⭐', cap: 'финальный участник команды' },
  // nicks made only of symbols (see note above)
  { id: 'sym_blue', nick: '', glitch: 'blue', hint: 'синий декоративный символ' },
  { id: 'sym_at', nick: '', glitch: 'at', hint: '«@» и декоративный знак' },
  { id: 'sym_star', nick: '★', blue: true },
  { id: 'sym_skull', nick: '* 💀' },
  { id: 'sym_dot1', nick: '', glitch: 'dots', hint: 'точки' },
  { id: 'sym_dot2', nick: '', glitch: 'dots', hint: 'точки' },
  { id: 'sym_ml', nick: '', glitch: 'ml', hint: 'малаялам' },
];
export const byId = Object.fromEntries(MEMBERS.map(m => [m.id, m]));
