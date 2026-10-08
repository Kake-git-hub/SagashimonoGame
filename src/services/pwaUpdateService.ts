/**
 * PWA の自動アップデート
 * - 起動時・アプリが前面に戻ったとき・1 時間ごとに新しいビルドが無いか確認する
 * - 新しい Service Worker が待機状態になったら updateReady にして、アプリ側が適用する
 *   （ゲームの途中で突然リロードしないよう、適用はホーム画面にいるときに行う）
 * - 適用 = 待機中の Service Worker に SKIP_WAITING を送り、制御が切り替わったらリロード
 *
 * Service Worker 本体は src/sw.ts（vite-plugin-pwa がビルドして dist/sw.js に出力）
 */

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

type Listener = () => void;

let initialized = false;
let updateReady = false;
let waitingWorker: ServiceWorker | null = null;
let applying = false;
let refreshing = false;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

function markUpdateReady(worker: ServiceWorker): void {
  waitingWorker = worker;
  updateReady = true;
  notify();
}

// インストール中の Service Worker を見張り、待機状態になったら知らせる
function watchInstalling(worker: ServiceWorker | null): void {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    // controller が無い = 初回インストール。更新ではないので何もしない
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      markUpdateReady(worker);
    }
  });
}

async function register(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  try {
    const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });

    // 前回適用しなかった更新が待機していることもある
    if (registration.waiting && navigator.serviceWorker.controller) {
      markUpdateReady(registration.waiting);
    }
    watchInstalling(registration.installing);
    registration.addEventListener('updatefound', () => watchInstalling(registration.installing));

    const check = () => {
      registration.update().catch(() => {
        // オフライン時などは無視して次回に確認する
      });
    };
    window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  } catch (error) {
    console.warn('Service Worker の登録に失敗しました:', error);
  }
}

export function initPwaUpdates(): void {
  if (initialized || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  initialized = true;
  // 開発サーバーには sw.js が無い
  if (import.meta.env.DEV) return;

  // 適用中に新しい Service Worker が制御を取ったら、新しいビルドで読み直す
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applying || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', () => register(), { once: true });
  }
}

export function isUpdateReady(): boolean {
  return updateReady;
}

export function subscribeUpdateReady(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// 待機中の新バージョンを有効化する（制御が切り替わるとリロードされる）
export function applyPwaUpdate(): void {
  if (!waitingWorker) return;
  applying = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}
