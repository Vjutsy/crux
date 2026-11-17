import { z } from 'zod';
import raw from './walls.json';

export const WallConfig = z.object({
  wall: z.number().int().min(1),
  /** Цільова кількість рухів кінцівками до вершини (2–5 хв гри). */
  moves: z.number().int().min(8),
  /** Кроки на старті = частка довжини еталонного маршруту (менше 1 — без бонусів не дійти). */
  stepFactor: z.number().min(0.3).max(2),
  /** Частка питань із вписуванням. */
  typingShare: z.number().min(0).max(1),
  requireDiacritics: z.boolean(),
});
export type WallConfig = z.infer<typeof WallConfig>;

export const walls: WallConfig[] = z.array(WallConfig).parse(raw);
export const getWall = (n: number) => walls.find((w) => w.wall === n) ?? walls[0]!;
