/**
 * Картка питання — DOM-оверлей поверх canvas: нативна клавіатура, коректна діакритика, доступність.
 * Без таймера (погоджено із замовником). Помилка — картка відлітає вгору.
 */
import { SK_DIACRITICS, checkTyped, type CheckResult } from '../core/answer';
import type { Question } from '../core/questions';

export interface CardResult {
  correct: boolean;
  /** Для вписування: 'accepted' — зараховано, але треба показати правильну форму. */
  check?: CheckResult;
  given: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const HINTS: Record<Question['mode'], string> = {
  'choice-sk-ua': 'Оберіть переклад',
  'choice-ua-sk': 'Оберіть словацьке слово',
  'typing-ua-sk': '✎ Впишіть словацькою',
  'typing-sk-ua': '✎ Впишіть українською',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Скасування відкритої картки (вихід у меню посеред питання). */
let cancelOpen: (() => void) | null = null;

/** Ховає відкриту картку без відповіді; її проміс так і не завершиться — стара стіна вже неактивна. */
export function closeQuestion() {
  cancelOpen?.();
  cancelOpen = null;
}

export function askQuestion(q: Question, opts: { requireDiacritics: boolean; limbName: string }): Promise<CardResult> {
  const card = $<HTMLDivElement>('card');
  const answers = $<HTMLDivElement>('card-answers');
  $('card-hint').textContent = `${HINTS[q.mode]} · ${opts.limbName}`;
  $('card-prompt').textContent = q.prompt;
  card.className = 'card';
  card.hidden = false;
  document.getElementById('toast')?.classList.remove('on');

  const typing = q.mode.startsWith('typing');
  const toSk = q.mode === 'typing-ua-sk';
  if (typing) {
    answers.className = 'answers typing';
    answers.innerHTML =
      `<input id="card-input" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Відповідь" lang="${toSk ? 'sk' : 'uk'}">` +
      `<button type="button" class="ok">OK</button>` +
      (toSk
        ? `<div class="keys">${SK_DIACRITICS.map((ch) => `<button type="button" data-key="${ch}">${ch}</button>`).join('')}</div>`
        : '');
  } else {
    answers.className = 'answers';
    answers.innerHTML = q
      .options!.map((o, i) => `<button type="button" class="opt" data-i="${i}" aria-label="${'abcd'[i]}: ${esc(o)}">${esc(o)}</button>`)
      .join('');
  }

  return new Promise((resolve) => {
    const input = document.getElementById('card-input') as HTMLInputElement | null;
    // Клавіатура телефона не має перекривати картку.
    const vv = window.visualViewport;
    const place = () => {
      if (vv) card.style.top = `${Math.max(12, vv.offsetTop + vv.height * 0.12)}px`;
    };
    vv?.addEventListener('resize', place);
    place();
    input?.focus();

    let done = false;
    cancelOpen = () => {
      done = true;
      answers.onclick = null;
      vv?.removeEventListener('resize', place);
      card.style.top = '';
      card.hidden = true;
      answers.innerHTML = '';
    };
    const finish = (res: CardResult) => {
      if (done) return;
      done = true;
      cancelOpen = null;
      answers.onclick = null;
      vv?.removeEventListener('resize', place);
      card.style.top = '';
      card.classList.add(res.correct ? 'good' : 'fly');
      setTimeout(
        () => {
          card.hidden = true;
          resolve(res);
        },
        res.correct ? 280 : 800,
      );
    };
    const submitTyped = () => {
      const given = input?.value ?? '';
      const check = checkTyped(given, q.expected, { requireDiacritics: opts.requireDiacritics });
      finish({ correct: check !== 'wrong', check, given });
    };
    answers.onclick = (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.key && input) {
        const s = input.selectionStart ?? input.value.length;
        input.setRangeText(b.dataset.key, s, input.selectionEnd ?? s, 'end');
        input.focus();
      } else if (b.classList.contains('ok')) submitTyped();
      else if (b.dataset.i) {
        const given = q.options![Number(b.dataset.i)]!;
        finish({ correct: q.expected.includes(given), given });
      }
    };
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitTyped();
    });
  });
}
