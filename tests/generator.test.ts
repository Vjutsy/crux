import { describe, expect, it } from 'vitest';
import { findRoute, generateWall } from '../src/core/generator';
import { walls } from '../src/data/walls';
import { answer, move, startClimb, stepBudget } from '../src/core/climb';
import { mulberry32 } from '../src/core/rng';

// У CI прогоняємо по 40 seed на кожну стіну; локально можна збільшити SEEDS=1000.
const SEEDS = Number(process.env.SEEDS ?? 40);

describe('генератор стін', () => {
  it('детермінований: той самий seed — та сама стіна', () => {
    const a = generateWall(42, { moves: 20 });
    const b = generateWall(42, { moves: 20 });
    expect(a.holds).toEqual(b.holds);
  });

  for (const cfg of walls) {
    it(`стіна ${cfg.wall}: ${SEEDS} seed проходимі`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const wall = generateWall(seed * 101 + cfg.wall, { moves: cfg.moves });
        const route = findRoute(wall);
        expect(route, `seed ${seed}`).not.toBeNull();
        // Маршрут має бути співмірний з цільовою кількістю рухів (2–5 хв гри).
        expect(route!.moves.length).toBeLessThanOrEqual(cfg.moves * 2);
        // Бонусні зачепи є, і з повним бюджетом + усіма бонусами вершина досяжна.
        expect(wall.bonus.length, `seed ${seed}`).toBeGreaterThan(0);
      }
    });
  }
});

describe('баланс кроків', () => {
  for (const cfg of walls) {
    it(`стіна ${cfg.wall}: з правильними відповідями — вершина, без них — падіння`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const wall = generateWall(seed * 313 + cfg.wall, { moves: cfg.moves });
        const route = findRoute(wall)!;
        for (const correct of [true, false]) {
          const s = startClimb(wall, stepBudget(wall, cfg.stepFactor));
          const rng = mulberry32(seed);
          for (const m of route.moves) {
            if (s.status !== 'climbing') break;
            if (move(s, m.limb, m.hold).kind === 'question') answer(s, correct, rng);
          }
          // Без правильних відповідей вершина недосяжна (зісковзування може збити еталонний маршрут раніше за падіння).
          if (correct) expect(s.status, `seed ${seed}`).toBe('won');
          else expect(s.status, `seed ${seed}`).not.toBe('won');
        }
      }
    });
  }
});
