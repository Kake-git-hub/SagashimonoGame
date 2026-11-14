import { MakeupSettings } from './types';

// 顔認識に使う MediaPipe の点の番号
export const LM = {
  noseTip: 1,
  noseBridge: 6,
  forehead: 10,
  chin: 152,
  // 顔の左右の端（自分から見て 右 = 番号の若い方）
  cheekR: 234,
  cheekL: 454,
  // 目頭・目尻（自分の右目 33→133、左目 362→263）
  eyeOuterR: 33,
  eyeInnerR: 133,
  eyeInnerL: 362,
  eyeOuterL: 263,
} as const;

export const LANDMARK_COUNT = 478;

// 状態判定の閾値
export const STATUS_THRESHOLDS = {
  // 顔の横幅（映像の短い辺に対する割合）。これより小さいと「とおい」、大きいと「ちかい」
  // 画面をなぞって塗るので近づくのは普通のこと。「はなれてね」は、認識が切れる手前（約 2 倍）に近づいたときだけ出す
  farWidthRatio: 0.2,
  closeWidthRatio: 1.6,
  // 顔の向き（度）。これを超えると「まっすぐ むいてね」
  turnedYawDeg: 22,
  turnedPitchDeg: 22,
  // 顔の明るさ（0〜255 の平均輝度）。これ未満なら「くらい」
  darkLuma: 60,
  // 顔が見つからなくなってから直前の結果を使い続ける時間（ms）
  holdLastMs: 500,
} as const;

// 平滑化（指数移動平均）の係数。1 に近いほど新しい値をそのまま使う
export const SMOOTHING_ALPHA = 0.5;

// 推論がこれより遅いときは「まびき」と表示する（ms）
export const SLOW_INFERENCE_MS = 50;

// 推論は同期処理で、その間は画面の操作が止まる。推論にかかった時間 × この割合だけ次の推論を待って、操作に時間を空ける
export const INFERENCE_REST_RATIO = 0.5;
export const INFERENCE_REST_MAX_MS = 150;

// 写真は動かないので、推論はこの間隔でゆっくり回す（ms）
export const PHOTO_INFERENCE_INTERVAL_MS = 250;

// 顔を見つける / 追い続ける ときの信頼度のしきい値（MediaPipe の既定は 0.5）。
// 近づいて顔の一部が切れても追い続けられるよう低めにする
export const FACE_CONFIDENCE = 0.3;

export const DEFAULT_SETTINGS: MakeupSettings = {
  mirrored: true,
  delegate: 'GPU',
  showLandmarks: false,
  showStats: false,
  guideOpacity: 0.8,
  paintAssist: true,
};

// 保存キー（localStorage）
export const SETTINGS_KEY = 'makeup_settings';
export const LAST_LOOK_KEY = 'makeup_last_look';

// パーツ（レイヤーと、ガイドだけにあるマスカラ・仕上げ）の絵文字
export const PART_EMOJI: Record<string, string> = {
  lip: '💋',
  blush: '🌸',
  eyeshadow: '👁️',
  eyeliner: '✒️',
  brow: '✏️',
  highlight: '✨',
  base: '🧴',
  concealer: '🩹',
  mascara: '🪄',
  finish: '🪞',
};
