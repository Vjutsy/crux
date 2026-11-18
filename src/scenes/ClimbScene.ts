import Phaser from 'phaser';
import { sound } from '../audio';
import { LIMB_NAMES, type Limb, LIMBS, type Point, danglingEnd } from '../core/body';
import {
  type ClimbEvent,
  type ClimbState,
  answer,
  autoLimb,
  canReach,
  fatigue,
  move,
  reachableHolds,
  startClimb,
  stars,
  stepBudget,
} from '../core/climb';
import { findRoute, generateWall } from '../core/generator';
import { type LeitnerBoxes, buildQuestion, pickMode, pickWord, updateBox } from '../core/questions';
import { hashSeed, mulberry32, type Rng } from '../core/rng';
import type { WordGroup } from '../content/schema';
import type { Climber } from '../data/climbers';
import type { WallConfig } from '../data/walls';
import { drawClimber } from '../ui/climberArt';
import { askQuestion } from '../ui/questionCard';
import { toast } from '../ui/toast';
import { type HoldState, SCENERY_DEFS, type WallTheme, holdSvg, themeFor } from './backgrounds';
import { type Ragdoll, createRagdoll } from './ragdoll';

export interface ClimbData {
  group: WordGroup;
  wall: WallConfig;
  boxes: LeitnerBoxes;
  climber: Climber;
  /** Показувати навчальні підказки. */
  tutorial: boolean;
  /** Додатковий компонент seed (наприклад, дата для щоденної стіни). */
  seedSalt?: string;
}

export interface ClimbSummary {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  groupId: string;
  wall: number;
  boxes: LeitnerBoxes;
  mistakes: { prompt: string; expected: string; given: string }[];
  fallReason?: string;
  tutorialDone: boolean;
}

const HOLD_HIT = 22;
const LIMB_HIT = 20;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Навчальні підказки: показуються по черзі на перших ходах. */
const TUTORIAL = [
  'Яскраві зачепи з теплим ореолом — ті, куди тіло дістане. Торкніться зачепа з пунктирним кільцем',
  'Кожен рух коштує 1 крок. Кроки скінчаться — скелелаз зірветься',
  'Сині самоцвіти — бонусні: правильна відповідь на питання дає +3 кроки',
  'Можна торкнутися кружечка на руці чи нозі, щоб рухати саме її. Далі — самі!',
];

export class ClimbScene extends Phaser.Scene {
  private s!: ClimbState;
  private data0!: ClimbData;
  private theme!: WallTheme;
  private rng!: Rng;
  private boxes: LeitnerBoxes = {};
  private recent: string[] = [];
  private mistakes: ClimbSummary['mistakes'] = [];
  private selected: Limb | null = null;
  private busy = false;
  private tutorialStep = -1;
  private scenery!: SVGSVGElement;
  private holdsLayer!: SVGGElement;
  /** Бонуси, що згоріли після помилки (малюються сірим тріснутим каменем). */
  private burned = new Set<number>();
  private shakeUntil = 0;
  private actor!: SVGSVGElement;
  private look: { at: Point; until: number } | null = null;
  private vx = 0;
  private lastX = 0;
  private disp!: { torso: Point; ends: Point[] };
  private camY = 0;
  private shakeTimer = 0;
  private beatTimer = 0;
  private ragdoll: Ragdoll | null = null;
  private hintHold = -1;

  constructor() {
    super({ key: 'climb', physics: { default: 'matter', matter: { gravity: { x: 0, y: 1.1 }, enableSleeping: false } } });
  }

  init(data: ClimbData) {
    this.data0 = data;
    this.boxes = { ...data.boxes };
    this.recent = [];
    this.mistakes = [];
    this.selected = null;
    this.busy = false;
    this.ragdoll = null;
    this.tutorialStep = data.tutorial ? 0 : -1;
    this.hintHold = -1;
  }

  create() {
    const { group, wall: cfg, seedSalt = '' } = this.data0;
    const seed = hashSeed(group.id, cfg.wall, seedSalt);
    this.rng = mulberry32(seed ^ 0x5bd1e995);
    const wall = generateWall(seed, { moves: cfg.moves });
    this.s = startClimb(wall, stepBudget(wall, cfg.stepFactor));
    this.theme = themeFor(group.themeId);
    const w = this.s.wall;

    // Стіна й зачепи — SVG-шар #scenery під скелелазом (дизайн «Скеледроми і зачепи»).
    // Фон із запасом угору й убоки: на високих екранах над стіною видно «небо».
    this.burned = new Set();
    this.scenery = document.getElementById('scenery') as unknown as SVGSVGElement;
    this.scenery.innerHTML = `${SCENERY_DEFS}<rect x="-200" y="-2000" width="${w.width + 400}" height="${w.height + 2400}" fill="${this.theme.base}"/><g>${this.theme.draw(w.width, w.height, seed)}</g><g id="sc-holds"></g>`;
    this.holdsLayer = this.scenery.querySelector('#sc-holds') as SVGGElement;
    this.scenery.removeAttribute('hidden');
    this.actor = document.getElementById('actor') as unknown as SVGSVGElement;
    this.actor.removeAttribute('hidden');

    this.disp = { torso: { ...this.s.torso }, ends: LIMBS.map((k) => this.limbEnd(k)) };
    this.camY = this.s.torso.y;
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.lastX = this.s.torso.x;
    this.events.once('shutdown', () => {
      for (const el of [this.actor, this.scenery]) {
        el.innerHTML = '';
        el.setAttribute('hidden', '');
        el.style.transform = '';
      }
      this.scale.off('resize', this.fitCamera, this);
      this.ragdoll?.destroy();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.drawHolds();
    this.updateHud();
    if (this.tutorialStep >= 0) this.showTutorial();
    else toast(`Стіна ${cfg.wall}: ${group.theme} · ${group.cefr}`);
  }

  private fitCamera() {
    const cam = this.cameras.main;
    const { width: W, height: H } = this.s.wall;
    const zoom = this.scale.width / W;
    cam.setZoom(zoom);
    // Якщо стіна нижча за екран — показуємо «небо» над нею, а низ стіни притискаємо до низу екрана.
    const viewH = this.scale.height / zoom;
    cam.setBounds(0, Math.min(0, H - viewH), W, Math.max(H, viewH));
    cam.centerOn(W / 2, this.camY);
  }

  private limbEnd(k: Limb): Point {
    const i = this.s.contacts[k];
    return i >= 0 ? { ...this.s.wall.holds[i]! } : danglingEnd(this.s.torso, k);
  }

  // ---------- навчання ----------
  private showTutorial() {
    if (this.tutorialStep < 0) return;
    const text = TUTORIAL[this.tutorialStep];
    if (!text) {
      this.tutorialStep = -1;
      this.hintHold = -1;
      return;
    }
    toast(text, 5000);
    this.hintHold = this.tutorialStep <= 2 ? (this.hint()?.hold ?? -1) : -1;
    if (this.holdsLayer) this.drawHolds();
  }

  // ---------- ввід ----------
  private onTap(p: Phaser.Input.Pointer) {
    if (this.busy || this.s.status !== 'climbing') return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const best = this.nearestHold(wp);
    // Якщо кінцівку вже вибрано і тап влучив у досяжний для неї зачіп — рухаємо (навіть якщо поруч інша кінцівка).
    if (this.selected !== null && best >= 0 && canReach(this.s, this.selected, best)) {
      void this.moveTo(this.selected, best);
      return;
    }
    // Інакше кружечок кінцівки має пріоритет: так руку чи ногу вибирають вручну.
    for (const k of LIMBS) {
      const e = this.disp.ends[k]!;
      if (Math.hypot(e.x - wp.x, e.y - wp.y) < LIMB_HIT) {
        this.selected = this.selected === k ? null : k;
        this.look = { at: { ...e }, until: this.time.now + 1200 };
        sound.tap();
        toast(this.selected === null ? 'Кінцівку обере гра' : `Рухаємо: ${LIMB_NAMES[this.selected]}`);
        this.drawHolds();
        return;
      }
    }
    if (best < 0) return;
    const limb = this.selected ?? autoLimb(this.s, best);
    if (limb === null || !canReach(this.s, limb, best)) {
      toast(this.selected !== null ? `${LIMB_NAMES[this.selected]} туди не дістане` : 'Туди тіло фізично не дістане');
      return;
    }
    void this.moveTo(limb, best);
  }

  private nearestHold(wp: Point): number {
    let best = -1;
    let bd = HOLD_HIT;
    this.s.wall.holds.forEach((h, i) => {
      const d = Math.hypot(h.x - wp.x, h.y - wp.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** Рух на зачіп: звичайний — одразу, бонусний — через питання. */
  private async moveTo(limb: Limb, hold: number) {
    const res = move(this.s, limb, hold);
    if (res.kind === 'invalid') return;
    this.look = { at: { ...this.s.wall.holds[hold]! }, until: this.time.now + 1200 };
    sound.tap();
    this.hintHold = -1;
    this.selected = null;
    if (res.kind === 'moved') this.afterMove(res.events);
    else await this.ask(limb);
  }

  private async ask(limb: Limb) {
    this.busy = true;
    this.updateHud();
    this.drawHolds();
    const { group, wall: cfg } = this.data0;
    const word = pickWord(group, this.boxes, this.recent, this.rng);
    this.recent.push(word.id);
    // У навчанні — лише прості питання з вибором.
    const mode = this.tutorialStep >= 0 ? 'choice-sk-ua' : pickMode(cfg.typingShare, this.rng);
    const q = buildQuestion(group, word, mode, this.rng);
    const res = await askQuestion(q, { requireDiacritics: cfg.requireDiacritics, limbName: LIMB_NAMES[limb] });
    this.boxes = updateBox(this.boxes, word.id, res.correct);
    if (!res.correct || res.check === 'accepted') {
      this.mistakes.push({ prompt: q.prompt, expected: q.expected[0]!, given: res.given });
    }
    if (res.check === 'accepted') toast(`Зараховано. Правильно: ${q.expected[0]}`);
    if (!res.correct) navigator.vibrate?.(40);
    this.busy = false;
    this.afterMove(answer(this.s, res.correct, this.rng));
  }

  private afterMove(events: ClimbEvent[]) {
    for (const e of events) {
      if (e.type === 'bonus') {
        sound.good();
        toast(`Правильно! +${e.steps} кроки`);
      }
      if (e.type === 'burned') {
        this.burned.add(e.hold);
        sound.bad();
        toast('Бонус згорів');
      }
      if (e.type === 'combo') {
        sound.combo();
        toast(`Комбо ×${e.combo}: ще +1 крок`);
      }
      if (e.type === 'slipped') {
        sound.slip();
        toast(`Від утоми зісковзнула ${LIMB_NAMES[e.limb]}!`);
      }
    }
    if (this.tutorialStep >= 0) {
      this.tutorialStep++;
      this.showTutorial();
    }
    this.updateHud();
    this.drawHolds();
    if (this.s.status === 'won') {
      sound.win();
      this.time.delayedCall(450, () => this.finish());
    }
    if (this.s.status === 'fallen') this.fall();
  }

  /** Підказка: наступний рух маршруту з поточної пози (для навчання і e2e-тестів). */
  hint(): { limb: Limb; hold: number } | null {
    const w = this.s.wall;
    const route = findRoute({ holds: w.holds, top: w.top, start: this.s.contacts, startTorso: this.s.torso });
    return route?.moves[0] ?? null;
  }

  /** Екранні координати точки світу. */
  toScreen(p: Point): Point {
    const cam = this.cameras.main;
    return { x: (p.x - cam.worldView.x) * cam.zoom, y: (p.y - cam.worldView.y) * cam.zoom };
  }

  // ---------- кінець стіни ----------
  private fall() {
    this.busy = true;
    sound.fall();
    navigator.vibrate?.([60, 40, 120]);
    this.ragdoll = createRagdoll(this, this.disp.torso, this.disp.ends, this.disp.torso.x < this.s.wall.width / 2 ? -1 : 1);
    this.time.delayedCall(1600, () => this.finish());
  }

  private finish() {
    const reasons = {
      'no-steps': 'Кроки скінчилися',
      slip: 'Нога зісковзнула, тіло не втрималось',
      stuck: 'Немає жодного досяжного зачепа',
    };
    const summary: ClimbSummary = {
      won: this.s.status === 'won',
      stars: stars(this.s),
      groupId: this.data0.group.id,
      wall: this.data0.wall.wall,
      boxes: this.boxes,
      mistakes: this.mistakes,
      fallReason: this.s.fallReason ? reasons[this.s.fallReason] : undefined,
      tutorialDone: this.data0.tutorial && this.tutorialStep < 0,
    };
    this.game.events.emit('climb:end', summary);
  }

  // ---------- рендер ----------
  private updateHud() {
    document.getElementById('hud-steps')!.textContent = `Кроки ${this.s.steps}`;
    document.getElementById('hud-combo')!.textContent = `Комбо ${this.s.combo}`;
  }

  private drawHolds() {
    const active =
      this.busy || this.s.status !== 'climbing' ? new Set<number>() : new Set(reachableHolds(this.s, this.selected ?? undefined));
    const used = new Set(this.s.contacts);
    const hint = this.busy ? -1 : this.hintHold;
    const parts: string[] = [];
    this.s.wall.holds.forEach((h, i) => {
      let st: HoldState;
      if (h.top) st = 'top';
      else if (this.s.bonus.has(i)) st = active.has(i) ? 'bonus' : 'bonusFar';
      else if (this.burned.has(i) && !used.has(i)) st = 'burnt';
      else if (i === hint) st = 'hint';
      else if (used.has(i)) st = 'used';
      else if (active.has(i)) st = 'reach';
      else st = 'idle';
      // Форма з індексу зачепа: детерміновано, тож стіна завжди виглядає однаково.
      parts.push(holdSvg(this.theme, st, h.x, h.y, (i * 7 + 3) % 3));
    });
    this.holdsLayer.innerHTML = parts.join('');
  }

  override update(time: number, dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    const a = 1 - Math.exp(-dt * 10);
    const lerp = (p: Point, q: Point) => ({ x: p.x + (q.x - p.x) * a, y: p.y + (q.y - p.y) * a });

    // Тряска екрана від утоми: зсуваємо обидва SVG-шари.
    const shake =
      time < this.shakeUntil ? `translate(${((Math.random() - 0.5) * 6).toFixed(1)}px, ${((Math.random() - 0.5) * 4).toFixed(1)}px)` : '';
    this.actor.style.transform = shake;
    this.scenery.style.transform = shake;

    if (this.ragdoll) {
      this.drawRagdoll(time);
      return;
    }
    this.disp.torso = lerp(this.disp.torso, this.s.torso);
    this.disp.ends = LIMBS.map((k) => lerp(this.disp.ends[k]!, this.limbEnd(k)));

    // Камера плавно тримає скелелаза трохи нижче центру екрана.
    this.camY += (this.s.torso.y - 40 - this.camY) * a;
    this.cameras.main.centerOn(this.s.wall.width / 2, this.camY);

    // Втома: тремтіння тіла, на межі — тряска камери й серцебиття.
    const f = fatigue(this.s);
    const still = reducedMotion();
    const amp = still || f < 0.4 ? 0 : (f - 0.4) * 6;
    const jx = (Math.random() - 0.5) * amp;
    const jy = (Math.random() - 0.5) * amp;
    this.shakeTimer -= dt;
    this.beatTimer -= dt;
    if (!still && f >= 0.8 && this.shakeTimer <= 0) {
      this.shakeUntil = time + 250;
      this.shakeTimer = 1.6;
    }
    if (f >= 0.6 && this.beatTimer <= 0 && this.s.status === 'climbing') {
      sound.heartbeat();
      this.beatTimer = 1.3 - f * 0.6;
    }
    this.drawActor(time, { x: this.disp.torso.x + jx, y: this.disp.torso.y + jy }, this.disp.ends, f);
  }

  /** SVG-шар зі скелелазом: viewBox = видима частина світу, тож малюємо у світових координатах. */
  private syncActorView() {
    const v = this.cameras.main.worldView;
    const box = `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.width.toFixed(2)} ${v.height.toFixed(2)}`;
    this.actor.setAttribute('viewBox', box);
    if (this.scenery.getAttribute('viewBox') !== box) this.scenery.setAttribute('viewBox', box);
  }

  private drawActor(time: number, c: Point, ends: readonly Point[], tired: number, rotate = 0) {
    this.syncActorView();
    const t = reducedMotion() ? 1 : time / 1000;
    this.vx += ((c.x - this.lastX) * -0.6 - this.vx) * 0.15;
    this.lastX = c.x;
    const look = this.look && this.look.until > time ? this.look.at : this.selected !== null ? this.disp.ends[this.selected]! : null;
    const art = drawClimber(this.data0.climber, c, ends, t, {
      tired,
      look,
      vx: this.vx,
      handles: !this.ragdoll,
      selected: this.selected,
      dangling: this.s.contacts.map((i) => i < 0),
    });
    this.actor.innerHTML = rotate ? `<g transform="rotate(${rotate.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})">${art}</g>` : art;
  }

  /** Регдол: беремо тулуб і кінці кінцівок з фізики, малюємо ту саму модель, повернуту за хребтом. */
  private drawRagdoll(time: number) {
    const lines = this.ragdoll!.lines();
    const [top, bottom] = lines[0]!;
    const c = { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2 };
    const angle = Math.atan2(bottom.y - top.y, bottom.x - top.x) - Math.PI / 2;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    // Кінці кінцівок переводимо в «прямостоячу» систему тулуба, а весь малюнок повертаємо назад.
    const ends = [0, 1, 2, 3].map((k) => {
      const p = lines[2 + k * 2]![1];
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
    });
    this.drawActor(time, c, ends, 1, (angle * 180) / Math.PI);
  }
}
