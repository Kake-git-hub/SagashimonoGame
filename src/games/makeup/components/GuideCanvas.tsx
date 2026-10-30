import { useEffect, useRef } from 'react';
import { FaceFrame } from '../types';
import { FaceTrackerHandle } from '../hooks/useFaceTracker';

interface Props {
  tracker: FaceTrackerHandle;
  width: number;   // 映像の実サイズ（canvas の内部サイズに使う）
  height: number;
  showLandmarks: boolean;
  showNumbers: boolean;   // 点の番号（領域の調整用。デバッグ時だけ）
  mirrored: boolean;      // 鏡像表示中は文字を裏返して描く（canvas ごと反転されるので読めるようになる）
}

/**
 * ガイド描画（顔の上に重ねる canvas）
 * フェーズ 1 では点群のデバッグ表示だけ。手順ガイドの領域・矢印はここに足す
 */
export function GuideCanvas({ tracker, width, height, showLandmarks, showNumbers, mirrored }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (frame: FaceFrame | null) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!frame || !showLandmarks) return;
      const w = canvas.width, h = canvas.height;
      const r = Math.max(1.5, w / 400);
      ctx.fillStyle = 'rgba(80, 255, 180, 0.9)';
      for (const p of frame.landmarks) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (showNumbers) {
        ctx.save();
        // 鏡像で裏返っても読めるよう、文字だけ元に戻して描く
        ctx.font = `${Math.max(8, w / 110)}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textBaseline = 'middle';
        frame.landmarks.forEach((p, i) => {
          ctx.save();
          ctx.translate(p.x * w + r + 1, p.y * h);
          if (mirrored) ctx.scale(-1, 1);
          ctx.textAlign = mirrored ? 'right' : 'left';
          ctx.fillText(String(i), 0, 0);
          ctx.restore();
        });
        ctx.restore();
      }
    };

    draw(tracker.frameRef.current);
    return tracker.subscribe(draw);
  }, [tracker, width, height, showLandmarks, showNumbers, mirrored]);

  return <canvas ref={canvasRef} className="mmm-overlay" width={width} height={height} aria-hidden="true" />;
}
