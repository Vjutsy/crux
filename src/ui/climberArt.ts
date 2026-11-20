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
  if (P.bands) {
    // Смуги на светрі: ширина повторює трапецію светра.
    const n = P.bands.n;
    const w = (y: number) => 12.4 + ((y - y0) / (y1 - y0)) * 3;
    for (let i = 0; i < n; i++) {
      const yy = y0 + 6 + ((i + 0.5) * (y1 - y0 - 10)) / n - 2.6;
      s += `<path d="M${f(c.x - w(yy))},${f(yy)}L${f(c.x + w(yy))},${f(yy)}L${f(c.x + w(yy + 5.2))},${f(yy + 5.2)}L${f(c.x - w(yy + 5.2))},${f(yy + 5.2)}Z" fill="${P.bands.color}" stroke="none"/>`;
    }
  }
  s += `<path d="M${f(c.x - 15)},${f(y1 - 3)}Q${f(c.x)},${f(y1 + 1)} ${f(c.x + 15)},${f(y1 - 3)}" fill="none" stroke-width=".9"/>`;
  for (let i = -12; i <= 12; i += 4)
    s += `<path d="M${f(c.x + i * 1.04)},${f(y1 - 2.6 - Math.abs(i) * 0.03)}l0,4" stroke-width=".6" opacity=".6"/>`;
  // Пояс, карабін, мішечок для магнезії.
  s += `<path d="M${f(c.x - 14.6)},${f(c.y + 11)}Q${f(c.x)},${f(c.y + 14)} ${f(c.x + 14.6)},${f(c.y + 11)}" fill="none" stroke="${INK}" stroke-width="2.6"/>`;
  s += `<ellipse cx="${f(c.x - 3)}" cy="${f(c.y + 16.5)}" rx="2" ry="3" fill="none" stroke="#c9c2b2" stroke-width="1.1"/>`;
  s += `<path d="M${f(c.x + 12)},${f(c.y + 12)}l8,0l-.8,9.5q-3.2,1.6-6.4,0Z" fill="#e8dcc4"/><path d="M${f(c.x + 11.6)},${f(c.y + 12)}l8.8,0" stroke-width="2"/></g>`;
  s += backExtras(P, c, y0, y1, t, sw);
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
  // Шарф на шиї (або хустинка / комір скафандра).
  const neck = P.neck ?? 'scarf';
  if (neck === 'kerchief')
    s += `<path d="M${f(c.x - 11)},${f(y0 - 5)}L${f(c.x + 11)},${f(y0 - 5)}L${f(c.x + sw * 0.3)},${f(y0 + 13)}Z" fill="${P.scarf}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M${f(c.x - 9)},${f(y0 - 2)}L${f(c.x + 9)},${f(y0 - 2)}" stroke="${INK}" stroke-width=".7" opacity=".4"/>`;
  else if (neck === 'collar')
    s += `<ellipse cx="${f(c.x)}" cy="${f(y0 - 4)}" rx="15" ry="5" fill="#b9c1cc" stroke="${INK}" stroke-width="1.2"/>`;
  if (neck === 'scarf')
    s += `<rect x="${f(c.x - 11)}" y="${f(y0 - 6)}" width="22" height="8" rx="4" fill="${P.scarf}" stroke="${INK}" stroke-width="1.2"/><path d="M${f(c.x - 4)},${f(y0 - 6)}l0,8M${f(c.x + 5)},${f(y0 - 6)}l0,8" stroke="${P.stripe}" stroke-width="2.2"/>`;
  // Голова (повертається до активної кінцівки).
  s += `<g transform="rotate(${f(lx * 5)} ${f(hx)} ${f(hy + 8)})">`;
  if (neck === 'scarf')
    s += ribbon(
      `M${f(c.x - 6)},${f(y0 - 1)}C${f(c.x - 12)},${f(y0 + 6)} ${f(c.x - 8 + sw)},${f(y0 + 16)} ${f(c.x - 13 + sw * 1.5)},${f(y0 + 27)}`,
      P.cap === 'beanie' ? 7 : 5.5,
      P.scarf,
      P.stripe,
    );
  if (neck === 'scarf')
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
  if (P.braids2) {
    const bs = Math.sin(t * 1.6 + 0.6) * 2;
    for (const d of [-1, 1]) {
      for (let i = 0; i < 5; i++)
        s += `<ellipse cx="${f(hx + d * (14 - i * 0.6) + (bs * i) / 4)}" cy="${f(hy + 6 + i * 4.4)}" rx="${f(3.2 - i * 0.25)}" ry="2.9" fill="${P.hair}" stroke="${INK}" stroke-width="1"/>`;
      s += `<path d="M${f(hx + d * 11.6 + bs)},${f(hy + 28)}l0,5" stroke="#c9574a" stroke-width="2.4"/>`;
    }
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
  } else if (P.cap !== 'beanie' && P.cap !== 'helmet') {
    s += fancyCap(P, hx, hy, hs, t);
  } else if (P.cap === 'beanie') {
    s += `<path d="M${f(hx - 17.3)},${f(hy - 3)}C${f(hx - 17)},${f(hy - 25)} ${f(hx + 17)},${f(hy - 25)} ${f(hx + 17.3)},${f(hy - 3)}Z" fill="${P.hat}"/><circle cx="${f(hx + hs * 0.4)}" cy="${f(hy - 22.5)}" r="4.3" fill="${P.pom}"/>`;
  } else {
    s += `<path d="M${f(hx - 13)},${f(hy - 2)}L${f(hx - 9)},${f(hy + 12)}M${f(hx + 13)},${f(hy - 2)}L${f(hx + 9)},${f(hy + 12)}" stroke-width="1.6"/>`;
    s += `<path d="M${f(hx - 18.5)},${f(hy - 2)}C${f(hx - 18)},${f(hy - 27)} ${f(hx + 18)},${f(hy - 27)} ${f(hx + 18.5)},${f(hy - 2)}Q${f(hx)},${f(hy + 1)} ${f(hx - 18.5)},${f(hy - 2)}Z" fill="${P.hat}"/>`;
    s += `<path d="M${f(hx - 6)},${f(hy - 21)}l0,6M${f(hx)},${f(hy - 22)}l0,6M${f(hx + 6)},${f(hy - 21)}l0,6" stroke-width="1"/><path d="M${f(hx - 9)},${f(hy - 19)}Q${f(hx - 4)},${f(hy - 23)} ${f(hx + 3)},${f(hy - 22.5)}" fill="none" stroke="#fff" opacity=".3" stroke-width="1.6"/>`;
  }
  if (P.cap === 'stocking' || P.cap === 'beanie') {
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

// ---------- Скіни (полотно «Crux — скіни скелелазів») ----------

/** Каптур, що вкриває потилицю й спадає на плечі (вигляд ззаду). */
function hood(hx: number, hy: number, col: string) {
  return `<path d="M${f(hx - 17.6)},${f(hy + 1)}Q${f(hx - 19)},${f(hy + 14)} ${f(hx - 11)},${f(hy + 18)}L${f(hx + 11)},${f(hy + 18)}Q${f(hx + 19)},${f(hy + 14)} ${f(hx + 17.6)},${f(hy + 1)}A17.6,17.6 0 0 0 ${f(hx - 17.6)},${f(hy + 1)}Z" fill="${col}"/><path d="M${f(hx + 6)},${f(hy + 16)}Q${f(hx + 17)},${f(hy + 10)} ${f(hx + 16)},${f(hy - 4)}" fill="none" stroke-width="5" stroke="#000" opacity=".1"/>`;
}

const star = (x: number, y: number, r: number, col: string) =>
  `<path d="M${f(x)},${f(y - r)}L${f(x + r * 0.3)},${f(y - r * 0.3)}L${f(x + r)},${f(y)}L${f(x + r * 0.3)},${f(y + r * 0.3)}L${f(x)},${f(y + r)}L${f(x - r * 0.3)},${f(y + r * 0.3)}L${f(x - r)},${f(y)}L${f(x - r * 0.3)},${f(y - r * 0.3)}Z" fill="${col}" stroke="none"/>`;

/** Головні убори скінів. */
function fancyCap(P: Climber, hx: number, hy: number, hs: number, t: number): string {
  const spark = P.spark ?? '#f3d36b';
  let s = '';
  switch (P.cap) {
    case 'fox': {
      const tw = Math.sin(t * 3.1) > 0.92 ? 8 : 0; // вушко іноді смикається
      for (const d of [-1, 1]) {
        const rot = d === 1 ? tw : 0;
        s += `<g transform="rotate(${rot} ${f(hx + d * 9)} ${f(hy - 13)})"><path d="M${f(hx + d * 16)},${f(hy - 5)}L${f(hx + d * 15)},${f(hy - 28)}L${f(hx + d * 3)},${f(hy - 15)}Z" fill="${P.hat}"/><path d="M${f(hx + d * 13)},${f(hy - 9)}L${f(hx + d * 13)},${f(hy - 22)}L${f(hx + d * 6.5)},${f(hy - 15)}Z" fill="${P.pom}" stroke-width=".8"/></g>`;
      }
      s += hood(hx, hy, P.hat);
      s += `<path d="M${f(hx - 7)},${f(hy - 15)}C${f(hx)},${f(hy - 18)} ${f(hx + 8)},${f(hy - 15)} ${f(hx + 12)},${f(hy - 10)}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".25"/>`;
      break;
    }
    case 'frog': {
      s += hood(hx, hy, P.hat);
      const blink = t % 3.7 < 0.14 ? 0.15 : 1;
      for (const d of [-1, 1]) {
        s += `<circle cx="${f(hx + d * 9)}" cy="${f(hy - 15)}" r="7" fill="${P.hat}"/>`;
        s += `<ellipse cx="${f(hx + d * 9)}" cy="${f(hy - 16)}" rx="4.6" ry="${f(4.6 * blink)}" fill="${P.pom}" stroke-width="1"/>`;
        if (blink > 0.5) s += `<circle cx="${f(hx + d * 9 - d * 0.8)}" cy="${f(hy - 15.4)}" r="2.1" fill="${INK}" stroke="none"/>`;
      }
      s += `<path d="M${f(hx - 9)},${f(hy + 8)}Q${f(hx)},${f(hy + 12)} ${f(hx + 9)},${f(hy + 8)}" fill="none" stroke-width=".9" opacity=".5"/>`;
      break;
    }
    case 'dino': {
      for (let i = 0; i < 4; i++) {
        const y = hy - 17 + i * 8;
        const r = 5 - i * 0.6;
        s += `<path d="M${f(hx - r)},${f(y + 2)}L${f(hx)},${f(y - r - 2)}L${f(hx + r)},${f(y + 2)}Z" fill="${spark}"/>`;
      }
      s += hood(hx, hy, P.hat);
      for (let i = 0; i < 4; i++) {
        const y = hy - 10 + i * 7.5;
        const r = 3.6 - i * 0.4;
        s += `<path d="M${f(hx)},${f(y - r)}L${f(hx + r * 0.8)},${f(y)}L${f(hx)},${f(y + r)}L${f(hx - r * 0.8)},${f(y)}Z" fill="${spark}" stroke-width="1"/>`;
      }
      s += `<circle cx="${f(hx - 9)}" cy="${f(hy + 2)}" r="1.4" fill="#000" opacity=".2" stroke="none"/><circle cx="${f(hx + 10)}" cy="${f(hy - 3)}" r="1.8" fill="#000" opacity=".2" stroke="none"/>`;
      break;
    }
    case 'astro': {
      s += `<circle cx="${f(hx)}" cy="${f(hy)}" r="21" fill="${P.hat}" fill-opacity=".35" stroke-width="1.4"/>`;
      s += `<path d="M${f(hx - 14)},${f(hy - 9)}A16,16 0 0 1 ${f(hx + 2)},${f(hy - 17)}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/><circle cx="${f(hx + 7)}" cy="${f(hy - 16)}" r="1.4" fill="#fff" stroke="none" opacity=".8"/>`;
      break;
    }
    case 'bee': {
      for (const d of [-1, 1]) {
        const bx = hx + d * 12 + hs * 0.6;
        const by = hy - 36 + Math.sin(t * 4 + d) * 1.2;
        s += `<path d="M${f(hx + d * 5)},${f(hy - 17)}Q${f(hx + d * 7)},${f(hy - 30)} ${f(bx)},${f(by)}" fill="none" stroke-width="1.6"/><circle cx="${f(bx)}" cy="${f(by)}" r="3.4" fill="${P.pom}"/>`;
      }
      s += `<path d="M${f(hx - 17.3)},${f(hy - 3)}C${f(hx - 17)},${f(hy - 25)} ${f(hx + 17)},${f(hy - 25)} ${f(hx + 17.3)},${f(hy - 3)}Z" fill="${P.hat}"/>`;
      s += `<path d="M${f(hx - 15.5)},${f(hy - 11)}Q${f(hx)},${f(hy - 14)} ${f(hx + 15.5)},${f(hy - 11)}" fill="none" stroke="${P.pom}" stroke-width="3.2"/>`;
      s += `<rect x="${f(hx - 18)}" y="${f(hy - 7)}" width="36" height="7" rx="3.5" fill="${P.pom}"/>`;
      break;
    }
    case 'chef': {
      const w = Math.sin(t * 1.3) * 0.8;
      s += `<circle cx="${f(hx - 9 + w)}" cy="${f(hy - 25)}" r="9" fill="${P.hat}"/><circle cx="${f(hx + 9 + w)}" cy="${f(hy - 25)}" r="9" fill="${P.hat}"/><circle cx="${f(hx + w)}" cy="${f(hy - 32)}" r="11" fill="${P.hat}"/>`;
      s += `<path d="M${f(hx - 13)},${f(hy - 22)}L${f(hx + 13)},${f(hy - 22)}L${f(hx + 15)},${f(hy - 5)}L${f(hx - 15)},${f(hy - 5)}Z" fill="${P.hat}" stroke="none"/>`;
      s += `<path d="M${f(hx - 4)},${f(hy - 21)}l0,-6M${f(hx + 5)},${f(hy - 21)}l0,-5" stroke-width=".8" opacity=".35"/>`;
      s += `<rect x="${f(hx - 16)}" y="${f(hy - 9)}" width="32" height="8" rx="2" fill="${P.band}"/>`;
      break;
    }
    case 'wizard': {
      const tx = hx + 10 + hs * 1.6;
      const ty = hy - 52;
      s += `<path d="M${f(hx - 14)},${f(hy - 8)}Q${f(hx - 6)},${f(hy - 32)} ${f(tx)},${f(ty)}Q${f(tx + 8)},${f(ty + 2)} ${f(tx + 6)},${f(ty + 8)}Q${f(hx + 6)},${f(hy - 28)} ${f(hx + 14)},${f(hy - 8)}Z" fill="${P.hat}"/>`;
      s += star(hx - 3, hy - 22, 3, spark) + star(hx + 5, hy - 33, 2.2, spark) + star(hx + 1, hy - 13, 1.8, spark);
      s += `<ellipse cx="${f(hx)}" cy="${f(hy - 6)}" rx="24" ry="5" fill="${P.hat}"/><rect x="${f(hx - 14)}" y="${f(hy - 12)}" width="28" height="5" rx="1" fill="${P.band}"/>`;
      break;
    }
    case 'viking': {
      for (const d of [-1, 1])
        s += `<path d="M${f(hx + d * 14)},${f(hy - 12)}Q${f(hx + d * 30)},${f(hy - 14)} ${f(hx + d * 29)},${f(hy - 35)}Q${f(hx + d * 24)},${f(hy - 22)} ${f(hx + d * 11)},${f(hy - 19)}Z" fill="${P.pom}"/><path d="M${f(hx + d * 21)},${f(hy - 16)}l${-d * 2},-4M${f(hx + d * 25)},${f(hy - 21)}l${-d * 3},-2" stroke-width=".8"/>`;
      s += `<path d="M${f(hx - 17.5)},${f(hy - 3)}C${f(hx - 17)},${f(hy - 26)} ${f(hx + 17)},${f(hy - 26)} ${f(hx + 17.5)},${f(hy - 3)}Z" fill="${P.hat}"/>`;
      s += `<path d="M${f(hx)},${f(hy - 21)}V${f(hy - 4)}" stroke-width="2.6" stroke="${P.band}"/><path d="M${f(hx - 8)},${f(hy - 18)}Q${f(hx - 4)},${f(hy - 21)} ${f(hx + 1)},${f(hy - 21)}" fill="none" stroke="#fff" opacity=".35" stroke-width="1.6"/>`;
      s += `<rect x="${f(hx - 18)}" y="${f(hy - 7)}" width="36" height="6" rx="2" fill="${P.band}"/>`;
      for (let i = -14; i <= 14; i += 7) s += `<circle cx="${f(hx + i)}" cy="${f(hy - 4)}" r="1" fill="#e9e4da" stroke="none"/>`;
      break;
    }
  }
  return s;
}

/** Те, що на спині (видно гравцю): крила, мантія, хутро, ранець, шипи, хвости. */
function backExtras(P: Climber, c: Point, y0: number, y1: number, t: number, sw: number): string {
  const ex = P.extras ?? [];
  const accent = P.accent ?? P.hat;
  const spark = P.spark ?? '#f3d36b';
  let s = '';
  if (ex.includes('wings')) {
    const flap = Math.sin(t * 22) * 9;
    for (const d of [-1, 1]) {
      const ox = c.x + d * 3;
      const oy = y0 + 8;
      s += `<g transform="rotate(${f(d * (-28 + flap))} ${f(ox)} ${f(oy)})"><ellipse cx="${f(ox + d * 13)}" cy="${f(oy - 2)}" rx="13" ry="7.5" fill="#eef6ff" fill-opacity=".7" stroke="${INK}" stroke-width="1"/><ellipse cx="${f(ox + d * 10)}" cy="${f(oy + 7)}" rx="9" ry="5" fill="#eef6ff" fill-opacity=".6" stroke="${INK}" stroke-width="1"/><path d="M${f(ox + d * 3)},${f(oy - 1)}L${f(ox + d * 22)},${f(oy - 3)}" stroke="${INK}" stroke-width=".6" opacity=".4"/></g>`;
    }
  }
  if (ex.includes('cape') || ex.includes('fur')) {
    const fur = ex.includes('fur');
    const len = fur ? 26 : 34;
    const a = sw * (fur ? 0.3 : 0.7);
    s += `<path d="M${f(c.x - 13)},${f(y0 - 2)}L${f(c.x + 13)},${f(y0 - 2)}Q${f(c.x + 19 + a * 0.5)},${f(y1 + len * 0.5)} ${f(c.x + 22 + a)},${f(y1 + len - 8)}Q${f(c.x + a * 0.8)},${f(y1 + len)} ${f(c.x - 22 + a)},${f(y1 + len - 8)}Q${f(c.x - 19 + a * 0.5)},${f(y1 + len * 0.5)} ${f(c.x - 13)},${f(y0 - 2)}Z" fill="${accent}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
    s += `<path d="M${f(c.x - 5)},${f(y0 + 4)}Q${f(c.x - 8 + a * 0.6)},${f(y1 + len * 0.5)} ${f(c.x - 9 + a)},${f(y1 + len - 3)}M${f(c.x + 6)},${f(y0 + 4)}Q${f(c.x + 9 + a * 0.6)},${f(y1 + len * 0.5)} ${f(c.x + 11 + a)},${f(y1 + len - 4)}" fill="none" stroke="${P.accentDk ?? INK}" stroke-width="1.4" opacity=".7"/>`;
    if (!fur) {
      const st: [number, number, number][] = [
        [-10, 14, 2.6],
        [8, 22, 2],
        [-3, 34, 3],
        [12, 44, 2.2],
        [-14, 50, 1.8],
        [2, 56, 2.4],
      ];
      for (const [dx, dy, r] of st) s += star(c.x + dx + (a * dy) / 60, y0 + dy, r, spark);
    } else {
      // Пухнастий комір і край хутра.
      const fur2 = P.accentDk ?? accent;
      for (let i = -14; i <= 14; i += 5)
        s += `<circle cx="${f(c.x + i)}" cy="${f(y0 - 1 + Math.abs(i) * 0.05)}" r="4.4" fill="${fur2}" stroke="${INK}" stroke-width="1"/>`;
      for (let i = -19; i <= 19; i += 6)
        s += `<path d="M${f(c.x + i + a)},${f(y1 + len - 9 + Math.abs(i) * -0.1)}l2,5l2,-5" fill="none" stroke="${fur2}" stroke-width="1.4"/>`;
    }
  }
  if (ex.includes('pack')) {
    s += `<g stroke="${INK}" stroke-width="1.2"><rect x="${f(c.x - 11)}" y="${f(y0 + 3)}" width="22" height="25" rx="5" fill="${accent}"/><rect x="${f(c.x - 7)}" y="${f(y0 + 8)}" width="5" height="15" rx="2.5" fill="#b9c1cc"/><rect x="${f(c.x + 2)}" y="${f(y0 + 8)}" width="5" height="15" rx="2.5" fill="#b9c1cc"/><path d="M${f(c.x + 8)},${f(y0 + 3)}L${f(c.x + 13)},${f(y0 - 10)}" fill="none"/></g>`;
    const on = Math.sin(t * 5) > 0;
    s += `<circle cx="${f(c.x + 13)}" cy="${f(y0 - 11)}" r="${on ? 2.6 : 2}" fill="${on ? spark : '#7a3a34'}" stroke="${INK}" stroke-width=".8"/>`;
    s += `<rect x="${f(c.x - 6)}" y="${f(y0 + 25)}" width="12" height="3" rx="1.5" fill="#e8833a" stroke="none"/>`;
  }
  if (ex.includes('spikes')) {
    for (let i = 0; i < 5; i++) {
      const y = y0 + 3 + i * 8.4;
      const r = 4 - i * 0.25;
      s += `<path d="M${f(c.x)},${f(y - r)}L${f(c.x + r * 0.85)},${f(y)}L${f(c.x)},${f(y + r)}L${f(c.x - r * 0.85)},${f(y)}Z" fill="${spark}" stroke="${INK}" stroke-width="1"/>`;
    }
  }
  if (ex.includes('tail-dino')) {
    const tx = c.x + 34 + sw * 1.6;
    const ty = y1 + 30;
    s += `<path d="M${f(c.x - 8)},${f(y1 - 2)}Q${f(c.x - 2)},${f(y1 + 26)} ${f(tx)},${f(ty)}Q${f(c.x + 18)},${f(y1 + 8)} ${f(c.x + 9)},${f(y1 - 3)}Z" fill="${accent}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
    for (let i = 1; i <= 3; i++) {
      const k = i / 4.2;
      const x = c.x + 4 + (tx - c.x - 4) * k;
      const y = y1 + 2 + (ty - y1 - 2) * k * k;
      s += `<path d="M${f(x - 3)},${f(y - 2)}L${f(x + 1)},${f(y - 7 + i)}L${f(x + 4)},${f(y)}Z" fill="${spark}" stroke="${INK}" stroke-width="1"/>`;
    }
  }
  if (ex.includes('tail-fox')) {
    const tx = c.x + 30 + sw * 1.8;
    const ty = y1 + 22;
    const d = `M${f(c.x + 4)},${f(y1 - 2)}C${f(c.x + 16)},${f(y1 + 2)} ${f(tx - 10)},${f(ty - 22)} ${f(tx)},${f(ty)}`;
    s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${accent}" stroke-width="12.4" stroke-linecap="round"/>`;
    s += `<circle cx="${f(tx)}" cy="${f(ty)}" r="6.2" fill="#f6e7cf"/><path d="M${f(tx - 6)},${f(ty - 1)}q3,-2 6,1" fill="none" stroke="${INK}" stroke-width=".8" opacity=".5"/>`;
  }
  return s;
}
