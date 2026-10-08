import { describe, expect, it } from 'vitest';
import { solveStage } from './solver';
import { normalizeStage } from './normalize';
import { StageDef } from '../types';

const base: StageDef = {
  id: 's', name: 'テスト', difficulty: 1, bufferSlots: 1, visibleBoxes: 1,
  boxes: ['green', 'red'],
  parts: [
    { id: 'base', shape: 'box', size: [4, 1.2, 4], position: [0, 0, 0], fixed: true },
    { id: 'lid', shape: 'box', size: [4.4, 0.4, 4.4], position: [0, 0.8, 0] },
  ],
  screws: [
    { id: 'lidA', color: 'green', position: [1.6, 1.0, 1.6], dir: [0, 1, 0], partIds: ['lid', 'base'] },
    { id: 'lidB', color: 'green', position: [-1.6, 1.0, -1.6], dir: [0, 1, 0], partIds: ['lid', 'base'] },
    { id: 'lidC', color: 'green', position: [1.6, 1.0, -1.6], dir: [0, 1, 0], partIds: ['lid', 'base'] },
    { id: 'u1', color: 'red', position: [0, 0.6, 0], dir: [0, 1, 0], length: 0.8, partIds: ['base'] },
    { id: 'u2', color: 'red', position: [1.0, 0.6, 0], dir: [0, 1, 0], length: 0.8, partIds: ['base'] },
    { id: 'u3', color: 'red', position: [-1.0, 0.6, 0], dir: [0, 1, 0], length: 0.8, partIds: ['base'] },
  ],
};

describe('solveStage', () => {
  it('ふた → 下のネジ の順で解ける', () => {
    const result = solveStage(normalizeStage(base));
    expect(result.solvable).toBe(true);
    expect(result.order.slice(0, 3).sort()).toEqual(['lidA', 'lidB', 'lidC']);
    expect(result.order).toHaveLength(6);
  });

  it('ボックスの順番が逆だと一時置き場があふれて解けない', () => {
    const result = solveStage(normalizeStage({ ...base, boxes: ['red', 'green'] }));
    expect(result.solvable).toBe(false);
    expect(result.aborted).toBe(false);
  });

  it('一時置き場が広ければ逆順でも解ける', () => {
    const result = solveStage(normalizeStage({ ...base, boxes: ['red', 'green'], bufferSlots: 3 }));
    expect(result.solvable).toBe(true);
  });
});
