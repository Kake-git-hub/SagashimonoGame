import { describe, expect, it } from 'vitest';
import { createSortState, placeScrew } from './rules';
import { normalizeStage } from './normalize';
import { StageDef } from '../types';

const def: StageDef = {
  id: 'sort', name: 'テスト', difficulty: 1,
  boxCapacity: 2, visibleBoxes: 2, bufferSlots: 2,
  boxes: ['red', 'blue', 'green'],
  parts: [], screws: [],
};
const stage = normalizeStage(def);

describe('placeScrew', () => {
  it('同色ボックスに入る', () => {
    const s0 = createSortState(stage);
    expect(s0.boxes.map(b => b?.color)).toEqual(['red', 'blue']);
    const r = placeScrew(stage, s0, 'a', 'red');
    expect(r.overflow).toBe(false);
    expect(r.state.boxes[0]?.filled).toBe(1);
    expect(r.events[0]).toMatchObject({ type: 'screwPlaced', target: { kind: 'box', position: 0, slot: 0 } });
  });

  it('満杯になると次のボックスが来て、一時置き場の同色が移る', () => {
    let s = createSortState(stage);
    s = placeScrew(stage, s, 'g1', 'green').state; // ボックス無し → 一時置き場
    expect(s.buffer[0]).toEqual({ screwId: 'g1', color: 'green' });
    s = placeScrew(stage, s, 'r1', 'red').state;
    const r = placeScrew(stage, s, 'r2', 'red');
    const types = r.events.map(e => e.type);
    expect(types).toEqual(['screwPlaced', 'boxFull', 'boxArrived', 'bufferMoved']);
    expect(r.state.boxes[0]).toMatchObject({ color: 'green', filled: 1 });
    expect(r.state.buffer).toEqual([null, null]);
    expect(r.state.nextBoxIndex).toBe(3);
  });

  it('キューが尽きると枠は空になる', () => {
    let s = createSortState(stage);
    s = placeScrew(stage, s, 'r1', 'red').state;
    s = placeScrew(stage, s, 'r2', 'red').state; // green が来る
    s = placeScrew(stage, s, 'g1', 'green').state;
    s = placeScrew(stage, s, 'g2', 'green').state; // キュー尽きる
    expect(s.boxes[0]).toBeNull();
    expect(s.boxes[1]?.color).toBe('blue');
  });

  it('一時置き場も満杯なら overflow', () => {
    let s = createSortState(stage);
    s = placeScrew(stage, s, 'g1', 'green').state;
    s = placeScrew(stage, s, 'g2', 'green').state;
    const r = placeScrew(stage, s, 'g3', 'green');
    expect(r.overflow).toBe(true);
    expect(r.events[0].type).toBe('overflow');
  });
});
