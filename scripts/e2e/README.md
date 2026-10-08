# ヘッドレスブラウザでの動作確認

Playwright + Chromium で、ビルドした dist を実際に開いて遊んで確認するスクリプト。
Claude Code のクラウド環境では Playwright と Chromium が最初から入っている。
手元で動かす場合は `npm i -g playwright && npx playwright install chromium`。

```bash
bash scripts/e2e/run.sh neji-smoke    # ネジはずし: ステージ1クリア、ブロック表示、色仕分けの流れ
bash scripts/e2e/run.sh stage-shots   # 全ステージの初期表示をスクリーンショット
bash scripts/e2e/run.sh pwa-update    # 旧ビルド起動 → 新ビルド公開 → 自動更新 → オフライン起動
bash scripts/e2e/run.sh home-smoke    # ホーム / さがしもの一覧 / ゲーム画面 の表示
```

`run.sh` は `npm run build` → `vite preview`（ポート 4173）→ スクリプト実行 → サーバー停止 を行う。
スクリーンショットは `scripts/e2e/out/` に出る（git 管理外）。

各スクリプトは `?nejidebug=1` で公開される `window.__nejiDebug`（ネジの画面座標と `tap(id)`）を使う。
