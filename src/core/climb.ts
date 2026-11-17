/**
 * Логіка проходження однієї стіни без рендеру (детермінована, покрита тестами).
 *
 * Правила (погоджено із замовником):
 * - без таймерів; програш лише коли скінчились кроки, опора або досяжні зачепи;
 * - кожен рух кінцівкою коштує 1 крок; на звичайних зачепах питань немає;
 * - сині (бонусні) зачепи відкривають питання: правильна відповідь дає +3 кроки,
 *   неправильна — скелелаз усе одно перелазить, бонус згорає, картка відлітає;
 * - кожна 3-тя правильна відповідь поспіль дає ще +1 крок (комбо), помилка скидає комбо;
 * - втома = частка витрачених стартових кроків; при сильній втомі помилка може зірвати ногу.
 */
import { type Contacts, type Limb, LIMBS, type Point, anchor, isHand, limbLength, solvePose, tryMove } from './body';
import type { Wall } from './generator';
import type { Rng } from './rng';

export const MOVE_COST = 1;
export const BONUS_STEPS = 3;
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
  /** Бонусні зачепи, які ще не використані. */
  bonus: Set<number>;
  steps: number;
  startSteps: number;
  combo: number;
  correct: number;
  mistakes: number;
  moves: number;
  status: Status;
  pending: { limb: Limb; hold: number } | null;
  fallReason?: FallReason;
}

export type ClimbEvent =
  | { type: 'moved'; limb: Limb; hold: number }
  | { type: 'bonus'; steps: number }
  | { type: 'combo'; combo: number }
  | { type: 'burned'; hold: number }
  | { type: 'slipped'; limb: Limb }
  | { type: 'won' }
  | { type: 'fallen'; reason: FallReason };

/** Бюджет кроків: частка довжини еталонного маршруту — без правильних відповідей до вершини не дійти. */
export const stepBudget = (wall: Wall, factor: number) => Math.max(4, Math.ceil(wall.routeLength * factor));

export function startClimb(wall: Wall, startSteps: number): ClimbState {
  return {
    wall,
    contacts: wall.start.slice() as Contacts,
    torso: wall.startTorso,
    bonus: new Set(wall.bonus),
    steps: startSteps,
    startSteps,
    combo: 0,
    correct: 0,
    mistakes: 0,
    moves: 0,
    status: 'climbing',
    pending: null,
  };
}

export const fatigue = (s: ClimbState) => Math.max(0, Math.min(1, 1 - s.steps / s.startSteps));
export const isBonus = (s: ClimbState, i: number) => s.bonus.has(i);

/** Чи може кінцівка k стати на зачіп i прямо зараз. */
export function canReach(s: ClimbState, k: Limb, i: number): boolean {
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

/** Чи є хоч один можливий рух (з ранньою зупинкою — дешевше за reachableHolds). */
export function hasAnyMove(s: ClimbState): boolean {
  for (let i = 0; i < s.wall.holds.length; i++) for (const k of LIMBS) if (canReach(s, k, i)) return true;
  return false;
}

/** Автовибір кінцівки: та, що зараз найнижче (природний рух угору). */
export function autoLimb(s: ClimbState, i: number): Limb | null {
  const ks = limbsFor(s, i);
  if (!ks.length) return null;
  const y = (k: Limb) => (s.contacts[k] < 0 ? Infinity : s.wall.holds[s.contacts[k]]!.y);
  return ks.sort((a, b) => y(b) - y(a))[0]!;
}

function fall(s: ClimbState, reason: FallReason, events: ClimbEvent[]) {
  s.status = 'fallen';
  s.fallReason = reason;
  events.push({ type: 'fallen', reason });
}

function doMove(s: ClimbState, limb: Limb, hold: number, events: ClimbEvent[]) {
  const res = tryMove(s.wall.holds, s.contacts, limb, hold, { prev: s.torso });
  if (!res) return;
  s.contacts = res.contacts;
  s.torso = res.torso;
  s.moves++;
  events.push({ type: 'moved', limb, hold });
}

/** Після руху: вершина, кінець кроків або глухий кут. */
function settle(s: ClimbState, limb: Limb, hold: number, events: ClimbEvent[]) {
  if (s.status !== 'climbing') return;
  if (hold === s.wall.top && isHand(limb) && s.contacts[limb] === hold) {
    s.status = 'won';
    events.push({ type: 'won' });
  } else if (s.steps <= 0) fall(s, 'no-steps', events);
  else if (!hasAnyMove(s)) fall(s, 'stuck', events);
}

export type MoveResult = { kind: 'moved'; events: ClimbEvent[] } | { kind: 'question' } | { kind: 'invalid' };

/**
 * Гравець торкнувся зачепа. Звичайний — рух одразу (−1 крок).
 * Бонусний — крок списано, чекаємо відповідь на питання (`answer`).
 */
export function move(s: ClimbState, limb: Limb, hold: number): MoveResult {
  if (s.status !== 'climbing' || !canReach(s, limb, hold)) return { kind: 'invalid' };
  s.steps -= MOVE_COST;
  if (s.bonus.has(hold)) {
    s.pending = { limb, hold };
    s.status = 'question';
    return { kind: 'question' };
  }
  const events: ClimbEvent[] = [];
  doMove(s, limb, hold, events);
  settle(s, limb, hold, events);
  return { kind: 'moved', events };
}

export function answer(s: ClimbState, correct: boolean, rng: Rng): ClimbEvent[] {
  const events: ClimbEvent[] = [];
  if (s.status !== 'question' || !s.pending) return events;
  const { limb, hold } = s.pending;
  s.pending = null;
  s.status = 'climbing';
  s.bonus.delete(hold);

  if (correct) {
    s.correct++;
    s.combo++;
    s.steps += BONUS_STEPS;
    events.push({ type: 'bonus', steps: BONUS_STEPS });
    if (s.combo % COMBO_EVERY === 0) {
      s.steps += 1;
      events.push({ type: 'combo', combo: s.combo });
    }
    doMove(s, limb, hold, events);
  } else {
    s.mistakes++;
    s.combo = 0;
    events.push({ type: 'burned', hold });
    doMove(s, limb, hold, events);
    if (fatigue(s) >= SLIP_FATIGUE && rng() < SLIP_CHANCE) {
      const feet = ([2, 3] as Limb[]).filter((f) => s.contacts[f] >= 0 && f !== limb);
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
  settle(s, limb, hold, events);
  return events;
}

/** Зірки: за точність відповідей на бонусних зачепах. */
export function stars(s: ClimbState): 0 | 1 | 2 | 3 {
  if (s.status !== 'won') return 0;
  if (s.mistakes === 0) return 3;
  if (s.mistakes <= 2) return 2;
  return 1;
}
