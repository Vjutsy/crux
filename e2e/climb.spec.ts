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
  await expect(page.getByRole('heading', { name: 'Crux' })).toBeVisible();
});

test.afterEach(() => {
  expect(errors, 'помилки JavaScript на сторінці').toEqual([]);
});

test('стіна 1 без помилок — вершина і 3 зірки', async ({ page }) => {
  await page.getByRole('button', { name: 'Лізти!' }).click();
  expect(await climb(page, 0)).toBe('won');
  await expect(page.locator('#result')).toContainText('Вершина!');
  await expect(page.locator('#result')).toContainText('★★★');
  // Наступна стіна відкрилась.
  await page.getByRole('button', { name: 'Меню' }).click();
  await expect(page.getByRole('button', { name: /Стіна 2/ })).toBeEnabled();
});

test('самі помилки — падіння і список слів', async ({ page }) => {
  await page.getByRole('button', { name: 'Лізти!' }).click();
  expect(await climb(page, 99)).toBe('fallen');
  await expect(page.locator('#result')).toContainText('Зірвався');
  await expect(page.locator('#result .mistakes li').first()).toBeVisible();
});
