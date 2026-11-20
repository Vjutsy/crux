/**
 * Реєстр груп слів. Нову групу додаємо JSON-файлом у content/sk/ — сюди вона підхоплюється автоматично.
 * Схема перевіряється при завантаженні й у тестах (CI), тож зламаний файл не потрапить у реліз.
 */
import { WordGroup } from './schema';

const files = import.meta.glob<{ default: unknown }>('./sk/*.json', { eager: true });

const themed: WordGroup[] = Object.entries(files)
  .map(([path, mod]) => {
    const parsed = WordGroup.safeParse(mod.default);
    if (!parsed.success) throw new Error(`Помилка в ${path}: ${parsed.error.message}`);
    return parsed.data;
  })
  .sort((a, b) => a.themeId.localeCompare(b.themeId) || a.cefr.localeCompare(b.cefr));

/**
 * Змішаний режим «Усе вперемішку»: слова всіх тем — окремо для кожного рівня і разом «усі рівні».
 * Це звичайні групи (свої зірки, свої стіни); оформлення стін чергується між темами (backgrounds.themeFor).
 */
export const MIX_THEME = 'Усе вперемішку';
const levels = [...new Set(themed.map((g) => g.cefr))];
const mix = (cefr: WordGroup['cefr'], words: WordGroup['words']): WordGroup => ({
  id: `mix-${cefr.toLowerCase()}`,
  themeId: 'mix',
  theme: MIX_THEME,
  cefr,
  words,
});
export const groups: WordGroup[] = [
  ...themed,
  ...levels.map((c) =>
    mix(
      c,
      themed.filter((g) => g.cefr === c).flatMap((g) => g.words),
    ),
  ),
  mix(
    'ALL',
    themed.flatMap((g) => g.words),
  ),
];

/** Як показувати рівень у меню й на листівці. */
export const cefrLabel = (c: WordGroup['cefr']) => (c === 'ALL' ? 'Усі' : c);

export const getGroup = (id: string) => groups.find((g) => g.id === id);
