/**
 * パーツを選んだときに「アップ」で見せる範囲
 * 顔の点から、そのパーツのあたりの外接矩形（映像の正規化座標）を求め、まわりに余白を付ける
 */
import { Point3 } from '../types';
import { LayerId } from './layers';
import { IDX } from './regions';

export interface Box { x0: number; y0: number; x1: number; y1: number }

const EYES = [...IDX.eyeR, ...IDX.eyeL];
const BROWS = [...IDX.browR, ...IDX.browL];

// パーツごとに、範囲を決める点（番号は regions.ts のもの）と、まわりに付ける余白（範囲の大きさに対する割合）
const FOCUS: Record<LayerId, { points: readonly number[]; margin: number }> = {
  lip: { points: IDX.lipsOuter, margin: 0.3 },
  blush: { points: [...IDX.cheekR, ...IDX.cheekL, 234, 454, 127, 356], margin: 0.12 },
  eyeshadow: { points: [...EYES, ...BROWS], margin: 0.2 },
  eyeliner: { points: [...EYES, ...IDX.belowBrowR, ...IDX.belowBrowL], margin: 0.25 },
  brow: { points: [...BROWS, ...EYES], margin: 0.2 },
  concealer: { points: [...EYES, ...IDX.cheekTopR, ...IDX.cheekTopL], margin: 0.2 },
  // ベースとハイライトは顔ぜんたいに塗るので、顔が収まる大きさ
  highlight: { points: IDX.faceOval, margin: 0.06 },
  base: { points: IDX.faceOval, margin: 0.06 },
};

function boxOf(landmarks: readonly Point3[], ids: readonly number[], margin: number): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of ids) {
    const p = landmarks[i];
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  const mx = (x1 - x0) * margin, my = (y1 - y0) * margin;
  return { x0: x0 - mx, y0: y0 - my, x1: x1 + mx, y1: y1 + my };
}

// 顔ぜんたい（アップにしないとき、顔のある側を見せるのに使う）
export function faceBox(landmarks: readonly Point3[]): Box {
  return boxOf(landmarks, IDX.faceOval, 0.06);
}

// パーツのあたり（アップで見せる範囲）
export function focusBox(landmarks: readonly Point3[], part: LayerId): Box {
  const f = FOCUS[part];
  return boxOf(landmarks, f.points, f.margin);
}
