import Phaser from 'phaser';
import { sound } from '../audio';
import { type Limb, LIMBS, type Point, anchor, danglingEnd, limbLength } from '../core/body';
import {
  type ClimbEvent,
  type ClimbState,
  answer,
  autoLimb,
  SLIP_COST,
  canReach,
  fatigue,
  move,
  reachableHolds,
  startClimb,
  stars,
  stepBudget,
} from '../core/climb';
import { findRoute, generateWall } from '../core/generator';
import { type LeitnerBoxes, type SeenLog, buildQuestion, pickMode, pickWord, updateBox } from '../core/questions';
import { hashSeed, mulberry32, randomSeed, type Rng } from '../core/rng';
import type { WordGroup } from '../content/schema';
import type { Climber } from '../data/climbers';
import type { WallConfig } from '../data/walls';
import { drawClimber } from '../ui/climberArt';
import { askQuestion, closeQuestion } from '../ui/questionCard';
import { cefrLabel } from '../content';
import { toast } from '../ui/toast';
import { type HoldState, SCENERY_DEFS, type WallTheme, holdSvg, themeFor } from './backgrounds';
import { type Ragdoll, createRagdoll } from './ragdoll';
import { dizzyStars } from './dizzy';

export interface ClimbData {
  group: WordGroup;
  wall: WallConfig;
  boxes: LeitnerBoxes;
  seen: SeenLog;
  asked: number;
  /** Seed для питань; за замовчуванням — випадковий щоразу (тести можуть зафіксувати). */
  questionSeed?: number;
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
  seen: SeenLog;
  asked: number;
  mistakes: { prompt: string; expected: string; given: string }[];
  fallReason?: string;
  tutorialDone: boolean;
  /** Скільки рухів зробив гравець і скільки займає найкоротший відомий шлях. */
  moves: number;
  shortest: number;
  theme: string;
  cefr: string;
}

const HOLD_HIT = 22;
/** Зона, де палець «хапає» кисть чи стопу. */
const LIMB_HIT = 24;
/** Наскільки близько до зачепа треба піднести кінцівку, щоб вона «прилипла». */
const SNAP = 30;
/** Зсув пальця, після якого дотик вважається перетягуванням, а не тапом. */
const DRAG_START = 8;
/** Скільки «неба» над стіною може показати камера (частка висоти екрана). */
const SKY = 0.45;
/** Скільки триває сцена вершини перед листівкою. */
const SUMMIT_MS = 1100;
/** Скільки кружляють зірочки, перш ніж з'явиться екран результату. */
const DIZZY_MS = 1900;
/** Відстань від центру тулуба до центру голови в моделі скелелаза. */
const B_HEAD = 34;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Навчальні підказки: показуються по черзі на перших ходах. */
const TUTORIAL = [
  'Яскраві зачепи з теплим ореолом — ті, куди тіло дістане. Торкніться зачепа з пунктирним кільцем',
  'Кожен рух коштує 1 крок. Кроки скінчаться — скелелаз зірветься',
  'Сині самоцвіти — бонусні: правильна відповідь на питання дає +3 кроки',
  'Руку чи ногу можна тягнути пальцем до зачепа — він збільшиться, коли кінцівка дістане. Далі — самі!',
];

export class ClimbScene extends Phaser.Scene {
  private s!: ClimbState;
  private data0!: ClimbData;
  private theme!: WallTheme;
  private rng!: Rng;
  private boxes: LeitnerBoxes = {};
  private seen: SeenLog = {};
  private asked = 0;
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
  /** Вершина: скелелаз кладе руки на край стіни й підтягується (сцена з чату дизайну), потім листівка. */
  private summit: { torso: Point; ends: Point[] } | null = null;
  /** Підлога й бокові стінки для регдолу. */
  private bounds: MatterJS.BodyType[] = [];
  private fallAt = 0;
  /** Коли тіло гепнулось на підлогу: від цього моменту навколо голови кружляють зірочки. */
  private landedAt = 0;
  private hintHold = -1;
  /** Перетягування кінцівки пальцем: куди тягнемо і до якого зачепа вона «прилипла». */
  private drag: { limb: Limb; start: Point; end: Point; target: number; moved: boolean; reach: Set<number> } | null = null;

  constructor() {
    super({ key: 'climb', physics: { default: 'matter', matter: { gravity: { x: 0, y: 1.1 }, enableSleeping: false } } });
  }

  init(data: ClimbData) {
    this.data0 = data;
    this.boxes = { ...data.boxes };
    this.seen = { ...data.seen };
    this.asked = data.asked;
    this.recent = [];
    this.mistakes = [];
    this.selected = null;
    this.busy = false;
    this.ragdoll = null;
    this.summit = null;
    this.bounds = [];
    this.fallAt = 0;
    this.landedAt = 0;
    this.tutorialStep = data.tutorial ? 0 : -1;
    this.hintHold = -1;
  }

  create() {
    const { group, wall: cfg, seedSalt = '' } = this.data0;
    const seed = hashSeed(group.id, cfg.wall, seedSalt);
    // Стіна — з seed (та сама при «Ще раз»), а питання й зісковзування — щоразу з нового випадкового seed,
    // щоб слова, варіанти відповіді й їх порядок не повторювались від спроби до спроби.
    this.rng = mulberry32(this.data0.questionSeed ?? randomSeed());
    const wall = generateWall(seed, { moves: cfg.moves });
    this.s = startClimb(wall, stepBudget(wall, cfg.stepFactor));
    this.theme = themeFor(group.themeId, cfg.wall);
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
      // Світ Matter.js плагін очищає сам (і обнуляє до нашого обробника) — лише забуваємо посилання.
      // Раніше тут викликався ragdoll.destroy(), і «Ще раз» після падіння падало з помилкою й лишало порожній екран.
      this.ragdoll = null;
      this.bounds = [];
      // Вихід у меню посеред питання: картка не має лишатися над наступною стіною.
      closeQuestion();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.drawHolds();
    this.updateHud();
    if (this.tutorialStep >= 0) this.showTutorial();
    else toast(`Стіна ${cfg.wall}: ${group.theme} · ${cefrLabel(group.cefr)}`);
  }

  private fitCamera() {
    const cam = this.cameras.main;
    const { width: W, height: H } = this.s.wall;
    const zoom = this.scale.width / W;
    cam.setZoom(zoom);
    // Над стіною — «небо»: камера може піднятися вище, тож верхні зачепи не ховаються під кнопками.
    // Низ стіни притиснутий до низу екрана.
    const viewH = this.scale.height / zoom;
    const top = Math.min(-viewH * SKY, H - viewH);
    cam.setBounds(0, top, W, H - top);
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
  /** Найближча кисть чи стопа під пальцем. */
  private limbAt(wp: Point): Limb | null {
    let best: Limb | null = null;
    let bd = LIMB_HIT;
    for (const k of LIMBS) {
      const e = this.disp.ends[k]!;
      const d = Math.hypot(e.x - wp.x, e.y - wp.y);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  }

  private onDown(p: Phaser.Input.Pointer) {
    this.drag = null;
    if (this.busy || this.s.status !== 'climbing') return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const k = this.limbAt(wp);
    if (k === null) return;
    // Можливе перетягування: запам'ятовуємо, до яких зачепів ця кінцівка дістає.
    this.drag = {
      limb: k,
      start: { x: wp.x, y: wp.y },
      end: { ...this.disp.ends[k]! },
      target: -1,
      moved: false,
      reach: new Set(reachableHolds(this.s, k)),
    };
  }

  private onMove(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d || !p.isDown || this.busy) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    if (!d.moved) {
      if (Math.hypot(wp.x - d.start.x, wp.y - d.start.y) < DRAG_START) return;
      d.moved = true;
      this.selected = d.limb;
      this.hintHold = -1;
    }
    // Кінцівка тягнеться за пальцем, але не довша за себе.
    const a = anchor(this.s.torso, d.limb);
    const L = limbLength(d.limb) * 1.02;
    const dx = wp.x - a.x;
    const dy = wp.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    d.end = dist > L ? { x: a.x + (dx / dist) * L, y: a.y + (dy / dist) * L } : { x: wp.x, y: wp.y };
    // «Прилипання» до найближчого досяжного зачепа під пальцем.
    let target = -1;
    let bd = SNAP;
    for (const i of d.reach) {
      const h = this.s.wall.holds[i]!;
      const dd = Math.hypot(h.x - wp.x, h.y - wp.y);
      if (dd < bd) {
        bd = dd;
        target = i;
      }
    }
    if (target >= 0) d.end = { ...this.s.wall.holds[target]! };
    if (target !== d.target) {
      d.target = target;
      if (target >= 0) sound.tap();
      this.drawHolds();
    }
    this.look = { at: d.end, until: this.time.now + 600 };
  }

  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag;
    this.drag = null;
    if (d?.moved) {
      this.selected = null;
      if (d.target >= 0) void this.moveTo(d.limb, d.target);
      else this.drawHolds();
      return;
    }
    this.onTap(p);
  }

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
        this.drawHolds();
        return;
      }
    }
    if (best < 0) return;
    const limb = this.selected ?? autoLimb(this.s, best);
    if (limb === null || !canReach(this.s, limb, best)) {
      toast('Туди не дістати');
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
    else await this.ask();
  }

  private async ask() {
    this.busy = true;
    this.updateHud();
    this.drawHolds();
    const { group, wall: cfg } = this.data0;
    const word = pickWord(group, this.boxes, this.seen, this.recent, this.rng);
    this.recent.push(word.id);
    this.seen = { ...this.seen, [word.id]: ++this.asked };
    // У навчанні — лише прості питання з вибором.
    const mode = this.tutorialStep >= 0 ? 'choice-sk-ua' : pickMode(cfg.typingShare, this.rng);
    const q = buildQuestion(group, word, mode, this.rng);
    const res = await askQuestion(q, { requireDiacritics: cfg.requireDiacritics });
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
        toast(`Від утоми зісковзнула нога: −${SLIP_COST} кроки`);
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
      this.reachSummit();
    }
    if (this.s.status === 'fallen') this.fall();
  }

  /** Руки лягають на край стіни, голова вже над ним, ноги звисають (за ескізом); за мить — листівка. */
  private reachSummit() {
    this.busy = true;
    this.selected = null;
    this.drag = null;
    const W = this.s.wall.width;
    const x = Math.max(60, Math.min(W - 60, this.s.torso.x));
    this.summit = {
      torso: { x, y: 12 },
      ends: [
        { x: x - 26, y: 1 },
        { x: x + 26, y: 1 },
        { x: x - 24, y: 66 },
        { x: x + 26, y: 60 },
      ],
    };
    // Поки скелелаз вилазить, «☰» ховаємо: вихід у меню зараз загубив би перемогу.
    document.getElementById('hud')!.hidden = true;
    navigator.vibrate?.([30, 40, 30]);
    this.time.delayedCall(SUMMIT_MS, () => this.finish());
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
    const { width: W, height: H } = this.s.wall;
    // Підлога (на дерев'яній смузі внизу стіни) і бортики з боків: тіло падає вниз і лишається в кадрі.
    const wall = { isStatic: true, friction: 0.9 };
    this.bounds = [
      this.matter.add.rectangle(W / 2, H - 6 + 20, W * 3, 40, wall),
      this.matter.add.rectangle(-20, H / 2, 40, H * 3, wall),
      this.matter.add.rectangle(W + 20, H / 2, 40, H * 3, wall),
    ];
    this.ragdoll = createRagdoll(this, this.disp.torso, this.disp.ends, this.disp.torso.x < W / 2 ? -1 : 1);
    this.fallAt = this.time.now;
  }

  /** Тіло лежить (або падає задовго): гуп, зірочки над головою, і за мить — екран результату. */
  private land(time: number) {
    this.landedAt = time;
    sound.thud();
    sound.dizzy();
    navigator.vibrate?.(80);
    this.shakeUntil = time + 250;
    this.time.delayedCall(DIZZY_MS, () => this.finish());
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
      seen: this.seen,
      asked: this.asked,
      mistakes: this.mistakes,
      fallReason: this.s.fallReason ? reasons[this.s.fallReason] : undefined,
      tutorialDone: this.data0.tutorial && this.tutorialStep < 0,
      moves: this.s.moves,
      shortest: this.s.status === 'won' ? Math.min(this.s.wall.routeLength, this.s.moves) : this.s.wall.routeLength,
      theme: this.data0.group.theme,
      cefr: cefrLabel(this.data0.group.cefr),
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
      // Зачіп, до якого «прилипла» кінцівка під пальцем, збільшується.
      const grab = this.drag?.moved === true && this.drag.target === i;
      parts.push(holdSvg(this.theme, st, h.x, h.y, (i * 7 + 3) % 3, grab));
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
      // Камера йде за головою вниз.
      const head = this.ragdoll.headPos();
      this.camY += (head.y - 40 - this.camY) * a * 0.6;
      this.cameras.main.centerOn(this.s.wall.width / 2, this.camY);
      if (!this.landedAt) {
        const v = this.ragdoll.head.velocity;
        const onFloor = head.y > this.s.wall.height - 90 && Math.hypot(v.x, v.y) < 2.5;
        if ((onFloor && time - this.fallAt > 500) || time - this.fallAt > 3500) this.land(time);
      }
      this.drawRagdoll(time);
      return;
    }
    const target = this.summit?.torso ?? this.s.torso;
    this.disp.torso = lerp(this.disp.torso, target);
    // Кінцівка, яку тягнуть, іде за пальцем швидше, решта — плавно до своїх зачепів (або до краю стіни на вершині).
    this.disp.ends = LIMBS.map((k) =>
      this.drag?.moved && this.drag.limb === k ? this.drag.end : lerp(this.disp.ends[k]!, this.summit?.ends[k] ?? this.limbEnd(k)),
    );

    // Камера плавно тримає скелелаза трохи нижче центру екрана.
    this.camY += (target.y - 40 - this.camY) * a;
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

  private drawActor(time: number, c: Point, ends: readonly Point[], tired: number, rotate = 0, overlay = '') {
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
    const body = rotate ? `<g transform="rotate(${rotate.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})">${art}</g>` : art;
    this.actor.innerHTML = body + overlay;
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
    // Голова моделі — над тулубом; повертаємо цю точку разом із малюнком.
    const up = B_HEAD;
    const head = { x: c.x + Math.sin(angle) * up, y: c.y - Math.cos(angle) * up };
    const stars = this.landedAt ? dizzyStars(head, angle, time - this.landedAt, reducedMotion() ? 0 : time / 1000) : '';
    this.drawActor(time, c, ends, 1, (angle * 180) / Math.PI, stars);
  }
}
