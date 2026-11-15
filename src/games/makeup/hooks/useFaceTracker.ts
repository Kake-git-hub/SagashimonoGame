import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaceFrame, FaceStatus, Delegate, TrackerLoadState } from '../types';
import { FaceTracker, FrameSource, loadFaceTracker } from '../services/faceTracker';
import { FrameHolder, smoothLandmarks } from '../logic/smoothing';
import { classifyStatus, faceBounds } from '../logic/pose';
import { diag } from '../services/diagnostics';
import { clearGpuPending } from '../services/gpuGuard';
import { initialCloseRange, nextCloseRange, paddedLayout, unpadLandmarks } from '../logic/closeRange';
import {
  INFERENCE_REST_MAX_MS, INFERENCE_REST_RATIO, PHOTO_INFERENCE_INTERVAL_MS, SLOW_INFERENCE_MS, SMOOTHING_ALPHA, STATUS_THRESHOLDS,
} from '../constants';

export interface TrackerStats {
  fps: number;           // 推論した回数 / 秒
  inferenceMs: number;   // 直近の平均推論時間
  delegate: Delegate | null;
  skipping: boolean;     // 推論が遅く、フレームを間引いているか
  padded: boolean;       // 近いとき用の「余白つき」で認識しているか
}

export interface FaceTrackerHandle {
  loadState: TrackerLoadState;
  status: FaceStatus;
  stats: TrackerStats;
  // 最新のフレーム（描画側はこれを読む。React の再描画は伴わない）
  frameRef: React.RefObject<FaceFrame | null>;
  // 新しいフレームが来るたびに呼ばれる購読。描画の canvas が使う
  subscribe: (listener: (frame: FaceFrame | null) => void) => () => void;
  reload: () => void;
}

interface Options {
  enabled: boolean;
  delegate: Delegate;
  // 今のフレームの元（video か img）。無ければ null
  getSource: () => FrameSource | null;
}

// 開発用の記録: 最初のこの回数だけ推論の前後を残し、そのあとは BEAT_MS ごとに状態を残す
const EARLY_DETECTS = 3;
const BEAT_MS = 5000;

// 映像の時刻（currentTime）が変わらなくても、これだけ経ったら推論する（ms）
const STALE_VIDEO_TIME_MS = 120;

function sourceReady(el: FrameSource): boolean {
  if (el instanceof HTMLVideoElement) return el.readyState >= 2 && el.videoWidth > 0;
  if (el instanceof HTMLImageElement) return el.complete && el.naturalWidth > 0;
  return el.width > 0;
}

function sourceSize(el: FrameSource): { w: number; h: number } {
  if (el instanceof HTMLVideoElement) return { w: el.videoWidth, h: el.videoHeight };
  if (el instanceof HTMLImageElement) return { w: el.naturalWidth, h: el.naturalHeight };
  return { w: el.width, h: el.height };
}

/**
 * 顔認識のループ
 * - 読み込み（進捗つき）→ 映像のコマが変わるたびに推論 → 平滑化 → 状態判定
 * - 推論は同期処理なので、かかった時間に応じて次の推論までの休みを入れ、画面の操作が詰まらないようにする
 * - 近づいて顔が映像いっぱいになったら、余白を足した絵で認識する（logic/closeRange.ts）
 * - 顔が見つからない間も少しのあいだ直前の結果を使う
 * - 明るさは 0.5 秒ごとに顔のあたりを小さな canvas に写して測る
 */
export function useFaceTracker({ enabled, delegate, getSource }: Options): FaceTrackerHandle {
  const [loadState, setLoadState] = useState<TrackerLoadState>({ phase: 'idle' });
  const [status, setStatus] = useState<FaceStatus>('none');
  const [stats, setStats] = useState<TrackerStats>({ fps: 0, inferenceMs: 0, delegate: null, skipping: false, padded: false });
  const [reloadCount, setReloadCount] = useState(0);
  const trackerRef = useRef<FaceTracker | null>(null);
  const frameRef = useRef<FaceFrame | null>(null);
  const listenersRef = useRef(new Set<(frame: FaceFrame | null) => void>());
  const getSourceRef = useRef(getSource);
  getSourceRef.current = getSource;

  const subscribe = useCallback((listener: (frame: FaceFrame | null) => void) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const reload = useCallback(() => setReloadCount(c => c + 1), []);

  // 読み込み
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoadState({ phase: 'downloading', loaded: 0, total: 1 });
    loadFaceTracker(delegate, {
      onProgress: (loaded, total) => { if (!cancelled) setLoadState({ phase: 'downloading', loaded, total }); },
      onStarting: () => { if (!cancelled) setLoadState({ phase: 'starting' }); },
    })
      .then(tracker => {
        if (cancelled) { tracker.close(); return; }
        trackerRef.current = tracker;
        setStats(s => ({ ...s, delegate: tracker.delegate }));
        setLoadState({ phase: 'ready' });
      })
      .catch(err => {
        diag('にんしき: よみこみ しっぱい', err);
        console.error('FaceLandmarker load failed', err);
        if (!cancelled) setLoadState({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
      // 推論まで行かずに画面を離れたときは、落ちたわけではないので印を消す
      clearGpuPending();
      trackerRef.current?.close();
      trackerRef.current = null;
      frameRef.current = null;
    };
  }, [enabled, delegate, reloadCount]);

  // 推論ループ
  useEffect(() => {
    if (!enabled || loadState.phase !== 'ready') return;
    let raf = 0;
    let stopped = false;
    let prevLandmarks: FaceFrame['landmarks'] | null = null;
    const holder = new FrameHolder<FaceFrame>(STATUS_THRESHOLDS.holdLastMs);
    let nextAllowedAt = 0;
    let lastVideoTime = -1;
    let lastSource: FrameSource | null = null;
    let lastDetectAt = 0;
    let closeRange = initialCloseRange();
    let detectCount = 0;
    let lastBeatAt = performance.now();
    const startedAt = lastBeatAt;
    let avgMs = 0;
    let count = 0;
    let windowStart = performance.now();
    let lastLumaAt = 0;
    let luma: number | null = null;
    let lastStatus: FaceStatus | null = null;
    const lumaCanvas = document.createElement('canvas');
    lumaCanvas.width = 32;
    lumaCanvas.height = 32;
    const lumaCtx = lumaCanvas.getContext('2d', { willReadFrequently: true });

    const measureLuma = (el: FrameSource, frame: FaceFrame | null) => {
      if (!lumaCtx) return;
      const { w, h } = sourceSize(el);
      let sx = 0, sy = 0, sw = w, sh = h;
      if (frame) {
        // 近いときは顔が映像からはみ出すので、映像の中に収める
        const b = faceBounds(frame.landmarks);
        const x0 = Math.max(0, b.minX), y0 = Math.max(0, b.minY), x1 = Math.min(1, b.maxX), y1 = Math.min(1, b.maxY);
        sx = x0 * w; sy = y0 * h; sw = Math.max(1, (x1 - x0) * w); sh = Math.max(1, (y1 - y0) * h);
      }
      try {
        lumaCtx.drawImage(el, sx, sy, sw, sh, 0, 0, 32, 32);
        const data = lumaCtx.getImageData(0, 0, 32, 32).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        luma = sum / (data.length / 4);
      } catch {
        luma = null;
      }
    };

    // 近いとき用: 映像のまわりに黒い余白を足した絵（1 枚だけ作って使い回す）
    const padCanvas = document.createElement('canvas');
    const padCtx = padCanvas.getContext('2d', { alpha: false });
    const drawPadded = (el: FrameSource): HTMLCanvasElement | null => {
      if (!padCtx) return null;
      const { w, h } = sourceSize(el);
      const layout = paddedLayout(w, h);
      if (padCanvas.width !== layout.width || padCanvas.height !== layout.height) {
        padCanvas.width = layout.width;
        padCanvas.height = layout.height;
        padCtx.fillStyle = '#000';
        padCtx.fillRect(0, 0, layout.width, layout.height);
      }
      try {
        padCtx.drawImage(el, layout.x, layout.y, layout.contentW, layout.contentH);
      } catch {
        return null;
      }
      return padCanvas;
    };

    const tick = () => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const tracker = trackerRef.current;
      const el = getSourceRef.current();
      if (!tracker || !el || !sourceReady(el) || document.hidden) return;

      const now = performance.now();
      if (now < nextAllowedAt) return;
      // 同じコマを何度も推論しない（120Hz の画面では、カメラの 1 コマの間に何度も呼ばれる）
      if (el !== lastSource) {
        lastSource = el;
        lastVideoTime = -1;
        lastDetectAt = 0;
      }
      if (el instanceof HTMLVideoElement) {
        // 映像の時刻が進まないブラウザでも止まらないよう、しばらく変わらなければ推論する
        if (el.currentTime === lastVideoTime && now - lastDetectAt < STALE_VIDEO_TIME_MS) return;
        lastVideoTime = el.currentTime;
      } else if (now - lastDetectAt < PHOTO_INFERENCE_INTERVAL_MS) {
        return;
      }
      lastDetectAt = now;

      const padded = closeRange.padded ? drawPadded(el) : null;
      let detected: FaceFrame | null = null;
      // 最初の数回は、推論の前後を記録する（推論の中で落ちたら「まえ」で記録が終わる）
      const early = detectCount < EARLY_DETECTS;
      if (early) diag(`すいろん ${detectCount + 1} かいめ: まえ`, { ...sourceSize(el), padded: !!padded, kind: el.tagName });
      try {
        detected = tracker.detect(padded ?? el, now);
      } catch (err) {
        if (detectCount < 20) diag('すいろん: しっぱい', err);
        detectCount++;
        console.warn('detect failed', err);
        return;
      }
      const ended = performance.now();
      const ms = ended - now;
      if (early) diag(`すいろん ${detectCount + 1} かいめ: おわり`, { ms: Math.round(ms), face: !!detected });
      // 最初の推論が無事に終わった: GPU でも固まらない端末
      if (detectCount === 0) clearGpuPending();
      detectCount++;
      avgMs = avgMs === 0 ? ms : avgMs * 0.9 + ms * 0.1;
      nextAllowedAt = ended + Math.min(INFERENCE_REST_MAX_MS, avgMs * INFERENCE_REST_RATIO);
      count++;

      const { w, h } = sourceSize(el);
      if (detected && padded) detected = { ...detected, landmarks: unpadLandmarks(detected.landmarks) };
      // 次のコマを余白つきで認識するか（平滑化の前の、今のコマの結果で決める）
      const wasPadded = closeRange.padded;
      closeRange = nextCloseRange(closeRange, detected?.landmarks ?? null, w / h, now);
      if (closeRange.padded !== wasPadded) diag(closeRange.padded ? 'ちかい: よはくつきに する' : 'ちかい: もとに もどす');

      if (detected) {
        detected = { ...detected, landmarks: smoothLandmarks(prevLandmarks, detected.landmarks, SMOOTHING_ALPHA) };
        prevLandmarks = detected.landmarks;
      } else {
        prevLandmarks = null;
      }
      const frame = holder.update(detected, now);
      frameRef.current = frame;
      listenersRef.current.forEach(l => l(frame));

      if (now - lastLumaAt > 500) {
        lastLumaAt = now;
        measureLuma(el, frame);
      }
      const next = classifyStatus({ landmarks: frame?.landmarks ?? null, aspect: w / h, luma });
      if (next !== lastStatus) {
        lastStatus = next;
        setStatus(next);
      }
      if (now - windowStart >= 1000) {
        const fps = (count * 1000) / (now - windowStart);
        setStats(s => ({ ...s, fps: Math.round(fps), inferenceMs: Math.round(avgMs), skipping: avgMs > SLOW_INFERENCE_MS, padded: closeRange.padded }));
        count = 0;
        windowStart = now;
      }
      // 5 秒ごとに状態を残す（同じ行を上書きしていくので、落ちる直前の状態が最後に残る）
      if (now - lastBeatAt >= BEAT_MS) {
        lastBeatAt = now;
        diag('じょうたい', {
          sec: Math.round((now - startedAt) / 1000), detects: detectCount, ms: Math.round(avgMs), face: lastStatus, padded: closeRange.padded, size: `${w}x${h}`,
        }, 'beat');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      // canvas のメモリをすぐ返す
      padCanvas.width = 0;
      padCanvas.height = 0;
      lumaCanvas.width = 0;
      lumaCanvas.height = 0;
    };
  }, [enabled, loadState.phase]);

  // 止まったら表示も消す
  useEffect(() => {
    if (enabled) return;
    frameRef.current = null;
    setStatus('none');
    listenersRef.current.forEach(l => l(null));
  }, [enabled]);

  // 同じ中身なら同じオブジェクトを返す（これを依存に持つ描画側の effect が、再描画のたびに作り直されないように）
  return useMemo(() => ({ loadState, status, stats, frameRef, subscribe, reload }), [loadState, status, stats, subscribe, reload]);
}
