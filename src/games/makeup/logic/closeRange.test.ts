import { describe, expect, it } from 'vitest';
import { LANDMARK_COUNT, LM } from '../constants';
import { Point3 } from '../types';
import { CLOSE_RANGE, initialCloseRange, nextCloseRange, PAD_SCALE, paddedLayout, unpadLandmarks } from './closeRange';

// 中心 (cx, cy)、幅 width の顔のつもりの点群
function makeFace(width: number, cx = 0.5, cy = 0.5): Point3[] {
  const pts: Point3[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: cx, y: cy, z: 0 }));
  pts[LM.cheekR] = { x: cx - width / 2, y: cy, z: 0 };
  pts[LM.cheekL] = { x: cx + width / 2, y: cy, z: 0 };
  pts[LM.forehead] = { x: cx, y: cy - width * 0.65, z: 0 };
  pts[LM.chin] = { x: cx, y: cy + width * 0.65, z: 0 };
  return pts;
}

describe('nextCloseRange', () => {
  it('ふつうの距離では余白なしのまま', () => {
    const s = nextCloseRange(initialCloseRange(), makeFace(0.4), 1, 0);
    expect(s.padded).toBe(false);
  });

  it('顔が大きくなったら余白つきにし、少し離れただけでは戻さない', () => {
    let s = nextCloseRange(initialCloseRange(), makeFace(0.75), 1, 0);
    expect(s.padded).toBe(true);
    s = nextCloseRange(s, makeFace(0.6), 1, 33);
    expect(s.padded).toBe(true);
    // 切り替えた直後は、離れても しばらく切り替え直さない
    s = nextCloseRange(s, makeFace(0.4), 1, 66);
    expect(s.padded).toBe(true);
    s = nextCloseRange(s, makeFace(0.4), 1, CLOSE_RANGE.holdMs + 1);
    expect(s.padded).toBe(false);
  });

  it('顔が映像の縁にかかったら余白つきにする', () => {
    const s = nextCloseRange(initialCloseRange(), makeFace(0.4, 0.2, 0.5), 1, 0);
    expect(s.padded).toBe(true);
  });

  it('横長の映像では、短い辺に対する大きさで決める', () => {
    // 幅の 45% でも、16:9 なら高さの 80%
    expect(nextCloseRange(initialCloseRange(), makeFace(0.45, 0.5, 0.5).map(p => ({ ...p, y: 0.5 })), 16 / 9, 0).padded).toBe(true);
  });

  it('見つからないときは、しばらくしてから 余白あり / なし を入れ替えて探す', () => {
    const t = CLOSE_RANGE;
    let s = nextCloseRange(initialCloseRange(), null, 1, 1000);
    expect(s.padded).toBe(false);
    s = nextCloseRange(s, null, 1, 1000 + t.searchAfterMs - 1);
    expect(s.padded).toBe(false);
    s = nextCloseRange(s, null, 1, 1000 + t.searchAfterMs);
    expect(s.padded).toBe(true);
    s = nextCloseRange(s, null, 1, 1000 + t.searchAfterMs + t.searchSwitchMs - 1);
    expect(s.padded).toBe(true);
    s = nextCloseRange(s, null, 1, 1000 + t.searchAfterMs + t.searchSwitchMs);
    expect(s.padded).toBe(false);
    // 見つかったら、入れ替えの時計は止まる
    s = nextCloseRange(s, makeFace(0.4), 1, 5000);
    expect(s).toEqual({ padded: false, lostSince: null, switchedAt: 0, holdUntil: 0 });
  });
});

describe('unpadLandmarks / paddedLayout', () => {
  it('余白つきの絵の点を、元の映像の座標に戻す（真ん中はそのまま、はみ出した点は 0〜1 の外）', () => {
    const out = unpadLandmarks([{ x: 0.5, y: 0.5, z: 0.1 }, { x: 0.5 - 0.5 / PAD_SCALE, y: 0.5 + 0.5 / PAD_SCALE, z: 0 }, { x: 0.1, y: 0.9, z: 0 }]);
    expect(out[0]).toEqual({ x: 0.5, y: 0.5, z: 0.1 * PAD_SCALE });
    expect(out[1].x).toBeCloseTo(0);
    expect(out[1].y).toBeCloseTo(1);
    expect(out[2].x).toBeLessThan(0);
    expect(out[2].y).toBeGreaterThan(1);
  });

  it('映像は真ん中に入り、まわりに同じ割合の余白が付く', () => {
    const l = paddedLayout(960, 720);
    expect(l.contentW).toBe(640);
    expect(l.contentH).toBe(480);
    expect(l.width).toBe(960);
    expect(l.height).toBe(720);
    expect(l.x).toBe(160);
    expect(l.y).toBe(120);
    // 小さい映像は拡大しない
    const small = paddedLayout(320, 240);
    expect(small.contentW).toBe(320);
    expect(small.width).toBe(480);
  });
});
