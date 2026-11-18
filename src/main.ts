import Phaser from 'phaser';
import '@fontsource/neucha/cyrillic-400.css';
import '@fontsource/neucha/latin-400.css';
import '@fontsource/nunito/cyrillic-400.css';
import '@fontsource/nunito/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { setAudio, unlockAudio } from './audio';
import { getClimber } from './data/climbers';
import { groups } from './content';
import { loadProgress, saveProgress, touchStreak, type Progress } from './core/save';
import { walls } from './data/walls';
import { type ClimbData, ClimbScene, type ClimbSummary } from './scenes/ClimbScene';
import { type MenuChoice, showIntro, showMenu, showResult } from './ui/screens';

// Офлайн-кеш: коли на сайті з'являється нова версія, вона одразу підміняє стару
// (сторінка перезавантажується сама), а відкрита вкладка перевіряє оновлення щогодини.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
  },
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  transparent: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true },
});
game.scene.add('climb', ClimbScene, false);
// Доступ для e2e-тестів і налагодження: ?debug
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) Object.assign(window, { crux: game });

let progress: Progress = await loadProgress();
let last: MenuChoice | null = null;
const hud = document.getElementById('hud')!;

function startClimb(choice: MenuChoice) {
  last = choice;
  progress = touchStreak(progress);
  void saveProgress(progress);
  const data: ClimbData = {
    group: choice.group,
    wall: choice.wall,
    boxes: progress.boxes,
    climber: getClimber(progress.settings.climber),
    tutorial: !progress.tutorialDone && choice.wall.wall === 1,
  };
  hud.hidden = false;
  game.scene.start('climb', data);
}

function menu() {
  hud.hidden = true;
  game.scene.stop('climb');
  showMenu(groups, walls, progress, {
    onStart: startClimb,
    onSettings: (settings) => {
      progress = { ...progress, settings };
      setAudio(settings);
      void saveProgress(progress);
    },
  });
}

game.events.on('climb:end', (s: ClimbSummary) => {
  hud.hidden = true;
  const key = `${s.groupId}#${s.wall}`;
  progress = {
    ...progress,
    boxes: s.boxes,
    stars: { ...progress.stars, [key]: Math.max(progress.stars[key] ?? 0, s.stars) },
    tutorialDone: progress.tutorialDone || s.tutorialDone,
    unlockedWall: s.won ? Math.max(progress.unlockedWall, Math.min(walls.length, s.wall + 1)) : progress.unlockedWall,
  };
  void saveProgress(progress);
  const cur = last!;
  const next = walls.find((w) => w.wall === cur.wall.wall + 1);
  showResult(s, () => startClimb(cur), menu, s.won && next ? () => startClimb({ ...cur, wall: next }) : undefined);
});

document.getElementById('hud-menu')!.addEventListener('click', menu);
// Звук можна вмикати лише після жесту користувача.
setAudio(progress.settings);
document.addEventListener('pointerdown', unlockAudio, { once: true });

// Перше відкриття: вступ із трьох карток → одразу перша стіна з підказками.
const firstOpen = !progress.introSeen && !progress.tutorialDone && Object.keys(progress.stars).length === 0;
if (firstOpen) {
  const seen = () => {
    progress = { ...progress, introSeen: true };
    void saveProgress(progress);
  };
  const first = groups.find((g) => g.themeId === 'kuchyna' && g.cefr === 'A0') ?? groups[0]!;
  showIntro(
    getClimber(progress.settings.climber),
    () => {
      seen();
      startClimb({ group: first, wall: walls[0]! });
    },
    () => {
      seen();
      menu();
    },
  );
} else menu();
