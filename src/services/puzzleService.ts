import { Puzzle, PuzzleSummary } from '../types';

const BASE_URL = import.meta.env.BASE_URL;

// パズル一覧を取得
export async function fetchPuzzleList(): Promise<PuzzleSummary[]> {
  const response = await fetch(`${BASE_URL}puzzles/index.json`);
  if (!response.ok) {
    throw new Error('パズル一覧の取得に失敗しました');
  }
  return response.json();
}

// 個別パズルデータを取得
export async function fetchPuzzle(id: string): Promise<Puzzle> {
  const response = await fetch(`${BASE_URL}puzzles/${id}.json`);
  if (!response.ok) {
    throw new Error(`パズル "${id}" の取得に失敗しました`);
  }
  return response.json();
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
