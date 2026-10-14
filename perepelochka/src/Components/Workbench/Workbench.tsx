"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { melodyFromAbc } from "@/lib/music/abc";
import { convertMelody, type ConversionResult } from "@/lib/music/convert";
import {
  BUILTIN_PROFILES,
  CUSTOM_PROFILE_ID,
  PEREPELOCHKA,
  deserializeProfile,
  midiToName,
  parseTuning,
  profileInfo,
  serializeProfile,
  stringIndexForMidi,
  toCustomProfile,
  tuningToText,
  withGeometry,
  withTuning,
  type InstrumentProfile,
  type SheetGeometry,
} from "@/lib/music/instrument";
import { inspectMidi, melodyFromMidi, type MidiFileInfo } from "@/lib/music/midi";
import type { Melody } from "@/lib/music/types";
import { layoutMelody, type SheetLayoutResult } from "@/lib/sheet/layout";
import { DEMOS } from "@/lib/music/demos";
import SheetSvg from "@/Components/Sheet/SheetSvg";
import Quail from "@/Components/Quail/Quail";
import { ToneContext } from "@/contexts/toneContext";
import styles from "./workbench.module.css";


const PROFILE_STORAGE_KEY = "perepelochka:custom-profile";
const FIT_ONE_STORAGE_KEY = "perepelochka:fit-one-sheet";

const EMPTY_SHEET = { index: 0, startBeat: 0, beats: 0, windowStartX: 0, notes: [], bars: [] };

interface ScheduledNote {
  t: number;
  i: number;
}

interface GeometryField {
  key: keyof SheetGeometry;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const GEOMETRY_GROUPS: { title: string; fields: GeometryField[] }[] = [
  {
    title: "🎻 Струны",
    fields: [
      { key: "lengthMinMm", label: "Верхняя (короткая)", min: 30, max: 250, step: 1, unit: "мм" },
      { key: "lengthMaxMm", label: "Басовая (длинная)", min: 50, max: 330, step: 1, unit: "мм" },
      { key: "heightMm", label: "Размах струн (высота)", min: 40, max: 300, step: 1, unit: "мм" },
      { key: "verticalMarginMm", label: "Отступ струн от краёв", min: 0, max: 40, step: 1, unit: "мм" },
    ],
  },
  {
    title: "📄 Бумага и отступы",
    fields: [
      { key: "leftPadMm", label: "Отступ первой ноты", min: 0, max: 40, step: 1, unit: "мм" },
      { key: "rightPadMm", label: "Отступ ноты от конца струны", min: 0, max: 40, step: 1, unit: "мм" },
      { key: "paperMarginMm", label: "Поле бумаги (линия реза)", min: 0, max: 30, step: 1, unit: "мм" },
    ],
  },
  {
    title: "🎵 Ноты",
    fields: [
      { key: "mmPerBeat", label: "Шаг нот (мм на четверть) — меньше шаг, меньше карточек", min: 2, max: 30, step: 0.5, unit: "мм" },
    ],
  },
];

const Workbench: React.FC = () => {
  const toneContext = React.useContext(ToneContext);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [layout, setLayout] = useState<SheetLayoutResult | null>(null);
  const [midiInfo, setMidiInfo] = useState<MidiFileInfo | null>(null);
  const midiBufferRef = useRef<ArrayBuffer | null>(null);
  const midiNameRef = useRef<string>("");
  const [trackIndex, setTrackIndex] = useState(0);
  const [tempo, setTempo] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abcText, setAbcText] = useState("");
  const [withCalibration, setWithCalibration] = useState(true);
  // режим «всё на одну карточку» — шаг подбирается автоматически
  const [fitOneSheet, setFitOneSheet] = useState(false);
  const [hotString, setHotString] = useState<number | null>(null);
  const hotStringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // модель инструмента: пресет или «своя» (редактируется и сохраняется в браузере)
  const [profile, setProfile] = useState<InstrumentProfile>(PEREPELOCHKA);
  const [tuningText, setTuningText] = useState(tuningToText(PEREPELOCHKA.tuning));
  const [tuningError, setTuningError] = useState<string | null>(null);

  const sourceRef = useRef<Melody | null>(null);
  const scheduleRef = useRef<ScheduledNote[] | null>(null);
  const rafRef = useRef<number | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    scheduleRef.current = null;
    // Transport.cancel реально снимает намеченные на будущее ноты,
    // поэтому после «Стоп» и нового запуска не звучит ничего лишнего
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    if (partRef.current) {
      partRef.current.dispose();
      partRef.current = null;
    }
    toneContext.releaseAll();
    setPlaying(false);
    setActiveNote(null);
  }, [toneContext]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const runPipeline = useCallback(
    (melody: Melody, prof: InstrumentProfile, fit: boolean) => {
      const converted = convertMelody(melody, prof);
      const sheets = layoutMelody(converted.melody, prof, { fitOneSheet: fit });
      stopPlayback();
      setResult(converted);
      setLayout(sheets);
      setTempo(Math.round(melody.tempo ?? 100));
      setError(null);
    },
    [stopPlayback],
  );

  // при смене модели пересчитываем уже загруженную мелодию
  const runPipelineRef = useRef(runPipeline);
  useEffect(() => {
    runPipelineRef.current = runPipeline;
  }, [runPipeline]);
  useEffect(() => {
    const src = sourceRef.current;
    if (src) runPipelineRef.current(src, profile, fitOneSheet);
    setTuningText(tuningToText(profile.tuning));
    setTuningError(null);
  }, [profile, fitOneSheet]);

  // режим раскладки сохраняется в браузере
  useEffect(() => {
    localStorage.setItem(FIT_ONE_STORAGE_KEY, fitOneSheet ? "1" : "0");
  }, [fitOneSheet]);
  useEffect(() => {
    setFitOneSheet(localStorage.getItem(FIT_ONE_STORAGE_KEY) === "1");
  }, []);

  // своя модель сохраняется в браузере
  useEffect(() => {
    if (profile.id === CUSTOM_PROFILE_ID) {
      localStorage.setItem(PROFILE_STORAGE_KEY, serializeProfile(profile));
    }
  }, [profile]);
  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (saved) {
      const parsed = deserializeProfile(saved);
      if (parsed) setProfile(parsed);
    }
  }, []);

  const importAbc = useCallback(
    (text: string, name?: string) => {
      try {
        const melody = melodyFromAbc(text, { name });
        sourceRef.current = melody;
        runPipeline(melody, profile, fitOneSheet);
      } catch (e) {
        setResult(null);
        setLayout(null);
        setError(e instanceof Error ? e.message : "Не удалось разобрать ABC");
      }
    },
    [runPipeline, profile, fitOneSheet],
  );

  const importMidiTrack = useCallback(
    (buffer: ArrayBuffer, index: number, name: string) => {
      try {
        const melody = melodyFromMidi(buffer, { trackIndex: index, fileName: name, name });
        sourceRef.current = melody;
        runPipeline(melody, profile, fitOneSheet);
      } catch (e) {
        setResult(null);
        setLayout(null);
        setError(e instanceof Error ? e.message : "Не удалось разобрать MIDI");
      }
    },
    [runPipeline, profile, fitOneSheet],
  );

  const onFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      try {
        if (lower.endsWith(".mid") || lower.endsWith(".midi")) {
          const buffer = await file.arrayBuffer();
          const info = inspectMidi(buffer);
          midiBufferRef.current = buffer;
          midiNameRef.current = file.name;
          setMidiInfo(info);
          setTrackIndex(info.candidates[0].index);
          importMidiTrack(buffer, info.candidates[0].index, file.name);
        } else {
          const text = await file.text();
          setAbcText(text);
          importAbc(text, file.name.replace(/\.[^.]*$/, ""));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка чтения файла");
      }
    },
    [importAbc, importMidiTrack],
  );

  const play = useCallback(async () => {
    if (!result) return;
    await Tone.start();
    stopPlayback(); // чистый старт: ничего от прошлых запусков не осталось

    const secPerBeat = 60 / tempo;
    // ноты планируются через Transport/Part: их можно честно отменить по «Стоп».
    // ВАЖНО: time у Part — в секундах, поэтому переводим доли через secPerBeat
    const part = new Tone.Part(
      (time, ev: { note: string; dur: number }) => {
        toneContext.triggerAttackRelease(ev.note, Math.max(0.08, ev.dur * secPerBeat * 0.92), time);
      },
      result.melody.notes.map((n) => ({
        time: n.startBeats * secPerBeat,
        note: midiToName(n.midi),
        dur: n.durBeats,
      })),
    );
    partRef.current = part;
    part.start(0);
    Tone.Transport.start();

    const schedule: ScheduledNote[] = result.melody.notes.map((n, i) => ({
      t: n.startBeats * secPerBeat,
      i,
    }));
    scheduleRef.current = schedule;
    setPlaying(true);
    const tick = () => {
      const sched = scheduleRef.current;
      if (!sched) return;
      const pos = Tone.Transport.seconds;
      let cur: number | null = null;
      for (const s of sched) {
        if (s.t <= pos + 0.02) cur = s.i;
        else break;
      }
      setActiveNote(cur);
      if (pos > sched[sched.length - 1].t + 0.8) {
        stopPlayback();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [result, tempo, toneContext, stopPlayback]);

  const onStringClick = useCallback(
    (midi: number) => {
      toneContext.triggerAttackRelease(midiToName(midi), "8n");
      const idx = stringIndexForMidi(profile, midi);
      if (idx !== null) {
        setHotString(profileInfo(profile).stringCount - 1 - idx);
        if (hotStringTimer.current) clearTimeout(hotStringTimer.current);
        hotStringTimer.current = setTimeout(() => setHotString(null), 650);
      }
    },
    [toneContext, profile],
  );

  // --- модель и геометрия ---
  const [drafts, setDrafts] = useState<Partial<Record<keyof SheetGeometry, string>>>({});

  const setGeometryField = (key: keyof SheetGeometry, value: number) => {
    setProfile(withGeometry(toCustomProfile(profile), { [key]: value }));
  };

  const clearDraft = (key: keyof SheetGeometry) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });

  const onGeometryChange = (f: GeometryField, raw: string) => {
    if (raw.trim() === "") {
      // стёртое поле не применяем: ждём ввода
      setDrafts((d) => ({ ...d, [f.key]: raw }));
      return;
    }
    const v = Number(raw);
    if (Number.isFinite(v) && v >= f.min && v <= f.max) {
      // в диапазоне — применяем сразу
      setGeometryField(f.key, v);
      clearDraft(f.key);
    } else if (Number.isFinite(v)) {
      // вне диапазона (например, первая цифра «1» числа «12»): держим черновик,
      // к границам приведём при уходе из поля
      setDrafts((d) => ({ ...d, [f.key]: raw }));
    }
  };

  const onGeometryBlur = (f: GeometryField) => {
    const draft = drafts[f.key];
    if (draft !== undefined && draft.trim() !== "") {
      const v = Number(draft);
      if (Number.isFinite(v)) {
        setGeometryField(f.key, Math.min(Math.max(v, f.min), f.max));
      }
    }
    clearDraft(f.key);
  };

  const applyTuning = () => {
    try {
      const tuning = parseTuning(tuningText);
      setTuningError(null);
      setProfile(withTuning(toCustomProfile(profile), tuning));
    } catch (e) {
      setTuningError(e instanceof Error ? e.message : "Не разобрать строй");
    }
  };

  const resetProfile = () => {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    setProfile(PEREPELOCHKA);
  };

  const isCustom = profile.id === CUSTOM_PROFILE_ID;

  const verdictText =
    result?.verdict === "fit"
      ? "ложится без правок"
      : result?.verdict === "fixed"
        ? `${result.warnings.length} автоправок`
        : result
          ? `сильно упрощена (${result.warnings.length} правок)`
          : "";

  const activeSheetNote =
    layout && activeNote !== null
      ? layout.sheets.find((s) => s.notes.some((n) => n.noteIndex === activeNote)) ?? null
      : null;

  return (
    <div className={styles.screen}>
      <header className={styles.hero}>
        <div className={styles.heroNotes} aria-hidden="true">
          <span className="n1">♪</span>
          <span className="n2">♫</span>
          <span className="n3">♪</span>
          <span className="n4">♩</span>
          <span className="n5">♫</span>
        </div>
        <Quail className={styles.heroQuail} singing={playing} />
        <div>
          <h1>Перепёлочка</h1>
          <p>
            Превращаем MIDI и ABC в весёлые листочки для цимбал: загрузи мелодию, послушай и
            распечатай. Все размеры карточки считаются формулами из параметров модели.
          </p>
        </div>
      </header>

      <section className={`${styles.card} ${styles.s1}`}>
        <h2>
          <span className={styles.chip}>1</span> Мелодия
        </h2>
        <div className={styles.inputRow}>
          <label className={styles.fileLabel}>
            📁 Загрузить файл (.mid / .abc)
            <input
              type="file"
              accept=".mid,.midi,.abc,.txt"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              hidden
            />
          </label>
          {DEMOS.map((d) => (
            <button key={d.title} className={styles.demoButton} onClick={() => importAbc(d.abc, d.title)}>
              <span className={styles.demoEmoji}>{d.emoji}</span> {d.title}
            </button>
          ))}
        </div>
        <div className={styles.abcRow}>
          <textarea
            className={styles.abcInput}
            placeholder="…или вставь ABC-нотацию (X:1 … K:G …)"
            value={abcText}
            onChange={(e) => setAbcText(e.target.value)}
            rows={4}
          />
          <button
            className={styles.primaryButton}
            disabled={!abcText.trim()}
            onClick={() => importAbc(abcText)}
          >
            Конвертировать
          </button>
        </div>

        {midiInfo && midiBufferRef.current && (
          <div className={styles.trackRow}>
            <label>
              Трек мелодии:{" "}
              <select
                value={trackIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setTrackIndex(idx);
                  importMidiTrack(midiBufferRef.current!, idx, midiNameRef.current);
                }}
              >
                {midiInfo.candidates.map((c) => (
                  <option key={c.index} value={c.index}>
                    {c.index}: {c.name ?? "без имени"} — {c.noteCount} нот, монофоничность{" "}
                    {Math.round(c.monoFraction * 100)}%
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </section>

      {!result && !error && (
        <section className={`${styles.card} ${styles.invite}`}>
          <Quail className={styles.inviteQuail} flip happy singing />
          <div>
            <h3>Начни с примера!</h3>
            <p>
              Нажми на мелодию выше — перепёлочка сыграет её и покажет листочек. Потом загрузишь
              свой MIDI или вставишь ABC-нотацию.
            </p>
          </div>
        </section>
      )}

      <section className={`${styles.card} ${styles.s2}`}>
        <h2>
          <span className={styles.chip}>2</span> Модель инструмента
        </h2>
        <div className={styles.inputRow}>
          <label className={styles.modelLabel}>
            Модель:{" "}
            <select
              className={styles.selectPretty}
              value={profile.id}
              onChange={(e) => {
                const found = BUILTIN_PROFILES.find((p) => p.id === e.target.value);
                if (found) {
                  localStorage.removeItem(PROFILE_STORAGE_KEY);
                  setProfile(found);
                }
              }}
            >
              {BUILTIN_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {isCustom && <option value={CUSTOM_PROFILE_ID}>{profile.name}</option>}
            </select>
          </label>
          {isCustom && (
            <button className={styles.demoButton} onClick={resetProfile}>
              ♻️ Сбросить к «Перепёлочке»
            </button>
          )}
        </div>
        <p className={styles.hint}>
          Размеры — приблизительные до калибровки: распечатай калибровочный лист, приложи под
          струны и подгони числа. Правка любого поля превращает модель в «свою» и сохраняется в
          браузере.
        </p>
        {GEOMETRY_GROUPS.map((group) => (
          <div key={group.title} className={styles.geometryGroup}>
            <div className={styles.groupTitle}>{group.title}</div>
            <div className={styles.geometryGrid}>
              {group.fields.map((f) => (
                <label key={f.key} className={styles.geometryField}>
                  <span>
                    {f.label}
                    {f.unit ? `, ${f.unit}` : ""}
                  </span>
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    disabled={fitOneSheet && f.key === "mmPerBeat"}
                    value={
                      fitOneSheet && f.key === "mmPerBeat" && layout
                        ? layout.mmPerBeat.toFixed(1)
                        : (drafts[f.key] ?? profile.geometry[f.key])
                    }
                    onChange={(e) => onGeometryChange(f, e.target.value)}
                    onBlur={() => onGeometryBlur(f)}
                  />
                </label>
              ))}
            </div>
            {group.title.includes("Ноты") && (
              <label className={styles.fitOneLabel}>
                <input
                  type="checkbox"
                  checked={fitOneSheet}
                  onChange={(e) => setFitOneSheet(e.target.checked)}
                />
                Всё на одну карточку — шаг подбирается сам
              </label>
            )}
          </div>
        ))}
        <div className={styles.tuningRow}>
          <label className={styles.geometryField}>
            <span>Строй (от басовой к верхней, например G4, A4, B4…)</span>
            <textarea
              className={styles.tuningInput}
              rows={2}
              value={tuningText}
              onChange={(e) => setTuningText(e.target.value)}
              onBlur={applyTuning}
            />
          </label>
          <button className={styles.demoButton} onClick={applyTuning}>
            Применить строй
          </button>
        </div>
        {tuningError && <p className={styles.error}>{tuningError}</p>}
      </section>

      {result && layout && (
        <>
          <section className={`${styles.card} ${styles.s3}`}>
            <h2>
              <span className={styles.chip}>3</span> Результат
            </h2>
            <p className={styles.verdict}>
              <strong>{result.melody.name}</strong> — {verdictText}.{" "}
              {result.shift === 0
                ? "Транспонирование не потребовалось."
                : `Транспонирование: ${result.shift > 0 ? "+" : ""}${result.shift} полутонов.`}{" "}
              Карточек: {layout.sheets.length}.
              {fitOneSheet ? ` Шаг подобран автоматически: ${layout.mmPerBeat.toFixed(1)} мм/четверть.` : ""}{" "}
              {fitOneSheet && layout.mmPerBeat < 4.5
                ? "⚠️ Плотно: точки почти соприкасаются — можно отключить режим и взять пару карточек."
                : ""}{" "}
              Слушай и проверяй, затем печатай.
            </p>
            {result.warnings.length > 0 && (
              <ul className={styles.warnings}>
                {result.warnings.map((w, i) => (
                  <li key={i}>
                    <button className={styles.warningLink} onClick={() => setActiveNote(w.noteIndex)}>
                      {w.kind === "accidental" &&
                        `Нота ${w.noteIndex + 1}: ${midiToName(w.fromMidi)} вне гаммы — заменена на ${midiToName(w.toMidi ?? w.fromMidi)}`}
                      {w.kind === "range" &&
                        `Нота ${w.noteIndex + 1}: ${midiToName(w.fromMidi)} вне диапазона — сыграна октавой (${midiToName(w.toMidi ?? w.fromMidi)})`}
                      {w.kind === "dense" && `Нота ${w.noteIndex + 1}: очень короткая (${midiToName(w.fromMidi)})`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${styles.card} ${styles.s4}`}>
            <h2>
              <span className={styles.chip}>4</span> Предпросмотр
            </h2>
            <div className={styles.controls}>
              <button className={styles.primaryButton} onClick={playing ? stopPlayback : play}>
                {playing ? "Стоп" : "▶ Слушать"}
              </button>
              <label className={styles.tempoLabel}>
                Темп: {tempo} BPM
                <input
                  type="range"
                  min={40}
                  max={180}
                  value={tempo}
                  disabled={playing}
                  onChange={(e) => setTempo(Number(e.target.value))}
                />
              </label>
              <button className={styles.printButton} onClick={() => window.print()}>
                🖨 Печать
              </button>
              <label className={styles.tempoLabel}>
                <input
                  type="checkbox"
                  checked={withCalibration}
                  onChange={(e) => setWithCalibration(e.target.checked)}
                />
                Калибровочный лист
              </label>
            </div>
            <div className={styles.previewWrap}>
              <div className={styles.sheetsRow}>
                {layout.sheets.map((sheet) => (
                  <div key={sheet.index} className={styles.sheetWrap}>
                    <SheetSvg
                      sheet={sheet}
                      layout={layout}
                      profile={profile}
                      title={result.melody.name}
                      sheetCount={layout.sheets.length}
                      activeNoteIndex={activeNote}
                      hotStringFromTop={hotString}
                      decor
                      onStringClick={onStringClick}
                    />
                  </div>
                ))}
              </div>
              <Quail
                className={`${styles.conductor} ${playing ? styles.conductorOn : ""}`}
                singing={playing}
                happy={playing}
              />
            </div>
            <p className={styles.hint}>
              🖱 Клик по струне — звучит её нота. Расстояние между точками = длительность ноты,
              цвет = такт.
              {activeSheetNote ? ` Играет нота на карточке ${activeSheetNote.index + 1}.` : ""}
            </p>
          </section>
        </>
      )}

      {/* печатная версия */}
      <div className={styles.printArea}>
        {withCalibration && (
          <div className={styles.printPage}>
            <SheetSvg
              sheet={EMPTY_SHEET}
              layout={{ sheets: [], mmPerBeat: 12, totalBeats: 0 }}
              profile={profile}
              title="Калибровка"
              sheetCount={1}
              calibration
            />
          </div>
        )}
        {layout?.sheets.map((sheet) => (
          <div className={styles.printPage} key={`p${sheet.index}`}>
            <SheetSvg
              sheet={sheet}
              layout={layout}
              profile={profile}
              title={result?.melody.name ?? ""}
              sheetCount={layout.sheets.length}
            />
          </div>
        ))}
      </div>

      <footer className={styles.footer}>
        <span>🎵 Перепёлочка — листочки для цимбал из MIDI и ABC</span>
        <span className={styles.footerSoft}>играй с удовольствием!</span>
      </footer>
    </div>
  );
};

export default Workbench;
