// 画像圧縮サービス
// localStorageの容量制限（約5MB）対策
// iPadなど高解像度デバイスの大きな写真にも対応

// ターゲットサイズ: localStorageは約5MBなので、画像1枚を800KB以内に収める
const TARGET_SIZE_BYTES = 800 * 1024; // 800KB
const MAX_WIDTH = 1024;
const MAX_HEIGHT = 1024;
const INITIAL_QUALITY = 0.7;
const MIN_QUALITY = 0.3;

/**
 * 画像をCanvasに描画して指定形式・品質で出力
 */
function drawToCanvas(
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
): HTMLCanvasElement {
  let { width, height } = img;

  if (width > maxW || height > maxH) {
    const ratio = Math.min(maxW / width, maxH / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/**
 * 画像を圧縮してBase64 Data URLを返す
 * ターゲットサイズ以下になるまで品質を段階的に下げる
 */
export async function compressImage(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);

  const canvas = drawToCanvas(img, MAX_WIDTH, MAX_HEIGHT);

  // WebPが使えるか判定
  const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  const mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';

  // 段階的に品質を下げてターゲットサイズ以下にする
  let quality = INITIAL_QUALITY;
  let result = canvas.toDataURL(mimeType, quality);

  while (estimateBase64Size(result) > TARGET_SIZE_BYTES && quality > MIN_QUALITY) {
    quality -= 0.05;
    result = canvas.toDataURL(mimeType, quality);
  }

  // それでも大きい場合はさらにリサイズ
  if (estimateBase64Size(result) > TARGET_SIZE_BYTES) {
    const smallerCanvas = drawToCanvas(img, 800, 800);
    quality = 0.5;
    result = smallerCanvas.toDataURL(mimeType, quality);

    while (estimateBase64Size(result) > TARGET_SIZE_BYTES && quality > MIN_QUALITY) {
      quality -= 0.05;
      result = smallerCanvas.toDataURL(mimeType, quality);
    }
  }

  return result;
}

/**
 * 画像を読み込んでHTMLImageElementを返す
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

/**
 * Base64文字列のサイズを概算（バイト）
 */
export function estimateBase64Size(dataUrl: string): number {
  // Data URL prefix を除去
  const base64 = dataUrl.split(',')[1] || dataUrl;
  // Base64は元データの約4/3倍のサイズ
  return Math.ceil(base64.length * 0.75);
}

/**
 * サイズをKB/MB表記に変換
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
