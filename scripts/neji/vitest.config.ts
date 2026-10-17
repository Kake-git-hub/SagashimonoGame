// ステージ生成スクリプト用の vitest 設定（npm run gen:neji）
// 生成はロジック（three.js の数学クラス）を使うので、テストと同じ実行環境で動かす
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/neji/*.gen.ts'],
    testTimeout: 600_000,
  },
});
