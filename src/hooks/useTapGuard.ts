import { useEffect, useState } from 'react';

/**
 * 画面が切り替わった直後の連打を無視するための待ち時間
 * 出てすぐはボタンを押せないようにして、前の画面を連打していた指が次の画面を押してしまうのを防ぐ
 */
export const TAP_GUARD_MS = 900;

export function useTapGuard(ms: number = TAP_GUARD_MS, resetKey: unknown = null): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms, resetKey]);
  return ready;
}
