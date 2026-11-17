import Phaser from 'phaser';
import './styles.css';
import { groups } from './content';
import { loadProgress, saveProgress, today, touchStreak, type Progress } from './core/save';
import { walls } from './data/walls';
import { type ClimbData, ClimbScene, type ClimbSummary } from './scenes/ClimbScene';
import { type MenuChoice, showMenu, showResult } from './ui/screens';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#e9e5db',
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
  const data: ClimbData = { group: choice.group, wall: choice.wall, boxes: progress.boxes, seedSalt: choice.daily ? today() : '' };
  hud.hidden = false;
  game.scene.start('climb', data);
}

function menu() {
  hud.hidden = true;
  game.scene.stop('climb');
  showMenu(groups, walls, progress, startClimb);
}

game.events.on('climb:end', (s: ClimbSummary) => {
  hud.hidden = true;
  const key = `${s.groupId}#${s.wall}`;
  progress = {
    ...progress,
    boxes: s.boxes,
    stars: { ...progress.stars, [key]: Math.max(progress.stars[key] ?? 0, s.stars) },
    unlockedWall: s.won ? Math.max(progress.unlockedWall, Math.min(walls.length, s.wall + 1)) : progress.unlockedWall,
  };
  void saveProgress(progress);
  const cur = last!;
  const next = walls.find((w) => w.wall === cur.wall.wall + 1);
  showResult(s, () => startClimb(cur), menu, s.won && next && !cur.daily ? () => startClimb({ ...cur, wall: next }) : undefined);
});

document.getElementById('hud-menu')!.addEventListener('click', menu);
menu();
