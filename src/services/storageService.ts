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

// カスタムパズルをサーバー用形式でエクスポート
export async function exportCustomPuzzleForServer(id: string): Promise<void> {
  const puzzle = getCustomPuzzle(id);
  if (!puzzle) {
    throw new Error('パズルが見つかりません');
  }

  // サーバー用のJSON形式に変換（画像はファイル参照に）
  const sanitizedName = puzzle.name.replace(/[<>:"/\\|?*]/g, '_');
  const serverPuzzle = {
    id: sanitizedName,
    name: puzzle.name,
    imageSrc: `puzzles/images/${sanitizedName}.webp`,
    targets: puzzle.targets,
  };

  // JSONファイルをダウンロード
  const jsonBlob = new Blob(
    [JSON.stringify(serverPuzzle, null, 2)],
    { type: 'application/json' }
  );
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonLink = document.createElement('a');
  jsonLink.href = jsonUrl;
  jsonLink.download = `${sanitizedName}.json`;
  jsonLink.click();
  URL.revokeObjectURL(jsonUrl);

  // 画像ファイルをダウンロード
  // Base64データからBlobに変換
  const base64Data = puzzle.imageData.split(',')[1];
  const mimeType = puzzle.imageData.split(':')[1]?.split(';')[0] || 'image/webp';
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const imageBlob = new Blob([byteArray], { type: mimeType });

  // 拡張子を決定
  const ext = mimeType.includes('webp') ? 'webp' : 
              mimeType.includes('png') ? 'png' : 'jpg';

  const imageUrl = URL.createObjectURL(imageBlob);
  const imageLink = document.createElement('a');
  imageLink.href = imageUrl;
  imageLink.download = `${sanitizedName}.${ext}`;
  
  // 少し遅延を入れて画像もダウンロード
  setTimeout(() => {
    imageLink.click();
    URL.revokeObjectURL(imageUrl);
  }, 500);
}
