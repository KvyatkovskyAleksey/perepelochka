// Конвейер конвертации: импортированная мелодия -> играбельная на инструменте.

import { findBestTransposition } from "./fit";
import { profileInfo, type InstrumentProfile } from "./instrument";
import { mergeRepeatedNotes, quantizeNotes, simplifyToProfile, type SimplifyWarning } from "./simplify";
import { newMelodyId, type Melody } from "./types";

export type ConversionVerdict = "fit" | "fixed" | "approx";

export interface ConversionResult {
  /** Мелодия, готовая к раскладке (транспонирована и упрощена). */
  melody: Melody;
  /** Исходник без изменений. */
  original: Melody;
  /** Применённый сдвиг в полутонах. */
  shift: number;
  /** Нот вне гаммы/диапазона до автоправок. */
  badBefore: number;
  outBefore: number;
  warnings: SimplifyWarning[];
  verdict: ConversionVerdict;
}

export function convertMelody(melody: Melody, profile: InstrumentProfile): ConversionResult {
  const info = profileInfo(profile);

  let notes = [...melody.notes].sort((a, b) => a.startBeats - b.startBeats || a.midi - b.midi);

  // MIDI часто с дрожащими моментами и нарезанными нотами — чистим ритм
  if (melody.source?.kind === "midi") {
    notes = mergeRepeatedNotes(quantizeNotes(notes));
  }

  const { shift, badCount, outCount } = findBestTransposition(notes, profile);
  const shifted = notes.map((n) => ({ ...n, midi: n.midi + shift }));
  const { notes: fixed, warnings } = simplifyToProfile(shifted, profile);

  // очень короткие ноты — предупреждение (детям тяжело), не правим
  fixed.forEach((n, noteIndex) => {
    if (n.durBeats < 0.26) {
      warnings.push({ noteIndex, kind: "dense", fromMidi: n.midi, toMidi: null });
    }
  });

  const converted: Melody = {
    ...melody,
    id: newMelodyId(),
    notes: fixed,
    transposition: shift,
  };

  const verdict: ConversionVerdict =
    warnings.length === 0 ? "fit" : warnings.length <= 3 ? "fixed" : "approx";

  void info;
  return {
    melody: converted,
    original: melody,
    shift,
    badBefore: badCount,
    outBefore: outCount,
    warnings,
    verdict,
  };
}
