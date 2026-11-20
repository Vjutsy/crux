/** Локальне збереження прогресу (IndexedDB через idb-keyval). Без акаунтів. */
import { get, set } from 'idb-keyval';
import type { LeitnerBoxes, SeenLog } from './questions';

export interface Progress {
  version: 1;
  /** Найбільший відкритий номер стіни (стіни відкриваються по черзі). */
  unlockedWall: number;
  /** Найкращі зірки: ключ `${groupId}#${wall}`. */
  stars: Record<string, number>;
  boxes: LeitnerBoxes;
  /** Коли яке слово показували востаннє (для чергування слів) і лічильник усіх питань. */
  seen: SeenLog;
  asked: number;
  streak: { lastDay: string; count: number };
  settings: { sound: boolean; music: boolean; climber: string };
  /** Навчання на першій стіні вже пройдене. */
  tutorialDone: boolean;
  /** Вступ при першому відкритті гри вже показано. */
  introSeen: boolean;
}

const KEY = 'crux-progress';

export const emptyProgress = (): Progress => ({
  version: 1,
  unlockedWall: 1,
  stars: {},
  boxes: {},
  seen: {},
  asked: 0,
  streak: { lastDay: '', count: 0 },
  settings: { sound: true, music: true, climber: 'iva' },
  tutorialDone: false,
  introSeen: false,
});

export async function loadProgress(): Promise<Progress> {
  try {
    const p = await get<Partial<Progress>>(KEY);
    if (p?.version !== 1) return emptyProgress();
    // Поля, додані пізніше, заповнюємо значеннями за замовчуванням.
    const base = emptyProgress();
    return { ...base, ...p, settings: { ...base.settings, ...p.settings } } as Progress;
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
