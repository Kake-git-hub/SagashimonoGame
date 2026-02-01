import { Progress, Settings, CustomPuzzle, PuzzleSummary } from '../types';

const STORAGE_KEYS = {
  PROGRESS: 'sagashimono_progress',
  SETTINGS: 'sagashimono_settings',
  CUSTOM_PUZZLES: 'sagashimono_custom_puzzles',
} as const;

// 進捗データの保存
export function saveProgress(progress: Progress): void {
  const allProgress = getAllProgress();
  allProgress[progress.puzzleId] = progress;
  localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
}

// 特定パズルの進捗を取得
export function getProgress(puzzleId: string): Progress | null {
  const allProgress = getAllProgress();
  return allProgress[puzzleId] || null;
}

// 全ての進捗を取得
export function getAllProgress(): Record<string, Progress> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// 進捗をリセット
export function resetProgress(puzzleId: string): void {
  const allProgress = getAllProgress();
  delete allProgress[puzzleId];
  localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
}

// 全進捗をリセット
export function resetAllProgress(): void {
  localStorage.removeItem(STORAGE_KEYS.PROGRESS);
}

// 設定の保存
export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// 設定の取得
export function getSettings(): Settings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // ignore
  }
  // デフォルト設定
  return {
    displayMode: 'text',
  };
}

// カスタムパズルの保存
export function saveCustomPuzzle(puzzle: CustomPuzzle): void {
  const puzzles = getAllCustomPuzzles();
  // 同じIDがあれば上書き
  const index = puzzles.findIndex(p => p.id === puzzle.id);
  if (index >= 0) {
    puzzles[index] = puzzle;
  } else {
    puzzles.push(puzzle);
  }
  localStorage.setItem(STORAGE_KEYS.CUSTOM_PUZZLES, JSON.stringify(puzzles));
}

// 全カスタムパズルを取得
export function getAllCustomPuzzles(): CustomPuzzle[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_PUZZLES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 特定のカスタムパズルを取得
export function getCustomPuzzle(id: string): CustomPuzzle | null {
  const puzzles = getAllCustomPuzzles();
  return puzzles.find(p => p.id === id) || null;
}

// カスタムパズルを削除
export function deleteCustomPuzzle(id: string): void {
  const puzzles = getAllCustomPuzzles();
  const filtered = puzzles.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.CUSTOM_PUZZLES, JSON.stringify(filtered));
  // 進捗も削除
  resetProgress(id);
}

// カスタムパズルの一覧をサマリー形式で取得
export function getCustomPuzzleSummaries(): PuzzleSummary[] {
  const puzzles = getAllCustomPuzzles();
  return puzzles.map(p => ({
    id: p.id,
    name: p.name,
    thumbnail: p.imageData,
    targetCount: p.targets.length,
  }));
}
