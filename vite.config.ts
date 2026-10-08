import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/SagashimonoGame/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service Worker は src/sw.ts（Workbox）をビルドして dist/sw.js に出力する
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 新バージョンの適用タイミングはアプリ側で制御する（ホーム画面にいるとき自動適用）
      registerType: 'prompt',
      // 登録は src/services/pwaUpdateService.ts で行う
      injectRegister: false,
      manifestFilename: 'manifest.json',
      manifest: {
        id: BASE,
        lang: 'ja',
        name: 'あそびひろば',
        short_name: 'あそびひろば',
        description: 'あそびひろば - さがしものゲームとネジはずしゲームであそぼう！',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#1a1a2e',
        theme_color: '#4a90d9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        // JS/CSS/HTML/アイコン/パズル定義/ステージ定義は事前キャッシュ。画像（4MB超）は表示時にキャッシュ
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        globIgnores: ['**/puzzles/images/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  base: BASE,
  define: {
    // ホーム画面に表示して、実機でどのビルドが動いているか確認できるようにする
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    // three.js はネジはずしの遅延チャンクに入るため、500KB 超の警告を抑える
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
