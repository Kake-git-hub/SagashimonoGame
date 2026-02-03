// マーカーサイズ
export type MarkerSize = 'small' | 'medium' | 'large';

// 位置情報（座標+サイズ）
export interface Position {
  x: number;
  y: number;
  size: MarkerSize;
}

// ターゲット（探すアイテム）
export interface Target {
  title: string;
  positions: Position[]; // 0-1000スケール、複数回答可
}

// 旧形式の位置（後方互換用）
export type LegacyPosition = [number, number];

// 旧形式かどうかをチェック
export function isLegacyPosition(pos: Position | LegacyPosition): pos is LegacyPosition {
  return Array.isArray(pos);
}

// 旧形式から新形式に変換
export function convertLegacyPosition(pos: LegacyPosition): Position {
  return { x: pos[0], y: pos[1], size: 'medium' };
}

// 位置を正規化（旧形式も新形式も対応）
export function normalizePosition(pos: Position | LegacyPosition): Position {
  if (isLegacyPosition(pos)) {
    return convertLegacyPosition(pos);
  }
  return pos;
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
  // マーカーサイズごとの判定半径（0-1000スケール）
  HIT_RADIUS_SMALL: 16,
  HIT_RADIUS_MEDIUM: 32,
  HIT_RADIUS_LARGE: 64,
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

// マーカーサイズから判定半径を取得
export function getHitRadius(size: MarkerSize): number {
  switch (size) {
    case 'small': return CONSTANTS.HIT_RADIUS_SMALL;
    case 'medium': return CONSTANTS.HIT_RADIUS_MEDIUM;
    case 'large': return CONSTANTS.HIT_RADIUS_LARGE;
    default: return CONSTANTS.HIT_RADIUS_MEDIUM;
  }
}

// マーカーサイズからピクセルサイズを取得
export function getMarkerPixelSize(size: MarkerSize): number {
  // 判定半径と同じ値をピクセルサイズに使用
  return getHitRadius(size);
}

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
