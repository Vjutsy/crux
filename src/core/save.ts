/** Локальне збереження прогресу (IndexedDB через idb-keyval). Без акаунтів. */
import { get, set } from 'idb-keyval';
import type { LeitnerBoxes } from './questions';

export interface Progress {
  version: 1;
  /** Найбільший відкритий номер стіни (стіни відкриваються по черзі). */
  unlockedWall: number;
  /** Найкращі зірки: ключ `${groupId}#${wall}`. */
  stars: Record<string, number>;
  boxes: LeitnerBoxes;
  streak: { lastDay: string; count: number };
}

const KEY = 'crux-progress';

export const emptyProgress = (): Progress => ({
  version: 1,
  unlockedWall: 1,
  stars: {},
  boxes: {},
  streak: { lastDay: '', count: 0 },
});

export async function loadProgress(): Promise<Progress> {
  try {
    const p = await get<Progress>(KEY);
    return p?.version === 1 ? p : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export async function saveProgress(p: Progress): Promise<void> {
  try {
    await set(KEY, p);
  } catch {
    /* приватний режим або заповнене сховище — гра працює далі без збереження */
  }
}

export const today = (d = new Date()) => d.toISOString().slice(0, 10);

/** Серія днів: +1, якщо грали вчора; скидається, якщо був пропуск. */
export function touchStreak(p: Progress, now = new Date()): Progress {
  const t = today(now);
  if (p.streak.lastDay === t) return p;
  const y = new Date(now);
  y.setUTCDate(y.getUTCDate() - 1);
  const count = p.streak.lastDay === today(y) ? p.streak.count + 1 : 1;
  return { ...p, streak: { lastDay: t, count } };
}
