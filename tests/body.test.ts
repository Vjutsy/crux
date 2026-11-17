import { describe, expect, it } from 'vitest';
import { type Contacts, type Hold, DEFAULT_BODY, anchor, poseValid, solvePose, tryMove } from '../src/core/body';

// Базова поза: руки над головою, ноги внизу.
const holds: Hold[] = [
  { x: 124, y: 390 },
  { x: 178, y: 384 },
  { x: 128, y: 505 },
  { x: 172, y: 500 },
  { x: 150, y: 352 }, // 4: трохи вище рук — досяжний для руки
  { x: 150, y: 150 }, // 5: дуже високо — недосяжний
  { x: 128, y: 400 }, // 6: на рівні плечей — нозі не можна
  { x: 300, y: 450 }, // 7: далеко вбік
];
const start: Contacts = [0, 1, 2, 3];

describe('розв’язувач пози', () => {
  it('знаходить стартову позу', () => {
    const torso = solvePose(holds, start);
    expect(torso).not.toBeNull();
    expect(poseValid(holds, start, torso!)).toBe(true);
  });

  it('рука дістає зачіп трохи вище', () => {
    expect(tryMove(holds, start, 0, 4)).not.toBeNull();
  });

  it('рука не дістає зачіп далеко вгорі', () => {
    expect(tryMove(holds, start, 0, 5)).toBeNull();
    expect(tryMove(holds, start, 1, 5)).toBeNull();
  });

  it('нога не стає вище стегна', () => {
    const r = tryMove(holds, start, 2, 6);
    if (r) {
      const hip = anchor(r.torso, 2);
      expect(holds[6]!.y).toBeGreaterThanOrEqual(hip.y - 6);
    }
  });

  it('кінцівки не розтягуються довше за свою довжину', () => {
    expect(tryMove(holds, start, 3, 7)).toBeNull();
    const torso = solvePose(holds, start)!;
    for (const k of [0, 1] as const) {
      const s = anchor(torso, k);
      const h = holds[start[k]]!;
      expect(Math.hypot(h.x - s.x, h.y - s.y)).toBeLessThanOrEqual(DEFAULT_BODY.arm);
    }
  });

  it('потрібно щонайменше 2 точки опори', () => {
    expect(solvePose(holds, [0, -1, -1, -1])).toBeNull();
  });

  it('руки не перехрещуються', () => {
    expect(solvePose(holds, [1, 0, 2, 3])).toBeNull();
  });
});
