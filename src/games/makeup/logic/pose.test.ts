import { describe, expect, it } from 'vitest';
import { LANDMARK_COUNT, LM } from '../constants';
import { Point3 } from '../types';
import { classifyStatus, faceWidthRatio, headPose } from './pose';

// 正面を向いた顔のつもりの点群（必要な番号だけ意味のある値、他は中央）
function makeFace(opts: { width?: number; yaw?: number; pitch?: number; roll?: number } = {}): Point3[] {
  const width = opts.width ?? 0.4;
  const height = width * 1.3;
  const cx = 0.5, cy = 0.5;
  const pts: Point3[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: cx, y: cy, z: 0 }));
  const roll = ((opts.roll ?? 0) * Math.PI) / 180;
  const dx = Math.cos(roll) * width / 2, dy = Math.sin(roll) * width / 2;
  // 自分の右頬は映像の左側（x が小さい）
  pts[LM.cheekR] = { x: cx - dx, y: cy - dy, z: 0 };
  pts[LM.cheekL] = { x: cx + dx, y: cy + dy, z: 0 };
  pts[LM.forehead] = { x: cx, y: cy - height / 2, z: 0 };
  pts[LM.chin] = { x: cx, y: cy + height / 2, z: 0 };
  if (opts.yaw) {
    const dz = Math.tan((opts.yaw * Math.PI) / 180) * width;
    pts[LM.cheekL].z = dz / 2;
    pts[LM.cheekR].z = -dz / 2;
  }
  if (opts.pitch) {
    const dz = Math.tan((opts.pitch * Math.PI) / 180) * height;
    pts[LM.chin].z = dz / 2;
    pts[LM.forehead].z = -dz / 2;
  }
  return pts;
}

describe('headPose', () => {
  it('正面なら 0 度付近', () => {
    const pose = headPose(makeFace(), 1);
    expect(Math.abs(pose.yaw)).toBeLessThan(1);
    expect(Math.abs(pose.pitch)).toBeLessThan(1);
    expect(Math.abs(pose.roll)).toBeLessThan(1);
  });

  it('右を向く（自分の右頬が手前）と yaw が正', () => {
    expect(headPose(makeFace({ yaw: 30 }), 1).yaw).toBeCloseTo(30, 0);
    expect(headPose(makeFace({ yaw: -30 }), 1).yaw).toBeCloseTo(-30, 0);
  });

  it('上を向く（顎が手前）と pitch が正', () => {
    expect(headPose(makeFace({ pitch: 25 }), 1).pitch).toBeCloseTo(25, 0);
  });

  it('傾けると roll に出る', () => {
    expect(headPose(makeFace({ roll: 15 }), 1).roll).toBeCloseTo(15, 0);
  });
});

describe('classifyStatus', () => {
  const aspect = 1;
  it('顔が無ければ none', () => {
    expect(classifyStatus({ landmarks: null, aspect, luma: 200 })).toBe('none');
    expect(classifyStatus({ landmarks: [], aspect, luma: 200 })).toBe('none');
  });

  it('小さすぎると far、大きすぎると close', () => {
    expect(faceWidthRatio(makeFace({ width: 0.1 }))).toBeCloseTo(0.1);
    expect(classifyStatus({ landmarks: makeFace({ width: 0.1 }), aspect, luma: 200 })).toBe('far');
    expect(classifyStatus({ landmarks: makeFace({ width: 0.9 }), aspect, luma: 200 })).toBe('close');
  });

  it('横長の映像では短い辺を基準にする（横幅の 15% でも高さの 27% なら ok）', () => {
    const wide = 16 / 9;
    expect(faceWidthRatio(makeFace({ width: 0.15 }), wide)).toBeCloseTo(0.2667);
    expect(classifyStatus({ landmarks: makeFace({ width: 0.15 }), aspect: wide, luma: 200 })).toBe('ok');
    expect(classifyStatus({ landmarks: makeFace({ width: 0.1 }), aspect: wide, luma: 200 })).toBe('far');
  });

  it('横を向くと turned、暗いと dark、それ以外は ok', () => {
    expect(classifyStatus({ landmarks: makeFace({ yaw: 40 }), aspect, luma: 200 })).toBe('turned');
    expect(classifyStatus({ landmarks: makeFace(), aspect, luma: 20 })).toBe('dark');
    expect(classifyStatus({ landmarks: makeFace(), aspect, luma: null })).toBe('ok');
    expect(classifyStatus({ landmarks: makeFace(), aspect, luma: 150 })).toBe('ok');
  });

  it('向きより距離を優先する', () => {
    expect(classifyStatus({ landmarks: makeFace({ width: 0.1, yaw: 40 }), aspect, luma: 10 })).toBe('far');
  });
});
