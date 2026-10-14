// Раскладка мелодии по подкладным карточкам.
//
// Схема (согласована с реальной «Перепёлочкой» — треугольные гусли):
//  - время течёт слева направо; нота печатается в точке своей струны;
//  - расстояние между нотами пропорционально длительности;
//  - вместимость карточки ограничена самой короткой из используемых струн;
//  - длинные мелодии разбиваются на несколько карточек по тактам.

import {
  melodyDuration,
  profileInfo,
  stringIndexForMidi,
  stringLine,
  type InstrumentProfile,
} from "@/lib/music/instrument";
import type { Melody } from "@/lib/music/types";

export interface PlacedNote {
  noteIndex: number;
  sheetIndex: number;
  midi: number;
  startBeats: number;
  durBeats: number;
  x: number; // мм в координатах карточки
  y: number;
  stringFromTop: number;
  /** Номер такта (с нуля) — для раскраски. */
  bar: number;
}

export interface SheetBarLine {
  x: number;
  label: string;
}

export interface Sheet {
  index: number;
  startBeat: number;
  beats: number;
  /** Левый край окна времени этой карточки (мм): карточки без высоких нот начинаются левее. */
  windowStartX: number;
  notes: PlacedNote[];
  bars: SheetBarLine[];
}

export interface SheetLayoutResult {
  sheets: Sheet[];
  mmPerBeat: number;
  totalBeats: number;
}

export interface LayoutOptions {
  /** Максимальный размер ноты-точки... нет: мм на долю (четверть). */
  maxMmPerBeat?: number;
  /** Минимум мм на долю, ниже которого режем на несколько карточек. */
  minMmPerBeat?: number;
}

const LEFT_PAD_FALLBACK_MM = 10; // если в геометрии профиля не задан отступ

/** Радиус точки-ноты в мм по длительности (в долях). */
export function noteRadiusMm(durBeats: number): number {
  if (durBeats >= 3.5) return 3.4; // целая и больше
  if (durBeats >= 1.5) return 2.8; // половинная
  if (durBeats >= 0.75) return 2.4; // четвертная
  return 2; // восьмая и короче
}

function barBeats(meter: string | undefined): number {
  const m = /^(\d+)\/(\d+)$/.exec(meter ?? "");
  if (!m) return 4;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!num || !den) return 4;
  return (num * 4) / den; // в четвертях
}

export function layoutMelody(
  melody: Melody,
  profile: InstrumentProfile,
  opts: LayoutOptions = {},
): SheetLayoutResult {
  // вырожденные значения (например, стёртый шаг) ограничиваем снизу
  const maxMmPerBeat = Math.max(0.5, opts.maxMmPerBeat ?? profile.geometry.mmPerBeat);
  const minMmPerBeat = opts.minMmPerBeat ?? 4;
  const n = profileInfo(profile).stringCount;
  const notes = melody.notes;
  if (!notes.length) return { sheets: [], mmPerBeat: maxMmPerBeat, totalBeats: 0 };

  const totalBeats = melodyDuration(melody);
  const leftPad = profile.geometry.leftPadMm ?? LEFT_PAD_FALLBACK_MM;
  const rightPad = profile.geometry.rightPadMm;
  const barLen = barBeats(melody.meter);

  // ширина струны, на которой лежит нота (Infinity, если нота вне строя)
  const noteWidth = (midi: number): number => {
    const idx = stringIndexForMidi(profile, midi);
    if (idx === null) return Infinity;
    const line = stringLine(profile, n - 1 - idx);
    return line.x1 - line.x0;
  };
  // ширина самой узкой струны среди нот [from, to)
  const shortestWidthOf = (from: number, to: number): number => {
    let w = Infinity;
    for (let i = from; i < to && i < notes.length; i++) w = Math.min(w, noteWidth(notes[i].midi));
    return isFinite(w) ? w : profile.geometry.lengthMinMm;
  };

  // карточка [start, end) с окном по её собственным струнам
  const placeSheet = (start: number, end: number, fromIdx: number, toIdx: number, step: number): Sheet => {
    const w = shortestWidthOf(fromIdx, toIdx);
    const windowStart = -w / 2 + leftPad;
    const sheet: Sheet = {
      index: 0,
      startBeat: start,
      beats: end - start,
      windowStartX: windowStart,
      notes: [],
      bars: [],
    };
    for (let i = fromIdx; i < toIdx; i++) {
      const note = notes[i];
      const idx = stringIndexForMidi(profile, note.midi) ?? 0;
      const fromTop = n - 1 - idx;
      sheet.notes.push({
        noteIndex: i,
        sheetIndex: 0,
        midi: note.midi,
        startBeats: note.startBeats,
        durBeats: note.durBeats,
        x: windowStart + (note.startBeats - start) * step,
        y: stringLine(profile, fromTop).y0,
        stringFromTop: fromTop,
        bar: Math.floor(note.startBeats / barLen),
      });
    }
    for (let b = Math.ceil(start / barLen) * barLen; b < end - 1e-9; b += barLen) {
      if (b > start + 1e-9) {
        sheet.bars.push({ x: windowStart + (b - start) * step, label: String(Math.round(b / barLen) + 1) });
      }
    }
    return sheet;
  };

  const sheets: Sheet[] = [];
  let mmPerBeat = maxMmPerBeat;

  // 1) короткая мелодия: одна карточка (шаг при необходимости сжимаем, но не плотнее minMmPerBeat)
  const wholeW = shortestWidthOf(0, notes.length);
  const autoStep = (wholeW - leftPad - rightPad) / totalBeats;
  if (totalBeats > 0 && Math.min(maxMmPerBeat, autoStep) >= minMmPerBeat) {
    mmPerBeat = Math.min(maxMmPerBeat, autoStep);
    sheets.push(placeSheet(0, totalBeats, 0, notes.length, mmPerBeat));
  } else {
    // 2) жадный поток по тактам: каждая карточка набирает такты до предела,
    //    а её окно ограничено только ЕЁ собственными струнами. Карточка без
    //    самых высоких нот начинается левее — «если слева есть место, строим левее».
    const CAP = 24;
    let start = 0;
    let idx = 0;
    let guard = 0;
    while (start < totalBeats - 1e-9 && guard++ < 200) {
      let bestEnd = start;
      let bestIdx = idx;
      let endIdx = idx;
      let w = Infinity;
      for (
        let barEnd = Math.ceil((start + 1e-9) / barLen) * barLen;
        barEnd <= totalBeats + 1e-9;
        barEnd += barLen
      ) {
        let nextIdx = endIdx;
        let nextW = w;
        while (nextIdx < notes.length && notes[nextIdx].startBeats < barEnd - 1e-9) {
          nextW = Math.min(nextW, noteWidth(notes[nextIdx].midi));
          nextIdx++;
        }
        const span = barEnd - start;
        if (leftPad + span * maxMmPerBeat + rightPad <= nextW + 1e-9) {
          endIdx = nextIdx;
          w = nextW;
          bestEnd = barEnd;
          bestIdx = nextIdx;
        } else {
          break;
        }
      }
      let step = maxMmPerBeat;
      if (bestEnd <= start + 1e-9) {
        // даже один такт не влезает при заданном шаге — берём такт и уплотняем
        const barEnd = Math.min(Math.ceil((start + 1e-9) / barLen) * barLen, totalBeats);
        let nextIdx = idx;
        let nextW = Infinity;
        while (nextIdx < notes.length && notes[nextIdx].startBeats < barEnd - 1e-9) {
          nextW = Math.min(nextW, noteWidth(notes[nextIdx].midi));
          nextIdx++;
        }
        if (!isFinite(nextW)) nextW = profile.geometry.lengthMinMm;
        bestEnd = Math.max(barEnd, start + 0.25);
        bestIdx = nextIdx;
        step = Math.max(0.5, (nextW - leftPad - rightPad) / (bestEnd - start));
      } else if (sheets.length === CAP - 1) {
        // карточка под потолком счёта: в неё весь остаток, при необходимости плотнее
        const restW = shortestWidthOf(bestIdx, notes.length);
        const minW = Math.min(shortestWidthOf(idx, bestIdx), restW);
        const rest = totalBeats - start;
        if (leftPad + rest * maxMmPerBeat + rightPad > minW + 1e-9) {
          step = Math.max(0.5, (minW - leftPad - rightPad) / rest);
        }
        bestEnd = totalBeats;
        bestIdx = notes.length;
      }
      sheets.push(placeSheet(start, bestEnd, idx, bestIdx, step));
      start = bestEnd;
      idx = bestIdx;
    }
  }

  sheets.forEach((s, i) => {
    s.index = i;
    s.notes.forEach((no) => (no.sheetIndex = i));
  });
  return { sheets, mmPerBeat, totalBeats };
}
