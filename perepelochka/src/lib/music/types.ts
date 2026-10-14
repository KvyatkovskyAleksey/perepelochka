// Внутренний формат мелодии.
// Время — в долях (beats), 1 доля = четверть. Высота — MIDI-номер (60 = C4).

export interface MelodyNote {
  midi: number;
  startBeats: number;
  durBeats: number;
}

export type MelodySourceKind = "abc" | "midi" | "builtin";

export interface MelodySource {
  kind: MelodySourceKind;
  /** Имя файла, setting id The Session и т.п. */
  detail?: string;
  /** Атрибуция для публикуемой библиотеки (The Session, Mutopia, народная). */
  attribution?: string;
  /** Ключ из метаданных источника ("Dmajor"), если известен. */
  key?: string;
}

export interface Melody {
  version: 1;
  id: string;
  name: string;
  notes: MelodyNote[];
  meter?: string;
  /** BPM четвертями. */
  tempo?: number;
  source?: MelodySource;
  /** Полутона от исходной высоты, применённые конвертером. */
  transposition?: number;
  createdAt: string;
}

export function newMelodyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
