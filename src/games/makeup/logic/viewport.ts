/**
 * 映像の見せ方（どこを・どのくらい大きく見せるか）と、画面の位置と映像の位置の変換
 *
 * 映像と重ねる canvas は、映像の実サイズ（frameWidth × frameHeight px）の入れ物に入れ、
 * その入れ物を枠（stage）の中で「拡大 scale → 平行移動 (x, y)」して見せる（CSS の transform）。
 * 鏡像のときは、入れ物の中身を左右反転している。
 * - ふだん: 枠いっぱいに広げ（cover）、はみ出した分は顔のある側を見せる
 * - パーツを選んだとき: そのパーツのあたりが枠いっぱいになるように拡大する（アップ）
 */
export interface ViewRect { left: number; top: number; width: number; height: number }

export interface StageViewState {
  scale: number;  // 映像の 1px が画面の何 px か
  x: number;      // 入れ物の左上の位置（枠の左上から。px）
  y: number;
}

// 見せたい範囲（映像の正規化座標 0〜1）
export interface FocusBox { x0: number; y0: number; x1: number; y1: number }

// アップは、枠いっぱい（cover）の何倍まで拡大してよいか（拡大しすぎると映像が粗くなる）
export const MAX_ZOOM = 3.5;

// 枠いっぱいに広げるときの倍率
export function coverScale(rect: ViewRect, frameWidth: number, frameHeight: number): number {
  return Math.max(rect.width / frameWidth, rect.height / frameHeight);
}

// 画面の位置（clientX / clientY）→ 映像の正規化座標（顔の点と同じ 0〜1。見えていない所は範囲外になる）
export function clientToFrame(
  rect: ViewRect, frameWidth: number, frameHeight: number, mirrored: boolean, view: StageViewState, clientX: number, clientY: number,
): { x: number; y: number } {
  const x = (clientX - rect.left - view.x) / (frameWidth * view.scale);
  const y = (clientY - rect.top - view.y) / (frameHeight * view.scale);
  return { x: mirrored ? 1 - x : x, y };
}

// 逆変換: 映像の正規化座標 → 画面の位置
export function frameToClient(
  rect: ViewRect, frameWidth: number, frameHeight: number, mirrored: boolean, view: StageViewState, x: number, y: number,
): { x: number; y: number } {
  return {
    x: rect.left + view.x + (mirrored ? 1 - x : x) * frameWidth * view.scale,
    y: rect.top + view.y + y * frameHeight * view.scale,
  };
}

/**
 * focus の範囲を見せるための見せ方を求める
 * @param focus   見せたい範囲。顔ぜんたいのときは顔の外接矩形、アップのときはパーツのあたり
 * @param zoom    true なら focus が枠に収まるところまで拡大する。false なら枠いっぱい（cover）のまま、focus の中心へ寄せるだけ
 * 映像の端より外は見せない（黒い所が出ないように、端で止める）
 */
export function viewFor(
  rect: ViewRect, frameWidth: number, frameHeight: number, mirrored: boolean, focus: FocusBox | null, zoom: boolean,
): StageViewState {
  const cover = coverScale(rect, frameWidth, frameHeight);
  let scale = cover;
  let cx = 0.5, cy = 0.5;
  if (focus) {
    cx = (focus.x0 + focus.x1) / 2;
    cy = (focus.y0 + focus.y1) / 2;
    if (zoom) {
      const fw = Math.max(1e-6, (focus.x1 - focus.x0) * frameWidth), fh = Math.max(1e-6, (focus.y1 - focus.y0) * frameHeight);
      scale = Math.max(cover, Math.min(cover * MAX_ZOOM, rect.width / fw, rect.height / fh));
    }
  }
  const shownW = frameWidth * scale, shownH = frameHeight * scale;
  // 鏡像では、映像の x は画面の上で左右が逆になる
  const sx = mirrored ? 1 - cx : cx;
  const clampOffset = (box: number, content: number, center: number) => Math.min(0, Math.max(box - content, box / 2 - center * content));
  return { scale, x: clampOffset(rect.width, shownW, sx), y: clampOffset(rect.height, shownH, cy) };
}

// いまの見せ方を目標へ少し近づける（t = 0〜1）
export function easeView(current: StageViewState, target: StageViewState, t: number): StageViewState {
  return {
    scale: current.scale + (target.scale - current.scale) * t,
    x: current.x + (target.x - current.x) * t,
    y: current.y + (target.y - current.y) * t,
  };
}
