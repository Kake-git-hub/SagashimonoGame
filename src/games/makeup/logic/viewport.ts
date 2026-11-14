/**
 * 画面の位置と映像の位置の変換
 * 映像は object-fit: cover で枠（rect）いっぱいに広げ、鏡像のときは左右を反転して表示している。
 * 枠からはみ出した分のどこを見せるかは pan（CSS の object-position と同じ 0〜1。0.5 が真ん中）で決まる
 */
export interface ViewRect { left: number; top: number; width: number; height: number }
export interface ViewPan { x: number; y: number }

export const CENTER_PAN: ViewPan = { x: 0.5, y: 0.5 };

function shown(rect: ViewRect, frameWidth: number, frameHeight: number) {
  const scale = Math.max(rect.width / frameWidth, rect.height / frameHeight);
  return { w: frameWidth * scale, h: frameHeight * scale };
}

// 画面の位置（clientX / clientY）→ 映像の正規化座標（顔の点と同じ 0〜1。枠からはみ出した分は範囲外になる）
export function clientToFrame(
  rect: ViewRect, frameWidth: number, frameHeight: number, mirrored: boolean, clientX: number, clientY: number, pan: ViewPan = CENTER_PAN,
): { x: number; y: number } {
  const s = shown(rect, frameWidth, frameHeight);
  // 鏡像は、枠ごと左右を反転して表示している
  const localX = mirrored ? rect.width - (clientX - rect.left) : clientX - rect.left;
  return {
    x: (localX - (rect.width - s.w) * pan.x) / s.w,
    y: (clientY - rect.top - (rect.height - s.h) * pan.y) / s.h,
  };
}

// 逆変換: 映像の正規化座標 → 画面の位置
export function frameToClient(
  rect: ViewRect, frameWidth: number, frameHeight: number, mirrored: boolean, x: number, y: number, pan: ViewPan = CENTER_PAN,
): { x: number; y: number } {
  const s = shown(rect, frameWidth, frameHeight);
  const localX = (rect.width - s.w) * pan.x + x * s.w;
  return {
    x: rect.left + (mirrored ? rect.width - localX : localX),
    y: rect.top + (rect.height - s.h) * pan.y + y * s.h,
  };
}

/**
 * 顔（中心の正規化座標）が枠の真ん中に来るような pan。はみ出していない方向は 0.5 のまま。
 * 近づくと顔は映像の端に寄りやすい（カメラは画面の端にある）ので、切り落とす側を顔に合わせて選ぶ
 */
export function panForFace(rect: ViewRect, frameWidth: number, frameHeight: number, faceX: number, faceY: number): ViewPan {
  const s = shown(rect, frameWidth, frameHeight);
  const axis = (box: number, content: number, center: number): number => {
    const overflow = content - box;
    if (overflow < 1) return 0.5;
    // 顔の中心を枠の真ん中に置いたときの、映像の左上のずれ（0 〜 -overflow に収める）
    const offset = Math.max(-overflow, Math.min(0, box / 2 - center * content));
    return Math.abs(offset) / overflow;
  };
  return { x: axis(rect.width, s.w, faceX), y: axis(rect.height, s.h, faceY) };
}
