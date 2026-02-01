import { Target, CONSTANTS } from '../types';

// サムネイルキャッシュ
const thumbnailCache = new Map<string, string>();

// 画像から特定座標周辺を切り抜いてサムネイルを生成
export async function generateThumbnail(
  imageSrc: string,
  target: Target,
  size: number = 80
): Promise<string> {
  const cacheKey = `${imageSrc}_${target.title}`;
  
  // キャッシュにあれば返す
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        canvas.width = size;
        canvas.height = size;

        // 座標を実際のピクセル位置に変換
        const [x, y] = target.position;
        const imgX = (x / CONSTANTS.SCALE) * img.width;
        const imgY = (y / CONSTANTS.SCALE) * img.height;

        // 切り抜き範囲を計算（中心からの範囲）
        const cropRadius = (CONSTANTS.THUMBNAIL_RADIUS / CONSTANTS.SCALE) * Math.min(img.width, img.height);
        const cropSize = cropRadius * 2;

        // 切り抜き開始位置（画像端を考慮）
        const srcX = Math.max(0, Math.min(img.width - cropSize, imgX - cropRadius));
        const srcY = Math.max(0, Math.min(img.height - cropSize, imgY - cropRadius));

        // 切り抜いて描画
        ctx.drawImage(
          img,
          srcX, srcY, cropSize, cropSize,
          0, 0, size, size
        );

        const dataUrl = canvas.toDataURL('image/png');
        thumbnailCache.set(cacheKey, dataUrl);
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'));
    };

    img.src = imageSrc;
  });
}

// 複数ターゲットのサムネイルを一括生成
export async function generateAllThumbnails(
  imageSrc: string,
  targets: Target[],
  size: number = 80
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // 画像を一度だけ読み込む
  const img = await loadImage(imageSrc);

  for (const target of targets) {
    const cacheKey = `${imageSrc}_${target.title}`;
    
    if (thumbnailCache.has(cacheKey)) {
      results.set(target.title, thumbnailCache.get(cacheKey)!);
      continue;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    canvas.width = size;
    canvas.height = size;

    const [x, y] = target.position;
    const imgX = (x / CONSTANTS.SCALE) * img.width;
    const imgY = (y / CONSTANTS.SCALE) * img.height;

    const cropRadius = (CONSTANTS.THUMBNAIL_RADIUS / CONSTANTS.SCALE) * Math.min(img.width, img.height);
    const cropSize = cropRadius * 2;

    const srcX = Math.max(0, Math.min(img.width - cropSize, imgX - cropRadius));
    const srcY = Math.max(0, Math.min(img.height - cropSize, imgY - cropRadius));

    ctx.drawImage(
      img,
      srcX, srcY, cropSize, cropSize,
      0, 0, size, size
    );

    const dataUrl = canvas.toDataURL('image/png');
    thumbnailCache.set(cacheKey, dataUrl);
    results.set(target.title, dataUrl);
  }

  return results;
}

// 画像を読み込むPromise
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

// キャッシュをクリア
export function clearThumbnailCache(): void {
  thumbnailCache.clear();
}
