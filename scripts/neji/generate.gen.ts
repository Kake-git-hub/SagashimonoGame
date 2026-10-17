/**
 * ステージ生成（npm run gen:neji）
 *
 *   npm run gen:neji                       # 新しいステージを組み立て、全ステージの色を混ぜ直して public/neji/ に書く
 *   GEN_FILTER=stage-23,stage-25 npm run gen:neji   # id に文字列を含むステージだけ（カンマ区切り）
 *   GEN_MODE=check npm run gen:neji        # 組み立てたステージの物理チェックだけ（書き込まない）
 *   GEN_MODE=plays npm run gen:neji        # 色は変えずに、e2e 用の手順（scripts/e2e/solutions.json）だけ書き直す
 *   GEN_KEEP_COLORS=1 npm run gen:neji     # 既存ステージの色は変えない（新しいステージだけ色を決める）
 *
 * 色の決め方は src/games/neji/logic/colorize.ts。同じ種（seed）なら同じ結果になる
 */
import { it } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Stage, StageDef, StageSummary } from '../../src/games/neji/types';
import { normalizeStage } from '../../src/games/neji/logic/normalize';
import { validateStage } from '../../src/games/neji/logic/validate';
import { colorizeStage, colorClusterScore } from '../../src/games/neji/logic/colorize';
import { measureStage, sampleNaivePlays } from '../../src/games/neji/logic/metrics';
import { solveStage } from '../../src/games/neji/logic/solver';
import { findBlockers, listRemovableScrews } from '../../src/games/neji/logic/removable';
import { NEW_STAGES } from './stages';
import { toStageDef } from './lib';

const ROOT = join(__dirname, '..', '..');
const STAGE_DIR = join(ROOT, 'public', 'neji', 'stages');
const INDEX_PATH = join(ROOT, 'public', 'neji', 'index.json');
const SOLUTIONS_PATH = join(ROOT, 'scripts', 'e2e', 'solutions.json'); // e2e スクリプトが使う手順（解・わざと失敗する手順・おきばを使う手順）

// e2e 用の手順。e2e は 6 さいのプロフィール（おきば +1）で遊ぶので、その条件で求める
interface Plays {
  order: string[];         // ソルバーの解
  fail: string[] | null;   // 先を読まずに外して、おきばがあふれる手順（あふれる 1 本まで）
  demo: string[] | null;   // おきばを使いつつクリアできる手順
}
function playsFor(stage: Stage, order: string[]): Plays {
  const eased: Stage = { ...stage, bufferSlots: stage.bufferSlots + 1 };
  const samples = sampleNaivePlays(eased, { plays: 80, seed: 7 });
  return {
    order,
    fail: samples.find(p => p.failed)?.order ?? null,
    demo: samples.find(p => !p.failed && p.usedBuffer)?.order ?? null,
  };
}
const out = (text: string) => process.stdout.write(`${text}\n`);

const filters = (process.env.GEN_FILTER ?? '').split(',').map(f => f.trim()).filter(Boolean);
const matches = (id: string) => filters.length === 0 || filters.some(f => id.includes(f));
const mode = process.env.GEN_MODE ?? 'write';
const keepColors = process.env.GEN_KEEP_COLORS === '1';

// 種: id の文字から決める（同じ id なら同じ色になる）
function seedOf(id: string): number {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function writeStage(def: StageDef): void {
  writeFileSync(join(STAGE_DIR, `${def.id}.json`), `${JSON.stringify(def, null, 2)}\n`);
}

it('ステージを生成する', () => {
  const existing = new Map<string, StageDef>();
  for (const file of readdirSync(STAGE_DIR)) {
    if (!file.endsWith('.json')) continue;
    const def = JSON.parse(readFileSync(join(STAGE_DIR, file), 'utf8')) as StageDef;
    existing.set(def.id, def);
  }
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as StageSummary[];

  // 1. 新しいステージを組み立てる（物理チェック）
  const built: StageDef[] = [];
  let failed = 0;
  for (const make of NEW_STAGES) {
    const spec = make();
    if (!matches(spec.id)) continue;
    const def = toStageDef(spec);
    // 色が未定なので、解けるかは見ずに物理だけ確認する
    const errors = validateStage(normalizeStage({ ...def, boxes: [] }), { solve: false }).filter(e => !e.startsWith('色 '));
    if (errors.length > 0) {
      failed += 1;
      out(`[${def.id} ${def.name}] 物理チェック NG:\n  ${errors.join('\n  ')}`);
      continue;
    }
    // 色を無視して全部外せるか（構造の詰まり）
    const probe = normalizeStage({ ...def, boxes: ['red'], screws: def.screws.map(s => ({ ...s, color: 'red' as const })), boxCapacity: def.screws.length });
    const solved = solveStage(probe);
    if (!solved.solvable) {
      failed += 1;
      // 色を無視して外せるだけ外し、残ったネジと邪魔している物を出す
      let remaining = new Set(probe.screws.map(s => s.id));
      for (;;) {
        const held = new Set(probe.screws.filter(s => remaining.has(s.id)).flatMap(s => s.partIds));
        const remainingParts = new Set(probe.parts.filter(p => p.fixed || held.has(p.id)).map(p => p.id));
        const removable = listRemovableScrews({ stage: probe, remainingParts, remainingScrews: remaining });
        if (removable.length === 0) {
          const detail = [...remaining].map(id => `${id} ← ${findBlockers({ stage: probe, remainingParts, remainingScrews: remaining }, id).map(b => b.id).join(',')}`);
          out(`[${def.id} ${def.name}] 構造的に外せないネジがある:\n  ${detail.join('\n  ')}`);
          break;
        }
        remaining = new Set([...remaining].filter(id => !removable.includes(id)));
      }
      continue;
    }
    out(`[${def.id} ${def.name}] 物理 OK（ネジ ${def.screws.length} 本、パーツ ${def.parts.length} 個）`);
    built.push(def);
  }
  if (mode === 'check') {
    if (failed > 0) throw new Error(`${failed} ステージが物理チェックで失敗`);
    return;
  }

  // 色は変えずに、e2e 用の手順だけ全ステージ分を書き直す
  if (mode === 'plays') {
    const solutions: Record<string, Plays> = {};
    for (const summary of index) {
      const def = existing.get(summary.id);
      if (!def) continue;
      const stage = normalizeStage(def);
      solutions[def.id] = playsFor(stage, solveStage(stage).order);
    }
    writeFileSync(SOLUTIONS_PATH, `${JSON.stringify(solutions, null, 2)}\n`);
    out(`e2e 用の手順を ${Object.keys(solutions).length} ステージ分書き出した`);
    return;
  }

  // 2. 色を決める（新しいステージ + 既存ステージ）
  const targets: StageDef[] = [...built];
  if (!keepColors) {
    for (const def of existing.values()) {
      if (built.some(b => b.id === def.id)) continue;
      if (!matches(def.id)) continue;
      targets.push(def);
    }
  }
  const results: { def: StageDef; summary: string; plays: Plays }[] = [];
  for (const def of targets) {
    const stage = normalizeStage(def);
    const before = existing.has(def.id) ? colorClusterScore(stage) : null;
    const started = Date.now();
    const colored = colorizeStage(stage, { seed: seedOf(def.id), difficulty: def.difficulty });
    if (!colored) {
      failed += 1;
      out(`[${def.id} ${def.name}] 解ける色の割り当てが見つからない`);
      continue;
    }
    const finalDef: StageDef = { ...def, boxes: colored.stage.boxes, screws: colored.stage.screws };
    const errors = validateStage(normalizeStage(finalDef));
    if (errors.length > 0) {
      failed += 1;
      out(`[${def.id} ${def.name}] 検証 NG:\n  ${errors.join('\n  ')}`);
      continue;
    }
    const m = measureStage(normalizeStage(finalDef));
    const order = solveStage(normalizeStage(finalDef)).order;
    writeStage(finalDef);
    const cluster = `${before === null ? '-' : before.toFixed(2)} → ${colorClusterScore(normalizeStage(finalDef)).toFixed(2)}`;
    results.push({
      def: finalDef,
      plays: playsFor(normalizeStage(finalDef), order),
      summary: `${finalDef.id.padEnd(9)} 難易度 ${finalDef.difficulty} ネジ ${String(finalDef.screws.length).padStart(2)} 固まり ${cluster} 手当たりしだいの失敗率 ${String(Math.round(m.naiveFailRate * 100)).padStart(3)}% 最初に外せない ${String(m.lockedAtStart).padStart(2)} 一手に絞られる ${m.forcedMoves} 探索 ${m.visited} (${Date.now() - started}ms) ${finalDef.name}`,
    });
    out(`[${finalDef.id}] 解: ${order.join(' ')}`);
  }

  // 3. index.json（難易度順。同じ難易度の中は id 順）
  const summaries = new Map<string, StageSummary>(index.map(s => [s.id, s]));
  for (const { def } of results) {
    const prev = summaries.get(def.id);
    const summary: StageSummary = { id: def.id, name: def.name, emoji: def.emoji, difficulty: def.difficulty, screwCount: def.screws.length };
    if (def.treasure) summary.treasure = { id: def.treasure.id, name: def.treasure.name, emoji: def.treasure.emoji };
    summaries.set(def.id, prev ? { ...prev, ...summary } : summary);
  }
  const order = [...index.map(s => s.id), ...results.map(r => r.def.id).filter(id => !index.some(s => s.id === id))];
  const sorted = order
    .map(id => summaries.get(id)!)
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  writeFileSync(INDEX_PATH, `${JSON.stringify(sorted, null, 2)}\n`);

  // 4. e2e 用の手順（ステージ id → 解・失敗する手順・おきばを使う手順）。生成しなかったステージの分は残す
  let solutions: Record<string, Plays> = {};
  try {
    solutions = JSON.parse(readFileSync(SOLUTIONS_PATH, 'utf8')) as Record<string, Plays>;
  } catch {
    solutions = {};
  }
  for (const r of results) solutions[r.def.id] = r.plays;
  const solutionIds = Object.keys(solutions).filter(id => summaries.has(id)).sort();
  writeFileSync(SOLUTIONS_PATH, `${JSON.stringify(Object.fromEntries(solutionIds.map(id => [id, solutions[id]])), null, 2)}\n`);

  out('');
  for (const r of results) out(r.summary);
  if (failed > 0) throw new Error(`${failed} ステージが生成できなかった`);
});
