/**
 * ステージ定義の検証（ステージ追加時のテストと、将来のエディタで使う）
 * 物理的に成り立たない配置や、解けないステージをエラーとして返す
 */
import { Vector3 } from 'three';
import { SCREW_COLORS, ScrewColor, ScrewDef, Stage } from '../types';
import { SCREW } from '../constants';
import { rayPartEntry, rayScrewEntry, screwDirection, screwLength, screwTip, toVector3 } from './geometry';
import { countScrewsByColor } from './rules';
import { solveStage } from './solver';

const UP = new Vector3(0, 1, 0);
const EPS = 1e-6;

function isInsidePart(point: Vector3, stage: Stage, partId: string): boolean {
  const part = stage.parts.find(p => p.id === partId);
  if (!part) return false;
  return rayPartEntry(point, UP, part) === 0;
}

function partsContaining(point: Vector3, stage: Stage): string[] {
  return stage.parts.filter(p => rayPartEntry(point, UP, p) === 0).map(p => p.id);
}

// 線分同士の最短距離（Ericson, Real-Time Collision Detection 5.1.9）
function segmentDistance(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): number {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s = 0;
  let t = 0;
  if (a <= EPS && e <= EPS) {
    return p1.distanceTo(p2);
  }
  if (a <= EPS) {
    t = Math.min(Math.max(f / e, 0), 1);
  } else {
    const c = d1.dot(r);
    if (e <= EPS) {
      s = Math.min(Math.max(-c / a, 0), 1);
    } else {
      const b = d1.dot(d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? Math.min(Math.max((b * f - c * e) / denom, 0), 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(Math.max(-c / a, 0), 1);
      } else if (t > 1) {
        t = 1;
        s = Math.min(Math.max((b - c) / a, 0), 1);
      }
    }
  }
  const c1 = p1.clone().addScaledVector(d1, s);
  const c2 = p2.clone().addScaledVector(d2, t);
  return c1.distanceTo(c2);
}

function headCenter(screw: ScrewDef): Vector3 {
  return toVector3(screw.position).addScaledVector(screwDirection(screw), SCREW.HEAD_HEIGHT / 2);
}

// 点がネジの頭（円柱）を margin だけ太らせた範囲に入るか
function isNearHead(point: Vector3, screw: ScrewDef, margin: number): boolean {
  const dir = screwDirection(screw);
  const rel = point.clone().sub(toVector3(screw.position));
  const axial = rel.dot(dir);
  if (axial < -margin || axial > SCREW.HEAD_HEIGHT + margin) return false;
  const radial = rel.clone().addScaledVector(dir, -axial).length();
  return radial < SCREW.HEAD_RADIUS + margin - EPS;
}

// ネジ b の軸（線分）がネジ a の頭と重なるか
function shaftHitsHead(a: ScrewDef, b: ScrewDef): boolean {
  const bDir = screwDirection(b);
  const bSeat = toVector3(b.position);
  const len = screwLength(b);
  for (let t = 0; t <= len + EPS; t += 0.025) {
    if (isNearHead(bSeat.clone().addScaledVector(bDir, -t), a, SCREW.SHAFT_RADIUS)) return true;
  }
  return false;
}

export interface ValidationOptions {
  solve?: boolean; // ソルバーで解けるかも確認する（既定 true）
}

export function validateStage(stage: Stage, options: ValidationOptions = {}): string[] {
  const errors: string[] = [];
  const partIds = new Set<string>();
  const screwIds = new Set<string>();

  // --- id と参照 ---
  for (const part of stage.parts) {
    if (partIds.has(part.id)) errors.push(`パーツ id が重複: ${part.id}`);
    partIds.add(part.id);
  }
  for (const screw of stage.screws) {
    if (screwIds.has(screw.id)) errors.push(`ネジ id が重複: ${screw.id}`);
    screwIds.add(screw.id);
    if (!(SCREW_COLORS as readonly string[]).includes(screw.color)) {
      errors.push(`ネジ ${screw.id}: 不明な色 ${screw.color}`);
    }
    if (screw.partIds.length === 0) errors.push(`ネジ ${screw.id}: partIds が空`);
    for (const id of screw.partIds) {
      if (!partIds.has(id)) errors.push(`ネジ ${screw.id}: 存在しないパーツ ${id}`);
    }
  }
  if (errors.length > 0) return errors;

  // --- 固定でないパーツはどれかのネジに固定されている ---
  const held = new Set(stage.screws.flatMap(s => s.partIds));
  for (const part of stage.parts) {
    if (!part.fixed && !held.has(part.id)) {
      errors.push(`パーツ ${part.id}: 固定でも、ネジで固定されてもいない（最初から落ちてしまう）`);
    }
  }

  // --- 色の本数とボックスの数 ---
  const counts = countScrewsByColor(stage);
  for (const color of SCREW_COLORS) {
    const boxes = stage.boxes.filter(c => c === color).length;
    if (counts[color] !== boxes * stage.boxCapacity) {
      errors.push(`色 ${color}: ネジ ${counts[color]} 本に対してボックス ${boxes} 個（${boxes * stage.boxCapacity} 本分）`);
    }
  }
  for (const color of stage.boxes) {
    if (!(SCREW_COLORS as readonly string[]).includes(color as ScrewColor)) errors.push(`boxes に不明な色 ${color}`);
  }

  // --- 配置の物理チェック ---
  for (const screw of stage.screws) {
    const dir = screwDirection(screw);
    const seat = toVector3(screw.position);
    const len = screwLength(screw);
    const heldSet = new Set(screw.partIds);

    // 頭の乗っている面: 少し内側は先頭パーツの中、少し外側はどのパーツの中でもない
    if (!isInsidePart(seat.clone().addScaledVector(dir, -0.02), stage, screw.partIds[0])) {
      errors.push(`ネジ ${screw.id}: 位置がパーツ ${screw.partIds[0]} の表面に乗っていない（内側判定 NG）`);
    }
    const outside = partsContaining(seat.clone().addScaledVector(dir, 0.02), stage);
    if (outside.length > 0) {
      errors.push(`ネジ ${screw.id}: 頭がパーツ ${outside.join(',')} に埋まっている`);
    }

    // 頭の上面のリングはどのパーツにも入らない
    const helper = Math.abs(dir.y) < 0.9 ? UP : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(dir, helper).normalize();
    const v = new Vector3().crossVectors(dir, u).normalize();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = seat
        .clone()
        .addScaledVector(dir, SCREW.HEAD_HEIGHT)
        .addScaledVector(u, Math.cos(a) * SCREW.HEAD_RADIUS)
        .addScaledVector(v, Math.sin(a) * SCREW.HEAD_RADIUS);
      const inside = partsContaining(p, stage);
      if (inside.length > 0) {
        errors.push(`ネジ ${screw.id}: 頭の縁がパーツ ${inside.join(',')} に食い込んでいる`);
        break;
      }
    }

    // 軸は固定していないパーツを貫かない
    for (let t = 0.03; t < len; t += 0.05) {
      const p = seat.clone().addScaledVector(dir, -t);
      const bad = partsContaining(p, stage).filter(id => !heldSet.has(id));
      if (bad.length > 0) {
        errors.push(`ネジ ${screw.id}: 軸が partIds に無いパーツ ${bad.join(',')} を貫いている（partIds に追加するか位置を変える）`);
        break;
      }
    }
  }

  // --- ネジ同士の物理的な重なり ---
  for (let i = 0; i < stage.screws.length; i++) {
    for (let j = i + 1; j < stage.screws.length; j++) {
      const a = stage.screws[i];
      const b = stage.screws[j];
      const aSeat = toVector3(a.position);
      const bSeat = toVector3(b.position);
      const aTip = screwTip(a);
      const bTip = screwTip(b);

      const shaftDist = segmentDistance(aTip, aSeat, bTip, bSeat);
      if (shaftDist < SCREW.SHAFT_RADIUS * 2 - EPS) {
        errors.push(`ネジ ${a.id} と ${b.id}: 軸同士が交差している（距離 ${shaftDist.toFixed(2)}）`);
        continue;
      }
      const headA = headCenter(a);
      const headB = headCenter(b);
      if (shaftHitsHead(a, b) || shaftHitsHead(b, a)) {
        errors.push(`ネジ ${a.id} と ${b.id}: 頭と軸が重なっている`);
        continue;
      }
      const parallel = Math.abs(screwDirection(a).dot(screwDirection(b))) > 0.99;
      if (parallel && headA.distanceTo(headB) < SCREW.HEAD_RADIUS * 2 - EPS) {
        errors.push(`ネジ ${a.id} と ${b.id}: 頭同士が重なっている（距離 ${headA.distanceTo(headB).toFixed(2)}）`);
        continue;
      }
      // 片方の頭の中心がもう片方のネジの中にある（向きが違う場合の保険）
      if (rayScrewEntry(headA, UP, b) === 0 || rayScrewEntry(headB, UP, a) === 0) {
        errors.push(`ネジ ${a.id} と ${b.id}: 重なっている`);
      }
    }
  }

  if (errors.length > 0) return errors;

  // --- 解けるか ---
  if (options.solve ?? true) {
    const result = solveStage(stage);
    if (result.aborted) {
      errors.push(`ソルバーが上限で打ち切り（${result.visited} 状態）。ネジを減らすか構造を単純にしてください`);
    } else if (!result.solvable) {
      errors.push('どの順番でも解けません（ブロックの順番とボックスの順番を見直してください）');
    }
  }

  return errors;
}
