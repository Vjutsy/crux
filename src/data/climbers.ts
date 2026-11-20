/**
 * Скелелази на вибір: лише зовнішність, фізика однакова (погоджено).
 * Палітри й крій — з моделі «Crux — модель скелелаза» (казковий книжковий стиль, вид ззаду).
 */
export interface Climber {
  id: string;
  name: string;
  note: string;
  cap: Cap;
  hat: string;
  band: string;
  pom: string;
  sweater: string;
  sweaterDk: string;
  scarf: string;
  stripe: string;
  skin: string;
  blush: string;
  hair: string;
  legs: string;
  boots: string;
  braid?: boolean;
  /** Дві коси по боках (вікінг). */
  braids2?: boolean;
  /** Що на шиї: шарф (як було), хустинка, комір скафандра або нічого. */
  neck?: 'scarf' | 'kerchief' | 'collar' | 'none';
  /** Горизонтальні смуги на светрі. */
  bands?: { color: string; n: number };
  extras?: Extra[];
  /** Колір накидки / хвоста / ранця. */
  accent?: string;
  accentDk?: string;
  /** Зірочки, шипи, вогник. */
  spark?: string;
}

export type Cap = 'stocking' | 'beanie' | 'helmet' | 'fox' | 'frog' | 'astro' | 'bee' | 'chef' | 'wizard' | 'viking' | 'dino';
export type Extra = 'tail-fox' | 'tail-dino' | 'cape' | 'fur' | 'wings' | 'pack' | 'spikes';

export const climbers: Climber[] = [
  {
    id: 'iva',
    name: 'Іва',
    note: 'Довга шапка з помпоном і косичка',
    cap: 'stocking',
    hat: '#3f7a7a',
    band: '#2e5d5e',
    pom: '#efe3c6',
    sweater: '#d98b52',
    sweaterDk: '#a3603a',
    scarf: '#efe3c6',
    stripe: '#c9574a',
    skin: '#f3d6bd',
    blush: '#e79a8f',
    hair: '#5b3a2b',
    legs: '#3b3550',
    boots: '#6e4b3a',
    braid: true,
  },
  {
    id: 'martin',
    name: 'Мартин',
    note: 'Каска з ремінцем — обережний',
    cap: 'helmet',
    hat: '#b8524b',
    band: '#8c3b36',
    pom: '#b8524b',
    sweater: '#7a9a5e',
    sweaterDk: '#55703f',
    scarf: '#e8d49a',
    stripe: '#3f6f73',
    skin: '#e3b892',
    blush: '#d98a78',
    hair: '#2e2a2a',
    legs: '#2f3a44',
    boots: '#5a4636',
  },
  {
    id: 'bo',
    name: 'Бо',
    note: 'Коротка шапка й великий шарф',
    cap: 'beanie',
    hat: '#4a4670',
    band: '#36335a',
    pom: '#d9c6a2',
    sweater: '#b9524f',
    sweaterDk: '#863634',
    scarf: '#d9c6a2',
    stripe: '#4a4670',
    skin: '#9b6b4a',
    blush: '#c0705f',
    hair: '#1d1b1f',
    legs: '#2e2b38',
    boots: '#4f3d33',
  },
];

export const getClimber = (id: string) => climbers.find((c) => c.id === id) ?? climbers[0]!;
