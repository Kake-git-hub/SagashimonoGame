import { useEffect, useRef } from 'react';
import { faceBox, focusBox } from '../logic/focus';
import { LayerId } from '../logic/layers';
import { easeView, StageViewState, viewFor } from '../logic/viewport';
import { FaceTrackerHandle } from './useFaceTracker';

// 1 コマ（rAF）ごとに目標へ近づける割合。小さいほどゆっくり（顔の点の揺れで映像が小刻みに動かないように）
const VIEW_EASE = 0.14;
// これより小さい動きは描き直さない（px / 倍率）
const MOVE_EPSILON = 0.25;
const SCALE_EPSILON = 0.0015;

/**
 * 映像の見せ方を決めて動かす
 * - ふだんは枠いっぱいに広げ、はみ出した分は顔のある側を見せる（近づくと顔は映像の端に寄りやすい）
 * - zoomPart があるときは、そのパーツのあたりをアップにする。顔が動いても追いかけるので、塗る所が画面の真ん中に留まる
 * 映像と重ねる canvas の入れ物（viewElRef）に CSS の transform を直接書き、React の再描画は起こさない。
 * 返す viewRef は、画面の位置 → 映像の位置 の変換（なぞって塗る）に使う
 */
export function useStageView(
  tracker: FaceTrackerHandle,
  stageRef: React.RefObject<HTMLDivElement | null>,
  viewElRef: React.RefObject<HTMLDivElement | null>,
  frameWidth: number,
  frameHeight: number,
  mirrored: boolean,
  zoomPart: LayerId | null,
): React.RefObject<StageViewState> {
  const viewRef = useRef<StageViewState>({ scale: 1, x: 0, y: 0 });
  const { frameRef } = tracker;
  const zoomRef = useRef(zoomPart);
  zoomRef.current = zoomPart;

  useEffect(() => {
    let raf = 0;
    let first = true;
    let lastFocus: ReturnType<typeof faceBox> | null = null;
    let lastZoomed = false;

    const apply = (view: StageViewState) => {
      viewRef.current = view;
      const el = viewElRef.current;
      if (el) el.style.transform = `translate(${view.x.toFixed(2)}px, ${view.y.toFixed(2)}px) scale(${view.scale.toFixed(4)})`;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const stage = stageRef.current;
      if (!stage || document.hidden) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const frame = frameRef.current;
      const part = zoomRef.current;
      // 顔が見えない間は、直前に見ていた所をそのまま見せる
      if (frame) {
        lastFocus = part ? focusBox(frame.landmarks, part) : faceBox(frame.landmarks);
        lastZoomed = !!part;
      } else if (!part && lastZoomed) {
        // アップをやめたのに顔が見えないとき: 真ん中へ戻す
        lastFocus = null;
        lastZoomed = false;
      }
      const target = viewFor(rect, frameWidth, frameHeight, mirrored, lastFocus, lastZoomed);
      if (first) {
        first = false;
        apply(target);
        return;
      }
      const cur = viewRef.current;
      if (Math.abs(target.x - cur.x) < MOVE_EPSILON && Math.abs(target.y - cur.y) < MOVE_EPSILON && Math.abs(target.scale - cur.scale) < SCALE_EPSILON) return;
      apply(easeView(cur, target, VIEW_EASE));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameRef, stageRef, viewElRef, frameWidth, frameHeight, mirrored]);

  return viewRef;
}
