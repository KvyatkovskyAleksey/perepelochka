// Анализ: ложится ли мелодия на 15 струн "Перепёлочки" (G-мажор, G4–G6).
// Для каждой мелодии:
//   1) ищем транспозицию с минимумом нот вне гаммы G-мажора (диезы/бемоли);
//   2) среди равных вариантов выбираем сдвиг октавами, чтобы влезть в диапазон G4..G6;
//   3) категоризируем: A — сразу, B — 1–3 правки, C — не ложится.
// Использование: node analyze-fit.mjs [входной json] [выходной json]

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const abcjs = require("abcjs");

const IN = process.argv[2] ?? "data/session-tunes.json";
const OUT = process.argv[3] ?? "data/fit-report.json";

// строй инструмента: 15 струн G4..G6, гамма G-мажора
const G_SET = new Set([7, 9, 11, 0, 2, 4, 6]); // G A B C D E F#
const LOW = 67; // G4
const HIGH = 91; // G6
const BASE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = "CDEFGAB";
const ACC_OFFSET = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2 };

// The Session отдаёт abc иногда без строки K: (сайт дописывает её из метаданных).
// Восстанавливаем ключ из поля key вида "Dmajor"/"Edorian"/"Gminor".
function abcKeyToAbc(key) {
  const m = /^(.+?)(major|ionian|minor|aeolian|dorian|mixolydian|lydian|phrygian|locrian)?$/.exec(key ?? "");
  if (!m) return null;
  const root = m[1];
  const mode = { major: "", ionian: "", minor: "m", aeolian: "m", dorian: "dor", mixolydian: "mix", lydian: "lyd", phrygian: "phr", locrian: "loc" }[m[2] ?? "major"];
  return `K:${root}${mode ?? ""}`;
}

// ABC -> массив MIDI-нот мелодического голоса (первая нота аккорда)
function abcToMidi(abc, metaKey) {
  if (!/^K:/m.test(abc)) {
    const k = abcKeyToAbc(metaKey);
    if (k) abc = `X:1\n${k}\n${abc}`;
  }
  const tunes = abcjs.parseOnly(abc);
  if (!tunes?.length) return null;
  const notes = [];
  let chordEls = 0;
  for (const line of tunes[0].lines ?? []) {
    const staff = line.staff?.[0];
    const voice = staff?.voices?.[0];
    if (!voice) continue;
    // знаки при ключе действуют до следующей K: (в abcjs новая строка = новый staff.key)
    const ks = {};
    for (const a of staff.key?.accidentals ?? []) {
      ks[a.note.toUpperCase()] = ACC_OFFSET[a.acc] ?? 0;
    }
    const inline = {}; // вертикальная позиция -> смещение полутона, до конца такта
    for (const el of voice) {
      if (el.el_type === "bar") {
        for (const k of Object.keys(inline)) delete inline[k];
        continue;
      }
      if (el.el_type !== "note" || !el.pitches?.length) continue;
      if (!el.duration || el.duration <= 0) continue; // форшлаги и нулевые
      if (el.pitches.length > 1) chordEls++;
      const p = el.pitches[0];
      const step = p.pitch;
      const letter = LETTERS[((step % 7) + 7) % 7];
      const octave = Math.floor(step / 7) + 4; // step 0 = C4
      let off = ks[letter] ?? 0;
      if (p.accidental !== undefined) {
        off = ACC_OFFSET[p.accidental] ?? 0;
        inline[p.verticalPos] = off;
      } else if (inline[p.verticalPos] !== undefined) {
        off = inline[p.verticalPos];
      }
      notes.push(12 * (octave + 1) + ((BASE_PC[letter] + off) % 12));
    }
  }
  return notes.length ? { notes, chordEls } : null;
}

function bestTransposition(notes) {
  let minBad = Infinity;
  const badByShift = [];
  for (let s = 0; s < 12; s++) {
    let bad = 0;
    for (const m of notes) if (!G_SET.has((m + s) % 12)) bad++;
    badByShift.push(bad);
    if (bad < minBad) minBad = bad;
  }
  // среди сдвигов с minBad пробуем октавные варианты для попадания в диапазон
  let best = null;
  for (let s = 0; s < 12; s++) {
    if (badByShift[s] !== minBad) continue;
    for (const oct of [-12, 0, 12]) {
      const shift = s + oct;
      let out = 0;
      for (const m of notes) {
        const t = m + shift;
        if (t < LOW || t > HIGH) out++;
      }
      if (!best || out < best.out) best = { bad: minBad, out, shift };
    }
  }
  return best;
}

function analyzeTune(tune) {
  const parsed = abcToMidi(tune.abc, tune.key);
  if (!parsed) return { status: "PARSE_FAIL" };
  const { notes, chordEls } = parsed;
  if (notes.length < 8) return { status: "TOO_SHORT" };
  const best = bestTransposition(notes);
  const fixes = best.bad + best.out;
  const width = Math.max(...notes) - Math.min(...notes);
  return {
    status: best.bad === 0 && best.out === 0 ? "A" : fixes <= 3 ? "B" : "C",
    badAccidentals: best.bad, // ноты вне гаммы G-мажора после транспозиции
    outOfRange: best.out, // ноты вне G4..G6
    shift: best.shift,
    width,
    noteCount: notes.length,
    chordEls,
  };
}

const tunes = JSON.parse(readFileSync(IN, "utf8"));
const results = [];
for (const t of tunes) {
  const r = analyzeTune(t);
  results.push({ ...t, ...r });
}

// агрегация
const by = (pred) => results.filter(pred);
const A = by((r) => r.status === "A");
const B = by((r) => r.status === "B");
const C = by((r) => r.status === "C");
const fails = by((r) => r.status === "PARSE_FAIL" || r.status === "TOO_SHORT");
const ok = results.length - fails.length;

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const byType = {};
for (const r of results) {
  if (!["A", "B", "C"].includes(r.status)) continue;
  byType[r.type] = byType[r.type] ?? { A: 0, B: 0, C: 0 };
  byType[r.type][r.status]++;
}

const summary = {
  total: results.length,
  analyzed: ok,
  A_fitImmediately: A.length,
  B_upTo3Fixes: B.length,
  C_doesNotFit: C.length,
  parseFail: fails.length,
  percentA: ((A.length / ok) * 100).toFixed(1),
  percentAB: (((A.length + B.length) / ok) * 100).toFixed(1),
  medianWidthSemitones: median(by((r) => r.status === "A" || r.status === "B" || r.status === "C").map((r) => r.width)),
  medianNoteCount: median(by((r) => ["A", "B", "C"].includes(r.status)).map((r) => r.noteCount)),
  tunesWithChords: by((r) => r.chordEls > 0).length,
  byType,
};

writeFileSync(OUT, JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 2));
console.log("\nПримеры A (сразу ложится):");
for (const r of A.slice(0, 8)) console.log(`  ${r.name} [${r.type}, ${r.key}] сдвиг ${r.shift}, ${r.noteCount} нот`);
console.log("\nХудшие из C:");
for (const r of [...C].sort((a, b) => b.badAccidentals + b.outOfRange - (a.badAccidentals + a.outOfRange)).slice(0, 6))
  console.log(`  ${r.name} [${r.type}, ${r.key}] вне гаммы: ${r.badAccidentals}, вне диапазона: ${r.outOfRange}`);
