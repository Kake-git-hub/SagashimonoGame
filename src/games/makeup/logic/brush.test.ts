import { describe, expect, it } from 'vitest';
import { brushFor, BRUSH_SIZES, eraserBrush, strokeStamps } from './brush';
import { LAYER_ORDER } from './layers';

describe('brushFor', () => {
  it('ふとさ は ほそい < ふつう < ふとい', () => {
    for (const layer of LAYER_ORDER) {
      for (const assist of [false, true]) {
        const [s, m, l] = BRUSH_SIZES.map(size => brushFor(layer, size, assist).radius);
        expect(s).toBeLessThan(m);
        expect(m).toBeLessThan(l);
      }
    }
  });

  it('アイラインは細く、チークは太い。はみださない のときは太めになる', () => {
    expect(brushFor('eyeliner', 'm', false).radius).toBeLessThan(brushFor('lip', 'm', false).radius);
    expect(brushFor('lip', 'm', false).radius).toBeLessThan(brushFor('blush', 'm', false).radius);
    for (const layer of LAYER_ORDER) {
      expect(brushFor(layer, 'm', true).radius).toBeGreaterThan(brushFor(layer, 'm', false).radius);
    }
    expect(eraserBrush('l').radius).toBeGreaterThan(eraserBrush('s').radius);
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
