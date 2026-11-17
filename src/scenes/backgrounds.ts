/** Процедурні фони стін під тему групи слів (без файлів-картинок). */
import type Phaser from 'phaser';

export interface WallTheme {
  base: number;
  /** Колір неактивних зачепів — має контрастувати з фоном. */
  idle: number;
  draw(g: Phaser.GameObjects.Graphics, w: number, h: number): void;
}

const bolts = (g: Phaser.GameObjects.Graphics, w: number, h: number, color: number) => {
  g.fillStyle(color, 1);
  for (let y = 15; y < h; y += 30) for (let x = 15; x < w; x += 30) g.fillCircle(x, y, 2);
};

export const THEMES: Record<string, WallTheme> = {
  // Кухня: біла плитка зі швами.
  kuchyna: {
    base: 0xf4f1ea,
    idle: 0x55575e,
    draw(g, w, h) {
      g.lineStyle(1.5, 0xd9d3c4, 1);
      for (let y = 0; y < h; y += 26) g.lineBetween(0, y, w, y);
      for (let y = 0, row = 0; y < h; y += 26, row++) for (let x = row % 2 ? 13 : 0; x < w; x += 26) g.lineBetween(x, y, x, y + 26);
      g.fillStyle(0xe7e0d0, 1);
      for (let y = 13; y < h; y += 104) g.fillRect(0, y - 2, w, 4);
    },
  },
  // Дім: шпалери у смужку з дрібним візерунком.
  dom: {
    base: 0xefe6da,
    idle: 0x5a4f46,
    draw(g, w, h) {
      g.fillStyle(0xe6d9c8, 1);
      for (let x = 0; x < w; x += 36) g.fillRect(x, 0, 14, h);
      g.fillStyle(0xd7c3ad, 1);
      for (let y = 18; y < h; y += 36) for (let x = 25; x < w; x += 36) g.fillCircle(x, y, 2.5);
    },
  },
  // Місто: цегляна стіна.
  mesto: {
    base: 0xd8b9a3,
    idle: 0x3e3530,
    draw(g, w, h) {
      const shades = [0xd8b9a3, 0xcfa98f, 0xdcc0ab, 0xc9a38a];
      for (let y = 0, row = 0; y < h; y += 18, row++)
        for (let x = row % 2 ? -18 : 0, col = 0; x < w; x += 36, col++) {
          g.fillStyle(shades[(row * 7 + col * 3) % shades.length]!, 1).fillRect(x, y, 36, 18);
        }
      g.lineStyle(2, 0xeee2d6, 1);
      for (let y = 0; y < h; y += 18) g.lineBetween(0, y, w, y);
      for (let y = 0, row = 0; y < h; y += 18, row++) for (let x = row % 2 ? 18 : 0; x < w; x += 36) g.lineBetween(x, y, x, y + 18);
    },
  },
  // Числа, час, погода: скеля під небом з хмарами.
  cas: {
    base: 0xcfdcea,
    idle: 0x334155,
    draw(g, w, h) {
      g.fillStyle(0xeef3f8, 1);
      for (let y = 60; y < h; y += 170) {
        const x = (y * 37) % (w - 80);
        g.fillCircle(x + 20, y, 16)
          .fillCircle(x + 42, y - 8, 20)
          .fillCircle(x + 64, y, 15)
          .fillRect(x + 20, y, 44, 15);
      }
      g.fillStyle(0xb8c7d8, 1);
      for (let y = 0; y < h; y += 90) g.fillTriangle(0, y, 26, y + 45, 0, y + 90).fillTriangle(w, y + 45, w - 22, y + 90, w, y + 135);
    },
  },
};

const FALLBACK: WallTheme = {
  base: 0xe9e5db,
  idle: 0x55575e,
  draw: (g, w, h) => bolts(g, w, h, 0xcfc9bb),
};

export const themeFor = (themeId: string): WallTheme => THEMES[themeId] ?? FALLBACK;
