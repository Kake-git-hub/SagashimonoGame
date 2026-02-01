// ターゲット（探すアイテム）
export interface Target {
  title: string;
  positions: [number, number][]; // [[x, y], ...] 0-1000スケール、複数回答可
}

// パズルデータ
export interface Puzzle {
  id: string;
  name: string;
  imageSrc: string;
  targets: Target[];
}

// パズル一覧用のサマリー
export interface PuzzleSummary {
  id: string;
  name: string;
  thumbnail: string;
  targetCount: number;
}

// 進捗データ
export interface Progress {
  puzzleId: string;
  foundPositions: string[]; // 発見済み位置のキー配列 "title:index"
  completed: boolean;
  lastPlayed: number; // timestamp
}

// 設定
export interface Settings {
  displayMode: 'text' | 'thumbnail';
}

// カスタムパズル（ユーザー作成）
export interface CustomPuzzle extends Puzzle {
  imageData: string; // Base64 data URL
  createdAt: number; // timestamp
}

// ヒント状態
export interface HintState {
  target: string;        // ヒント対象のtitle
  positionIndex: number; // どの位置のヒントか
  level: number;         // ヒントレベル（0から始まり、連打で増加）
  centerOffset: [number, number]; // ランダムオフセット
}

// ゲーム状態
export interface GameState {
  puzzle: Puzzle | null;
  foundPositions: Set<string>; // 発見済み位置のキー "title:index"
  isCompleted: boolean;
  showHint: boolean;
  hintTarget: string | null;
  hintState: HintState | null; // 詳細なヒント状態
}

// 定数
export const CONSTANTS = {
  // 座標スケール（画像左上(0,0)〜右下(1000,1000)）
  SCALE: 1000,
  // 正解判定の半径（5%相当）
  HIT_RADIUS: 50,
  // ヒント表示時間（ミリ秒）
  HINT_DURATION: 3000,
  // サムネイル切り抜きサイズ（片側）
  THUMBNAIL_RADIUS: 50,
  // レスポンシブブレークポイント
  BREAKPOINT_TABLET: 768,
  // ヒント初期半径（画像の1/4=250）、連打で半減、3回まで
  HINT_INITIAL_RADIUS: 250,
  HINT_MIN_RADIUS: 62,
  HINT_MAX_LEVEL: 2, // 0,1,2の3段階
} as const;

// 画面モード
export type ScreenMode = 'list' | 'game' | 'editor';

// ヘルパー関数: 位置キーを生成
export function makePositionKey(title: string, index: number): string {
  return `${title}:${index}`;
}

// ヘルパー関数: 位置キーをパース
export function parsePositionKey(key: string): { title: string; index: number } | null {
  const lastColon = key.lastIndexOf(':');
  if (lastColon === -1) return null;
  const title = key.substring(0, lastColon);
  const index = parseInt(key.substring(lastColon + 1), 10);
  if (isNaN(index)) return null;
  return { title, index };
}

// ヘルパー関数: パズルの総位置数を計算
export function getTotalPositionCount(puzzle: Puzzle): number {
  return puzzle.targets.reduce((sum, t) => sum + t.positions.length, 0);
}

// ヘルパー関数: ヒント半径を計算（レベルに応じて半減、3回まで）
export function getHintRadius(level: number): number {
  const cappedLevel = Math.min(level, CONSTANTS.HINT_MAX_LEVEL);
  const radius = CONSTANTS.HINT_INITIAL_RADIUS / Math.pow(2, cappedLevel);
  return Math.max(radius, CONSTANTS.HINT_MIN_RADIUS);
}
