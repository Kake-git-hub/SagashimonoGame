/**
 * ステージの難しさの目安（ソルバーの解をたどって測る）
 * ステージを作ったとき、感覚ではなく数字で難易度を決めるための道具。npm run metrics:neji で一覧を出す
 */
import { Stage } from '../types';
import { listRemovableScrews } from './removable';
import { createSortState, placeScrew } from './rules';
import { solveStage } from './solver';

export interface StageMetrics {
  solvable: boolean;
  visited: number;      // ソルバーが探索した状態数（ネジの本数と同じなら後戻りなしで解けた）
  avgRemovable: number; // 解の各手で「今外せるネジ」の平均本数（少ないほど順番が縛られている）
  avgSafe: number;      // そのうち失敗（あふれ）にならない手の平均本数
  forcedMoves: number;  // 失敗しない手が 1 本しかなかった場面の数
  lockedAtStart: number; // 最初の時点で外せないネジの本数（構造で縛られている本数）
}

export function measureStage(stage: Stage): StageMetrics {
  const result = solveStage(stage);
  const colorOf = new Map(stage.screws.map(s => [s.id, s.color] as const));
  const remainingParts = (remaining: ReadonlySet<string>): Set<string> => {
    const held = new Set<string>();
    for (const screw of stage.screws) {
      if (!remaining.has(screw.id)) continue;
      for (const id of screw.partIds) held.add(id);
    }
    return new Set(stage.parts.filter(p => p.fixed || held.has(p.id)).map(p => p.id));
  };

  let remaining = new Set(stage.screws.map(s => s.id));
  const initialRemovable = listRemovableScrews({ stage, remainingParts: remainingParts(remaining), remainingScrews: remaining });
  const lockedAtStart = stage.screws.length - initialRemovable.length;

  let sort = createSortState(stage);
  let sumRemovable = 0;
  let sumSafe = 0;
  let forcedMoves = 0;
  for (const id of result.order) {
    const removable = listRemovableScrews({ stage, remainingParts: remainingParts(remaining), remainingScrews: remaining });
    const safe = removable.filter(x => !placeScrew(stage, sort, x, colorOf.get(x)!).overflow).length;
    sumRemovable += removable.length;
    sumSafe += safe;
    if (safe === 1) forcedMoves += 1;
    sort = placeScrew(stage, sort, id, colorOf.get(id)!).state;
    remaining = new Set([...remaining].filter(x => x !== id));
  }
  const n = Math.max(result.order.length, 1);
  return {
    solvable: result.solvable,
    visited: result.visited,
    avgRemovable: sumRemovable / n,
    avgSafe: sumSafe / n,
    forcedMoves,
    lockedAtStart,
  };
}
