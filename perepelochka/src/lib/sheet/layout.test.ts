import { convertMelody } from "@/lib/music/convert";
import { PEREPELOCHKA, stringIndexForMidi, stringLine, withGeometry } from "@/lib/music/instrument";
import { newMelodyId, type Melody, type MelodyNote } from "@/lib/music/types";
import { layoutMelody } from "./layout";

const TWINKLE_MIDIS = [72, 72, 79, 79, 81, 81, 79, 77, 77, 76, 76, 74, 74, 72];

function makeMelody(midis: number[], dur = 1): Melody {
  const notes: MelodyNote[] = midis.map((midi, i) => ({ midi, startBeats: i * dur, durBeats: dur }));
  return {
    version: 1,
    id: newMelodyId(),
    name: "Test",
    notes,
    meter: "4/4",
    createdAt: new Date().toISOString(),
  };
}

describe("layoutMelody", () => {
  it("короткая мелодия умещается на одной карточке", () => {
    const conv = convertMelody(makeMelody(TWINKLE_MIDIS), PEREPELOCHKA);
    const layout = layoutMelody(conv.melody, PEREPELOCHKA);
    expect(layout.sheets).toHaveLength(1);
    expect(layout.sheets[0].notes).toHaveLength(14);
  });

  it("все ноты лежат на своих струнах и не дальше конца струны", () => {
    const conv = convertMelody(makeMelody(TWINKLE_MIDIS), PEREPELOCHKA);
    const layout = layoutMelody(conv.melody, PEREPELOCHKA);
    for (const note of layout.sheets[0].notes) {
      const line = stringLine(PEREPELOCHKA, note.stringFromTop);
      expect(note.y).toBe(line.y0); // струны горизонтальны
      expect(note.x).toBeLessThanOrEqual(line.x1 - PEREPELOCHKA.geometry.rightPadMm + 1e-9);
      expect(note.x).toBeGreaterThanOrEqual(line.x0 + PEREPELOCHKA.geometry.leftPadMm - 1e-9);
      expect(stringIndexForMidi(PEREPELOCHKA, note.midi)).toBe(14 - note.stringFromTop);
    }
  });

  it("расстояние между нотами пропорционально длительности", () => {
    const conv = convertMelody(makeMelody([67, 69, 71, 72, 74], 0.5), PEREPELOCHKA);
    const layout = layoutMelody(conv.melody, PEREPELOCHKA);
    const notes = layout.sheets[0].notes;
    expect(notes[1].x - notes[0].x).toBeCloseTo(0.5 * layout.mmPerBeat, 6);
    expect(notes[4].x - notes[3].x).toBeCloseTo(0.5 * layout.mmPerBeat, 6);
    // время монотонно переводится в x
    const xs = notes.map((no) => no.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it("тактовые линии стоят через такт от первой ноты", () => {
    const conv = convertMelody(makeMelody(TWINKLE_MIDIS), PEREPELOCHKA);
    const layout = layoutMelody(conv.melody, PEREPELOCHKA);
    const notes = layout.sheets[0].notes;
    const bars = layout.sheets[0].bars;
    expect(bars.length).toBeGreaterThanOrEqual(3); // 14 четвертей = 3.5 такта
    expect(bars[0].x - notes[0].x).toBeCloseTo(4 * layout.mmPerBeat, 6);
  });

  it("длинная мелодия режется на несколько карточек, все ноты на струнах", () => {
    const long: number[] = [];
    for (let i = 0; i < 8; i++) long.push(...[67, 69, 71, 72, 74, 76, 77, 79, 79, 77, 76, 74, 72, 71, 69, 67]);
    const conv = convertMelody(makeMelody(long, 0.5), PEREPELOCHKA);
    const layout = layoutMelody(conv.melody, PEREPELOCHKA);
    expect(layout.sheets.length).toBeGreaterThan(1);
    const allPlaced = layout.sheets.flatMap((s) => s.notes);
    expect(allPlaced).toHaveLength(long.length);
    for (const note of allPlaced) {
      const line = stringLine(PEREPELOCHKA, note.stringFromTop);
      expect(note.x).toBeLessThanOrEqual(line.x1 - PEREPELOCHKA.geometry.rightPadMm + 1e-9);
    }
    // ноты по карточкам в порядке исходной мелодии
    const order = allPlaced.map((n) => n.noteIndex);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("геометрия модели влияет на раскладку: короткие струны — больше карточек", () => {
    const conv = convertMelody(makeMelody(TWINKLE_MIDIS), PEREPELOCHKA);
    const normal = layoutMelody(conv.melody, PEREPELOCHKA);
    expect(normal.sheets).toHaveLength(1);

    const tiny = withGeometry(PEREPELOCHKA, { lengthMinMm: 40, lengthMaxMm: 70 });
    const tinyLayout = layoutMelody(conv.melody, tiny);
    expect(tinyLayout.sheets.length).toBeGreaterThan(1);
    for (const sheet of tinyLayout.sheets) {
      for (const note of sheet.notes) {
        const line = stringLine(tiny, note.stringFromTop);
        expect(note.x).toBeLessThanOrEqual(line.x1 - tiny.geometry.rightPadMm + 1e-9);
      }
    }
  });

  it("шаг пользователя управляет числом карточек: меньше шаг — меньше карточек", () => {
    // длинная мелодия (64 доли), в одну карточку не влезает
    const long: number[] = [];
    for (let i = 0; i < 8; i++) long.push(...[67, 69, 71, 72, 74, 76, 77, 79, 79, 77, 76, 74, 72, 71, 69, 67]);
    const conv = convertMelody(makeMelody(long, 0.5), PEREPELOCHKA);

    const wide = layoutMelody(conv.melody, PEREPELOCHKA); // шаг по умолчанию 12 мм
    const dense = layoutMelody(conv.melody, withGeometry(PEREPELOCHKA, { mmPerBeat: 6 }));
    expect(wide.sheets.length).toBeGreaterThan(dense.sheets.length);

    // ноты идут ровно с шагом пользователя
    const denseNotes = dense.sheets[0].notes;
    expect(denseNotes[1].x - denseNotes[0].x).toBeCloseTo(0.5 * dense.mmPerBeat, 6);
    expect(dense.mmPerBeat).toBeLessThanOrEqual(6 + 1e-9);

    // все ноты по-прежнему в пределах своих струн
    for (const sheet of dense.sheets) {
      for (const note of sheet.notes) {
        const line = stringLine(PEREPELOCHKA, note.stringFromTop);
        expect(note.x).toBeLessThanOrEqual(line.x1 - PEREPELOCHKA.geometry.rightPadMm + 1e-9);
      }
    }
  });

  it("вырожденные размеры не роняют раскладку (стёртый шаг/длины)", () => {
    const conv = convertMelody(makeMelody(TWINKLE_MIDIS), PEREPELOCHKA);
    for (const patch of [
      { mmPerBeat: 0 },
      { mmPerBeat: -5 },
      { lengthMinMm: 0, lengthMaxMm: 0 },
      { lengthMaxMm: 0 },
      { lengthMinMm: 0 },
      { heightMm: 0 },
      { mmPerBeat: 0, lengthMinMm: 0, lengthMaxMm: 0, heightMm: 0 },
    ]) {
      const prof = withGeometry(PEREPELOCHKA, patch);
      const res = layoutMelody(conv.melody, prof);
      expect(res.sheets.length).toBeGreaterThanOrEqual(1);
      for (const sheet of res.sheets) {
        expect(sheet.notes.length).toBeGreaterThan(0);
        for (const note of sheet.notes) {
          expect(Number.isFinite(note.x)).toBe(true);
          expect(Number.isFinite(note.y)).toBe(true);
        }
      }
    }
  });

  it("карточки заполняются жадно: все полные, кроме последней", () => {
    // 48 четвертей с верхней нотой E6: по-нотные границы позволяют первой
    // карточке взять больше тактов, чем ограничение по самой узкой струне
    const long = Array.from({ length: 48 }, (_, i) => [88, 84, 79, 76][i % 4]);
    const conv = convertMelody(makeMelody(long), PEREPELOCHKA);
    const layout = layoutMelody(conv.melody, withGeometry(PEREPELOCHKA, { mmPerBeat: 3 }));
    expect(layout.sheets.length).toBe(2);
    expect(layout.sheets[0].startBeat).toBe(0);
    expect(layout.sheets[0].notes.length).toBe(32); // 8 тактов: больше, чем 7 по узкой струне
    expect(layout.sheets[1].startBeat).toBe(32);
    expect(layout.sheets[1].notes.length).toBe(16);
    // ноты обеих карточек лежат в пределах СВОИХ струн
    for (const sheet of layout.sheets) {
      for (const note of sheet.notes) {
        const line = stringLine(PEREPELOCHKA, note.stringFromTop);
        expect(note.x).toBeLessThanOrEqual(line.x1 - PEREPELOCHKA.geometry.rightPadMm + 1e-9);
        expect(note.x).toBeGreaterThanOrEqual(line.x0 + PEREPELOCHKA.geometry.leftPadMm - 1e-9);
      }
    }
  });

  it("высокая нота в середине не сжимает окно всей карточки", () => {
    // 48 четвертей: G5 и одна высокая E6 в середине (t=10); мелодия уже в G-мажоре
    const mids = Array.from({ length: 48 }, (_, i) => (i === 10 ? 88 : 79));
    const conv = convertMelody(makeMelody(mids), PEREPELOCHKA);
    expect(conv.shift % 12).toBe(0); // транспонирования не требуется
    const layout = layoutMelody(conv.melody, withGeometry(PEREPELOCHKA, { mmPerBeat: 3 }));
    // вся мелодия — в одну карточку: по-нотные границы мягче ограничения по узкой струне
    expect(layout.sheets).toHaveLength(1);
    const notes = layout.sheets[0].notes;
    const high = notes.find((no) => no.midi === 88)!;
    const highLine = stringLine(PEREPELOCHKA, high.stringFromTop);
    expect(high.x).toBeLessThanOrEqual(highLine.x1 - PEREPELOCHKA.geometry.rightPadMm + 1e-9);
    // низкие ноты после высокой уходят правее конца ВЕРХНЕЙ струны — и это корректно
    const last = notes[notes.length - 1];
    expect(last.x).toBeGreaterThan(highLine.x1);
    const lastLine = stringLine(PEREPELOCHKA, last.stringFromTop);
    expect(last.x).toBeLessThanOrEqual(lastLine.x1 - PEREPELOCHKA.geometry.rightPadMm + 1e-9);
  });

  it("каждая нота уважает левый отступ своей струны", () => {
    const conv = convertMelody(makeMelody(TWINKLE_MIDIS), PEREPELOCHKA);
    const shifted = withGeometry(PEREPELOCHKA, { leftPadMm: 25 });
    const layout = layoutMelody(conv.melody, shifted);
    const placed = layout.sheets[0].notes;
    // окно начинается не левее границы самой стеснённой ноты карточки
    for (const note of placed) {
      const line = stringLine(shifted, note.stringFromTop);
      expect(note.x).toBeGreaterThanOrEqual(line.x0 + 25 - 1e-6);
    }
    // окно прижато влево ровно к самой стеснённой ноте
    const tightest = Math.max(
      ...placed.map((note) => {
        const line = stringLine(shifted, note.stringFromTop);
        return line.x0 + 25 - note.startBeats * layout.mmPerBeat;
      }),
    );
    expect(layout.sheets[0].windowStartX).toBeCloseTo(tightest, 6);
    const firstNoteBeat = placed[0].startBeats;
    expect(layout.sheets[0].bars[0].x - placed[0].x).toBeCloseTo((4 - firstNoteBeat) * layout.mmPerBeat, 6);
  });
});
