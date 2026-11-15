/**
 * インカメラの開始・停止
 * getUserMedia の失敗理由を「許可されなかった / 無い / 使用中 / ...」に分類して、画面で案内できるようにする
 */

import { diag } from './diagnostics';

export type CameraErrorKind = 'denied' | 'notfound' | 'busy' | 'insecure' | 'unsupported' | 'unknown';

export class CameraError extends Error {
  kind: CameraErrorKind;
  constructor(kind: CameraErrorKind, cause?: unknown) {
    super(`camera: ${kind}`);
    this.name = 'CameraError';
    this.kind = kind;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

// 4:3 で頼む: インカメラのセンサーは 4:3 なので、16:9（上下を切り落とす）より広く写り、近づいても顔が枠から出にくい。
// 端末が応じられない（OverconstrainedError）ときは条件を緩める
const CONSTRAINT_ATTEMPTS: MediaStreamConstraints[] = [
  { video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false },
  { video: { facingMode: 'user' }, audio: false },
  { video: true, audio: false },
];

// 開発用: 小さい解像度（落ちる原因の切り分け）
const LOW_RES_ATTEMPTS: MediaStreamConstraints[] = [
  { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
  { video: true, audio: false },
];

export interface CameraOptions {
  lowRes?: boolean;
}

export function isCameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
}

export function classifyCameraError(err: unknown): CameraErrorKind {
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'notfound';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
    default:
      return 'unknown';
  }
}

export async function startCamera(options: CameraOptions = {}): Promise<MediaStream> {
  if (!isCameraSupported()) {
    throw new CameraError(typeof window !== 'undefined' && window.isSecureContext === false ? 'insecure' : 'unsupported');
  }
  let lastError: unknown = null;
  for (const constraints of options.lowRes ? LOW_RES_ATTEMPTS : CONSTRAINT_ATTEMPTS) {
    try {
      diag('カメラ: たのむ', constraints.video);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const settings = stream.getVideoTracks()[0]?.getSettings?.();
      diag('カメラ: はじまった', settings ? { w: settings.width, h: settings.height, fps: settings.frameRate, facing: settings.facingMode } : undefined);
      return stream;
    } catch (err) {
      diag('カメラ: しっぱい', (err as { name?: string } | null)?.name ?? String(err));
      lastError = err;
      // 条件を緩めれば通る見込みがあるのは OverconstrainedError だけ。それ以外はそのまま失敗にする
      if ((err as { name?: string } | null)?.name !== 'OverconstrainedError') {
        throw new CameraError(classifyCameraError(err), err);
      }
    }
  }
  throw new CameraError(classifyCameraError(lastError), lastError);
}

export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* 既に止まっている */ }
  }
}
