import { describe, expect, it } from 'vitest';
import { SLIP_COST, answer, move, startClimb, stepBudget, type ClimbEvent } from '../src/core/climb';
import { tryMove } from '../src/core/body';
import { findRoute, generateWall } from '../src/core/generator';
import { hashSeed, mulberry32 } from '../src/core/rng';
import walls from '../src/data/walls.json';

const GROUPS = ['kuchyna-a1', 'kuchyna-a2', 'dom-a1', 'dom-a2', 'mesto-a1', 'mesto-a2', 'cas-a1', 'cas-a2'];

/** Бот іде за підказками гри й відповідає неправильно на кожне питання. */
function playAllWrong(
  group: string,
  wallNo: number,
  rngSeed: number,
  onSlip?: (before: Snapshot, after: Snapshot, ev: ClimbEvent[]) => void,
) {
  const cfg = walls[wallNo - 1]!;
  const wall = generateWall(hashSeed(group, cfg.wall, ''), { moves: cfg.moves });
  const s = startClimb(wall, stepBudget(wall, cfg.stepFactor));
  const rng = mulberry32(rngSeed);
  for (let i = 0; i < 300 && s.status === 'climbing'; i++) {
    const m = findRoute({ holds: wall.holds, top: wall.top, start: s.contacts, startTorso: s.torso })?.moves[0];
    if (!m) break;
    if (move(s, m.limb, m.hold).kind !== 'question') continue;
    const before = snap(s);
    const ev = answer(s, false, rng);
    if (ev.some((e) => e.type === 'slipped')) onSlip?.(before, snap(s), ev);
  }
  return s;
}
type Snapshot = { steps: number; torsoY: number; contacts: number[]; holdsY: number[]; movedTorsoY: number };
const snap = (s: ReturnType<typeof startClimb>): Snapshot => ({
  // Поза одразу після перелазу на бонусний зачіп (answer() робить цей хід перед зісковзуванням).
  movedTorsoY: s.pending ? (tryMove(s.wall.holds, s.contacts, s.pending.limb, s.pending.hold, { prev: s.torso })?.torso.y ?? NaN) : NaN,
  steps: s.steps,
  torsoY: s.torso.y,
  contacts: [...s.contacts],
  holdsY: s.contacts.map((i) => (i >= 0 ? s.wall.holds[i]!.y : NaN)),
});

describe('зісковзування ноги', () => {
  it('нога з’їжджає вниз або повисає, тіло не піднімається, мінус кроки', () => {
    let slips = 0;
    for (const g of GROUPS.slice(0, 4))
      for (let r = 0; r < 4; r++)
        playAllWrong(g, 2, r, (before, after, ev) => {
          slips++;
          const e = ev.find((x) => x.type === 'slipped') as { limb: number };
          const f = e.limb;
          expect(f).toBeGreaterThanOrEqual(2);
          // Після перелазу на бонусний зачіп ця нога не мінялась; тепер вона нижче або висить.
          const y = after.holdsY[f]!;
          if (after.contacts[f]! >= 0) expect(y).toBeGreaterThan(before.holdsY[f]!);
          expect(after.torsoY).toBeGreaterThanOrEqual(before.movedTorsoY - 0.001);
        });
    expect(slips).toBeGreaterThan(0);
  });

  it(`коштує ${SLIP_COST} кроки`, () => {
    let checked = 0;
    for (const g of GROUPS)
      for (let r = 0; r < 3; r++)
        playAllWrong(g, 1, r, (before, after) => {
          // answer() з неправильною відповіддю кроків не додає; різниця — лише зісковзування.
          expect(before.steps - after.steps).toBe(SLIP_COST);
          checked++;
        });
    expect(checked).toBeGreaterThan(0);
  });
});

describe('баланс: без правильних відповідей до вершини не дійти', () => {
  it('бот за підказками з самими помилками майже ніколи не доходить (стіни 1–2, усі групи)', () => {
    let wins = 0;
    let games = 0;
    for (const g of GROUPS)
      for (const w of [1, 2])
        for (let r = 0; r < 5; r++) {
          games++;
          if (playAllWrong(g, w, r).status === 'won') wins++;
        }
    // До виправлення (20.11.2026) — близько 20%. Зараз — поодинокі випадки.
    expect(wins / games).toBeLessThanOrEqual(0.05);
  }, 120_000);
});
