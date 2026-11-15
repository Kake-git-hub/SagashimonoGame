import { useEffect, useRef } from 'react';
import { BrushSize, brushFor, eraserBrush, strokeStamps } from '../logic/brush';
import { FaceUV, locateOnFace } from '../logic/faceMesh';
import { LayerId } from '../logic/layers';
import { clientToFrame, ViewPan } from '../logic/viewport';
import { FaceTrackerHandle } from '../hooks/useFaceTracker';
import { FacePaint } from './facePaint';
import { diag } from '../services/diagnostics';

// いま持っている道具
export interface PaintTool {
  layer: LayerId;
  color: string | null;   // 塗る色。まだ色が無い（パレットを読み込み中）なら null
  erasing: boolean;       // けしゴム
  size: BrushSize;
  assist: boolean;        // はみださない（パーツの型で切り抜く）
}

interface Props {
  tracker: FaceTrackerHandle;
  paint: FacePaint;
  tool: PaintTool;
  mirrored: boolean;
  // 映像の実サイズと、枠からはみ出した分のずらし方（画面の位置 → 映像の位置 の変換に使う）
  frameWidth: number;
  frameHeight: number;
  panRef: React.RefObject<ViewPan>;
  // なぞり始め / なぞり終わり。hit は「顔の上をなぞれたか」
  onStrokeStart?: () => void;
  onStrokeEnd?: (hit: boolean) => void;
}

// なぞっている指がこれだけ動かなければ、別の指に替えてよい（ms）
const STALE_POINTER_MS = 600;

/**
 * 顔をなぞって塗るための、映像の上に重ねる透明な面
 * 指（またはマウス）の位置を、その瞬間の顔の点から「顔のどこか（UV）」に直してスタンプを押す。
 * 顔が動いていても、なぞった肌の場所に付く
 */
export function PaintSurface({ tracker, paint, tool, mirrored, frameWidth, frameHeight, panRef, onStrokeStart, onStrokeEnd }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // tracker そのものは状態が変わるたびに新しくなる。なぞっている途中で付け直さないよう、変わらない frameRef だけを使う
  const { frameRef } = tracker;
  const latest = useRef({ tool, mirrored, frameWidth, frameHeight, onStrokeStart, onStrokeEnd });
  latest.current = { tool, mirrored, frameWidth, frameHeight, onStrokeStart, onStrokeEnd };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let activePointer: number | null = null;
    let last: FaceUV | null = null;
    let hit = false;
    let lastEventAt = 0;

    const locate = (e: PointerEvent): FaceUV | null => {
      const frame = frameRef.current;
      if (!frame) return null;
      const { mirrored, frameWidth, frameHeight } = latest.current;
      const p = clientToFrame(el.getBoundingClientRect(), frameWidth, frameHeight, mirrored, e.clientX, e.clientY, panRef.current);
      return locateOnFace(frame.landmarks, p.x, p.y);
    };

    const apply = (e: PointerEvent) => {
      const { tool } = latest.current;
      const uv = locate(e);
      if (!uv) {
        // 顔の外に出たら線を切る（戻ってきたときに長い線でつながないように）
        last = null;
        return;
      }
      hit = true;
      if (tool.erasing) {
        const brush = eraserBrush(tool.size);
        paint.stroke(null, strokeStamps(last, uv, brush.radius), brush, '#000000', false);
      } else if (tool.color) {
        const brush = brushFor(tool.layer, tool.size, tool.assist);
        paint.stroke(tool.layer, strokeStamps(last, uv, brush.radius), brush, tool.color, tool.assist);
      }
      last = uv;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (activePointer !== null) {
        // 先に触れている指が、顔をなぞっていない（iPad を持つ親指・置いた手のひら）か、しばらく動いていない
        // （指を離したのを取りこぼした）なら、新しい指に替える。そうでなければ、なぞっている指を優先する
        if (hit && performance.now() - lastEventAt < STALE_POINTER_MS) return;
        latest.current.onStrokeEnd?.(hit);
      }
      lastEventAt = performance.now();
      activePointer = e.pointerId;
      last = null;
      hit = false;
      try { el.setPointerCapture(e.pointerId); } catch { /* 取れなくても続ける */ }
      e.preventDefault();
      const { tool } = latest.current;
      diag('なぞる: はじめ', { part: tool.layer, erasing: tool.erasing, assist: tool.assist, size: tool.size, by: e.pointerType }, 'stroke');
      latest.current.onStrokeStart?.();
      apply(e);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      e.preventDefault();
      lastEventAt = performance.now();
      // 指が速いときは、1 回のイベントにまとめられた途中の位置も使う
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      if (events.length > 0) events.forEach(apply);
      else apply(e);
    };
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      last = null;
      latest.current.onStrokeEnd?.(hit);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    return () => {
      // なぞっている途中で面が無くなったら（モードを切り替えた など）、なぞり終わりとして知らせる
      if (activePointer !== null) latest.current.onStrokeEnd?.(hit);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
    };
  }, [frameRef, paint, panRef]);

  return <div ref={ref} className="mmm-paint-surface" data-erasing={tool.erasing ? 'true' : undefined} />;
}
