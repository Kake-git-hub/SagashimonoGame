/// <reference lib="webworker" />
/**
 * Service Worker（Workbox）
 * - ビルド成果物を事前キャッシュしてオフラインでも起動できるようにする
 * - 新しいビルドが公開されると「待機中」になり、アプリ側（pwaUpdateService）の合図で切り替わる
 */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Workbox 移行前の手書き Service Worker が作ったキャッシュ
const LEGACY_CACHES = ['sagashimono-v1', 'asobihiroba-v2'];

// アプリ側から「待機中の新バージョンを有効化して」と言われたら切り替える
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all(LEGACY_CACHES.map(name => caches.delete(name))));
});

// ビルド時に差し込まれる事前キャッシュ一覧（JS/CSS/HTML/アイコン/定義 JSON）
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// 画面遷移はすべて事前キャッシュした index.html で応える（オフライン起動用）
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// パズル画像は大きいので事前キャッシュせず、表示したものを保存する
registerRoute(
  ({ url }) => url.pathname.includes('/puzzles/images/'),
  new CacheFirst({
    cacheName: 'puzzle-images',
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 })],
  }),
);
