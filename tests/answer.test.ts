import { describe, expect, it } from 'vitest';
import { checkTyped, editDistance } from '../src/core/answer';

describe('перевірка вписаного', () => {
  const lenient = { requireDiacritics: false };
  const strict = { requireDiacritics: true };

  it('точний збіг, регістр і пробіли не важливі', () => {
    expect(checkTyped('  Lyžica ', ['lyžica'], strict)).toBe('exact');
  });
  it('на ранніх стінах без діакритики — зараховано', () => {
    expect(checkTyped('lyzica', ['lyžica'], lenient)).toBe('accepted');
  });
  it('з 6-ї стіни діакритика обов’язкова', () => {
    expect(checkTyped('lyzica', ['lyžica'], strict)).toBe('accepted'); // 1 «одрук» у слові з 6 літер
    expect(checkTyped('lizyca', ['lyžica'], strict)).toBe('wrong');
  });
  it('1 одрук прощається лише для довгих слів', () => {
    expect(checkTyped('chladnicka', ['chladnička'], strict)).toBe('accepted');
    expect(checkTyped('caj', ['čaj'], strict)).toBe('wrong');
    expect(checkTyped('caj', ['čaj'], lenient)).toBe('accepted');
  });
  it('альтернативні відповіді', () => {
    expect(checkTyped('юшка', ['суп', 'юшка'], strict)).toBe('exact');
  });
  it('порожня відповідь — неправильна', () => {
    expect(checkTyped('   ', ['voda'], lenient)).toBe('wrong');
  });
  it('відстань Дамерау–Левенштейна враховує перестановку', () => {
    expect(editDistance('tanier', 'tainer')).toBe(1);
  });
});
