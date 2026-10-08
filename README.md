# あそびひろば (SagashimonoGame)

子ども向けのミニゲームを集めたアプリです。起動するとホーム画面でゲームを選べます。

| ゲーム | 内容 | 状態 |
|---|---|---|
| 🔍 さがしものゲーム | 「ミッケ」風のもの探しゲーム | 公開中 |
| 🔩 ネジはずし | 3D の図形に刺さった色付きネジを外して同じ色のボックスに集めるパズル | 公開中（[計画書](docs/ネジはずしゲーム計画.md)） |

URL: https://kake-git-hub.github.io/SagashimonoGame/

## 技術スタック

- React 19 + TypeScript
- Vite
- three.js + @react-three/fiber + @react-three/drei（ネジはずしの 3D 表示）
- canvas-confetti（紙吹雪演出）
- vitest（ロジックの単体テストとステージ検証）
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

# テスト（ネジはずしのロジックとステージ検証）
npm test
```

## ディレクトリ構成

```
src/
  App.tsx                   ホーム画面と各ゲームを切り替えるルーター
  screens/HomeScreen.tsx    ゲーム選択画面
  games/
    sagashimono/            さがしものゲーム本体（一覧 / ゲーム / エディタの切り替え）
    neji/                   ネジはずし
      logic/                幾何計算・外せるか判定・ルール・リデューサー・ソルバー・検証（three.js の数学クラスのみ使用）
      components/           3D シーン・HUD・ステージ一覧・結果画面
      hooks/                ゲーム状態と HUD 演出のフック
      services/             ステージ取得・進捗保存
  components/               さがしものゲームの画面部品
  services/                 データ取得・保存（localStorage / IndexedDB / GitHub API）
  hooks/                    共通フック
  types/                    型定義・共通定数
  utils/                    共通ユーティリティ（紙吹雪など）
public/
  puzzles/                  さがしものゲームのパズルデータ
  neji/                     ネジはずしのステージデータ
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

## 🔩 ネジはずし

3D の図形に刺さった色付きネジをタップして外し、同じ色のボックス（3 本入り）に集めるパズルです。
仕様と実装計画は [docs/ネジはずしゲーム計画.md](docs/ネジはずしゲーム計画.md) を参照してください。

### あそびかた

- ドラッグで図形を回す。2 本指で拡大縮小。何もない所をすばやく 2 回タップ（または ↺）で向きを戻す
- ネジをタップすると外れて、同じ色のボックスへ飛ぶ。ボックスが満杯になると次のボックスが来る
- 同じ色のボックスが無いときは「おきば」に置かれる。おきばが満杯になると失敗
- 板の下や、ほかのネジの軸の下にあるネジは、上の物を先に外さないと外せない（震えて、邪魔している物が赤く光る）
- ネジが全部外れたパーツは落ちる。全部のネジを外すとクリア

### ステージの追加方法

1. `public/neji/stages/<id>.json` を作成
2. `public/neji/index.json` に `{ "id", "name", "emoji", "difficulty", "screwCount" }` を追加
3. `npm run validate:neji` で検証（物理的な重なり・色の本数・解けるか）

#### ステージJSONフォーマット

```json
{
  "id": "stage-01",
  "name": "はこ",
  "emoji": "📦",
  "difficulty": 1,
  "boxCapacity": 3,
  "visibleBoxes": 2,
  "bufferSlots": 5,
  "boxes": ["red", "blue"],
  "parts": [
    { "id": "base", "shape": "box", "size": [4, 1.2, 4], "position": [0, 0, 0], "color": "#8ecae6", "fixed": true }
  ],
  "screws": [
    { "id": "t1", "color": "red", "position": [1.2, 0.6, 1.2], "dir": [0, 1, 0], "length": 1.0, "partIds": ["base"] }
  ]
}
```

- 座標は右手系で Y が上。1 単位 ≒ ネジ 1 本分の長さ
- `parts[].shape`: `box`（`size`）/ `cylinder`（`radius`, `height`、ローカル Y 軸方向）/ `sphere`（`radius`）。`rotation` はオイラー角（度）
- `parts[].fixed`: true なら最後まで落ちない土台。false のパーツはどれかのネジで固定されている必要がある
- `screws[].position`: 頭が乗っている面上の点。`dir` は外向き。`length` は面から内部へ入る軸の長さ（省略時 1.0）
- `screws[].partIds`: そのネジが固定しているパーツ。先頭は頭が乗っているパーツ。軸が貫くパーツはすべて列挙する
- `boxes`: ボックスが登場する順番。各色のネジ本数は `boxCapacity × その色のボックス数` と一致させる
- 色は `red / blue / green / yellow / purple / orange`
- ネジの軸同士が交差したり、頭が他のパーツに食い込んだりしていると検証でエラーになる

## デプロイ

`main` ブランチへの push で GitHub Pages にデプロイされます。
