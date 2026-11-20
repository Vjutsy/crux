/**
 * Скіни скелелазів — з полотна «Crux — скіни скелелазів». Лише вбрання й кольори, фізика та сама.
 * У кожного скелелаза свої скіни (погоджено 20.11): Іва — Лисичка, Бджілка, Космонавтка;
 * Мартин — Шеф, Динозаврик, Вікінг; Бо — Жабка, Чарівник.
 * Відкриваються за загальну кількість зірок; пороги чергуються між скелелазами, щоб кожен рано отримав перший скін.
 */
import { type Climber, climbers, getClimber } from './climbers';

export interface Skin extends Climber {
  /** Чий це скін. */
  owner: string;
  /** Скільки зірок усього треба, щоб відкрити. */
  need: number;
}

const base = { skin: '#f3d6bd', blush: '#e79a8f', scarf: '#efe3c6', stripe: '#c9574a', band: '#2e5d5e', pom: '#efe3c6' };

export const skins: Skin[] = [
  {
    ...base,
    id: 'fox',
    owner: 'iva',
    need: 3,
    name: 'Лисичка',
    note: 'Каптур із вушками й пухнастий хвіст',
    cap: 'fox',
    hat: '#e07a3a',
    pom: '#f6e7cf',
    sweater: '#c8643a',
    sweaterDk: '#9a4a2a',
    hair: '#7a3e22',
    legs: '#3b2f3a',
    boots: '#5a3a2a',
    neck: 'none',
    extras: ['tail-fox'],
    accent: '#e07a3a',
  },
  {
    ...base,
    id: 'chef',
    owner: 'martin',
    need: 6,
    name: 'Шеф',
    note: 'Високий ковпак і червона хустинка',
    cap: 'chef',
    hat: '#ffffff',
    band: '#ece6da',
    sweater: '#f4f1ea',
    sweaterDk: '#cfc8bb',
    scarf: '#d1453b',
    skin: '#e3b892',
    blush: '#d98a78',
    hair: '#2e2a2a',
    legs: '#2e2b38',
    boots: '#2e2b38',
    neck: 'kerchief',
  },
  {
    ...base,
    id: 'frog',
    owner: 'bo',
    need: 10,
    name: 'Жабка',
    note: 'Очі на каптурі дивляться на тебе, жовті гумаки',
    cap: 'frog',
    hat: '#79a85a',
    pom: '#f6f3e6',
    sweater: '#5e8f45',
    sweaterDk: '#456c33',
    scarf: '#e8c14a',
    skin: '#9b6b4a',
    blush: '#c0705f',
    hair: '#1d1b1f',
    legs: '#3e5a35',
    boots: '#e8c14a',
    neck: 'kerchief',
  },
  {
    ...base,
    id: 'bee',
    owner: 'iva',
    need: 15,
    name: 'Бджілка',
    note: 'Смугастий светр, вусики й крильця, що тріпочуть',
    cap: 'bee',
    hat: '#2a2430',
    band: '#2a2430',
    pom: '#f2c230',
    sweater: '#f2c230',
    sweaterDk: '#c99a1c',
    hair: '#5b3a2b',
    braid: true,
    legs: '#2a2430',
    boots: '#f2c230',
    neck: 'none',
    bands: { color: '#2a2430', n: 3 },
    extras: ['wings'],
  },
  {
    ...base,
    id: 'dino',
    owner: 'martin',
    need: 25,
    name: 'Динозаврик',
    note: 'Шипи від маківки до кінчика хвоста',
    cap: 'dino',
    hat: '#6aa35a',
    sweater: '#5c9150',
    sweaterDk: '#457040',
    skin: '#e3b892',
    blush: '#d98a78',
    hair: '#2e2a2a',
    legs: '#3f6b3a',
    boots: '#4f7f45',
    neck: 'none',
    extras: ['spikes', 'tail-dino'],
    accent: '#6aa35a',
    spark: '#f0c24a',
  },
  {
    ...base,
    id: 'wizard',
    owner: 'bo',
    need: 35,
    name: 'Чарівник',
    note: 'Капелюх-ріжок і зоряна мантія, що майорить',
    cap: 'wizard',
    hat: '#4a3a8a',
    band: '#e8c14a',
    sweater: '#6b4f9e',
    sweaterDk: '#4f3878',
    skin: '#9b6b4a',
    blush: '#c0705f',
    hair: '#1d1b1f',
    legs: '#2e2a4a',
    boots: '#5a3e2a',
    neck: 'none',
    extras: ['cape'],
    accent: '#2e2a5e',
    accentDk: '#221f48',
    spark: '#f3d36b',
  },
  {
    ...base,
    id: 'astro',
    owner: 'iva',
    need: 45,
    name: 'Космонавтка',
    note: 'Скляний шолом, ранець із вогником',
    cap: 'astro',
    hat: '#cfe8ff',
    sweater: '#eef0f4',
    sweaterDk: '#c3c9d4',
    hair: '#5b3a2b',
    braid: true,
    stripe: '#e8833a',
    legs: '#dfe3ea',
    boots: '#8f99a8',
    neck: 'collar',
    bands: { color: '#e8833a', n: 1 },
    extras: ['pack'],
    accent: '#d9dde6',
    spark: '#ff5a4a',
  },
  {
    ...base,
    id: 'viking',
    owner: 'martin',
    need: 60,
    name: 'Вікінг',
    note: 'Рогатий шолом, дві коси й хутряна накидка',
    cap: 'viking',
    hat: '#9aa3ad',
    band: '#7a828c',
    pom: '#efe3c6',
    sweater: '#7a4a3a',
    sweaterDk: '#5a3428',
    skin: '#e3b892',
    blush: '#d98a78',
    hair: '#e2b25a',
    braids2: true,
    legs: '#4a3f35',
    boots: '#5a3e2a',
    neck: 'none',
    extras: ['fur'],
    accent: '#8a6a4a',
    accentDk: '#b89470',
  },
];

/** Усього зірок: найкращий результат кожної стіни кожної групи. */
export const totalStars = (stars: Record<string, number>) => Object.values(stars).reduce((a, b) => a + b, 0);

export const skinsOf = (climberId: string) => skins.filter((s) => s.owner === climberId).sort((a, b) => a.need - b.need);
export const unlocked = (s: Skin, total: number) => total >= s.need;

/** Скіни, що відкрились саме зараз: було менше зірок, стало досить. */
export const newlyUnlocked = (before: number, after: number) => skins.filter((s) => before < s.need && after >= s.need);

/** Як виглядає скелелаз: вибраний (і відкритий) скін або базове вбрання. */
export function lookOf(climberId: string, chosen: Record<string, string>, total: number): Climber {
  const c = getClimber(climberId);
  const s = skins.find((x) => x.id === chosen[climberId] && x.owner === c.id);
  return s && unlocked(s, total) ? { ...s, id: c.id, name: c.name } : c;
}

/** Ім'я скелелаза, якому належить скін. */
export const ownerName = (s: Skin) => climbers.find((c) => c.id === s.owner)?.name ?? '';
