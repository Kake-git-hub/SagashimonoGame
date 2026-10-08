import { useSyncExternalStore } from 'react';
import { getLastUpdateCheck, isUpdateReady, subscribeUpdateReady, UpdateCheckResult } from '../services/pwaUpdateService';

// 新しいバージョンが待機中かどうか
export function usePwaUpdate(): boolean {
  return useSyncExternalStore(subscribeUpdateReady, isUpdateReady, () => false);
}

// 直近の更新確認の結果（ホーム画面の表示用）
export function usePwaUpdateCheck(): UpdateCheckResult | null {
  return useSyncExternalStore(subscribeUpdateReady, getLastUpdateCheck, () => null);
}
