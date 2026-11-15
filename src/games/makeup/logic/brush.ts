/**
 * 塗るときの筆（ふで）
 * 大きさは UV（塗る絵の座標、顔ぜんたいで 0〜1）で持つので、顔が大きく映っても小さく映っても「顔に対する太さ」は同じ
 */
import { FaceUV } from './faceMesh';
import { LayerId } from './layers';

export type BrushSize = 's' | 'm' | 'l';
export const BRUSH_SIZES: readonly BrushSize[] = ['s', 'm', 'l'];

export interface BrushSpec {
  radius: number;    // 半径（UV）
  hardness: number;  // 0〜1。中心からこの割合までは濃さが一定で、その外がぼける
  // ひと筆（指を付けてから離すまで）で付く濃さの上限（0〜1）。
  // 同じ所を重ねて塗る回数で濃さが決まる: 1 回で flow、2 回で 1 − (1 − flow)²、… と少しずつ濃くなる
  flow: number;
}

// パーツごとの「ふつう」の筆。チークやベースは大きくふんわり、アイラインやまゆは細くくっきり。
// flow はひと筆の濃さ。うすく重ねたいもの（チーク・ベース）は小さく、線をはっきり引きたいもの（アイライン）は大きく
const BASE_BRUSH: Record<LayerId, { radius: number; hardness: number; flow: number }> = {
  base:      { radius: 0.06,  hardness: 0.2, flow: 0.3 },
  concealer: { radius: 0.022, hardness: 0.3, flow: 0.35 },
  blush:     { radius: 0.05,  hardness: 0.1, flow: 0.3 },
  eyeshadow: { radius: 0.018, hardness: 0.3, flow: 0.35 },
  eyeliner:  { radius: 0.005, hardness: 0.6, flow: 0.6 },
  brow:      { radius: 0.008, hardness: 0.5, flow: 0.45 },
  highlight: { radius: 0.02,  hardness: 0.2, flow: 0.35 },
  lip:       { radius: 0.011, hardness: 0.5, flow: 0.4 },
};

const SIZE_SCALE: Record<BrushSize, number> = { s: 0.6, m: 1, l: 1.7 };

export function brushFor(layer: LayerId, size: BrushSize): BrushSpec {
  const base = BASE_BRUSH[layer];
  return { radius: base.radius * SIZE_SCALE[size], hardness: base.hardness, flow: base.flow };
}

export function eraserBrush(size: BrushSize): BrushSpec {
  return { radius: 0.03 * SIZE_SCALE[size], hardness: 0.6, flow: 1 };
}

// 同じ所を n 回なぞったときの濃さ（0〜1）
export function buildUp(flow: number, strokes: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, flow)), Math.max(0, strokes));
}

// これより離れた 2 点はつながない（顔を見失ったあとなどに、長い線が引かれないように）
const MAX_JOIN_DISTANCE = 0.2;

/**
 * 前の点から今の点までに押すスタンプの位置。前の点は含まず、今の点で終わる。
 * 間隔は半径の 1/3（細い筆でも線が途切れない）。前の点が無ければ今の点だけ
 */
export function strokeStamps(from: FaceUV | null, to: FaceUV, radius: number): FaceUV[] {
  if (!from) return [to];
  const du = to.u - from.u, dv = to.v - from.v;
  const dist = Math.hypot(du, dv);
  if (dist > MAX_JOIN_DISTANCE) return [to];
  const spacing = Math.max(radius / 3, 0.0015);
  const n = Math.max(1, Math.ceil(dist / spacing));
  const out: FaceUV[] = [];
  for (let i = 1; i < n; i++) out.push({ u: from.u + (du * i) / n, v: from.v + (dv * i) / n });
  out.push(to);
  return out;
}
