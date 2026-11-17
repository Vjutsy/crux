/** Побудова питань із групи слів + проста система Лейтнера для слів з помилками. */
import type { Word, WordGroup } from '../content/schema';
import { type Rng, shuffle } from './rng';

export type QuestionMode = 'choice-sk-ua' | 'choice-ua-sk' | 'typing-ua-sk' | 'typing-sk-ua';

export interface Question {
  wordId: string;
  mode: QuestionMode;
  /** Що показуємо гравцю. */
  prompt: string;
  /** 4 варіанти для режимів вибору (порядок відповідає кнопкам a, b, c, d). */
  options?: string[];
  /** Правильна відповідь (перша) і прийнятні альтернативи. */
  expected: string[];
}

export function buildQuestion(group: WordGroup, word: Word, mode: QuestionMode, rng: Rng): Question {
  const toSk = mode === 'choice-ua-sk' || mode === 'typing-ua-sk';
  const prompt = toSk ? word.ua : word.sk;
  const expected = toSk ? [word.sk, ...(word.skAlt ?? [])] : [word.ua, ...(word.uaAlt ?? [])];
  if (mode.startsWith('typing')) return { wordId: word.id, mode, prompt, expected };
  // Дистрактори: та сама частина мови, інший переклад.
  const pick = (w: Word) => (toSk ? w.sk : w.ua);
  const others = group.words.filter((w) => w.id !== word.id && pick(w) !== pick(word));
  const samePos = shuffle(
    others.filter((w) => w.pos === word.pos),
    rng,
  );
  const rest = shuffle(
    others.filter((w) => w.pos !== word.pos),
    rng,
  );
  const distractors = [...samePos, ...rest].slice(0, 3).map(pick);
  return { wordId: word.id, mode, prompt, expected, options: shuffle([pick(word), ...distractors], rng) };
}

/** Коробки Лейтнера: 1 — слово часто плутають, 5 — вивчене. */
export type LeitnerBoxes = Record<string, number>;
const BOX_WEIGHT = [0, 8, 5, 3, 2, 1];

export function updateBox(boxes: LeitnerBoxes, wordId: string, correct: boolean): LeitnerBoxes {
  const cur = boxes[wordId] ?? 1;
  return { ...boxes, [wordId]: correct ? Math.min(5, cur + 1) : 1 };
}

/** Обирає наступне слово: слабкі частіше, без повторів серед останніх recentLimit. */
export function pickWord(group: WordGroup, boxes: LeitnerBoxes, recent: readonly string[], rng: Rng, recentLimit = 6): Word {
  const recentSet = new Set(recent.slice(-Math.min(recentLimit, group.words.length - 1)));
  const pool = group.words.filter((w) => !recentSet.has(w.id));
  const weights = pool.map((w) => BOX_WEIGHT[boxes[w.id] ?? 1]!);
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

/** Режим питання з урахуванням частки вписування на цій стіні. */
export function pickMode(typingShare: number, rng: Rng): QuestionMode {
  if (rng() < typingShare) return rng() < 0.7 ? 'typing-ua-sk' : 'typing-sk-ua';
  return rng() < 0.5 ? 'choice-sk-ua' : 'choice-ua-sk';
}
