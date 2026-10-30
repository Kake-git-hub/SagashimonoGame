/**
 * 顔の点（478 点）から、メイクを塗る領域やガイドの目印になる点を作る純粋関数
 * 座標はすべて「映像のピクセル」（幅 w、高さ h）で返す。番号は MediaPipe Face Landmarker のもの。
 * 左右は自分から見た左右（R = 自分の右 = 番号の若い方。鏡像表示では画面の右側に出る）
 */
import { Point3 } from '../types';

export interface Pt { x: number; y: number }

export type Shape =
  | { kind: 'polygon'; points: Pt[]; holes?: Pt[][] }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotation: number }
  | { kind: 'stroke'; points: Pt[]; widths: number[] };

// 輪郭をなぞる順番で並べた点の番号
export const IDX = {
  lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  lipsInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191],
  eyeR: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  eyeL: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  browR: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  browL: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  // 上まぶたの際（目尻 → 目頭）
  upperLidR: [33, 246, 161, 160, 159, 158, 157, 173, 133],
  upperLidL: [263, 466, 388, 387, 386, 385, 384, 398, 362],
  // 下まぶたの際（目頭 → 目尻）
  lowerLidR: [133, 155, 154, 153, 145, 144, 163, 7, 33],
  lowerLidL: [362, 382, 381, 380, 374, 373, 390, 249, 263],
  // 眉のすぐ下の列（目尻側 → 目頭側）
  belowBrowR: [226, 113, 225, 224, 223, 222, 221, 189],
  belowBrowL: [446, 342, 445, 444, 443, 442, 441, 413],
  // 目の下の頬の上の列（目尻側 → 目頭側）
  cheekTopR: [111, 117, 118, 119, 120, 121, 128],
  cheekTopL: [340, 346, 347, 348, 349, 350, 357],
  noseBridge: [168, 6, 197, 195, 5, 4],
  faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  // チークの中心を決める頬の点
  cheekR: [50, 101, 123, 187, 205],
  cheekL: [280, 330, 352, 411, 425],
} as const;

// ガイドの目印に使う点の名前 → 番号
export const NAMED = {
  foreheadCenter: 10,
  foreheadLower: 9,
  chin: 152,
  noseTop: 168,
  noseTip: 4,
  cheekR: 234,
  cheekL: 454,
  templeR: 127,
  templeL: 356,
  cheekboneR: 117,
  cheekboneL: 346,
  cheekAppleR: 50,
  cheekAppleL: 280,
  browHeadR: 107,
  browPeakR: 105,
  browTailR: 70,
  browHeadL: 336,
  browPeakL: 334,
  browTailL: 300,
  eyeOuterR: 33,
  eyeInnerR: 133,
  eyeOuterL: 263,
  eyeInnerL: 362,
  irisR: 468,
  irisL: 473,
  lipTop: 0,
  lipBottom: 17,
  lipCornerR: 61,
  lipCornerL: 291,
  cupidR: 37,
  cupidL: 267,
} as const;

export type NamedPoint = keyof typeof NAMED;

export interface FaceRegions {
  faceWidth: number;        // 頬から頬までの幅（px）。大きさの基準
  points: Record<NamedPoint, Pt>;
  lipsOuter: Pt[];
  lipsInner: Pt[];
  eyeR: Pt[];
  eyeL: Pt[];
  browR: Pt[];
  browL: Pt[];
  shadowR: Pt[];
  shadowL: Pt[];
  underEyeR: Pt[];
  underEyeL: Pt[];
  faceOval: Pt[];
  noseBridge: Pt[];
  upperLidR: Pt[];
  upperLidL: Pt[];
  cheekR: Shape & { kind: 'ellipse' };
  cheekL: Shape & { kind: 'ellipse' };
  cheekboneR: Shape & { kind: 'ellipse' };
  cheekboneL: Shape & { kind: 'ellipse' };
  chinHighlight: Shape & { kind: 'ellipse' };
  foreheadHighlight: Shape & { kind: 'ellipse' };
  linerR: Shape & { kind: 'stroke' };
  linerL: Shape & { kind: 'stroke' };
}

function mean(pts: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// 頬の高いところを中心に、こめかみへ向かって斜めに伸びる楕円
function cheekEllipse(center: Pt, temple: Pt, faceWidth: number): Shape & { kind: 'ellipse' } {
  const rotation = Math.atan2(temple.y - center.y, temple.x - center.x);
  const c = lerp(center, temple, 0.15);
  return { kind: 'ellipse', cx: c.x, cy: c.y, rx: faceWidth * 0.16, ry: faceWidth * 0.10, rotation };
}

// 頬骨の上（目尻の下）からこめかみへ、細長く
function cheekboneEllipse(top: Pt, temple: Pt, faceWidth: number): Shape & { kind: 'ellipse' } {
  const c = lerp(top, temple, 0.35);
  const rotation = Math.atan2(temple.y - top.y, temple.x - top.x);
  return { kind: 'ellipse', cx: c.x, cy: c.y, rx: faceWidth * 0.11, ry: faceWidth * 0.04, rotation };
}

// アイライン: 上まぶたの際を目尻側ほど太く。目尻の先に少し跳ね上げを足す
function liner(upperLid: Pt[], faceWidth: number): Shape & { kind: 'stroke' } {
  const outer = upperLid[0];
  const inner = upperLid[upperLid.length - 1];
  const dir = { x: outer.x - inner.x, y: outer.y - inner.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  // 目尻の向きに、上向き（映像では -y）を少し混ぜる
  const wx = dir.x / len, wy = dir.y / len - 0.45;
  const wl = Math.hypot(wx, wy) || 1;
  const wing: Pt = { x: outer.x + (wx / wl) * faceWidth * 0.07, y: outer.y + (wy / wl) * faceWidth * 0.07 };
  const points = [wing, ...upperLid];
  const thick = faceWidth * 0.02, thin = faceWidth * 0.005;
  const widths = points.map((_, i) => thick + (thin - thick) * (i / (points.length - 1)));
  widths[0] = thin * 1.5; // 跳ね上げの先は細く
  return { kind: 'stroke', points, widths };
}

export function faceRegions(landmarks: Point3[], w: number, h: number): FaceRegions {
  const px = (i: number): Pt => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
  const poly = (ids: readonly number[]): Pt[] => ids.map(px);
  const points = Object.fromEntries(Object.entries(NAMED).map(([k, i]) => [k, px(i)])) as Record<NamedPoint, Pt>;
  const faceWidth = dist(points.cheekR, points.cheekL);

  const upperLidR = poly(IDX.upperLidR);
  const upperLidL = poly(IDX.upperLidL);
  const chin = points.chin;
  const forehead = lerp(points.foreheadCenter, points.foreheadLower, 0.5);

  return {
    faceWidth,
    points,
    lipsOuter: poly(IDX.lipsOuter),
    lipsInner: poly(IDX.lipsInner),
    eyeR: poly(IDX.eyeR),
    eyeL: poly(IDX.eyeL),
    browR: poly(IDX.browR),
    browL: poly(IDX.browL),
    shadowR: [...upperLidR, ...poly(IDX.belowBrowR).reverse()],
    shadowL: [...upperLidL, ...poly(IDX.belowBrowL).reverse()],
    underEyeR: [...poly(IDX.lowerLidR), ...poly(IDX.cheekTopR)],
    underEyeL: [...poly(IDX.lowerLidL), ...poly(IDX.cheekTopL)],
    faceOval: poly(IDX.faceOval),
    noseBridge: poly(IDX.noseBridge),
    upperLidR,
    upperLidL,
    cheekR: cheekEllipse(mean(poly(IDX.cheekR)), points.templeR, faceWidth),
    cheekL: cheekEllipse(mean(poly(IDX.cheekL)), points.templeL, faceWidth),
    cheekboneR: cheekboneEllipse(points.cheekboneR, points.templeR, faceWidth),
    cheekboneL: cheekboneEllipse(points.cheekboneL, points.templeL, faceWidth),
    chinHighlight: { kind: 'ellipse', cx: chin.x, cy: chin.y - faceWidth * 0.06, rx: faceWidth * 0.07, ry: faceWidth * 0.035, rotation: 0 },
    foreheadHighlight: { kind: 'ellipse', cx: forehead.x, cy: forehead.y + faceWidth * 0.03, rx: faceWidth * 0.12, ry: faceWidth * 0.07, rotation: 0 },
    linerR: liner(upperLidR, faceWidth),
    linerL: liner(upperLidL, faceWidth),
  };
}

// 多角形の面積（符号なし、px²）
export function polygonArea(points: Pt[]): number {
  let s = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    s += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(s) / 2;
}

// 多角形の重心（頂点の平均）
export function polygonCenter(points: Pt[]): Pt {
  return mean(points);
}

// 点が多角形の中にあるか
export function pointInPolygon(p: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
