/**
 * Регдол для падіння: тіло з поточної пози перетворюється на ланцюжок фізичних тіл Matter.js
 * (тулуб, голова, плечі/передпліччя, стегна/гомілки), з'єднаних шарнірами.
 */
import type Phaser from 'phaser';
import { DEFAULT_BODY, LIMBS, type Limb, type Point, anchor, ikJoint, limbLength } from '../core/body';

interface Segment {
  body: MatterJS.BodyType;
  half: number;
}

export interface Ragdoll {
  segments: Segment[];
  head: MatterJS.BodyType;
  /** Відрізки для малювання: [кінець A, кінець B]. */
  lines(): [Point, Point][];
  headPos(): Point;
  destroy(): void;
}

const NO_SELF_COLLISION = { group: -7 };

export function createRagdoll(scene: Phaser.Scene, torso: Point, ends: readonly Point[], push: number): Ragdoll {
  const m = scene.matter;
  const b = DEFAULT_BODY;
  const opts = { collisionFilter: NO_SELF_COLLISION, frictionAir: 0.015, density: 0.002 };
  const segs: Segment[] = [];
  const bodies: MatterJS.BodyType[] = [];
  const constraints: MatterJS.ConstraintType[] = [];

  const segment = (a: Point, c: Point): Segment => {
    const len = Math.max(4, Math.hypot(c.x - a.x, c.y - a.y));
    const body = m.add.rectangle((a.x + c.x) / 2, (a.y + c.y) / 2, len, 6, { ...opts, angle: Math.atan2(c.y - a.y, c.x - a.x) });
    const s = { body, half: len / 2 };
    segs.push(s);
    bodies.push(body);
    return s;
  };
  // Кінці відрізка в момент створення (відносно центру, у світовій орієнтації).
  const tip = (s: Segment, sign: 1 | -1) => ({ x: Math.cos(s.body.angle) * s.half * sign, y: Math.sin(s.body.angle) * s.half * sign });
  const join = (sa: MatterJS.BodyType, pa: Point, sb: MatterJS.BodyType, pb: Point) =>
    constraints.push(m.add.constraint(sa, sb, 0, 0.9, { pointA: pa, pointB: pb, damping: 0.1 }));

  const top = { x: torso.x, y: torso.y - b.torso / 2 };
  const bottom = { x: torso.x, y: torso.y + b.torso / 2 };
  const spine = segment(top, bottom);
  const head = m.add.circle(top.x, top.y - 11, 9, opts);
  bodies.push(head);
  join(spine.body, tip(spine, -1), head, { x: 0, y: 9 });

  for (const k of LIMBS as readonly Limb[]) {
    const root = anchor(torso, k);
    const end = ends[k]!;
    const mid = ikJoint(root, end, limbLength(k), k % 2 === 1 ? 1 : -1);
    const upper = segment(root, mid);
    const lower = segment(mid, end);
    const onSpine = { x: root.x - torso.x, y: root.y - torso.y };
    join(spine.body, onSpine, upper.body, tip(upper, -1));
    join(upper.body, tip(upper, 1), lower.body, tip(lower, -1));
  }

  // Поштовх, щоб падіння виглядало живим, а не як мішок.
  for (const body of bodies) m.body.setVelocity(body, { x: push * (0.6 + Math.random() * 0.8), y: -1.5 - Math.random() });
  m.body.setAngularVelocity(spine.body, push * 0.03);

  const endOf = (s: Segment, sign: 1 | -1): Point => ({
    x: s.body.position.x + Math.cos(s.body.angle) * s.half * sign,
    y: s.body.position.y + Math.sin(s.body.angle) * s.half * sign,
  });

  return {
    segments: segs,
    head,
    lines: () => segs.map((s) => [endOf(s, -1), endOf(s, 1)]),
    headPos: () => ({ x: head.position.x, y: head.position.y }),
    destroy: () => {
      for (const c of constraints) m.world.removeConstraint(c);
      for (const body of bodies) m.world.remove(body);
    },
  };
}
