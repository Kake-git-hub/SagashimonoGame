/**
 * 顔メッシュ（三角形の網）と「塗る絵の座標（UV）」
 * 塗ったメイクは「顔を平らに開いた 1 枚の絵（UV 空間、0〜1）」に描いておき、描画のときに三角形ごとに今の顔へ貼り付ける。
 * こうすると、顔が動いても・口を開けても・横を向いても、塗った場所が肌に付いてくる。
 * ここは DOM にも MediaPipe にも依存しない純粋なロジック（データは meshData.ts）
 */
import { Point3 } from '../types';
import { MESH_TRIANGLES, MESH_UV } from './meshData';
import { IDX } from './regions';

// メッシュの点の数（478 点のうち、後ろの 10 点は黒目でメッシュには入らない）
export const MESH_POINT_COUNT = 468;

export interface FaceUV { u: number; v: number }

export function meshUV(i: number): FaceUV {
  return { u: MESH_UV[i * 2], v: MESH_UV[i * 2 + 1] };
}

function buildPaintTriangles(): number[] {
  // 目の中・口の中の三角形は塗らない（白目や歯に色が乗らないように）
  const holes = [new Set<number>(IDX.eyeR), new Set<number>(IDX.eyeL), new Set<number>(IDX.lipsInner)];
  const out: number[] = [];
  for (let t = 0; t < MESH_TRIANGLES.length; t += 3) {
    const a = MESH_TRIANGLES[t];
    let b = MESH_TRIANGLES[t + 1], c = MESH_TRIANGLES[t + 2];
    if (holes.some(h => h.has(a) && h.has(b) && h.has(c))) continue;
    // 向きをそろえる（UV の上で、画面の座標系で時計回り）。描画と当たり判定で「裏返った三角形」を見分けるのに使う
    const cross = (MESH_UV[b * 2] - MESH_UV[a * 2]) * (MESH_UV[c * 2 + 1] - MESH_UV[a * 2 + 1])
      - (MESH_UV[b * 2 + 1] - MESH_UV[a * 2 + 1]) * (MESH_UV[c * 2] - MESH_UV[a * 2]);
    if (cross === 0) continue;
    if (cross < 0) { const tmp = b; b = c; c = tmp; }
    out.push(a, b, c);
  }
  return out;
}

// 塗る三角形（点の番号を 3 つずつ）。どれも UV の上で同じ向き
export const PAINT_TRIANGLES: readonly number[] = buildPaintTriangles();

// UV の上での顔の幅（頬から頬）
export const UV_FACE_WIDTH = Math.hypot(MESH_UV[454 * 2] - MESH_UV[234 * 2], MESH_UV[454 * 2 + 1] - MESH_UV[234 * 2 + 1]);

/**
 * 映像の上の点（顔の点と同じ正規化座標）が、顔のどこ（UV）に当たるかを求める。顔の外なら null
 * 三角形ごとに重心座標で判定する。横を向いて重なった三角形は、裏返ったものを捨て、手前（z が小さい）を選ぶ
 */
export function locateOnFace(landmarks: readonly Point3[], x: number, y: number): FaceUV | null {
  if (landmarks.length < MESH_POINT_COUNT) return null;
  let best: FaceUV | null = null;
  let bestZ = Infinity;
  const T = PAINT_TRIANGLES;
  for (let t = 0; t < T.length; t += 3) {
    const ia = T[t], ib = T[t + 1], ic = T[t + 2];
    const a = landmarks[ia], b = landmarks[ib], c = landmarks[ic];
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (area <= 1e-12) continue; // 裏返っている / つぶれている
    const wa = ((b.x - x) * (c.y - y) - (b.y - y) * (c.x - x)) / area;
    if (wa < 0) continue;
    const wb = ((c.x - x) * (a.y - y) - (c.y - y) * (a.x - x)) / area;
    if (wb < 0) continue;
    const wc = 1 - wa - wb;
    if (wc < 0) continue;
    const z = a.z * wa + b.z * wb + c.z * wc;
    if (z < bestZ) {
      bestZ = z;
      best = {
        u: MESH_UV[ia * 2] * wa + MESH_UV[ib * 2] * wb + MESH_UV[ic * 2] * wc,
        v: MESH_UV[ia * 2 + 1] * wa + MESH_UV[ib * 2 + 1] * wb + MESH_UV[ic * 2 + 1] * wc,
      };
    }
  }
  return best;
}

/**
 * 顔の UV が、いまの映像のどこ（正規化座標）に来るか（locateOnFace の逆。テストと自動操作用）
 */
export function projectFromFace(landmarks: readonly Point3[], uv: FaceUV): { x: number; y: number } | null {
  if (landmarks.length < MESH_POINT_COUNT) return null;
  const T = PAINT_TRIANGLES;
  for (let t = 0; t < T.length; t += 3) {
    const ia = T[t], ib = T[t + 1], ic = T[t + 2];
    const ax = MESH_UV[ia * 2], ay = MESH_UV[ia * 2 + 1];
    const bx = MESH_UV[ib * 2], by = MESH_UV[ib * 2 + 1];
    const cx = MESH_UV[ic * 2], cy = MESH_UV[ic * 2 + 1];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const wa = ((bx - uv.u) * (cy - uv.v) - (by - uv.v) * (cx - uv.u)) / area;
    if (wa < 0) continue;
    const wb = ((cx - uv.u) * (ay - uv.v) - (cy - uv.v) * (ax - uv.u)) / area;
    if (wb < 0) continue;
    const wc = 1 - wa - wb;
    if (wc < 0) continue;
    const a = landmarks[ia], b = landmarks[ib], c = landmarks[ic];
    return { x: a.x * wa + b.x * wb + c.x * wc, y: a.y * wa + b.y * wb + c.y * wc };
  }
  return null;
}
