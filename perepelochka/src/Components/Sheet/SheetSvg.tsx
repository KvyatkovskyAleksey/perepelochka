"use client";

import React from "react";
import {
  midiToName,
  profileInfo,
  stringLine,
  type InstrumentProfile,
} from "@/lib/music/instrument";
import { noteRadiusMm, type Sheet, type SheetLayoutResult } from "@/lib/sheet/layout";
import styles from "./sheet.module.css";

interface SheetSvgProps {
  sheet: Sheet;
  layout: SheetLayoutResult;
  profile: InstrumentProfile;
  title: string;
  sheetCount: number;
  /** Индекс активной (звучащей) ноты — для подсветки. */
  activeNoteIndex?: number | null;
  /** Подсвеченная струна (например, только что нажатая). */
  hotStringFromTop?: number | null;
  /** Калибровочный лист: только струны, подписи и линейка. */
  calibration?: boolean;
  /** Декоративный корпус инструмента вокруг карточки (только для экрана). */
  decor?: boolean;
  /** Клик по струне (мм-геометрия). */
  onStringClick?: (midi: number) => void;
}

const MM_PER_PX = 96 / 25.4; // CSS-пикселей в миллиметре

/** Цвета нот по тактам: каждый такт — свой цвет, легче не терять место. */
const BAR_COLORS = [
  { fill: "#e85d4a", stroke: "#c2432f" }, // коралловый
  { fill: "#f2a93b", stroke: "#d18a16" }, // солнечный
  { fill: "#58b368", stroke: "#3c9450" }, // травяной
  { fill: "#4da8da", stroke: "#2f86bd" }, // небесный
  { fill: "#9b72cf", stroke: "#7c53b2" }, // сиреневый
  { fill: "#f07ba4", stroke: "#cc5a85" }, // розовый
];

export function barColor(bar: number): { fill: string; stroke: string } {
  return BAR_COLORS[((bar % BAR_COLORS.length) + BAR_COLORS.length) % BAR_COLORS.length];
}

/* ── геометрия корпуса ─────────────────────────────────── */

const BODY_MM = 20; // ширина деревянной рамы вокруг карточки
// раскладка каймы от края корпуса внутрь: колки (центр 7 мм от края, запас до края 4,4 мм),
// затем зазор 2,7 мм, затем дечка (центр 14 мм от края)
const BRIDGE_OUT_MM = 14; // дечка: отступ центра от края корпуса
const PIN_OUT_MM = 7; // колок: отступ центра от края корпуса
const BODY_RADIUS_MM = 9; // скругление углов корпуса

interface BodyGeometry {
  yTop: number;
  yBass: number;
  /** Полуширина на уровне крайних струн. */
  a: number;
  b: number;
  /** Полуширина на высоте y вдоль линии концов струн. */
  halfAt: (y: number) => number;
  cutM: number;
  bodyM: number;
  /**
   * Контур с постоянным ГОРИЗОНТАЛЬНЫМ отступом out от линии концов струн
   * и вертикальным расширением vOff. Все стороны строго параллельны линии
   * концов струн, поэтому колки никогда не пересекают край.
   */
  polyFor: (out: number, vOff: number) => [number, number][];
}

function bodyGeometry(profile: InstrumentProfile): BodyGeometry {
  const n = profileInfo(profile).stringCount;
  const top = stringLine(profile, 0);
  const bass = stringLine(profile, n - 1);
  const yTop = top.y0;
  const yBass = bass.y0;
  const a = top.x1;
  const b = bass.x1;
  const cutM = profile.geometry.paperMarginMm;
  const bodyM = cutM + BODY_MM;
  const halfAt = (y: number) => a + ((b - a) * (y - yTop)) / (yBass - yTop);
  const polyFor = (out: number, vOff: number): [number, number][] => {
    const topHalf = halfAt(yTop - vOff) + out;
    const botHalf = halfAt(yBass + vOff) + out;
    return [
      [-topHalf, yTop - vOff],
      [topHalf, yTop - vOff],
      [botHalf, yBass + vOff],
      [-botHalf, yBass + vOff],
    ];
  };
  return { yTop, yBass, a, b, halfAt, cutM, bodyM, polyFor };
}

/** Многоугольник со скруглёнными углами как SVG-path. */
function roundedPath(pts: [number, number][], r: number): string {
  const n = pts.length;
  const norm = (x: number, y: number): [number, number] => {
    const len = Math.hypot(x, y) || 1;
    return [x / len, y / len];
  };
  let d = "";
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const [x2, y2] = pts[(i + 2) % n];
    const v10 = norm(x0 - x1, y0 - y1);
    const v12 = norm(x2 - x1, y2 - y1);
    const ax = x1 + v10[0] * r;
    const ay = y1 + v10[1] * r;
    const bx = x1 + v12[0] * r;
    const by = y1 + v12[1] * r;
    d += i === 0 ? `M ${ax} ${ay}` : `L ${ax} ${ay}`;
    d += ` Q ${x1} ${y1} ${bx} ${by}`;
  }
  return d + " Z";
}

const SheetSvg: React.FC<SheetSvgProps> = ({
  sheet,
  layout,
  profile,
  title,
  sheetCount,
  activeNoteIndex = null,
  hotStringFromTop = null,
  calibration = false,
  decor = false,
  onStringClick,
}) => {
  const n = profileInfo(profile).stringCount;
  const info = profileInfo(profile);
  const lines = Array.from({ length: n }, (_, i) => stringLine(profile, i));
  const g = bodyGeometry(profile);
  const cutPts = g.polyFor(g.cutM, g.cutM);
  const cutPoints = cutPts.map(([x, y]) => `${x},${y}`).join(" ");
  const bodyPts = g.polyFor(g.bodyM, g.bodyM);
  const active = sheet.notes.find((note) => note.noteIndex === activeNoteIndex) ?? null;
  const hotString = hotStringFromTop ?? active?.stringFromTop ?? null;

  // границы используемых струн — для тактовых линий и заголовка
  const topUsed = sheet.notes.length ? Math.min(...sheet.notes.map((no) => no.stringFromTop)) : 0;
  const bottomUsed = sheet.notes.length ? Math.max(...sheet.notes.map((no) => no.stringFromTop)) : n - 1;

  // траектория «соедини точки» по нотам карточки
  const pathPoints = sheet.notes.map((note) => `${note.x},${note.y}`).join(" ");

  const pad = decor ? 5 : 4; // поле viewBox за контуром (экранное)
  const vbLeft = decor ? -(g.halfAt(g.yBass + g.bodyM) + g.bodyM) - pad : -(g.halfAt(g.yBass + g.cutM) + g.cutM) - pad;
  const vbTop = (decor ? g.yTop - g.bodyM : cutPts[0][1]) - pad;
  const vbWidth = -2 * vbLeft + 2 * pad;
  const vbHeight = (decor ? g.yBass + g.bodyM : cutPts[2][1]) - vbTop + 2 * pad;

  // концы струн у колков (в декоративном корпусе струны длиннее карточки)
  const stringEnd = (y: number) => g.halfAt(y) + g.bodyM - PIN_OUT_MM;

  return (
    <svg
      data-testid="sheet-svg"
      className={styles.sheet}
      viewBox={`${vbLeft} ${vbTop} ${vbWidth} ${vbHeight}`}
      style={{ width: `${vbWidth * MM_PER_PX}px` }}
      role="img"
      aria-label={`Карточка ${sheet.index + 1}: ${title}`}
    >
      <defs>
        <linearGradient id={`wood-${profile.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eec98f" />
          <stop offset="0.55" stopColor="#dcae72" />
          <stop offset="1" stopColor="#c48f52" />
        </linearGradient>
        <radialGradient id={`pin-${profile.id}`} cx="0.35" cy="0.35" r="0.9">
          <stop offset="0" stopColor="#f4f4f7" />
          <stop offset="1" stopColor="#a9a9b6" />
        </radialGradient>
      </defs>

      {decor && (
        <>
          {/* деревянный корпус */}
          <path d={roundedPath(bodyPts, BODY_RADIUS_MM)} fill={`url(#wood-${profile.id})`} stroke="#9a6b35" strokeWidth="1.2" />
          {/* волокна дерева */}
          {[0.45, 0.72].map((f, i) => {
            const y = g.yBass + g.bodyM * f;
            const w = g.halfAt(y) + g.bodyM - 4;
            return (
              <path key={`gb${i}`} d={`M ${-w} ${y} C ${-w / 2} ${y - 2.4}, ${w / 2} ${y + 2.4}, ${w} ${y}`} className={styles.grain} />
            );
          })}
          {(() => {
            const y = g.yTop - g.bodyM * 0.5;
            const w = g.halfAt(y) + g.bodyM - 4;
            return <path d={`M ${-w} ${y} C ${-w / 2} ${y - 2}, ${w / 2} ${y + 2}, ${w} ${y}`} className={styles.grain} />;
          })()}
          {/* дечки (полоски под струнами у краёв): строго параллельны линии
              концов струн — смещение считается на высоте самих концов отрезка */}
          {[1, -1].map((side) => {
            const off = g.bodyM - BRIDGE_OUT_MM;
            const y1b = g.yTop - g.bodyM + 7;
            const y2b = g.yBass + g.bodyM - 7;
            const x1 = side * (g.halfAt(y1b) + off);
            const x2 = side * (g.halfAt(y2b) + off);
            return (
              <line key={`br${side}`} x1={x1} y1={y1b} x2={x2} y2={y2b} className={styles.bridge} />
            );
          })}
          {/* тень бумажной карточки на дереве */}
          <polygon points={cutPoints} transform="translate(1.6 2)" fill="rgba(74,59,42,0.18)" />
        </>
      )}

      {/* бумага */}
      <polygon points={cutPoints} className={styles.paper} />
      {/* линия реза: на экране в корпусе она деликатнее */}
      <polygon points={cutPoints} className={decor ? styles.cutSoft : styles.cut} />

      {decor && (
        <>
          {/* колки на концах струн — под струнами, чтобы струна «приходила» в колок */}
          {lines.map((line, i) => {
            const end = stringEnd(line.y0);
            return (
              <g key={`p${i}`}>
                <circle cx={-end} cy={line.y0} r={2.6} fill={`url(#pin-${profile.id})`} stroke="#7d7d8c" strokeWidth="0.35" />
                <circle cx={end} cy={line.y0} r={2.6} fill={`url(#pin-${profile.id})`} stroke="#7d7d8c" strokeWidth="0.35" />
              </g>
            );
          })}
        </>
      )}

      {/* струны: в корпусе тянутся до колков, на карточке — до её краёв */}
      {lines.map((line, i) => {
        const end = decor ? stringEnd(line.y0) : line.x1;
        return (
          <line
            key={`s${i}`}
            x1={-end}
            y1={line.y0}
            x2={end}
            y2={line.y1}
            className={i === hotString ? styles.stringHot : styles.string}
            onClick={onStringClick ? () => onStringClick(info.stringMidis[n - 1 - i]) : undefined}
          />
        );
      })}

      {/* подписи нот у левого конца каждой струны (на бумаге) */}
      {lines.map((line, i) => (
        <text key={`t${i}`} x={line.x0 + 1.5} y={line.y0 + 1} className={styles.tuneLabel}>
          {midiToName(info.stringMidis[n - 1 - i])}
        </text>
      ))}

      {!calibration && (
        <>
          {/* тактовые линии: между крайними используемыми струнами */}
          {sheet.bars.map((bar, bi) => {
            const topY = lines[topUsed].y0;
            const botY = lines[bottomUsed].y0;
            return (
              <g key={`b${bi}`}>
                <line x1={bar.x} y1={topY} x2={bar.x} y2={botY} className={styles.bar} />
                <text x={bar.x - 1} y={topY - 1.2} className={styles.barLabel}>
                  {bar.label}
                </text>
              </g>
            );
          })}

          {/* траектория */}
          {pathPoints && <polyline points={pathPoints} className={styles.path} />}

          {/* ноты — цвет по такту */}
          {sheet.notes.map((note) => {
            const color = barColor(note.bar);
            const isActive = note.noteIndex === activeNoteIndex;
            return (
              <circle
                key={note.noteIndex}
                data-testid={`note-${note.noteIndex}`}
                cx={note.x}
                cy={note.y}
                r={noteRadiusMm(note.durBeats) * (isActive ? 1.25 : 1)}
                fill={isActive ? "#ff6b57" : color.fill}
                stroke={isActive ? "#c2432f" : color.stroke}
                className={isActive ? styles.noteActive : styles.note}
              />
            );
          })}
        </>
      )}

      {/* заголовок и номер карточки */}
      <text x={lines[topUsed].x0 + 2} y={lines[topUsed].y0 - 1.5} className={styles.title}>
        {title}
      </text>
      {!calibration && sheetCount > 1 && (
        <text x={lines[n - 1].x1 - 2} y={lines[n - 1].y0 + 5} className={styles.pageNo} textAnchor="end">
          {sheet.index + 1}/{sheetCount}
        </text>
      )}

      {decor && (
        <>
          {/* гравировка на дереве */}
          <text x={0} y={g.yBass + g.bodyM - 6} textAnchor="middle" className={styles.engraving}>
            ♪ Перепёлочка
          </text>
        </>
      )}

      {/* калибровочная линейка: 50 мм по центру */}
      {calibration && (
        <g>
          <line
            x1={-25}
            y1={profile.geometry.heightMm - 2}
            x2={25}
            y2={profile.geometry.heightMm - 2}
            className={styles.ruler}
          />
          {[-25, -15, -5, 5, 15, 25].map((mm) => (
            <line
              key={mm}
              x1={mm}
              y1={profile.geometry.heightMm - 4}
              x2={mm}
              y2={profile.geometry.heightMm - 2}
              className={styles.ruler}
            />
          ))}
          <text x={28} y={profile.geometry.heightMm - 1} className={styles.barLabel}>
            50 мм — проверь масштаб линейки
          </text>
        </g>
      )}
    </svg>
  );
};

export default SheetSvg;
