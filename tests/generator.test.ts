import { describe, expect, it } from 'vitest';
import { findRoute, generateWall } from '../src/core/generator';
import { walls } from '../src/data/walls';

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
      }
    });
  }
});
