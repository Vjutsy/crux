/** Скелелази на вибір: лише зовнішність, фізика однакова (погоджено). */
export interface Climber {
  id: string;
  name: string;
  shirt: number;
  skin: number;
  hair: number;
  /** Каска замість волосся. */
  helmet?: number;
}

export const climbers: Climber[] = [
  { id: 'iva', name: 'Іва', shirt: 0xff8a1f, skin: 0xf2c9a5, hair: 0x6b3e26 },
  { id: 'martin', name: 'Мартин', shirt: 0x22a855, skin: 0xe0ac85, hair: 0x2b2b2b, helmet: 0xe8323c },
  { id: 'bo', name: 'Бо', shirt: 0xe8323c, skin: 0x9a6a48, hair: 0x1b1b1b },
];

export const getClimber = (id: string) => climbers.find((c) => c.id === id) ?? climbers[0]!;
