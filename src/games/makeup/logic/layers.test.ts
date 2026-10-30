import { describe, expect, it } from 'vitest';
import { activeLayers, LAYER_SPEC, lookReducer, sanitizeLook } from './layers';

describe('lookReducer', () => {
  it('色を選ぶと既定のつよさで追加され、つよさだけ変えられる', () => {
    let s = lookReducer({}, { type: 'color', layer: 'lip', color: '#ff0000' });
    expect(s.lip).toEqual({ color: '#ff0000', opacity: LAYER_SPEC.lip.defaultOpacity });
    s = lookReducer(s, { type: 'opacity', layer: 'lip', opacity: 1.5 });
    expect(s.lip?.opacity).toBe(1);
    s = lookReducer(s, { type: 'color', layer: 'lip', color: '#00ff00' });
    expect(s.lip).toEqual({ color: '#00ff00', opacity: 1 });
  });

  it('無いレイヤーのつよさは変わらない', () => {
    const s = lookReducer({}, { type: 'opacity', layer: 'blush', opacity: 0.5 });
    expect(s).toEqual({});
  });

  it('消す・全部消す・重ねる順番', () => {
    let s = lookReducer({}, { type: 'color', layer: 'lip', color: '#ff0000' });
    s = lookReducer(s, { type: 'color', layer: 'base', color: '#ffeeee' });
    expect(activeLayers(s)).toEqual(['base', 'lip']);
    s = lookReducer(s, { type: 'clear', layer: 'base' });
    expect(activeLayers(s)).toEqual(['lip']);
    s = lookReducer(s, { type: 'clearAll' });
    expect(activeLayers(s)).toEqual([]);
  });
});

describe('sanitizeLook', () => {
  it('壊れた保存データは捨てる', () => {
    expect(sanitizeLook(null)).toEqual({});
    expect(sanitizeLook({ lip: { color: 'red', opacity: 0.5 } })).toEqual({});
    expect(sanitizeLook({ lip: { color: '#AABBCC' }, bogus: { color: '#000000', opacity: 1 } }))
      .toEqual({ lip: { color: '#AABBCC', opacity: LAYER_SPEC.lip.defaultOpacity } });
  });
});
