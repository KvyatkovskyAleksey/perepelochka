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
  /** Подобрать шаг так, чтобы вся мелодия уместилась на одну карточку. */
  fitOneSheet?: boolean;
}

const LEFT_PAD_FALLBACK_MM = 10; // если в геометрии профиля не задан отступ

/** Потолок шага в режиме «всё на одну карточку» (ручной шаг не влияет). */
export const FIT_ONE_MAX_MM_PER_BEAT = 30;

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

  // По-нотные границы окна (общая ось времени внутри карточки):
  //   x_i = windowStart + t_i * step должна лежать на СВОЕЙ струне ноты i:
  //   -W_i/2 + leftPad <= x_i <= W_i/2 - rightPad
  // Высокая нота в середине ограничивает только свою позицию справа,
  // а не ширину всей карточки.
  const boundsOf = (from: number, to: number, start: number, step: number) => {
    let L = -Infinity;
    let R = Infinity;
    for (let i = from; i < to && i < notes.length; i++) {
      const w = noteWidth(notes[i].midi);
      const t = notes[i].startBeats - start;
      L = Math.max(L, -w / 2 + leftPad - t * step);
      R = Math.min(R, w / 2 - rightPad - t * step);
    }
    if (!isFinite(L)) {
      const w = profile.geometry.lengthMinMm;
      L = -w / 2 + leftPad;
      R = w / 2 - rightPad;
    }
    return { L, R };
  };

  // Наибольший шаг, при котором набор нот помещается на одну карточку.
  // Условие "для всех пар нот": (t_j - t_i) * step <= (W_i + W_j)/2 - отступы.
  const maxFeasibleStep = (from: number, to: number, cap: number): number => {
    let s = cap;
    for (let i = from; i < to && i < notes.length; i++) {
      const wi = noteWidth(notes[i].midi);
      const ti = notes[i].startBeats;
      for (let j = i + 1; j < to && j < notes.length; j++) {
        const dt = notes[j].startBeats - ti;
        if (dt < 1e-6) continue; // одновременные ноты ловятся проверкой L <= R
        const wj = noteWidth(notes[j].midi);
        const limit = (wi / 2 - leftPad + wj / 2 - rightPad) / dt;
        if (limit < s) s = limit;
      }
    }
    return Math.max(0.5, s);
  };

  // карточка [start, end): окно начинаем так левее, как позволяют ноты
  const placeSheet = (start: number, end: number, fromIdx: number, toIdx: number, step: number): Sheet => {
    const windowStart = boundsOf(fromIdx, toIdx, start, step).L;
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

  // 0) режим «всё на одну карточку»: наибольший влезающий шаг.
  // Ручной шаг пользователя здесь НЕ участвует (поле заблокировано) —
  // потолком служит фиксированный разумный максимум.
  if (opts.fitOneSheet && totalBeats > 0) {
    const step = maxFeasibleStep(0, notes.length, FIT_ONE_MAX_MM_PER_BEAT);
    mmPerBeat = step;
    sheets.push(placeSheet(0, totalBeats, 0, notes.length, step));
  }

  // 1) короткая мелодия: одна карточка, шаг сжимаем насколько нужно (но не плотнее minMmPerBeat)
  if (!sheets.length && totalBeats > 0) {
    const autoStep = maxFeasibleStep(0, notes.length, maxMmPerBeat);
    const b = boundsOf(0, notes.length, 0, autoStep);
    if (autoStep >= minMmPerBeat && b.L <= b.R + 1e-9) {
      mmPerBeat = autoStep;
      sheets.push(placeSheet(0, totalBeats, 0, notes.length, autoStep));
    }
  }

  // 2) жадный поток по тактам: карточка набирает такты, пока по-нотные границы
  //    сходятся (L <= R); окно каждой карточки начинается максимально левее
  if (!sheets.length) {
    const CAP = 24;
    let start = 0;
    let idx = 0;
    let guard = 0;
    while (start < totalBeats - 1e-9 && guard++ < 200) {
      let bestEnd = start;
      let bestIdx = idx;
      let L = -Infinity;
      let R = Infinity;
      let endIdx = idx;
      for (
        let barEnd = Math.ceil((start + 1e-9) / barLen) * barLen;
        barEnd <= totalBeats + 1e-9;
        barEnd += barLen
      ) {
        let nextIdx = endIdx;
        while (nextIdx < notes.length && notes[nextIdx].startBeats < barEnd - 1e-9) nextIdx++;
        let newL = L;
        let newR = R;
        for (let i = endIdx; i < nextIdx; i++) {
          const w = noteWidth(notes[i].midi);
          const t = notes[i].startBeats - start;
          newL = Math.max(newL, -w / 2 + leftPad - t * maxMmPerBeat);
          newR = Math.min(newR, w / 2 - rightPad - t * maxMmPerBeat);
        }
        if (newL <= newR + 1e-9) {
          L = newL;
          R = newR;
          endIdx = nextIdx;
          bestEnd = barEnd;
          bestIdx = nextIdx;
        } else {
          break;
        }
      }
      let step = maxMmPerBeat;
      if (bestEnd <= start + 1e-9) {
        // даже один такт не влезает — уплотняем шаг по нотам такта
        const barEnd = Math.min(Math.ceil((start + 1e-9) / barLen) * barLen, totalBeats);
        let nextIdx = idx;
        while (nextIdx < notes.length && notes[nextIdx].startBeats < barEnd - 1e-9) nextIdx++;
        step = maxFeasibleStep(idx, nextIdx, maxMmPerBeat);
        bestEnd = Math.max(barEnd, start + 0.25);
        bestIdx = nextIdx;
      } else if (sheets.length === CAP - 1) {
        // карточка под потолком счёта: весь остаток, при необходимости плотнее
        bestEnd = totalBeats;
        bestIdx = notes.length;
        const b = boundsOf(idx, bestIdx, start, maxMmPerBeat);
        if (b.L > b.R + 1e-9) {
          step = maxFeasibleStep(idx, bestIdx, maxMmPerBeat);
        }
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
