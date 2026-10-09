/**
 * 全ステージの難しさの目安を一覧にする（npm run metrics:neji）
 * 数字の意味は logic/metrics.ts を参照
 */
import { describe, expect, it } from 'vitest';
import { StageDef, StageSummary } from './types';
import { normalizeStage } from './logic/normalize';
import { measureStage } from './logic/metrics';
import indexJson from '../../../public/neji/index.json';

const stageFiles = import.meta.glob<StageDef>('../../../public/neji/stages/*.json', { eager: true, import: 'default' });
const byId = new Map(Object.values(stageFiles).map(def => [def.id, def] as const));
const index = indexJson as StageSummary[];

describe('ステージの難しさの目安', () => {
  it('全ステージを測って一覧にする', () => {
    const lines = ['id        難易度 ネジ 最初に外せない 探索状態 外せる手の平均 失敗しない手の平均 一手に絞られる場面'];
    for (const summary of index) {
      const def = byId.get(summary.id);
      expect(def, `${summary.id} の JSON が無い`).toBeDefined();
      const m = measureStage(normalizeStage(def!));
      expect(m.solvable, `${summary.id} が解けない`).toBe(true);
      lines.push(
        [
          summary.id.padEnd(9),
          String(summary.difficulty).padStart(4),
          String(def!.screws.length).padStart(5),
          String(m.lockedAtStart).padStart(10),
          String(m.visited).padStart(10),
          m.avgRemovable.toFixed(1).padStart(12),
          m.avgSafe.toFixed(1).padStart(16),
          String(m.forcedMoves).padStart(14),
          ` ${summary.name}`,
        ].join(' '),
      );
    }
    // vitest は console.log を隠すので、標準出力に直接書く（@types/node 無しで通るように型だけ付ける）
    const out = (globalThis as { process?: { stdout: { write(text: string): void } } }).process;
    out?.stdout.write(`${lines.join('\n')}\n`);
  });
});
