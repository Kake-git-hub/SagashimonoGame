/**
 * ステージの難しさの目安（ソルバーの解をたどって測る）
 * ステージを作ったとき、感覚ではなく数字で難易度を決めるための道具。npm run metrics:neji で一覧を出す
 */
import { Stage } from '../types';
import { listRemovableScrews } from './removable';
import { createSortState, placeScrew, SortState } from './rules';
import { solveStage } from './solver';

export interface StageMetrics {
  solvable: boolean;
  visited: number;      // ソルバーが探索した状態数（ネジの本数と同じなら後戻りなしで解けた）
  avgRemovable: number; // 解の各手で「今外せるネジ」の平均本数（少ないほど順番が縛られている）
  avgSafe: number;      // そのうち失敗（あふれ）にならない手の平均本数
  forcedMoves: number;  // 失敗しない手が 1 本しかなかった場面の数
  lockedAtStart: number; // 最初の時点で外せないネジの本数（構造で縛られている本数）
  naiveFailRate: number; // 「外せるネジを手当たりしだいに外す」遊び方で失敗する割合（0〜1。高いほど色の順番で考える必要がある）
}

// 残っているネジ → 残っているパーツ
function remainingPartsOf(stage: Stage, remaining: ReadonlySet<string>): Set<string> {
  const held = new Set<string>();
  for (const screw of stage.screws) {
    if (!remaining.has(screw.id)) continue;
    for (const id of screw.partIds) held.add(id);
  }
  return new Set(stage.parts.filter(p => p.fixed || held.has(p.id)).map(p => p.id));
}

// 「外せるか」は色に関係ないので、残っているネジの集合ごとに記憶して使い回す
export class RemovableCache {
  private readonly cache = new Map<string, string[]>();
  constructor(private readonly stage: Stage) {}
  get(remaining: ReadonlySet<string>): string[] {
    const key = [...remaining].sort().join(',');
    let result = this.cache.get(key);
    if (!result) {
      result = listRemovableScrews({ stage: this.stage, remainingParts: remainingPartsOf(this.stage, remaining), remainingScrews: remaining });
      this.cache.set(key, result);
    }
    return result;
  }
}

export interface NaivePlay {
  order: string[];     // 外した順（失敗した場合は、あふれた 1 本まで含む）
  failed: boolean;     // おきばがあふれた
  usedBuffer: boolean; // 途中でおきばに置いた
}

/**
 * 先を読まない遊び方（外せるネジの中から、ボックスに入る色があればそれを、無ければどれかを無作為に外す）を
 * 何回か試す。失敗率の計測と、e2e スクリプト用の手順（わざと失敗する手順・おきばを使う手順）に使う
 */
export function sampleNaivePlays(stage: Stage, options: { plays?: number; seed?: number; cache?: RemovableCache } = {}): NaivePlay[] {
  const plays = options.plays ?? 30;
  const cache = options.cache ?? new RemovableCache(stage);
  const colorOf = new Map(stage.screws.map(s => [s.id, s.color] as const));
  let seed = (options.seed ?? 12345) >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const results: NaivePlay[] = [];
  for (let play = 0; play < plays; play++) {
    let remaining = new Set(stage.screws.map(s => s.id));
    let sort: SortState = createSortState(stage);
    const order: string[] = [];
    let failed = false;
    let usedBuffer = false;
    while (remaining.size > 0) {
      const removable = cache.get(remaining);
      if (removable.length === 0) { failed = true; break; }
      const hasBox = (id: string) => sort.boxes.some(b => b && b.color === colorOf.get(id) && b.filled < stage.boxCapacity);
      const direct = removable.filter(hasBox);
      const pool = direct.length > 0 ? direct : removable;
      const id = pool[Math.floor(rand() * pool.length)];
      const placed = placeScrew(stage, sort, id, colorOf.get(id)!);
      order.push(id);
      if (placed.overflow) { failed = true; break; }
      if (placed.events.some(e => e.type === 'screwPlaced' && e.target.kind === 'buffer')) usedBuffer = true;
      sort = placed.state;
      remaining = new Set([...remaining].filter(x => x !== id));
    }
    results.push({ order, failed, usedBuffer });
  }
  return results;
}

// 先を読まない遊び方で失敗する割合（0〜1）
export function measureNaiveFailRate(stage: Stage, options: { plays?: number; seed?: number; cache?: RemovableCache } = {}): number {
  const plays = sampleNaivePlays(stage, options);
  return plays.filter(p => p.failed).length / Math.max(plays.length, 1);
}

export function measureStage(stage: Stage, options: { cache?: RemovableCache; plays?: number } = {}): StageMetrics {
  const result = solveStage(stage);
  const colorOf = new Map(stage.screws.map(s => [s.id, s.color] as const));
  const cache = options.cache ?? new RemovableCache(stage);

  let remaining = new Set(stage.screws.map(s => s.id));
  const initialRemovable = cache.get(remaining);
  const lockedAtStart = stage.screws.length - initialRemovable.length;

  let sort = createSortState(stage);
  let sumRemovable = 0;
  let sumSafe = 0;
  let forcedMoves = 0;
  for (const id of result.order) {
    const removable = cache.get(remaining);
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
    naiveFailRate: result.solvable ? measureNaiveFailRate(stage, { cache, plays: options.plays }) : 1,
  };
}
