/**
 * ステージが解けるかを探索するソルバー（ステージ検証・将来のヒント用）
 * 状態 = 残っているネジの集合 + ボックス/一時置き場の状態
 */
import { Stage } from '../types';
import { listRemovableScrews } from './removable';
import { createSortState, placeScrew, SortState, sortStateKey } from './rules';

export interface SolveOptions {
  maxStates?: number; // 探索する状態数の上限（超えたら打ち切り）
}

export interface SolveResult {
  solvable: boolean;
  aborted: boolean;   // 上限で打ち切った
  order: string[];    // 解けた場合の取り外し順
  visited: number;
}

interface Frame {
  remaining: string[];     // ソート済み
  sort: SortState;
  candidates: string[];
  index: number;
  screwId: string | null;  // この状態へ来るときに外したネジ
}

// 残っているネジから、残っているパーツを導く（固定 or 何かのネジが固定している）
function derivePartsFromScrews(stage: Stage, remaining: ReadonlySet<string>): Set<string> {
  const held = new Set<string>();
  for (const screw of stage.screws) {
    if (!remaining.has(screw.id)) continue;
    for (const id of screw.partIds) held.add(id);
  }
  return new Set(stage.parts.filter(p => p.fixed || held.has(p.id)).map(p => p.id));
}

export function solveStage(stage: Stage, options: SolveOptions = {}): SolveResult {
  const maxStates = options.maxStates ?? 300_000;
  const colorOf = new Map(stage.screws.map(s => [s.id, s.color] as const));
  const removableCache = new Map<string, string[]>();
  const visitedStates = new Set<string>();
  let visited = 0;

  const removableFor = (remaining: string[]): string[] => {
    const key = remaining.join(',');
    let result = removableCache.get(key);
    if (!result) {
      const remainingSet = new Set(remaining);
      result = listRemovableScrews({
        stage,
        remainingParts: derivePartsFromScrews(stage, remainingSet),
        remainingScrews: remainingSet,
      });
      removableCache.set(key, result);
    }
    return result;
  };

  // 候補の並び: 今ボックスに入る色 → 一時置き場に置ける
  const orderCandidates = (removable: string[], sort: SortState): string[] => {
    const hasBox = (id: string) =>
      sort.boxes.some(b => b && b.color === colorOf.get(id) && b.filled < stage.boxCapacity);
    const bufferFree = sort.buffer.some(item => item === null);
    const direct = removable.filter(hasBox);
    const viaBuffer = bufferFree ? removable.filter(id => !hasBox(id)) : [];
    return [...direct, ...viaBuffer];
  };

  const initialRemaining = stage.screws.map(s => s.id).sort();
  const initialSort = createSortState(stage);
  const stack: Frame[] = [
    { remaining: initialRemaining, sort: initialSort, candidates: orderCandidates(removableFor(initialRemaining), initialSort), index: 0, screwId: null },
  ];
  visitedStates.add(`${initialRemaining.join(',')}|${sortStateKey(initialSort)}`);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.remaining.length === 0) {
      return { solvable: true, aborted: false, order: stack.map(f => f.screwId).filter((id): id is string => id !== null), visited };
    }
    if (frame.index >= frame.candidates.length) {
      stack.pop();
      continue;
    }
    const screwId = frame.candidates[frame.index++];
    const placed = placeScrew(stage, frame.sort, screwId, colorOf.get(screwId)!);
    if (placed.overflow) continue;

    const remaining = frame.remaining.filter(id => id !== screwId);
    const key = `${remaining.join(',')}|${sortStateKey(placed.state)}`;
    if (visitedStates.has(key)) continue;
    visitedStates.add(key);
    visited += 1;
    if (visited > maxStates) {
      return { solvable: false, aborted: true, order: [], visited };
    }
    stack.push({
      remaining,
      sort: placed.state,
      candidates: orderCandidates(removableFor(remaining), placed.state),
      index: 0,
      screwId,
    });
  }

  return { solvable: false, aborted: false, order: [], visited };
}
