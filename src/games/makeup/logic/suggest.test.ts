import { describe, expect, it } from 'vitest';
import fixture from './fixtures/portrait-frame.json';
import { Point3 } from '../types';
import { classifyEyeShape, classifyEyeSize, classifyFaceShape, classifySkin, faceMetrics, suggest } from './suggest';

const base: Point3[] = (fixture.landmarks as number[][]).map(([x, y, z]) => ({ x, y, z }));
const W = fixture.width, H = fixture.height;

// 顔の中心を基準に縦横を伸ばす
function stretch(landmarks: Point3[], sx: number, sy: number): Point3[] {
  const cx = landmarks[1].x, cy = landmarks[1].y;
  return landmarks.map(p => ({ x: cx + (p.x - cx) * sx, y: cy + (p.y - cy) * sy, z: p.z }));
}

describe('suggest（サンプルの顔）', () => {
  it('たまご型・ふつうの目・ふつうの大きさ', () => {
    const m = faceMetrics(base, W, H);
    expect(m.ratio).toBeGreaterThan(1.22);
    expect(m.ratio).toBeLessThan(1.42);
    expect(classifyFaceShape(m)).toBe('oval');
    expect(classifyEyeShape(m)).toBe('neutral');
    expect(classifyEyeSize(m)).toBe('medium');
  });

  it('縦に伸ばすと おもなが、横に広げると まるがお', () => {
    expect(classifyFaceShape(faceMetrics(stretch(base, 1, 1.2), W, H))).toBe('long');
    expect(classifyFaceShape(faceMetrics(stretch(base, 1.12, 1), W, H))).toBe('round');
  });

  it('あごを広げると しかくがた、額を広げてあごを細くすると ハートがた', () => {
    const m = faceMetrics(base, W, H);
    expect(classifyFaceShape({ ...m, jaw: 0.9 })).toBe('square');
    expect(classifyFaceShape({ ...m, jaw: 0.7, forehead: 0.9 })).toBe('heart');
  });

  it('目尻を上げると つりめ、下げると たれめ', () => {
    const m = faceMetrics(base, W, H);
    expect(classifyEyeShape({ ...m, eyeTilt: 0.12 })).toBe('up');
    expect(classifyEyeShape({ ...m, eyeTilt: -0.06 })).toBe('down');
  });

  it('頭が傾いても目の判定は変わらない（左右の平均で打ち消す）', () => {
    const cx = base[1].x, cy = base[1].y;
    const a = (12 * Math.PI) / 180;
    const rolled = base.map(p => {
      const dx = (p.x - cx) * W, dy = (p.y - cy) * H;
      return { x: cx + (dx * Math.cos(a) - dy * Math.sin(a)) / W, y: cy + (dx * Math.sin(a) + dy * Math.cos(a)) / H, z: p.z };
    });
    const m0 = faceMetrics(base, W, H), m1 = faceMetrics(rolled, W, H);
    expect(Math.abs(m1.eyeTilt - m0.eyeTilt)).toBeLessThan(0.02);
  });

  it('肌の明るさと色み', () => {
    expect(classifySkin(null)).toEqual({ brightness: null, tone: 'unknown' });
    expect(classifySkin({ r: 10, g: 10, b: 10 }).tone).toBe('unknown');
    expect(classifySkin({ r: 230, g: 170, b: 130 })).toEqual({ brightness: 'light', tone: 'warm' });
    expect(classifySkin({ r: 225, g: 190, b: 180 })).toEqual({ brightness: 'light', tone: 'cool' });
    expect(classifySkin({ r: 150, g: 110, b: 85 })).toEqual({ brightness: 'medium', tone: 'warm' });
    expect(classifySkin({ r: 110, g: 80, b: 70 }).brightness).toBe('deep');
  });

  it('色みに合わせた色と、目の大きさに合わせた手順を返す', () => {
    const warm = suggest(base, W, H, { r: 230, g: 170, b: 130 });
    expect(warm.look.lip?.color).toBe('#f0806a');
    expect(warm.recipeId).toBe('natural');
    const cool = suggest(base, W, H, { r: 225, g: 190, b: 180 });
    expect(cool.look.lip?.color).toBe('#d9617f');
    const m = faceMetrics(base, W, H);
    expect(classifyEyeSize({ ...m, eyeWidth: 0.16 })).toBe('small');
  });
});
