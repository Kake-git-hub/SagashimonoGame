import { useEffect, useRef } from 'react';
import { faceBounds } from '../logic/pose';
import { CENTER_PAN, panForFace, ViewPan } from '../logic/viewport';
import { FaceTrackerHandle } from './useFaceTracker';

// 1 コマごとに目標へ近づける割合（小さいほどゆっくり。顔の点の揺れで映像が小刻みに動かないように）
const PAN_EASE = 0.2;
// これより小さい動きは無視する（pan の単位）
const PAN_DEADBAND = 0.01;

/**
 * 映像は枠いっぱいに広げて（cover）表示するので、枠と映像の形が違うと端が切れる。
 * 近づくと顔は映像の端に寄りやすい（カメラは画面の端にある）ため、切れる側を顔に合わせてずらし、顔が画面に残るようにする。
 * ずらす量は CSS 変数（--mmm-pan-x / --mmm-pan-y）で映像と重ねる canvas に伝え、React の再描画は起こさない。
 * 返す panRef は、画面の位置 → 映像の位置 の変換（なぞって塗る）に使う
 */
export function useAutoPan(
  tracker: FaceTrackerHandle,
  stageRef: React.RefObject<HTMLDivElement | null>,
  frameWidth: number,
  frameHeight: number,
): React.RefObject<ViewPan> {
  const panRef = useRef<ViewPan>({ ...CENTER_PAN });
  const { subscribe } = tracker;

  useEffect(() => {
    const apply = (pan: ViewPan) => {
      panRef.current = pan;
      const el = stageRef.current;
      if (!el) return;
      el.style.setProperty('--mmm-pan-x', `${(pan.x * 100).toFixed(2)}%`);
      el.style.setProperty('--mmm-pan-y', `${(pan.y * 100).toFixed(2)}%`);
    };
    // 映像の大きさが変わったら（写真を選び直した・カメラが替わった）真ん中から始める
    apply({ ...CENTER_PAN });
    return subscribe(frame => {
      const el = stageRef.current;
      if (!frame || !el) return; // 顔が見えない間は、そのままにする
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const b = faceBounds(frame.landmarks);
      const target = panForFace(rect, frameWidth, frameHeight, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
      const cur = panRef.current;
      const next = { x: cur.x + (target.x - cur.x) * PAN_EASE, y: cur.y + (target.y - cur.y) * PAN_EASE };
      if (Math.abs(target.x - cur.x) < PAN_DEADBAND && Math.abs(target.y - cur.y) < PAN_DEADBAND) return;
      apply(next);
    });
  }, [subscribe, stageRef, frameWidth, frameHeight]);

  return panRef;
}
