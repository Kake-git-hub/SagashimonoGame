import { describe, expect, it } from 'vitest';
import { clientToFrame, coverScale, easeView, frameToClient, MAX_ZOOM, viewFor } from './viewport';

// 600x400 の枠に 4:3（960x720）の映像 → cover で 600x450（倍率 0.625）、上下に 50px はみ出す
const rect = { left: 100, top: 50, width: 600, height: 400 };
const W = 960, H = 720;

describe('viewFor（ふだん: 枠いっぱい）', () => {
  it('見せたい所が無ければ、真ん中を枠いっぱいに', () => {
    const v = viewFor(rect, W, H, false, null, false);
    expect(v.scale).toBeCloseTo(coverScale(rect, W, H));
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(-25);
    expect(clientToFrame(rect, W, H, false, v, 400, 250)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('顔が上に寄っていれば、はみ出した分は上側を見せる（映像の端より先へは行かない）', () => {
    const v = viewFor(rect, W, H, false, { x0: 0.3, y0: 0.0, x1: 0.7, y1: 0.4 }, false);
    expect(v.scale).toBeCloseTo(0.625);
    expect(v.y).toBeCloseTo(0);
    const low = viewFor(rect, W, H, false, { x0: 0.3, y0: 0.7, x1: 0.7, y1: 1.0 }, false);
    expect(low.y).toBeCloseTo(-50);
  });
});

describe('viewFor（アップ）', () => {
  const lips = { x0: 0.4, y0: 0.6, x1: 0.6, y1: 0.7 };

  it('選んだ所が枠に収まるところまで拡大し、その中心が枠の真ん中に来る', () => {
    const v = viewFor(rect, W, H, false, lips, true);
    // 幅 0.2 * 960 = 192px を 600px に → 3.125 倍、高さ 72px を 400px に → 5.5 倍。小さい方で、上限は cover の MAX_ZOOM 倍
    expect(v.scale).toBeCloseTo(Math.min(3.125, 0.625 * MAX_ZOOM));
    const c = frameToClient(rect, W, H, false, v, 0.5, 0.65);
    expect(c.x).toBeCloseTo(400);
    expect(c.y).toBeCloseTo(250);
  });

  it('鏡像では左右が逆になる: 映像の左寄り（x = 0.3）は画面の右寄りに見え、そこが真ん中に来る', () => {
    const box = { x0: 0.25, y0: 0.45, x1: 0.35, y1: 0.55 };
    const v = viewFor(rect, W, H, true, box, true);
    expect(frameToClient(rect, W, H, true, v, 0.3, 0.5).x).toBeCloseTo(400);
    // 映像でそれより左（x が小さい）の点は、画面では右に出る
    expect(frameToClient(rect, W, H, true, v, 0.28, 0.5).x).toBeGreaterThan(400);
  });

  it('映像の端にある所をアップにしても、映像の外（黒い所）は見せない', () => {
    const v = viewFor(rect, W, H, false, { x0: 0, y0: 0, x1: 0.1, y1: 0.1 }, true);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    const far = viewFor(rect, W, H, false, { x0: 0.9, y0: 0.9, x1: 1, y1: 1 }, true);
    expect(far.x).toBeCloseTo(rect.width - W * far.scale);
    expect(far.y).toBeCloseTo(rect.height - H * far.scale);
  });

  it('大きい範囲（顔ぜんたい）は、枠いっぱいより小さくはしない', () => {
    const v = viewFor(rect, W, H, false, { x0: 0, y0: 0, x1: 1, y1: 1 }, true);
    expect(v.scale).toBeCloseTo(0.625);
  });
});

describe('clientToFrame / frameToClient', () => {
  it('行って戻ると元の位置（拡大・鏡像あり）', () => {
    for (const mirrored of [false, true]) {
      const v = { scale: 1.7, x: -310, y: -95 };
      const p = clientToFrame(rect, 720, 960, mirrored, v, 333, 222);
      const back = frameToClient(rect, 720, 960, mirrored, v, p.x, p.y);
      expect(back.x).toBeCloseTo(333);
      expect(back.y).toBeCloseTo(222);
    }
  });

  it('鏡像では、入れ物の左端が映像の右端', () => {
    const v = { scale: 0.625, x: 0, y: -25 };
    expect(clientToFrame(rect, W, H, true, v, 100, 250).x).toBeCloseTo(1);
    expect(clientToFrame(rect, W, H, false, v, 100, 250).x).toBeCloseTo(0);
  });
});

describe('easeView', () => {
  it('目標へ少しずつ近づく', () => {
    const v = easeView({ scale: 1, x: 0, y: 0 }, { scale: 2, x: -100, y: 50 }, 0.25);
    expect(v).toEqual({ scale: 1.25, x: -25, y: 12.5 });
  });
});
