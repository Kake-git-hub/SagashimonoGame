import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceFrame, FaceStatus, Delegate, TrackerLoadState } from '../types';
import { FaceTracker, FrameSource, loadFaceTracker } from '../services/faceTracker';
import { FrameHolder, smoothLandmarks } from '../logic/smoothing';
import { classifyStatus, faceBounds } from '../logic/pose';
import { SLOW_INFERENCE_MS, SMOOTHING_ALPHA, STATUS_THRESHOLDS } from '../constants';

export interface TrackerStats {
  fps: number;           // 推論した回数 / 秒
  inferenceMs: number;   // 直近の平均推論時間
  delegate: Delegate | null;
  skipping: boolean;     // フレームを間引いているか
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
 * - 読み込み（進捗つき）→ requestAnimationFrame ごとに推論 → 平滑化 → 状態判定
 * - 推論が遅いときはフレームを間引く。顔が見つからない間も少しのあいだ直前の結果を使う
 * - 明るさは 0.5 秒ごとに顔のあたりを小さな canvas に写して測る
 */
export function useFaceTracker({ enabled, delegate, getSource }: Options): FaceTrackerHandle {
  const [loadState, setLoadState] = useState<TrackerLoadState>({ phase: 'idle' });
  const [status, setStatus] = useState<FaceStatus>('none');
  const [stats, setStats] = useState<TrackerStats>({ fps: 0, inferenceMs: 0, delegate: null, skipping: false });
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
        console.error('FaceLandmarker load failed', err);
        if (!cancelled) setLoadState({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
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
    let skipNext = false;
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
        const b = faceBounds(frame.landmarks);
        sx = b.minX * w; sy = b.minY * h; sw = Math.max(1, (b.maxX - b.minX) * w); sh = Math.max(1, (b.maxY - b.minY) * h);
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

    const tick = () => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const tracker = trackerRef.current;
      const el = getSourceRef.current();
      if (!tracker || !el || !sourceReady(el) || document.hidden) return;
      if (skipNext) { skipNext = false; return; }

      const now = performance.now();
      let detected: FaceFrame | null = null;
      try {
        detected = tracker.detect(el, now);
      } catch (err) {
        console.warn('detect failed', err);
        return;
      }
      const ms = performance.now() - now;
      avgMs = avgMs === 0 ? ms : avgMs * 0.9 + ms * 0.1;
      skipNext = avgMs > SLOW_INFERENCE_MS;
      count++;

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
      const { w, h } = sourceSize(el);
      const next = classifyStatus({ landmarks: frame?.landmarks ?? null, aspect: w / h, luma });
      if (next !== lastStatus) {
        lastStatus = next;
        setStatus(next);
      }
      if (now - windowStart >= 1000) {
        const fps = (count * 1000) / (now - windowStart);
        setStats(s => ({ ...s, fps: Math.round(fps), inferenceMs: Math.round(avgMs), skipping: skipNext }));
        count = 0;
        windowStart = now;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [enabled, loadState.phase]);

  // 止まったら表示も消す
  useEffect(() => {
    if (enabled) return;
    frameRef.current = null;
    setStatus('none');
    listenersRef.current.forEach(l => l(null));
  }, [enabled]);

  return { loadState, status, stats, frameRef, subscribe, reload };
}
