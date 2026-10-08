/**
 * ゲームのルール（純粋関数）
 * リデューサー（ゲーム本体）とソルバー（ステージ検証）の両方から使う
 */
import { Vector3 } from 'three';
import { PartDef, Stage } from '../types';
import { computeModelBounds, partCenter, toVector3 } from './geometry';

// ネジが 1 本も残っていない（固定でない）パーツ = 落ちるパーツ
export function findFreeParts(
  stage: Stage,
  remainingParts: ReadonlySet<string>,
  remainingScrews: ReadonlySet<string>,
): string[] {
  const heldParts = new Set<string>();
  for (const screw of stage.screws) {
    if (!remainingScrews.has(screw.id)) continue;
    for (const partId of screw.partIds) heldParts.add(partId);
  }
  return stage.parts
    .filter(p => remainingParts.has(p.id) && !p.fixed && !heldParts.has(p.id))
    .map(p => p.id);
}

// パーツが落ちるときに押し出される方向
export function partFallDirection(stage: Stage, part: PartDef): Vector3 {
  if (part.detachDir) {
    const d = toVector3(part.detachDir);
    if (d.lengthSq() > 1e-9) return d.normalize();
  }
  const { center } = computeModelBounds(stage);
  const d = partCenter(part).sub(center);
  if (d.lengthSq() < 1e-6) return new Vector3(0, 1, 0);
  return d.normalize();
}
