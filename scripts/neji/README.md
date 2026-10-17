# ネジはずし ステージ生成（`npm run gen:neji`）

形だけを TypeScript で書き、色決め・検証・JSON の書き出しを自動で行う道具。

```
lib.ts            パーツ・ネジを短く書く関数（box / cyl / sph / fancy / screw）と、発掘ステージの組み立て（buildDig）
stages.ts         お題の定義。NEW_STAGES に関数を足すと生成の対象になる
generate.gen.ts   組み立て → 物理チェック → 色決め（logic/colorize.ts）→ 検証 → public/neji/ へ書き出し → index.json の更新
vitest.config.ts  この生成スクリプトだけを実行するための設定
```

## 使い方

```bash
npm run gen:neji                      # 新しいステージを組み立て、全ステージの色を混ぜ直して書き出す
GEN_MODE=check npm run gen:neji       # 物理チェックだけ。外せないネジがあれば邪魔している物を表示する
GEN_FILTER=stage-23 npm run gen:neji  # id に文字列を含むステージだけ
GEN_KEEP_COLORS=1 npm run gen:neji    # 既存ステージの色は変えない
GEN_MODE=plays npm run gen:neji       # 色は変えずに e2e 用の手順（scripts/e2e/solutions.json）だけ書き直す
```

終わると、ステージごとに「解」（ソルバーの取り外し順）と、
固まり度（同じ色が隣り合う割合）・手当たりしだいの失敗率・最初に外せない本数などの一覧が出る。
e2e スクリプトは `scripts/e2e/solutions.json`（解・わざと失敗する手順・おきばを使う手順。6 さいのプロフィール = おきば +1 の条件で求める）を読むので、色を変えたあとも手で直す必要はない。
書き出したあとは `npm run validate:neji` と `bash scripts/e2e/run.sh stage-shots`（見た目の確認）を通す。

## お題を足すとき

1. `stages.ts` に `function xxx(): StageSpec` を書き、`NEW_STAGES` に足す。色は `screw()` が仮で入れるので決めなくてよい
2. `GEN_MODE=check npm run gen:neji` で物理チェック。エラー文の意味は `docs/ネジはずし開発ガイド.md` の「よくあるミス」
3. ネジの本数は 3 の倍数（ボックス 1 個 = 3 本）にする
4. `npm run gen:neji` で書き出し → `npm test`

置き方の約束:

- 覆いの下のネジは、頭の高さ 0.2 + すきま 0.25 を空ける。覆いのネジは下のネジから横に 0.6 以上ずらす
- 貫くパーツは `partIds` に全部書く（先頭は頭が乗っているパーツ）。貫かないパーツを書いてもよい（そのネジが外れるまで落ちない）
- 平行なネジの頭同士は 0.6 以上、軸同士は 0.24 以上はなす。ネジの先端を他のパーツの面にぴったり付けない（0.1 以上はなす）
- 球に置くネジは軸の通る点（上下左右）に置くと、頭の縁が球に食い込まない

## 発掘ステージ（`buildDig`）

格子（`cols × rows`、中央が核）に土のブロックを並べ、1 個ずつ 1 本のネジで留める（上の行は上向き、下の行は下向き、中段は前後向き）。
`lids` で前・後ろ・上・底の覆いを付け、`planks` で前の覆いを板に分け、`stones` で前の覆いの上に石（覆いのネジをふさぐ）を乗せる。
ネジの本数が 3 の倍数にならない分は側面に横向きのネジを足して合わせる。
