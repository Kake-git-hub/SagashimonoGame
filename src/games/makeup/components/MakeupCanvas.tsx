import { useEffect, useRef } from 'react';
import { LAYER_SPEC, LookState } from '../logic/layers';
import { FaceTrackerHandle } from '../hooks/useFaceTracker';
import { FrameSource } from '../services/faceTracker';
import { FaceFrame } from '../types';
import { FacePaint } from './facePaint';
import { MakeupRenderer, RenderLayer } from './makeupRenderer';
import { diag } from '../services/diagnostics';

// 親（ミラー画面）が保存やテストに使う窓口
export interface MakeupView {
  // いま見えている絵（鏡像なら左右反転）を新しい canvas に描く
  capture(mirrored: boolean): HTMLCanvasElement | null;
  // 直前に映像とメイクを描いたか
  readonly lastDrew: boolean;
}

interface Props {
  tracker: FaceTrackerHandle;
  paint: FacePaint;
  look: LookState;          // パーツごとの つよさ を読む
  hidden: boolean;          // くらべる を押している間は描かない
  width: number;
  height: number;
  getSource: () => FrameSource | null;
  disabled?: boolean;       // 開発用: メイクの描画（WebGL）を動かさない
  viewRef: React.MutableRefObject<MakeupView | null>;
}

function sourceReady(el: FrameSource): boolean {
  if (el instanceof HTMLVideoElement) return el.readyState >= 2 && el.videoWidth > 0;
  if (el instanceof HTMLImageElement) return el.complete && el.naturalWidth > 0;
  return el.width > 0;
}

/**
 * メイクの描画 canvas。映像の上に重なり、塗ったものがあるときだけ映像ごと描く。
 * 描き直すのは「映像のコマ・顔の点・塗った絵・つよさ」のどれかが変わったときだけ（120Hz の画面で無駄に描かない）
 */
export function MakeupCanvas({ tracker, paint, look, hidden, width, height, getSource, disabled = false, viewRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // tracker そのものは状態（はやさ など）が変わるたびに新しくなるので、変わらない frameRef だけを依存にする
  const { frameRef } = tracker;
  const lookRef = useRef(look);
  const hiddenRef = useRef(hidden);
  lookRef.current = look;
  hiddenRef.current = hidden;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: MakeupRenderer | null = null;
    if (disabled) {
      diag('びょうが: つかわない（しらべる）');
    } else {
      try {
        diag('びょうが: つくる まえ', { w: width, h: height });
        renderer = new MakeupRenderer(canvas, paint.edgeFeather());
        diag('びょうが: できた');
      } catch (err) {
        // WebGL が使えない端末: メイクは出せないが、映像と保存はそのまま使える
        diag('びょうが: つくれなかった', err);
        console.warn('makeup renderer unavailable', err);
      }
    }
    let drewOnce = false;

    const layersNow = (): RenderLayer[] => paint.paintedLayers().map(id => {
      const spec = LAYER_SPEC[id];
      const opacity = lookRef.current[id]?.opacity ?? spec.defaultOpacity;
      return {
        id,
        canvas: paint.layerCanvas(id)!,
        version: paint.layerVersion(id),
        alpha: Math.max(0, Math.min(1, opacity)) * spec.maxAlpha,
        blend: spec.blend,
        tint: spec.tint,
      };
    });

    const draw = (): boolean => {
      if (!renderer) return false;
      const source = getSource();
      const frame = frameRef.current;
      const layers = layersNow();
      const first = !drewOnce && layers.length > 0 && !!frame;
      if (first) diag('びょうが: さいしょの 1 まい まえ', { layers: layers.map(l => l.id) });
      const drew = renderer.render(source && sourceReady(source) ? source : null, frame?.landmarks ?? null, layers, hiddenRef.current);
      if (first) {
        drewOnce = true;
        diag('びょうが: さいしょの 1 まい おわり', { drew });
      }
      return drew;
    };

    viewRef.current = {
      capture(mirrored) {
        const source = getSource();
        if (!source || !sourceReady(source)) return null;
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const ctx = out.getContext('2d');
        if (!ctx) return null;
        if (mirrored) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        // WebGL の canvas は描いた直後でないと読めないので、ここで描き直してから写す
        if (draw() && renderer) ctx.drawImage(renderer.output, 0, 0, width, height);
        else ctx.drawImage(source, 0, 0, width, height);
        return out;
      },
      get lastDrew() { return renderer?.lastDrew ?? false; },
    };

    // コンテキストが失われたとき（裏に回った・メモリが足りない）: 戻ったら作り直す
    const onLost = (e: Event) => {
      diag('びょうが: WebGL が うしなわれた');
      e.preventDefault();
      renderer?.contextLost();
    };
    const onRestored = () => {
      diag('びょうが: WebGL が もどった');
      try {
        renderer?.init();
      } catch (err) {
        console.warn('makeup renderer restore failed', err);
      }
      lastKey = '';
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    let raf = 0;
    let lastKey = '';
    let lastFrame: FaceFrame | null = null;
    let lastLook: LookState | null = null;
    let lastDrawAt = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!renderer || document.hidden) return;
      const source = getSource();
      const frame = frameRef.current;
      const time = source instanceof HTMLVideoElement ? source.currentTime : 0;
      const key = `${time}|${paint.version}|${hiddenRef.current ? 1 : 0}`;
      const now = performance.now();
      // カメラの映像は、時刻が進まないブラウザでも止まって見えないよう、ときどきは描き直す
      const stale = source instanceof HTMLVideoElement && renderer.lastDrew && now - lastDrawAt > 100;
      if (key === lastKey && frame === lastFrame && lookRef.current === lastLook && !stale) return;
      lastDrawAt = now;
      lastKey = key;
      lastFrame = frame;
      lastLook = lookRef.current;
      draw();
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      viewRef.current = null;
      renderer?.dispose();
    };
    // width / height が変わると canvas の中身が消えるので、描画も作り直す
  }, [frameRef, paint, getSource, viewRef, width, height, disabled]);

  // 画面を離れるとき: WebGL のコンテキストを手放す（iOS は同時に持てる数が少なく、放っておくと溜まる）。
  // 少し待ってから行い、すぐ付け直されたとき（開発時の StrictMode）は取りやめる
  const releaseTimer = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    window.clearTimeout(releaseTimer.current);
    return () => {
      releaseTimer.current = window.setTimeout(() => {
        const gl = canvas?.getContext('webgl');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      }, 0);
    };
  }, []);

  return <canvas ref={canvasRef} className="mmm-overlay mmm-makeup" width={width} height={height} aria-hidden="true" />;
}
