import { ScrewColor } from './types';

// ネジの色 → 表示色
export const SCREW_COLOR_HEX: Record<ScrewColor, string> = {
  red: '#e63946',
  blue: '#3a86ff',
  green: '#2dc653',
  yellow: '#ffd60a',
  purple: '#9d4edd',
  orange: '#ff8c1a',
};

// ネジの色 → ひらがな名（読み上げ・aria 用）
export const SCREW_COLOR_NAME: Record<ScrewColor, string> = {
  red: 'あか',
  blue: 'あお',
  green: 'みどり',
  yellow: 'きいろ',
  purple: 'むらさき',
  orange: 'オレンジ',
};

// ネジの寸法（ワールド単位）
export const SCREW = {
  SHAFT_RADIUS: 0.12,
  HEAD_RADIUS: 0.3,
  HEAD_HEIGHT: 0.2,
  DEFAULT_LENGTH: 1.0,
} as const;

// ステージ定義の既定値
export const STAGE_DEFAULTS = {
  BOX_CAPACITY: 3,
  VISIBLE_BOXES: 2,
  BUFFER_SLOTS: 5,
} as const;

// 「外せるか」判定のパラメータ
export const BLOCK_CHECK = {
  RING_RAYS: 6,              // 中心レイの周囲に飛ばすレイの本数
  SHAFT_RING_RATIO: 0.9,     // 軸部分のレイ半径（軸半径に対する比率）
  HEAD_RING_RATIO: 0.85,     // 頭部分のレイ半径（頭半径に対する比率）
  MARGIN: 0.01,
} as const;

// アニメーション時間（ミリ秒）
export const ANIM = {
  REMOVE_MS: 450,        // ネジが回転しながら抜ける
  SHAKE_MS: 400,         // 外せないネジの震え
  BLOCKER_FLASH_MS: 600, // 邪魔している物の赤表示
  FALL_MS: 900,          // パーツ落下
  UNFOLD_MS: 1100,       // 展開図のパーツが開く（ちょうつがい 1 つあたりではなく全体）
  FLY_MS: 450,           // ネジがボックスへ飛ぶ
  BOX_DEPART_MS: 650,    // 満杯ボックスの退場
  RESULT_DELAY_MS: 600,  // クリア/失敗オーバーレイを出すまでの待ち
} as const;

export const PART_DEFAULT_COLOR = '#b8c0ff';
