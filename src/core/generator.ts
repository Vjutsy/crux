/**
 * Процедурна генерація стіни з seed.
 *
 * 1. «Хребет» маршруту — драбина зачепів ліворуч-праворуч з кроком, меншим за руку.
 * 2. Обманки й резервні гілки (рівномірне розсіювання з мінімальною відстанню).
 * 3. Перевірка «тілом»: пошук по позах (ліва/права рука, ліва/права нога) має дійти до вершини.
 * 4. Бонусні (сині) зачепи ставимо на знайдений маршрут кожні 3–5 рухів: лише на них з'являються питання.
 */
import { type Contacts, type Hold, type Limb, LIMBS, anchor, isHand, limbLength, solvePose, tryMove, type Point } from './body';
import { mulberry32, type Rng } from './rng';

export const WALL_WIDTH = 300;
/** Як часто на маршруті синій бонусний зачіп: кожні 2–3 рухи (20.11; раніше 3–5). */
export const BONUS_EVERY: [number, number] = [2, 3];
/** Скільки пікселів висоти припадає на один рух кінцівкою (з плейтестів прототипу). */
const PX_PER_MOVE = 23;
const BASE_HEIGHT = 140;
const HOLD_DENSITY = 46 / 534;
const MIN_HOLD_GAP = 30;

export interface Wall {
  seed: number;
  width: number;
  height: number;
  holds: Hold[];
  start: Contacts;
  startTorso: Point;
  top: number;
  /** Бонусні (сині) зачепи: правильна відповідь на них дає кроки. */
  bonus: number[];
  /** Довжина еталонного маршруту в рухах — від неї рахується бюджет кроків. */
  routeLength: number;
}

export interface WallParams {
  /** Цільова кількість рухів кінцівками до вершини. */
  moves: number;
  /** Відстань між бонусними зачепами на маршруті, у рухах [від, до]. */
  bonusEvery?: [number, number];
}

function layout(seed: number, moves: number): Omit<Wall, 'startTorso' | 'bonus' | 'routeLength'> {
  const rng: Rng = mulberry32(seed);
  const height = Math.round(BASE_HEIGHT + moves * PX_PER_MOVE);
  const H = height;
  const holds: Hold[] = [
    { x: 124, y: H - 144 }, // ліва рука
    { x: 178, y: H - 150 }, // права рука
    { x: 128, y: H - 29 }, // ліва нога
    { x: 172, y: H - 34 }, // права нога
  ];
  // Проміжні зачепи для перших кроків ногами.
  for (let y = H - 64; y > H - 134; y -= 34) holds.push({ x: 150 + (rng() - 0.5) * 60, y });
  // Хребет-драбина.
  let y = H - 150;
  let mid = 150;
  let side = -1;
  while (y > 90) {
    y -= 30 + rng() * 12;
    mid = Math.max(85, Math.min(215, mid + (rng() - 0.5) * 40));
    holds.push({ x: mid + side * (18 + rng() * 24), y });
    side *= -1;
  }
  const top = holds.length;
  holds.push({ x: Math.max(90, Math.min(210, mid)), y: 46, top: true });
  // Обманки й резервні гілки.
  const target = Math.round(H * HOLD_DENSITY);
  for (let tries = 0; holds.length < target && tries < target * 15; tries++) {
    const h = { x: 22 + rng() * (WALL_WIDTH - 44), y: 70 + rng() * (H - 104) };
    if (holds.every((o) => Math.hypot(o.x - h.x, o.y - h.y) > MIN_HOLD_GAP)) holds.push(h);
  }
  return { seed, width: WALL_WIDTH, height, holds, start: [0, 1, 2, 3], top };
}

export interface RouteResult {
  /** Послідовність рухів (кінцівка, зачіп). */
  moves: { limb: Limb; hold: number }[];
  /** Індекси зачепів, які використав маршрут. */
  used: Set<number>;
}

/**
 * Жадібний пошук по позах тіла (best-first): чи можна дійти рукою до вершини.
 * Використовується і генератором, і тестами, і підказками в навчанні.
 */
export function findRoute(
  wall: Pick<Wall, 'holds' | 'start' | 'top' | 'startTorso'>,
  blocked: ReadonlySet<number> = new Set(),
  maxExpansions = 3000,
): RouteResult | null {
  const { holds, top } = wall;
  type Node = { c: Contacts; torso: Point; path: { limb: Limb; hold: number }[]; score: number };
  const handY = (c: Contacts) => Math.min(...[c[0], c[1]].filter((i) => i >= 0).map((i) => holds[i]!.y));
  const open: Node[] = [{ c: wall.start, torso: wall.startTorso, path: [], score: handY(wall.start) }];
  const seen = new Set<string>([wall.start.join(',')]);
  for (let exp = 0; open.length && exp < maxExpansions; exp++) {
    open.sort((a, b) => a.score - b.score);
    const node = open.shift()!;
    for (const k of LIMBS) {
      const s = anchor(node.torso, k);
      const reach = limbLength(k) + 40;
      for (let i = 0; i < holds.length; i++) {
        if (blocked.has(i) || node.c[k] === i) continue;
        const h = holds[i]!;
        if (Math.abs(h.x - s.x) > reach || Math.abs(h.y - s.y) > reach) continue;
        // Рухаємось переважно вгору: ноги й руки не спускаються далеко вниз.
        const cur = node.c[k] >= 0 ? holds[node.c[k]]!.y : Infinity;
        if (h.y > cur + 20) continue;
        const res = tryMove(holds, node.c, k, i, { prev: node.torso });
        if (!res) continue;
        const key = res.contacts.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const path = [...node.path, { limb: k, hold: i }];
        if (i === top && isHand(k)) {
          return { moves: path, used: new Set(path.map((m) => m.hold)) };
        }
        open.push({ c: res.contacts, torso: res.torso, path, score: handY(res.contacts) + path.length * 4 });
      }
    }
  }
  return null;
}

/** Обирає бонусні зачепи на маршруті: кожні 3–5 рухів, не стартові й не вершина. */
export function pickBonus(
  route: RouteResult,
  wall: Pick<Wall, 'start' | 'top'>,
  rng: Rng,
  every: [number, number] = BONUS_EVERY,
): number[] {
  const [lo, hi] = every;
  const bonus: number[] = [];
  const span = () => lo + Math.floor(rng() * (hi - lo + 1));
  for (let i = span() - 1; i < route.moves.length - 1; i += span()) {
    // Якщо потрапили на непридатний зачіп — беремо найближчий наступний хід маршруту.
    for (let j = i; j < route.moves.length - 1; j++) {
      const h = route.moves[j]!.hold;
      if (h !== wall.top && !wall.start.includes(h) && !bonus.includes(h)) {
        bonus.push(h);
        i = j;
        break;
      }
    }
  }
  return bonus;
}

/**
 * Генерує стіну, гарантовано проходиму. Якщо seed дає непрохідну стіну —
 * детерміновано пробуємо наступні варіанти (той самий seed завжди дасть ту саму стіну).
 */
export function generateWall(seed: number, params: WallParams): Wall {
  for (let attempt = 0; attempt < 30; attempt++) {
    const base = layout((seed + attempt * 7919) >>> 0, params.moves);
    const startTorso = solvePose(base.holds, base.start);
    if (!startTorso) continue;
    const draft = { ...base, seed, startTorso, bonus: [], routeLength: 0 };
    const route = findRoute(draft);
    if (!route) continue;
    const bonus = pickBonus(route, draft, mulberry32(seed ^ 0x9e3779b9), params.bonusEvery);
    return { ...draft, bonus, routeLength: route.moves.length };
  }
  throw new Error(`Не вдалося згенерувати проходиму стіну для seed ${seed}`);
}
