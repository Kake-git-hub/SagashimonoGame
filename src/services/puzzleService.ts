import { Puzzle, PuzzleSummary, CustomPuzzle } from '../types';
import { getCustomPuzzle, getCustomPuzzleSummaries } from './storageService';

const BASE_URL = import.meta.env.BASE_URL;

// パズル一覧を取得（カスタムパズル含む）
export async function fetchPuzzleList(): Promise<PuzzleSummary[]> {
  const response = await fetch(`${BASE_URL}puzzles/index.json`);
  if (!response.ok) {
    throw new Error('パズル一覧の取得に失敗しました');
  }
  const serverPuzzles: PuzzleSummary[] = await response.json();
  
  // カスタムパズルを追加
  const customSummaries = await getCustomPuzzleSummaries();
  
  return [...serverPuzzles, ...customSummaries];
}

// 個別パズルデータを取得
export async function fetchPuzzle(id: string): Promise<Puzzle> {
  // カスタムパズルの場合
  if (id.startsWith('custom-')) {
    const customPuzzle = await getCustomPuzzle(id);
    if (customPuzzle) {
      // CustomPuzzleをPuzzleに変換（imageDataをimageSrcとして使用）
      return {
        id: customPuzzle.id,
        name: customPuzzle.name,
        imageSrc: customPuzzle.imageData, // Data URL
        targets: customPuzzle.targets,
      };
    }
    throw new Error(`カスタムパズル "${id}" が見つかりません`);
  }
  
  // サーバーパズル
  const response = await fetch(`${BASE_URL}puzzles/${id}.json`);
  if (!response.ok) {
    throw new Error(`パズル "${id}" の取得に失敗しました`);
  }
  return response.json();
}

// サーバーパズルを編集用に取得（画像をData URLに変換）
export async function fetchServerPuzzleForEdit(id: string): Promise<CustomPuzzle | null> {
  try {
    const puzzle = await fetchPuzzle(id);
    
    // 画像をData URLに変換
    const imageUrl = getImageUrl(puzzle.imageSrc);
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('画像の取得に失敗');
    
    const blob = await response.blob();
    const imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    return {
      id: `server-edit-${id}`, // サーバー編集用の特別なID
      name: puzzle.name,
      imageSrc: imageData, // Puzzle継承のため必要
      imageData,
      targets: puzzle.targets,
      createdAt: Date.now(),
    };
  } catch (error) {
    console.error('Failed to fetch server puzzle for edit:', error);
    return null;
  }
}

// 画像のフルURLを取得
export function getImageUrl(imageSrc: string): string {
  // すでに絶対URLの場合はそのまま返す
  if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
    return imageSrc;
  }
  // Data URLの場合もそのまま返す
  if (imageSrc.startsWith('data:')) {
    return imageSrc;
  }
  return `${BASE_URL}${imageSrc}`;
}
