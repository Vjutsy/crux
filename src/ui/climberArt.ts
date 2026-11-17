/**
 * Малювання скелелаза в SVG — порт моделі «Crux — модель скелелаза».
 * Вид ззаду (скелелаз дивиться на стіну), чорнильний контур, кінцівки-«капсули» без швів на суглобах,
 * дихання, гойдання шапки/шарфа/коси, поворот голови до активної кінцівки, піт від утоми.
 *
 * Координати — світові (ті самі, що в розв'язувачі пози); скелет збігається з DEFAULT_BODY.
 */
import { DEFAULT_BODY as B, type Point, anchor } from '../core/body';
import type { Climber } from '../data/climbers';

const INK = '#221c2c';
const f = (n: number) => n.toFixed(1);
/** Напрям згину ліктів і колін для кожної кінцівки (як у моделі). */
const BEND = [-1, 1, 1, -1] as const;

function ik(a: Point, e: Point, L: number, bend: number): { mid: Point; end: Point } {
  let dx = e.x - a.x;
  let dy = e.y - a.y;
  let d = Math.hypot(dx, dy) || 1e-3;
  const m = L * 0.995;
  if (d > m) {
    e = { x: a.x + (dx / d) * m, y: a.y + (dy / d) * m };
    dx = e.x - a.x;
    dy = e.y - a.y;
    d = m;
  }
  const h = Math.sqrt(Math.max(0, (L / 2) ** 2 - (d / 2) ** 2));
  return { mid: { x: (a.x + e.x) / 2 - (dy / d) * h * bend, y: (a.y + e.y) / 2 + (dx / d) * h * bend }, end: e };
}

function capsule(A: Point, Bp: Point, ra: number, rb: number, fill: string): string {
  const dx = Bp.x - A.x;
  const dy = Bp.y - A.y;
  const d = Math.hypot(dx, dy);
  const c = (p: Point, r: number) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(r)}" fill="${fill}"/>`;
  if (d < 0.05) return c(A, ra);
  const nx = -dy / d;
  const ny = dx / d;
  return (
    `<path d="M${f(A.x + nx * ra)},${f(A.y + ny * ra)}L${f(Bp.x + nx * rb)},${f(Bp.y + ny * rb)}L${f(Bp.x - nx * rb)},${f(Bp.y - ny * rb)}L${f(A.x - nx * ra)},${f(A.y - ny * ra)}Z" fill="${fill}"/>` +
    c(A, ra) +
    c(Bp, rb)
  );
}

type Seg = [Point, Point, number, number, string];
/** Спершу чорнильний шар усіх сегментів, потім колір — суглоби без швів. */
const limb = (segs: Seg[]) =>
  segs.map(([a, b, ra, rb]) => capsule(a, b, ra + 1.2, rb + 1.2, INK)).join('') +
  segs.map(([a, b, ra, rb, c]) => capsule(a, b, ra, rb, c)).join('');

const ribbon = (d: string, w: number, col: string, st?: string) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 2.4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>` +
  (st
    ? `<path d="${d}" fill="none" stroke="${st}" stroke-width="${w}" stroke-dasharray="2.2 4.5" stroke-linecap="butt" opacity=".85"/>`
    : '');

export interface ArtOptions {
  /** 0..1 — частіше дихання, крапля поту. */
  tired?: number;
  /** Куди повернути голову (світові координати). */
  look?: Point | null;
  /** Горизонтальна «інерція» для гойдання шапки й шарфа. */
  vx?: number;
  /** Кінцівки, що висять (малюємо їх як є, лише для підсвітки). */
  selected?: number | null;
  dangling?: readonly boolean[];
  /** Показувати кружечки-ручки на кистях і стопах. */
  handles?: boolean;
}

/** SVG-розмітка персонажа для центру тулуба c і кінців кінцівок ends (у порядку ЛР, ПР, ЛН, ПН). */
export function drawClimber(P: Climber, c: Point, ends: readonly Point[], t: number, o: ArtOptions = {}): string {
  const tired = o.tired ?? 0;
  const br = Math.sin(t * (2 + tired * 3)) * (0.6 + tired * 0.5);
  const y0 = c.y - B.torso / 2 - br * 0.5;
  const y1 = c.y + B.torso / 2;
  const sw = Math.sin(t * 1.6) * 3 + (o.vx ?? 0);
  const look = o.look ?? { x: c.x, y: c.y - 80 };
  const lx = Math.max(-1, Math.min(1, (look.x - c.x) / 50));
  const hx = c.x + lx * 1.2;
  const hy = y0 - 14 - br * 0.3;
  const L = [0, 1, 2, 3].map((k) => {
    const a = anchor({ x: c.x, y: c.y - br * 0.5 * (k < 2 ? 1 : 0) }, k as 0 | 1 | 2 | 3);
    return { a, ...ik(a, ends[k]!, k < 2 ? B.arm : B.leg, BEND[k]!) };
  });
  let s = '';
  // Ноги й черевики.
  for (const k of [2, 3]) {
    const l = L[k]!;
    const side = k === 2 ? -1 : 1;
    s += limb([
      [l.a, l.mid, 4.2, 3.2, P.legs],
      [l.mid, l.end, 3.2, 2.5, P.legs],
    ]);
    s += `<ellipse cx="${f(l.end.x + side * 2.5)}" cy="${f(l.end.y + 1)}" rx="5.6" ry="3.4" fill="${P.boots}" stroke="${INK}" stroke-width="1.2" transform="rotate(${side * 12} ${f(l.end.x)} ${f(l.end.y)})"/>`;
  }
  // Светр.
  const sx = 1 + br * 0.004;
  s += `<g stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"><path d="M${f(c.x - 12.5 * sx)},${f(y0 + 5)}Q${f(c.x - 13)},${f(y0 - 2)} ${f(c.x - 6)},${f(y0 - 3)}L${f(c.x + 6)},${f(y0 - 3)}Q${f(c.x + 13)},${f(y0 - 2)} ${f(c.x + 12.5 * sx)},${f(y0 + 5)}L${f(c.x + 15.5)},${f(y1 + 1)}Q${f(c.x)},${f(y1 + 5)} ${f(c.x - 15.5)},${f(y1 + 1)}Z" fill="${P.sweater}"/>`;
  s += `<path d="M${f(c.x + 4)},${f(y0 - 2)}Q${f(c.x + 13)},${f(y0)} ${f(c.x + 15.5)},${f(y1 + 1)}Q${f(c.x + 9)},${f(y1 + 3.6)} ${f(c.x + 5)},${f(y1 + 3.8)}Q${f(c.x + 9)},${f(y0 + 14)} ${f(c.x + 4)},${f(y0 - 2)}Z" fill="${P.sweaterDk}" stroke="none" opacity=".55"/>`;
  s += `<path d="M${f(c.x - 15)},${f(y1 - 3)}Q${f(c.x)},${f(y1 + 1)} ${f(c.x + 15)},${f(y1 - 3)}" fill="none" stroke-width=".9"/>`;
  for (let i = -12; i <= 12; i += 4)
    s += `<path d="M${f(c.x + i * 1.04)},${f(y1 - 2.6 - Math.abs(i) * 0.03)}l0,4" stroke-width=".6" opacity=".6"/>`;
  // Пояс, карабін, мішечок для магнезії.
  s += `<path d="M${f(c.x - 14.6)},${f(c.y + 11)}Q${f(c.x)},${f(c.y + 14)} ${f(c.x + 14.6)},${f(c.y + 11)}" fill="none" stroke="${INK}" stroke-width="2.6"/>`;
  s += `<ellipse cx="${f(c.x - 3)}" cy="${f(c.y + 16.5)}" rx="2" ry="3" fill="none" stroke="#c9c2b2" stroke-width="1.1"/>`;
  s += `<path d="M${f(c.x + 12)},${f(c.y + 12)}l8,0l-.8,9.5q-3.2,1.6-6.4,0Z" fill="#e8dcc4"/><path d="M${f(c.x + 11.6)},${f(c.y + 12)}l8.8,0" stroke-width="2"/></g>`;
  // Руки: рукав светра, зап'ястя, кисть.
  for (const k of [0, 1]) {
    const l = L[k]!;
    const wr = { x: l.mid.x + (l.end.x - l.mid.x) * 0.78, y: l.mid.y + (l.end.y - l.mid.y) * 0.78 };
    s += limb([
      [l.end, l.end, 3.3, 3.3, P.skin],
      [wr, l.end, 1.8, 1.8, P.skin],
      [l.a, l.mid, 4.6, 3.8, P.sweater],
      [l.mid, wr, 3.8, 3.4, P.sweater],
    ]);
  }
  // Шарф на шиї.
  s += `<rect x="${f(c.x - 11)}" y="${f(y0 - 6)}" width="22" height="8" rx="4" fill="${P.scarf}" stroke="${INK}" stroke-width="1.2"/><path d="M${f(c.x - 4)},${f(y0 - 6)}l0,8M${f(c.x + 5)},${f(y0 - 6)}l0,8" stroke="${P.stripe}" stroke-width="2.2"/>`;
  // Голова (повертається до активної кінцівки).
  s += `<g transform="rotate(${f(lx * 5)} ${f(hx)} ${f(hy + 8)})">`;
  s += ribbon(
    `M${f(c.x - 6)},${f(y0 - 1)}C${f(c.x - 12)},${f(y0 + 6)} ${f(c.x - 8 + sw)},${f(y0 + 16)} ${f(c.x - 13 + sw * 1.5)},${f(y0 + 27)}`,
    P.cap === 'beanie' ? 7 : 5.5,
    P.scarf,
    P.stripe,
  );
  s += `<path d="M${f(c.x - 16 + sw * 1.5)},${f(y0 + 28.5)}l1,3M${f(c.x - 13 + sw * 1.5)},${f(y0 + 30)}l0,3.2M${f(c.x - 10 + sw * 1.5)},${f(y0 + 28.5)}l-1,3" stroke="${P.scarf}" stroke-width="1.3" stroke-linecap="round"/>`;
  for (const d of [-1, 1])
    s += `<ellipse cx="${f(hx + d * 15.6)}" cy="${f(hy + 4)}" rx="3" ry="4" fill="${P.skin}" stroke="${INK}" stroke-width="1.1"/>`;
  s += `<circle cx="${f(hx)}" cy="${f(hy)}" r="16" fill="${P.skin}" stroke="${INK}" stroke-width="1.3"/>`;
  s += `<path d="M${f(hx - 16)},${f(hy)}A16,16 0 0 1 ${f(hx + 16)},${f(hy)}Q${f(hx + 15.5)},${f(hy + 8)} ${f(hx + 12.5)},${f(hy + 11)}Q${f(hx + 9)},${f(hy + 9.5)} ${f(hx + 7)},${f(hy + 12.5)}Q${f(hx + 3.5)},${f(hy + 10.5)} ${f(hx)},${f(hy + 13.5)}Q${f(hx - 3.5)},${f(hy + 10.5)} ${f(hx - 7)},${f(hy + 12.5)}Q${f(hx - 9)},${f(hy + 9.5)} ${f(hx - 12.5)},${f(hy + 11)}Q${f(hx - 15.5)},${f(hy + 8)} ${f(hx - 16)},${f(hy)}Z" fill="${P.hair}" stroke="${INK}" stroke-width="1.2"/>`;
  s += `<path d="M${f(hx - 8)},${f(hy - 2)}q-2,7 -4,11M${f(hx - 2)},${f(hy - 3)}q-1,8 -1,13M${f(hx + 4)},${f(hy - 3)}q1,7 3,12M${f(hx + 10)},${f(hy - 2)}q2,6 2.5,10" fill="none" stroke="${INK}" stroke-width=".7" opacity=".45"/>`;
  s += `<path d="M${f(hx + 7)},${f(hy + 11)}A16,16 0 0 0 ${f(hx + 16)},${f(hy)}L${f(hx + 12)},${f(hy + 3)}Z" fill="${INK}" opacity=".15"/>`;
  if (P.braid) {
    const bs = Math.sin(t * 1.6 + 0.6) * 2.5;
    for (let i = 0; i < 4; i++)
      s += `<ellipse cx="${f(hx + (bs * i) / 3)}" cy="${f(hy + 13 + i * 4.4)}" rx="${3.3 - i * 0.3}" ry="3" fill="${P.hair}" stroke="${INK}" stroke-width="1"/>`;
    s += `<circle cx="${f(hx + bs)}" cy="${f(hy + 30)}" r="1.9" fill="${P.stripe}" stroke="${INK}" stroke-width=".8"/>`;
  }
  if (tired > 0.35)
    s += `<path d="M${f(hx + 17)},${f(hy + 2 + ((t * 6) % 8))}q1.6,2.6 0,3.6q-1.6,-1 0,-3.6Z" fill="#bfe3f0" stroke="${INK}" stroke-width=".7" opacity="${f(0.4 + tired * 0.5)}"/>`;
  // Головний убір.
  const hs = Math.sin(t * 1.6 + 0.3) * 3 + (o.vx ?? 0) * 0.6;
  s += `<g stroke="${INK}" stroke-width="1.3" stroke-linejoin="round">`;
  if (P.cap === 'stocking') {
    const tx = hx + 31 + hs;
    const ty = hy + 9 - hs * 0.4;
    s += `<path d="M${f(hx - 17)},${f(hy - 3)}C${f(hx - 17)},${f(hy - 24)} ${f(hx + 6)},${f(hy - 28)} ${f(hx + 16)},${f(hy - 15)}C${f(hx + 23)},${f(hy - 7)} ${f(tx - 2)},${f(ty - 9)} ${f(tx)},${f(ty)}C${f(tx - 6)},${f(ty - 4)} ${f(hx + 19)},${f(hy - 4)} ${f(hx + 17)},${f(hy - 3)}Z" fill="${P.hat}"/>`;
    s += `<path d="M${f(hx - 6)},${f(hy - 21)}C${f(hx + 3)},${f(hy - 23)} ${f(hx + 12)},${f(hy - 17)} ${f(hx + 15)},${f(hy - 12)}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".22"/>`;
    s += `<circle cx="${f(tx + 0.5)}" cy="${f(ty + 2)}" r="4.6" fill="${P.pom}"/>`;
  } else if (P.cap === 'beanie') {
    s += `<path d="M${f(hx - 17.3)},${f(hy - 3)}C${f(hx - 17)},${f(hy - 25)} ${f(hx + 17)},${f(hy - 25)} ${f(hx + 17.3)},${f(hy - 3)}Z" fill="${P.hat}"/><circle cx="${f(hx + hs * 0.4)}" cy="${f(hy - 22.5)}" r="4.3" fill="${P.pom}"/>`;
  } else {
    s += `<path d="M${f(hx - 13)},${f(hy - 2)}L${f(hx - 9)},${f(hy + 12)}M${f(hx + 13)},${f(hy - 2)}L${f(hx + 9)},${f(hy + 12)}" stroke-width="1.6"/>`;
    s += `<path d="M${f(hx - 18.5)},${f(hy - 2)}C${f(hx - 18)},${f(hy - 27)} ${f(hx + 18)},${f(hy - 27)} ${f(hx + 18.5)},${f(hy - 2)}Q${f(hx)},${f(hy + 1)} ${f(hx - 18.5)},${f(hy - 2)}Z" fill="${P.hat}"/>`;
    s += `<path d="M${f(hx - 6)},${f(hy - 21)}l0,6M${f(hx)},${f(hy - 22)}l0,6M${f(hx + 6)},${f(hy - 21)}l0,6" stroke-width="1"/><path d="M${f(hx - 9)},${f(hy - 19)}Q${f(hx - 4)},${f(hy - 23)} ${f(hx + 3)},${f(hy - 22.5)}" fill="none" stroke="#fff" opacity=".3" stroke-width="1.6"/>`;
  }
  if (P.cap !== 'helmet') {
    s += `<rect x="${f(hx - 18)}" y="${f(hy - 7)}" width="36" height="7" rx="3.5" fill="${P.band}"/>`;
    for (let i = -14; i <= 14; i += 3.5) s += `<path d="M${f(hx + i)},${f(hy - 6)}l0,5" stroke-width=".6" opacity=".55"/>`;
  }
  s += `</g></g>`;
  // Кружечки-ручки на кистях і стопах: вибрана — помаранчева, та що висить — червона.
  if (o.handles) {
    for (let k = 0; k < 4; k++) {
      const e = L[k]!.end;
      const sel = o.selected === k;
      const col = sel ? '#ff8a1f' : o.dangling?.[k] ? '#e8323c' : '#ffffff';
      s += `<circle cx="${f(e.x)}" cy="${f(e.y)}" r="${sel ? 6 : 3.6}" fill="${col}" stroke="${INK}" stroke-width="1.4" opacity="${sel ? 1 : 0.9}"/>`;
    }
  }
  return s;
}
