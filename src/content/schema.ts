import { z } from 'zod';

export const PartOfSpeech = z.enum(['noun', 'verb', 'adj', 'adv', 'num', 'pron', 'prep', 'phrase', 'other']);
export const Cefr = z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1']);

export const Word = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id: латиниця в нижньому регістрі, цифри, дефіс'),
  /** Словацьке слово з діакритикою, як у словнику SAV. */
  sk: z.string().min(1),
  ua: z.string().min(1),
  pos: PartOfSpeech,
  /** Рід іменника: m — чоловічий, f — жіночий, n — середній. */
  gender: z.enum(['m', 'f', 'n']).optional(),
  /** Інші прийнятні відповіді при вписуванні. */
  skAlt: z.array(z.string()).optional(),
  uaAlt: z.array(z.string()).optional(),
});

export const WordGroup = z
  .object({
    id: z.string(),
    themeId: z.string(),
    theme: z.string(),
    cefr: Cefr,
    words: z.array(Word).min(20, 'у групі має бути щонайменше 20 слів'),
  })
  .superRefine((g, ctx) => {
    const ids = new Set<string>();
    for (const w of g.words) {
      if (ids.has(w.id)) ctx.addIssue({ code: 'custom', message: `дубль id: ${w.id}` });
      ids.add(w.id);
    }
  });

export type Word = z.infer<typeof Word>;
export type WordGroup = z.infer<typeof WordGroup>;
