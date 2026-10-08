# CLAUDE.md — あそびひろば 開発メモ

このリポジトリで作業する前に **`開発ルール.md` を必ず読む**（push のルール・ビルド確認・保存データの扱い）。

## 何のリポジトリか

子ども向けミニゲームを集めた PWA「あそびひろば」。GitHub Pages で公開（`https://kake-git-hub.github.io/SagashimonoGame/`）。

| ゲーム | 場所 | 概要 |
|---|---|---|
| さがしものゲーム | `src/games/sagashimono/` + `src/components/` + `src/services/` | 「ミッケ」風のもの探し。パズルエディタと GitHub へのアップロード機能あり |
| ネジはずし | `src/games/neji/` | 3D 図形のネジをタップで外し、色ごとのボックスに集めるパズル。詳細は `docs/ネジはずし開発ガイド.md` |

共通部分: `src/App.tsx`（ホーム/各ゲームの薄いルーター）、`src/screens/HomeScreen.tsx`、`src/services/pwaUpdateService.ts`（PWA 自動更新）、`src/sw.ts`（Service Worker）。

## よく使うコマンド

```bash
npm run dev            # 開発サーバー（Service Worker は動かない）
npm run build          # tsc -b && vite build（型エラーで落ちる）
npm run lint           # eslint
npm test               # vitest: ロジックの単体テスト + 全ステージ検証
npm run validate:neji  # ステージ JSON の検証だけ
npm run preview        # dist を配信（PWA の動作確認はこちら）
bash scripts/e2e/run.sh neji-smoke   # ヘッドレス Chromium で実際に遊んで確認（scripts/e2e/README.md）
```

push 前に `npm run build` / `npm run lint` / `npm test` を通す。CI（`.github/workflows/deploy.yml`）も同じ順で実行し、`main` に push されると GitHub Pages へデプロイされる。

## 作業の流れ

1. 作業ブランチで開発し、ビルド・lint・テストを通して push
2. 実機（iPad / iPhone）で確認してもらうときは `main` へ fast-forward マージ → 自動デプロイ（2〜3 分）
3. 公開中の PWA は、次の起動時か前面復帰時に新ビルドを検知し、ホーム画面にいるときに自動で切り替わる。ホーム画面下の「バージョン: 日時」がビルド日時

## 守ること

- 既存ユーザーのデータを壊さない: localStorage のキー接頭辞（`sagashimono_` / `neji_`）と IndexedDB 名 `sagashimono_db` は変えない
- リポジトリ名と `base: '/SagashimonoGame/'` は変えない（PWA の登録パスが壊れる）
- `public/sw.js` / `public/manifest.json` は作らない（ビルドで生成される。manifest は `vite.config.ts` で編集）
- ホーム画面など軽い画面から three.js に依存するモジュールを import しない（`src/games/neji/logic/geometry.ts` 等）。ネジはずしは `React.lazy` で別チャンクにしてある
- ネジはずしのステージ JSON を追加・変更したら `npm run validate:neji` を通す。検証を弱めてごまかさない（解けないステージを配布しないための仕組み）
- UI の文言は子ども向けのひらがな中心（「よみこみちゅう」「おめでとう！」など既存の調子に合わせる）

## 資料

- `開発ルール.md` — 必読ルール
- `README.md` — あそびかた、ステージ JSON の形式、ディレクトリ構成
- `docs/ネジはずし開発ガイド.md` — ネジはずしの内部構造・データの流れ・拡張レシピ・改良候補
- `docs/ネジはずしゲーム計画.md` — 当初の計画と、計画との差分メモ
- `scripts/e2e/README.md` — ヘッドレスブラウザでの動作確認スクリプト
