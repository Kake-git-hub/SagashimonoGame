import { useEffect, useRef } from 'react';
import { LookState } from '../logic/layers';
import { FaceTrackerHandle } from '../hooks/useFaceTracker';
import { FrameSource } from '../services/faceTracker';
import { MakeupPainter } from './makeupPainter';

interface Props {
  tracker: FaceTrackerHandle;
  look: LookState;
  hidden: boolean;          // くらべる を押している間は描かない
  width: number;
  height: number;
  getSource: () => FrameSource | null;
  painterRef: React.MutableRefObject<MakeupPainter | null>;  // 保存のときに親が使う
}

/**
 * ためす の描画 canvas。映像の上に重なり、メイクがあるときだけ映像ごと描く
 */
export function MakeupCanvas({ tracker, look, hidden, width, height, getSource, painterRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lookRef = useRef(look);
  const hiddenRef = useRef(hidden);
  lookRef.current = look;
  hiddenRef.current = hidden;

  // painter の用意とサイズ合わせ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let painter = painterRef.current;
    if (!painter || painter.output !== canvas) {
      painter = new MakeupPainter(canvas);
      painterRef.current = painter;
    }
    painter.resize(width, height);
    painter.updateMasks(tracker.frameRef.current, lookRef.current);
  }, [width, height, painterRef, tracker]);

  // 顔の点が来るたびにマスクを作り直す。色やつよさが変わったときも直前の点で作り直す
  useEffect(() => {
    const painter = painterRef.current;
    if (!painter) return;
    painter.updateMasks(tracker.frameRef.current, look);
    return tracker.subscribe(frame => painter.updateMasks(frame, lookRef.current));
  }, [tracker, look, painterRef]);

  // 毎フレーム描く
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const painter = painterRef.current;
      if (!painter || document.hidden) return;
      painter.render(getSource(), lookRef.current, hiddenRef.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getSource, painterRef]);

  // 画面を離れたら捨てる
  useEffect(() => () => { painterRef.current = null; }, [painterRef]);

  return <canvas ref={canvasRef} className="mmm-overlay mmm-makeup" width={width} height={height} aria-hidden="true" />;
}
