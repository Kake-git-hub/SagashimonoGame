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
  foundTargets: string[]; // 発見済みターゲットのtitle配列
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
  level: number;         // ヒントレベル（0から始まり、連打で増加）
  centerOffset: [number, number]; // ランダムオフセット
}

// ゲーム状態
export interface GameState {
  puzzle: Puzzle | null;
  foundTargets: string[];
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
  HINT_DURATION: 2500,
  // サムネイル切り抜きサイズ（片側）
  THUMBNAIL_RADIUS: 50,
  // レスポンシブブレークポイント
  BREAKPOINT_TABLET: 768,
  // ヒント半径（レベル別：0から順に縮小）
  HINT_RADII: [300, 200, 130, 80, 50],
} as const;

// 画面モード
export type ScreenMode = 'list' | 'game' | 'editor';
