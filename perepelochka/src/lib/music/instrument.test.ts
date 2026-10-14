import {
  BUILTIN_PROFILES,
  CUSTOM_PROFILE_ID,
  MELODY_HARP_C,
  PEREPELOCHKA,
  beatsPerSheet,
  deserializeProfile,
  midiToName,
  noteNameToMidi,
  parseTuning,
  profileInfo,
  serializeProfile,
  stringIndexForMidi,
  stringLine,
  toCustomProfile,
  tuningToText,
  withGeometry,
  withTuning,
} from "./instrument";

describe("noteNameToMidi / midiToName", () => {
  it("переводит имена в MIDI и обратно", () => {
    expect(noteNameToMidi("C4")).toBe(60);
    expect(noteNameToMidi("B3")).toBe(59);
    expect(noteNameToMidi("G4")).toBe(67);
    expect(noteNameToMidi("F#5")).toBe(78);
    expect(noteNameToMidi("G6")).toBe(91);
    expect(midiToName(60)).toBe("C4");
    expect(midiToName(78)).toBe("F#5");
    expect(midiToName(91)).toBe("G6");
  });
});

describe("PEREPELOCHKA", () => {
  const info = profileInfo(PEREPELOCHKA);

  it("строй: G4..G6, 15 струн", () => {
    expect(info.stringCount).toBe(15);
    expect(info.lowMidi).toBe(67);
    expect(info.highMidi).toBe(91);
    expect([...info.scalePcs].sort((a, b) => a - b)).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect(info.rootPc).toBe(7);
  });

  it("струны по MIDI: есть/нет", () => {
    expect(stringIndexForMidi(PEREPELOCHKA, 67)).toBe(0);
    expect(stringIndexForMidi(PEREPELOCHKA, 91)).toBe(14);
    expect(stringIndexForMidi(PEREPELOCHKA, 66)).toBeNull(); // F#4 ниже диапазона
    expect(stringIndexForMidi(PEREPELOCHKA, 68)).toBeNull(); // G#4 нет в диатонике
  });

  it("геометрия: равнобедренная трапеция, струны параллельны и удлиняются вниз", () => {
    const top = stringLine(PEREPELOCHKA, 0);
    const bottom = stringLine(PEREPELOCHKA, 14);
    // верхняя струна: 85 мм по центру, горизонтальна
    expect(top.x0).toBeCloseTo(-42.5, 6);
    expect(top.x1).toBeCloseTo(42.5, 6);
    expect(top.y0).toBe(top.y1);
    // басовая: 265 мм по центру, ниже верхней
    expect(bottom.x0).toBeCloseTo(-132.5, 6);
    expect(bottom.x1).toBeCloseTo(132.5, 6);
    expect(bottom.y0).toBeGreaterThan(top.y0);
    // симметрия и монотонная ширина
    const second = stringLine(PEREPELOCHKA, 1);
    expect(second.x0).toBeCloseTo(-second.x1, 6);
    expect(second.x1 - second.x0).toBeGreaterThan(top.x1 - top.x0);
    expect(second.x1 - second.x0).toBeLessThan(bottom.x1 - bottom.x0);
    // все струны параллельны (горизонтальны) и равноотстоящи по вертикали
    const gap1 = stringLine(PEREPELOCHKA, 2).y0 - second.y0;
    const gap2 = bottom.y0 - stringLine(PEREPELOCHKA, 13).y0;
    expect(gap1).toBeCloseTo(gap2, 6);
  });

  it("вместимость карточки в долях положительна", () => {
    expect(beatsPerSheet(PEREPELOCHKA)).toBeGreaterThan(10);
  });
});

describe("профили и редактирование модели", () => {
  it("пресет Melody Harp: C-мажор, G3–G5", () => {
    const info = profileInfo(MELODY_HARP_C);
    expect(info.lowMidi).toBe(55); // G3
    expect(info.highMidi).toBe(79); // G5
    expect([...info.scalePcs].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(info.rootPc).toBe(0);
    expect(stringIndexForMidi(MELODY_HARP_C, 60)).toBe(3); // C4 — четвёртая струна
  });

  it("встроенные профили валидны и различаются", () => {
    expect(BUILTIN_PROFILES.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(BUILTIN_PROFILES.map((p) => p.id));
    expect(ids.size).toBe(BUILTIN_PROFILES.length);
    for (const p of BUILTIN_PROFILES) {
      expect(() => profileInfo(p)).not.toThrow();
      expect(p.geometry.lengthMinMm).toBeLessThan(p.geometry.lengthMaxMm);
    }
  });

  it("withGeometry/withTuning меняют только нужное и не трогают оригинал", () => {
    const taller = withGeometry(PEREPELOCHKA, { heightMm: 250 });
    expect(taller.geometry.heightMm).toBe(250);
    expect(taller.geometry.lengthMaxMm).toBe(PEREPELOCHKA.geometry.lengthMaxMm);
    expect(PEREPELOCHKA.geometry.heightMm).not.toBe(250);
    expect(stringLine(taller, 14).y1).toBeGreaterThan(stringLine(PEREPELOCHKA, 14).y1);

    const retuned = withTuning(PEREPELOCHKA, ["C4", "D4", "E4"]);
    expect(profileInfo(retuned).stringCount).toBe(3);
    expect(profileInfo(PEREPELOCHKA).stringCount).toBe(15);
  });

  it("toCustomProfile делает копию с id=custom", () => {
    const custom = toCustomProfile(PEREPELOCHKA);
    expect(custom.id).toBe(CUSTOM_PROFILE_ID);
    expect(custom.tuning).toEqual(PEREPELOCHKA.tuning);
    expect(custom.tuning).not.toBe(PEREPELOCHKA.tuning); // независимая копия
    expect(toCustomProfile(custom)).toBe(custom); // повторный вызов — тот же объект
  });

  it("parseTuning: список нот, ошибки с понятным текстом", () => {
    expect(parseTuning("G4, A4, B4")).toEqual(["G4", "A4", "B4"]);
    expect(parseTuning("C5 D5\nE5")).toEqual(["C5", "D5", "E5"]);
    expect(() => parseTuning("G4 Xylophone")).toThrow("Xylophone");
    expect(() => parseTuning("G4")).toThrow("минимум две");
    expect(tuningToText(["G4", "A4"])).toBe("G4, A4");
  });

  it("serialize/deserialize: круговой поход и защита от мусора", () => {
    const custom = withGeometry(toCustomProfile(PEREPELOCHKA), { heightMm: 210, lengthMaxMm: 280 });
    const restored = deserializeProfile(serializeProfile(custom));
    expect(restored?.geometry.heightMm).toBe(210);
    expect(restored?.geometry.lengthMaxMm).toBe(280);
    expect(restored?.tuning).toEqual(custom.tuning);
    expect(restored?.id).toBe(CUSTOM_PROFILE_ID);
    expect(deserializeProfile("{не json")).toBeNull();
    expect(deserializeProfile('{"tuning":["H9"],"geometry":{}}')).toBeNull(); // невалидная нота
    // отсутствующие поля геометрии заменяются значениями по умолчанию
    const partial = deserializeProfile(
      JSON.stringify({ tuning: ["G4", "A4"], geometry: { heightMm: 123 } }),
    );
    expect(partial?.geometry.heightMm).toBe(123);
    expect(partial?.geometry.lengthMaxMm).toBe(PEREPELOCHKA.geometry.lengthMaxMm);
  });
});
