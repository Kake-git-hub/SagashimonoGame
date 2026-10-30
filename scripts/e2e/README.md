# ヘッドレスブラウザでの動作確認

Playwright + Chromium で、ビルドした dist を実際に開いて遊んで確認するスクリプト。
Claude Code のクラウド環境では Playwright と Chromium が最初から入っている。
手元で動かす場合は `npm i -g playwright && npx playwright install chromium`。

```bash
bash scripts/e2e/run.sh neji-smoke      # ネジはずし: ステージ1クリア、ブロック表示、色仕分けの流れ
bash scripts/e2e/run.sh neji-dig        # 発掘ステージ（横向き）: ＋おきばのクイズ、ふたの下のブロック、たからばこ、つぎのステージのクイズ、しっぱい → つづきから（縦向き）
bash scripts/e2e/run.sh geo-shots       # 展開図（さいころ）を解いて開くのを確認、ピラミッド・漢字のブロック、各ステージのスクリーンショット
bash scripts/e2e/run.sh stage-shots     # 全ステージの初期表示をスクリーンショット
bash scripts/e2e/run.sh treasure-shots  # 全発掘ステージの土を外して、たからものが見える状態を撮る
bash scripts/e2e/run.sh pwa-update      # 旧ビルド起動 → 新ビルド公開 → 自動更新 → オフライン起動
bash scripts/e2e/run.sh home-smoke      # ホーム / さがしもの一覧 / ゲーム画面 の表示
bash scripts/e2e/run.sh offline         # ホームを開いた直後にマジックメイクミラーを一度開いてからサーバーを止め、さがしもの（絵も）・ネジはずし・マジックメイクミラーが遊べるか
bash scripts/e2e/run.sh makeup-smoke    # マジックメイクミラー: 偽カメラ（合成映像）で はじめに → ミラー → もどる（カメラのトラックが止まるか）
bash scripts/e2e/run.sh makeup-face     # マジックメイクミラー: 顔写真の偽カメラと写真モードで 478 点 → ためす（6 レイヤー・ほぞん）→ おしえて（ナチュラル）→ ていあん
```

マジックメイクミラーの偽カメラは `common.cjs` の `launch(viewport, { fakeCamera: true | '<y4m のパス>' })`（Chromium の `--use-fake-device-for-media-stream`、許可は自動）。
`makeup-face.cjs` は MediaPipe のサンプルの顔写真を `scripts/e2e/assets/`（git 管理外）にダウンロードし、ffmpeg で 4:3 の y4m にして流す。ffmpeg が無ければカメラの部分を飛ばして写真モードだけ確認する。
`E2E_WRITE_FIXTURE=1` を付けると、写真モードの点群を `src/games/makeup/logic/fixtures/portrait-frame.json` に書き直す（領域の単体テストが使う）。
`?makeupdebug=1` で公開される `window.__makeupDebug`（点群・状態・FPS・look・ガイドのステップ・しんだん結果・`applyLook`）を使う。

初回起動はプロフィール作成画面（なんさい？）が出るので、`common.cjs` の `gotoHome` が 6 さいで作ってからホームへ進む（6 さいはおきばが +1 される）。
クイズは正解が分からないので、`neji-dig.cjs` の `answerQuiz` は選択肢を順に試す。

`run.sh` は `npm run build` → `vite preview`（ポート 4173）→ スクリプト実行 → サーバー停止 を行う。
スクリーンショットは `scripts/e2e/out/` に出る（git 管理外）。

Playwright の `context.setOffline(true)` は Service Worker 自身の通信を止めないため、キャッシュに無いファイルもネットから取れてしまう。オフラインの確認は `offline.cjs` のようにサーバーを止めて行う。

各スクリプトは `?nejidebug=1` で公開される `window.__nejiDebug`（ネジの画面座標と `tap(id)`）を使う。

ネジを外す順番は `scripts/e2e/solutions.json`（`npm run gen:neji` が書き出す。ステージ id → `order`: ソルバーの解、`fail`: 先を読まずに外しておきばがあふれる手順、`demo`: おきばを使いつつクリアする手順。6 さいのプロフィール = おきば +1 の条件で求めてある）から読むので、ステージの色を変えたあとは `GEN_MODE=plays npm run gen:neji` で書き直せばスクリプトを直さなくてよい。`common.cjs` の `solutionFor` / `playsFor` / `findStageWith`。
