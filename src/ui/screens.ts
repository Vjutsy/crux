/**
 * Екрани меню за дизайном «Казкові сутінки» (полотно «Crux — варіанти меню», екрани «Головний» і «Після Грати»):
 *  - вступ при першому відкритті: 3 картки → одразу стіна 1 з підказками;
 *  - головний: «Грати», вибір скелелаза тапом по ньому (нижня панель), звук (панель з двома перемикачами), серія днів;
 *  - «Куди лізти?»: тема, рівень мови, рівень гри 1–20 із зірками, «Лізти!»;
 *  - результат стіни: зірки + слова з помилками.
 */
import { cefrLabel } from '../content';
import type { WordGroup } from '../content/schema';
import type { Point } from '../core/body';
import type { Progress } from '../core/save';
import { type Climber, climbers, getClimber } from '../data/climbers';
import { type Skin, lookOf, skinsOf, totalStars, unlocked } from '../data/skins';
import type { WallConfig } from '../data/walls';
import type { ClimbSummary } from '../scenes/ClimbScene';
import { drawClimber } from './climberArt';
import { sound } from '../audio';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const starsText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Поза скелелаза на головному екрані (світові координати моделі, як у дизайні). */
const HERO_C: Point = { x: 208, y: 142 };
const HERO_ENDS: Point[] = [
  { x: 172, y: 112 },
  { x: 236, y: 62 },
  { x: 186, y: 216 },
  { x: 232, y: 200 },
];
const HERO_BOX = '128 30 150 210';

const ICON = {
  soundOn: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  soundOff: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  flame: '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.7 1.6-3.6.2 1.4.9 2.2 1.9 2.4C11 8 10.6 5.6 12 3z"/>',
};
const icon = (d: string, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

/** «5 днів», «2 дні», «1 день». */
export function days(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} день`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} дні`;
  return `${n} днів`;
}

const climberSvg = (c: Climber, t: number, cls: string) =>
  `<svg class="${cls}" viewBox="${HERO_BOX}" aria-hidden="true">${drawClimber(c, HERO_C, HERO_ENDS, t)}</svg>`;

/** Порядок тем у меню: кухня перша — з неї починається навчання. */
const THEME_ORDER = ['kuchyna', 'dom', 'mesto', 'cas', 'auto', 'mix'];
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'ALL'];
const themeRank = (id: string) => (THEME_ORDER.includes(id) ? THEME_ORDER.indexOf(id) : THEME_ORDER.length);

export interface MenuChoice {
  group: WordGroup;
  wall: WallConfig;
}

export interface MenuHandlers {
  onStart: (c: MenuChoice) => void;
  onSettings: (s: Progress['settings']) => void;
}

/** Останній вибір на «Куди лізти?» — живе між відкриттями меню. */
const pick = { themeId: '', groupId: '', wall: 0 };
let raf = 0;
/** Escape закриває панель або повертає з «Куди лізти?»; слухач один на весь документ. */
let onEscape: () => void = () => {};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') onEscape();
});

export function showMenu(groups: WordGroup[], walls: WallConfig[], progress: Progress, { onStart, onSettings }: MenuHandlers) {
  const el = document.getElementById('menu')!;
  const themes = [...new Map(groups.map((g) => [g.themeId, g.theme])).entries()].sort((a, b) => themeRank(a[0]) - themeRank(b[0]));
  const settings = { ...progress.settings };
  let view: 'home' | 'play' = 'home';
  let sheet: 'climber' | 'sound' | null = null;
  /** Анімуємо панель лише при відкритті, а не на кожен перемикач. */
  let opening = false;
  if (!themes.some(([id]) => id === pick.themeId)) pick.themeId = themes[0]?.[0] ?? '';
  if (!pick.wall || pick.wall > progress.unlockedWall) pick.wall = Math.min(progress.unlockedWall, walls.length);

  const starsFor = (wall: number) => progress.stars[`${pick.groupId}#${wall}`] ?? 0;
  const passed = Math.max(0, Math.min(walls.length, progress.unlockedWall - 1));
  const total = totalStars(progress.stars);
  const look = (id = settings.climber) => lookOf(id, settings.skins, total);

  const home = () => {
    const c = look();
    const muted = !settings.sound && !settings.music;
    const streak = progress.streak.count;
    return `<div class="home">
      <div class="glow" aria-hidden="true"></div>
      <div class="topbar end">
        <button class="icon-btn" data-act="sound" aria-label="Звук">${icon(muted ? ICON.soundOff : ICON.soundOn)}</button>
      </div>
      <h1 class="logo">Crux</h1>
      <p class="sub">Лізь угору — вивчай словацьку</p>
      ${streak >= 2 ? `<span class="streak">${icon(ICON.flame, 18)}${days(streak)} поспіль</span>` : ''}
      <button class="hero" data-act="climber" aria-label="Скелелаз: ${esc(c.name)}. Торкнись, щоб змінити">
        <span class="hero-in" id="menu-hero">${climberSvg(c, 0, 'hero-art')}</span>
        <span class="cname">${esc(c.name)}</span>
        <span class="tap">торкнись, щоб змінити</span>
      </button>
      <button class="go big" data-act="play">Грати</button>
      ${sheet ? sheetHtml() : ''}
    </div>`;
  };

  /** Кнопка вбрання: звичайне (null) або скін; закритий — силует і «ще N ★». */
  const outfitBtn = (sk: Skin | null) => {
    const owner = getClimber(settings.climber);
    const chosen = (settings.skins[owner.id] ?? '') === (sk?.id ?? '');
    if (!sk)
      return `<button class="outfit" data-skin="" aria-pressed="${chosen}">${climberSvg(owner, 0, 'mini-art')}<span>Звичайне</span></button>`;
    if (!unlocked(sk, total)) {
      const left = sk.need - total;
      return `<button class="outfit locked" disabled aria-label="${esc(sk.name)}: ще ${left} ★">${climberSvg(sk, 0, 'mini-art')}<span>${esc(sk.name)}</span><small>ще ${left} ★</small></button>`;
    }
    return `<button class="outfit" data-skin="${sk.id}" aria-pressed="${chosen}">${climberSvg(sk, 0, 'mini-art')}<span>${esc(sk.name)}</span></button>`;
  };

  const sheetHtml = () => {
    const body =
      sheet === 'climber'
        ? `<div class="climbers">${climbers
            .map(
              (c) =>
                `<button class="climber-pick" data-climber="${c.id}" aria-pressed="${c.id === settings.climber}">${climberSvg(look(c.id), 0, 'mini-art')}<span>${esc(c.name)}</span></button>`,
            )
            .join('')}</div>
          <div class="row"><h3 class="outfit-title">Вбрання · ${esc(getClimber(settings.climber).name)}</h3><span class="star-chip" aria-label="Зірок: ${total}">★ ${total}</span></div>
          <div class="outfits">${[null, ...skinsOf(settings.climber)].map(outfitBtn).join('')}</div>
          <p class="muted">Вигляд різний — лазять усі однаково. Нові вбрання відкриваються за зірки.</p>`
        : `<div class="switches">${(
            [
              ['sound', 'Звуки'],
              ['music', 'Музика'],
            ] as const
          )
            .map(
              ([k, name]) =>
                `<button class="switch" data-toggle="${k}" role="switch" aria-checked="${settings[k]}"><span>${name}</span><i aria-hidden="true"></i></button>`,
            )
            .join('')}</div>`;
    return `<div class="sheet-back${opening ? ' anim' : ''}" data-act="close">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <h2 id="sheet-title">${sheet === 'climber' ? 'Обери скелелаза' : 'Звук'}</h2>
          <button class="icon-btn small" data-act="close" aria-label="Закрити">${icon(ICON.close, 20)}</button>
        </div>
        ${body}
      </div>
    </div>`;
  };

  const play = () => {
    const levels = groups
      .filter((g) => g.themeId === pick.themeId)
      .sort((a, b) => LEVEL_ORDER.indexOf(a.cefr) - LEVEL_ORDER.indexOf(b.cefr));
    if (!levels.some((g) => g.id === pick.groupId)) pick.groupId = levels[0]?.id ?? '';
    const group = groups.find((g) => g.id === pick.groupId);
    const theme = themes.find(([id]) => id === pick.themeId)?.[1] ?? '';
    return `<div class="play">
      <div class="bar">
        <button class="icon-btn" data-act="back" aria-label="Назад">${icon(ICON.back, 22)}</button>
        <h1>Куди лізти?</h1>
      </div>
      <section><h2>Тема</h2>
        <div class="opts two">${themes.map(([id, name]) => `<button class="opt${id === 'mix' ? ' wide' : ''}" data-theme="${id}" aria-pressed="${id === pick.themeId}">${esc(name)}</button>`).join('')}</div>
      </section>
      <section><h2>Рівень мови</h2>
        <div class="opts levels">${levels
          .map(
            (g) =>
              `<button class="opt lvl" data-group="${g.id}" aria-pressed="${g.id === pick.groupId}" title="${g.words.length} слів">${cefrLabel(g.cefr)}</button>`,
          )
          .join('')}</div>
      </section>
      <section><div class="row"><h2>Рівень гри</h2><span class="muted">${passed} з ${walls.length} пройдено</span></div>
        <div class="walls">${walls
          .map((w) => {
            const locked = w.wall > progress.unlockedWall;
            const st = starsFor(w.wall);
            return `<button class="wall" data-wall="${w.wall}" aria-pressed="${w.wall === pick.wall}" aria-label="Рівень ${w.wall}${locked ? ', закритий' : ''}" ${locked ? 'disabled' : ''}><b>${w.wall}</b><small>${!locked && st ? starsText(st) : ''}</small></button>`;
          })
          .join('')}</div>
      </section>
      <div class="foot">
        <p class="muted">${esc(theme)} · ${group ? cefrLabel(group.cefr) : ''} · рівень ${pick.wall}</p>
        <button class="go big" data-act="go">Лізти!</button>
      </div>
    </div>`;
  };

  const animate = () => {
    cancelAnimationFrame(raf);
    if (reducedMotion()) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const host = document.getElementById('menu-hero');
      if (el.hidden || !host || view !== 'home') return;
      host.innerHTML = climberSvg(look(), (now - t0) / 1000, 'hero-art');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  const render = () => {
    el.innerHTML = view === 'home' ? home() : play();
    el.scrollTop = 0;
    if (view === 'home') animate();
    if (sheet && opening) (el.querySelector('.sheet [data-act="close"]') as HTMLElement | null)?.focus();
    opening = false;
  };

  el.onclick = (e) => {
    const target = e.target as HTMLElement;
    const b = target.closest('button');
    // Тап по затемненню поза панеллю закриває її.
    if (!b && target.classList.contains('sheet-back')) {
      sheet = null;
      return render();
    }
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'climber' || act === 'sound') {
      sheet = act;
      opening = true;
    } else if (act === 'close') sheet = null;
    else if (act === 'play') view = 'play';
    else if (act === 'back') view = 'home';
    else if (b.dataset.climber) {
      // Панель лишається відкритою: одразу видно вбрання цього скелелаза.
      settings.climber = b.dataset.climber;
      onSettings({ ...settings });
    } else if (b.dataset.skin !== undefined) {
      settings.skins = { ...settings.skins, [settings.climber]: b.dataset.skin };
      onSettings({ ...settings });
    } else if (b.dataset.toggle === 'sound' || b.dataset.toggle === 'music') {
      settings[b.dataset.toggle] = !settings[b.dataset.toggle];
      onSettings({ ...settings });
    } else if (b.dataset.theme) pick.themeId = b.dataset.theme;
    else if (b.dataset.group) pick.groupId = b.dataset.group;
    else if (b.dataset.wall) pick.wall = Number(b.dataset.wall);
    else if (act === 'go') {
      const group = groups.find((g) => g.id === pick.groupId);
      const wall = walls.find((w) => w.wall === pick.wall);
      if (!group || !wall) return;
      cancelAnimationFrame(raf);
      el.hidden = true;
      onStart({ group, wall });
      return;
    }
    render();
  };
  onEscape = () => {
    if (el.hidden) return;
    if (sheet) sheet = null;
    else if (view === 'play') view = 'home';
    else return;
    render();
  };
  el.hidden = false;
  render();
}

const STAR_PATH = 'M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z';

/**
 * Результат стіни — «Листівка» (дизайн F, полотно «Crux — варіанти меню»): кремова листівка над вершиною,
 * марка із зірками, «твій шлях» і найкоротший шлях, слова для повторення, кнопки під листівкою.
 * Листівка падає з прискоренням і раз коротко відскакує, цифри набігають із «піком», зірки дзенькають, у кінці — акорд.
 */
export interface NewSkins {
  skins: Skin[];
  onWear: (skinId: string) => void;
}

export function showResult(s: ClimbSummary, onAgain: () => void, onMenu: () => void, onNext?: () => void, fresh?: NewSkins) {
  const el = document.getElementById('result')!;
  const stamp = [0, 1, 2]
    .map((i) => `<svg class="pc-star" data-i="${i}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`)
    .join('');
  const words = s.mistakes.length
    ? `<div class="pc-words"><h2>Повтори ці слова</h2>${s.mistakes
        .slice(0, 6)
        .map(
          (m) =>
            `<div class="pc-word"><b>${esc(m.prompt)}</b><span>${esc(m.expected)}${m.given ? ` <small>(ви: ${esc(m.given)})</small>` : ''}</span></div>`,
        )
        .join('')}</div>`
    : `<p class="pc-clean">${s.won ? 'Жодної помилки!' : ''}</p>`;
  el.className = 'screen postcard-screen';
  el.innerHTML = `<div class="pc-dim"></div>
    <article class="postcard" aria-label="${s.won ? 'Вершина' : 'Зірвався'}">
      <header>
        <div><span class="pc-meta">Стіна ${s.wall} · ${esc(s.theme)} · ${esc(s.cefr)}</span>
          <h1>${s.won ? 'Вершина!' : 'Зірвався'}</h1>
          ${s.won ? '' : `<span class="pc-reason">${esc(s.fallReason ?? '')}</span>`}</div>
        <div class="pc-stamp" aria-label="Зірки: ${s.stars} з 3"><div class="pc-stars">${stamp}</div><span>${s.stars} з 3</span></div>
      </header>
      <div class="pc-stats">
        <div><b data-count="${s.moves}">${s.moves}</b><span>${s.won ? 'кроків — твій шлях' : 'кроків зроблено'}</span></div>
        <div><b class="teal" data-count="${s.shortest}">${s.shortest}</b><span>найкоротший шлях</span></div>
      </div>
      ${words}
      ${(fresh?.skins ?? [])
        .map(
          (sk) => `<div class="pc-sticker">
        ${climberSvg(sk, 0, 'pc-skin-art')}
        <div><b>Новий скін!</b><span>${esc(sk.name)} · ${esc(getClimber(sk.owner).name)}</span>
          <button class="pc-wear" data-wear="${sk.id}">Вдягнути</button></div>
      </div>`,
        )
        .join('')}
    </article>
    <div class="pc-foot">
      ${onNext ? '<button class="go big" id="next">Наступна стіна</button>' : ''}
      <div class="pc-row"><button class="go alt" id="again">Ще раз</button><button class="go alt" id="tomenu">Меню</button></div>
    </div>`;
  el.onclick = (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (btn?.dataset.wear) {
      fresh?.onWear(btn.dataset.wear);
      btn.textContent = 'Вдягнено ✓';
      btn.disabled = true;
      sound.star(2);
      return;
    }
    const id = btn?.id;
    if (!id) return;
    el.hidden = true;
    if (id === 'next') onNext?.();
    if (id === 'again') onAgain();
    if (id === 'tomenu') onMenu();
  };
  el.hidden = false;
  animatePostcard(el, s, (fresh?.skins.length ?? 0) > 0);
}

/** Послідовність: удар листівки (0.42 с) → цифри набігають → зірки по одній → кнопки й акорд. Разом ~1.1 с. */
function animatePostcard(el: HTMLElement, s: ClimbSummary, hasSkin: boolean) {
  const lit = (i: number) => el.querySelector(`.pc-star[data-i="${i}"]`)?.classList.add('on');
  if (reducedMotion()) {
    for (let i = 0; i < s.stars; i++) lit(i);
    el.classList.add('shown');
    return;
  }
  el.classList.add('anim');
  const counters = [...el.querySelectorAll<HTMLElement>('[data-count]')];
  const T_LAND = 420;
  const T_COUNT = 330;
  setTimeout(() => {
    counters.forEach((c) => (c.textContent = '0'));
    const t0 = performance.now();
    let last = counters.map(() => 0);
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / T_COUNT);
      counters.forEach((c, i) => {
        const v = Math.round(Number(c.dataset.count) * k);
        if (v !== last[i]) {
          c.textContent = String(v);
          if (i === 0) sound.pik();
        }
      });
      last = counters.map((c) => Number(c.textContent));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, T_LAND - 100);
  const starsAt = T_LAND + T_COUNT - 60;
  for (let i = 0; i < s.stars; i++)
    setTimeout(
      () => {
        lit(i);
        sound.star(i);
      },
      starsAt + i * 110,
    );
  setTimeout(
    () => {
      el.classList.add('shown');
      if (s.won && s.stars > 0) sound.chord();
      if (hasSkin) setTimeout(() => sound.star(4), 260);
    },
    starsAt + Math.max(1, s.stars) * 110,
  );
}

/** Вступ при першому відкритті гри: три короткі картки, потім одразу перша стіна з підказками. */
const INTRO = [
  {
    title: 'Лізь угору',
    text: 'Торкайся зачепів — скелелаз сам перелізе. Кожен рух коштує 1 крок.',
    art: (c: Climber) => climberSvg(c, 0, 'intro-art'),
  },
  {
    title: 'Бережи кроки',
    text: 'Скінчаться кроки — зірвешся. Таймерів немає: думай скільки завгодно.',
    art: () =>
      `<svg class="intro-art" viewBox="0 0 150 150" aria-hidden="true"><rect x="25" y="50" width="100" height="44" rx="22" fill="#24223a" stroke="#f0b96a" stroke-width="2"/><text x="75" y="80" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="20" fill="#ece3d0">Кроки 12</text><g fill="#f0b96a" opacity=".7"><ellipse cx="50" cy="120" rx="6" ry="9"/><ellipse cx="68" cy="112" rx="6" ry="9"/><ellipse cx="86" cy="124" rx="6" ry="9" opacity=".5"/><ellipse cx="104" cy="116" rx="6" ry="9" opacity=".3"/></g></svg>`,
  },
  {
    title: 'Сині самоцвіти',
    text: 'На синіх зачепах — питання зі словацької. Правильна відповідь дає +3 кроки.',
    art: () =>
      `<svg class="intro-art" viewBox="-40 -42 80 80" aria-hidden="true"><ellipse rx="26" ry="22" fill="#6fb6e8" opacity=".3"/><g transform="scale(2.2)" stroke="#221c2c" stroke-linejoin="round"><path d="M-8,-2L-4,-7L4,-7L8,-2L0,8Z" fill="#5aa7e6" stroke-width=".6"/><path d="M-8,-2L8,-2M-4,-7L-2,-2L0,8M4,-7L2,-2" fill="none" stroke="#2b5f8f" stroke-width=".35"/><path d="M-4,-7L-2,-2L-8,-2Z" fill="#cde8fa" stroke="none" opacity=".8"/></g><g transform="translate(0 -30)"><rect x="-16" y="-9" width="32" height="18" rx="9" fill="#34449a"/><text y="5.5" text-anchor="middle" font-family="Neucha, cursive" font-size="16" fill="#f3ead6">+3</text></g></svg>`,
  },
];

export function showIntro(climber: Climber, onStart: () => void, onSkip: () => void) {
  const el = document.getElementById('menu')!;
  let i = 0;
  const render = () => {
    const s = INTRO[i]!;
    const last = i === INTRO.length - 1;
    el.innerHTML = `<div class="intro">
      <div class="glow" aria-hidden="true"></div>
      <div class="topbar end"><button class="skip" data-act="skip">Пропустити</button></div>
      <div class="intro-pic">${s.art(climber)}</div>
      <h1>${s.title}</h1>
      <p>${s.text}</p>
      <div class="dots" aria-label="Крок ${i + 1} з ${INTRO.length}">${INTRO.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <button class="go big" data-act="${last ? 'start' : 'next'}">${last ? 'Перша стіна' : 'Далі'}</button>
    </div>`;
  };
  el.onclick = (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act === 'next') {
      i++;
      render();
    } else if (act === 'start' || act === 'skip') {
      el.hidden = true;
      if (act === 'start') onStart();
      else onSkip();
    }
  };
  onEscape = () => {};
  el.hidden = false;
  render();
}
