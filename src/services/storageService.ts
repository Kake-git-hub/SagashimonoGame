import { Progress, Settings } from '../types';

const STORAGE_KEYS = {
  PROGRESS: 'sagashimono_progress',
  SETTINGS: 'sagashimono_settings',
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
