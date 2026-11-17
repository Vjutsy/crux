/**
 * Логіка проходження однієї стіни без рендеру (детермінована, покрита тестами).
 *
 * Правила (погоджено з замовником):
 * - без таймерів; програш лише коли скінчились кроки, опора або досяжні зачепи;
 * - спроба (тап по зачепу) коштує 1 крок, правильна відповідь повертає 1,
 *   кожна 3-тя правильна поспіль дає ще +1 (комбо); помилка скидає комбо;
 * - помилка: зачіп блокується; при сильній втомі може зісковзнути нога;
 * - втома = частка витрачених кроків.
 */
import { type Contacts, type Limb, LIMBS, type Point, anchor, isHand, limbLength, solvePose, tryMove } from './body';
import type { Wall } from './generator';
import type { Rng } from './rng';

export const COMBO_EVERY = 3;
/** З якої втоми помилка може зірвати ногу. */
export const SLIP_FATIGUE = 0.6;
export const SLIP_CHANCE = 0.5;

export type Status = 'climbing' | 'question' | 'won' | 'fallen';
export type FallReason = 'no-steps' | 'slip' | 'stuck';

export interface ClimbState {
  wall: Wall;
  contacts: Contacts;
  torso: Point;
  blocked: Set<number>;
  steps: number;
  startSteps: number;
  combo: number;
  correct: number;
  mistakes: number;
  status: Status;
  pending: { limb: Limb; hold: number } | null;
  fallReason?: FallReason;
}

export type ClimbEvent =
  | { type: 'moved'; limb: Limb; hold: number }
  | { type: 'combo'; combo: number }
  | { type: 'blocked'; hold: number }
  | { type: 'slipped'; limb: Limb }
  | { type: 'won' }
  | { type: 'fallen'; reason: FallReason };

export function startClimb(wall: Wall, startSteps: number): ClimbState {
  return {
    wall,
    contacts: wall.start.slice() as Contacts,
    torso: wall.startTorso,
    blocked: new Set(),
    steps: startSteps,
    startSteps,
    combo: 0,
    correct: 0,
    mistakes: 0,
    status: 'climbing',
    pending: null,
  };
}

export const fatigue = (s: ClimbState) => Math.max(0, Math.min(1, 1 - s.steps / s.startSteps));

/** Чи може кінцівка k стати на зачіп i прямо зараз. */
export function canReach(s: ClimbState, k: Limb, i: number): boolean {
  if (s.blocked.has(i)) return false;
  // Швидкий відсів: зачіп явно далі, ніж кінцівка + можливий зсув тулуба.
  const h = s.wall.holds[i]!;
  const a = anchor(s.torso, k);
  if (Math.hypot(h.x - a.x, h.y - a.y) > limbLength(k) + 70) return false;
  return tryMove(s.wall.holds, s.contacts, k, i, { prev: s.torso }) !== null;
}

/** Кінцівки, які дістають до зачепа i. */
export function limbsFor(s: ClimbState, i: number): Limb[] {
  return LIMBS.filter((k) => canReach(s, k, i));
}

/** Усі зачепи, досяжні хоча б однією кінцівкою (або конкретною). */
export function reachableHolds(s: ClimbState, limb?: Limb): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.wall.holds.length; i++) {
    if (limb !== undefined ? canReach(s, limb, i) : limbsFor(s, i).length) out.push(i);
  }
  return out;
}

/** Автовибір кінцівки: та, що зараз найнижче (природний рух угору). */
export function autoLimb(s: ClimbState, i: number): Limb | null {
  const ks = limbsFor(s, i);
  if (!ks.length) return null;
  const y = (k: Limb) => (s.contacts[k] < 0 ? Infinity : s.wall.holds[s.contacts[k]]!.y);
  return ks.sort((a, b) => y(b) - y(a))[0]!;
}

/** Гравець торкнувся зачепа: витрачаємо крок і чекаємо відповідь. */
export function attempt(s: ClimbState, limb: Limb, hold: number): boolean {
  if (s.status !== 'climbing' || !canReach(s, limb, hold)) return false;
  s.steps -= 1;
  s.pending = { limb, hold };
  s.status = 'question';
  return true;
}

function fall(s: ClimbState, reason: FallReason, events: ClimbEvent[]) {
  s.status = 'fallen';
  s.fallReason = reason;
  events.push({ type: 'fallen', reason });
}

export function answer(s: ClimbState, correct: boolean, rng: Rng): ClimbEvent[] {
  const events: ClimbEvent[] = [];
  if (s.status !== 'question' || !s.pending) return events;
  const { limb, hold } = s.pending;
  s.pending = null;
  s.status = 'climbing';

  if (correct) {
    s.correct++;
    s.combo++;
    s.steps += 1;
    if (s.combo % COMBO_EVERY === 0) {
      s.steps += 1;
      events.push({ type: 'combo', combo: s.combo });
    }
    const res = tryMove(s.wall.holds, s.contacts, limb, hold, { prev: s.torso });
    if (res) {
      s.contacts = res.contacts;
      s.torso = res.torso;
      events.push({ type: 'moved', limb, hold });
    }
    if (hold === s.wall.top && isHand(limb)) {
      s.status = 'won';
      events.push({ type: 'won' });
      return events;
    }
  } else {
    s.mistakes++;
    s.combo = 0;
    s.blocked.add(hold);
    events.push({ type: 'blocked', hold });
    if (fatigue(s) >= SLIP_FATIGUE && rng() < SLIP_CHANCE) {
      const feet = ([2, 3] as Limb[]).filter((f) => s.contacts[f] >= 0);
      if (feet.length) {
        const f = feet[Math.floor(rng() * feet.length)]!;
        const next = s.contacts.slice() as Contacts;
        next[f] = -1;
        const torso = solvePose(s.wall.holds, next, { prev: s.torso });
        s.contacts = next;
        events.push({ type: 'slipped', limb: f });
        if (!torso) {
          fall(s, 'slip', events);
          return events;
        }
        s.torso = torso;
      }
    }
  }
  if (s.steps <= 0) fall(s, 'no-steps', events);
  else if (!reachableHolds(s).length) fall(s, 'stuck', events);
  return events;
}

/** Зірки: за точність (зекономлені кроки). */
export function stars(s: ClimbState): 0 | 1 | 2 | 3 {
  if (s.status !== 'won') return 0;
  if (s.mistakes === 0) return 3;
  if (s.mistakes <= 2) return 2;
  return 1;
}
