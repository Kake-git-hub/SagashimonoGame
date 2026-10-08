import { NejiProgressMap } from '../types';

const PROGRESS_KEY = 'neji_progress';

export function getNejiProgress(): NejiProgressMap {
  try {
    const data = localStorage.getItem(PROGRESS_KEY);
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
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export function resetNejiProgress(stageId: string): void {
  const all = getNejiProgress();
  delete all[stageId];
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}
