import { useEffect, useState } from 'react';
import { GuidePose, poseSatisfied } from '../logic/guide';
import { FaceTrackerHandle } from './useFaceTracker';

/**
 * ステップが求める表情（にっこり / 目を閉じる）ができているか。表示用に 150ms ごとに更新する
 */
export function usePoseCheck(tracker: FaceTrackerHandle, pose: GuidePose | undefined): boolean {
  const [ok, setOk] = useState(() => poseSatisfied(pose, tracker.frameRef.current?.blendshapes ?? null));

  useEffect(() => {
    if (!pose || pose === 'front') {
      setOk(true);
      return;
    }
    let last = 0;
    const update = (frame: { blendshapes: Record<string, number> } | null) => {
      const now = performance.now();
      if (now - last < 150) return;
      last = now;
      const next = poseSatisfied(pose, frame?.blendshapes ?? null);
      setOk(prev => (prev === next ? prev : next));
    };
    last = -1000;
    update(tracker.frameRef.current);
    return tracker.subscribe(update);
  }, [tracker, pose]);

  return ok;
}
