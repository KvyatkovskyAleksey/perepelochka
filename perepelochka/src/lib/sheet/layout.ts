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
  const maxMmPerBeat = opts.maxMmPerBeat ?? profile.geometry.mmPerBeat;
  const minMmPerBeat = opts.minMmPerBeat ?? 4;
  const n = profileInfo(profile).stringCount;
  const notes = melody.notes;
  if (!notes.length) return { sheets: [], mmPerBeat: maxMmPerBeat, totalBeats: 0 };

  const totalBeats = melodyDuration(melody);

  // используемые струны и ширина самой узкой из них — она ограничивает вместимость:
  // трапеция симметрична, поэтому окно времени по x выбираем внутри самой узкой
  // используемой струны — тогда ноты гарантированно попадают на любую из них
  let shortestWidth = Infinity;
  for (const note of notes) {
    const idx = stringIndexForMidi(profile, note.midi);
    if (idx === null) continue;
    const line = stringLine(profile, n - 1 - idx);
    shortestWidth = Math.min(shortestWidth, line.x1 - line.x0);
  }
  if (!isFinite(shortestWidth)) shortestWidth = profile.geometry.lengthMinMm;
  const leftPad = profile.geometry.leftPadMm ?? LEFT_PAD_FALLBACK_MM;
  const avail = shortestWidth - leftPad - profile.geometry.rightPadMm;
  const windowStartX = -shortestWidth / 2 + leftPad;

  const barLen = barBeats(melody.meter);

  // каждая карточка вмещает целое число тактов; вместимость ограничена
  // самой короткой из используемых струн, чтобы ноты не вылезали за её конец
  const single = Math.min(maxMmPerBeat, avail / totalBeats);
  let sheetCount: number;
  if (single >= minMmPerBeat) {
    sheetCount = 1;
  } else {
    const capacityBeats = avail / minMmPerBeat; // сколько долей влезает при минимальном шаге
    const barsPerSheet = Math.max(1, Math.floor(capacityBeats / barLen));
    sheetCount = Math.min(12, Math.ceil(totalBeats / (barsPerSheet * barLen)));
  }

  const spanBeats = sheetCount === 1 ? totalBeats : Math.max(barLen, Math.ceil(totalBeats / sheetCount / barLen) * barLen);
  // шаг выбран так, что leftPad + spanBeats * mmPerBeat <= avail при любой геометрии
  const mmPerBeat = Math.max(0.5, Math.min(maxMmPerBeat, avail / spanBeats));

  const sheetStarts: number[] = [];
  for (let s = 0; s < sheetCount; s++) {
    sheetStarts.push(Math.min(s * spanBeats, Math.max(0, totalBeats - 1)));
  }

  const sheets: Sheet[] = sheetStarts.map((start, index) => ({
    index,
    startBeat: start,
    beats: 0,
    notes: [],
    bars: [],
  }));

  notes.forEach((note, noteIndex) => {
    let si = sheets.length - 1;
    for (let s = sheets.length - 1; s >= 0; s--) {
      if (sheets[s].startBeat <= note.startBeats) {
        si = s;
        break;
      }
    }
    const sheet = sheets[si];
    const x = windowStartX + (note.startBeats - sheet.startBeat) * mmPerBeat;
    const idx = stringIndexForMidi(profile, note.midi) ?? 0;
    const fromTop = n - 1 - idx;
    const line = stringLine(profile, fromTop);
    const placed: PlacedNote = {
      noteIndex,
      sheetIndex: si,
      midi: note.midi,
      startBeats: note.startBeats,
      durBeats: note.durBeats,
      x,
      y: line.y0,
      stringFromTop: fromTop,
      bar: Math.floor(note.startBeats / barLen),
    };
    sheet.notes.push(placed);
    sheet.beats = Math.max(sheet.beats, note.startBeats + note.durBeats - sheet.startBeat);
  });

  // тактовые линии и номера карточек
  sheets.forEach((sheet) => {
    for (let b = Math.ceil(sheet.startBeat / barLen) * barLen; b < sheet.startBeat + sheet.beats; b += barLen) {
      if (b <= sheet.startBeat) continue;
      sheet.bars.push({ x: windowStartX + (b - sheet.startBeat) * mmPerBeat, label: String(Math.round(b / barLen) + 1) });
    }
    sheet.beats = Math.ceil(sheet.beats / barLen) * barLen || sheet.beats;
  });

  // пустые карточки (если границы сдвинулись) убираем
  const used = sheets.filter((s) => s.notes.length);
  used.forEach((s, i) => (s.index = i));

  return { sheets: used, mmPerBeat, totalBeats };
}
