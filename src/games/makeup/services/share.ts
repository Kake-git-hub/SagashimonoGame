/**
 * 写真の保存・共有
 * 共有シート（navigator.share）が使えればそれで（iOS は「写真に保存」できる）、無ければダウンロードする
 */

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), type, quality);
  });
}

export async function shareOrDownload(blob: Blob, filename: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled';
      // 共有に失敗したらダウンロードに切り替える
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function stillFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `makeup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`;
}
