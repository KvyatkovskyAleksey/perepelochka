// Профиль инструмента: строй и геометрия подкладной карточки. Всё параметрическо:
// размеры модели задаются числами и легко меняются (или выбирается другая модель).
//
// Геометрическая модель — равнобедренная трапеция, как карточка «Перепёлочки»:
// сверху короткая (высокая) струна, снизу длинная (басовая), боковые стороны
// симметричны (равные углы). Струны — параллельные горизонтальные линии,
// каждая длиной в ширину трапеции на своей высоте, центр по x=0.
// Нота печатается в точке своей струны, время течёт слева направо,
// расстояние между нотами пропорционально длительности.

import type { Melody } from "./types";

export interface SheetGeometry {
  /** Длина верхней (самой короткой, высокой) струны, мм — ширина карточки сверху. */
  lengthMinMm: number;
  /** Длина нижней (басовой) струны, мм — ширина карточки снизу. */
  lengthMaxMm: number;
  /** Размах струн поперёк, мм — высота карточки. */
  heightMm: number;
  /** Поля от края карточки до первой/последней струны, мм. */
  verticalMarginMm: number;
  /** Горизонтальный отступ ноты от конца струны, мм. */
  rightPadMm: number;
  /** Мм на одну долю (четверть): расстояние между нотами = длительность. */
  mmPerBeat: number;
  /** Отступ первой ноты от левого конца струн, мм. */
  leftPadMm: number;
  /** Поле бумаги за крайними струнами (контур реза), мм. */
  paperMarginMm: number;
}

export interface InstrumentProfile {
  id: string;
  name: string;
  /** Строй от басовой струны (низ карточки) к верхней (верх карточки). */
  tuning: string[];
  /** Тоника строя (например "G" или "C"); по умолчанию — нижняя струна. */
  root?: string;
  geometry: SheetGeometry;
}

const G_MAJOR_2_OCT = [
  "G4", "A4", "B4", "C5", "D5", "E5", "F#5",
  "G5", "A5", "B5", "C6", "D6", "E6", "F#6", "G6",
];

// Melody Harp / Music Maker: две октавы от G, но натуральный C-мажор (без фа-диезов)
const C_MAJOR_2_OCT = [
  "G3", "A3", "B3", "C4", "D4", "E4", "F4",
  "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5",
];

// длины струн на карточке: подобраны под печать на A4 (альбомной) без масштабирования;
// реальные размеры уточняются калибровочным листом
const BASE_GEOMETRY: SheetGeometry = {
  lengthMinMm: 85,
  lengthMaxMm: 265,
  heightMm: 175,
  verticalMarginMm: 10,
  rightPadMm: 8,
  mmPerBeat: 12,
  leftPadMm: 10,
  paperMarginMm: 6,
};

export const PEREPELOCHKA: InstrumentProfile = {
  id: "perepelochka",
  name: "Перепёлочка (15 струн, G-мажор G4–G6)",
  tuning: G_MAJOR_2_OCT,
  root: "G",
  geometry: { ...BASE_GEOMETRY },
};

export const MELODY_HARP_C: InstrumentProfile = {
  id: "melody-harp-c",
  name: "Melody Harp / Music Maker (15 струн, C-мажор G3–G5)",
  tuning: C_MAJOR_2_OCT,
  root: "C",
  geometry: { ...BASE_GEOMETRY },
};

export const BUILTIN_PROFILES: InstrumentProfile[] = [PEREPELOCHKA, MELODY_HARP_C];

export const CUSTOM_PROFILE_ID = "custom";

const NAME_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, F: 5,
  "F#": 6, GB: 6, G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11,
};

/** "F#5" -> 78. Принимает также имя без октавы (тогда октава 4). */
export function noteNameToMidi(name: string): number {
  const m = /^([A-G](?:#|b)?)(-?\d)?$/.exec(name.trim());
  if (!m) throw new Error(`Не разобрать ноту: ${name}`);
  const pc = NAME_TO_PC[m[1].toUpperCase()];
  const octave = m[2] === undefined ? 4 : Number(m[2]);
  return 12 * (octave + 1) + pc;
}

const PC_TO_SHARP_NAME = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** 78 -> "F#5". */
export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${PC_TO_SHARP_NAME[pc]}${octave}`;
}

/** "G4, A4, B4" -> ["G4","A4","B4"]. Бросает ошибку с понятным текстом. */
export function parseTuning(text: string): string[] {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length < 2) throw new Error("В строе должно быть минимум две ноты");
  if (tokens.length > 36) throw new Error("Слишком много струн (максимум 36)");
  const parsed = tokens.map((t) => {
    try {
      noteNameToMidi(t);
      return t.trim();
    } catch {
      throw new Error(`Не разобрать ноту строя: «${t}»`);
    }
  });
  return parsed;
}

export function tuningToText(tuning: string[]): string {
  return tuning.join(", ");
}

/** Новая копия профиля с изменёнными размерами. */
export function withGeometry(profile: InstrumentProfile, patch: Partial<SheetGeometry>): InstrumentProfile {
  return { ...profile, geometry: { ...profile.geometry, ...patch } };
}

/** Новая копия профиля с другим строем. */
export function withTuning(profile: InstrumentProfile, tuning: string[]): InstrumentProfile {
  return { ...profile, tuning: [...tuning] };
}

/** Превращает профиль в редактируемую «свою модель» (копия с id=custom). */
export function toCustomProfile(profile: InstrumentProfile): InstrumentProfile {
  if (profile.id === CUSTOM_PROFILE_ID) return profile;
  return {
    id: CUSTOM_PROFILE_ID,
    name: "Своя модель (отредактированная)",
    tuning: [...profile.tuning],
    geometry: { ...profile.geometry },
  };
}

export function serializeProfile(profile: InstrumentProfile): string {
  return JSON.stringify({ id: profile.id, name: profile.name, tuning: profile.tuning, geometry: profile.geometry });
}

export function deserializeProfile(json: string): InstrumentProfile | null {
  try {
    const raw = JSON.parse(json) as Partial<InstrumentProfile>;
    if (!Array.isArray(raw.tuning) || typeof raw.geometry !== "object" || raw.geometry === null) return null;
    const tuning = raw.tuning.map(String);
    tuning.forEach((t) => noteNameToMidi(t)); // валидация
    if (tuning.length < 2) return null;
    const g = raw.geometry as Partial<SheetGeometry>;
    const num = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? v : def);
    const geometry: SheetGeometry = {
      lengthMinMm: num(g.lengthMinMm, BASE_GEOMETRY.lengthMinMm),
      lengthMaxMm: num(g.lengthMaxMm, BASE_GEOMETRY.lengthMaxMm),
      heightMm: num(g.heightMm, BASE_GEOMETRY.heightMm),
      verticalMarginMm: num(g.verticalMarginMm, BASE_GEOMETRY.verticalMarginMm),
      rightPadMm: num(g.rightPadMm, BASE_GEOMETRY.rightPadMm),
      mmPerBeat: num(g.mmPerBeat, BASE_GEOMETRY.mmPerBeat),
      leftPadMm: num(g.leftPadMm, BASE_GEOMETRY.leftPadMm),
      paperMarginMm: num(g.paperMarginMm, BASE_GEOMETRY.paperMarginMm),
    };
    return {
      id: CUSTOM_PROFILE_ID,
      name: typeof raw.name === "string" ? raw.name : "Своя модель",
      tuning,
      root: typeof raw.root === "string" ? raw.root : undefined,
      geometry,
    };
  } catch {
    return null;
  }
}

export interface ProfileInfo {
  lowMidi: number;
  highMidi: number;
  /** Высоты струн от басовой к верхней. */
  stringMidis: number[];
  /** Классы высот гаммы строя (диатоника без повторов). */
  scalePcs: ReadonlySet<number>;
  rootPc: number;
  stringCount: number;
}

// кэш по объекту профиля: отредактированный профиль = новый объект = новый расчёт
const infoCache = new WeakMap<InstrumentProfile, ProfileInfo>();

export function profileInfo(profile: InstrumentProfile): ProfileInfo {
  const cached = infoCache.get(profile);
  if (cached) return cached;
  const stringMidis = profile.tuning.map(noteNameToMidi);
  if (stringMidis.length < 2) throw new Error("В строе должно быть минимум две струны");
  const sorted = [...stringMidis].sort((a, b) => a - b);
  const rootPc = profile.root
    ? ((noteNameToMidi(profile.root) % 12) + 12) % 12
    : ((sorted[0] % 12) + 12) % 12;
  const info: ProfileInfo = {
    lowMidi: sorted[0],
    highMidi: sorted[sorted.length - 1],
    stringMidis,
    scalePcs: new Set(stringMidis.map((m) => ((m % 12) + 12) % 12)),
    rootPc,
    stringCount: stringMidis.length,
  };
  infoCache.set(profile, info);
  return info;
}

/** Номер струны от басовой (0) к верхней; null — ноты на струнах нет. */
export function stringIndexForMidi(profile: InstrumentProfile, midi: number): number | null {
  const idx = profileInfo(profile).stringMidis.indexOf(midi);
  return idx === -1 ? null : idx;
}

export interface StringLine {
  /** Индекс от верхней (короткой) струны: 0 — верх. */
  fromTop: number;
  x0: number; y0: number; x1: number; y1: number;
}

/** Линия струны на карточке (мм, локальные координаты карточки, y вниз).
 *  Струны горизонтальны и параллельны; fromTop=0 — верхняя, короткая (lengthMinMm),
 *  нижняя — басовая (lengthMaxMm); между ними длина растёт линейно. */
export function stringLine(profile: InstrumentProfile, fromTop: number): StringLine {
  const g = profile.geometry;
  const n = profileInfo(profile).stringCount;
  const innerH = g.heightMm - 2 * g.verticalMarginMm;
  const y = g.verticalMarginMm + (innerH * fromTop) / (n - 1);
  const width = g.lengthMinMm + ((g.lengthMaxMm - g.lengthMinMm) * fromTop) / (n - 1);
  const half = width / 2;
  return { fromTop, x0: -half, y0: y, x1: half, y1: y };
}

/** Есть ли на струне место для ноты с таким x (не за правым концом струны). */
export function stringFitsX(profile: InstrumentProfile, fromTop: number, x: number): boolean {
  const line = stringLine(profile, fromTop);
  return x <= line.x1 - profile.geometry.rightPadMm;
}

/** Диапазон по x, доступный мелодии на карточке (по басовой струне). */
export function melodySpanMm(profile: InstrumentProfile): number {
  const n = profileInfo(profile).stringCount;
  const bass = stringLine(profile, n - 1);
  return bass.x1 - bass.x0 - profile.geometry.rightPadMm;
}

/** Сколько долей помещается на одну карточку. */
export function beatsPerSheet(profile: InstrumentProfile): number {
  return melodySpanMm(profile) / profile.geometry.mmPerBeat;
}

export function melodyDuration(melody: Melody): number {
  let end = 0;
  for (const n of melody.notes) end = Math.max(end, n.startBeats + n.durBeats);
  return end;
}
