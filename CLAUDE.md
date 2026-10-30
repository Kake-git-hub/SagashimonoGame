# CLAUDE.md — あそびひろば 開発メモ

このリポジトリで作業する前に **`開発ルール.md` を必ず読む**（push のルール・ビルド確認・保存データの扱い）。

## 何のリポジトリか

子ども向けミニゲームを集めた PWA「あそびひろば」。GitHub Pages で公開（`https://kake-git-hub.github.io/SagashimonoGame/`）。

| ゲーム | 場所 | 概要 |
|---|---|---|
| さがしものゲーム | `src/games/sagashimono/` + `src/components/` + `src/services/` | 「ミッケ」風のもの探し。パズルエディタと GitHub へのアップロード機能あり |
| ネジはずし | `src/games/neji/` | 3D 図形のネジをタップで外し、色ごとのボックスに集めるパズル。詳細は `docs/ネジはずし開発ガイド.md` |
| マジックメイクミラー | `src/games/makeup/` + `public/makeup/` | インカメラの顔に顔認識（MediaPipe、478 点）でおけしょうを重ね（ためす）、塗る場所と向きを矢印で案内し（おしえて）、顔型から提案する（ていあん）。本来は単体アプリにしたいものの試作。詳細は `docs/お化粧アプリ開発ガイド.md` |

共通部分: `src/App.tsx`（プロフィール選択/ホーム/おうちのひと設定/各ゲームの薄いルーター）、`src/screens/HomeScreen.tsx`、`src/services/pwaUpdateService.ts`（PWA 自動更新）、`src/sw.ts`（Service Worker）。

プラットフォーム共通の機能（どのゲームからも使う）:

| 機能 | 場所 | 概要 |
|---|---|---|
| プロフィール（なんさい？） | `src/services/profileService.ts`, `src/screens/ProfileScreen.tsx` | 起動時に名前と年齢を登録。兄弟分を持てて、進捗はプロフィールごとに分かれる。年齢 → 難易度・クイズレベル（`difficultyForAge`） |
| べんきょうクイズ | `src/services/quiz/`（`index.ts` が科目の登録簿、`generators/` が科目ごとの問題生成）, `src/components/quiz/QuizScreen.tsx`（全画面）, `src/hooks/useQuizGate.tsx` | 年齢に合わせた問題を生成。`useQuizGate().ask(trigger)` が「クイズに正解したら true」の Promise を返す。科目を増やすときは `generators/` にファイルを足して `GENERATORS` に登録する |
| おうちのひと設定 | `src/services/appSettingsService.ts`, `src/screens/ParentSettingsScreen.tsx` | かけ算の関門の先。クイズを出す場面・レベル・科目、おたすけの回数、プロフィールの編集 |

## よく使うコマンド

```bash
npm run dev            # 開発サーバー（Service Worker は動かない）
npm run build          # tsc -b && vite build（型エラーで落ちる）
npm run lint           # eslint
npm test               # vitest: ロジックの単体テスト + 全ステージ検証
npm run validate:neji  # ステージ JSON の検証だけ
npm run metrics:neji   # ステージごとの難しさの目安（最初に外せない本数・手当たりしだいの失敗率など）
npm run gen:neji       # scripts/neji/stages.ts のステージを組み立て、全ステージのネジの色を混ぜ直して public/neji/ に書く
npm run preview        # dist を配信（PWA の動作確認はこちら）
bash scripts/e2e/run.sh neji-smoke   # ヘッドレス Chromium で実際に遊んで確認（scripts/e2e/README.md）
bash scripts/e2e/run.sh neji-dig     # 発掘ステージ・クイズ・おたすけ・つづきから の流れ
bash scripts/e2e/run.sh geo-shots    # 展開図・ピラミッド・漢字ステージ（ブロックの確認とスクリーンショット）
bash scripts/e2e/run.sh offline      # サーバーを止めて、さがしもの（絵も）・ネジはずし・マジックメイクミラーがオフラインで遊べるか
bash scripts/e2e/run.sh makeup-smoke # 偽カメラで マジックメイクミラーの はじめに → ミラー → もどる（カメラが止まるか）
bash scripts/e2e/run.sh makeup-face  # 顔写真で顔認識 → ためす → おしえて → ていあん の流れ（写真は初回にダウンロード、ffmpeg が要る）
```

push 前に `npm run build` / `npm run lint` / `npm test` を通す。CI（`.github/workflows/deploy.yml`）も同じ順で実行し、`main` に push されると GitHub Pages へデプロイされる。

## 作業の流れ

1. 作業ブランチで開発し、ビルド・lint・テストを通して push
2. **毎回必ず** `main` へ fast-forward マージして push する（ユーザーは毎回実機 iPad / iPhone で確認する）→ 自動デプロイ（2〜3 分）。聞かずにマージしてよい
   ```bash
   git fetch origin main && git checkout main && git merge --ff-only origin/main && git merge --ff-only <作業ブランチ> && git push origin main && git checkout <作業ブランチ>
   ```
3. 公開中の PWA は、次の起動時か前面復帰時に新ビルドを検知し、ホーム画面にいるときに自動で切り替わる。ホーム画面下の「バージョン: 日時」がビルド日時

## 守ること

- 既存ユーザーのデータを壊さない: localStorage のキー接頭辞（`sagashimono_` / `neji_` / `makeup_`）と IndexedDB 名 `sagashimono_db` は変えない。プロフィールごとの保存は `profileStorageKey(base)` を通す（最初のプロフィールは従来キーをそのまま使い、2 人目以降は `__<id>` が付く）。プラットフォーム共通の設定は `asobi_` 接頭辞
- リポジトリ名と `base: '/SagashimonoGame/'` は変えない（PWA の登録パスが壊れる）
- `public/sw.js` / `public/manifest.json` は作らない（ビルドで生成される。manifest は `vite.config.ts` で編集）
- オフラインで全部遊べる状態を保つ: ゲームが読み込むファイル（JS/CSS/JSON/さがしものの絵 webp など）は `vite.config.ts` の `injectManifest.globPatterns` で事前キャッシュに入れる。新しい種類のファイルを足したら `bash scripts/e2e/run.sh offline` で確認する。例外はマジックメイクミラーの顔認識（wasm 約 14MB とモデル約 4MB）で、`src/sw.ts` の実行時キャッシュ（`makeup-model`）に「初めて開いたとき」に入れる（初回だけオンラインが要る）
- マジックメイクミラーの映像・顔の点・写真は端末の外に出さない（通信は wasm とモデルのダウンロードだけ）。写真はアプリ内に保存せず、「ほぞん」で共有シート / ダウンロードに渡すだけ。カメラは「もどる」・ホームへ戻る・裏に回ったときに必ず止める（`useCamera`）
- マジックメイクミラーの文言も子ども向けのひらがな中心（メイク用語はカタカナ）。文言は `src/games/makeup/strings.ts` に集めてある。`src/games/makeup/` の中からプラットフォームのコード（`profileService` など）を import しない（`MakeupApp` の props で受け取る。後で単体アプリに切り出すため）
- レシピ（`public/makeup/recipes/`）や領域の番号を変えたら `npm test`（`recipes.test.ts` / `regions.test.ts`）を通す。顔の点の番号は `logic/regions.ts` にだけ書く
- ホーム画面など軽い画面から three.js に依存するモジュールを import しない（`src/games/neji/logic/geometry.ts` 等）。ネジはずしは `React.lazy` で別チャンクにしてある
- ネジはずしのステージ JSON を追加・変更したら `npm run validate:neji` を通す。検証を弱めてごまかさない（解けないステージを配布しないための仕組み）。底面（`dir: [0,-1,0]`）にもネジを置き、外側のパーツを外さないと取れないネジ（ふた・上の段・前の画）を多めに入れる
- ネジの色は手で決めず `npm run gen:neji`（`logic/colorize.ts`）で混ぜる。同じ色が近くに固まると簡単になりすぎる。新しいお題は `scripts/neji/stages.ts` に形だけ書く（`scripts/neji/README.md`）
- 画面が切り替わった直後の連打対策: 結果画面・クイズ・たからものを見る画面のボタンは `useTapGuard` で出てから約 1 秒は押せない。新しい画面を足すときも同じにする
- ネジはずしの画面は 3D を全面に敷き、HUD（ボックス・おきば・ヘッダー）を透過で重ねる。HUD の位置は `neji.css` の `@media (orientation: landscape)` で切り替え、`NejiGameScreen` が HUD の大きさを測って `Scene` に `insets` として渡し、図形がその内側に収まるようにしている
- ステータスバー（アンテナ・バッテリー）と重ならないよう、各画面のヘッダーは `env(safe-area-inset-top)` 分の余白を取る
- UI の文言は子ども向けのひらがな中心（「よみこみちゅう」「おめでとう！」など既存の調子に合わせる）

## 資料

- `開発ルール.md` — 必読ルール
- `README.md` — あそびかた、ステージ JSON の形式、ディレクトリ構成
- `docs/ネジはずし開発ガイド.md` — ネジはずしの内部構造・データの流れ・拡張レシピ・改良候補
- `docs/ネジはずしゲーム計画.md` — 当初の計画と、計画との差分メモ
- `docs/お化粧アプリ計画.md` — マジックメイクミラー（インカメラ＋顔認識で化粧を案内する新ゲーム）の計画と、計画との差分メモ
- `docs/お化粧アプリ開発ガイド.md` — マジックメイクミラーの内部構造・データの流れ・内容データの増やし方・既知の制限
- `scripts/e2e/README.md` — ヘッドレスブラウザでの動作確認スクリプト
