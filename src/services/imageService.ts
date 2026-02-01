// 画像圧縮サービス
// localStorageの容量制限（約5MB）対策

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 0.7;

/**
 * 画像を圧縮してBase64 Data URLを返す
 */
export async function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // リサイズ計算
        let { width, height } = img;
        
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Canvas に描画して圧縮
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // JPEG形式で圧縮（透過が不要な場合はJPEGの方が小さい）
        const compressedDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'));
    };
    
    img.src = dataUrl;
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
