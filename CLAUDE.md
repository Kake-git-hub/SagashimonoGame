# CLAUDE.md — あそびひろば 開発メモ

このリポジトリで作業する前に **`開発ルール.md` を必ず読む**（push のルール・ビルド確認・保存データの扱い）。

## 何のリポジトリか

子ども向けミニゲームを集めた PWA「あそびひろば」。GitHub Pages で公開（`https://kake-git-hub.github.io/SagashimonoGame/`）。

| ゲーム | 場所 | 概要 |
|---|---|---|
| さがしものゲーム | `src/games/sagashimono/` + `src/components/` + `src/services/` | 「ミッケ」風のもの探し。パズルエディタと GitHub へのアップロード機能あり |
| ネジはずし | `src/games/neji/` | 3D 図形のネジをタップで外し、色ごとのボックスに集めるパズル。詳細は `docs/ネジはずし開発ガイド.md` |

共通部分: `src/App.tsx`（プロフィール選択/ホーム/おうちのひと設定/各ゲームの薄いルーター）、`src/screens/HomeScreen.tsx`、`src/services/pwaUpdateService.ts`（PWA 自動更新）、`src/sw.ts`（Service Worker）。

プラットフォーム共通の機能（どのゲームからも使う）:

| 機能 | 場所 | 概要 |
|---|---|---|
| プロフィール（なんさい？） | `src/services/profileService.ts`, `src/screens/ProfileScreen.tsx` | 起動時に名前と年齢を登録。兄弟分を持てて、進捗はプロフィールごとに分かれる。年齢 → 難易度・クイズレベル（`difficultyForAge`） |
| べんきょうクイズ | `src/services/quizService.ts`, `src/components/quiz/QuizOverlay.tsx`, `src/hooks/useQuizGate.tsx` | 年齢に合わせた問題を生成。`useQuizGate().ask(trigger)` が「クイズに正解したら true」の Promise を返す |
| おうちのひと設定 | `src/services/appSettingsService.ts`, `src/screens/ParentSettingsScreen.tsx` | かけ算の関門の先。クイズを出す場面・レベル・科目、おたすけの回数、プロフィールの編集 |

## よく使うコマンド

```bash
npm run dev            # 開発サーバー（Service Worker は動かない）
npm run build          # tsc -b && vite build（型エラーで落ちる）
npm run lint           # eslint
npm test               # vitest: ロジックの単体テスト + 全ステージ検証
npm run validate:neji  # ステージ JSON の検証だけ
npm run preview        # dist を配信（PWA の動作確認はこちら）
bash scripts/e2e/run.sh neji-smoke   # ヘッドレス Chromium で実際に遊んで確認（scripts/e2e/README.md）
bash scripts/e2e/run.sh neji-dig     # 発掘ステージ・クイズ・おたすけ・つづきから の流れ
```

push 前に `npm run build` / `npm run lint` / `npm test` を通す。CI（`.github/workflows/deploy.yml`）も同じ順で実行し、`main` に push されると GitHub Pages へデプロイされる。

## 作業の流れ

1. 作業ブランチで開発し、ビルド・lint・テストを通して push
2. 実機（iPad / iPhone）で確認してもらうときは `main` へ fast-forward マージ → 自動デプロイ（2〜3 分）
3. 公開中の PWA は、次の起動時か前面復帰時に新ビルドを検知し、ホーム画面にいるときに自動で切り替わる。ホーム画面下の「バージョン: 日時」がビルド日時

## 守ること

- 既存ユーザーのデータを壊さない: localStorage のキー接頭辞（`sagashimono_` / `neji_`）と IndexedDB 名 `sagashimono_db` は変えない。プロフィールごとの保存は `profileStorageKey(base)` を通す（最初のプロフィールは従来キーをそのまま使い、2 人目以降は `__<id>` が付く）。プラットフォーム共通の設定は `asobi_` 接頭辞
- リポジトリ名と `base: '/SagashimonoGame/'` は変えない（PWA の登録パスが壊れる）
- `public/sw.js` / `public/manifest.json` は作らない（ビルドで生成される。manifest は `vite.config.ts` で編集）
- ホーム画面など軽い画面から three.js に依存するモジュールを import しない（`src/games/neji/logic/geometry.ts` 等）。ネジはずしは `React.lazy` で別チャンクにしてある
- ネジはずしのステージ JSON を追加・変更したら `npm run validate:neji` を通す。検証を弱めてごまかさない（解けないステージを配布しないための仕組み）。底面（`dir: [0,-1,0]`）にもネジを置く
- ネジはずしの画面は 3D を全面に敷き、HUD（ボックス・おきば・ヘッダー）を透過で重ねる。HUD の位置は `neji.css` の `@media (orientation: landscape)` で切り替え、`NejiGameScreen` が HUD の大きさを測って `Scene` に `insets` として渡し、図形がその内側に収まるようにしている
- ステータスバー（アンテナ・バッテリー）と重ならないよう、各画面のヘッダーは `env(safe-area-inset-top)` 分の余白を取る
- UI の文言は子ども向けのひらがな中心（「よみこみちゅう」「おめでとう！」など既存の調子に合わせる）

## 資料

- `開発ルール.md` — 必読ルール
- `README.md` — あそびかた、ステージ JSON の形式、ディレクトリ構成
- `docs/ネジはずし開発ガイド.md` — ネジはずしの内部構造・データの流れ・拡張レシピ・改良候補
- `docs/ネジはずしゲーム計画.md` — 当初の計画と、計画との差分メモ
- `scripts/e2e/README.md` — ヘッドレスブラウザでの動作確認スクリプト
