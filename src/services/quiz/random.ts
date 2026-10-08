import { Rng } from './types';

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 正解と、正解の近くの誤答を混ぜた選択肢（数値）
export function numberChoices(
  rng: Rng,
  answer: number,
  count: number,
  min: number,
  max: number,
): { choices: string[]; answerIndex: number } {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    const spread = Math.max(2, Math.ceil(Math.abs(answer) * 0.3));
    const candidate = rng() < 0.7 ? answer + randInt(rng, -spread, spread) : randInt(rng, min, max);
    if (candidate >= min && candidate <= max && candidate !== answer) set.add(candidate);
  }
  // 範囲が狭くて足りないときは範囲内から順に埋める
  for (let v = min; set.size < count && v <= max; v++) set.add(v);
  const choices = shuffle(rng, Array.from(set)).map(String);
  return { choices, answerIndex: choices.indexOf(String(answer)) };
}
