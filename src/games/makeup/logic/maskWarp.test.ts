import { describe, expect, it } from 'vitest';
import { meshUV, projectFromFace } from './faceMesh';
import { blurAlpha, edgeFeatherUV, warpAlphaToUV } from './maskWarp';
import { referenceFace } from './referenceFace';

const ref = referenceFace(256);
const points = ref.landmarks.map(p => ({ x: p.x * ref.width, y: p.y * ref.height }));
const SIZE = 128;
const at = (img: Uint8ClampedArray, u: number, v: number) => img[Math.floor(v * SIZE) * SIZE + Math.floor(u * SIZE)];

describe('referenceFace', () => {
  it('顔のまわりだけを切り出した絵に、点がすべて収まる', () => {
    expect(ref.width).toBe(256);
    expect(ref.height).toBeGreaterThan(200);
    for (const p of ref.landmarks) {
      expect(p.x).toBeGreaterThan(0.05);
      expect(p.x).toBeLessThan(0.95);
      expect(p.y).toBeGreaterThan(0.02);
      expect(p.y).toBeLessThan(0.98);
    }
  });
});

describe('warpAlphaToUV', () => {
  it('全面が塗られた絵は、メッシュの中が全部 255・外が 0 になる', () => {
    const src = { width: ref.width, height: ref.height, data: new Uint8ClampedArray(ref.width * ref.height).fill(255) };
    const out = warpAlphaToUV(src, points, SIZE);
    expect(at(out, 0.5, 0.5)).toBe(255);                       // 鼻のあたり
    expect(at(out, meshUV(50).u, meshUV(50).v)).toBe(255);     // 頬
    expect(at(out, 0.02, 0.02)).toBe(0);                       // 顔の外（左上のすみ）
    let covered = 0;
    for (const a of out) if (a === 255) covered++;
    expect(covered / out.length).toBeGreaterThan(0.6);
    // 半端な値が無い = 三角形のつなぎ目にすき間が無い
    expect(out.every(a => a === 0 || a === 255)).toBe(true);
  });

  it('映像の上で塗った場所が、UV の対応する場所に写る', () => {
    // お手本の顔の「右頬（UV で決めた場所）」のまわりだけを塗る
    const target = { u: meshUV(50).u, v: meshUV(50).v };
    const p = projectFromFace(ref.landmarks, target)!;
    const cx = p.x * ref.width, cy = p.y * ref.height;
    const data = new Uint8ClampedArray(ref.width * ref.height);
    for (let y = 0; y < ref.height; y++) {
      for (let x = 0; x < ref.width; x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < 10) data[y * ref.width + x] = 255;
      }
    }
    const out = warpAlphaToUV({ width: ref.width, height: ref.height, data }, points, SIZE);
    expect(at(out, target.u, target.v)).toBe(255);
    // 反対の頬や鼻には写らない
    expect(at(out, meshUV(280).u, meshUV(280).v)).toBe(0);
    expect(at(out, 0.5, 0.55)).toBe(0);
  });
});

describe('blurAlpha', () => {
  it('ぼかすと縁がなだらかになり、全体の量はほぼ変わらない', () => {
    const w = 64, h = 64;
    const data = new Uint8ClampedArray(w * h);
    for (let y = 24; y < 40; y++) for (let x = 24; x < 40; x++) data[y * w + x] = 255;
    const before = data.reduce((s, v) => s + v, 0);
    blurAlpha({ width: w, height: h, data }, 3);
    const after = data.reduce((s, v) => s + v, 0);
    expect(Math.abs(after - before) / before).toBeLessThan(0.03);
    expect(data[32 * w + 32]).toBeGreaterThan(230);       // 真ん中は濃いまま
    const edge = data[32 * w + 24];
    expect(edge).toBeGreaterThan(80);                      // 縁は半分くらい
    expect(edge).toBeLessThan(180);
    expect(data[32 * w + 10]).toBe(0);                     // 遠くは変わらない
  });

  it('ごく小さいぼかしは何もしない', () => {
    const data = new Uint8ClampedArray([0, 255, 0, 0]);
    blurAlpha({ width: 4, height: 1, data }, 0.3);
    expect(Array.from(data)).toEqual([0, 255, 0, 0]);
  });
});

describe('edgeFeatherUV', () => {
  it('顔の真ん中は 255、輪郭の上はほぼ 0', () => {
    const out = edgeFeatherUV(SIZE, 0.04);
    expect(at(out, 0.5, 0.5)).toBe(255);
    expect(at(out, meshUV(50).u, meshUV(50).v)).toBe(255);
    // 輪郭の点（あご先・頬の端・額の上）
    for (const i of [152, 234, 454, 10]) expect(at(out, Math.min(0.999, meshUV(i).u), Math.min(0.999, meshUV(i).v))).toBeLessThan(60);
    // 唇や目のまわり（穴の縁）は薄くならない
    expect(at(out, meshUV(0).u, meshUV(0).v)).toBe(255);
    expect(at(out, meshUV(159).u, meshUV(159).v)).toBe(255);
  });
});
