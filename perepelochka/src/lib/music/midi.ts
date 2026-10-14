// Импорт MIDI во внутренний формат Melody (+ выбор мелодического трека).

import { Midi } from "@tonejs/midi";
import { newMelodyId, type Melody, type MelodyNote } from "./types";

export interface MidiTrackCandidate {
  index: number;
  name?: string;
  noteCount: number;
  /** Доля соседних нот без перекрытия: 1 = строго монофонический трек. */
  monoFraction: number;
  avgMidi: number;
  /** Итоговый приоритет: монофоничность × объём + бонус верхнему голосу. */
  score: number;
}

export interface MidiFileInfo {
  name?: string;
  meter?: string;
  tempo?: number;
  candidates: MidiTrackCandidate[];
}

export class MidiParseError extends Error {}

function toMelodyFile(midi: Midi): MidiFileInfo {
  const ppq = midi.header?.ppq ?? 480;
  const meterTs = midi.header?.timeSignatures?.[0];
  const meter = meterTs?.timeSignature ? meterTs.timeSignature.join("/") : undefined;

  const candidates: MidiTrackCandidate[] = [];
  midi.tracks.forEach((track, index) => {
    const count = track.notes.length;
    if (count < 4) return;
    const sorted = [...track.notes].sort((a, b) => a.ticks - b.ticks);
    let monoPairs = 0;
    let pitchSum = 0;
    for (let i = 0; i < sorted.length; i++) {
      pitchSum += sorted[i].midi;
      if (i > 0 && sorted[i].ticks >= sorted[i - 1].ticks + sorted[i - 1].durationTicks - 2) {
        monoPairs++;
      }
    }
    const monoFraction = monoPairs / (sorted.length - 1);
    const avgMidi = pitchSum / count;
    const score = monoFraction * Math.log2(1 + count) + Math.min(Math.max((avgMidi - 55) / 40, 0), 1);
    candidates.push({
      index,
      name: track.name || track.instrument?.name,
      noteCount: count,
      monoFraction,
      avgMidi,
      score,
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  void ppq; // используется в melodyFromMidi через midi.header
  return {
    name: midi.name || undefined,
    meter,
    tempo: midi.header?.tempos?.[0]?.bpm,
    candidates,
  };
}

/** Разобрать файл и получить список треков-кандидатов на роль мелодии. */
export function inspectMidi(buffer: ArrayBuffer): MidiFileInfo {
  let midi: Midi;
  try {
    midi = new Midi(buffer);
  } catch (e) {
    throw new MidiParseError(`MIDI не читается: ${e instanceof Error ? e.message : e}`);
  }
  const info = toMelodyFile(midi);
  if (!info.candidates.length) throw new MidiParseError("В MIDI нет треков с достаточным числом нот");
  return info;
}

export interface MidiImportOptions {
  trackIndex: number;
  fileName?: string;
  name?: string;
  attribution?: string;
}

export function melodyFromMidi(buffer: ArrayBuffer, opts: MidiImportOptions): Melody {
  let midi: Midi;
  try {
    midi = new Midi(buffer);
  } catch (e) {
    throw new MidiParseError(`MIDI не читается: ${e instanceof Error ? e.message : e}`);
  }
  const track = midi.tracks[opts.trackIndex];
  if (!track || !track.notes.length) throw new MidiParseError(`Нет трека №${opts.trackIndex} с нотами`);

  const ppq = midi.header?.ppq ?? 480;
  const notes: MelodyNote[] = track.notes.map((n) => ({
    midi: n.midi,
    startBeats: n.ticks / ppq,
    durBeats: n.durationTicks / ppq,
  }));
  notes.sort((a, b) => a.startBeats - b.startBeats);

  const meterTs = midi.header?.timeSignatures?.[0];
  const meter = meterTs?.timeSignature ? meterTs.timeSignature.join("/") : undefined;

  return {
    version: 1,
    id: newMelodyId(),
    name: (opts.name || midi.name || track.name || opts.fileName || "Без названия").trim(),
    notes,
    meter,
    tempo: midi.header?.tempos?.[0]?.bpm,
    source: { kind: "midi", detail: opts.fileName, attribution: opts.attribution },
    createdAt: new Date().toISOString(),
  };
}
