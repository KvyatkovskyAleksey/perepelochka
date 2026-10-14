// Встроенные демо-мелодии: народные и public domain, выписаны вручную в ABC.
// Каждая прогоняется тестом: парсинг, конвертация в строй, раскладка на карточки.

export interface DemoMelody {
  title: string;
  emoji: string;
  abc: string;
}

export const DEMOS: DemoMelody[] = [
  {
    title: "Звёздочка",
    emoji: "⭐",
    abc: "X:1\nT:Звёздочка\nM:4/4\nL:1/4\nK:C\n| c c g g | a a g2 | f f e e | d d c2 |\n| g g f f | e e d2 | g g f f | e e d2 |\n| c c g g | a a g2 | f f e e | d d c2 |]\n",
  },
  {
    title: "Ода к радости",
    emoji: "🎼",
    abc: "X:1\nT:Ода к радости\nM:4/4\nL:1/8\nK:C\n| e2 e2 f2 g2 | g2 f2 e2 d2 | c2 c2 d2 e2 | e2 d2 d4 |\n| e2 e2 f2 g2 | g2 f2 e2 d2 | c2 c2 d2 e2 | d2 c2 c4 |]\n",
  },
  {
    title: "Коробейники (Тетрис)",
    emoji: "🎮",
    // выверено по партитуре статьи en.wikipedia.org/wiki/Korobeiniki
    // (разбор её MIDI: пунктирный ритм, соль-диез, ля минор)
    abc: "X:1\nT:Коробейники\nM:4/4\nL:1/8\nK:Am\n| E3 ^G B2 ^G E | A3 c e2 d c | B3 c d2 e2 | c2 A2 A4 |\n| f3 g a2 g f | e3 f e2 d c | B3 c d2 e2 | c2 A2 A4 |]\n",
  },
  {
    title: "Ёлочка (Jingle Bells)",
    emoji: "🎄",
    abc: "X:1\nT:Ёлочка\nM:4/4\nL:1/8\nK:C\n| e2 e2 e4 | e2 e2 e4 | e2 g2 c2 d2 | e8 |\n| f2 f2 f4 | f2 e2 e4 | e2 d2 d2 e2 | d4 g4 |\n| e2 e2 e4 | e2 e2 e4 | e2 g2 c2 d2 | e8 |\n| f2 f2 f4 | f2 e2 e2 e2 | g2 g2 f2 d2 | c8 |]\n",
  },
  {
    title: "Мэри и ягнёнок",
    emoji: "🐑",
    abc: "X:1\nT:Мэри и ягнёнок\nM:4/4\nL:1/8\nK:C\n| e2 d2 c2 d2 | e2 e2 e4 | d2 d2 d4 | e2 g2 g4 |\n| e2 d2 c2 d2 | e2 e2 e4 | e2 d2 d2 e2 | d4 c4 |]\n",
  },
  {
    title: "Лондонский мост",
    emoji: "🌉",
    abc: "X:1\nT:Лондонский мост\nM:4/4\nL:1/8\nK:C\n| c2 d2 c2 B2 | A2 B2 c4 | G2 A2 B4 | A2 B2 c4 |\n| c2 d2 c2 B2 | A2 B2 c4 | G4 c4 | A4 F4 |]\n",
  },
  {
    title: "Во поле берёза",
    emoji: "🌳",
    // русская народная; ABC по разбору Викитеки «Справка:Ноты» (6/4, ля минор)
    abc: "X:1\nT:Во поле берёза\nM:6/4\nL:1/8\nK:Am\neeee d2 cc B2 A2 | eege ddcc B2 A2 | B3c d2 cc B2A2 | BBBc ddcc B2A2:|]\n",
  },
];
