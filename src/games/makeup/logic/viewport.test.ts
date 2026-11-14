import { describe, expect, it } from 'vitest';
import { clientToFrame, frameToClient, panForFace } from './viewport';

describe('clientToFrame / frameToClient', () => {
  // 600x400 の枠に 4:3 の映像（cover なので横幅いっぱい、上下がはみ出す）
  const rect = { left: 100, top: 50, width: 600, height: 400 };

  it('枠の真ん中は映像の真ん中', () => {
    expect(clientToFrame(rect, 960, 720, false, 400, 250)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('cover で はみ出した分を考える（上端は映像の少し下）', () => {
    const p = clientToFrame(rect, 960, 720, false, 100, 50);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo((450 - 400) / 2 / 450);
  });

  it('鏡像のときは左右が逆になる', () => {
    expect(clientToFrame(rect, 960, 720, true, 100, 250).x).toBeCloseTo(1);
    expect(clientToFrame(rect, 960, 720, true, 250, 250).x).toBeCloseTo(0.75);
  });

  it('行って戻ると元の位置', () => {
    for (const mirrored of [false, true]) {
      const p = clientToFrame(rect, 720, 960, mirrored, 333, 222);
      const back = frameToClient(rect, 720, 960, mirrored, p.x, p.y);
      expect(back.x).toBeCloseTo(333);
      expect(back.y).toBeCloseTo(222);
    }
  });
});

describe('pan（はみ出した分のどこを見せるか）', () => {
  // 600x400 の枠に 4:3 の映像 → 600x450 で表示され、上下に 50px はみ出す
  const rect = { left: 100, top: 50, width: 600, height: 400 };

  it('pan.y = 0 なら映像の上端が枠の上端、1 なら下端が枠の下端', () => {
    expect(clientToFrame(rect, 960, 720, false, 400, 50, { x: 0.5, y: 0 }).y).toBeCloseTo(0);
    expect(clientToFrame(rect, 960, 720, false, 400, 450, { x: 0.5, y: 1 }).y).toBeCloseTo(1);
  });

  it('横にはみ出すとき: 鏡像でも pan は反転する前の映像に対して効く', () => {
    // 300x450 の枠に 4:3 の映像 → 600x450 で表示され、左右に 300px はみ出す
    const tall = { left: 0, top: 0, width: 300, height: 450 };
    // pan.x = 0: 映像の左半分（x = 0〜0.5）が見える。鏡像なので、映像の左端は画面の右端に来る
    expect(clientToFrame(tall, 960, 720, true, 300, 100, { x: 0, y: 0.5 }).x).toBeCloseTo(0);
    expect(clientToFrame(tall, 960, 720, true, 0, 100, { x: 0, y: 0.5 }).x).toBeCloseTo(0.5);
    expect(clientToFrame(tall, 960, 720, false, 0, 100, { x: 1, y: 0.5 }).x).toBeCloseTo(0.5);
    for (const mirrored of [false, true]) {
      const pan = { x: 0.2, y: 0.5 };
      const p = clientToFrame(tall, 960, 720, mirrored, 123, 321, pan);
      const back = frameToClient(tall, 960, 720, mirrored, p.x, p.y, pan);
      expect(back.x).toBeCloseTo(123);
      expect(back.y).toBeCloseTo(321);
    }
  });

  it('panForFace: 顔が枠の真ん中に来るように選び、映像の端より先へは行かない', () => {
    const tall = { left: 0, top: 0, width: 300, height: 450 };
    expect(panForFace(tall, 960, 720, 0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
    // 顔が映像の左寄り（x = 0.3）: 顔の中心が枠の真ん中（150px）に来る
    const pan = panForFace(tall, 960, 720, 0.3, 0.5);
    expect(frameToClient(tall, 960, 720, false, 0.3, 0.5, pan).x).toBeCloseTo(150);
    expect(frameToClient(tall, 960, 720, true, 0.3, 0.5, pan).x).toBeCloseTo(150);
    // 端すぎる顔は、映像の端まで
    expect(panForFace(tall, 960, 720, 0.05, 0.5).x).toBe(0);
    expect(panForFace(tall, 960, 720, 0.98, 0.5).x).toBe(1);
    // はみ出していない方向（縦）は 0.5 のまま
    expect(panForFace(tall, 960, 720, 0.3, 0.1).y).toBe(0.5);
  });
});
