import { describe, expect, it } from 'vitest';
import { StageDef } from '../types';
import { normalizeStage } from './normalize';
import { colorClusterScore, colorizeStage, computeScrewLayers } from './colorize';
import { validateStage } from './validate';
import { countScrewsByColor } from './rules';

// ふた付きの土台: ふたの下に 2 本、ふたに 2 本、側面に 5 本（9 本 = ボックス 3 個分）
const lidStage: StageDef = {
  id: 'colorize', name: 'いろわけ', difficulty: 3, boxes: [],
  parts: [
    { id: 'base', shape: 'box', size: [4, 1.2, 4], position: [0, 0, 0], fixed: true },
    { id: 'lid', shape: 'box', size: [4.4, 0.4, 4.4], position: [0, 1.05, 0] },
  ],
  screws: [
    { id: 'lidA', color: 'red', position: [1.6, 1.25, 1.6], dir: [0, 1, 0], length: 1.1, partIds: ['lid', 'base'] },
    { id: 'lidB', color: 'red', position: [-1.6, 1.25, -1.6], dir: [0, 1, 0], length: 1.1, partIds: ['lid', 'base'] },
    { id: 'underA', color: 'red', position: [0.5, 0.6, 0], dir: [0, 1, 0], length: 0.8, partIds: ['base'] },
    { id: 'underB', color: 'blue', position: [-0.5, 0.6, 0], dir: [0, 1, 0], length: 0.8, partIds: ['base'] },
    { id: 'sideA', color: 'blue', position: [0, 0, 2], dir: [0, 0, 1], length: 1.0, partIds: ['base'] },
    { id: 'sideB', color: 'blue', position: [0, 0, -2], dir: [0, 0, -1], length: 1.0, partIds: ['base'] },
    { id: 'sideC', color: 'green', position: [2, 0, 0], dir: [1, 0, 0], length: 1.0, partIds: ['base'] },
    { id: 'sideD', color: 'green', position: [-2, 0, 0], dir: [-1, 0, 0], length: 1.0, partIds: ['base'] },
    { id: 'bottom', color: 'green', position: [0, -0.6, 0], dir: [0, -1, 0], length: 1.0, partIds: ['base'] },
  ],
};

describe('colorize', () => {
  it('層: ふたの下のネジはふたが落ちてから外せる', () => {
    const layers = computeScrewLayers(normalizeStage(lidStage));
    expect(layers.lidA).toBe(0);
    expect(layers.sideA).toBe(0);
    expect(layers.underA).toBe(1);
    expect(layers.underB).toBe(1);
  });

  it('色の本数がボックスと合い、解けて、同じ色が隣り合いにくい', () => {
    const stage = normalizeStage(lidStage);
    const result = colorizeStage(stage, { seed: 3, restarts: 6 });
    expect(result).not.toBeNull();
    const colored = result!.stage;
    expect(colored.screws.map(s => s.id)).toEqual(stage.screws.map(s => s.id));
    expect(colored.boxes.length).toBe(3);
    const counts = countScrewsByColor(colored);
    for (const color of colored.boxes) expect(counts[color] % colored.boxCapacity).toBe(0);
    expect(validateStage(colored)).toEqual([]);
    expect(result!.metrics.solvable).toBe(true);
    // 元の配置（赤が片側に固まっている）より混ざっている
    expect(colorClusterScore(colored)).toBeLessThanOrEqual(colorClusterScore(stage));
  });

  it('同じ種なら同じ結果になる', () => {
    const stage = normalizeStage(lidStage);
    const a = colorizeStage(stage, { seed: 11, restarts: 4 })!;
    const b = colorizeStage(stage, { seed: 11, restarts: 4 })!;
    expect(a.stage.screws.map(s => s.color)).toEqual(b.stage.screws.map(s => s.color));
    expect(a.stage.boxes).toEqual(b.stage.boxes);
  });
});
