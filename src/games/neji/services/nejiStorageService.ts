import { NejiCollectionMap, NejiProgressMap } from '../types';
import { profileStorageKey } from '../../../services/profileService';

// 既存ユーザーのデータを壊さないため基本のキー名は変えない（プロフィールごとの接尾辞は profileService が付ける）
const PROGRESS_KEY = 'neji_progress';
const COLLECTION_KEY = 'neji_collection';

export function getNejiProgress(): NejiProgressMap {
  try {
    const data = localStorage.getItem(profileStorageKey(PROGRESS_KEY));
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function markStageCleared(stageId: string, moves: number): void {
  const all = getNejiProgress();
  const prev = all[stageId];
  all[stageId] = {
    cleared: true,
    clearedAt: Date.now(),
    bestMoves: prev?.bestMoves !== undefined ? Math.min(prev.bestMoves, moves) : moves,
  };
  localStorage.setItem(profileStorageKey(PROGRESS_KEY), JSON.stringify(all));
}

export function resetNejiProgress(stageId: string): void {
  const all = getNejiProgress();
  delete all[stageId];
  localStorage.setItem(profileStorageKey(PROGRESS_KEY), JSON.stringify(all));
}

// === たからもの（核ブロック）のコレクション ===

export function getNejiCollection(): NejiCollectionMap {
  try {
    const data = localStorage.getItem(profileStorageKey(COLLECTION_KEY));
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// たからものを手に入れた。初めてなら true を返す
export function addToCollection(treasureId: string, stageId: string): boolean {
  const all = getNejiCollection();
  const prev = all[treasureId];
  all[treasureId] = {
    count: (prev?.count ?? 0) + 1,
    firstAt: prev?.firstAt ?? Date.now(),
    stageId,
  };
  localStorage.setItem(profileStorageKey(COLLECTION_KEY), JSON.stringify(all));
  return !prev;
}
