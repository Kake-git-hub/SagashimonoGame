import { Point3 } from '../types';

/**
 * 点のブレを抑える指数移動平均
 * prev が無い（最初のフレーム）か点の数が変わったときは next をそのまま返す
 */
export function smoothLandmarks(prev: Point3[] | null, next: Point3[], alpha: number): Point3[] {
  if (!prev || prev.length !== next.length) return next;
  const a = Math.max(0, Math.min(1, alpha));
  const b = 1 - a;
  const out: Point3[] = new Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const p = prev[i];
    const n = next[i];
    out[i] = { x: p.x * b + n.x * a, y: p.y * b + n.y * a, z: p.z * b + n.z * a };
  }
  return out;
}

/**
 * 「顔が見つからないフレームが続いても、しばらくは直前の結果を使う」ための入れ物
 * ブラシや手で一瞬隠れたときに描画が消えないようにする
 */
export class FrameHolder<T> {
  private last: T | null = null;
  private lastAt = 0;
  constructor(private holdMs: number) {}

  update(value: T | null, now: number): T | null {
    if (value !== null) {
      this.last = value;
      this.lastAt = now;
      return value;
    }
    if (this.last !== null && now - this.lastAt <= this.holdMs) return this.last;
    this.last = null;
    return null;
  }

  // 直前の結果を保持中（今のフレームでは見つかっていない）か
  isHolding(now: number): boolean {
    return this.last !== null && now - this.lastAt > 0 && now - this.lastAt <= this.holdMs;
  }

  clear(): void {
    this.last = null;
  }
}
