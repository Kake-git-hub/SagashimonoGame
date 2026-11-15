import { describe, expect, it } from 'vitest';
import { brushFor, BRUSH_SIZES, buildUp, eraserBrush, strokeStamps } from './brush';
import { LAYER_ORDER } from './layers';

describe('brushFor', () => {
  it('ふとさ は ほそい < ふつう < ふとい', () => {
    for (const layer of LAYER_ORDER) {
      const [s, m, l] = BRUSH_SIZES.map(size => brushFor(layer, size).radius);
      expect(s).toBeLessThan(m);
      expect(m).toBeLessThan(l);
    }
  });

  it('アイラインは細く、チークは太い', () => {
    expect(brushFor('eyeliner', 'm').radius).toBeLessThan(brushFor('lip', 'm').radius);
    expect(brushFor('lip', 'm').radius).toBeLessThan(brushFor('blush', 'm').radius);
    expect(eraserBrush('l').radius).toBeGreaterThan(eraserBrush('s').radius);
  });

  it('ひと筆では塗りきらず、重ねるほど濃くなる（3 回でもまだ伸びしろがある）', () => {
    for (const layer of LAYER_ORDER) {
      const { flow } = brushFor(layer, 'm');
      expect(flow).toBeGreaterThan(0.2);
      expect(flow).toBeLessThan(0.7);
      expect(buildUp(flow, 1)).toBeCloseTo(flow);
      expect(buildUp(flow, 2)).toBeGreaterThan(buildUp(flow, 1));
      expect(buildUp(flow, 3)).toBeGreaterThan(buildUp(flow, 2));
      expect(buildUp(flow, 3)).toBeLessThan(1);
    }
    expect(buildUp(0.3, 0)).toBe(0);
  });
});

describe('strokeStamps', () => {
  it('前の点が無ければ今の点だけ', () => {
    expect(strokeStamps(null, { u: 0.3, v: 0.4 }, 0.02)).toEqual([{ u: 0.3, v: 0.4 }]);
  });

  it('前の点から今の点まで、半径の 1/3 以下の間隔で並び、今の点で終わる', () => {
    const from = { u: 0.3, v: 0.4 }, to = { u: 0.4, v: 0.4 };
    const stamps = strokeStamps(from, to, 0.012);
    // 0.1 / 0.004 = 25（浮動小数の誤差で 26 になることがある）
    expect(stamps.length).toBeGreaterThanOrEqual(25);
    expect(stamps.length).toBeLessThanOrEqual(26);
    expect(stamps[stamps.length - 1]).toEqual(to);
    expect(stamps[0].u).toBeGreaterThan(from.u);
    let prev = from;
    for (const s of stamps) {
      expect(Math.hypot(s.u - prev.u, s.v - prev.v)).toBeLessThanOrEqual(0.012 / 3 + 1e-9);
      prev = s;
    }
  });

  it('離れすぎた 2 点はつながない', () => {
    expect(strokeStamps({ u: 0.1, v: 0.1 }, { u: 0.8, v: 0.8 }, 0.02)).toEqual([{ u: 0.8, v: 0.8 }]);
  });
});
