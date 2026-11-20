/**
 * Стіни й зачепи за дизайном «Crux — скеледроми і зачепи» (казковий вечірній стиль, як у скелелазів).
 * Усе малюється в SVG у світових координатах (шар #scenery під скелелазом):
 *  - декор стіни під тему: плитка й полиці на кухні, шпалери й рамки вдома, цегла й ліхтарі в місті, скеля під нічним небом;
 *  - зачепи — предмети теми (булочки, ґудзики, бруківка, хмаринки…), стан показує світло й позначки;
 *  - бонусні — завжди сині самоцвіти з «+3», згорілий бонус — сірий тріснутий камінь із димком, вершина — прапорець.
 * Пульсація ореолів — SMIL-анімації, тож шар не перемальовується щокадру.
 */
import { mulberry32 } from '../core/rng';

const INK = '#221c2c';
const f = (n: number) => n.toFixed(1);

type ShapeId =
  | 'bun'
  | 'cheese'
  | 'egg'
  | 'knob'
  | 'button'
  | 'cushion'
  | 'stone'
  | 'hex'
  | 'cobble'
  | 'crag'
  | 'puff'
  | 'pebble'
  | 'tire'
  | 'wheel'
  | 'cone';

/** Форми зачепів у локальних координатах (~22×15, як у грі). d — контур, x — деталі. */
const SH: Record<ShapeId, { d: string; x: string }> = {
  bun: { d: 'M-10,4C-10,-7 10,-7 10,4C6,7.5 -6,7.5 -10,4Z', x: '<path d="M-4,-3l2.5,4.5M2,-4l2.5,4.5" fill="none" stroke-width=".9"/>' },
  cheese: {
    d: 'M-10,5L-9,-2L10,-6L10,5Z',
    x: '<circle cx="-3" cy="1" r="1.6"/><circle cx="4" cy="-1" r="1.2"/><circle cx="5" cy="3" r="1"/>',
  },
  egg: { d: 'M0,-8.5C6,-8.5 8,2 6.5,5C5,8 -5,8 -6.5,5C-8,2 -6,-8.5 0,-8.5Z', x: '' },
  knob: { d: 'M-8,0A8,8 0 1 1 8,0A8,8 0 1 1 -8,0Z', x: '<circle r="4" fill="none" stroke-width=".9"/>' },
  button: {
    d: 'M-8,0A8,7 0 1 1 8,0A8,7 0 1 1 -8,0Z',
    x: '<circle cx="-2" cy="-2" r="1"/><circle cx="2" cy="-2" r="1"/><circle cx="-2" cy="2" r="1"/><circle cx="2" cy="2" r="1"/>',
  },
  cushion: {
    d: 'M-9,-6Q0,-9 9,-6Q11.5,0 9,6Q0,9 -9,6Q-11.5,0 -9,-6Z',
    x: '<circle r="1.4"/><path d="M-9,-6L-1,-1M9,-6L1,-1M-9,6L-1,1M9,6L1,1" stroke-width=".6" opacity=".6"/>',
  },
  stone: { d: 'M-10,1L-7,-6L3,-7.5L10,-2L8,6L-4,7Z', x: '<path d="M-2,-5l2,5" fill="none" stroke-width=".7" opacity=".6"/>' },
  hex: { d: 'M8,0L4,6.9L-4,6.9L-8,0L-4,-6.9L4,-6.9Z', x: '<circle r="3" fill="none" stroke-width=".9"/>' },
  cobble: { d: 'M-10,3Q-10,-6 0,-6Q10,-6 10,3Q10,6.5 0,6.5Q-10,6.5 -10,3Z', x: '' },
  crag: { d: 'M-11,5L-6,-5L-1,-2L4,-8L11,4Q0,8 -11,5Z', x: '<path d="M4,-8L2,4" fill="none" stroke-width=".7" opacity=".6"/>' },
  puff: { d: 'M-10,4A5,5 0 0 1 -5,-3A6,6 0 0 1 6,-4A5,5 0 0 1 10,4Z', x: '' },
  pebble: { d: 'M-10,2C-11,-6 -3,-8 1,-7.5C8,-7 11,-3 10,2C9,7 3,7.5 -1,7C-6,7 -9.5,6 -10,2Z', x: '' },
  // Тема «Авто»: шина, кермо, дорожній конус.
  tire: {
    d: 'M-9,0A9,9 0 1 1 9,0A9,9 0 1 1 -9,0Z',
    x: '<circle r="4.6" fill="#c9c4cf" stroke-width=".9"/><circle r="1.4"/><path d="M-7.6,-3l1.6,.6M7.6,3l-1.6-.6M-3,7.6l.6-1.6M3,-7.6l-.6,1.6" stroke-width="1"/>',
  },
  wheel: {
    d: 'M-9,0A9,9 0 1 1 9,0A9,9 0 1 1 -9,0Z',
    x: '<circle r="5.6" fill="#8d8a92" stroke-width="1"/><path d="M-5.6,0H5.6M0,0V5.6" fill="none" stroke-width="2"/><circle r="2.2"/>',
  },
  cone: {
    d: 'M-10,7L-3.5,-8.5Q0,-10 3.5,-8.5L10,7Z',
    x: '<path d="M-6,-1H6" stroke="#f3ead6" stroke-width="2.6" opacity="1"/><path d="M-11,7H11" stroke-width="1.6"/>',
  },
};
const GEM = 'M-8,-2L-4,-7L4,-7L8,-2L0,8Z';

export interface WallTheme {
  /** Колір «неба» над стіною та поза нею. */
  base: string;
  shapes: [ShapeId, string][];
  /** Декор стіни розміром W×H. */
  draw(W: number, H: number, seed: number): string;
}

/** Повторюваний вертикальний «поверх» декору: одна копія на кожні STOREY px висоти. */
const STOREY = 380;

const kuchyna: WallTheme = {
  base: '#2b2740',
  shapes: [
    ['bun', '#d0884a'],
    ['cheese', '#e3b743'],
    ['egg', '#efe6d2'],
  ],
  draw(W, H, seed) {
    const r = mulberry32(seed);
    let s = `<rect width="${W}" height="${H}" fill="url(#kg)"/>`;
    s += '<g stroke="#b5a37f" stroke-width=".8" opacity=".8">';
    for (let y = 0; y < H - 72; y += 20) {
      s += `<path d="M0,${y}H${W}"/>`;
      for (let x = (y / 20) % 2 ? 10 : 0; x < W; x += 20) s += `<path d="M${x},${y}v20"/>`;
    }
    s += '</g>';
    for (let i = 0; i < (W * H) / 4000; i++)
      s += `<rect x="${Math.floor(r() * (W / 20)) * 20 + 1}" y="${Math.floor(r() * ((H - 80) / 20)) * 20 + 1}" width="18" height="18" fill="#f4ead6" opacity=".35"/>`;
    for (let y0 = H - 72 - STOREY; y0 > -STOREY / 2; y0 -= STOREY) {
      const flip = r() < 0.5;
      const wx = flip ? 30 : W - 110;
      s += `<g transform="translate(${wx} ${y0 + 40})"><rect width="80" height="64" rx="3" fill="#3b4a72" stroke="#5a4130" stroke-width="4"/><circle cx="56" cy="18" r="7" fill="#efe1b8"/><circle cx="60" cy="15" r="6.5" fill="#3b4a72"/><path d="M40,0V64M0,32H80" stroke="#5a4130" stroke-width="3"/><path d="M-5,66H85" stroke="#5a4130" stroke-width="4" stroke-linecap="round"/></g>`;
      const sx = flip ? W - 130 : 24;
      s += `<g transform="translate(${sx} ${y0 + 190})"><rect width="100" height="6" fill="#8a5d3d" stroke="${INK}" stroke-width=".8"/><rect x="8" y="-22" width="16" height="22" rx="3" fill="#d6e2cf" opacity=".85" stroke="${INK}" stroke-width=".7"/><rect x="7" y="-26" width="18" height="5" rx="1" fill="#c9574a"/><rect x="34" y="-17" width="14" height="17" rx="3" fill="#e7c88f" opacity=".85" stroke="${INK}" stroke-width=".7"/><path d="M60,0Q60,-20 75,-20Q90,-20 90,0Z" fill="#b77a49" stroke="${INK}" stroke-width=".8"/><path d="M70,-20q5,-7 10,0" fill="none" stroke="${INK}" stroke-width="1"/></g>`;
      const lx = W / 2 + (r() - 0.5) * 60;
      s += `<g opacity=".85"><circle cx="${f(lx)}" cy="${y0 + 300}" r="34" fill="url(#lampGlow)"/><path d="M${f(lx)},${y0 + 240}V${y0 + 292}" stroke="#6b5a4a" stroke-width="1"/><path d="M${f(lx - 9)},${y0 + 292}h18l-3,8h-12z" fill="#6b5a4a"/></g>`;
    }
    s += `<rect y="${H - 72}" width="${W}" height="72" fill="#8a5d3d"/><g stroke="#6e472d" stroke-width="1">${Array.from({ length: Math.ceil(W / 30) }, (_, i) => `<path d="M${20 + i * 30},${H - 72}V${H}"/>`).join('')}</g><rect y="${H - 76}" width="${W}" height="6" fill="#a7764f" stroke="${INK}" stroke-width=".8"/>`;
    return s;
  },
};

const dom: WallTheme = {
  base: '#2f3529',
  shapes: [
    ['knob', '#b07e52'],
    ['button', '#c9574a'],
    ['cushion', '#86a5c4'],
  ],
  draw(W, H, seed) {
    const r = mulberry32(seed);
    let s = `<rect width="${W}" height="${H}" fill="#76836a"/>`;
    for (let x = 0; x < W; x += 24) s += `<rect x="${x + 14}" width="10" height="${H}" fill="#6c7960"/>`;
    s += '<g fill="#e8dcc0" opacity=".35">';
    for (let y = 8; y < H - 30; y += 24)
      for (let x = 5; x < W; x += 24) {
        const yy = y + ((x / 24) % 2) * 12;
        s += `<circle cx="${x}" cy="${yy}" r="1.6"/><circle cx="${x + 2.4}" cy="${yy}" r="1.2"/><circle cx="${x - 2.4}" cy="${yy}" r="1.2"/><circle cx="${x}" cy="${yy + 2.4}" r="1.2"/><circle cx="${x}" cy="${yy - 2.4}" r="1.2"/>`;
      }
    s += '</g>';
    for (let y0 = H - 30 - STOREY; y0 > -STOREY / 2; y0 -= STOREY) {
      const flip = r() < 0.5;
      const px = flip ? W - 60 : 60;
      s += `<g transform="translate(${px} ${y0 + 110})"><ellipse rx="26" ry="32" fill="#c49a5a" stroke="${INK}" stroke-width="1"/><ellipse rx="20" ry="26" fill="#e9dcc0"/><circle cy="-5" r="8" fill="#7a6a5c"/><path d="M-13,20Q0,3 13,20Z" fill="#7a6a5c"/></g>`;
      const lx = flip ? 80 : W - 80;
      s += `<g transform="translate(${lx} ${y0 + 260})"><rect x="-34" y="-24" width="68" height="48" fill="#c49a5a" stroke="${INK}" stroke-width="1"/><rect x="-27" y="-17" width="54" height="34" fill="#a9bfd0"/><path d="M-27,17L-9,0L3,10L13,1L27,17Z" fill="#6f8f5a"/><circle cx="14" cy="-7" r="4" fill="#f3ead6"/></g>`;
      const bx = W / 2 + (r() - 0.5) * 40;
      s += `<g transform="translate(${f(bx)} ${y0 + 40})"><circle r="40" fill="url(#lampGlow)"/><path d="M0,10V24" stroke="#5a4636" stroke-width="2"/><path d="M-10,10L-7,-5H7L10,10Z" fill="#efd7a6" stroke="${INK}" stroke-width="1"/></g>`;
    }
    s += `<rect y="${H - 26}" width="${W}" height="26" fill="#5c4434"/><rect y="${H - 30}" width="${W}" height="5" fill="#7a5b44" stroke="${INK}" stroke-width=".8"/>`;
    return s;
  },
};

const mesto: WallTheme = {
  base: '#241a22',
  shapes: [
    ['stone', '#d6cfc0'],
    ['hex', '#aab3b8'],
    ['cobble', '#d9b98a'],
  ],
  draw(W, H, seed) {
    const r = mulberry32(seed);
    const cs = ['#7d4f43', '#86574a', '#714539', '#8f6050', '#7a4c40'];
    let s = `<rect width="${W}" height="${H}" fill="#5b3a31"/>`;
    for (let y = 0, row = 0; y < H; y += 13, row++)
      for (let x = row % 2 ? -13 : 0; x < W; x += 26)
        s += `<rect x="${x + 1}" y="${y + 1}" width="24" height="11" rx="1.5" fill="${cs[Math.floor(r() * 5)]}"/>`;
    for (let y0 = H - STOREY; y0 > -STOREY / 2; y0 -= STOREY) {
      const flip = r() < 0.5;
      const wx = flip ? 70 : W - 70;
      s += `<g transform="translate(${wx} ${y0 + 230})"><circle r="46" fill="url(#lampGlow)"/><rect x="-22" y="-28" width="44" height="56" fill="#f1c47f" stroke="#3e2a24" stroke-width="3"/><path d="M0,-28V28M-22,0H22" stroke="#3e2a24" stroke-width="2"/><rect x="-26" y="28" width="52" height="5" fill="#9c8a7a"/></g>`;
      const ax = flip ? W - 110 : 40;
      s += `<g transform="translate(${ax} ${y0 + 50}) rotate(${flip ? 3 : -3})"><rect width="64" height="80" fill="#e8dcc4" stroke="${INK}" stroke-width=".8"/><rect x="8" y="26" width="48" height="20" rx="5" fill="#c9574a" stroke="${INK}" stroke-width=".8"/><rect x="13" y="30" width="10" height="7" fill="#f3ead6"/><rect x="27" y="30" width="10" height="7" fill="#f3ead6"/><rect x="41" y="30" width="10" height="7" fill="#f3ead6"/><path d="M32,26V10M23,10H41" stroke="${INK}" stroke-width="1"/><circle cx="18" cy="49" r="4" fill="${INK}"/><circle cx="46" cy="49" r="4" fill="${INK}"/><path d="M8,62H56M8,70H40" stroke="#8a7a6a" stroke-width="2"/></g>`;
      const px = flip ? W / 2 + 30 : W / 2 - 30;
      s += `<g><circle cx="${px + 10}" cy="${y0 + 140}" r="44" fill="url(#lampGlow)"/><path d="M${px},${y0 + STOREY}V${y0 + 142}" stroke="#2c2630" stroke-width="4"/><path d="M${px},${y0 + 142}Q${px},${y0 + 130} ${px + 10},${y0 + 130}" fill="none" stroke="#2c2630" stroke-width="3"/><path d="M${px + 2},${y0 + 134}h16l-3,8h-10z" fill="#2c2630"/><ellipse cx="${px + 10}" cy="${y0 + 143}" rx="5" ry="2.5" fill="#ffe2a8"/></g>`;
    }
    s += `<rect x="${W - 14}" width="7" height="${H}" fill="#4a4a52" stroke="${INK}" stroke-width=".8"/>`;
    for (let y = 150; y < H; y += 300)
      s += `<rect x="${W - 16}" y="${y}" width="11" height="5" fill="#4a4a52" stroke="${INK}" stroke-width=".8"/>`;
    return s;
  },
};

const cas: WallTheme = {
  base: '#2a2f5a',
  shapes: [
    ['crag', '#e0b07a'],
    ['puff', '#efe8f4'],
    ['pebble', '#c99a6b'],
  ],
  draw(W, H, seed) {
    const r = mulberry32(seed);
    let s = `<rect y="-2000" width="${W}" height="${H + 2000}" fill="url(#sky)"/>`;
    s += '<g fill="#f3ead6">';
    for (let i = 0; i < 40; i++) {
      const o = 0.3 + r() * 0.5;
      s += `<circle cx="${f(r() * W)}" cy="${f(-200 + r() * 360)}" r="${f(0.4 + r() * 0.8)}" opacity="${f(o)}"><animate attributeName="opacity" values="${f(o)};${f(o * 0.3)};${f(o)}" dur="${f(2 + r() * 3)}s" repeatCount="indefinite"/></circle>`;
    }
    s += '</g>';
    s += `<circle cx="${W - 50}" cy="20" r="40" fill="url(#moonGlow)"/><circle cx="${W - 50}" cy="20" r="15" fill="#efe1b8"/><circle cx="${W - 44}" cy="15" r="14" fill="#2d335e"/>`;
    // Хмари пливуть повільно (SMIL), кожна на своїй висоті.
    for (let y = 60; y < H; y += 170 + Math.floor(r() * 60)) {
      const k = 0.8 + r() * 0.4;
      const dur = 40 + r() * 40;
      s += `<g opacity=".75" fill="#cfc6e0"><g transform="translate(0 ${y}) scale(${f(k)})"><circle cx="0" r="10"/><circle cx="12" cy="-6" r="13"/><circle cx="26" r="9"/><rect width="26" height="9"/></g><animateTransform attributeName="transform" type="translate" from="-60 0" to="${W + 60} 0" dur="${f(dur)}s" begin="-${f(r() * dur)}s" repeatCount="indefinite"/></g>`;
    }
    // Скеля: зубчасті краї на всю висоту стіни.
    const left: string[] = [];
    const right: string[] = [];
    for (let y = H; y >= 40; y -= 60) {
      left.push(`${f(8 + r() * 22)},${y}`);
      right.unshift(`${f(W - 8 - r() * 22)},${y}`);
    }
    const peak = `${f(W * 0.2)},30 ${f(W * 0.38)},18 ${f(W * 0.55)},26 ${f(W * 0.72)},14 ${f(W * 0.84)},34`;
    s += `<path d="M${left.join(' L')} L${peak.split(' ').join(' L')} L${right.join(' L')} Z" fill="#5d5674" stroke="${INK}" stroke-width="1.2"/>`;
    s += '<g fill="none" stroke="#45405a" stroke-width="1.2">';
    for (let y = 60; y < H; y += 90) {
      const x = 40 + r() * (W - 80);
      s += `<path d="M${f(x)},${y}l${f((r() - 0.5) * 40)},${f(30 + r() * 30)}l${f((r() - 0.5) * 30)},${f(20 + r() * 30)}"/>`;
    }
    s += '</g>';
    s += `<path d="M${f(W * 0.38)},18 l-10,8 m24,-4 q4,-7 8,0 q4,-8 8,0" fill="none" stroke="#7d9a68" stroke-width="1.6"/>`;
    return s;
  },
};

/** Тема «Авто й права»: бетонна стіна паркінгу вночі — знаки, світлофор, рівень «P», асфальт із розміткою внизу. */
const auto: WallTheme = {
  base: '#1f2230',
  shapes: [
    ['tire', '#4b4752'],
    ['wheel', '#c9574a'],
    ['cone', '#e8873a'],
  ],
  draw(W, H, seed) {
    const r = mulberry32(seed);
    let s = `<rect width="${W}" height="${H}" fill="#8d8a92"/>`;
    // Бетонні плити зі швами й плямами.
    s += '<g stroke="#77737d" stroke-width="1">';
    for (let y = 0; y < H - 60; y += 60) s += `<path d="M0,${y}H${W}"/>`;
    for (let x = 0; x < W; x += 100) s += `<path d="M${x},0V${H - 60}"/>`;
    s += '</g>';
    for (let i = 0; i < (W * H) / 9000; i++)
      s += `<ellipse cx="${f(r() * W)}" cy="${f(r() * (H - 70))}" rx="${f(6 + r() * 14)}" ry="${f(3 + r() * 6)}" fill="#7d7983" opacity=".45"/>`;
    // Декор приглушений: знаки й світлофор не мають сперечатися із зачепами.
    s += '<g opacity=".5">';
    for (let y0 = H - 60 - STOREY; y0 > -STOREY / 2; y0 -= STOREY) {
      const flip = r() < 0.5;
      // Жовто-чорна смуга безпеки.
      s += `<g transform="translate(0 ${y0 + 20})"><rect width="${W}" height="12" fill="#e9c24a"/>${Array.from({ length: Math.ceil(W / 20) + 1 }, (_, i) => `<path d="M${i * 20 - 6},12L${i * 20 + 4},0H${i * 20 + 12}L${i * 20 + 2},12Z" fill="${INK}"/>`).join('')}</g>`;
      // Рівень паркінгу.
      const px = flip ? W - 70 : 30;
      s += `<g transform="translate(${px} ${y0 + 60})"><rect width="44" height="44" rx="6" fill="#2f5fae" stroke="${INK}" stroke-width="1"/><text x="22" y="33" text-anchor="middle" font-family="Neucha, cursive" font-size="30" fill="#f3ead6">P</text></g>`;
      // Знаки: «Стоп», «Дай дорогу», обмеження 50.
      const sx = flip ? 50 : W - 90;
      s += `<g transform="translate(${sx} ${y0 + 150}) scale(.8)"><path d="M-9,-22h18l13,13v18l-13,13h-18l-13,-13v-18z" fill="#c9574a" stroke="#f3ead6" stroke-width="2"/><text y="5" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="10" fill="#f3ead6">STOP</text></g>`;
      s += `<g transform="translate(${sx + (flip ? 56 : -56)} ${y0 + 160})"><path d="M-20,-14H20L0,20Z" fill="#f3ead6" stroke="#c9574a" stroke-width="4" stroke-linejoin="round"/></g>`;
      const cx = W / 2 + (r() - 0.5) * 50;
      s += `<g transform="translate(${f(cx)} ${y0 + 250}) scale(.8)"><circle r="20" fill="#f3ead6" stroke="#c9574a" stroke-width="5"/><text y="7" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="17" fill="${INK}">50</text></g>`;
      // Світлофор із живим зеленим.
      const tx = flip ? W - 46 : 34;
      s += `<g transform="translate(${tx} ${y0 + 230})"><path d="M0,-34V-60" stroke="#3a3640" stroke-width="3"/><rect x="-11" y="-34" width="22" height="58" rx="6" fill="#2c2833" stroke="${INK}" stroke-width="1"/><circle cy="-23" r="6" fill="#5a2a2a"/><circle cy="-5" r="6" fill="#5a4a24"/><circle cy="13" r="6" fill="#7ad08a"><animate attributeName="opacity" values="1;.55;1" dur="2.4s" repeatCount="indefinite"/></circle><circle cy="13" r="18" fill="url(#lampGlow)" opacity=".6"/></g>`;
      // Лампа під стелею.
      const lx = flip ? W / 2 - 60 : W / 2 + 60;
      s += `<g transform="translate(${lx} ${y0 + 330})"><circle r="40" fill="url(#lampGlow)"/><rect x="-18" y="-3" width="36" height="6" rx="3" fill="#f3e3b8" stroke="${INK}" stroke-width=".8"/></g>`;
    }
    s += '</g>';
    // Асфальт із розміткою внизу.
    s += `<rect y="${H - 60}" width="${W}" height="60" fill="#3a3842"/><rect y="${H - 64}" width="${W}" height="6" fill="#5f5b66" stroke="${INK}" stroke-width=".8"/>`;
    s += `<g fill="#f3ead6" opacity=".85">${Array.from({ length: Math.ceil(W / 50) }, (_, i) => `<rect x="${i * 50 + 10}" y="${H - 32}" width="28" height="5" rx="1"/>`).join('')}</g>`;
    return s;
  },
};

/** У змішаному режимі стіни міняють оформлення по черзі — щоб «усе вперемішку» було видно й у декорі. */
export const MIX_ORDER = ['kuchyna', 'dom', 'mesto', 'cas', 'auto'] as const;

export const THEMES: Record<string, WallTheme> = { kuchyna, dom, mesto, cas, auto };
export const themeFor = (themeId: string, wall = 1): WallTheme =>
  THEMES[themeId === 'mix' ? MIX_ORDER[(wall - 1) % MIX_ORDER.length]! : themeId] ?? kuchyna;

/** Спільні градієнти: м'які ореоли без дорогих blur-фільтрів. */
export const SCENERY_DEFS = `<defs>
<linearGradient id="kg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6d8bc"/><stop offset="1" stop-color="#c9b690"/></linearGradient>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f5a"/><stop offset="1" stop-color="#6f78a0"/></linearGradient>
<radialGradient id="lampGlow"><stop offset="0" stop-color="#f0b96a" stop-opacity=".45"/><stop offset=".55" stop-color="#f0b96a" stop-opacity=".12"/><stop offset="1" stop-color="#f0b96a" stop-opacity="0"/></radialGradient>
<radialGradient id="moonGlow"><stop offset="0" stop-color="#efe1b8" stop-opacity=".35"/><stop offset="1" stop-color="#efe1b8" stop-opacity="0"/></radialGradient>
<radialGradient id="reachGlow"><stop offset="0" stop-color="#f0b96a" stop-opacity=".55"/><stop offset=".6" stop-color="#f0b96a" stop-opacity=".2"/><stop offset="1" stop-color="#f0b96a" stop-opacity="0"/></radialGradient>
<radialGradient id="gemGlow"><stop offset="0" stop-color="#6fb6e8" stop-opacity=".6"/><stop offset=".6" stop-color="#6fb6e8" stop-opacity=".22"/><stop offset="1" stop-color="#6fb6e8" stop-opacity="0"/></radialGradient>
</defs>`;

export type HoldState = 'idle' | 'reach' | 'used' | 'hint' | 'bonus' | 'bonusFar' | 'burnt' | 'top';

/** Пульсація: однакова форма, різна фаза — щоб зачепи не блимали в унісон. */
const pulse = (attr: string, a: number, b: number, phase: number) =>
  `<animate attributeName="${attr}" values="${f(a)};${f(b)};${f(a)}" dur="2.1s" begin="-${f(phase)}s" repeatCount="indefinite"/>`;

/** SVG одного зачепа. si — номер форми теми (визначається з індексу зачепа, тож стіна завжди та сама). */
export function holdSvg(theme: WallTheme, state: HoldState, x: number, y: number, si: number, grab = false): string {
  const [shape, col] = theme.shapes[si % theme.shapes.length]!;
  const S = SH[shape];
  const phase = (x * 0.037 + y * 0.011) % 2.1;
  // grab — кінцівка під пальцем «прилипла» до цього зачепа: він збільшується, світлішає й отримує кільце.
  const g = (inner: string, extra = '') =>
    grab
      ? `<g transform="translate(${f(x)} ${f(y)})"${extra}><ellipse rx="26" ry="22" fill="url(#reachGlow)"/><circle r="19" fill="none" stroke="#fff3d6" stroke-width="2"/><g transform="scale(1.45)">${inner}</g></g>`
      : `<g transform="translate(${f(x)} ${f(y)})"${extra}>${inner}</g>`;
  if (state === 'bonus' || state === 'bonusFar') {
    const far = state === 'bonusFar';
    return g(
      `${far ? '' : `<ellipse rx="16" ry="13" fill="url(#gemGlow)">${pulse('rx', 14, 18, phase)}</ellipse>`}<path d="${GEM}" fill="#5aa7e6" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M-8,-2L8,-2M-4,-7L-2,-2L0,8M4,-7L2,-2" fill="none" stroke="#2b5f8f" stroke-width=".7"/><path d="M-4,-7L-2,-2L-8,-2Z" fill="#cde8fa" opacity=".8"/><g transform="translate(0 -15)"><rect x="-9" y="-5.5" width="18" height="11" rx="5.5" fill="#34449a" stroke="${INK}" stroke-width=".8"/><text y="3.4" text-anchor="middle" font-family="Neucha, cursive" font-size="9.5" fill="#f3ead6">+3</text></g>`,
      far ? ' opacity=".5"' : '',
    );
  }
  if (state === 'burnt')
    return g(
      `<path d="${GEM}" fill="#7d8796" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M-3,-7L0,-1L-2,3L1,8" fill="none" stroke="${INK}" stroke-width=".9"/><path d="M2,-10q-3,-3 0,-6q3,-3 0,-6" fill="none" stroke="#cfd3dc" stroke-width="1" opacity=".5"><animateTransform attributeName="transform" type="translate" values="0 0;0 -6" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur="1.6s" repeatCount="indefinite"/></path>`,
    );
  if (state === 'top')
    return g(
      `<path d="M14,-2L14,-30" stroke="${INK}" stroke-width="1.4"/><path d="M14,-30Q22,-28 30,-25Q22,-22 14,-20Z" fill="#c9574a" stroke="${INK}" stroke-width="1"><animateTransform attributeName="transform" type="skewY" values="0;-6;0;5;0" dur="1.4s" repeatCount="indefinite"/></path><g transform="scale(1.9 1.35)"><path d="${SH.pebble.d}" fill="${col}" stroke="${INK}" stroke-width=".8"/><path d="M-6,-4Q0,-7 5,-5" fill="none" stroke="#fff" stroke-width="1" opacity=".45"/></g>`,
    );
  const sty = {
    idle: { o: 0.5, sw: 1, glow: false },
    reach: { o: 1, sw: 1.3, glow: true },
    used: { o: 0.85, sw: 1.2, glow: false },
    hint: { o: 1, sw: 1.3, glow: true },
  }[state];
  let s = '';
  if (sty.glow) s += `<ellipse rx="15" ry="12" fill="url(#reachGlow)">${pulse('rx', 13, 17, phase)}</ellipse>`;
  s += `<path d="${S.d}" fill="${col}" fill-opacity="${sty.o}" stroke="${INK}" stroke-width="${sty.sw}" stroke-opacity="${state === 'idle' ? 0.55 : 1}" stroke-linejoin="round"/>`;
  if (S.x) s += `<g fill="${INK}" stroke="${INK}" opacity="${state === 'idle' ? 0.25 : 0.45}">${S.x}</g>`;
  if (state !== 'idle')
    s += `<path d="M-6,-4.5Q-1,-7 4,-5.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>`;
  else s += `<path d="${S.d}" fill="#1c1a2b" opacity=".18"/>`;
  if (state === 'used')
    s += `<circle cx="-3" cy="-1" r="1.3" fill="#fff" opacity=".6"/><circle cx="2" cy="1" r="1" fill="#fff" opacity=".5"/><circle cx="5" cy="-2" r=".8" fill="#fff" opacity=".5"/>`;
  if (state === 'hint')
    s += `<circle r="16" fill="none" stroke="#f0b96a" stroke-width="1.6" stroke-dasharray="3 3">${pulse('r', 15, 19, 0)}</circle>`;
  return g(s);
}
