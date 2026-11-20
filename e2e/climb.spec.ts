import { type Page, expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '../src/content/sk');
const words: { sk: string; ua: string }[] = readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).words);
const answerFor = (prompt: string) => {
  const w = words.find((x) => x.sk === prompt || x.ua === prompt)!;
  return w.sk === prompt ? w.ua : w.sk;
};

/** Наступний хід маршруту в екранних координатах (через ?debug-доступ до сцени). */
async function nextMove(page: Page) {
  return page.evaluate(() => {
    type Scene = {
      s: { status: string; wall: { holds: { x: number; y: number }[] } };
      busy: boolean;
      selected: number | null;
      hint(): { limb: number; hold: number } | null;
      toScreen(p: { x: number; y: number }): { x: number; y: number };
    };
    const game = (window as unknown as { crux: { scene: { getScene(k: string): Scene } } }).crux;
    const sc = game.scene.getScene('climb');
    if (!sc?.s) return { status: 'loading' };
    if (sc.s.status !== 'climbing' || sc.busy) return { status: sc.busy && sc.s.status === 'climbing' ? 'busy' : sc.s.status };
    const m = sc.hint();
    if (!m) return { status: 'nohint' };
    sc.selected = m.limb;
    return { status: 'climbing', ...sc.toScreen(sc.s.wall.holds[m.hold]!) };
  });
}

async function climb(page: Page, wrongFirst: number) {
  let questions = 0;
  for (let guard = 0; guard < 400; guard++) {
    const st = await nextMove(page);
    if (st.status === 'won' || st.status === 'fallen' || st.status === 'nohint') return st.status;
    if (st.status !== 'climbing' || !('x' in st)) {
      await page.waitForTimeout(150);
      continue;
    }
    await page.mouse.click(st.x, st.y);
    const card = page.locator('#card');
    // Питання з'являється лише на синіх бонусних зачепах.
    const asked = await card
      .waitFor({ state: 'visible', timeout: 500 })
      .then(() => true)
      .catch(() => false);
    if (!asked) {
      await page.waitForTimeout(150);
      continue;
    }
    const answer = answerFor(await page.locator('#card-prompt').innerText());
    const wrong = questions < wrongFirst;
    if (await page.locator('#card-input').isVisible()) {
      await page.locator('#card-input').fill(wrong ? 'xxx' : answer);
      await page.locator('.answers .ok').click();
    } else {
      const opts = page.locator('.answers .opt');
      const texts = await opts.allInnerTexts();
      const i = texts.findIndex((t) => (t === answer) !== wrong);
      await opts.nth(i).click();
    }
    questions++;
    await expect(card).toBeHidden();
  }
  return 'timeout';
}

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug');
  // Перше відкриття — вступ; пропускаємо його до меню.
  await expect(page.getByRole('heading', { name: 'Лізь угору' })).toBeVisible();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await expect(page.getByRole('heading', { name: 'Crux' })).toBeVisible();
});

test.afterEach(() => {
  expect(errors, 'помилки JavaScript на сторінці').toEqual([]);
});

test('стіна 1 без помилок — вершина і 3 зірки', async ({ page }) => {
  await page.getByRole('button', { name: 'Грати' }).click();
  await page.getByRole('button', { name: 'Лізти!' }).click();
  expect(await climb(page, 0)).toBe('won');
  await expect(page.locator('#result')).toContainText('Вершина!');
  await expect(page.locator('#result')).toContainText('★★★');
  // Наступна стіна відкрилась.
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: 'Грати' }).click();
  await expect(page.getByRole('button', { name: 'Рівень 2', exact: true })).toBeEnabled();
});

test('самі помилки — падіння і список слів', async ({ page }) => {
  await page.getByRole('button', { name: 'Грати' }).click();
  await page.getByRole('button', { name: 'Числа, час, погода' }).click();
  await page.getByRole('button', { name: 'Лізти!' }).click();
  expect(await climb(page, 99)).toBe('fallen');
  await expect(page.locator('#result')).toContainText('Зірвався');
  await expect(page.locator('#result .mistakes li').first()).toBeVisible();
  // «Ще раз» після падіння: стіна й скелелаз на місці, можна лізти далі (раніше лишався порожній екран).
  await page.getByRole('button', { name: 'Ще раз' }).click();
  await expect(page.locator('#scenery #sc-holds > *').first()).toBeAttached();
  await expect(page.locator('#actor > *').first()).toBeAttached();
  await page.waitForTimeout(500);
  const st = await nextMove(page);
  expect(st.status).toBe('climbing');
  if ('x' in st) await page.mouse.click(st.x, st.y);
  // Хід зараховано — або відкрилось питання (якщо цей зачіп синій, хід рахується після відповіді).
  const moved = () =>
    page.evaluate(
      () =>
        (window as unknown as { crux: { scene: { getScene(k: string): { s: { moves: number } } } } }).crux.scene.getScene('climb').s.moves >
        0,
    );
  await expect.poll(async () => (await page.locator('#card').isVisible()) || (await moved())).toBe(true);
});

test('вибір скелелаза — тапом по ньому в меню', async ({ page }) => {
  await page.getByRole('button', { name: /Скелелаз: Іва/ }).click();
  await page.getByRole('button', { name: 'Бо' }).click();
  await expect(page.getByRole('button', { name: /Скелелаз: Бо/ })).toBeVisible();
  // Вступ більше не показується.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Crux' })).toBeVisible();
});

test('перше відкриття — вступ веде одразу на першу стіну', async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/?debug');
  for (const name of ['Далі', 'Далі', 'Перша стіна']) await page.getByRole('button', { name }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('Торкніться зачепа з пунктирним кільцем');
  await page.close();
});

test('руку чи ногу можна перетягнути до зачепа', async ({ page }) => {
  await page.getByRole('button', { name: 'Грати' }).click();
  await page.getByRole('button', { name: 'Лізти!' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForTimeout(800);
  // Беремо наступний хід маршруту, але виконуємо його перетягуванням кінцівки, а не тапом.
  const plan = await page.evaluate(() => {
    type Scene = {
      s: { wall: { holds: { x: number; y: number }[] }; contacts: number[]; bonus: Set<number> };
      disp: { ends: { x: number; y: number }[] };
      hint(): { limb: number; hold: number } | null;
      toScreen(p: { x: number; y: number }): { x: number; y: number };
    };
    const sc = (window as unknown as { crux: { scene: { getScene(k: string): Scene } } }).crux.scene.getScene('climb');
    const m = sc.hint()!;
    return {
      from: sc.toScreen(sc.s.wall.holds[sc.s.contacts[m.limb]!]!),
      to: sc.toScreen(sc.s.wall.holds[m.hold]!),
      hold: m.hold,
      limb: m.limb,
      bonus: sc.s.bonus.has(m.hold),
    };
  });
  await page.mouse.move(plan.from.x, plan.from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(plan.from.x + ((plan.to.x - plan.from.x) * i) / 10, plan.from.y + ((plan.to.y - plan.from.y) * i) / 10);
  await page.mouse.up();
  if (plan.bonus) await expect(page.locator('#card')).toBeVisible();
  else
    await expect
      .poll(() =>
        page.evaluate(
          ([limb]) =>
            (window as unknown as { crux: { scene: { getScene(k: string): { s: { contacts: number[] } } } } }).crux.scene.getScene('climb')
              .s.contacts[limb!],
          [plan.limb],
        ),
      )
      .toBe(plan.hold);
});

test('вихід у меню посеред питання — картка зникає й не заважає новій стіні', async ({ page }) => {
  await page.getByRole('button', { name: 'Грати' }).click();
  await page.getByRole('button', { name: 'Лізти!' }).click();
  const card = page.locator('#card');
  for (let i = 0; i < 40 && !(await card.isVisible()); i++) {
    const st = await nextMove(page);
    if ('x' in st) await page.mouse.click(st.x, st.y);
    await page.waitForTimeout(300);
  }
  await expect(card).toBeVisible();
  await page.locator('#hud-menu').click();
  await expect(card).toBeHidden();
  await page.getByRole('button', { name: 'Грати' }).click();
  await page.getByRole('button', { name: 'Лізти!' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(card).toBeHidden();
  expect((await nextMove(page)).status).not.toBe('busy');
});
