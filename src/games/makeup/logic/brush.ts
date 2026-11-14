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
  flow: number;      // 1 回押したときの濃さ（0〜1）。重ねて なぞるほど濃くなる
}

// パーツごとの「ふつう」の筆。チークやベースは大きくふんわり、アイラインやまゆは細くくっきり
const BASE_BRUSH: Record<LayerId, { radius: number; hardness: number }> = {
  base:      { radius: 0.06,  hardness: 0.2 },
  concealer: { radius: 0.022, hardness: 0.3 },
  blush:     { radius: 0.05,  hardness: 0.1 },
  eyeshadow: { radius: 0.018, hardness: 0.3 },
  eyeliner:  { radius: 0.005, hardness: 0.6 },
  brow:      { radius: 0.008, hardness: 0.5 },
  highlight: { radius: 0.02,  hardness: 0.2 },
  lip:       { radius: 0.011, hardness: 0.5 },
};

const SIZE_SCALE: Record<BrushSize, number> = { s: 0.6, m: 1, l: 1.7 };

// 「はみださない」のときは型が形を決めるので、筆は太めにして なぞりやすくする
const ASSIST_SCALE = 2.2;
const ASSIST_MIN_RADIUS = 0.022;

export function brushFor(layer: LayerId, size: BrushSize, assist: boolean): BrushSpec {
  const base = BASE_BRUSH[layer];
  const radius = base.radius * SIZE_SCALE[size];
  if (assist) {
    return { radius: Math.max(ASSIST_MIN_RADIUS * SIZE_SCALE[size], radius * ASSIST_SCALE), hardness: 0.6, flow: 0.6 };
  }
  return { radius, hardness: base.hardness, flow: 0.45 };
}

export function eraserBrush(size: BrushSize): BrushSpec {
  return { radius: 0.03 * SIZE_SCALE[size], hardness: 0.6, flow: 1 };
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
