/**
 * 「お手本の顔」: 正面を向いたサンプルの顔の点（478 点）
 * 唇・頬などの塗る形（regions.ts）をいったんこの顔の上で作り、顔メッシュを通して UV（塗る絵の座標）へ写すのに使う。
 * こうすると、楕円の大きさやぼかしの幅を「映像で見たときの見た目」で決められる
 */
import fixture from './fixtures/portrait-frame.json';
import { Point3 } from '../types';

const raw = fixture.landmarks as number[][];

// お手本の顔を、顔のまわりだけ切り出して width × height の絵に置いたときの点（px）。縦横の比は保つ
export interface ReferenceFace {
  width: number;
  height: number;
  // faceRegions に渡せる正規化座標（x / width, y / height が 0〜1）
  landmarks: Point3[];
}

export function referenceFace(width: number, margin = 0.12): ReferenceFace {
  const W = fixture.width, H = fixture.height;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of raw) {
    minX = Math.min(minX, x * W); maxX = Math.max(maxX, x * W);
    minY = Math.min(minY, y * H); maxY = Math.max(maxY, y * H);
  }
  const bw = maxX - minX, bh = maxY - minY;
  const scale = (width * (1 - margin * 2)) / bw;
  const height = Math.round(bh * scale + width * margin * 2);
  const ox = width * margin - minX * scale;
  const oy = (height - bh * scale) / 2 - minY * scale;
  const landmarks = raw.map(([x, y, z]) => ({
    x: (x * W * scale + ox) / width,
    y: (y * H * scale + oy) / height,
    z: (z * W * scale) / width,
  }));
  return { width, height, landmarks };
}
