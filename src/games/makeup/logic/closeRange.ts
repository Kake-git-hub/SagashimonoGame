/**
 * 近づいたときの顔認識
 * 画面を触ろうと近づくと、顔が映像いっぱい（または はみ出す）になり、顔を見つける処理が効かなくなる。
 * そこで、映像のまわりに黒い余白を足した絵（顔が相対的に小さく、全体が枠の中に入る）を渡して認識させ、
 * 結果の点を元の映像の座標に戻す。実測では、顔の幅が映像の短い辺の 約 1.5 倍 → 約 2 倍 まで追えるようになる。
 *
 * 余白つきの絵は顔が小さく写るぶん精度が少し落ちるので、ふつうの距離では使わず、近いとき・見失ったときだけ切り替える
 */
import { Point3 } from '../types';
import { faceBounds, faceWidthRatio } from './pose';

// 余白つきの絵の一辺は、映像の PAD_SCALE 倍（映像は真ん中に 1 / PAD_SCALE の大きさで入る）
export const PAD_SCALE = 1.5;
// 余白つきの絵の中の、映像の長い辺の上限（px）。これより大きい映像は縮めて描く
export const PAD_CONTENT_MAX = 640;

export const CLOSE_RANGE = {
  // 顔の幅（短い辺に対する割合）がこれを超えるか、顔の端が映像の縁に近づいたら余白つきにする
  enterWidthRatio: 0.7,
  enterEdge: 0.03,
  // これより小さく、縁からも離れたら元に戻す（行ったり来たりしないよう差を付ける）
  leaveWidthRatio: 0.5,
  leaveEdge: 0.1,
  // 顔が見つからないとき: この時間（ms）ごとに、余白あり / なし を入れ替えて探す
  searchAfterMs: 400,
  searchSwitchMs: 700,
  // 切り替えた直後の結果は当てにならないことがあるので、この時間（ms）は切り替え直さない
  holdMs: 500,
} as const;

export interface CloseRangeState {
  padded: boolean;
  lostSince: number | null;  // 顔が見つからなくなった時刻
  switchedAt: number;        // 見つからない間に最後に入れ替えた時刻
  holdUntil: number;         // この時刻までは、顔の大きさでは切り替えない
}

export function initialCloseRange(): CloseRangeState {
  return { padded: false, lostSince: null, switchedAt: 0, holdUntil: 0 };
}

/**
 * 今のフレームの結果から、次のフレームを余白つきで認識するかを決める
 * @param landmarks  今のフレームで見つかった顔の点（元の映像の座標）。見つからなければ null
 * @param aspect     映像の幅 / 高さ
 */
export function nextCloseRange(state: CloseRangeState, landmarks: readonly Point3[] | null, aspect: number, now: number): CloseRangeState {
  const t = CLOSE_RANGE;
  if (!landmarks || landmarks.length === 0) {
    const lostSince = state.lostSince ?? now;
    const since = Math.max(lostSince + t.searchAfterMs - t.searchSwitchMs, state.switchedAt);
    if (now - lostSince >= t.searchAfterMs && now - since >= t.searchSwitchMs) {
      return { ...state, padded: !state.padded, lostSince, switchedAt: now };
    }
    return { ...state, lostSince };
  }
  if (now < state.holdUntil) return { ...state, lostSince: null, switchedAt: 0 };
  const width = faceWidthRatio(landmarks as Point3[], aspect);
  const b = faceBounds(landmarks as Point3[]);
  let padded = state.padded;
  if (!padded) {
    if (width > t.enterWidthRatio || b.minX < t.enterEdge || b.minY < t.enterEdge || b.maxX > 1 - t.enterEdge || b.maxY > 1 - t.enterEdge) padded = true;
  } else if (width < t.leaveWidthRatio && b.minX > t.leaveEdge && b.minY > t.leaveEdge && b.maxX < 1 - t.leaveEdge && b.maxY < 1 - t.leaveEdge) {
    padded = false;
  }
  return { padded, lostSince: null, switchedAt: 0, holdUntil: padded !== state.padded ? now + t.holdMs : state.holdUntil };
}

// 余白つきの絵で見つけた点を、元の映像の座標に戻す（映像の外にはみ出した点は 0〜1 の外になる）
export function unpadLandmarks(landmarks: readonly Point3[], scale = PAD_SCALE): Point3[] {
  return landmarks.map(p => ({ x: (p.x - 0.5) * scale + 0.5, y: (p.y - 0.5) * scale + 0.5, z: p.z * scale }));
}

// 余白つきの絵の大きさと、その中で映像を描く位置
export function paddedLayout(frameWidth: number, frameHeight: number, scale = PAD_SCALE, contentMax = PAD_CONTENT_MAX) {
  const shrink = Math.min(1, contentMax / Math.max(frameWidth, frameHeight));
  const contentW = Math.max(1, Math.round(frameWidth * shrink)), contentH = Math.max(1, Math.round(frameHeight * shrink));
  const width = Math.round(contentW * scale), height = Math.round(contentH * scale);
  return { width, height, x: (width - contentW) / 2, y: (height - contentH) / 2, contentW, contentH };
}
