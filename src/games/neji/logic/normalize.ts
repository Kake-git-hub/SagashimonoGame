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
