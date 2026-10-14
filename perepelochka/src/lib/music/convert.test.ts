import { convertMelody } from "./convert";
import { findBestTransposition } from "./fit";
import { PEREPELOCHKA, stringIndexForMidi } from "./instrument";
import { quantizeNotes, snapToScale, simplifyToProfile } from "./simplify";
import { newMelodyId, type Melody, type MelodyNote } from "./types";

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

describe("findBestTransposition", () => {
  it("Twinkle из C-мажора переезжает в G (сдвиг +7, тоника на тонику)", () => {
    const r = findBestTransposition(makeMelody(TWINKLE_MIDIS).notes, PEREPELOCHKA);
    expect(r.badCount).toBe(0);
    expect(r.shift % 12).toBe(7);
  });

  it("мелодия G-мажора с фа-бекаром: лучшая транспозиция не убирает одну чужую ноту", () => {
    const r = findBestTransposition(makeMelody([79, 78, 77, 79]).notes, PEREPELOCHKA);
    expect(r.badCount).toBe(1);
  });
});

describe("simplifyToProfile", () => {
  it("чужая нота притягивается к ближайшей ступени (при равенстве — вниз)", () => {
    expect(snapToScale(77, PEREPELOCHKA)).toBe(76); // F5 -> E5 (не F#5)
    expect(snapToScale(73, PEREPELOCHKA)).toBe(72); // C#5 -> C5 (не D5)
  });

  it("нота вне диапазона подворачивается октавой", () => {
    const { notes, warnings } = simplifyToProfile(
      [{ midi: 95, startBeats: 0, durBeats: 1 }], // B6 выше G6
      PEREPELOCHKA,
    );
    expect(notes[0].midi).toBe(83); // B5
    expect(warnings).toEqual([{ noteIndex: 0, kind: "range", fromMidi: 95, toMidi: 83 }]);
  });

  it("чистая мелодия не трогается", () => {
    const { notes, warnings } = simplifyToProfile(
      makeMelody([67, 69, 71, 72]).notes,
      PEREPELOCHKA,
    );
    expect(warnings).toEqual([]);
    expect(notes.map((n) => n.midi)).toEqual([67, 69, 71, 72]);
  });
});

describe("quantizeNotes", () => {
  it("округляет к сетке и не даёт нотам накладываться", () => {
    const q = quantizeNotes([
      { midi: 67, startBeats: 0.01, durBeats: 0.48 },
      { midi: 69, startBeats: 0.49, durBeats: 0.5 },
      { midi: 71, startBeats: 0.9, durBeats: 1.2 },
    ]);
    expect(q[0]).toEqual({ midi: 67, startBeats: 0, durBeats: 0.5 });
    expect(q[1].startBeats).toBe(0.5);
    expect(q[1].durBeats).toBe(0.5);
    expect(q[2].durBeats).toBe(1.25);
  });
});

describe("convertMelody", () => {
  it("Twinkle: транспонируется и ложится без правок", () => {
    const res = convertMelody(makeMelody(TWINKLE_MIDIS), PEREPELOCHKA);
    expect(res.verdict).toBe("fit");
    expect(res.shift % 12).toBe(7);
    expect(res.warnings).toEqual([]);
    expect(res.melody.notes.every((n) => stringIndexForMidi(PEREPELOCHKA, n.midi) !== null)).toBe(true);
    // длительности и порядок сохранены
    expect(res.melody.notes.map((n) => n.durBeats)).toEqual(TWINKLE_MIDIS.map(() => 1));
  });

  it("G-мажор с фа-бекаром: одна автоправка с предупреждением", () => {
    const res = convertMelody(makeMelody([79, 78, 77, 79]), PEREPELOCHKA);
    expect(res.verdict).toBe("fixed");
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0].kind).toBe("accidental");
    expect(res.warnings[0].fromMidi).toBe(77);
    expect(res.warnings[0].toMidi).toBe(76);
    expect(res.melody.notes[2].midi).toBe(76);
  });

  it("хроматика: помечается как approx и всё равно приводится к струнам", () => {
    const chromatic = Array.from({ length: 15 }, (_, i) => 60 + i); // все 12 классов высот
    const res = convertMelody(makeMelody(chromatic), PEREPELOCHKA);
    expect(res.verdict).toBe("approx");
    expect(res.warnings.length).toBeGreaterThan(3);
    expect(res.melody.notes.every((n) => stringIndexForMidi(PEREPELOCHKA, n.midi) !== null)).toBe(true);
  });
});
