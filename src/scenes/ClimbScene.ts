import Phaser from 'phaser';
import { DEFAULT_BODY, LIMB_NAMES, type Limb, LIMBS, type Point, anchor, danglingEnd, ikJoint, limbLength } from '../core/body';
import { type ClimbState, answer, attempt, autoLimb, canReach, fatigue, reachableHolds, startClimb, stars } from '../core/climb';
import { findRoute, generateWall } from '../core/generator';
import { type LeitnerBoxes, buildQuestion, pickMode, pickWord, updateBox } from '../core/questions';
import { hashSeed, mulberry32, type Rng } from '../core/rng';
import type { WordGroup } from '../content/schema';
import type { WallConfig } from '../data/walls';
import { askQuestion } from '../ui/questionCard';
import { toast } from '../ui/toast';

export interface ClimbData {
  group: WordGroup;
  wall: WallConfig;
  boxes: LeitnerBoxes;
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
}

const COLORS = {
  wall: 0xe9e5db,
  bolt: 0xcfc9bb,
  hold: 0x3d4fd6,
  idle: 0x55575e,
  blocked: 0x9a9a9a,
  ink: 0x17181c,
  card: 0xffffff,
  select: 0xff8a1f,
  danger: 0xe8323c,
};
const HOLD_HIT = 22;
const LIMB_HIT = 20;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ClimbScene extends Phaser.Scene {
  private s!: ClimbState;
  private data0!: ClimbData;
  private rng!: Rng;
  private boxes: LeitnerBoxes = {};
  private recent: string[] = [];
  private mistakes: ClimbSummary['mistakes'] = [];
  private selected: Limb | null = null;
  private busy = false;
  private holdsGfx!: Phaser.GameObjects.Graphics;
  private bodyGfx!: Phaser.GameObjects.Graphics;
  private bodyBox!: Phaser.GameObjects.Container;
  private disp!: { torso: Point; ends: Point[] };
  private camY = 0;
  private shakeTimer = 0;

  constructor() {
    super('climb');
  }

  init(data: ClimbData) {
    this.data0 = data;
    this.boxes = { ...data.boxes };
    this.recent = [];
    this.mistakes = [];
    this.selected = null;
    this.busy = false;
  }

  create() {
    const { group, wall: cfg, seedSalt = '' } = this.data0;
    const seed = hashSeed(group.id, cfg.wall, seedSalt);
    this.rng = mulberry32(seed ^ 0x5bd1e995);
    this.s = startClimb(generateWall(seed, { moves: cfg.moves }), cfg.startSteps);
    const w = this.s.wall;

    this.cameras.main.setBackgroundColor(COLORS.wall).setBounds(0, 0, w.width, w.height);
    const bolts = this.add.graphics().fillStyle(COLORS.bolt, 1);
    for (let y = 15; y < w.height; y += 30) for (let x = 15; x < w.width; x += 30) bolts.fillCircle(x, y, 2);
    this.holdsGfx = this.add.graphics();
    this.bodyGfx = this.add.graphics();
    this.bodyBox = this.add.container(0, 0, [this.bodyGfx]);

    this.disp = { torso: { ...this.s.torso }, ends: LIMBS.map((k) => this.limbEnd(k)) };
    this.camY = this.s.torso.y;
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitCamera, this));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.drawHolds();
    this.updateHud();
    toast(cfg.wall === 1 ? 'Торкніться синього зачепа — сині досяжні для тіла' : `Стіна ${cfg.wall}: ${group.theme} · ${group.cefr}`);
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

  // ---------- ввід ----------
  private onTap(p: Phaser.Input.Pointer) {
    if (this.busy || this.s.status !== 'climbing') return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const best = this.nearestHold(wp);
    // Якщо кінцівку вже вибрано і тап влучив у досяжний для неї зачіп — рухаємо (навіть якщо поруч інша кінцівка).
    if (this.selected !== null && best >= 0 && canReach(this.s, this.selected, best)) {
      void this.ask(this.selected, best);
      return;
    }
    // Інакше кружечок кінцівки має пріоритет: так руку чи ногу вибирають вручну.
    for (const k of LIMBS) {
      const e = this.disp.ends[k]!;
      if (Math.hypot(e.x - wp.x, e.y - wp.y) < LIMB_HIT) {
        this.selected = this.selected === k ? null : k;
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
    void this.ask(limb, best);
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

  private async ask(limb: Limb, hold: number) {
    if (!attempt(this.s, limb, hold)) return;
    this.busy = true;
    this.updateHud();
    this.drawHolds();
    const { group, wall: cfg } = this.data0;
    const word = pickWord(group, this.boxes, this.recent, this.rng);
    this.recent.push(word.id);
    const q = buildQuestion(group, word, pickMode(cfg.typingShare, this.rng), this.rng);
    const res = await askQuestion(q, { requireDiacritics: cfg.requireDiacritics, limbName: LIMB_NAMES[limb] });
    this.boxes = updateBox(this.boxes, word.id, res.correct);
    if (!res.correct || res.check === 'accepted') {
      this.mistakes.push({ prompt: q.prompt, expected: q.expected[0]!, given: res.given });
    }
    if (res.check === 'accepted') toast(`Зараховано. Правильно: ${q.expected[0]}`);
    if (!res.correct) navigator.vibrate?.(40);

    const events = answer(this.s, res.correct, this.rng);
    this.busy = false;
    this.selected = null;
    for (const e of events) {
      if (e.type === 'combo') toast(`Комбо ×${e.combo}: +1 крок`);
      if (e.type === 'slipped') toast(`Від утоми зісковзнула ${LIMB_NAMES[e.limb]}!`);
    }
    this.updateHud();
    this.drawHolds();
    if (this.s.status === 'won') this.time.delayedCall(450, () => this.finish());
    if (this.s.status === 'fallen') this.fall();
  }

  /** Підказка: наступний рух маршруту з поточної пози (для навчання і e2e-тестів). */
  hint(): { limb: Limb; hold: number } | null {
    const w = this.s.wall;
    const route = findRoute({ holds: w.holds, top: w.top, start: this.s.contacts, startTorso: this.s.torso }, this.s.blocked);
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
    navigator.vibrate?.([60, 40, 120]);
    // TODO(тиждень 5): регдол на Matter.js замість твіна.
    this.tweens.add({
      targets: this.bodyBox,
      y: this.s.wall.height,
      angle: 60,
      duration: 1100,
      ease: 'Quad.easeIn',
      onComplete: () => this.finish(),
    });
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
    };
    this.game.events.emit('climb:end', summary);
  }

  // ---------- рендер ----------
  private updateHud() {
    document.getElementById('hud-steps')!.textContent = `Кроки ${this.s.steps}`;
    document.getElementById('hud-combo')!.textContent = `Комбо ${this.s.combo}`;
  }

  private drawHolds() {
    const g = this.holdsGfx.clear();
    const active =
      this.busy || this.s.status !== 'climbing' ? new Set<number>() : new Set(reachableHolds(this.s, this.selected ?? undefined));
    const used = new Set(this.s.contacts);
    this.s.wall.holds.forEach((h, i) => {
      const blocked = this.s.blocked.has(i);
      const color = blocked ? COLORS.blocked : active.has(i) ? COLORS.hold : COLORS.idle;
      const [w, hh] = h.top ? [40, 20] : [20, 14];
      if (blocked || active.has(i) || used.has(i)) g.fillStyle(color, 1).fillEllipse(h.x, h.y, w, hh);
      g.lineStyle(2.2, color, 1).strokeEllipse(h.x, h.y, w, hh);
      if (blocked) g.lineStyle(1.8, COLORS.card, 1).lineBetween(h.x - 5, h.y - 4, h.x + 4, h.y + 4);
    });
  }

  override update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    const a = 1 - Math.exp(-dt * 10);
    const lerp = (p: Point, q: Point) => ({ x: p.x + (q.x - p.x) * a, y: p.y + (q.y - p.y) * a });
    this.disp.torso = lerp(this.disp.torso, this.s.torso);
    this.disp.ends = LIMBS.map((k) => lerp(this.disp.ends[k]!, this.limbEnd(k)));

    // Камера плавно тримає скелелаза трохи нижче центру екрана.
    this.camY += (this.s.torso.y - 40 - this.camY) * a;
    this.cameras.main.centerOn(this.s.wall.width / 2, this.camY);

    // Втома: тремтіння тіла, на межі — тряска камери.
    const f = fatigue(this.s);
    const still = reducedMotion() || this.s.status === 'fallen';
    const amp = still || f < 0.4 ? 0 : (f - 0.4) * 6;
    const jx = (Math.random() - 0.5) * amp;
    const jy = (Math.random() - 0.5) * amp;
    this.shakeTimer -= dt;
    if (!still && f >= 0.8 && this.shakeTimer <= 0) {
      this.cameras.main.shake(250, 0.004);
      this.shakeTimer = 1.6;
    }
    this.drawBody(jx, jy, f);
  }

  private drawBody(jx: number, jy: number, f: number) {
    const g = this.bodyGfx.clear();
    const c = { x: this.disp.torso.x + jx, y: this.disp.torso.y + jy };
    const b = DEFAULT_BODY;
    const ink = f >= 0.8 ? COLORS.danger : COLORS.ink;
    g.lineStyle(4.5, ink, 1);
    const sl = anchor(c, 0);
    const sr = anchor(c, 1);
    const hl = anchor(c, 2);
    const hr = anchor(c, 3);
    g.lineBetween(c.x, sl.y, c.x, hl.y).lineBetween(sl.x, sl.y, sr.x, sr.y).lineBetween(hl.x, hl.y, hr.x, hr.y);
    for (const k of LIMBS) {
      const root = anchor(c, k);
      const end = this.disp.ends[k]!;
      const mid = ikJoint(root, end, limbLength(k), k % 2 === 1 ? 1 : -1);
      g.lineBetween(root.x, root.y, mid.x, mid.y).lineBetween(mid.x, mid.y, end.x, end.y);
    }
    g.fillStyle(COLORS.card, 1)
      .fillCircle(c.x, c.y - b.torso / 2 - 11, 9)
      .strokeCircle(c.x, c.y - b.torso / 2 - 11, 9);
    // Кружечки кінцівок: вибрана — помаранчева, та що висить — червона.
    for (const k of LIMBS) {
      const e = this.disp.ends[k]!;
      const sel = this.selected === k;
      const col = sel ? COLORS.select : this.s.contacts[k] < 0 ? COLORS.danger : COLORS.card;
      g.fillStyle(col, 1).fillCircle(e.x, e.y, sel ? 8 : 5.5);
      g.lineStyle(2, COLORS.ink, 1).strokeCircle(e.x, e.y, sel ? 8 : 5.5);
    }
  }
}
