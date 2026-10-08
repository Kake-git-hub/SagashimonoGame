import { describe, expect, it } from 'vitest';
import { createInitialState, nejiReducer } from './gameReducer';
import { normalizeStage } from './normalize';
import { StageDef } from '../types';

const def: StageDef = {
  id: 't', name: 'テスト', difficulty: 1, boxes: ['green', 'red'],
  parts: [
    { id: 'base', shape: 'box', size: [4, 1.2, 4], position: [0, 0, 0], fixed: true },
    { id: 'lid', shape: 'box', size: [4.4, 0.4, 4.4], position: [0, 0.8, 0] },
  ],
  screws: [
    { id: 'lidA', color: 'green', position: [1.6, 1.0, 1.6], dir: [0, 1, 0], partIds: ['lid', 'base'] },
    { id: 'under', color: 'red', position: [0, 0.6, 0], dir: [0, 1, 0], length: 0.8, partIds: ['base'] },
  ],
};

describe('nejiReducer', () => {
  it('邪魔されているネジは外れず feedback が付く', () => {
    const s0 = createInitialState(normalizeStage(def));
    const s1 = nejiReducer(s0, { type: 'tapScrew', id: 'under' });
    expect(s1.remainingScrews.has('under')).toBe(true);
    expect(s1.feedback?.screwId).toBe('under');
    expect(s1.feedback?.blockers.map(b => b.id)).toEqual(['lid']);
    expect(s1.moves).toBe(0);
  });

  it('ネジを外すとパーツが落ち、全部外すとクリア', () => {
    const s0 = createInitialState(normalizeStage(def));
    const s1 = nejiReducer(s0, { type: 'tapScrew', id: 'lidA' });
    expect(s1.remainingScrews.has('lidA')).toBe(false);
    expect(s1.removingScrews).toEqual(['lidA']);
    expect(s1.remainingParts.has('lid')).toBe(false);
    expect(s1.fallingParts).toEqual(['lid']);
    expect(s1.status).toBe('playing');

    const s2 = nejiReducer(s1, { type: 'screwRemoveDone', id: 'lidA' });
    expect(s2.removingScrews).toEqual([]);
    const s3 = nejiReducer(s2, { type: 'partFallDone', id: 'lid' });
    expect(s3.fallingParts).toEqual([]);

    const s4 = nejiReducer(s3, { type: 'tapScrew', id: 'under' });
    expect(s4.status).toBe('cleared');
    expect(s4.moves).toBe(2);
  });

  it('クリア後はタップしても変わらない', () => {
    let s = createInitialState(normalizeStage(def));
    s = nejiReducer(s, { type: 'tapScrew', id: 'lidA' });
    s = nejiReducer(s, { type: 'tapScrew', id: 'under' });
    const after = nejiReducer(s, { type: 'tapScrew', id: 'under' });
    expect(after).toBe(s);
  });
});
