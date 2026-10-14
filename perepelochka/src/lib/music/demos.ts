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
    abc: "X:1\nT:Коробейники\nM:4/4\nL:1/8\nK:Em\n| E2 B,2 C2 D2 | E2 C2 B,2 A,2 | B,2 C2 D2 E2 | C4 A,4 |\n| E2 B,2 C2 D2 | E2 C2 B,2 A,2 | G,2 B,2 E2 ^D2 | E8 |]\n",
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
    abc: "X:1\nT:Во поле берёза\nM:4/4\nL:1/8\nK:Am\n| E2 E2 D2 C2 | D2 E2 E4 | E2 E2 D2 C2 | D2 E2 D4 |\n| E2 E2 D2 C2 | D2 E2 E4 | E2 D2 C2 D2 | C4 A,4 |]\n",
  },
];
