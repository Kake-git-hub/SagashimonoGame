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

  it('外したネジはボックスへ入り、イベントが出る', () => {
    const s0 = createInitialState(normalizeStage(def));
    const s1 = nejiReducer(s0, { type: 'tapScrew', id: 'lidA' });
    expect(s1.sort.boxes[0]).toMatchObject({ color: 'green', filled: 1 });
    expect(s1.events.map(e => e.type)).toEqual(['screwPlaced']);
    expect(s1.events[0].seq).toBe(1);
  });

  it('一時置き場があふれると失敗', () => {
    const tiny = normalizeStage({ ...def, boxes: ['red'], bufferSlots: 0 });
    const s0 = createInitialState(tiny);
    const s1 = nejiReducer(s0, { type: 'tapScrew', id: 'lidA' }); // green の箱が無く、置き場も無い
    expect(s1.status).toBe('failed');
    expect(s1.events.map(e => e.type)).toEqual(['overflow']);
  });

  it('クリア後はタップしても変わらない', () => {
    let s = createInitialState(normalizeStage(def));
    s = nejiReducer(s, { type: 'tapScrew', id: 'lidA' });
    s = nejiReducer(s, { type: 'tapScrew', id: 'under' });
    const after = nejiReducer(s, { type: 'tapScrew', id: 'under' });
    expect(after).toBe(s);
  });
});

describe('nejiReducer おたすけ', () => {
  it('もどす: 失敗した手を含めて戻し、遊べる状態になる', () => {
    const tiny = normalizeStage({ ...def, boxes: ['red'], bufferSlots: 0 });
    const s0 = createInitialState(tiny);
    const s1 = nejiReducer(s0, { type: 'tapScrew', id: 'lidA' });
    expect(s1.status).toBe('failed');
    expect(s1.history.length).toBe(1);
    const s2 = nejiReducer(s1, { type: 'rewind', moves: 3 });
    expect(s2.status).toBe('playing');
    expect(s2.moves).toBe(0);
    expect(s2.remainingScrews.has('lidA')).toBe(true);
    expect(s2.remainingParts.has('lid')).toBe(true);
    expect(s2.removingScrews).toEqual([]);
    expect(s2.fallingParts).toEqual([]);
    expect(s2.generation).toBe(s1.generation + 1);
    expect(s2.history).toEqual([]);
  });

  it('＋はこ: キューの次のボックスが出て、おきばの同色が移る', () => {
    // 最初は green の箱だけ。red のネジを 2 本にしてクリアにならないようにする
    const one = normalizeStage({
      ...def,
      visibleBoxes: 1,
      screws: [...def.screws, { id: 'under2', color: 'red', position: [1.2, 0.6, -1.2], dir: [0, 1, 0], length: 0.8, partIds: ['base'] }],
    });
    const s0 = createInitialState(one);
    const s1 = nejiReducer(s0, { type: 'tapScrew', id: 'lidA' }); // green → 箱
    const s2 = nejiReducer({ ...s1, remainingParts: new Set(['base']) }, { type: 'tapScrew', id: 'under' }); // red → おきば
    expect(s2.sort.buffer[0]).toMatchObject({ color: 'red' });
    const s3 = nejiReducer(s2, { type: 'addBox' });
    expect(s3.sort.boxes.length).toBe(2);
    expect(s3.sort.boxes[1]).toMatchObject({ color: 'red', filled: 1 });
    expect(s3.sort.buffer[0]).toBeNull();
    expect(s3.extraBoxes).toBe(1);
    expect(s3.events.map(e => e.type)).toEqual(['boxArrived', 'bufferMoved']);
    // もう出す箱が無ければ何も起きない
    const s4 = nejiReducer(s3, { type: 'addBox' });
    expect(s4).toBe(s3);
  });

  it('＋おきば: 穴が 1 つ増える', () => {
    const s0 = createInitialState(normalizeStage(def));
    const s1 = nejiReducer(s0, { type: 'addBuffer' });
    expect(s1.sort.buffer.length).toBe(s0.sort.buffer.length + 1);
    expect(s1.extraBuffer).toBe(1);
  });
});
