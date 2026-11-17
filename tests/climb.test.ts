import { describe, expect, it } from 'vitest';
import { BONUS_STEPS, answer, autoLimb, fatigue, move, reachableHolds, startClimb, stars, stepBudget } from '../src/core/climb';
import { findRoute, generateWall } from '../src/core/generator';
import { mulberry32 } from '../src/core/rng';

const wall = generateWall(7, { moves: 16 });
const route = findRoute(wall)!;
const rng = () => mulberry32(1);

/** Пройти еталонний маршрут, відповідаючи на бонусних зачепах `correct`. */
function play(startSteps: number, correct: boolean) {
  const s = startClimb(wall, startSteps);
  const r = rng();
  for (const m of route.moves) {
    if (s.status !== 'climbing') break;
    const res = move(s, m.limb, m.hold);
    if (res.kind === 'question') answer(s, correct, r);
  }
  return s;
}

describe('бонусні зачепи на стіні', () => {
  it('стоять на маршруті кожні 3–5 рухів, не на старті й не на вершині', () => {
    expect(wall.bonus.length).toBeGreaterThanOrEqual(Math.floor(route.moves.length / 5) - 1);
    for (const b of wall.bonus) {
      expect(b).not.toBe(wall.top);
      expect(wall.start).not.toContain(b);
    }
    expect(new Set(wall.bonus).size).toBe(wall.bonus.length);
  });
});

describe('кроки й питання', () => {
  it('звичайний зачіп: рух одразу, −1 крок, без питання', () => {
    const s = startClimb(wall, 10);
    const hold = reachableHolds(s).find((i) => !s.bonus.has(i))!;
    const res = move(s, autoLimb(s, hold)!, hold);
    expect(res.kind).toBe('moved');
    expect(s.steps).toBe(9);
    expect(s.status).toBe('climbing');
  });

  it('бонусний зачіп: питання; правильна відповідь +3, бонус використано', () => {
    const s = startClimb(wall, 100);
    const r = rng();
    for (const m of route.moves) {
      const before = s.steps;
      const res = move(s, m.limb, m.hold);
      if (res.kind === 'question') {
        expect(s.status).toBe('question');
        answer(s, true, r);
        expect(s.steps).toBeGreaterThanOrEqual(before - 1 + BONUS_STEPS);
        expect(s.bonus.has(m.hold)).toBe(false);
        expect(s.contacts).toContain(m.hold);
        return;
      }
    }
    throw new Error('на маршруті немає бонусного зачепа');
  });

  it('неправильна відповідь: скелелаз перелазить, бонус згорає, кроків не додається', () => {
    const s = startClimb(wall, 100);
    const r = rng();
    for (const m of route.moves) {
      const before = s.steps;
      if (move(s, m.limb, m.hold).kind === 'question') {
        answer(s, false, r);
        expect(s.steps).toBe(before - 1);
        expect(s.contacts).toContain(m.hold);
        expect(s.bonus.has(m.hold)).toBe(false);
        expect(s.combo).toBe(0);
        return;
      }
    }
  });

  it('усі відповіді правильні — бюджету стіни 1 досить, 3 зірки', () => {
    const s = play(stepBudget(wall, 0.9), true);
    expect(s.status).toBe('won');
    expect(stars(s)).toBe(3);
  });

  it('усі відповіді неправильні — бюджету не вистачає, падіння', () => {
    const s = play(stepBudget(wall, 0.9), false);
    expect(s.status).toBe('fallen');
  });

  it('втома росте з витратою кроків', () => {
    const s = startClimb(wall, 10);
    expect(fatigue(s)).toBe(0);
    s.steps = 4;
    expect(fatigue(s)).toBeCloseTo(0.6);
  });
});
