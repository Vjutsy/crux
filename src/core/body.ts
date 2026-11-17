/**
 * Фізика тіла скелелаза: скелет з 4 кінцівками і розв'язувач пози.
 *
 * Досяжність зачепа визначається не радіусом, а тим, чи існує положення тулуба,
 * за якого всі кінцівки на своїх зачепах у межах довжини і з дотриманням правил тіла.
 * Координати світу: x праворуч, y вниз (0 — верх стіни).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Hold extends Point {
  /** Верхній зачіп: рука на ньому = стіну пройдено. */
  top?: boolean;
}

/** 0 — ліва рука, 1 — права рука, 2 — ліва нога, 3 — права нога. */
export type Limb = 0 | 1 | 2 | 3;
export const LIMBS: readonly Limb[] = [0, 1, 2, 3];
export const LIMB_NAMES: Record<Limb, string> = {
  0: 'ліва рука',
  1: 'права рука',
  2: 'ліва нога',
  3: 'права нога',
};
export const isHand = (k: Limb) => k < 2;

/** Індекс зачепа для кожної кінцівки; -1 — кінцівка висить. */
export type Contacts = [number, number, number, number];

export interface BodySpec {
  /** Довжина тулуба (від лінії плечей до лінії таза). */
  torso: number;
  arm: number;
  leg: number;
  /** Половина ширини плечей і таза. */
  shoulder: number;
  hip: number;
}

export const DEFAULT_BODY: BodySpec = { torso: 40, arm: 66, leg: 72, shoulder: 11, hip: 9 };

export const limbLength = (k: Limb, b: BodySpec = DEFAULT_BODY) => (isHand(k) ? b.arm : b.leg);

/** Точка кріплення кінцівки (плече або кульшовий суглоб) для центру тулуба c. */
export function anchor(c: Point, k: Limb, b: BodySpec = DEFAULT_BODY): Point {
  const side = k % 2 === 1 ? 1 : -1;
  return isHand(k) ? { x: c.x + side * b.shoulder, y: c.y - b.torso / 2 } : { x: c.x + side * b.hip, y: c.y + b.torso / 2 };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Запас, щоб кінцівка не була випрямлена «в струну». */
const REACH_SLACK = 0.97;
/** Наскільки стопа може бути вище кульшового суглоба. */
const FOOT_ABOVE_HIP = 6;
/** Наскільки нижче таза може опинитись кисть (у частках довжини руки). */
const HAND_BELOW_HIP = 0.25;
/** Допуск на перехрещення лівої і правої кінцівки. */
const CROSS_TOLERANCE = 18;
/** Мінімум точок опори. */
export const MIN_CONTACTS = 2;

/** Правила, що не залежать від положення тулуба. */
export function contactsAllowed(holds: readonly Hold[], c: Contacts): boolean {
  const used = c.filter((i) => i >= 0);
  if (used.length < MIN_CONTACTS) return false;
  const [lh, rh, lf, rf] = c;
  if (lh >= 0 && rh >= 0 && holds[lh]!.x > holds[rh]!.x + CROSS_TOLERANCE) return false;
  if (lf >= 0 && rf >= 0 && holds[lf]!.x > holds[rf]!.x + CROSS_TOLERANCE) return false;
  // Дві руки можуть перехопитися за один зачіп, інші пари — ні.
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (c[a]! >= 0 && c[a] === c[b] && !(a === 0 && b === 1)) return false;
  return true;
}

/** Чи підходить конкретне положення тулуба. */
export function poseValid(holds: readonly Hold[], c: Contacts, torso: Point, b: BodySpec = DEFAULT_BODY): boolean {
  for (const k of LIMBS) {
    const i = c[k];
    if (i < 0) continue;
    const h = holds[i]!;
    const s = anchor(torso, k, b);
    if (dist(h, s) > limbLength(k, b) * REACH_SLACK) return false;
    if (!isHand(k) && h.y < s.y - FOOT_ABOVE_HIP) return false;
    if (isHand(k) && h.y > torso.y + b.torso / 2 + b.arm * HAND_BELOW_HIP) return false;
  }
  return true;
}

export interface SolveOptions {
  /** Попереднє положення тулуба: шукаємо найближче до нього. */
  prev?: Point | null;
  /** Крок сітки пошуку (менше — точніше й повільніше). */
  step?: number;
  /** Радіус пошуку навколо центру мас зачепів. */
  radius?: number;
  body?: BodySpec;
}

/**
 * Шукає положення центру тулуба, за якого поза валідна.
 * Повертає null, якщо такої пози немає — тобто зачіп фізично недосяжний.
 */
export function solvePose(holds: readonly Hold[], c: Contacts, opts: SolveOptions = {}): Point | null {
  if (!contactsAllowed(holds, c)) return null;
  const { prev = null, step = 6, radius = 66, body = DEFAULT_BODY } = opts;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const i of c) {
    if (i < 0) continue;
    sx += holds[i]!.x;
    sy += holds[i]!.y;
    n++;
  }
  sx /= n;
  sy /= n;
  let best: Point | null = null;
  let bestCost = Infinity;
  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dy = -radius; dy <= radius; dy += step) {
      const p = { x: sx + dx, y: sy + dy };
      if (!poseValid(holds, c, p, body)) continue;
      // Ближче до попередньої пози; легка перевага нижчому тулубу (тіло «висить»).
      const cost = prev ? dist(p, prev) - p.y * 0.02 : Math.abs(dx) + Math.abs(dy);
      if (cost < bestCost) {
        bestCost = cost;
        best = p;
      }
    }
  }
  return best;
}

/** Чи може кінцівка k стати на зачіп target з поточної пози. Повертає нову позу тулуба або null. */
export function tryMove(
  holds: readonly Hold[],
  c: Contacts,
  k: Limb,
  target: number,
  opts: SolveOptions = {},
): { contacts: Contacts; torso: Point } | null {
  if (c[k] === target) return null;
  const next = c.slice() as Contacts;
  next[k] = target;
  const torso = solvePose(holds, next, opts);
  return torso ? { contacts: next, torso } : null;
}

/** Двосуглобовий IK: де опиниться лікоть/коліно. bendOut: -1 — згин ліворуч, 1 — праворуч. */
export function ikJoint(root: Point, end: Point, length: number, bendOut: 1 | -1): Point {
  const d = dist(root, end) || 1;
  const half = length / 2;
  const h = Math.sqrt(Math.max(0, half * half - (Math.min(d, length) / 2) ** 2));
  let nx = -(end.y - root.y) / d;
  let ny = (end.x - root.x) / d;
  if (nx * bendOut < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: (root.x + end.x) / 2 + nx * h, y: (root.y + end.y) / 2 + ny * h };
}

/** Куди малювати кінець кінцівки, що висить. */
export function danglingEnd(torso: Point, k: Limb, b: BodySpec = DEFAULT_BODY): Point {
  const s = anchor(torso, k, b);
  return { x: s.x + (k % 2 === 1 ? 6 : -6), y: s.y + limbLength(k, b) * 0.92 };
}
