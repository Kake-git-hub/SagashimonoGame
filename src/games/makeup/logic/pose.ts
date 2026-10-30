import { LM, STATUS_THRESHOLDS } from '../constants';
import { FaceStatus, HeadPose, Point3 } from '../types';

const RAD = 180 / Math.PI;

/**
 * 顔の点から頭の向きを求める（度）
 * 変換行列を使わず、左右の頬の奥行き差（yaw）・額と顎の奥行き差（pitch）・頬を結ぶ線の傾き（roll）から出す。
 * 精度は「まっすぐ向いているか」を判定できる程度
 */
export function headPose(landmarks: Point3[], aspect = 1): HeadPose {
  const r = landmarks[LM.cheekR];
  const l = landmarks[LM.cheekL];
  const top = landmarks[LM.forehead];
  const bottom = landmarks[LM.chin];
  // x は映像の幅、y は高さで正規化されているので、横長の映像では y を aspect 倍して縦横の比を合わせる
  const width = Math.hypot((l.x - r.x), (l.y - r.y) * aspect) || 1e-6;
  const height = Math.hypot((bottom.x - top.x), (bottom.y - top.y) * aspect) || 1e-6;
  // 自分の右側（映像では左）が手前（z が小さい）なら右を向いている
  const yaw = Math.atan2(l.z - r.z, width) * RAD;
  // 顎が手前なら上を向いている
  const pitch = Math.atan2(bottom.z - top.z, height) * RAD;
  const roll = Math.atan2((l.y - r.y) * aspect, l.x - r.x) * RAD;
  return { yaw, pitch, roll };
}

// 顔の横幅（映像の短い辺に対する割合）。横長でも縦長でも「画面にどれだけ大きく映っているか」が同じ尺度になる
export function faceWidthRatio(landmarks: Point3[], aspect = 1): number {
  const widthNorm = Math.abs(landmarks[LM.cheekL].x - landmarks[LM.cheekR].x);
  return aspect > 1 ? widthNorm * aspect : widthNorm;
}

// 顔の外接矩形（正規化座標）
export function faceBounds(landmarks: Point3[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export interface StatusInput {
  landmarks: Point3[] | null;
  aspect: number;        // 映像の幅 / 高さ
  luma: number | null;   // 顔のあたりの平均輝度（0〜255）。未計測なら null
}

/**
 * 状態欄に出す状態を決める。優先順: 顔なし > とおい > ちかい > よこむき > くらい > OK
 */
export function classifyStatus({ landmarks, aspect, luma }: StatusInput): FaceStatus {
  if (!landmarks || landmarks.length === 0) return 'none';
  const t = STATUS_THRESHOLDS;
  const width = faceWidthRatio(landmarks, aspect);
  if (width < t.farWidthRatio) return 'far';
  if (width > t.closeWidthRatio) return 'close';
  const pose = headPose(landmarks, aspect);
  if (Math.abs(pose.yaw) > t.turnedYawDeg || Math.abs(pose.pitch) > t.turnedPitchDeg) return 'turned';
  if (luma !== null && luma < t.darkLuma) return 'dark';
  return 'ok';
}
