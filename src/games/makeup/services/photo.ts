/**
 * 選んだ写真を、扱いやすい大きさにして URL で返す
 * 写真の実サイズが、そのまま描画の canvas と GPU のテクスチャの大きさになる。スマホの写真（1200 万画素〜）をそのまま使うと、
 * 1 枚で数十 MB を何枚も持つことになり、iOS では落ちたり真っ黒になったりするので、長い辺を maxSide までに縮める
 */
export const PHOTO_MAX_SIDE = 1280;

export async function loadPhotoUrl(file: Blob, maxSide = PHOTO_MAX_SIDE): Promise<string> {
  const original = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = original;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    if (scale >= 1) return original;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    // 作業用の canvas のメモリをすぐ返す
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) return original;
    URL.revokeObjectURL(original);
    return URL.createObjectURL(blob);
  } catch {
    // 読めない形式など: そのまま渡して、<img> 側の表示に任せる
    return original;
  }
}
