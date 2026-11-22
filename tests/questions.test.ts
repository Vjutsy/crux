import { describe, expect, it } from 'vitest';
import type { WordGroup } from '../src/content/schema';
import { type LeitnerBoxes, type SeenLog, pickWord, updateBox } from '../src/core/questions';
import { mulberry32, randomSeed } from '../src/core/rng';

const group: WordGroup = {
  id: 't-a1',
  themeId: 't',
  theme: 'Тест',
  cefr: 'A1',
  words: Array.from({ length: 100 }, (_, i) => ({ id: `w${i}`, sk: `sk${i}`, ua: `ua${i}`, pos: 'noun' as const })),
};

/** Імітує гру: стіни по 8 питань, лічильник і журнал показів переходять між стінами. */
function play(questions: number, correct: (id: string) => boolean, seed = 1) {
  const rng = mulberry32(seed);
  let seen: SeenLog = {};
  let boxes: LeitnerBoxes = {};
  let asked = 0;
  const order: string[] = [];
  let recent: string[] = [];
  for (let q = 0; q < questions; q++) {
    if (q % 8 === 0) recent = [];
    const w = pickWord(group, boxes, seen, recent, rng);
    recent.push(w.id);
    seen = { ...seen, [w.id]: ++asked };
    boxes = updateBox(boxes, w.id, correct(w.id));
    order.push(w.id);
  }
  return order;
}

describe('чергування слів', () => {
  it('без помилок за 100 питань показано всі 100 слів групи, жодного повтору', () => {
    const order = play(100, () => true);
    expect(new Set(order).size).toBe(100);
  });

  it('другий круг бере з найдавніших слів', () => {
    const order = play(200, () => true);
    const firstHalf = new Set(order.slice(0, 50));
    // Перші 20 слів другого круга — з тих, що показувались у першій половині першого.
    expect(order.slice(100, 120).every((id) => firstHalf.has(id))).toBe(true);
  });

  it('слова йдуть випадково: різні ігри починаються з різних слів, не за порядком у файлі', () => {
    const starts = [1, 2, 3, 4, 5, 6].map((seed) => play(10, () => true, seed).join(','));
    expect(new Set(starts).size).toBe(6);
    const firstWords = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => play(1, () => true, seed)[0]);
    expect(new Set(firstWords).size).toBeGreaterThanOrEqual(6);
    // Перші 10 слів — не просто перші 10 у списку групи.
    const first10 = play(10, () => true, 1);
    expect(first10.filter((id) => Number(id.slice(1)) < 10).length).toBeLessThan(5);
  });

  it('слово з помилкою повертається раніше за решту, але не одразу', () => {
    const order = play(60, (id) => id !== order0);
    const firstAt = order.indexOf(order0);
    const again = order.indexOf(order0, firstAt + 1);
    expect(again).toBeGreaterThan(firstAt + 3);
    expect(again).toBeLessThan(60);
  });

  it('навіть із помилками нових слів більшість', () => {
    const order = play(40, () => false);
    expect(new Set(order).size).toBeGreaterThanOrEqual(25);
  });

  it('у межах стіни останні 6 слів не повторюються', () => {
    const rng = mulberry32(5);
    const seen: SeenLog = {};
    const recent: string[] = [];
    for (let i = 0; i < 6; i++) recent.push(pickWord(group, {}, seen, recent, rng).id);
    expect(new Set(recent).size).toBe(6);
  });
});

// Перше слово, яке гра обирає з seed 1, — його й «плутаємо» в тесті вище.
const order0 = play(1, () => true)[0]!;

describe('randomSeed', () => {
  it('щоразу інший', () => {
    expect(new Set(Array.from({ length: 20 }, () => randomSeed())).size).toBe(20);
  });
});
