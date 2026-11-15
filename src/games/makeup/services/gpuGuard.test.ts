import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGpuPending, defaultDelegate, forgetGpuFailure, gpuFailedBefore, markGpuPending, resolveDelegate } from './gpuGuard';

function install(userAgent: string, maxTouchPoints: number) {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
  return store;
}

const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.14 Safari/605.1.15';

describe('gpuGuard', () => {
  beforeEach(() => { install('Mozilla/5.0 (Linux; Android 14) Chrome/130', 5); });
  afterEach(() => vi.unstubAllGlobals());

  it('iPhone / iPad（Mac と名乗る iPad も）は CPU、それ以外は GPU が既定', () => {
    expect(defaultDelegate()).toBe('GPU');
    install(IPAD, 5);
    expect(defaultDelegate()).toBe('CPU');
    install('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5);
    expect(defaultDelegate()).toBe('CPU');
    // タッチできない本物の Mac は GPU
    install(IPAD, 0);
    expect(defaultDelegate()).toBe('GPU');
  });

  it('GPU の最初の推論まで終われば、次も GPU を使う', () => {
    expect(resolveDelegate('GPU')).toBe('GPU');
    markGpuPending();
    clearGpuPending();
    expect(resolveDelegate('GPU')).toBe('GPU');
    expect(gpuFailedBefore()).toBe(false);
  });

  it('GPU の途中で落ちた（印が残ったまま開き直した）ら、以後は CPU。設定で選び直すとまた GPU をためせる', () => {
    markGpuPending();
    // ここで落ちた → 開き直す
    expect(resolveDelegate('GPU')).toBe('CPU');
    expect(gpuFailedBefore()).toBe(true);
    expect(resolveDelegate('GPU')).toBe('CPU');
    expect(resolveDelegate('CPU')).toBe('CPU');
    forgetGpuFailure();
    expect(resolveDelegate('GPU')).toBe('GPU');
  });
});
