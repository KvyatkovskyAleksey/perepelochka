// Поиск транспозиции: сколько полутонов добавить, чтобы мелодия легла на гамму строя.

import { profileInfo, type InstrumentProfile } from "./instrument";
import type { MelodyNote } from "./types";

export interface TranspositionSearchResult {
  /** Сдвиг в полутонах (может быть отрицательным/больше 12 — с октавой). */
  shift: number;
  /** Нот вне гаммы строя после сдвига. */
  badCount: number;
  /** Нот вне диапазона строя после сдвига. */
  outCount: number;
}

/**
 * Ранжирование кандидатов:
 *   1) меньше нот вне гаммы;
 *   2) меньше нот вне диапазона;
 *   3) предпочтение «тоника → тоника строя» (тоника = последняя нота, эвристика для фольклора);
 *   4) сдвиг ближе к исходнику.
 */
export function findBestTransposition(
  notes: MelodyNote[],
  profile: InstrumentProfile,
): TranspositionSearchResult {
  const info = profileInfo(profile);
  const midis = notes.map((n) => n.midi);
  if (!midis.length) return { shift: 0, badCount: 0, outCount: 0 };

  const tonicPc = ((midis[midis.length - 1] % 12) + 12) % 12;

  const badByShift: number[] = [];
  for (let s = 0; s < 12; s++) {
    let bad = 0;
    for (const m of midis) if (!info.scalePcs.has((((m + s) % 12) + 12) % 12)) bad++;
    badByShift.push(bad);
  }
  const minBad = Math.min(...badByShift);

  let best: TranspositionSearchResult | null = null;
  let bestRank: number[] = [];
  for (let s = 0; s < 12; s++) {
    if (badByShift[s] !== minBad) continue;
    for (const oct of [-12, 0, 12]) {
      const shift = s + oct;
      let out = 0;
      for (const m of midis) {
        const t = m + shift;
        if (t < info.lowMidi || t > info.highMidi) out++;
      }
      const tonicAligned = (((tonicPc + shift) % 12) + 12) % 12 === info.rootPc;
      // ранг: лексикографически (out, не-тоника, |сдвиг от родной октавы|)
      const rank = [out, tonicAligned ? 0 : 1, Math.abs(oct), s];
      if (!best || lexLess(rank, bestRank)) {
        best = { shift, badCount: minBad, outCount: out };
        bestRank = rank;
      }
    }
  }
  return best ?? { shift: 0, badCount: minBad, outCount: 0 };
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}
