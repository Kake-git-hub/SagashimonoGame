/**
 * public/neji/ に置いたステージ定義の検証
 * npm run validate:neji で単独実行できる
 */
import { describe, expect, it } from 'vitest';
import { StageDef, StageSummary } from './types';
import { normalizeStage } from './logic/normalize';
import { validateStage } from './logic/validate';
import { solveStage } from './logic/solver';
import indexJson from '../../../public/neji/index.json';

const stageFiles = import.meta.glob<StageDef>('../../../public/neji/stages/*.json', { eager: true, import: 'default' });
const stages = Object.entries(stageFiles).map(([path, def]) => ({ path, def }));
const index = indexJson as StageSummary[];

describe('neji/index.json', () => {
  it('一覧のステージがすべて存在し、ネジ本数と名前が一致する', () => {
    for (const summary of index) {
      const entry = stages.find(s => s.def.id === summary.id);
      expect(entry, `ステージ ${summary.id} の JSON が無い`).toBeDefined();
      expect(entry!.def.name).toBe(summary.name);
      expect(entry!.def.screws.length, `${summary.id} の screwCount`).toBe(summary.screwCount);
      expect(entry!.def.difficulty).toBe(summary.difficulty);
    }
  });

  it('JSON があるのに一覧に無いステージがない', () => {
    for (const { def } of stages) {
      expect(index.some(s => s.id === def.id), `${def.id} が index.json に無い`).toBe(true);
    }
  });
});

describe.each(stages)('ステージ $def.id', ({ def }) => {
  const stage = normalizeStage(def);

  it('配置が物理的に成り立ち、解ける', () => {
    const errors = validateStage(stage);
    if (errors.length > 0) {
      const solution = solveStage(stage);
      console.log(`[${stage.id}] 解: ${solution.solvable ? solution.order.join(' → ') : '(無し)'}`);
    }
    expect(errors).toEqual([]);
  });
});
