/**
 * インカメラの開始・停止
 * getUserMedia の失敗理由を「許可されなかった / 無い / 使用中 / ...」に分類して、画面で案内できるようにする
 */

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

// 高い解像度から順に試し、端末が応じられない（OverconstrainedError）ときは条件を緩める
const CONSTRAINT_ATTEMPTS: MediaStreamConstraints[] = [
  { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
  { video: { facingMode: 'user' }, audio: false },
  { video: true, audio: false },
];

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

export async function startCamera(): Promise<MediaStream> {
  if (!isCameraSupported()) {
    throw new CameraError(typeof window !== 'undefined' && window.isSecureContext === false ? 'insecure' : 'unsupported');
  }
  let lastError: unknown = null;
  for (const constraints of CONSTRAINT_ATTEMPTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
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
