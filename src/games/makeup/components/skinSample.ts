import { FaceFrame } from '../types';
import { SkinSample } from '../logic/suggest';
import { FrameSource } from '../services/faceTracker';
import { IDX } from '../logic/regions';

/**
 * 頬の小さな領域の平均色を測る（ていあん の肌の色み用）
 * 両頬の点のまわりを小さな canvas に写して平均する。失敗したら null
 */
export function sampleSkin(source: FrameSource, frame: FaceFrame, w: number, h: number): SkinSample | null {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const faceWidth = Math.abs(frame.landmarks[454].x - frame.landmarks[234].x) * w;
  const size = Math.max(4, faceWidth * 0.08);
  let r = 0, g = 0, b = 0, n = 0;
  try {
    for (const ids of [IDX.cheekR, IDX.cheekL]) {
      let cx = 0, cy = 0;
      for (const i of ids) { cx += frame.landmarks[i].x * w; cy += frame.landmarks[i].y * h; }
      cx /= ids.length; cy /= ids.length;
      ctx.clearRect(0, 0, 16, 16);
      ctx.drawImage(source, cx - size / 2, cy - size / 2, size, size, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
  } catch {
    return null;
  }
  if (n === 0) return null;
  return { r: r / n, g: g / n, b: b / n };
}
