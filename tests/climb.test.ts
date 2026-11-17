import { describe, expect, it } from 'vitest';
import { answer, attempt, autoLimb, fatigue, reachableHolds, startClimb, stars } from '../src/core/climb';
import { findRoute, generateWall } from '../src/core/generator';
import { mulberry32 } from '../src/core/rng';

const wall = generateWall(7, { moves: 16 });
const rng = () => mulberry32(1);

describe('кроки, комбо, програш', () => {
  it('спроба −1, правильна +1, кожна 3-тя поспіль ще +1', () => {
    const s = startClimb(wall, 5);
    const route = findRoute(wall)!;
    const r = rng();
    for (const m of route.moves.slice(0, 3)) {
      expect(attempt(s, m.limb, m.hold)).toBe(true);
      answer(s, true, r);
    }
    expect(s.steps).toBe(6);
    expect(s.combo).toBe(3);
  });

  it('помилка блокує зачіп і скидає комбо', () => {
    const s = startClimb(wall, 5);
    const hold = reachableHolds(s)[0]!;
    attempt(s, autoLimb(s, hold)!, hold);
    answer(s, false, rng());
    expect(s.blocked.has(hold)).toBe(true);
    expect(s.combo).toBe(0);
    expect(s.steps).toBe(4);
    expect(fatigue(s)).toBeCloseTo(0.2);
  });

  it('скінчились кроки — падіння', () => {
    const s = startClimb(wall, 2);
    const r = rng();
    while (s.status === 'climbing') {
      const hold = reachableHolds(s)[0]!;
      attempt(s, autoLimb(s, hold)!, hold);
      answer(s, false, r);
    }
    expect(s.status).toBe('fallen');
  });

  it('проходження маршруту без помилок — 3 зірки', () => {
    const s = startClimb(wall, 5);
    const r = rng();
    for (const m of findRoute(wall)!.moves) {
      attempt(s, m.limb, m.hold);
      answer(s, true, r);
    }
    expect(s.status).toBe('won');
    expect(stars(s)).toBe(3);
  });
});
