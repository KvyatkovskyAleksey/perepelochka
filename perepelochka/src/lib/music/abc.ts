// Импорт ABC-нотации во внутренний формат Melody.
// Порт логики experiments/analyze-fit.mjs, проверенной на 100 мелодиях The Session:
// восстановление K: из метаданных, знаки при ключе + действующие до конца такта,
// первая нота аккорда как мелодическая, пропуск форшлагов.

import abcjs from "abcjs";
import { newMelodyId, type Melody, type MelodyNote } from "./types";

const LETTERS = "CDEFGAB";
const BASE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC_OFFSET: Record<string, number> = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2 };

/**
 * Ключ из метаданных источника ("Dmajor", "Edorian", "Gminor") в K:-строку ABC.
 * The Session отдаёт abc без K:, сайт дописывает её из метаданных — делаем так же.
 */
export function sourceKeyToAbcKey(key: string | undefined): string | null {
  const m = /^(.+?)(major|ionian|minor|aeolian|dorian|mixolydian|lydian|phrygian|locrian)?$/.exec(key ?? "");
  if (!m || !m[1]) return null;
  const mode =
    { major: "", ionian: "", minor: "m", aeolian: "m", dorian: "dor", mixolydian: "mix", lydian: "lyd", phrygian: "phr", locrian: "loc" }[m[2] ?? "major"] ?? "";
  return `K:${m[1]}${mode}`;
}

// Минимальная структурная модель того, что возвращает abcjs.parseOnly (в части, которую мы читаем).
interface ParsedPitch {
  pitch: number; // диатоническая позиция от C4 (0 = C4)
  name: string;
  verticalPos: number;
  accidental?: string;
}
interface ParsedElem {
  el_type: string;
  duration?: number; // в целых нотах
  pitches?: ParsedPitch[];
}
interface ParsedVoiceElem {
  el_type: string;
  duration?: number;
  pitches?: ParsedPitch[];
  rest?: unknown;
  [k: string]: unknown;
}
interface ParsedStaff {
  key?: { accidentals: { note: string; acc: string }[] };
  meter?: { type?: string; value?: { num?: string | number; den?: string | number }[] };
  voices?: ParsedVoiceElem[][];
}
interface ParsedTune {
  lines?: { staff?: ParsedStaff[] }[];
  metaText?: {
    title?: string;
    meter?: { num?: number; den?: number };
    tempo?: { bpm?: number };
  };
}

export interface AbcImportOptions {
  /** Ключ из метаданных источника, если в самом ABC нет K:. */
  key?: string;
  /** Имя мелодии, если в ABC нет T:. */
  name?: string;
  attribution?: string;
}

export class AbcParseError extends Error {}

export function melodyFromAbc(abc: string, opts: AbcImportOptions = {}): Melody {
  let text = abc;
  if (!/^K:/m.test(text)) {
    const k = sourceKeyToAbcKey(opts.key);
    if (k) text = `X:1\n${k}\n${text}`;
  }
  // защита от мусора: без заголовков и тактовых черт это точно не ABC
  if (!/^[XTMKLQ]:/m.test(text) && !text.includes("|")) {
    throw new AbcParseError("Это не похоже на ABC-нотацию (нет заголовков и тактовых черт)");
  }

  const tunes = abcjs.parseOnly(text) as unknown as ParsedTune[];
  const tune = tunes?.[0];
  if (!tune?.lines?.length) throw new AbcParseError("ABC не распарсился: пустой результат");

  const notes: MelodyNote[] = [];
  let timeBeats = 0; // в четвертях

  for (const line of tune.lines) {
    const staff = line.staff?.[0];
    const voice = staff?.voices?.[0];
    if (!voice) continue;

    // знаки при ключе действуют до следующей K:; в abcjs смена ключа = новый staff.key
    const keyAcc: Record<string, number> = {};
    for (const a of staff.key?.accidentals ?? []) {
      const off = ACC_OFFSET[a.acc];
      if (off !== undefined) keyAcc[a.note.toUpperCase()] = off;
    }
    // случайные знаки действуют до конца такта
    const inline: Record<number, number> = {};

    for (const el of voice) {
      if (el.el_type === "bar") {
        for (const k of Object.keys(inline)) delete inline[Number(k)];
        continue;
      }
      const durBeats = (el.duration ?? 0) * 4;
      const elem = el as ParsedElem;
      if (elem.el_type !== "note" || !elem.pitches?.length) {
        // пауза или служебный элемент: время идёт дальше
        if (durBeats > 0) timeBeats += durBeats;
        continue;
      }
      // форшлаги имеют нулевую длительность и приходят отдельными элементами
      if (durBeats <= 0) continue;

      const p = elem.pitches[0]; // первая нота аккорда = мелодическая
      const step = p.pitch;
      const letter = LETTERS[((step % 7) + 7) % 7];
      const octave = Math.floor(step / 7) + 4; // step 0 = C4
      let off = keyAcc[letter] ?? 0;
      if (p.accidental !== undefined) {
        off = ACC_OFFSET[p.accidental] ?? 0;
        inline[p.verticalPos] = off;
      } else if (inline[p.verticalPos] !== undefined) {
        off = inline[p.verticalPos];
      }
      const pc = (((BASE_PC[letter] + off) % 12) + 12) % 12;
      notes.push({ midi: 12 * (octave + 1) + pc, startBeats: timeBeats, durBeats });
      timeBeats += durBeats;
    }
  }

  if (notes.length === 0) throw new AbcParseError("В ABC не найдено нот");

  const meterVal = (tune.lines ?? [])
    .map((l) => l.staff?.[0]?.meter)
    .find((m) => m?.type === "specified" && m.value?.length);
  const meterNum = meterVal?.value?.[0]?.num;
  const meterDen = meterVal?.value?.[0]?.den;
  const name = (tune.metaText?.title || opts.name || "Без названия").trim();

  return {
    version: 1,
    id: newMelodyId(),
    name,
    notes,
    meter: meterNum && meterDen ? `${meterNum}/${meterDen}` : undefined,
    tempo: tune.metaText?.tempo?.bpm ?? undefined,
    source: { kind: "abc", detail: opts.name, attribution: opts.attribution, key: opts.key },
    createdAt: new Date().toISOString(),
  };
}
