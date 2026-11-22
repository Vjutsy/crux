import { describe, expect, it } from 'vitest';
import { climbers } from '../src/data/climbers';
import { draftSkins, lookOf, newlyUnlocked, skins, skinsOf, totalStars } from '../src/data/skins';
import { drawClimber } from '../src/ui/climberArt';

describe('скіни', () => {
  it('8 скінів: Іва 3, Мартин 3, Бо 2; пороги 3…60 зірок', () => {
    expect(skins).toHaveLength(8);
    expect(skinsOf('iva').map((s) => s.id)).toEqual(['fox', 'bee', 'astro']);
    expect(skinsOf('martin').map((s) => s.id)).toEqual(['chef', 'dino', 'viking']);
    expect(skinsOf('bo').map((s) => s.id)).toEqual(['frog', 'wizard']);
    const needs = skins.map((s) => s.need).sort((a, b) => a - b);
    expect(needs[0]).toBe(3);
    expect(needs.at(-1)).toBe(60);
    expect(new Set(needs).size).toBe(8);
  });

  it('пороги чергуються: перші три скіни — різним скелелазам', () => {
    const first = [...skins].sort((a, b) => a.need - b.need).slice(0, 3);
    expect(new Set(first.map((s) => s.owner)).size).toBe(3);
  });

  it('зірки рахуються з найкращих результатів стін', () => {
    expect(totalStars({ 'a#1': 3, 'a#2': 1, 'b#1': 2 })).toBe(6);
  });

  it('newlyUnlocked — лише ті, що відкрились саме зараз', () => {
    expect(newlyUnlocked(0, 3).map((s) => s.id)).toEqual(['fox']);
    expect(newlyUnlocked(3, 5)).toEqual([]);
    expect(newlyUnlocked(5, 12).map((s) => s.id)).toEqual(['chef', 'frog']);
  });

  it('lookOf: закритий або чужий скін не вдягається', () => {
    expect(lookOf('iva', { iva: 'fox' }, 2).cap).toBe('stocking');
    expect(lookOf('iva', { iva: 'fox' }, 3).cap).toBe('fox');
    expect(lookOf('iva', { iva: 'chef' }, 99).cap).toBe('stocking');
    // Ім'я лишається ім'ям скелелаза.
    expect(lookOf('iva', { iva: 'fox' }, 3).name).toBe('Іва');
  });

  it('кожен скін і скелелаз малюється без помилок і з чимось своїм', () => {
    const c = { x: 200, y: 150 };
    const ends = [
      { x: 170, y: 92 },
      { x: 228, y: 94 },
      { x: 180, y: 226 },
      { x: 220, y: 222 },
    ];
    const svgs = [...climbers, ...skins].map((p) => drawClimber(p, c, ends, 1.3, { tired: 0.5 }));
    for (const s of svgs) expect(s).not.toMatch(/NaN|undefined/);
    expect(new Set(svgs).size).toBe(svgs.length);
  });

  it('чернетки Пінгвін і Комета малюються, але ще не в грі', () => {
    expect(draftSkins.map((s) => s.id)).toEqual(['penguin', 'comet']);
    for (const d of draftSkins) {
      expect(skins.some((s) => s.id === d.id)).toBe(false);
      const svg = drawClimber(
        { ...d },
        { x: 100, y: 100 },
        [
          { x: 70, y: 50 },
          { x: 130, y: 50 },
          { x: 80, y: 170 },
          { x: 120, y: 170 },
        ],
        1,
      );
      expect(svg.length).toBeGreaterThan(1000);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('undefined');
    }
  });
});
