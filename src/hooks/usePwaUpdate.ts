import { useSyncExternalStore } from 'react';
import { isUpdateReady, subscribeUpdateReady } from '../services/pwaUpdateService';

// 新しいバージョンが待機中かどうか
export function usePwaUpdate(): boolean {
  return useSyncExternalStore(subscribeUpdateReady, isUpdateReady, () => false);
}
