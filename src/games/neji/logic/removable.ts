/**
 * 「このネジは今外せるか」判定
 * ネジは先端から頭の方向（軸方向）にまっすぐ抜けるものとして、
 * 抜け道に別のパーツやネジが残っていれば外せない。
 */
import { Vector3 } from 'three';
import { Blocker, Stage } from '../types';
import { BLOCK_CHECK, SCREW } from '../constants';
import { perpendicularBasis, rayPartEntry, rayScrewEntry, screwDirection, screwLength, screwTip, toVector3 } from './geometry';

export interface Snapshot {
  stage: Stage;
  remainingParts: ReadonlySet<string>;
  remainingScrews: ReadonlySet<string>;
}

interface RayGroup {
  origins: Vector3[];
  maxT: number;
}

// 中心 + 周囲のリングからなるレイの原点群
function makeRing(center: Vector3, u: Vector3, v: Vector3, radius: number): Vector3[] {
  const origins = [center.clone()];
  for (let i = 0; i < BLOCK_CHECK.RING_RAYS; i++) {
    const a = (i / BLOCK_CHECK.RING_RAYS) * Math.PI * 2;
    origins.push(center.clone().addScaledVector(u, Math.cos(a) * radius).addScaledVector(v, Math.sin(a) * radius));
  }
  return origins;
}

/**
 * 邪魔している物を近い順に返す。空なら外せる。
 */
export function findBlockers(snapshot: Snapshot, screwId: string): Blocker[] {
  const { stage, remainingParts, remainingScrews } = snapshot;
  const screw = stage.screws.find(s => s.id === screwId);
  if (!screw) return [];

  const dir = screwDirection(screw);
  const len = screwLength(screw);
  const seat = toVector3(screw.position);
  const tip = screwTip(screw);
  const [u, v] = perpendicularBasis(dir);
  const held = new Set(screw.partIds);

  const parts = stage.parts.filter(p => remainingParts.has(p.id) && !held.has(p.id));
  const screws = stage.screws.filter(s => s.id !== screwId && remainingScrews.has(s.id));

  // 軸の掃引: 先端から面まで（軸の半径）
  // 頭の掃引: 面から抜けきるまで（頭の半径）
  const groups: RayGroup[] = [
    { origins: makeRing(tip, u, v, SCREW.SHAFT_RADIUS * BLOCK_CHECK.SHAFT_RING_RATIO), maxT: len + BLOCK_CHECK.MARGIN },
    { origins: makeRing(seat, u, v, SCREW.HEAD_RADIUS * BLOCK_CHECK.HEAD_RING_RATIO), maxT: len + SCREW.HEAD_HEIGHT + BLOCK_CHECK.MARGIN },
  ];

  const found = new Map<string, Blocker>();
  const record = (kind: Blocker['kind'], id: string, distance: number) => {
    const prev = found.get(id);
    if (!prev || distance < prev.distance) {
      found.set(id, { kind, id, distance });
    }
  };

  for (const group of groups) {
    for (const origin of group.origins) {
      for (const part of parts) {
        const t = rayPartEntry(origin, dir, part);
        if (t !== null && t <= group.maxT) record('part', part.id, t);
      }
      for (const other of screws) {
        const t = rayScrewEntry(origin, dir, other);
        if (t !== null && t <= group.maxT) record('screw', other.id, t);
      }
    }
  }

  return Array.from(found.values()).sort((a, b) => a.distance - b.distance);
}

export function isRemovable(snapshot: Snapshot, screwId: string): boolean {
  return findBlockers(snapshot, screwId).length === 0;
}

// 今外せるネジの id 一覧
export function listRemovableScrews(snapshot: Snapshot): string[] {
  return Array.from(snapshot.remainingScrews).filter(id => isRemovable(snapshot, id));
}
