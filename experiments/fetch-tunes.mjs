// Скачивает случайную выборку мелодий с The Session API (https://thesession.org/api)
// Использование: node fetch-tunes.mjs [количество] [файл вывода]
// Вежливость к API: пауза 300 мс между запросами.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const COUNT = Number(process.argv[2] ?? 100);
const OUT = process.argv[3] ?? "data/session-tunes.json";
const MAX_ID = 26000; // примерно текущее число мелодий на сайте
const DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTune(id) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://thesession.org/tunes/${id}?format=json`, {
        headers: { "User-Agent": "perepelochka-experiment/0.1 (personal research)" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 1) return null;
      await sleep(500);
    }
  }
}

// детерминированный "случайный" выбор id, чтобы эксперимент был воспроизводим
function sampleIds(count, max) {
  const ids = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  while (ids.length < count) {
    const id = 1 + Math.floor(rand() * max);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

const tunes = [];
const failed = [];
for (const id of sampleIds(COUNT + 40, MAX_ID)) {
  if (tunes.length >= COUNT) break;
  try {
    const t = await fetchTune(id);
    if (!t || !t.settings?.length) {
      failed.push(id);
    } else {
      // берём самую популярную настройку (первую в списке)
      const s = t.settings[0];
      tunes.push({
        id: t.id,
        name: t.name,
        type: t.type,
        tunebooks: t.tunebooks, // прокси популярности
        key: s.key,
        meter: s.meter,
        abc: s.abc,
      });
      process.stdout.write(`\r${tunes.length}/${COUNT} (последняя: ${t.name.slice(0, 40)})`);
    }
  } catch (e) {
    failed.push(id);
  }
  await sleep(DELAY_MS);
}
console.log(`\nГотово: ${tunes.length} мелодий, ${failed.length} пропущено`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(tunes, null, 1));
console.log(`Сохранено в ${OUT}`);
