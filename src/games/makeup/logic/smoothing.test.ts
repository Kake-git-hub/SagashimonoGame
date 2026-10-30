import { describe, expect, it } from 'vitest';
import { FrameHolder, smoothLandmarks } from './smoothing';

describe('smoothLandmarks', () => {
  it('最初のフレームはそのまま返す', () => {
    const next = [{ x: 1, y: 2, z: 3 }];
    expect(smoothLandmarks(null, next, 0.5)).toBe(next);
  });

  it('前の値と新しい値を係数で混ぜる', () => {
    const prev = [{ x: 0, y: 0, z: 0 }];
    const next = [{ x: 1, y: 2, z: 4 }];
    expect(smoothLandmarks(prev, next, 0.25)[0]).toEqual({ x: 0.25, y: 0.5, z: 1 });
  });

  it('点の数が変わったら新しい値を使う', () => {
    const prev = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
    const next = [{ x: 1, y: 1, z: 1 }];
    expect(smoothLandmarks(prev, next, 0.5)).toBe(next);
  });
});

describe('FrameHolder', () => {
  it('見つからない間も保持時間内は直前の結果を返す', () => {
    const holder = new FrameHolder<string>(500);
    expect(holder.update('a', 0)).toBe('a');
    expect(holder.update(null, 300)).toBe('a');
    expect(holder.isHolding(300)).toBe(true);
    expect(holder.update(null, 600)).toBeNull();
    expect(holder.update(null, 700)).toBeNull();
  });

  it('新しい結果が来たら保持時間を数え直す', () => {
    const holder = new FrameHolder<number>(100);
    holder.update(1, 0);
    holder.update(2, 90);
    expect(holder.update(null, 150)).toBe(2);
    expect(holder.update(null, 200)).toBeNull();
  });
});
