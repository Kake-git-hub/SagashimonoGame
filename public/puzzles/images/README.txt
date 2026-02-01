サンプル画像の追加手順
=======================

添付された「おもちゃの部屋」の画像を以下の場所に配置してください：

1. 画像ファイルを `public/puzzles/images/toy-room.webp` として保存
   - または `toy-room.png`, `toy-room.jpg` でも可（その場合は toy-room.json の imageSrc を更新）

2. 画像を追加後、再度ビルドしてプッシュ：
   ```
   npm run build
   git add -A
   git commit -m "Add sample puzzle image"
   git push
   ```

※ このファイルは画像追加後に削除してください
