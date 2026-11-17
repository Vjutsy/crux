/**
 * Реєстр груп слів. Нову групу додаємо JSON-файлом у content/sk/ — сюди вона підхоплюється автоматично.
 * Схема перевіряється при завантаженні й у тестах (CI), тож зламаний файл не потрапить у реліз.
 */
import { WordGroup } from './schema';

const files = import.meta.glob<{ default: unknown }>('./sk/*.json', { eager: true });

export const groups: WordGroup[] = Object.entries(files)
  .map(([path, mod]) => {
    const parsed = WordGroup.safeParse(mod.default);
    if (!parsed.success) throw new Error(`Помилка в ${path}: ${parsed.error.message}`);
    return parsed.data;
  })
  .sort((a, b) => a.themeId.localeCompare(b.themeId) || a.cefr.localeCompare(b.cefr));

export const getGroup = (id: string) => groups.find((g) => g.id === id);
