/**
 * 顔認識（MediaPipe Face Landmarker）の読み込みと実行
 * ライブラリに依存するのはこのファイルだけにして、差し替えられるようにしておく
 *
 * - wasm はビルドに同梱（パッケージの exports が公開しているファイルを Vite の ?url で取り込み、ハッシュ付きの URL になる）。
 *   SIMD の有無で使うファイルを選ぶ
 * - 大きなファイル（wasm 約 14MB、モデル約 4MB）は進捗を出しながら自分で fetch し、
 *   wasm は Blob URL、モデルはバッファとして渡す（二重ダウンロードを避ける）
 */
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import simdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import simdWasmUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import nosimdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url';
import nosimdWasmUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url';
import { Delegate, FaceFrame } from '../types';

export const MODEL_URL = `${import.meta.env.BASE_URL}makeup/models/face_landmarker.task`;

// Content-Length が取れないとき（圧縮配信など）の進捗表示用の目安
const APPROX_WASM_BYTES = 14_500_000;
const APPROX_MODEL_BYTES = 3_760_000;

export type FrameSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

export interface FaceTracker {
  readonly delegate: Delegate;
  // 1 フレーム処理する。顔が無ければ null。timestampMs は単調増加であること
  detect(source: FrameSource, timestampMs: number): FaceFrame | null;
  close(): void;
}

export interface LoadCallbacks {
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
  onStarting?: () => void;
}

async function fetchWithProgress(url: string, onChunk: (bytes: number, total: number | null) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${url}`);
  const lengthHeader = res.headers.get('Content-Length');
  const total = lengthHeader ? parseInt(lengthHeader, 10) : null;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onChunk(buf.byteLength, total);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onChunk(value.byteLength, total);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

let cachedWasm: { loaderUrl: string; blobUrl: string } | null = null;
let cachedModel: Uint8Array | null = null;

/**
 * 顔認識を用意する。GPU で失敗したら CPU で作り直す
 */
export async function loadFaceTracker(delegate: Delegate, callbacks: LoadCallbacks = {}): Promise<FaceTracker> {
  const simd = await FilesetResolver.isSimdSupported();
  const loaderUrl = simd ? simdLoaderUrl : nosimdLoaderUrl;
  const wasmUrl = simd ? simdWasmUrl : nosimdWasmUrl;

  // 進捗: wasm とモデルの合計で出す
  const totals: Record<string, number> = { wasm: cachedWasm ? 0 : APPROX_WASM_BYTES, model: cachedModel ? 0 : APPROX_MODEL_BYTES };
  const loaded: Record<string, number> = { wasm: 0, model: 0 };
  const report = () => {
    const total = totals.wasm + totals.model;
    const done = Math.min(total, loaded.wasm + loaded.model);
    callbacks.onProgress?.(done, total);
  };
  report();

  if (!cachedWasm) {
    const bytes = await fetchWithProgress(wasmUrl, (n, total) => {
      if (total) totals.wasm = total;
      loaded.wasm += n;
      report();
    });
    cachedWasm = { loaderUrl, blobUrl: URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/wasm' })) };
  }
  if (!cachedModel) {
    cachedModel = await fetchWithProgress(MODEL_URL, (n, total) => {
      if (total) totals.model = total;
      loaded.model += n;
      report();
    });
  }
  callbacks.onStarting?.();

  const fileset = { wasmLoaderPath: cachedWasm.loaderUrl, wasmBinaryPath: cachedWasm.blobUrl };
  const create = (d: Delegate) => FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: cachedModel!, delegate: d },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
  });

  let landmarker: FaceLandmarker;
  let used: Delegate = delegate;
  try {
    landmarker = await create(delegate);
  } catch (err) {
    if (delegate === 'CPU') throw err;
    console.warn('FaceLandmarker: GPU failed, falling back to CPU', err);
    used = 'CPU';
    landmarker = await create('CPU');
  }

  let lastTs = -1;
  return {
    delegate: used,
    detect(source, timestampMs) {
      // タイムスタンプは単調増加でなければならない
      const ts = timestampMs <= lastTs ? lastTs + 1 : timestampMs;
      lastTs = ts;
      const result = landmarker.detectForVideo(source, ts);
      const face = result.faceLandmarks[0];
      if (!face || face.length === 0) return null;
      const blendshapes: Record<string, number> = {};
      const categories = result.faceBlendshapes[0]?.categories;
      if (categories) {
        for (const c of categories) blendshapes[c.categoryName] = c.score;
      }
      return {
        landmarks: face.map(p => ({ x: p.x, y: p.y, z: p.z })),
        blendshapes,
        timestamp: ts,
      };
    },
    close() {
      landmarker.close();
    },
  };
}
