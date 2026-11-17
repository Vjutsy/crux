/** Екрани меню (тема, рівень, стіна) і результату (зірки + слова з помилками). */
import type { WordGroup } from '../content/schema';
import type { Progress } from '../core/save';
import type { WallConfig } from '../data/walls';
import type { ClimbSummary } from '../scenes/ClimbScene';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const starsText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export interface MenuChoice {
  group: WordGroup;
  wall: WallConfig;
  daily: boolean;
}

export function showMenu(groups: WordGroup[], walls: WallConfig[], progress: Progress, onStart: (c: MenuChoice) => void) {
  const el = document.getElementById('menu')!;
  const themes = [...new Map(groups.map((g) => [g.themeId, g.theme])).entries()];
  let themeId = themes[0]?.[0] ?? '';
  let groupId = groups.find((g) => g.themeId === themeId)?.id ?? '';
  let wallN = Math.min(progress.unlockedWall, walls.length);

  const render = () => {
    const levels = groups.filter((g) => g.themeId === themeId);
    if (!levels.some((g) => g.id === groupId)) groupId = levels[0]?.id ?? '';
    el.innerHTML = `
      <h1>Crux</h1>
      <p>Лізь угору — вивчай словацьку.${progress.streak.count > 1 ? ` Серія: ${progress.streak.count} дн.` : ''}</p>
      <h2>Тема</h2>
      <div class="grid">${themes.map(([id, name]) => `<button class="pick" data-theme="${id}" aria-pressed="${id === themeId}">${esc(name)}</button>`).join('')}</div>
      <h2>Рівень</h2>
      <div class="grid">${levels.map((g) => `<button class="pick" data-group="${g.id}" aria-pressed="${g.id === groupId}">${g.cefr} · ${g.words.length} слів</button>`).join('')}</div>
      <h2>Стіна</h2>
      <div class="grid">${walls
        .map((w) => {
          const st = progress.stars[`${groupId}#${w.wall}`] ?? 0;
          return `<button class="pick" data-wall="${w.wall}" aria-pressed="${w.wall === wallN}" ${w.wall > progress.unlockedWall ? 'disabled' : ''}>Стіна ${w.wall}<br><small>${starsText(st)}</small></button>`;
        })
        .join('')}</div>
      <button class="go" id="go">Лізти!</button>
      <button class="go" id="daily" style="background:#ffffff26;color:#fff">Щоденна стіна</button>`;
  };
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.theme) themeId = b.dataset.theme;
    else if (b.dataset.group) groupId = b.dataset.group;
    else if (b.dataset.wall) wallN = Number(b.dataset.wall);
    else if (b.id === 'go' || b.id === 'daily') {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      el.hidden = true;
      const daily = b.id === 'daily';
      onStart({ group, wall: walls.find((w) => w.wall === (daily ? Math.min(5, progress.unlockedWall) : wallN))!, daily });
      return;
    }
    render();
  };
  render();
  el.hidden = false;
}

export function showResult(s: ClimbSummary, onAgain: () => void, onMenu: () => void, onNext?: () => void) {
  const el = document.getElementById('result')!;
  el.innerHTML = `
    <h1>${s.won ? 'Вершина!' : 'Зірвався'}</h1>
    <p style="font-size:32px;margin:8px 0">${starsText(s.stars)}</p>
    ${s.won ? '' : `<p>${esc(s.fallReason ?? '')}</p>`}
    ${
      s.mistakes.length
        ? `<h2>Слова, де були помилки</h2><ul class="mistakes">${s.mistakes
            .map((m) => `<li><b>${esc(m.prompt)}</b> → ${esc(m.expected)}${m.given ? ` <small>(ви: ${esc(m.given)})</small>` : ''}</li>`)
            .join('')}</ul>`
        : '<p>Жодної помилки!</p>'
    }
    ${onNext ? '<button class="go" id="next">Наступна стіна</button>' : ''}
    <button class="go" id="again" style="background:#ffffff26;color:#fff">Ще раз</button>
    <button class="go" id="tomenu" style="background:#ffffff26;color:#fff">Меню</button>`;
  el.onclick = (e) => {
    const id = (e.target as HTMLElement).closest('button')?.id;
    if (!id) return;
    el.hidden = true;
    if (id === 'next') onNext?.();
    if (id === 'again') onAgain();
    if (id === 'tomenu') onMenu();
  };
  el.hidden = false;
}
