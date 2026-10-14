import { melodyFromAbc } from "./abc";

const TWINKLE = "X:1\nT:Twinkle\nM:4/4\nL:1/4\nK:C\n| c c g g | a a g2 | f f e e | d d c2 |\n";

describe("melodyFromAbc", () => {
  it("читает заголовки и ноты", () => {
    const m = melodyFromAbc(TWINKLE);
    expect(m.name).toBe("Twinkle");
    expect(m.meter).toBe("4/4");
    expect(m.notes).toHaveLength(14);
    expect(m.notes[0]).toEqual({ midi: 72, startBeats: 0, durBeats: 1 }); // c = C5
    expect(m.notes[2].midi).toBe(79); // g = G5
    expect(m.notes[7].midi).toBe(77); // f = F5 (в C-мажоре фа-бекар)
  });

  it("пауза продвигает время", () => {
    const m = melodyFromAbc("X:1\nM:4/4\nL:1/4\nK:C\n| C z C z |\n");
    expect(m.notes.map((n) => n.startBeats)).toEqual([0, 2]);
  });

  it("знаки при ключе: K:G делает фа диезом", () => {
    const m = melodyFromAbc("X:1\nM:4/4\nL:1/4\nK:G\n| f2 f2 |\n");
    expect(m.notes[0].midi).toBe(78); // f = F#5
  });

  it("бемоль/диез действуют до конца такта", () => {
    const m = melodyFromAbc("X:1\nM:4/4\nL:1/4\nK:G\n| =f f | f2 f2 |\n");
    expect(m.notes[0].midi).toBe(77); // =f натуральная
    expect(m.notes[1].midi).toBe(77); // внутри того же такта остаётся натуральной
    expect(m.notes[2].midi).toBe(78); // новый такт — снова фа-диез
  });

  it("из аккорда берётся нижняя нота", () => {
    const m = melodyFromAbc("X:1\nM:4/4\nL:1/4\nK:G\n| [GB]4 |\n");
    expect(m.notes).toHaveLength(1);
    expect(m.notes[0].midi).toBe(67);
  });

  it("форшлаги пропускаются", () => {
    const m = melodyFromAbc("X:1\nM:4/4\nL:1/4\nK:G\n| {a}g2 g2 |\n");
    expect(m.notes).toHaveLength(2);
    expect(m.notes.every((n) => n.midi === 79)).toBe(true);
  });

  it("K: восстанавливается из метаданных источника (как отдаёт The Session API)", () => {
    // abc без K:, фа по умолчанию была бы натуральной; ключ Dmajor делает её диезом
    const m = melodyFromAbc('"D" f4 g4|', { key: "Dmajor", name: "Test" });
    expect(m.name).toBe("Test");
    expect(m.notes[0].midi).toBe(78);
    expect(m.source?.key).toBe("Dmajor");
  });

  it("Коробейники (e-moll): первая фраза по нотам", () => {
    const m = melodyFromAbc(
      "X:1\nT:Korobeiniki\nM:4/4\nL:1/8\nK:Em\n| E2 B,2 C2 D2 | E2 C2 B,2 A,2 |\n",
    );
    expect(m.notes.map((n) => n.midi)).toEqual([64, 59, 60, 62, 64, 60, 59, 57]);
    expect(m.notes.every((n) => n.durBeats === 1)).toBe(true); // E2 = четверть
  });

  it("бросает понятную ошибку на мусоре", () => {
    expect(() => melodyFromAbc("not abc at all")).toThrow();
  });
});
