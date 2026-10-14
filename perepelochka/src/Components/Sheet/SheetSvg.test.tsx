import { render } from "@testing-library/react";
import React from "react";
import SheetSvg from "./SheetSvg";
import { convertMelody } from "@/lib/music/convert";
import { PEREPELOCHKA, stringLine } from "@/lib/music/instrument";
import { newMelodyId, type Melody, type MelodyNote } from "@/lib/music/types";
import { layoutMelody, type SheetLayoutResult } from "@/lib/sheet/layout";

const TWINKLE_MIDIS = [72, 72, 79, 79, 81, 81, 79, 77, 77, 76, 76, 74, 74, 72];

function makeMelody(midis: number[], dur = 1): Melody {
  const notes: MelodyNote[] = midis.map((midi, i) => ({ midi, startBeats: i * dur, durBeats: dur }));
  return { version: 1, id: newMelodyId(), name: "Test", notes, meter: "4/4", createdAt: "" };
}

function setup() {
  const conv = convertMelody(makeMelody(TWINKLE_MIDIS), PEREPELOCHKA);
  const layout: SheetLayoutResult = layoutMelody(conv.melody, PEREPELOCHKA);
  return { conv, layout, sheet: layout.sheets[0] };
}

describe("SheetSvg", () => {
  it("рисует по точке на каждую ноту и подписи струн", () => {
    const { sheet, layout } = setup();
    const { container } = render(
      <SheetSvg sheet={sheet} layout={layout} profile={PEREPELOCHKA} title="Тест" sheetCount={1} />,
    );
    const notes = container.querySelectorAll("[data-testid^='note-']");
    expect(notes).toHaveLength(TWINKLE_MIDIS.length);
    // 15 подписей строя у левого края
    const labels = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(labels).toContain("G4");
    expect(labels).toContain("G6");
    expect(labels).toContain("F#5");
  });

  it("все координаты нот конечны", () => {
    const { sheet, layout } = setup();
    const { container } = render(
      <SheetSvg sheet={sheet} layout={layout} profile={PEREPELOCHKA} title="Тест" sheetCount={1} />,
    );
    container.querySelectorAll("[data-testid^='note-']").forEach((el) => {
      expect(Number.isFinite(Number(el.getAttribute("cx")))).toBe(true);
      expect(Number.isFinite(Number(el.getAttribute("cy")))).toBe(true);
    });
  });

  it("активная нота подсвечивается", () => {
    const { sheet, layout } = setup();
    const { container } = render(
      <SheetSvg
        sheet={sheet}
        layout={layout}
        profile={PEREPELOCHKA}
        title="Тест"
        sheetCount={1}
        activeNoteIndex={3}
      />,
    );
    const active = container.querySelector("[data-testid='note-3']");
    expect(active?.getAttribute("class")).toMatch(/noteActive/);
  });

  it("калибровочный лист без нот, с линейкой", () => {
    const layout: SheetLayoutResult = { sheets: [], mmPerBeat: 12, totalBeats: 0 };
    const { container } = render(
      <SheetSvg
        sheet={{ index: 0, startBeat: 0, beats: 0, notes: [], bars: [] }}
        layout={layout}
        profile={PEREPELOCHKA}
        title="Калибровка"
        sheetCount={1}
        calibration
      />,
    );
    expect(container.querySelectorAll("[data-testid^='note-']")).toHaveLength(0);
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts.join(" ")).toContain("50 мм");
    // контур карточки соответствует крайним струнам
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(15);
  });

  it("ноты лежат на линиях струн (визуальная согласованность)", () => {
    const { sheet, layout } = setup();
    for (const note of sheet.notes) {
      const line = stringLine(PEREPELOCHKA, note.stringFromTop);
      const t = (note.x - line.x0) / (line.x1 - line.x0);
      const expectedY = line.y0 + (line.y1 - line.y0) * t;
      expect(note.y).toBeCloseTo(expectedY, 6);
    }
  });
});
