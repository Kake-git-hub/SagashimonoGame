/**
 * GPU での顔認識が固まる端末への備え
 *
 * 実機（iPad、iOS 17、ホーム画面 PWA）の記録で、GPU での「最初の 1 回の推論」に入ったまま戻らず、
 * 15〜35 秒後にブラウザごと落ちることが分かった（5 回中 5 回、同じ場所）。推論は同期処理なので、
 * 固まると画面も触れず、あとから CPU へ切り替えることもできない。そこで:
 * - iPhone / iPad では、はじめから CPU を使う（設定で GPU を選び直すことはできる）
 * - GPU を使うときは、作る前に「GPU を ためしている」印を端末に残し、最初の推論が終わったら消す。
 *   印が残ったまま次に開かれたら、前回は GPU の途中で落ちたということなので、以後は CPU を使う
 */
import { Delegate } from '../types';
import { diag } from './diagnostics';

const PENDING_KEY = 'makeup_gpu_pending';
const FAILED_KEY = 'makeup_gpu_failed';

function get(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function set(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // 保存できなくても続ける
  }
}

// iPhone / iPad か（iPad は Mac と名乗るので、タッチできる Mac も含める）
export function isAppleTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

// 設定で選んでいないときの既定
export function defaultDelegate(): Delegate {
  return isAppleTouchDevice() ? 'CPU' : 'GPU';
}

// GPU が前に固まった端末か
export function gpuFailedBefore(): boolean {
  return get(FAILED_KEY);
}

/**
 * 実際に使うやり方を決める。GPU を選んでいても、前に GPU の途中で落ちていたら CPU にする
 */
export function resolveDelegate(wanted: Delegate): Delegate {
  if (wanted !== 'GPU') return wanted;
  if (get(PENDING_KEY)) {
    // 印が残っている = 前回、GPU を作るところ〜最初の推論の間に落ちた
    set(PENDING_KEY, false);
    set(FAILED_KEY, true);
    diag('GPU: まえに とちゅうで おちたので、これからは CPU を つかう');
  }
  return get(FAILED_KEY) ? 'CPU' : 'GPU';
}

// GPU を作る直前に呼ぶ
export function markGpuPending(): void {
  set(PENDING_KEY, true);
}

// GPU での最初の推論が終わった / GPU を使わずに画面を離れた ときに呼ぶ
export function clearGpuPending(): void {
  if (get(PENDING_KEY)) set(PENDING_KEY, false);
}

// 設定で GPU を選び直したとき: もう一度 GPU をためせるようにする
export function forgetGpuFailure(): void {
  set(FAILED_KEY, false);
  set(PENDING_KEY, false);
}
