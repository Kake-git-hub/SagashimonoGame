import { describe, expect, it } from 'vitest';
import fixture from './fixtures/portrait-frame.json';
import { Point3 } from '../types';
import { faceBox, focusBox } from './focus';
import { LAYER_ORDER } from './layers';

const landmarks: Point3[] = (fixture.landmarks as number[][]).map(([x, y, z]) => ({ x, y, z }));
const area = (b: { x0: number; y0: number; x1: number; y1: number }) => (b.x1 - b.x0) * (b.y1 - b.y0);
const inside = (b: { x0: number; y0: number; x1: number; y1: number }, i: number) =>
  landmarks[i].x > b.x0 && landmarks[i].x < b.x1 && landmarks[i].y > b.y0 && landmarks[i].y < b.y1;

describe('focusBox', () => {
  const face = faceBox(landmarks);

  it('どのパーツの範囲も顔より大きくはならず、面積がある', () => {
    for (const part of LAYER_ORDER) {
      const b = focusBox(landmarks, part);
      expect(area(b)).toBeGreaterThan(0);
      expect(area(b)).toBeLessThanOrEqual(area(face) + 1e-9);
    }
  });

  it('リップは口のまわりだけ（目は入らない）で、顔よりずっと小さい', () => {
    const b = focusBox(landmarks, 'lip');
    for (const i of [61, 291, 0, 17]) expect(inside(b, i)).toBe(true);
    expect(inside(b, 33)).toBe(false);
    expect(inside(b, 263)).toBe(false);
    expect(area(b) / area(face)).toBeLessThan(0.35);
  });

  it('アイシャドウ・アイライン・まゆ は両目と眉が入り、口は入らない', () => {
    for (const part of ['eyeshadow', 'eyeliner', 'brow'] as const) {
      const b = focusBox(landmarks, part);
      for (const i of [33, 133, 362, 263]) expect(inside(b, i)).toBe(true);
      expect(inside(b, 17)).toBe(false);
    }
    for (const i of [70, 300, 105, 334]) expect(inside(focusBox(landmarks, 'brow'), i)).toBe(true);
  });

  it('チークは両方の頬が入る', () => {
    const b = focusBox(landmarks, 'blush');
    for (const i of [50, 280, 205, 425]) expect(inside(b, i)).toBe(true);
  });
});
