# ヘッドレスブラウザでの動作確認

Playwright + Chromium で、ビルドした dist を実際に開いて遊んで確認するスクリプト。
Claude Code のクラウド環境では Playwright と Chromium が最初から入っている。
手元で動かす場合は `npm i -g playwright && npx playwright install chromium`。

```bash
bash scripts/e2e/run.sh neji-smoke      # ネジはずし: ステージ1クリア、ブロック表示、色仕分けの流れ
bash scripts/e2e/run.sh neji-dig        # 発掘ステージ（横向き）: ＋おきばのクイズ、ふたの下のブロック、たからばこ、つぎのステージのクイズ、しっぱい → つづきから（縦向き）
bash scripts/e2e/run.sh geo-shots       # 展開図（さいころ）を解いて開くのを確認、ピラミッド・漢字のブロック、各ステージのスクリーンショット
bash scripts/e2e/run.sh stage-shots     # 全ステージの初期表示をスクリーンショット
bash scripts/e2e/run.sh treasure-shots  # 発掘ステージの土を外して、たからもの（ほし・ダイヤ・骨）が見える状態を撮る
bash scripts/e2e/run.sh pwa-update      # 旧ビルド起動 → 新ビルド公開 → 自動更新 → オフライン起動
bash scripts/e2e/run.sh home-smoke      # ホーム / さがしもの一覧 / ゲーム画面 の表示
```

初回起動はプロフィール作成画面（なんさい？）が出るので、`common.cjs` の `gotoHome` が 6 さいで作ってからホームへ進む（6 さいはおきばが +1 される）。
クイズは正解が分からないので、`neji-dig.cjs` の `answerQuiz` は選択肢を順に試す。

`run.sh` は `npm run build` → `vite preview`（ポート 4173）→ スクリプト実行 → サーバー停止 を行う。
スクリーンショットは `scripts/e2e/out/` に出る（git 管理外）。

各スクリプトは `?nejidebug=1` で公開される `window.__nejiDebug`（ネジの画面座標と `tap(id)`）を使う。
