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

/** Коли слово показували востаннє: номер питання з лічильника `asked` (між стінами й сесіями). */
export type SeenLog = Record<string, number>;

/** Частка питань, що повертають слово з помилкою, поки в групі ще є нові слова. */
export const REVIEW_SHARE = 0.25;
/** Коли нових слів не лишилось: беремо випадкове з найдавнішої третини показаних (щонайменше з 4). */
const OLD_SHARE = 1 / 3;

/**
 * Обирає наступне слово так, щоб слова чергувались: спершу ті, яких ще не було, потім ті,
 * що показувались найдавніше; серед них — випадково. За ~100 питань група проходиться повністю, без повторів,
 * а порядок щоразу інший.
 * Слова з помилкою (коробка 1) повертаються раніше: приблизно кожне 4-те питання.
 * Останні `recentLimit` слів цієї стіни не повторюються ніколи.
 */
export function pickWord(group: WordGroup, boxes: LeitnerBoxes, seen: SeenLog, recent: readonly string[], rng: Rng, recentLimit = 6): Word {
  const recentSet = new Set(recent.slice(-Math.min(recentLimit, group.words.length - 1)));
  const pool = group.words.filter((w) => !recentSet.has(w.id));
  const age = (w: Word) => seen[w.id] ?? -Infinity;
  const weak = pool.filter((w) => seen[w.id] !== undefined && (boxes[w.id] ?? 1) <= 1).sort((a, b) => age(a) - age(b));
  if (weak.length > 0 && rng() < REVIEW_SHARE) return weak[0]!;
  // Найдавніші (або ще не показані) — на початку; при рівності — легші коробки пізніше.
  const ordered = [...pool].sort((a, b) => age(a) - age(b) || BOX_WEIGHT[boxes[b.id] ?? 1]! - BOX_WEIGHT[boxes[a.id] ?? 1]!);
  // Ще не показані — усі рівноймовірно (а не за порядком у файлі), тож кожна гра починається з різних слів.
  const unseen = ordered.filter((w) => seen[w.id] === undefined);
  const candidates = unseen.length > 0 ? unseen : ordered.slice(0, Math.max(4, Math.ceil(ordered.length * OLD_SHARE)));
  return candidates[Math.floor(rng() * candidates.length)]!;
}

/** Режим питання з урахуванням частки вписування на цій стіні. */
export function pickMode(typingShare: number, rng: Rng): QuestionMode {
  if (rng() < typingShare) return rng() < 0.7 ? 'typing-ua-sk' : 'typing-sk-ua';
  return rng() < 0.5 ? 'choice-sk-ua' : 'choice-ua-sk';
}
