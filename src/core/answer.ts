/** Перевірка вписаної відповіді: лагідно на ранніх стінах, суворіше на пізніх. */

export interface CheckOptions {
  /** З 6-ї стіни діакритика обов'язкова (lyžica ≠ lyzica). */
  requireDiacritics: boolean;
  /** Слова від цієї довжини прощають 1 одрук. */
  typoMinLength?: number;
}

export type CheckResult =
  /** Збіг повністю. */
  | 'exact'
  /** Зараховано, але показуємо правильну форму (без діакритики або з одруком). */
  | 'accepted'
  | 'wrong';

const basic = (s: string) => s.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[’'`]/g, "'");
const stripMarks = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');

/** Відстань Дамерау–Левенштейна (оптимальне вирівнювання рядків). */
export function editDistance(a: string, b: string): number {
  const A = [...a];
  const B = [...b];
  const d: number[][] = Array.from({ length: A.length + 1 }, (_, i) => [i, ...Array<number>(B.length).fill(0)]);
  for (let j = 1; j <= B.length; j++) d[0]![j] = j;
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[A.length]![B.length]!;
}

export function checkTyped(input: string, expected: readonly string[], opts: CheckOptions): CheckResult {
  const typoMin = opts.typoMinLength ?? 6;
  const got = basic(input);
  if (!got) return 'wrong';
  let best: CheckResult = 'wrong';
  for (const raw of expected) {
    const exp = basic(raw);
    if (got === exp) return 'exact';
    const g = opts.requireDiacritics ? got : stripMarks(got);
    const e = opts.requireDiacritics ? exp : stripMarks(exp);
    if (g === e) best = 'accepted';
    else if ([...e].length >= typoMin && editDistance(g, e) <= 1) best = 'accepted';
  }
  return best;
}

/** Словацькі літери з діакритикою для екранних кнопок. */
export const SK_DIACRITICS = ['á', 'ä', 'č', 'ď', 'é', 'í', 'ĺ', 'ľ', 'ň', 'ó', 'ô', 'ŕ', 'š', 'ť', 'ú', 'ý', 'ž'] as const;
