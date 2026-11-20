import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WordGroup } from '../src/content/schema';
import { buildQuestion } from '../src/core/questions';
import { mulberry32 } from '../src/core/rng';

const dir = join(import.meta.dirname, '../src/content/sk');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('контент', () => {
  for (const f of files) {
    it(`${f}: відповідає схемі`, () => {
      const res = WordGroup.safeParse(JSON.parse(readFileSync(join(dir, f), 'utf8')));
      expect(res.success, res.success ? '' : res.error.message).toBe(true);
    });
    it(`${f}: у кожного питання 4 різні варіанти з правильною відповіддю`, () => {
      const g = WordGroup.parse(JSON.parse(readFileSync(join(dir, f), 'utf8')));
      const rng = mulberry32(3);
      for (const w of g.words) {
        for (const mode of ['choice-sk-ua', 'choice-ua-sk'] as const) {
          const q = buildQuestion(g, w, mode, rng);
          expect(new Set(q.options).size).toBe(4);
          expect(q.options).toContain(q.expected[0]);
        }
      }
    });
  }
});

describe('усі групи разом', () => {
  it('id слів унікальні між групами (ключі коробок Лейтнера)', () => {
    const ids = files.flatMap((f) => WordGroup.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))).words.map((w) => w.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('є 4 теми × рівні A1, A2 (рівня A0 немає)', () => {
    const keys = files.map((f) => f.replace('.json', '')).sort();
    const want = ['kuchyna', 'dom', 'mesto', 'cas'].flatMap((t) => [`${t}-a1`, `${t}-a2`]).sort();
    expect(keys).toEqual(want);
  });
  it('словацькі слова не повторюються між групами', () => {
    const sk = files.flatMap((f) => WordGroup.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))).words.map((w) => w.sk.toLowerCase()));
    expect(sk.length - new Set(sk).size).toBe(0);
  });
  it('у групі немає двох слів з однаковим перекладом', () => {
    for (const f of files) {
      const ua = WordGroup.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))).words.map((w) => w.ua);
      expect(ua.length - new Set(ua).size, f).toBe(0);
    }
  });
});
