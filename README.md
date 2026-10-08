# あそびひろば (SagashimonoGame)

子ども向けのミニゲームを集めたアプリです。起動するとホーム画面でゲームを選べます。

| ゲーム | 内容 | 状態 |
|---|---|---|
| 🔍 さがしものゲーム | 「ミッケ」風のもの探しゲーム | 公開中 |
| 🔩 ネジはずし | 3D の図形に刺さった色付きネジを外して同じ色のボックスに集めるパズル | 開発中（[計画書](docs/ネジはずしゲーム計画.md)） |

URL: https://kake-git-hub.github.io/SagashimonoGame/

## 技術スタック

- React 19 + TypeScript
- Vite
- canvas-confetti（紙吹雪演出）
- PWA（manifest + Service Worker）

## 開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Lint
npm run lint
```

## ディレクトリ構成

```
src/
  App.tsx                   ホーム画面と各ゲームを切り替えるルーター
  screens/HomeScreen.tsx    ゲーム選択画面
  games/
    sagashimono/            さがしものゲーム本体（一覧 / ゲーム / エディタの切り替え）
    neji/                   ネジはずし（開発中）
  components/               さがしものゲームの画面部品
  services/                 データ取得・保存（localStorage / IndexedDB / GitHub API）
  hooks/                    共通フック
  types/                    型定義・共通定数
public/
  puzzles/                  さがしものゲームのパズルデータ
```

---

## 🔍 さがしものゲーム

### 機能

- 画像内の隠されたアイテムを探すゲーム
- タブレット横画面・スマホ縦画面に対応
- ヒント機能（未発見アイテムの位置を光らせる）
- 進捗保存（中断再開対応）
- クリア時の紙吹雪演出
- パズルエディタ（新しいパズルを作成可能）
- お題リストのテキスト/サムネイル切替

### パズルデータの追加方法

1. `public/puzzles/images/` に画像を追加
2. `public/puzzles/` にパズル定義JSONを作成
3. `public/puzzles/index.json` にパズル情報を追加

#### パズルJSONフォーマット

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

#### AI生成画像の活用

AI画像生成ツールで画像とお題リストを同時に生成できます。生成されたJSONをエディタでインポート可能です。

---

## 🔩 ネジはずし（開発中）

仕様と実装計画は [docs/ネジはずしゲーム計画.md](docs/ネジはずしゲーム計画.md) を参照してください。

## デプロイ

`main` ブランチへの push で GitHub Pages にデプロイされます。
