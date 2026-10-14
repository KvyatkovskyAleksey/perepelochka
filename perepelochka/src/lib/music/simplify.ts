// Упрощение мелодии до играбельного вида с пометками обо всех изменениях.

import { profileInfo, stringIndexForMidi, type InstrumentProfile } from "./instrument";
import type { Melody, MelodyNote } from "./types";

export interface SimplifyWarning {
  noteIndex: number;
  kind: "accidental" | "range" | "dense";
  fromMidi: number;
  toMidi: number | null;
}

export interface SimplifyOptions {
  /** Сетка квантизации в долях (четвертях): 0.25 = шестнадцатая. */
  grid?: number;
  /** Квантизировать ритм (нужно для MIDI, не для ABC). */
  quantize?: boolean;
}

/** Округляет моменты и длительности к сетке, не допуская наложения соседних нот. */
export function quantizeNotes(notes: MelodyNote[], grid = 0.25): MelodyNote[] {
  const rounded = notes.map((n) => ({
    ...n,
    startBeats: Math.round(n.startBeats / grid) * grid,
    durBeats: Math.max(grid, Math.round(n.durBeats / grid) * grid),
  }));
  for (let i = 0; i < rounded.length - 1; i++) {
    const gap = rounded[i + 1].startBeats - rounded[i].startBeats;
    if (gap >= grid) rounded[i].durBeats = Math.min(rounded[i].durBeats, gap);
  }
  return rounded;
}

/** Склеивает повторяющиеся подряд ноты одинаковой высоты (артефакты MIDI-экспорта). */
export function mergeRepeatedNotes(notes: MelodyNote[], gap = 0.06): MelodyNote[] {
  const out: MelodyNote[] = [];
  for (const n of notes) {
    const last = out[out.length - 1];
    if (last && last.midi === n.midi && Math.abs(last.startBeats + last.durBeats - n.startBeats) <= gap) {
      last.durBeats = n.startBeats + n.durBeats - last.startBeats;
    } else {
      out.push({ ...n });
    }
  }
  return out;
}

/** Подбирает ближайшую ноту строя; при равенстве — нижняя (музыкально безопаснее). */
export function snapToScale(midi: number, profile: InstrumentProfile): number {
  const { stringMidis, lowMidi, highMidi } = profileInfo(profile);
  // кандидаты: струны ± подгонка октавы, чтобы нота осталась в диапазоне
  const options = stringMidis.map((m) => {
    let v = m;
    while (v < lowMidi) v += 12;
    while (v > highMidi) v -= 12;
    return v;
  });
  let best = options[0];
  let bestDist = Math.abs(options[0] - midi);
  for (const o of options) {
    const d = Math.abs(o - midi);
    if (d < bestDist) {
      best = o;
      bestDist = d;
    }
  }
  return best;
}

function foldIntoRange(midi: number, profile: InstrumentProfile): number {
  const { lowMidi, highMidi } = profileInfo(profile);
  let v = midi;
  while (v < lowMidi) v += 12;
  while (v > highMidi) v -= 12;
  return v;
}

/**
 * Приводит ноты к строю: вне гаммы -> ближайшая ступень, вне диапазона -> октавный подворот.
 * Каждое изменение фиксируется предупреждением.
 */
export function simplifyToProfile(
  notes: MelodyNote[],
  profile: InstrumentProfile,
): { notes: MelodyNote[]; warnings: SimplifyWarning[] } {
  const warnings: SimplifyWarning[] = [];
  const result = notes.map((n, noteIndex) => {
    let midi = n.midi;
    const folded = foldIntoRange(midi, profile);
    if (folded !== midi) {
      warnings.push({ noteIndex, kind: "range", fromMidi: midi, toMidi: folded });
      midi = folded;
    }
    if (stringIndexForMidi(profile, midi) === null) {
      const snapped = snapToScale(midi, profile);
      warnings.push({ noteIndex, kind: "accidental", fromMidi: midi, toMidi: snapped });
      midi = snapped;
    }
    return { ...n, midi };
  });
  return { notes: result, warnings };
}
