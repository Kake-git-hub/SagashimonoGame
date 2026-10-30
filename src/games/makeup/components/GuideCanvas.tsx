import { useEffect, useRef } from 'react';
import { FaceFrame } from '../types';
import { FaceTrackerHandle } from '../hooks/useFaceTracker';
import { buildGuideDrawing, GuideDrawing, RecipeStep } from '../logic/guide';
import { faceRegions, Pt, Shape } from '../logic/regions';

interface Props {
  tracker: FaceTrackerHandle;
  width: number;   // 映像の実サイズ（canvas の内部サイズに使う）
  height: number;
  showLandmarks: boolean;
  showNumbers: boolean;   // 点の番号（領域の調整用。デバッグ時だけ）
  mirrored: boolean;      // 鏡像表示中は文字を裏返して描く（canvas ごと反転されるので読めるようになる）
  step: RecipeStep | null;  // おしえて の今のステップ。無ければガイドは描かない
  opacity: number;          // ガイドの濃さ（0〜1）
}

const PINK = '255, 107, 157';
const ARROW_PERIOD_MS = 1500;

function pathShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.beginPath();
  switch (shape.kind) {
    case 'polygon':
      tracePolygon(ctx, shape.points);
      shape.holes?.forEach(h => tracePolygon(ctx, h));
      break;
    case 'ellipse':
      ctx.ellipse(shape.cx, shape.cy, Math.max(0.5, shape.rx), Math.max(0.5, shape.ry), shape.rotation, 0, Math.PI * 2);
      break;
    case 'stroke': {
      // 線は中心線をなぞる（太さは lineWidth で表す）
      const pts = shape.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      break;
    }
  }
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: Pt[]) {
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

// 折れ線上の、全長に対する割合 s（0〜1）の位置と向き
function pointAlong(path: Pt[], s: number): { p: Pt; dir: Pt } {
  let total = 0;
  const seg: number[] = [];
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    seg.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, s)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const t = seg[i] === 0 ? 0 : target / seg[i];
      const a = path[i], b = path[i + 1];
      const len = seg[i] || 1;
      return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } };
    }
    target -= seg[i];
  }
  const last = path[path.length - 1];
  return { p: last, dir: { x: 1, y: 0 } };
}

function drawGuide(ctx: CanvasRenderingContext2D, d: GuideDrawing, now: number, opacity: number) {
  const fw = d.faceWidth;
  const pulse = 0.5 + 0.5 * Math.sin((now / 1400) * Math.PI * 2);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 領域: 薄い塗り（明滅）＋ 白い点線
  for (const shape of d.regions) {
    pathShape(ctx, shape);
    if (shape.kind === 'stroke') {
      const w = Math.max(...shape.widths, fw * 0.01);
      ctx.lineWidth = w;
      ctx.strokeStyle = `rgba(${PINK}, ${0.35 + 0.2 * pulse})`;
      ctx.setLineDash([]);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(${PINK}, ${0.14 + 0.1 * pulse})`;
      ctx.fill('evenodd');
      ctx.lineWidth = fw * 0.008;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.setLineDash([fw * 0.03, fw * 0.02]);
      ctx.lineDashOffset = -(now / 40) % (fw * 0.05);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // 矢印: うっすら全体の線 ＋ 流れる光と矢じり
  d.strokes.forEach((path, i) => {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let k = 1; k < path.length; k++) ctx.lineTo(path[k].x, path[k].y);
    ctx.lineWidth = fw * 0.018;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.stroke();

    const s = ((now / ARROW_PERIOD_MS) + i * 0.21) % 1;
    const tail = Math.max(0, s - 0.28);
    const steps = 6;
    ctx.lineWidth = fw * 0.024;
    for (let k = 0; k < steps; k++) {
      const s0 = tail + ((s - tail) * k) / steps;
      const s1 = tail + ((s - tail) * (k + 1)) / steps;
      const a = pointAlong(path, s0).p, b = pointAlong(path, s1).p;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(${PINK}, ${0.25 + (0.75 * (k + 1)) / steps})`;
      ctx.stroke();
    }
    const head = pointAlong(path, s);
    const L = fw * 0.07, W = fw * 0.05;
    const nx = -head.dir.y, ny = head.dir.x;
    ctx.beginPath();
    ctx.moveTo(head.p.x + head.dir.x * L * 0.6, head.p.y + head.dir.y * L * 0.6);
    ctx.lineTo(head.p.x - head.dir.x * L * 0.4 + nx * W * 0.5, head.p.y - head.dir.y * L * 0.4 + ny * W * 0.5);
    ctx.lineTo(head.p.x - head.dir.x * L * 0.4 - nx * W * 0.5, head.p.y - head.dir.y * L * 0.4 - ny * W * 0.5);
    ctx.closePath();
    ctx.fillStyle = `rgba(${PINK}, 1)`;
    ctx.fill();
    ctx.lineWidth = fw * 0.006;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.stroke();
  });

  // 目印
  for (const m of d.marks) {
    if (m.kind === 'vline') {
      ctx.beginPath();
      ctx.moveTo(m.x, m.y1);
      ctx.lineTo(m.x, m.y2);
      ctx.lineWidth = fw * 0.008;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.setLineDash([fw * 0.02, fw * 0.015]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.beginPath();
      ctx.arc(m.p.x, m.p.y, fw * (0.02 + 0.008 * pulse), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${PINK}, 0.9)`;
      ctx.fill();
      ctx.lineWidth = fw * 0.006;
      ctx.strokeStyle = 'white';
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * ガイド描画（顔の上に重ねる canvas）
 * おしえて のステップ（領域・矢印・目印）と、デバッグ用の点群を描く。顔が動いても毎フレーム追従する
 */
export function GuideCanvas({ tracker, width, height, showLandmarks, showNumbers, mirrored, step, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ showLandmarks, showNumbers, mirrored, step, opacity });
  propsRef.current = { showLandmarks, showNumbers, mirrored, step, opacity };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let lastFrame: FaceFrame | null = null;
    let lastStep: RecipeStep | null = null;
    let drawing: GuideDrawing | null = null;
    let wasEmpty = false;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      const { showLandmarks, showNumbers, mirrored, step, opacity } = propsRef.current;
      const frame = tracker.frameRef.current;
      const w = canvas.width, h = canvas.height;
      const empty = !frame || (!showLandmarks && !step);
      if (empty) {
        if (!wasEmpty) ctx.clearRect(0, 0, w, h);
        wasEmpty = true;
        return;
      }
      wasEmpty = false;
      ctx.clearRect(0, 0, w, h);

      if (step) {
        if (frame !== lastFrame || step !== lastStep || !drawing) {
          drawing = buildGuideDrawing(step, faceRegions(frame.landmarks, w, h));
          lastFrame = frame;
          lastStep = step;
        }
        drawGuide(ctx, drawing, performance.now(), opacity);
      }

      if (showLandmarks) {
        const r = Math.max(1.5, w / 400);
        ctx.fillStyle = 'rgba(80, 255, 180, 0.9)';
        for (const p of frame.landmarks) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
          ctx.fill();
        }
        if (showNumbers) {
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
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tracker, width, height]);

  return <canvas ref={canvasRef} className="mmm-overlay" width={width} height={height} aria-hidden="true" />;
}
