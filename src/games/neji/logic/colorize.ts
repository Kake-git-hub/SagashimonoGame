/**
 * ネジの色の割り当て（ステージ生成・既存ステージの塗り直し用）
 *
 * 構造（パーツ・ネジの位置・貫通）はそのままに、ネジの色とボックスの順番だけを決め直す。
 * 目標:
 *   - 同じ色のネジが近くに固まらない（隣のネジはなるべく違う色）
 *   - 同じ色のネジが「外せるようになる順番（層）」の違う所に散らばる
 *     = ボックスを 1 つ埋めるのに奥まで掘る必要があり、おきばのやりくりが要る
 *   - それでも必ず解ける（ソルバーで確認）
 *
 * three.js の数学クラスだけに依存する（Node のテストで動く）
 */
import { SCREW_COLORS, ScrewColor, Stage } from '../types';
import { screwHeadTop } from './geometry';
import { listRemovableScrews } from './removable';
import { measureStage, RemovableCache, StageMetrics } from './metrics';
import { solveStage } from './solver';

export interface ColorizeOptions {
  seed?: number;
  colorCount?: number;      // 使う色の数（省略時はボックス数に応じて自動。最大 6）
  difficulty?: number;      // 1〜5。大きいほど「色の順番」で悩む配置を選ぶ
  restarts?: number;        // 探索のやり直し回数（多いほど良い配置が見つかるが遅い）
  maxSolverStates?: number; // ソルバーの打ち切り（これを超える配置は採用しない）
}

export interface ColorizeResult {
  stage: Stage;
  metrics: StageMetrics;
  score: number;            // 低いほど良い（内部の目安）
  layers: Record<string, number>; // ネジ id → 層（最初から外せるネジが 0）
}

// 乱数（再現できるように種を持つ。mulberry32）
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 各ネジの「層」: 色を無視して、外せるネジを全部外す → 次に外せるネジを全部外す… と繰り返したときの回数。
 * 0 が最初から外せるネジ。構造的にどれだけ奥にあるかの目安
 */
export function computeScrewLayers(stage: Stage): Record<string, number> {
  const layers: Record<string, number> = {};
  let remaining = new Set(stage.screws.map(s => s.id));
  let layer = 0;
  while (remaining.size > 0) {
    const held = new Set<string>();
    for (const screw of stage.screws) {
      if (remaining.has(screw.id)) for (const id of screw.partIds) held.add(id);
    }
    const remainingParts = new Set(stage.parts.filter(p => p.fixed || held.has(p.id)).map(p => p.id));
    const removable = listRemovableScrews({ stage, remainingParts, remainingScrews: remaining });
    if (removable.length === 0) {
      // 構造的に外せないネジが残った（検証で落ちる配置）。残りは最後の層にまとめる
      for (const id of remaining) layers[id] = layer;
      break;
    }
    for (const id of removable) layers[id] = layer;
    remaining = new Set([...remaining].filter(id => !removable.includes(id)));
    layer += 1;
  }
  return layers;
}

interface Pair {
  a: number;
  b: number;
  weight: number;
}

// 近くのネジ同士の組（頭の位置が近い順に各ネジ 3 本まで）。重みは近いほど大きい
function neighborPairs(stage: Stage, layers: Record<string, number>): Pair[] {
  const heads = stage.screws.map(s => screwHeadTop(s));
  const seen = new Set<string>();
  const pairs: Pair[] = [];
  const n = stage.screws.length;
  for (let i = 0; i < n; i++) {
    const dists: { j: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      dists.push({ j, d: heads[i].distanceTo(heads[j]) });
    }
    dists.sort((x, y) => x.d - y.d);
    for (const { j, d } of dists.slice(0, 3)) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sameLayer = layers[stage.screws[i].id] === layers[stage.screws[j].id];
      // 近い組ほど重く、同じ層の近い組（同時に見えて同時に外せる）はさらに重く
      pairs.push({ a: i, b: j, weight: (1 + 2 / Math.max(d, 0.5)) * (sameLayer ? 1.5 : 1) });
    }
  }
  return pairs;
}

// 配置の静的な悪さ（低いほど良い）
function staticScore(colors: ScrewColor[], pairs: Pair[], layers: number[], samePart: Pair[]): number {
  let score = 0;
  for (const p of pairs) if (colors[p.a] === colors[p.b]) score += p.weight;
  for (const p of samePart) if (colors[p.a] === colors[p.b]) score += p.weight;
  // 同じ色が同じ層に集まるほど悪い（色ごとに、層の種類数が少ないと加点）
  const byColor = new Map<ScrewColor, number[]>();
  colors.forEach((c, i) => {
    const list = byColor.get(c) ?? [];
    list.push(layers[i]);
    byColor.set(c, list);
  });
  for (const list of byColor.values()) {
    const distinct = new Set(list).size;
    score += (list.length - distinct) * 1.2;
  }
  return score;
}

// 色ごとのボックス数を決める（ネジの本数 ÷ 容量 を色に配る）
function chooseColorBoxes(boxCount: number, colorCount: number, rng: () => number): ScrewColor[] {
  const palette = shuffle([...SCREW_COLORS], rng).slice(0, Math.min(colorCount, boxCount, SCREW_COLORS.length));
  const boxes: ScrewColor[] = [];
  for (let i = 0; i < boxCount; i++) boxes.push(palette[i % palette.length]);
  return boxes;
}

/**
 * ボックスの順番の候補: 各ボックスに属するネジの層の平均が早い順。
 * 同じ色が複数ボックスある場合は、その色のネジを層順に 3 本ずつ区切って並べる
 */
function orderBoxes(stage: Stage, colors: ScrewColor[], layers: number[], rng: () => number, jitter: number): ScrewColor[] {
  const boxes: { color: ScrewColor; key: number }[] = [];
  const byColor = new Map<ScrewColor, number[]>();
  colors.forEach((c, i) => {
    const list = byColor.get(c) ?? [];
    list.push(layers[i]);
    byColor.set(c, list);
  });
  for (const [color, list] of byColor) {
    const sorted = [...list].sort((a, b) => a - b);
    for (let start = 0; start < sorted.length; start += stage.boxCapacity) {
      const chunk = sorted.slice(start, start + stage.boxCapacity);
      const mean = chunk.reduce((s, x) => s + x, 0) / chunk.length;
      boxes.push({ color, key: mean + (rng() - 0.5) * jitter });
    }
  }
  boxes.sort((a, b) => a.key - b.key);
  return boxes.map(b => b.color);
}

function withColors(stage: Stage, colors: ScrewColor[], boxes: ScrewColor[]): Stage {
  return {
    ...stage,
    boxes,
    screws: stage.screws.map((s, i) => ({ ...s, color: colors[i] })),
  };
}

/**
 * ネジの色とボックスの順番を決め直す。解ける配置が見つからなければ null
 */
export function colorizeStage(input: Stage, options: ColorizeOptions = {}): ColorizeResult | null {
  const n = input.screws.length;
  if (n === 0 || n % input.boxCapacity !== 0) return null;
  const difficulty = options.difficulty ?? input.difficulty ?? 3;
  const rng = makeRng(options.seed ?? 1);
  const boxCount = n / input.boxCapacity;
  const colorCount = options.colorCount ?? Math.min(SCREW_COLORS.length, Math.max(2, Math.ceil(boxCount * (difficulty >= 4 ? 1 : 0.8))));
  const restarts = options.restarts ?? 16;
  const maxSolverStates = options.maxSolverStates ?? 20_000;
  // 「外せるか」は色に関係ないので、候補をまたいで使い回す
  const cache = new RemovableCache(input);
  // 難易度ごとの目標: 手当たりしだいに外したときの失敗率
  const targetFail = [0, 0, 0.08, 0.3, 0.5, 0.65][Math.max(1, Math.min(5, Math.round(difficulty)))];

  const layerMap = computeScrewLayers(input);
  const layers = input.screws.map(s => layerMap[s.id]);
  const pairs = neighborPairs(input, layerMap);
  // 同じパーツに頭が乗っているネジ同士（見た目の固まり）
  const samePart: Pair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (input.screws[i].partIds[0] === input.screws[j].partIds[0]) samePart.push({ a: i, b: j, weight: 0.6 });
    }
  }

  let best: ColorizeResult | null = null;
  for (let r = 0; r < restarts; r++) {
    const boxesOfColor = chooseColorBoxes(boxCount, colorCount, rng);
    // 初期配置: 色を本数分ならべてシャッフル
    let colors = shuffle(boxesOfColor.flatMap(c => Array.from({ length: input.boxCapacity }, () => c)), rng);
    let score = staticScore(colors, pairs, layers, samePart);

    // 山登り: 2 本の色を入れ替えて良くなれば採用
    const steps = 60 * n;
    for (let step = 0; step < steps; step++) {
      const i = Math.floor(rng() * n);
      const j = Math.floor(rng() * n);
      if (i === j || colors[i] === colors[j]) continue;
      const next = [...colors];
      [next[i], next[j]] = [next[j], next[i]];
      const nextScore = staticScore(next, pairs, layers, samePart);
      // 少し悪くなる手もたまに受け入れる（局所解から抜ける）
      if (nextScore <= score || rng() < 0.02) {
        colors = next;
        score = nextScore;
      }
    }

    // ボックスの順番: 層の平均順をいくつか試し、解けるものを採る。
    // 難しくしたいときは、奥のネジの色のボックスを先に出す（見えているネジの色のボックスが無く、おきばがたまる）
    const base = orderBoxes(input, colors, layers, rng, 0);
    const candidates: ScrewColor[][] = [base];
    if (difficulty >= 3) {
      for (const k of [1, 2]) {
        if (k >= base.length) break;
        const swapped = [...base];
        [swapped[0], swapped[k]] = [swapped[k], swapped[0]];
        candidates.push(swapped);
      }
    }
    candidates.push(orderBoxes(input, colors, layers, rng, 2.0));
    let bestOfRestart: ColorizeResult | null = null;
    for (const boxes of candidates) {
      const stage = withColors(input, colors, boxes);
      const solved = solveStage(stage, { maxStates: maxSolverStates });
      if (!solved.solvable) continue;
      const metrics = measureStage(stage, { cache, plays: 12 });
      // 難しさの目安: 先を読まない遊び方の失敗率を難易度ごとの目標に近づける。
      // 後戻り（探索状態数 − ネジの本数）が大きい配置は、解き筋が分かりにくいので避ける
      const backtrack = metrics.visited - n;
      const total = score + Math.abs(metrics.naiveFailRate - targetFail) * 40 + Math.max(0, backtrack - 4) * 0.5;
      if (!bestOfRestart || total < bestOfRestart.score) {
        bestOfRestart = { stage, metrics, score: total, layers: layerMap };
      }
      // 目標の失敗率に十分近ければ、この色配置では他の順番を試さない
      if (Math.abs(metrics.naiveFailRate - targetFail) < 0.08) break;
    }
    if (bestOfRestart && (!best || bestOfRestart.score < best.score)) best = bestOfRestart;
  }
  return best;
}

/**
 * 同じ色のネジが近くに固まっている度合い（0 以上。低いほど混ざっている）
 * 既存ステージの比較やテストに使う
 */
export function colorClusterScore(stage: Stage): number {
  const layers = computeScrewLayers(stage);
  const pairs = neighborPairs(stage, layers);
  const colors = stage.screws.map(s => s.color);
  let score = 0;
  for (const p of pairs) if (colors[p.a] === colors[p.b]) score += 1;
  return score / Math.max(pairs.length, 1);
}
