# さがしものゲーム (SagashimonoGame)

「ミッケ」風のもの探しゲームアプリです。

## 機能

- 🔍 画像内の隠されたアイテムを探すゲーム
- 📱 タブレット横画面・スマホ縦画面に対応
- 💡 ヒント機能（未発見アイテムの位置を光らせる）
- ✅ 進捗保存（中断再開対応）
- 🎉 クリア時の紙吹雪演出
- ✏️ パズルエディタ（新しいパズルを作成可能）
- 🖼️ お題リストのテキスト/サムネイル切替

## 技術スタック

- React 19 + TypeScript
- Vite
- canvas-confetti（紙吹雪演出）

## 開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build
```

## パズルデータの追加方法

1. `public/puzzles/images/` に画像を追加
2. `public/puzzles/` にパズル定義JSONを作成
3. `public/puzzles/index.json` にパズル情報を追加

### パズルJSONフォーマット

```json
{
  "id": "puzzle-id",
  "name": "パズル名",
  "imageSrc": "puzzles/images/puzzle-id.webp",
  "targets": [
    {"title": "アイテム名", "position": [x, y]}
  ]
}
```

座標は画像の左上を(0,0)、右下を(1000,1000)としたスケールです。

### AI生成画像の活用

AI画像生成ツールで画像とお題リストを同時に生成できます。生成されたJSONをエディタでインポート可能です。

## デプロイ

GitHub Pages にデプロイされます。

URL: https://kake-git-hub.github.io/SagashimonoGame/
