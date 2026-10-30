/**
 * ていあん: 顔の点の比率から、顔のかたち・目のかたち・目の大きさを大まかに分類し、
 * 肌の色の標本から明るさと色み（あたたかい / すずしい）を推定して、おすすめの色と手順を返す純粋関数。
 * 精度は「めやす」。閾値はサンプルの顔（たまご型・ふつうの目）が妥当に分類されるように決めてある
 */
import { Point3 } from '../types';
import { LookState } from './layers';

export type FaceShape = 'oval' | 'round' | 'long' | 'square' | 'heart';
export type EyeShape = 'up' | 'down' | 'neutral';
export type EyeSize = 'big' | 'small' | 'medium';
export type SkinBrightness = 'light' | 'medium' | 'deep';
export type SkinTone = 'warm' | 'cool' | 'neutral' | 'unknown';

export interface SkinSample {
  r: number;
  g: number;
  b: number;
}

export interface FaceMetrics {
  ratio: number;      // 顔の縦 / 横
  jaw: number;        // あごの幅 / 頬の幅
  forehead: number;   // 額の幅 / 頬の幅
  eyeTilt: number;    // 目尻の上がり（正なら上がり目）。左右の平均で頭の傾きを打ち消す
  eyeWidth: number;   // 目の幅 / 頬の幅（左右の平均）
}

export interface Suggestion {
  metrics: FaceMetrics;
  faceShape: FaceShape;
  eyeShape: EyeShape;
  eyeSize: EyeSize;
  skinBrightness: SkinBrightness | null;
  skinTone: SkinTone;
  recipeId: string;
  look: LookState;
}

const IDX = {
  forehead: 10, chin: 152,
  cheekR: 234, cheekL: 454,
  jawR: 172, jawL: 397,
  foreheadR: 54, foreheadL: 284,
  eyeInnerR: 133, eyeOuterR: 33, eyeInnerL: 362, eyeOuterL: 263,
};

export const THRESHOLDS = {
  longRatio: 1.42,
  roundRatio: 1.22,
  squareJaw: 0.86,
  heartJaw: 0.78,
  heartForeheadMinusJaw: 0.14,
  eyeUp: 0.09,
  eyeDown: -0.03,
  eyeBig: 0.215,
  eyeSmall: 0.175,
  skinLight: 175,
  skinDeep: 115,
  warm: 0.42,
  cool: 0.28,
  minLuma: 40,
} as const;

export function faceMetrics(landmarks: Point3[], w: number, h: number): FaceMetrics {
  const p = (i: number) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
  const d = (a: number, b: number) => Math.hypot(p(a).x - p(b).x, p(a).y - p(b).y);
  const cheek = d(IDX.cheekR, IDX.cheekL) || 1e-6;
  const tilt = (inner: number, outer: number) => {
    const i = p(inner), o = p(outer);
    const width = Math.hypot(o.x - i.x, o.y - i.y) || 1e-6;
    return (i.y - o.y) / width;
  };
  return {
    ratio: d(IDX.forehead, IDX.chin) / cheek,
    jaw: d(IDX.jawR, IDX.jawL) / cheek,
    forehead: d(IDX.foreheadR, IDX.foreheadL) / cheek,
    eyeTilt: (tilt(IDX.eyeInnerR, IDX.eyeOuterR) + tilt(IDX.eyeInnerL, IDX.eyeOuterL)) / 2,
    eyeWidth: (d(IDX.eyeInnerR, IDX.eyeOuterR) + d(IDX.eyeInnerL, IDX.eyeOuterL)) / 2 / cheek,
  };
}

export function classifyFaceShape(m: FaceMetrics): FaceShape {
  const t = THRESHOLDS;
  if (m.ratio >= t.longRatio) return 'long';
  if (m.jaw >= t.squareJaw) return 'square';
  if (m.forehead - m.jaw >= t.heartForeheadMinusJaw && m.jaw < t.heartJaw) return 'heart';
  if (m.ratio < t.roundRatio) return 'round';
  return 'oval';
}

export function classifyEyeShape(m: FaceMetrics): EyeShape {
  if (m.eyeTilt >= THRESHOLDS.eyeUp) return 'up';
  if (m.eyeTilt <= THRESHOLDS.eyeDown) return 'down';
  return 'neutral';
}

export function classifyEyeSize(m: FaceMetrics): EyeSize {
  if (m.eyeWidth >= THRESHOLDS.eyeBig) return 'big';
  if (m.eyeWidth <= THRESHOLDS.eyeSmall) return 'small';
  return 'medium';
}

export function skinLuma(s: SkinSample): number {
  return 0.299 * s.r + 0.587 * s.g + 0.114 * s.b;
}

export function classifySkin(sample: SkinSample | null): { brightness: SkinBrightness | null; tone: SkinTone } {
  if (!sample) return { brightness: null, tone: 'unknown' };
  const luma = skinLuma(sample);
  if (luma < THRESHOLDS.minLuma) return { brightness: null, tone: 'unknown' };
  const brightness: SkinBrightness = luma >= THRESHOLDS.skinLight ? 'light' : luma <= THRESHOLDS.skinDeep ? 'deep' : 'medium';
  const warmth = (sample.r - sample.b) / Math.max(1, luma);
  const tone: SkinTone = warmth >= THRESHOLDS.warm ? 'warm' : warmth <= THRESHOLDS.cool ? 'cool' : 'neutral';
  return { brightness, tone };
}

// 色みと目の大きさから、おすすめの色
export function suggestedLook(tone: SkinTone, eyeSize: EyeSize): LookState {
  const palette = {
    warm: { lip: '#f0806a', blush: '#f59a7b', eyeshadow: '#d8b56a', highlight: '#f9e7c4' },
    cool: { lip: '#d9617f', blush: '#e58aa8', eyeshadow: '#e8a7b8', highlight: '#fff3e0' },
    neutral: { lip: '#f48fb1', blush: '#f3a5a5', eyeshadow: '#d9b79a', highlight: '#fff3e0' },
    unknown: { lip: '#f48fb1', blush: '#f3a5a5', eyeshadow: '#d9b79a', highlight: '#fff3e0' },
  }[tone];
  return {
    blush: { color: palette.blush, opacity: 0.5 },
    eyeshadow: { color: palette.eyeshadow, opacity: eyeSize === 'small' ? 0.6 : 0.45 },
    eyeliner: { color: '#4a2e24', opacity: eyeSize === 'small' ? 0.85 : 0.7 },
    brow: { color: '#6b4a3a', opacity: 0.45 },
    highlight: { color: palette.highlight, opacity: 0.4 },
    lip: { color: palette.lip, opacity: 0.6 },
  };
}

export function suggest(landmarks: Point3[], w: number, h: number, skin: SkinSample | null): Suggestion {
  const metrics = faceMetrics(landmarks, w, h);
  const faceShape = classifyFaceShape(metrics);
  const eyeShape = classifyEyeShape(metrics);
  const eyeSize = classifyEyeSize(metrics);
  const { brightness, tone } = classifySkin(skin);
  // 目が小さめなら目もとをしっかり描く「おでかけ」、それ以外は「ナチュラル」
  const recipeId = eyeSize === 'small' ? 'odekake' : 'natural';
  return { metrics, faceShape, eyeShape, eyeSize, skinBrightness: brightness, skinTone: tone, recipeId, look: suggestedLook(tone, eyeSize) };
}
