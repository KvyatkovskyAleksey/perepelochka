import { melodyFromAbc } from "./abc";
import { convertMelody } from "./convert";
import { DEMOS } from "./demos";
import { PEREPELOCHKA, stringLine } from "./instrument";
import { layoutMelody } from "@/lib/sheet/layout";

describe("демо-мелодии", () => {
  it("их семь, с уникальными названиями и эмодзи", () => {
    expect(DEMOS).toHaveLength(7);
    expect(new Set(DEMOS.map((d) => d.title)).size).toBe(7);
    expect(new Set(DEMOS.map((d) => d.emoji)).size).toBe(7);
  });

  it.each(DEMOS)("«$title» конвертируется и укладывается на карточки", ({ title, abc }) => {
    const melody = melodyFromAbc(abc, { name: title });
    expect(melody.notes.length).toBeGreaterThan(8);

    const conv = convertMelody(melody, PEREPELOCHKA);
    expect(conv.melody.notes.length).toBe(melody.notes.length);

    // даже в режиме «всё на одну карточку» раскладка валидна
    const layout = layoutMelody(conv.melody, PEREPELOCHKA, { fitOneSheet: true });
    expect(layout.sheets.length).toBeGreaterThanOrEqual(1);
    for (const sheet of layout.sheets) {
      for (const note of sheet.notes) {
        const line = stringLine(PEREPELOCHKA, note.stringFromTop);
        expect(note.x).toBeLessThanOrEqual(line.x1 + 1e-9);
        expect(note.x).toBeGreaterThanOrEqual(line.x0 - 1e-9);
      }
    }
  });

  it("новые мелодии начинаются с канонических нот (сверка контура)", () => {
    // Ёлочка: e-e-e (тройной повтор ми)
    const jingle = melodyFromAbc(DEMOS.find((d) => d.title.includes("Ёлочка"))!.abc);
    expect(jingle.notes.slice(0, 3).map((n) => n.midi)).toEqual([76, 76, 76]);
    // Мэри: ми-ре-до-ре
    const mary = melodyFromAbc(DEMOS.find((d) => d.title.includes("Мэри"))!.abc);
    expect(mary.notes.slice(0, 4).map((n) => n.midi - mary.notes[0].midi)).toEqual([0, -2, -4, -2]);
    // Лондонский мост: до-ре-до-си
    const bridge = melodyFromAbc(DEMOS.find((d) => d.title.includes("мост"))!.abc);
    expect(bridge.notes.slice(0, 4).map((n) => n.midi - bridge.notes[0].midi)).toEqual([0, 2, 0, -1]);
  });
});
