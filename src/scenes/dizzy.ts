/**
 * Зірочки над головою після падіння — як у старих мультиках: кружляють по сплюснутому
 * колу над маківкою, ті, що позаду голови, менші й блідіші.
 */
import type { Point } from '../core/body';

const COUNT = 5;
const RX = 30;
const RY = 9;
const LIFT = 30;
const INK = '#2b2238';
const COLORS = ['#ffd54a', '#fff1a8', '#ffb238', '#ffd54a', '#fff1a8'];

const f = (n: number) => n.toFixed(1);

/** Контур п'ятикутної зірки з центром у (0,0). */
function starPath(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${f(Math.cos(a) * rr)},${f(Math.sin(a) * rr)}`);
  }
  return `M${pts.join('L')}Z`;
}
const STAR = starPath(8);

/**
 * SVG зірочок для голови в точці head. `tilt` — нахил тіла (рад): коло трохи нахиляється разом із головою,
 * але лишається над нею. `age` — мс від удару (поява), `t` — секунди для обертання (0 — без руху).
 */
export function dizzyStars(head: Point, tilt: number, age: number, t: number): string {
  const appear = Math.min(1, age / 250);
  // Коло — завжди над головою (навіть коли тіло лежить), лише трохи хилиться за нею (до ~12°).
  const lean = Math.max(-0.2, Math.min(0.2, tilt * 0.15));
  const cx = head.x + Math.sin(tilt) * 8;
  const cy = head.y - LIFT;
  const items = Array.from({ length: COUNT }, (_, i) => {
    const a = t * 3.2 + (i * 2 * Math.PI) / COUNT;
    const depth = Math.sin(a); // >0 — спереду
    const x = Math.cos(a) * RX * appear;
    const y = depth * RY * appear;
    const px = cx + x * Math.cos(lean) - y * Math.sin(lean);
    const py = cy + x * Math.sin(lean) + y * Math.cos(lean);
    const scale = (0.7 + 0.3 * (depth + 1) * 0.5) * (0.4 + 0.6 * appear);
    const spin = ((t * 220 + i * 47) % 360).toFixed(0);
    const op = (0.55 + 0.45 * (depth + 1) * 0.5) * appear;
    return {
      depth,
      svg: `<path d="${STAR}" transform="translate(${f(px)} ${f(py)}) rotate(${spin}) scale(${scale.toFixed(2)})" fill="${COLORS[i]}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" opacity="${op.toFixed(2)}"/>`,
    };
  });
  // Спершу ті, що позаду, потім ті, що спереду.
  return `<g class="dizzy">${items
    .sort((p, q) => p.depth - q.depth)
    .map((s) => s.svg)
    .join('')}</g>`;
}
