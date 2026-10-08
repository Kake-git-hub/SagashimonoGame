/**
 * ステージ定義の既定値を埋める
 * three.js に依存しないので、ホーム画面など軽い画面からも安全に読み込める
 */
import { Stage, StageDef } from '../types';
import { STAGE_DEFAULTS } from '../constants';

export function normalizeStage(def: StageDef): Stage {
  return {
    ...def,
    boxCapacity: def.boxCapacity ?? STAGE_DEFAULTS.BOX_CAPACITY,
    visibleBoxes: def.visibleBoxes ?? STAGE_DEFAULTS.VISIBLE_BOXES,
    bufferSlots: def.bufferSlots ?? STAGE_DEFAULTS.BUFFER_SLOTS,
    boxes: def.boxes ?? [],
    parts: def.parts ?? [],
    screws: def.screws ?? [],
  };
}

// 年齢に合わせた補正（おきば・同時に見えるボックスを増やす = やさしくする方向だけ）
// 増やす方向だけなので、既定値で検証したステージは必ず解ける
export function adjustStageForAge(stage: Stage, extra: { nejiExtraBuffer: number; nejiExtraBoxes: number }): Stage {
  if (extra.nejiExtraBuffer <= 0 && extra.nejiExtraBoxes <= 0) return stage;
  return {
    ...stage,
    bufferSlots: stage.bufferSlots + Math.max(0, extra.nejiExtraBuffer),
    visibleBoxes: Math.min(stage.boxes.length, stage.visibleBoxes + Math.max(0, extra.nejiExtraBoxes)),
  };
}
